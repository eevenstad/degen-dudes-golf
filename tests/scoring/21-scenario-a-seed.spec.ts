/**
 * 21-scenario-a-seed.spec.ts
 * Seeds Scenario A scores for all 11 players, Day 1 (Terra Lago North)
 * via direct Supabase REST API calls to saveScore server action endpoint.
 *
 * Scenario A: Every player shoots par+2 on every hole.
 * Expected gross: 108 (every hole), Net per TESTING-PLAN.md Section 3.
 *
 * Uses the Supabase service-role key to call the saveScore logic directly
 * by mimicking what the server action does: insert into scores with
 * pre-calculated net_score, ch_strokes, ph_strokes, ph_score fields.
 *
 * IMPORTANT: Run reset-test-data.ts BEFORE this file.
 */

import { test, expect } from '@playwright/test'
import * as fs from 'fs'

// ─── Constants ────────────────────────────────────────────────────────────────

const SUPABASE_URL = 'https://lnnlabbdffowjpaxvnsp.supabase.co'
const ANON_KEY = 'sb_publishable_h-llAuZxPV-W4qnH82BKSA_VuqnwNer'
const SERVICE_KEY = fs.readFileSync(
  `${process.env.HOME}/.config/supabase/degen-dudes-service-role`,
  'utf8'
).trim()

// Course IDs (from TESTING-PLAN.md Section 9)
const COURSES = {
  TerraLago: '9333b881-441e-43f0-9aa8-efe8f9dcd203',   // Day 1
  PGAWest:   'fb74b2c0-b9df-4926-8867-13d83a2cdf7f',   // Day 2
  EagleFalls: '6a96b6d2-9271-4191-ba6c-da0232a9ca46',  // Day 3
}

// Player IDs (from TESTING-PLAN.md Section 9)
const PLAYERS = {
  Ryan:    '06559478-aa82-4a0d-aa26-d239ae8414f4',
  Kiki:    '2377121e-5093-4250-9459-9cec514d9ff4',
  Mack:    'c407edd3-591f-4faf-afed-c6e156698b33',
  Bruce:   '8ba6e2af-35d9-42bb-9750-f35fcbb9746c',
  Matthew: '57a4fdd1-6cac-4264-ad8d-809aef763ee1',
  CPat:    '5ac3e47e-68d3-4a66-a6ae-47376bdd9faf',
  Eric:    '989f9143-2f6b-4060-8875-20feb87ead55',
  Ben:     'e2fc862d-3f4b-49f7-ac6f-97abecaad00e',
  Gary:    'e0928ef5-83fe-440c-8a1c-76704f4886af',
  Chris:   '6e49119a-2050-4e50-be46-42c2e89451b8',
  Jauch:   '2dcc566e-b465-431b-90a1-0f9791de614e',
}

// ─── Supabase helpers ──────────────────────────────────────────────────────────

async function sbGet(path: string) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
    },
  })
  if (!res.ok) throw new Error(`GET ${path} → ${res.status}: ${await res.text()}`)
  return res.json()
}

async function sbUpsert(table: string, rows: Record<string, unknown>[]) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
    method: 'POST',
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates,return=representation',
    },
    body: JSON.stringify(rows),
  })
  if (!res.ok) throw new Error(`UPSERT ${table} → ${res.status}: ${await res.text()}`)
  return res.json()
}

// ─── Scoring helpers (mirror of src/lib/scoring/handicap.ts) ──────────────────

function calcStrokesOnHole(ch: number, handicapRank: number): number {
  if (ch <= 0) return 0
  if (ch >= 36) {
    return handicapRank <= (ch - 36) ? 3 : 2
  }
  if (ch >= 18) {
    return handicapRank <= (ch - 18) ? 2 : 1
  }
  return handicapRank <= ch ? 1 : 0
}

function calcNetScore(gross: number, strokes: number, par: number, netMaxOverPar: number): number {
  const raw = gross - strokes
  const cap = par + strokes + netMaxOverPar
  return Math.min(raw, cap)
}

// ─── Load live data ────────────────────────────────────────────────────────────

interface HoleRow {
  hole_number: number
  par: number
  handicap_rank: number
}

interface PtaRow {
  player_id: string
  course_handicap: number
}

interface GroupPlayerRow {
  player_id: string
  playing_handicap: number
  group_id: string
}

interface SettingRow {
  value: string
}

// ─── Build score rows ──────────────────────────────────────────────────────────

function buildScenarioAScores(
  playerIds: string[],
  holes: HoleRow[],
  ptaMap: Map<string, number>,
  phMap: Map<string, number>,
  courseId: string,
  netMaxOverPar: number
) {
  const rows: Record<string, unknown>[] = []

  for (const playerId of playerIds) {
    const ch = ptaMap.get(playerId) ?? 0
    const ph = phMap.get(playerId) ?? 0

    for (const hole of holes) {
      // Scenario A: every player shoots par+2
      const gross = hole.par + 2

      const chStrokes = calcStrokesOnHole(ch, hole.handicap_rank)
      const phStrokes = calcStrokesOnHole(ph, hole.handicap_rank)
      const netScore = calcNetScore(gross, chStrokes, hole.par, netMaxOverPar)
      const phScore  = calcNetScore(gross, phStrokes, hole.par, netMaxOverPar)

      rows.push({
        player_id:   playerId,
        course_id:   courseId,
        hole_number: hole.hole_number,
        gross_score: gross,
        net_score:   netScore,
        ph_score:    phScore,
        ch_strokes:  chStrokes,
        ph_strokes:  phStrokes,
        entered_by:  'test-scenario-a',
      })
    }
  }

  return rows
}

// ─── Tests ─────────────────────────────────────────────────────────────────────

test.describe('21 · Scenario A — Seed scores via API', () => {
  let holes: HoleRow[]
  let ptaMap: Map<string, number>
  let phMap: Map<string, number>
  let netMaxOverPar: number
  const courseId = COURSES.TerraLago
  const allPlayerIds = Object.values(PLAYERS)

  test('load live hole + handicap data', async () => {
    // Holes for Day 1
    holes = (await sbGet(
      `holes?course_id=eq.${courseId}&select=hole_number,par,handicap_rank&order=hole_number`
    )) as HoleRow[]
    expect(holes).toHaveLength(18)

    // Course handicaps from player_tee_assignments
    const ptas = (await sbGet(
      `player_tee_assignments?course_id=eq.${courseId}&select=player_id,course_handicap`
    )) as PtaRow[]
    ptaMap = new Map(ptas.map(r => [r.player_id, r.course_handicap]))
    expect(ptaMap.size).toBeGreaterThanOrEqual(11)

    // Playing handicaps from group_players (Day 1 groups)
    // group_players joined with groups filtered to day_number=1
    const gps = (await sbGet(
      `group_players?select=player_id,playing_handicap,group_id,groups!inner(day_number)&groups.day_number=eq.1`
    )) as GroupPlayerRow[]
    phMap = new Map(gps.map(r => [r.player_id, r.playing_handicap]))
    expect(phMap.size).toBe(11)

    // Net max over par setting
    const settings = (await sbGet(
      `settings?key=eq.net_max_over_par&select=value`
    )) as SettingRow[]
    netMaxOverPar = settings.length > 0 ? parseInt(settings[0].value) : 3
    expect(netMaxOverPar).toBeGreaterThanOrEqual(2)
  })

  test('seed Scenario A gross scores for all 11 players', async () => {
    const rows = buildScenarioAScores(
      allPlayerIds,
      holes,
      ptaMap,
      phMap,
      courseId,
      netMaxOverPar
    )

    // 11 players × 18 holes = 198 score rows
    expect(rows).toHaveLength(198)

    // Upsert in batches of 50 to stay within URL/body limits
    for (let i = 0; i < rows.length; i += 50) {
      const batch = rows.slice(i, i + 50)
      await sbUpsert('scores', batch)
    }

    // Verify count in DB
    const inserted = (await sbGet(
      `scores?course_id=eq.${courseId}&select=id`
    )) as { id: string }[]
    expect(inserted.length).toBe(198)
  })

  test('verify gross totals = 108 for all players', async () => {
    const scores = (await sbGet(
      `scores?course_id=eq.${courseId}&select=player_id,gross_score`
    )) as { player_id: string; gross_score: number }[]

    const grossByPlayer = new Map<string, number>()
    for (const s of scores) {
      grossByPlayer.set(s.player_id, (grossByPlayer.get(s.player_id) ?? 0) + s.gross_score)
    }

    for (const playerId of allPlayerIds) {
      const total = grossByPlayer.get(playerId) ?? 0
      expect(total, `gross total for ${playerId}`).toBe(108)
    }
  })

  test('verify net totals match TESTING-PLAN.md Scenario A Day 1', async () => {
    // Expected net totals from TESTING-PLAN.md Section 3, Scenario A, Day 1
    const expectedNet: Record<string, number> = {
      [PLAYERS.Ryan]:    94,
      [PLAYERS.Kiki]:    97,
      [PLAYERS.Mack]:    96,
      [PLAYERS.Bruce]:   92,
      [PLAYERS.Matthew]: 92,
      [PLAYERS.CPat]:    91,
      [PLAYERS.Eric]:    92,
      [PLAYERS.Ben]:     86,
      [PLAYERS.Gary]:    82,
      [PLAYERS.Chris]:   73,
      [PLAYERS.Jauch]:   66,
    }

    const scores = (await sbGet(
      `scores?course_id=eq.${courseId}&select=player_id,net_score`
    )) as { player_id: string; net_score: number }[]

    const netByPlayer = new Map<string, number>()
    for (const s of scores) {
      netByPlayer.set(s.player_id, (netByPlayer.get(s.player_id) ?? 0) + s.net_score)
    }

    for (const [playerId, expected] of Object.entries(expectedNet)) {
      const actual = netByPlayer.get(playerId) ?? 0
      expect(actual, `net total for player ${playerId}`).toBe(expected)
    }
  })

  test('verify per-hole net scores match Scenario A for Ryan (spot check)', async () => {
    // Ryan: CH=14 on Day 1. Stroke distribution from Section 2.
    // Every hole: gross = par+2. net = gross - strokes (no cap needed since par+2-strokes ≤ par+3)
    // Ryan's strokes by hole (from TESTING-PLAN.md Section 2):
    // H1:1, H2:0, H3:0, H4:1, H5:1, H6:1, H7:1, H8:1, H9:1, H10:1, H11:0, H12:0, H13:1, H14:1, H15:1, H16:1, H17:1, H18:1
    const ryanStrokes = [1,0,0,1,1,1,1,1,1,1,0,0,1,1,1,1,1,1]

    const scores = (await sbGet(
      `scores?course_id=eq.${courseId}&player_id=eq.${PLAYERS.Ryan}&select=hole_number,gross_score,net_score&order=hole_number`
    )) as { hole_number: number; gross_score: number; net_score: number }[]

    expect(scores).toHaveLength(18)

    for (const score of scores) {
      const holeIdx = score.hole_number - 1
      const strokes = ryanStrokes[holeIdx]
      const expectedNet = score.gross_score - strokes
      expect(score.net_score, `Ryan H${score.hole_number} net`).toBe(expectedNet)
    }
  })

  test('verify ph_scores are stored for all players', async () => {
    const scores = (await sbGet(
      `scores?course_id=eq.${courseId}&select=player_id,ph_score&ph_score=not.is.null`
    )) as { player_id: string; ph_score: number }[]
    // Should have 198 rows (11 × 18) with non-null ph_score
    expect(scores.length).toBe(198)
  })
})
