/**
 * 31-scenario-b.spec.ts
 * Phase 6: Scenario B — Mixed Realistic Scores
 *
 * Seeds Scenario B scores for Day 1 (Terra Lago North) and verifies.
 * Different score patterns by handicap tier:
 *   Low HC (≤12): par on easy holes, bogey on hard holes, birdie on hole 5
 *   Mid HC (13-17): bogey everywhere, birdie on hole 13, double on hole 1
 *   High HC (18-23): double bogey everywhere (par+2)
 *   Very high HC (24+): triple bogey, except par 3s score 10
 *
 * Tests different code paths than Scenario A (strokes matter more with varied scores).
 * Expected values from TESTING-PLAN.md Section 3, Scenario B, Day 1.
 *
 * IMPORTANT: This test is INDEPENDENT — run reset + 21-seed before this.
 * This file does NOT depend on 28/29 — it re-uses the Day 1 course data.
 * It OVERWRITES Day 1 scores (upsert), so run after leaderboard tests (30).
 */

import { test, expect } from '@playwright/test'
import * as fs from 'fs'

// ─── Constants ────────────────────────────────────────────────────────────────

const SUPABASE_URL = 'https://lnnlabbdffowjpaxvnsp.supabase.co'
const SERVICE_KEY = fs.readFileSync(
  `${process.env.HOME}/.config/supabase/degen-dudes-service-role`,
  'utf8'
).trim()

const TERRA_LAGO_ID = '9333b881-441e-43f0-9aa8-efe8f9dcd203'

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
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
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

// ─── Scoring helpers ───────────────────────────────────────────────────────────

function calcStrokesOnHole(ch: number, handicapRank: number): number {
  if (ch <= 0) return 0
  if (ch >= 36) return handicapRank <= (ch - 36) ? 3 : 2
  if (ch >= 18) return handicapRank <= (ch - 18) ? 2 : 1
  return handicapRank <= ch ? 1 : 0
}

function calcNetScore(gross: number, strokes: number, par: number, netMaxOverPar: number): number {
  return Math.min(gross - strokes, par + strokes + netMaxOverPar)
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

// ─── Scenario B gross scores by player for Day 1 ──────────────────────────────
// From TESTING-PLAN.md Section 3, Scenario B, Day 1
// H1..H18 gross scores indexed by hole number

const SCENARIO_B_DAY1_GROSS: Record<string, number[]> = {
  // Ryan (CH=14, Low HC tier): par on easy, bogey on hard, birdie H5
  [PLAYERS.Ryan]:    [6,5,4,6,5,5,4,6,5,5,5,4,4,5,5,4,6,5],
  // Kiki (CH=11, Low HC tier)
  [PLAYERS.Kiki]:    [5,4,3,6,3,4,3,6,5,4,4,3,6,5,4,3,6,5],
  // Mack (CH=12, Low HC tier)
  [PLAYERS.Mack]:    [5,4,3,6,3,4,3,6,5,4,4,3,6,5,4,3,6,5],
  // Bruce (CH=16, Mid HC tier)
  [PLAYERS.Bruce]:   [6,5,4,6,5,5,4,6,5,5,5,4,4,5,5,4,6,5],
  // Matthew (CH=16, Mid HC tier)
  [PLAYERS.Matthew]: [6,5,4,6,5,5,4,6,5,5,5,4,4,5,5,4,6,5],
  // C-Pat (CH=17, Mid HC tier)
  [PLAYERS.CPat]:    [6,5,4,6,5,5,4,6,5,5,5,4,4,5,5,4,6,5],
  // Eric (CH=16, Mid HC tier)
  [PLAYERS.Eric]:    [6,5,4,6,5,5,4,6,5,5,5,4,4,5,5,4,6,5],
  // Ben (CH=22, High HC): double bogey everywhere = par+2
  [PLAYERS.Ben]:     [6,6,5,7,6,6,5,7,6,6,6,5,7,6,6,5,7,6],
  // Gary (CH=26, Very High HC): triple bogey, par 3s = 10
  [PLAYERS.Gary]:    [7,7,10,8,7,7,6,8,7,7,7,10,8,7,7,6,8,7],
  // Chris (CH=35, Very High HC): triple bogey, par 3s = 10
  [PLAYERS.Chris]:   [7,7,10,8,7,7,6,8,7,7,7,10,8,7,7,6,8,7],
  // Jauch (CH=42, Very High HC): triple bogey, par 3s = 10
  [PLAYERS.Jauch]:   [7,7,10,8,7,7,6,8,7,7,7,10,8,7,7,6,8,7],
}

// Expected net totals from TESTING-PLAN.md Section 3, Scenario B, Day 1
const EXPECTED_NET_B_DAY1: Record<string, number> = {
  [PLAYERS.Ryan]:    75,
  [PLAYERS.Kiki]:    68,
  [PLAYERS.Mack]:    67,
  [PLAYERS.Bruce]:   73,
  [PLAYERS.Matthew]: 73,
  [PLAYERS.CPat]:    72,
  [PLAYERS.Eric]:    73,
  [PLAYERS.Ben]:     86,
  [PLAYERS.Gary]:   104,
  [PLAYERS.Chris]:   97,
  [PLAYERS.Jauch]:   92,
}

// Expected gross totals from TESTING-PLAN.md Section 3, Scenario B, Day 1
const EXPECTED_GROSS_B_DAY1: Record<string, number> = {
  [PLAYERS.Ryan]:    89,
  [PLAYERS.Kiki]:    79,
  [PLAYERS.Mack]:    79,
  [PLAYERS.Bruce]:   89,
  [PLAYERS.Matthew]: 89,
  [PLAYERS.CPat]:    89,
  [PLAYERS.Eric]:    89,
  [PLAYERS.Ben]:    108,
  [PLAYERS.Gary]:   134,
  [PLAYERS.Chris]:  134,
  [PLAYERS.Jauch]:  134,
}

// ─── Tests ─────────────────────────────────────────────────────────────────────

test.describe('31 · Scenario B — Mixed Realistic Scores (Day 1)', () => {
  let holes: HoleRow[]
  let ptaMap: Map<string, number>
  let phMap: Map<string, number>
  let netMaxOverPar: number
  const courseId = TERRA_LAGO_ID

  test('load hole + handicap data for Day 1', async () => {
    holes = await sbGet(
      `holes?course_id=eq.${courseId}&select=hole_number,par,handicap_rank&order=hole_number`
    ) as HoleRow[]
    expect(holes).toHaveLength(18)

    const ptas = await sbGet(
      `player_tee_assignments?course_id=eq.${courseId}&select=player_id,course_handicap`
    ) as PtaRow[]
    ptaMap = new Map(ptas.map(r => [r.player_id, r.course_handicap]))
    expect(ptaMap.size).toBeGreaterThanOrEqual(11)

    const gps = await sbGet(
      `group_players?select=player_id,playing_handicap,groups!inner(day_number)&groups.day_number=eq.1`
    ) as GroupPlayerRow[]
    if (gps.length >= 11) {
      phMap = new Map(gps.map(r => [r.player_id, r.playing_handicap]))
    } else {
      const minCH = Math.min(...Array.from(ptaMap.values()))
      phMap = new Map(Array.from(ptaMap.entries()).map(([id, ch]) => [id, ch - minCH]))
    }

    const settings = await sbGet(
      `settings?key=eq.net_max_over_par&select=value`
    ) as SettingRow[]
    netMaxOverPar = settings.length > 0 ? parseInt(settings[0].value) : 3
  })

  test('seed Scenario B scores for Day 1 (all 11 players)', async () => {
    const rows: Record<string, unknown>[] = []

    for (const [playerId, grossScores] of Object.entries(SCENARIO_B_DAY1_GROSS)) {
      const ch = ptaMap.get(playerId) ?? 0
      const ph = phMap.get(playerId) ?? 0

      for (const hole of holes) {
        const gross = grossScores[hole.hole_number - 1]
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
          entered_by:  'test-scenario-b',
        })
      }
    }

    expect(rows).toHaveLength(198)

    for (let i = 0; i < rows.length; i += 50) {
      await sbUpsert('scores', rows.slice(i, i + 50))
    }

    const inserted = await sbGet(
      `scores?course_id=eq.${courseId}&select=id`
    ) as { id: string }[]
    expect(inserted.length).toBe(198)
  })

  test('verify gross totals match Scenario B Day 1 expected values', async () => {
    const scores = await sbGet(
      `scores?course_id=eq.${courseId}&select=player_id,gross_score`
    ) as { player_id: string; gross_score: number }[]

    const grossByPlayer = new Map<string, number>()
    for (const s of scores) {
      grossByPlayer.set(s.player_id, (grossByPlayer.get(s.player_id) ?? 0) + s.gross_score)
    }

    for (const [playerId, expected] of Object.entries(EXPECTED_GROSS_B_DAY1)) {
      expect(grossByPlayer.get(playerId) ?? 0, `gross for ${playerId} Scenario B`).toBe(expected)
    }
  })

  test('verify net totals match Scenario B Day 1 expected values', async () => {
    const scores = await sbGet(
      `scores?course_id=eq.${courseId}&select=player_id,net_score`
    ) as { player_id: string; net_score: number }[]

    const netByPlayer = new Map<string, number>()
    for (const s of scores) {
      netByPlayer.set(s.player_id, (netByPlayer.get(s.player_id) ?? 0) + s.net_score)
    }

    for (const [playerId, expected] of Object.entries(EXPECTED_NET_B_DAY1)) {
      expect(netByPlayer.get(playerId) ?? 0, `net for ${playerId} Scenario B Day 1`).toBe(expected)
    }
  })

  test('verify net cap applies for Gary H3 (par 3, gross=10, CH=26, strokes=1)', async () => {
    // Gary H3: par=3, gross=10, ch_strokes=1
    // raw net = 10-1 = 9, cap = 3+1+3 = 7 → final net = 7 (capped)
    const scores = await sbGet(
      `scores?course_id=eq.${courseId}&player_id=eq.${PLAYERS.Gary}&hole_number=eq.3&select=gross_score,net_score,ch_strokes`
    ) as { gross_score: number; net_score: number; ch_strokes: number }[]

    expect(scores).toHaveLength(1)
    expect(scores[0].gross_score).toBe(10)
    // Gary H3: rank=17 (P3/R17 from hole header), CH=26, 26≥18 so rank≤(26-18)=8? 17>8 → 1 stroke
    expect(scores[0].ch_strokes).toBe(1)
    // net cap: par(3)+strokes(1)+netMaxOverPar(3) = 7. raw=9. capped to 7.
    expect(scores[0].net_score).toBe(7)
  })

  test('verify net cap applies for Jauch H3 (par 3, gross=10, CH=42, strokes=2)', async () => {
    // Jauch H3: par=3, gross=10, ch_strokes=2
    // raw net = 10-2 = 8, cap = 3+2+3 = 8 → final net = 8 (exactly at cap)
    const scores = await sbGet(
      `scores?course_id=eq.${courseId}&player_id=eq.${PLAYERS.Jauch}&hole_number=eq.3&select=gross_score,net_score,ch_strokes`
    ) as { gross_score: number; net_score: number; ch_strokes: number }[]

    expect(scores).toHaveLength(1)
    expect(scores[0].gross_score).toBe(10)
    // Jauch H3: rank=17 (P3/R17), CH=42, 42≥36 so rank≤(42-36)=6? 17>6 → 2 strokes
    expect(scores[0].ch_strokes).toBe(2)
    // raw=8, cap=8 → net=8
    expect(scores[0].net_score).toBe(8)
  })
})
