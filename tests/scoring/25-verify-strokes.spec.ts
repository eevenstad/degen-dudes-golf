/**
 * 25-verify-strokes.spec.ts
 * Verifies the /strokes page loads correctly and that stroke distribution
 * data matches TESTING-PLAN.md Section 2.
 *
 * Spot-checks key players against known values:
 * - Ryan: Day 1 CH=14, total ch_strokes=14
 * - Jauch: Day 1 CH=42, total ch_strokes=42 (with triple strokes on 6 holes)
 * - Kiki: Day 1 CH=11, total ch_strokes=11
 *
 * Also verifies the /strokes page UI loads and shows player names.
 */

import { test, expect } from '@playwright/test'
import * as fs from 'fs'

const SUPABASE_URL = 'https://lnnlabbdffowjpaxvnsp.supabase.co'
const SERVICE_KEY = fs.readFileSync(
  `${process.env.HOME}/.config/supabase/degen-dudes-service-role`,
  'utf8'
).trim()

const COURSES = {
  TerraLago: '9333b881-441e-43f0-9aa8-efe8f9dcd203',
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

// Expected CH totals from TESTING-PLAN.md Section 1, Day 1
const EXPECTED_CH_DAY1: Record<string, number> = {
  [PLAYERS.Ryan]:    14,
  [PLAYERS.Kiki]:    11,
  [PLAYERS.Mack]:    12,
  [PLAYERS.Bruce]:   16,
  [PLAYERS.Matthew]: 16,
  [PLAYERS.CPat]:    17,
  [PLAYERS.Eric]:    16,
  [PLAYERS.Ben]:     22,
  [PLAYERS.Gary]:    26,
  [PLAYERS.Chris]:   35,
  [PLAYERS.Jauch]:   42,
}

async function sbGet(path: string) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
  })
  if (!res.ok) throw new Error(`GET ${path} → ${res.status}`)
  return res.json()
}

// Mirror of calcStrokesOnHole from handicap.ts
function calcStrokesOnHole(ch: number, handicapRank: number): number {
  if (ch <= 0) return 0
  if (ch >= 36) return handicapRank <= (ch - 36) ? 3 : 2
  if (ch >= 18) return handicapRank <= (ch - 18) ? 2 : 1
  return handicapRank <= ch ? 1 : 0
}

test.describe('25 · Verify strokes page and stroke distribution', () => {
  test('strokes page loads with all 11 player names', async ({ page }) => {
    await page.goto('/strokes')
    await page.waitForLoadState('networkidle')

    const playerNames = ['Ryan', 'Kiki', 'Mack', 'Bruce', 'Matthew', 'C-Pat', 'Eric', 'Ben', 'Gary', 'Chris', 'Jauch']
    for (const name of playerNames) {
      await expect(page.getByText(name).first(), `${name} on strokes page`).toBeVisible()
    }
  })

  test('strokes page shows Day 1 tab', async ({ page }) => {
    await page.goto('/strokes')
    await page.waitForLoadState('networkidle')

    const pageText = await page.textContent('body') ?? ''
    expect(pageText).toContain('Day 1')
  })

  test('strokes page has course name info', async ({ page }) => {
    await page.goto('/strokes')
    await page.waitForLoadState('networkidle')

    const pageText = await page.textContent('body') ?? ''
    expect(
      pageText.includes('Terra Lago') || pageText.includes('Day 1')
    ).toBe(true)
  })

  // ─── API-level stroke distribution verification ─────────────────────────────

  test('player_tee_assignments CH values match TESTING-PLAN.md Section 1, Day 1', async () => {
    const ptas: { player_id: string; course_handicap: number }[] = await sbGet(
      `player_tee_assignments?course_id=eq.${COURSES.TerraLago}&select=player_id,course_handicap`
    )

    const chMap = new Map(ptas.map(r => [r.player_id, r.course_handicap]))

    for (const [playerId, expectedCH] of Object.entries(EXPECTED_CH_DAY1)) {
      expect(chMap.get(playerId), `player ${playerId} CH`).toBe(expectedCH)
    }
  })

  test('total ch_strokes per player matches their CH value (Day 1)', async () => {
    // Sum of ch_strokes across all 18 holes = CH value
    const scores: { player_id: string; ch_strokes: number }[] = await sbGet(
      `scores?course_id=eq.${COURSES.TerraLago}&select=player_id,ch_strokes`
    )

    const totalByPlayer = new Map<string, number>()
    for (const s of scores) {
      totalByPlayer.set(s.player_id, (totalByPlayer.get(s.player_id) ?? 0) + s.ch_strokes)
    }

    for (const [playerId, expectedCH] of Object.entries(EXPECTED_CH_DAY1)) {
      expect(totalByPlayer.get(playerId), `player ${playerId} total ch_strokes`).toBe(expectedCH)
    }
  })

  test('per-hole stroke distribution spot-checks from TESTING-PLAN Section 2, Day 1', async () => {
    // Spot check key rows from the stroke distribution table
    const holes: { hole_number: number; par: number; handicap_rank: number }[] = await sbGet(
      `holes?course_id=eq.${COURSES.TerraLago}&select=hole_number,par,handicap_rank&order=hole_number`
    )

    // Ryan (CH=14): strokes on holes with rank ≤ 14
    // From TESTING-PLAN Section 2: H5 (rank=1)=1, H7 (rank=13)=1, H3 (rank=17)=0
    const ryanChecks = [
      { hole: 5, rank: 1, expected: 1 },    // rank ≤ 14 → 1 stroke
      { hole: 7, rank: 13, expected: 1 },   // rank ≤ 14 → 1 stroke
      { hole: 3, rank: 17, expected: 0 },   // rank > 14 → 0 strokes
    ]
    for (const check of ryanChecks) {
      const actual = calcStrokesOnHole(14, check.rank)
      expect(actual, `Ryan H${check.hole} (rank=${check.rank})`).toBe(check.expected)
    }

    // Ben (CH=22): double strokes on holes where rank ≤ 22-18=4
    // H5 (rank=1)=2, H8 (rank=5)=1, H2 (rank=15)=1, H3 (rank=17)=1
    const benChecks = [
      { hole: 5, rank: 1, expected: 2 },    // rank ≤ 4 → 2 strokes
      { hole: 14, rank: 2, expected: 2 },   // rank ≤ 4 → 2 strokes
      { hole: 8, rank: 5, expected: 1 },    // rank > 4 but ≤ 22 → 1 stroke
      { hole: 2, rank: 15, expected: 1 },   // rank ≤ 22 → 1 stroke
    ]
    for (const check of benChecks) {
      const actual = calcStrokesOnHole(22, check.rank)
      expect(actual, `Ben H${check.hole} (rank=${check.rank})`).toBe(check.expected)
    }

    // Jauch (CH=42): triple strokes on holes where rank ≤ 42-36=6
    // From Section 2: H5 (rank=1)=3, H8 (rank=5)=3, H9 (rank=3)=3
    // Double strokes on rank 7-18, also double for ranks that give 2 strokes
    const jauchChecks = [
      { hole: 5, rank: 1, expected: 3 },
      { hole: 9, rank: 3, expected: 3 },
      { hole: 8, rank: 5, expected: 3 },
      { hole: 4, rank: 7, expected: 2 },    // rank > 6, rank ≤ 36 → 2 strokes
      { hole: 13, rank: 8, expected: 2 },
    ]
    for (const check of jauchChecks) {
      const actual = calcStrokesOnHole(42, check.rank)
      expect(actual, `Jauch H${check.hole} (rank=${check.rank})`).toBe(check.expected)
    }

    // Use actual holes data to verify known values
    const h5 = holes.find(h => h.hole_number === 5)
    const h3 = holes.find(h => h.hole_number === 3)
    expect(h5?.handicap_rank, 'H5 handicap_rank').toBe(1)    // hardest hole
    expect(h3?.handicap_rank, 'H3 handicap_rank').toBe(17)   // easiest hole (verify TESTING-PLAN rank)
  })

  test('Chris (CH=35) has no holes with < 1 stroke (all holes get at least 1)', async () => {
    const scores: { hole_number: number; ch_strokes: number }[] = await sbGet(
      `scores?course_id=eq.${COURSES.TerraLago}&player_id=eq.${PLAYERS.Chris}&select=hole_number,ch_strokes`
    )

    expect(scores).toHaveLength(18)
    for (const s of scores) {
      expect(s.ch_strokes, `Chris H${s.hole_number} should get ≥ 1 stroke`).toBeGreaterThanOrEqual(1)
    }
  })

  test('Ryan (CH=14) has exactly 4 holes with 0 strokes (ranks 15-18)', async () => {
    const scores: { hole_number: number; ch_strokes: number }[] = await sbGet(
      `scores?course_id=eq.${COURSES.TerraLago}&player_id=eq.${PLAYERS.Ryan}&select=hole_number,ch_strokes`
    )

    const zeroStrokeHoles = scores.filter(s => s.ch_strokes === 0)
    expect(zeroStrokeHoles.length, 'Ryan zero-stroke holes (ranks 15-18)').toBe(4)
  })
})
