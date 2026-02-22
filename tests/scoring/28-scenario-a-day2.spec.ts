/**
 * 28-scenario-a-day2.spec.ts
 * Phase 4: Scenario A — Day 2 (PGA West Mountain)
 *
 * Seeds Scenario A scores for all 11 players on Day 2 via Supabase REST API.
 * Scenario A: Every player shoots par+2 on every hole.
 *
 * Expected values from TESTING-PLAN.md Section 3, Scenario A, Day 2.
 *
 * IMPORTANT: Run reset-test-data.ts + 21-seed BEFORE this file.
 * Run in numeric order: 21 → 22 → 23 → 24 → 25 → 26 → 27 → 28 → 29
 */

import { test, expect } from '@playwright/test'
import * as fs from 'fs'

// ─── Constants ────────────────────────────────────────────────────────────────

const SUPABASE_URL = 'https://lnnlabbdffowjpaxvnsp.supabase.co'
const SERVICE_KEY = fs.readFileSync(
  `${process.env.HOME}/.config/supabase/degen-dudes-service-role`,
  'utf8'
).trim()

const COURSES = {
  TerraLago:  '9333b881-441e-43f0-9aa8-efe8f9dcd203',
  PGAWest:    'fb74b2c0-b9df-4926-8867-13d83a2cdf7f',
  EagleFalls: '6a96b6d2-9271-4191-ba6c-da0232a9ca46',
}

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
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?on_conflict=player_id,course_id,hole_number`, {
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
  if (ch >= 36) return handicapRank <= (ch - 36) ? 3 : 2
  if (ch >= 18) return handicapRank <= (ch - 18) ? 2 : 1
  return handicapRank <= ch ? 1 : 0
}

function calcNetScore(gross: number, strokes: number, par: number, netMaxOverPar: number): number {
  const raw = gross - strokes
  const cap = par + strokes + netMaxOverPar
  return Math.min(raw, cap)
}

// ─── Type interfaces ───────────────────────────────────────────────────────────

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
}

interface SettingRow {
  value: string
}

// ─── Tests ─────────────────────────────────────────────────────────────────────

test.describe('28 · Scenario A — Day 2 (PGA West Mountain)', () => {
  let holes: HoleRow[]
  let ptaMap: Map<string, number>
  let phMap: Map<string, number>
  let netMaxOverPar: number
  const courseId = COURSES.PGAWest
  const allPlayerIds = Object.values(PLAYERS)

  // Expected CH values from TESTING-PLAN.md Section 1, Day 2
  const expectedCH: Record<string, number> = {
    [PLAYERS.Ryan]:    11,
    [PLAYERS.Kiki]:     6,
    [PLAYERS.Mack]:    11,
    [PLAYERS.Bruce]:   12,
    [PLAYERS.Matthew]: 14,
    [PLAYERS.CPat]:     9,
    [PLAYERS.Eric]:    14,
    [PLAYERS.Ben]:     20,
    [PLAYERS.Gary]:    20,
    [PLAYERS.Chris]:   33,
    [PLAYERS.Jauch]:   35,
  }

  // Expected net totals from TESTING-PLAN.md Section 3, Scenario A, Day 2
  const expectedNet: Record<string, number> = {
    [PLAYERS.Ryan]:    97,
    [PLAYERS.Kiki]:   102,
    [PLAYERS.Mack]:    97,
    [PLAYERS.Bruce]:   96,
    [PLAYERS.Matthew]: 94,
    [PLAYERS.CPat]:    99,
    [PLAYERS.Eric]:    94,
    [PLAYERS.Ben]:     88,
    [PLAYERS.Gary]:    88,
    [PLAYERS.Chris]:   75,
    [PLAYERS.Jauch]:   73,
  }

  test('load Day 2 hole + handicap data', async () => {
    // Holes for Day 2 (PGA West Mountain)
    holes = await sbGet(
      `holes?course_id=eq.${courseId}&select=hole_number,par,handicap_rank&order=hole_number`
    ) as HoleRow[]
    expect(holes).toHaveLength(18)

    // Course handicaps from player_tee_assignments for Day 2
    const ptas = await sbGet(
      `player_tee_assignments?course_id=eq.${courseId}&select=player_id,course_handicap`
    ) as PtaRow[]
    ptaMap = new Map(ptas.map(r => [r.player_id, r.course_handicap]))
    expect(ptaMap.size).toBeGreaterThanOrEqual(11)

    // Verify CH values match TESTING-PLAN.md Section 1, Day 2
    for (const [playerId, expected] of Object.entries(expectedCH)) {
      const actual = ptaMap.get(playerId) ?? -1
      expect(actual, `CH for player ${playerId} Day 2`).toBe(expected)
    }

    // Playing handicaps from group_players for Day 2 groups
    // Note: reset script creates Day 1 groups. Day 2 PH may need Day 2 groups.
    // Fallback: compute PH from CH if no Day 2 group_players exist.
    const gps = await sbGet(
      `group_players?select=player_id,playing_handicap,groups!inner(day_number)&groups.day_number=eq.2`
    ) as GroupPlayerRow[]

    if (gps.length >= 11) {
      phMap = new Map(gps.map(r => [r.player_id, r.playing_handicap]))
    } else {
      // No Day 2 groups: compute PH from CH (PH = CH - minCH in group)
      // For simplicity, treat all players as one group (minCH = 6, Kiki Day 2)
      // This matches what the app would do for a group with all 11 players
      // But since the reset creates Day 1 groups only, we need to use Day 1 PH
      // or derive Day 2 PH. We'll use the Day 2 CH values directly.
      // PH for match verification is handled in Phase 9; here we just need ph_score
      // stored accurately. Use CH-based strokes, PH derivation from group structure.
      const allCHValues = Array.from(ptaMap.values())
      const minCH = Math.min(...allCHValues)
      phMap = new Map(
        Array.from(ptaMap.entries()).map(([id, ch]) => [id, ch - minCH])
      )
    }

    // Net max over par setting
    const settings = await sbGet(
      `settings?key=eq.net_max_over_par&select=value`
    ) as SettingRow[]
    netMaxOverPar = settings.length > 0 ? parseInt(settings[0].value) : 3
    expect(netMaxOverPar).toBeGreaterThanOrEqual(2)
  })

  test('seed Scenario A scores for Day 2 (all 11 players)', async () => {
    const rows: Record<string, unknown>[] = []

    for (const playerId of allPlayerIds) {
      const ch = ptaMap.get(playerId) ?? 0
      const ph = phMap.get(playerId) ?? 0

      for (const hole of holes) {
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
          entered_by:  'test-scenario-a-day2',
        })
      }
    }

    expect(rows).toHaveLength(198)

    // Upsert in batches of 50
    for (let i = 0; i < rows.length; i += 50) {
      await sbUpsert('scores', rows.slice(i, i + 50))
    }

    // Verify count in DB
    const inserted = await sbGet(
      `scores?course_id=eq.${courseId}&select=id`
    ) as { id: string }[]
    expect(inserted.length).toBe(198)
  })

  test('verify gross totals = 108 for all players Day 2', async () => {
    const scores = await sbGet(
      `scores?course_id=eq.${courseId}&select=player_id,gross_score`
    ) as { player_id: string; gross_score: number }[]

    const grossByPlayer = new Map<string, number>()
    for (const s of scores) {
      grossByPlayer.set(s.player_id, (grossByPlayer.get(s.player_id) ?? 0) + s.gross_score)
    }

    for (const playerId of allPlayerIds) {
      expect(grossByPlayer.get(playerId) ?? 0, `gross for ${playerId}`).toBe(108)
    }
  })

  test('verify net totals match TESTING-PLAN.md Scenario A Day 2', async () => {
    const scores = await sbGet(
      `scores?course_id=eq.${courseId}&select=player_id,net_score`
    ) as { player_id: string; net_score: number }[]

    const netByPlayer = new Map<string, number>()
    for (const s of scores) {
      netByPlayer.set(s.player_id, (netByPlayer.get(s.player_id) ?? 0) + s.net_score)
    }

    for (const [playerId, expected] of Object.entries(expectedNet)) {
      const actual = netByPlayer.get(playerId) ?? 0
      expect(actual, `net total for ${playerId} Day 2`).toBe(expected)
    }
  })

  test('verify ch_strokes totals = CH values for all players Day 2', async () => {
    const scores = await sbGet(
      `scores?course_id=eq.${courseId}&select=player_id,ch_strokes`
    ) as { player_id: string; ch_strokes: number }[]

    const strokesByPlayer = new Map<string, number>()
    for (const s of scores) {
      strokesByPlayer.set(s.player_id, (strokesByPlayer.get(s.player_id) ?? 0) + s.ch_strokes)
    }

    for (const [playerId, expectedCHVal] of Object.entries(expectedCH)) {
      const actual = strokesByPlayer.get(playerId) ?? 0
      expect(actual, `ch_strokes total for ${playerId} Day 2`).toBe(expectedCHVal)
    }
  })

  test('verify per-hole net scores for Ryan Day 2 (spot check)', async () => {
    // Ryan: CH=11 on Day 2 (PGA West Mountain)
    // Strokes from TESTING-PLAN.md Section 2, Day 2:
    // H1:1, H2:1, H3:0, H4:0, H5:1, H6:1, H7:1, H8:0, H9:1
    // H10:1, H11:0, H12:0, H13:1, H14:1, H15:0, H16:0, H17:1, H18:1
    const ryanStrokes = [1,1,0,0,1,1,1,0,1,1,0,0,1,1,0,0,1,1]

    const scores = await sbGet(
      `scores?course_id=eq.${courseId}&player_id=eq.${PLAYERS.Ryan}&select=hole_number,gross_score,net_score,ch_strokes&order=hole_number`
    ) as { hole_number: number; gross_score: number; net_score: number; ch_strokes: number }[]

    expect(scores).toHaveLength(18)

    for (const score of scores) {
      const holeIdx = score.hole_number - 1
      const expectedStrokes = ryanStrokes[holeIdx]
      const expectedNet = score.gross_score - expectedStrokes

      expect(score.ch_strokes, `Ryan H${score.hole_number} ch_strokes`).toBe(expectedStrokes)
      expect(score.net_score, `Ryan H${score.hole_number} net`).toBe(expectedNet)
    }
  })

  test('verify per-hole net scores for Jauch Day 2 (spot check — high CH=35)', async () => {
    // Jauch: CH=35 on Day 2 (PGA West Mountain)
    // Strokes from TESTING-PLAN.md Section 2, Day 2:
    // H1:2, H2:2, H3:2, H4:2, H5:2, H6:2, H7:2, H8:2, H9:2
    // H10:2, H11:2, H12:1, H13:2, H14:2, H15:2, H16:2, H17:2, H18:2
    const jauchStrokes = [2,2,2,2,2,2,2,2,2,2,2,1,2,2,2,2,2,2]

    const scores = await sbGet(
      `scores?course_id=eq.${courseId}&player_id=eq.${PLAYERS.Jauch}&select=hole_number,gross_score,net_score,ch_strokes&order=hole_number`
    ) as { hole_number: number; gross_score: number; net_score: number; ch_strokes: number }[]

    expect(scores).toHaveLength(18)

    for (const score of scores) {
      const holeIdx = score.hole_number - 1
      const expectedStrokes = jauchStrokes[holeIdx]
      const expectedNet = score.gross_score - expectedStrokes

      expect(score.ch_strokes, `Jauch H${score.hole_number} ch_strokes Day 2`).toBe(expectedStrokes)
      expect(score.net_score, `Jauch H${score.hole_number} net Day 2`).toBe(expectedNet)
    }
  })
})
