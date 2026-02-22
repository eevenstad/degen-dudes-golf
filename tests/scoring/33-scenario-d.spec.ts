/**
 * 33-scenario-d.spec.ts
 * Phase 8: Scenario D — Aces and Eagles
 *
 * Seeds aces (gross=1) on par 3s, eagles (gross=3) on par 5s, par on par 4s.
 * Tests that very low/negative net scores are handled correctly.
 * Net can go negative (e.g., Jauch par 3: gross=1, strokes=2 → raw net=-1)
 *
 * Expected values from TESTING-PLAN.md Section 3, Scenario D, Day 1.
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
  // Note: cap only applies to the upper bound. Negative nets are allowed (aces, eagles with strokes).
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

// ─── Expected net totals from TESTING-PLAN.md Section 3, Scenario D, Day 1 ────

const EXPECTED_NET_D_DAY1: Record<string, number> = {
  [PLAYERS.Ryan]:    42,
  [PLAYERS.Kiki]:    45,
  [PLAYERS.Mack]:    44,
  [PLAYERS.Bruce]:   40,
  [PLAYERS.Matthew]: 40,
  [PLAYERS.CPat]:    39,
  [PLAYERS.Eric]:    40,
  [PLAYERS.Ben]:     34,
  [PLAYERS.Gary]:    30,
  [PLAYERS.Chris]:   21,
  [PLAYERS.Jauch]:   14,
}

// Expected gross for all players: 56 (par 3→1, par 5→3, par 4→par)
// Terra Lago Day 1 has: 4 par 3s, 4 par 5s, 10 par 4s
// Gross = 4×1 + 4×3 + 10×par4 where par4s sum: 10 holes × 4 = 40 → 4 + 12 + 40 = 56
const EXPECTED_GROSS_D_DAY1 = 56

// ─── Tests ─────────────────────────────────────────────────────────────────────

test.describe('33 · Scenario D — Aces and Eagles', () => {
  let holes: HoleRow[]
  let ptaMap: Map<string, number>
  let phMap: Map<string, number>
  let netMaxOverPar: number
  const courseId = TERRA_LAGO_ID
  const allPlayerIds = Object.values(PLAYERS)

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
  })

  test('seed Scenario D scores (aces on par 3, eagles on par 5, par on par 4)', async () => {
    const rows: Record<string, unknown>[] = []

    for (const playerId of allPlayerIds) {
      const ch = ptaMap.get(playerId) ?? 0
      const ph = phMap.get(playerId) ?? 0

      for (const hole of holes) {
        // Scenario D: ace on par 3, eagle on par 5, par on par 4
        let gross: number
        if (hole.par === 3) gross = 1        // hole-in-one
        else if (hole.par === 5) gross = 3   // eagle (2 under)
        else gross = hole.par                // par on par 4s

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
          entered_by:  'test-scenario-d',
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

  test('verify gross totals = 56 for all players', async () => {
    const scores = await sbGet(
      `scores?course_id=eq.${courseId}&select=player_id,gross_score`
    ) as { player_id: string; gross_score: number }[]

    const grossByPlayer = new Map<string, number>()
    for (const s of scores) {
      grossByPlayer.set(s.player_id, (grossByPlayer.get(s.player_id) ?? 0) + s.gross_score)
    }

    for (const playerId of allPlayerIds) {
      expect(grossByPlayer.get(playerId) ?? 0, `gross for ${playerId}`).toBe(EXPECTED_GROSS_D_DAY1)
    }
  })

  test('verify net totals match Scenario D expected values', async () => {
    const scores = await sbGet(
      `scores?course_id=eq.${courseId}&select=player_id,net_score`
    ) as { player_id: string; net_score: number }[]

    const netByPlayer = new Map<string, number>()
    for (const s of scores) {
      netByPlayer.set(s.player_id, (netByPlayer.get(s.player_id) ?? 0) + s.net_score)
    }

    for (const [playerId, expected] of Object.entries(EXPECTED_NET_D_DAY1)) {
      expect(netByPlayer.get(playerId) ?? 0, `net for ${playerId} Scenario D`).toBe(expected)
    }
  })

  test('verify negative net scores — Jauch par 3 holes get net ≤ 0 or 1', async () => {
    // Jauch CH=42 → 2 strokes on every par 3 hole (rank 17 → 42≥36, rank≤(42-36)=6? 17>6 → 2 strokes)
    // For par 3 hole with gross=1: raw net = 1-2 = -1.
    // Cap = 3+2+3 = 8. -1 < 8 → net = -1.
    // Jauch should have negative net scores on par 3 holes.

    const par3Holes = holes.filter(h => h.par === 3)
    expect(par3Holes.length).toBe(4) // Terra Lago North has 4 par 3 holes

    for (const hole of par3Holes) {
      const scores = await sbGet(
        `scores?course_id=eq.${courseId}&player_id=eq.${PLAYERS.Jauch}&hole_number=eq.${hole.hole_number}&select=gross_score,net_score,ch_strokes`
      ) as { gross_score: number; net_score: number; ch_strokes: number }[]

      expect(scores).toHaveLength(1)
      expect(scores[0].gross_score).toBe(1)
      expect(scores[0].ch_strokes).toBe(2) // Jauch always 2 on these holes
      // raw = 1-2 = -1, cap = 3+2+3 = 8 → net = -1
      expect(scores[0].net_score).toBe(-1)
    }
  })

  test('verify ace net for Chris on par 3 (CH=35 → 2 strokes, net = -1)', async () => {
    // Chris CH=35 → all par 3 holes get 2 strokes (35≥18, rank≤(35-18)=17? yes for low-rank par 3s)
    // Check H3 (par=3, rank=17): 35≥18, rank≤17? 17≤17 → 2 strokes
    // raw net = 1-2 = -1. cap = 3+2+3 = 8. net = -1.
    const scores = await sbGet(
      `scores?course_id=eq.${courseId}&player_id=eq.${PLAYERS.Chris}&hole_number=eq.3&select=gross_score,net_score,ch_strokes`
    ) as { gross_score: number; net_score: number; ch_strokes: number }[]

    expect(scores).toHaveLength(1)
    expect(scores[0].gross_score).toBe(1)
    expect(scores[0].ch_strokes).toBe(2)
    expect(scores[0].net_score).toBe(-1)
  })

  test('verify eagle net for Ryan on par 5 (CH=14 → 1 stroke on most par 5s)', async () => {
    // Ryan H4 (par=5, rank=7): CH=14, rank≤14 → 1 stroke
    // gross = 3 (eagle), raw net = 3-1 = 2, cap = 5+1+3 = 9 → net = 2
    const scores = await sbGet(
      `scores?course_id=eq.${courseId}&player_id=eq.${PLAYERS.Ryan}&hole_number=eq.4&select=gross_score,net_score,ch_strokes`
    ) as { gross_score: number; net_score: number; ch_strokes: number }[]

    expect(scores).toHaveLength(1)
    expect(scores[0].gross_score).toBe(3)
    expect(scores[0].ch_strokes).toBe(1)
    expect(scores[0].net_score).toBe(2) // 3-1=2
  })

  test('verify par 4 scores are unaffected (par on par 4s)', async () => {
    // All par 4 holes should have gross = 4 for all players
    const par4Holes = holes.filter(h => h.par === 4)
    const scores = await sbGet(
      `scores?course_id=eq.${courseId}&select=player_id,hole_number,gross_score`
    ) as { player_id: string; hole_number: number; gross_score: number }[]

    const par4HoleNums = new Set(par4Holes.map(h => h.hole_number))
    const par4Scores = scores.filter(s => par4HoleNums.has(s.hole_number))

    for (const score of par4Scores) {
      expect(score.gross_score, `par 4 hole ${score.hole_number} for ${score.player_id}`).toBe(4)
    }
  })
})
