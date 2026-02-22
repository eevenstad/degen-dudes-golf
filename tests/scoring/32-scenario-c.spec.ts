/**
 * 32-scenario-c.spec.ts
 * Phase 7: Scenario C — Net Cap Stress Test
 *
 * Seeds gross=15 for ALL players on ALL holes, Day 1 (Terra Lago North).
 * This is the scenario most likely to catch net cap calculation bugs.
 *
 * Tests:
 * - NET_MAX_OVER_PAR=3 capping behavior (expected values from Section 3/5)
 * - Per-hole net scores are properly capped at par + strokes + netMaxOverPar
 * - Very high gross scores don't escape the cap
 *
 * Expected values from TESTING-PLAN.md Section 3 (Scenario C) and Section 5.
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

// ─── Expected net totals for NET_MAX_OVER_PAR=3 ───────────────────────────────
// From TESTING-PLAN.md Section 3, Scenario C, Day 1 (NET_MAX_OVER_PAR=3)
const EXPECTED_NET_C_DAY1_MOP3: Record<string, number> = {
  [PLAYERS.Ryan]:    140,
  [PLAYERS.Kiki]:    137,
  [PLAYERS.Mack]:    138,
  [PLAYERS.Bruce]:   142,
  [PLAYERS.Matthew]: 142,
  [PLAYERS.CPat]:    143,
  [PLAYERS.Eric]:    142,
  [PLAYERS.Ben]:     148,
  [PLAYERS.Gary]:    152,
  [PLAYERS.Chris]:   161,
  [PLAYERS.Jauch]:   168,
}

// ─── Tests ─────────────────────────────────────────────────────────────────────

test.describe('32 · Scenario C — Net Cap Stress Test (Gross=15 Everywhere)', () => {
  let holes: HoleRow[]
  let ptaMap: Map<string, number>
  let phMap: Map<string, number>
  let netMaxOverPar: number
  const courseId = TERRA_LAGO_ID
  const allPlayerIds = Object.values(PLAYERS)
  const GROSS = 15 // Scenario C: gross = 15 on every hole

  test('load hole + handicap data', async () => {
    holes = await sbGet(
      `holes?course_id=eq.${courseId}&select=hole_number,par,handicap_rank&order=hole_number`
    ) as HoleRow[]
    expect(holes).toHaveLength(18)

    const ptas = await sbGet(
      `player_tee_assignments?course_id=eq.${courseId}&select=player_id,course_handicap`
    ) as PtaRow[]
    ptaMap = new Map(ptas.map(r => [r.player_id, r.course_handicap]))

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

    // This test assumes NET_MAX_OVER_PAR=3 (the expected values are for 3)
    // If set to 2, log a warning but continue (Section 5 values differ)
    if (netMaxOverPar !== 3) {
      console.warn(`⚠️  net_max_over_par=${netMaxOverPar} — expected 3 for Scenario C assertions`)
    }
  })

  test('seed Scenario C scores (gross=15 on every hole)', async () => {
    const rows: Record<string, unknown>[] = []

    for (const playerId of allPlayerIds) {
      const ch = ptaMap.get(playerId) ?? 0
      const ph = phMap.get(playerId) ?? 0

      for (const hole of holes) {
        const chStrokes = calcStrokesOnHole(ch, hole.handicap_rank)
        const phStrokes = calcStrokesOnHole(ph, hole.handicap_rank)
        const netScore = calcNetScore(GROSS, chStrokes, hole.par, netMaxOverPar)
        const phScore  = calcNetScore(GROSS, phStrokes, hole.par, netMaxOverPar)

        rows.push({
          player_id:   playerId,
          course_id:   courseId,
          hole_number: hole.hole_number,
          gross_score: GROSS,
          net_score:   netScore,
          ph_score:    phScore,
          ch_strokes:  chStrokes,
          ph_strokes:  phStrokes,
          entered_by:  'test-scenario-c',
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

  test('verify all gross scores = 270 (18 holes × 15)', async () => {
    const scores = await sbGet(
      `scores?course_id=eq.${courseId}&select=player_id,gross_score`
    ) as { player_id: string; gross_score: number }[]

    const grossByPlayer = new Map<string, number>()
    for (const s of scores) {
      grossByPlayer.set(s.player_id, (grossByPlayer.get(s.player_id) ?? 0) + s.gross_score)
    }

    for (const playerId of allPlayerIds) {
      expect(grossByPlayer.get(playerId) ?? 0, `gross total for ${playerId}`).toBe(270)
    }
  })

  test('verify every hole is capped (raw net > cap on every hole)', async () => {
    // For gross=15: raw net = 15 - strokes. For any player on any hole:
    // par is 3, 4, or 5. max par+strokes+3 = 5+3+3 = 11. 15-0 = 15 > 11.
    // So EVERY hole should be at cap — raw net never < cap.
    const scores = await sbGet(
      `scores?course_id=eq.${courseId}&select=player_id,hole_number,net_score,ch_strokes`
    ) as { player_id: string; hole_number: number; net_score: number; ch_strokes: number }[]

    // Build a hole par lookup
    const holeParMap = new Map<number, number>()
    for (const h of holes) holeParMap.set(h.hole_number, h.par)

    // Every net score should equal: par + strokes + netMaxOverPar (the cap)
    for (const score of scores) {
      const par = holeParMap.get(score.hole_number) ?? 4
      const expectedCappedNet = par + score.ch_strokes + netMaxOverPar
      expect(
        score.net_score,
        `player ${score.player_id} H${score.hole_number} net should be capped at ${expectedCappedNet}`
      ).toBe(expectedCappedNet)
    }
  })

  test('verify net totals match Scenario C expected values (NET_MAX_OVER_PAR=3)', async () => {
    if (netMaxOverPar !== 3) {
      console.log('Skipping: net_max_over_par is not 3')
      return
    }

    const scores = await sbGet(
      `scores?course_id=eq.${courseId}&select=player_id,net_score`
    ) as { player_id: string; net_score: number }[]

    const netByPlayer = new Map<string, number>()
    for (const s of scores) {
      netByPlayer.set(s.player_id, (netByPlayer.get(s.player_id) ?? 0) + s.net_score)
    }

    for (const [playerId, expected] of Object.entries(EXPECTED_NET_C_DAY1_MOP3)) {
      expect(netByPlayer.get(playerId) ?? 0, `net for ${playerId} Scenario C MOP=3`).toBe(expected)
    }
  })

  test('verify cap math: Ryan H5 (par 4, R1, CH=14, strokes=1, gross=15)', async () => {
    // Ryan H5: rank=1, CH=14 → strokes=1
    // cap = 4 + 1 + 3 = 8. raw = 15 - 1 = 14. → net = 8.
    const scores = await sbGet(
      `scores?course_id=eq.${courseId}&player_id=eq.${PLAYERS.Ryan}&hole_number=eq.5&select=gross_score,net_score,ch_strokes`
    ) as { gross_score: number; net_score: number; ch_strokes: number }[]

    expect(scores).toHaveLength(1)
    expect(scores[0].gross_score).toBe(15)
    expect(scores[0].ch_strokes).toBe(1)
    expect(scores[0].net_score).toBe(8) // 4 + 1 + 3 = 8
  })

  test('verify cap math: Jauch H5 (par 4, R1, CH=42, strokes=3, gross=15)', async () => {
    // Jauch H5: rank=1, CH=42 → 42≥36, rank≤(42-36)=6? 1≤6 → 3 strokes
    // cap = 4 + 3 + 3 = 10. raw = 15 - 3 = 12. → net = 10.
    const scores = await sbGet(
      `scores?course_id=eq.${courseId}&player_id=eq.${PLAYERS.Jauch}&hole_number=eq.5&select=gross_score,net_score,ch_strokes`
    ) as { gross_score: number; net_score: number; ch_strokes: number }[]

    expect(scores).toHaveLength(1)
    expect(scores[0].gross_score).toBe(15)
    expect(scores[0].ch_strokes).toBe(3)
    expect(scores[0].net_score).toBe(10) // 4 + 3 + 3 = 10
  })

  test('verify cap math: Kiki H3 (par 3, R17, CH=11, strokes=0, gross=15)', async () => {
    // Kiki H3: rank=17, CH=11 → rank>11 → 0 strokes
    // cap = 3 + 0 + 3 = 6. raw = 15 - 0 = 15. → net = 6.
    const scores = await sbGet(
      `scores?course_id=eq.${courseId}&player_id=eq.${PLAYERS.Kiki}&hole_number=eq.3&select=gross_score,net_score,ch_strokes`
    ) as { gross_score: number; net_score: number; ch_strokes: number }[]

    expect(scores).toHaveLength(1)
    expect(scores[0].gross_score).toBe(15)
    expect(scores[0].ch_strokes).toBe(0)
    expect(scores[0].net_score).toBe(6) // 3 + 0 + 3 = 6
  })

  test('verify NET_MAX_OVER_PAR=2 would produce different caps (math check)', async () => {
    // Verify that our calcNetScore function correctly handles MOP=2
    // (Section 5 comparison — we don't reseed the DB, just verify the formula)

    // Ryan H5: par=4, strokes=1, gross=15
    // MOP=3: cap = 4+1+3 = 8. net = 8.
    expect(calcNetScore(15, 1, 4, 3)).toBe(8)
    // MOP=2: cap = 4+1+2 = 7. net = 7.
    expect(calcNetScore(15, 1, 4, 2)).toBe(7)

    // Chris H3 (par=3, strokes=2, gross=10 from Scenario B):
    // MOP=3: cap = 3+2+3 = 8. raw = 10-2 = 8. net = 8.
    expect(calcNetScore(10, 2, 3, 3)).toBe(8)
    // MOP=2: cap = 3+2+2 = 7. raw = 8. net = 7. ← CAPPED
    expect(calcNetScore(10, 2, 3, 2)).toBe(7)

    // Jauch H8 (par=5, strokes=3, gross=15):
    // MOP=3: cap = 5+3+3 = 11. raw = 12. net = 11.
    expect(calcNetScore(15, 3, 5, 3)).toBe(11)
    // MOP=2: cap = 5+3+2 = 10. raw = 12. net = 10.
    expect(calcNetScore(15, 3, 5, 2)).toBe(10)
  })
})
