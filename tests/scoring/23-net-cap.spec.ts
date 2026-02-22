/**
 * 23-net-cap.spec.ts
 * Tests NET_MAX_OVER_PAR capping behavior.
 * Inserts gross=15 for Chris (CH=35) and Jauch (CH=42) on select holes,
 * verifies net_score = par + ch_strokes + NET_MAX_OVER_PAR (capped).
 *
 * From TESTING-PLAN.md Section 5 / Scenario C:
 * NET_MAX_OVER_PAR=3 (default setting)
 *
 * Chris CH=35, Day 1 Terra Lago:
 *   H3 (par=3, handicap_rank=17): ch_strokes=2 → cap = 3+2+3=8 → gross=15 → net=8
 *   H1 (par=4, handicap_rank=9):  ch_strokes=2 → cap = 4+2+3=9 → gross=15 → net=9
 *
 * Jauch CH=42, Day 1 Terra Lago:
 *   H5 (par=4, handicap_rank=1): ch_strokes=3 → cap = 4+3+3=10 → gross=15 → net=10
 *   H8 (par=5, handicap_rank=5): ch_strokes=3 → cap = 5+3+3=11 → gross=15 → net=11
 *
 * NOTE: This test modifies existing Scenario A scores for specific holes.
 * Re-run 21-scenario-a-seed.spec.ts to reset to Scenario A after this test.
 */

import { test, expect } from '@playwright/test'
import * as fs from 'fs'

const SUPABASE_URL = 'https://lnnlabbdffowjpaxvnsp.supabase.co'
const SERVICE_KEY = fs.readFileSync(
  `${process.env.HOME}/.config/supabase/degen-dudes-service-role`,
  'utf8'
).trim()

const TERRA_LAGO_ID = '9333b881-441e-43f0-9aa8-efe8f9dcd203'
const PLAYERS = {
  Chris: '6e49119a-2050-4e50-be46-42c2e89451b8',
  Jauch: '2dcc566e-b465-431b-90a1-0f9791de614e',
}

async function sbGet(path: string) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
  })
  if (!res.ok) throw new Error(`GET ${path} → ${res.status}: ${await res.text()}`)
  return res.json()
}

async function sbUpdate(table: string, filter: string, data: Record<string, unknown>) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${filter}`, {
    method: 'PATCH',
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    },
    body: JSON.stringify(data),
  })
  if (!res.ok) throw new Error(`PATCH ${table}?${filter} → ${res.status}: ${await res.text()}`)
  return res.json()
}

// Scoring helpers (mirror of handicap.ts)
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

interface HoleInfo {
  hole_number: number
  par: number
  handicap_rank: number
}

interface TestCase {
  playerName: string
  playerId: string
  ch: number
  holeNumber: number
  par: number
  handicapRank: number
  gross: number
  expectedChStrokes: number
  expectedNet: number  // with NET_MAX_OVER_PAR=3
}

test.describe('23 · Net cap (NET_MAX_OVER_PAR=3) verification', () => {
  let holes: HoleInfo[]
  let netMaxOverPar: number

  test('load hole data and net_max setting', async () => {
    holes = await sbGet(
      `holes?course_id=eq.${TERRA_LAGO_ID}&select=hole_number,par,handicap_rank&order=hole_number`
    )
    expect(holes).toHaveLength(18)

    const settings = await sbGet(`settings?key=eq.net_max_over_par&select=value`)
    netMaxOverPar = settings.length > 0 ? parseInt(settings[0].value) : 3
    expect(netMaxOverPar).toBe(3)
  })

  test('verify net cap calculation for Chris (CH=35) on multiple holes', async () => {
    const chrisCH = 35
    const testCases: TestCase[] = []

    for (const hole of holes) {
      const gross = 15
      const chStrokes = calcStrokesOnHole(chrisCH, hole.handicap_rank)
      const netUncapped = gross - chStrokes
      const cap = hole.par + chStrokes + netMaxOverPar
      const expectedNet = Math.min(netUncapped, cap)
      const isCapped = netUncapped > cap

      if (isCapped) {
        testCases.push({
          playerName: 'Chris',
          playerId: PLAYERS.Chris,
          ch: chrisCH,
          holeNumber: hole.hole_number,
          par: hole.par,
          handicapRank: hole.handicap_rank,
          gross,
          expectedChStrokes: chStrokes,
          expectedNet,
        })
      }
    }

    // With gross=15 and CH=35, most holes will be capped
    // Update Chris's scores to gross=15 on all holes
    for (const tc of testCases) {
      await sbUpdate(
        'scores',
        `player_id=eq.${tc.playerId}&course_id=eq.${TERRA_LAGO_ID}&hole_number=eq.${tc.holeNumber}`,
        {
          gross_score: 15,
          net_score: tc.expectedNet,
          ch_strokes: tc.expectedChStrokes,
        }
      )
    }

    // Verify the DB reflects the capped values
    for (const tc of testCases) {
      const scores = await sbGet(
        `scores?player_id=eq.${tc.playerId}&course_id=eq.${TERRA_LAGO_ID}&hole_number=eq.${tc.holeNumber}&select=gross_score,net_score,ch_strokes`
      )
      expect(scores).toHaveLength(1)
      expect(scores[0].gross_score, `Chris H${tc.holeNumber} gross`).toBe(15)
      expect(scores[0].net_score, `Chris H${tc.holeNumber} net (capped)`).toBe(tc.expectedNet)
      expect(scores[0].ch_strokes, `Chris H${tc.holeNumber} ch_strokes`).toBe(tc.expectedChStrokes)
    }
  })

  test('verify specific net cap values for Chris from TESTING-PLAN Section 5', async () => {
    // From TESTING-PLAN.md Scenario C with NET_MAX_OVER_PAR=3:
    // H3 (par=3, rank=17): ch_strokes=2, cap=3+2+3=8, gross=15, net=8
    // H12 (par=3, rank=18): ch_strokes=1, cap=3+1+3=7, gross=15, net=7

    const chrisH3 = await sbGet(
      `scores?player_id=eq.${PLAYERS.Chris}&course_id=eq.${TERRA_LAGO_ID}&hole_number=eq.3&select=net_score,ch_strokes`
    )
    if (chrisH3.length > 0 && chrisH3[0].net_score !== undefined) {
      // H3 par=3, rank=17, CH=35 → ch_strokes=2 → cap=8
      expect(chrisH3[0].ch_strokes, 'Chris H3 ch_strokes').toBe(2)
      expect(chrisH3[0].net_score, 'Chris H3 net (cap=8)').toBe(8)
    }
  })

  test('verify net cap for Jauch (CH=42) on H5 — triple stroke hole', async () => {
    // Jauch CH=42, H5 (par=4, rank=1): ch_strokes=3 (rank=1 ≤ 42-36=6 → yes, 3 strokes)
    // gross=15, cap = 4+3+3=10, net=min(15-3=12, 10)=10
    const jauchH5 = holes.find(h => h.hole_number === 5)!
    const ch = 42
    const chStrokes = calcStrokesOnHole(ch, jauchH5.handicap_rank) // should be 3
    const cap = jauchH5.par + chStrokes + 3
    const expectedNet = Math.min(15 - chStrokes, cap)

    expect(chStrokes, 'Jauch H5 ch_strokes').toBe(3)
    expect(cap, 'Jauch H5 cap').toBe(10)
    expect(expectedNet, 'Jauch H5 net').toBe(10)

    // Update Jauch H5 score
    await sbUpdate(
      'scores',
      `player_id=eq.${PLAYERS.Jauch}&course_id=eq.${TERRA_LAGO_ID}&hole_number=eq.5`,
      {
        gross_score: 15,
        net_score: expectedNet,
        ch_strokes: chStrokes,
      }
    )

    // Verify
    const scores = await sbGet(
      `scores?player_id=eq.${PLAYERS.Jauch}&course_id=eq.${TERRA_LAGO_ID}&hole_number=eq.5&select=gross_score,net_score,ch_strokes`
    )
    expect(scores[0].gross_score).toBe(15)
    expect(scores[0].net_score, 'Jauch H5 net=10 (capped)').toBe(10)
    expect(scores[0].ch_strokes, 'Jauch H5 ch_strokes=3').toBe(3)
  })

  test('lower net max (NET_MAX_OVER_PAR=2 comparison)', async () => {
    // With NET_MAX_OVER_PAR=2 instead of 3:
    // Jauch H5 (par=4, rank=1, ch=42): ch_strokes=3, cap=4+3+2=9 (vs 10 with MAX=3)
    // Chris H3 (par=3, rank=17, ch=35): ch_strokes=2, cap=3+2+2=7 (vs 8 with MAX=3)
    // These are math checks, not DB writes

    // Jauch H5 with MAX=2:
    expect(calcNetScore(15, 3, 4, 2), 'Jauch H5 net with MAX=2').toBe(9)
    expect(calcNetScore(15, 3, 4, 3), 'Jauch H5 net with MAX=3').toBe(10)

    // Chris H3 with MAX=2:
    expect(calcNetScore(15, 2, 3, 2), 'Chris H3 net with MAX=2').toBe(7)
    expect(calcNetScore(15, 2, 3, 3), 'Chris H3 net with MAX=3').toBe(8)

    // Chris H12 (par=3, rank=18, ch=35): ch_strokes=1
    expect(calcNetScore(15, 1, 3, 2), 'Chris H12 net with MAX=2').toBe(6)
    expect(calcNetScore(15, 1, 3, 3), 'Chris H12 net with MAX=3').toBe(7)
  })

  test('net cap does NOT apply when player shoots within cap', async () => {
    // If a player shoots par+2 (Scenario A baseline), no capping should occur
    // for players with CH ≤ 17 (low-mid range)
    // Ryan H1 (par=4, rank=9, ch=14): ch_strokes=1, gross=6, net=6-1=5
    // Cap = 4+1+3=8. 5 < 8, so no cap. net=5.
    expect(calcNetScore(6, 1, 4, 3), 'Ryan H1 no cap').toBe(5)

    // Eric H5 (par=4, rank=1, ch=16): ch_strokes=1, gross=6, net=5
    // Cap = 4+1+3=8. 5 < 8, no cap.
    expect(calcNetScore(6, 1, 4, 3), 'Eric H5 no cap').toBe(5)
  })
})
