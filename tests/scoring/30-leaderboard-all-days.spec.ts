/**
 * 30-leaderboard-all-days.spec.ts
 * Phase 10: Leaderboard Verification — All 3 Days
 *
 * After seeding Scenario A for all 3 days (files 21, 28, 29),
 * verifies the cumulative leaderboard standings match TESTING-PLAN.md Section 6.
 *
 * Expected values (Scenario A — par+2 every hole, all 3 days):
 * All players: Total Gross = 324 (108 × 3 days)
 * Net order: Jauch(209) > Chris(224) > Gary(255) > Ben(263) > Eric(281) > Matthew(284)
 *   > Bruce(286) > C-Pat(287) > Ryan(291) > Mack(292) > Kiki(299)
 *
 * IMPORTANT: Must run AFTER 21, 28, 29 (all 3 days seeded).
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

const allCourseIds = Object.values(COURSES)

// Expected leaderboard from TESTING-PLAN.md Section 6
// After Scenario A (par+2) all 3 days
const EXPECTED_LEADERBOARD = [
  { name: 'Jauch',   id: PLAYERS.Jauch,   gross: 324, net: 209 },
  { name: 'Chris',   id: PLAYERS.Chris,   gross: 324, net: 224 },
  { name: 'Gary',    id: PLAYERS.Gary,    gross: 324, net: 255 },
  { name: 'Ben',     id: PLAYERS.Ben,     gross: 324, net: 263 },
  { name: 'Eric',    id: PLAYERS.Eric,    gross: 324, net: 281 },
  { name: 'Matthew', id: PLAYERS.Matthew, gross: 324, net: 284 },
  { name: 'Bruce',   id: PLAYERS.Bruce,   gross: 324, net: 286 },
  { name: 'C-Pat',   id: PLAYERS.CPat,    gross: 324, net: 287 },
  { name: 'Ryan',    id: PLAYERS.Ryan,    gross: 324, net: 291 },
  { name: 'Mack',    id: PLAYERS.Mack,    gross: 324, net: 292 },
  { name: 'Kiki',    id: PLAYERS.Kiki,    gross: 324, net: 299 },
]

// Day 1 par = 72, Day 2 par = 72, Day 3 par = 72 → total par = 216
const TOTAL_PAR = 216

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
  const url = `${SUPABASE_URL}/rest/v1/${table}?on_conflict=player_id,course_id,hole_number`
  const res = await fetch(url, {
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

// ─── Scoring helpers (mirror handicap.ts) ──────────────────────────────────────

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

// ─── Tests ─────────────────────────────────────────────────────────────────────

test.describe('30 · Leaderboard — All 3 Days (Scenario A)', () => {

  /**
   * Restore Day 1 Scenario A scores before verifying the 3-day leaderboard.
   *
   * Test 23 (net-cap) modifies Chris and Jauch scores on Terra Lago (Day 1)
   * by setting gross=15 on select holes to test cap behavior. It does NOT
   * restore those scores after the test. This beforeAll re-upserts the correct
   * Scenario A (par+2) values so the 3-day totals are accurate.
   */
  test.beforeAll(async () => {
    // Load Terra Lago holes
    const holes = await sbGet(
      `holes?course_id=eq.${COURSES.TerraLago}&select=hole_number,par,handicap_rank&order=hole_number.asc`
    ) as { hole_number: number; par: number; handicap_rank: number }[]

    // Load player_tee_assignments for Terra Lago (CH values)
    const ptas = await sbGet(
      `player_tee_assignments?course_id=eq.${COURSES.TerraLago}&select=player_id,course_handicap`
    ) as { player_id: string; course_handicap: number }[]
    const chMap = new Map(ptas.map(p => [p.player_id, p.course_handicap]))

    // Load group_players for Terra Lago groups (PH values)
    const groupPlayers = await sbGet(
      `group_players?select=player_id,playing_handicap`
    ) as { player_id: string; playing_handicap: number }[]
    const phMap = new Map(groupPlayers.map(p => [p.player_id, p.playing_handicap]))

    // Load NET_MAX_OVER_PAR setting
    const settings = await sbGet(
      `settings?key=eq.NET_MAX_OVER_PAR&select=value`
    ) as { value: string }[]
    const netMaxOverPar = settings.length > 0 ? parseInt(settings[0].value, 10) : 3

    // Re-seed Scenario A (par+2) for all 11 players on Terra Lago Day 1
    const rows: Record<string, unknown>[] = []
    const allPlayerIds = Object.values(PLAYERS)
    for (const playerId of allPlayerIds) {
      const ch = chMap.get(playerId) ?? 0
      const ph = phMap.get(playerId) ?? 0
      for (const hole of holes) {
        const gross = hole.par + 2
        const chStrokes = calcStrokesOnHole(ch, hole.handicap_rank)
        const phStrokes = calcStrokesOnHole(ph, hole.handicap_rank)
        const netScore = calcNetScore(gross, chStrokes, hole.par, netMaxOverPar)
        const phScore  = calcNetScore(gross, phStrokes, hole.par, netMaxOverPar)
        rows.push({
          player_id:   playerId,
          course_id:   COURSES.TerraLago,
          hole_number: hole.hole_number,
          gross_score: gross,
          net_score:   netScore,
          ph_score:    phScore,
          ch_strokes:  chStrokes,
          ph_strokes:  phStrokes,
          entered_by:  'test-30-restore',
        })
      }
    }
    await sbUpsert('scores', rows)
  })
  test('verify all 3 courses have 198 score rows each', async () => {
    for (const [name, courseId] of Object.entries(COURSES)) {
      const scores = await sbGet(
        `scores?course_id=eq.${courseId}&select=id`
      ) as { id: string }[]
      expect(scores.length, `${name} should have 198 rows`).toBe(198)
    }
  })

  test('verify total gross = 324 for all players (3 days × 108)', async () => {
    // Fetch all scores across all 3 courses
    const courseFilter = allCourseIds.map(id => `course_id.eq.${id}`).join(',')
    const scores = await sbGet(
      `scores?or=(${courseFilter})&select=player_id,gross_score`
    ) as { player_id: string; gross_score: number }[]

    const grossByPlayer = new Map<string, number>()
    for (const s of scores) {
      grossByPlayer.set(s.player_id, (grossByPlayer.get(s.player_id) ?? 0) + s.gross_score)
    }

    for (const { name, id } of EXPECTED_LEADERBOARD) {
      const actual = grossByPlayer.get(id) ?? 0
      expect(actual, `${name} total gross`).toBe(324)
    }
  })

  test('verify total net scores match Section 6 expected values', async () => {
    const courseFilter = allCourseIds.map(id => `course_id.eq.${id}`).join(',')
    const scores = await sbGet(
      `scores?or=(${courseFilter})&select=player_id,net_score`
    ) as { player_id: string; net_score: number }[]

    const netByPlayer = new Map<string, number>()
    for (const s of scores) {
      netByPlayer.set(s.player_id, (netByPlayer.get(s.player_id) ?? 0) + s.net_score)
    }

    for (const { name, id, net } of EXPECTED_LEADERBOARD) {
      const actual = netByPlayer.get(id) ?? 0
      expect(actual, `${name} total net (3 days)`).toBe(net)
    }
  })

  test('verify leaderboard ranking order by net (ascending = lowest net wins)', async () => {
    const courseFilter = allCourseIds.map(id => `course_id.eq.${id}`).join(',')
    const scores = await sbGet(
      `scores?or=(${courseFilter})&select=player_id,net_score`
    ) as { player_id: string; net_score: number }[]

    const netByPlayer = new Map<string, number>()
    for (const s of scores) {
      netByPlayer.set(s.player_id, (netByPlayer.get(s.player_id) ?? 0) + s.net_score)
    }

    // Sort players by net ascending (lowest net = best score in stroke play)
    const sorted = [...EXPECTED_LEADERBOARD]
      .map(p => ({ ...p, actualNet: netByPlayer.get(p.id) ?? 0 }))
      .sort((a, b) => a.actualNet - b.actualNet)

    // Verify the sorted order matches TESTING-PLAN.md Section 6
    const expectedOrder = EXPECTED_LEADERBOARD.map(p => p.name)
    const actualOrder = sorted.map(p => p.name)
    expect(actualOrder).toEqual(expectedOrder)
  })

  test('verify vs-par values (net - total_par)', async () => {
    const courseFilter = allCourseIds.map(id => `course_id.eq.${id}`).join(',')
    const scores = await sbGet(
      `scores?or=(${courseFilter})&select=player_id,net_score`
    ) as { player_id: string; net_score: number }[]

    const netByPlayer = new Map<string, number>()
    for (const s of scores) {
      netByPlayer.set(s.player_id, (netByPlayer.get(s.player_id) ?? 0) + s.net_score)
    }

    // vs par from Section 6
    const expectedVsPar: Record<string, number> = {
      [PLAYERS.Jauch]:   -7,   // 209 - 216
      [PLAYERS.Chris]:    8,   // 224 - 216
      [PLAYERS.Gary]:    39,   // 255 - 216
      [PLAYERS.Ben]:     47,   // 263 - 216
      [PLAYERS.Eric]:    65,   // 281 - 216
      [PLAYERS.Matthew]: 68,   // 284 - 216
      [PLAYERS.Bruce]:   70,   // 286 - 216
      [PLAYERS.CPat]:    71,   // 287 - 216
      [PLAYERS.Ryan]:    75,   // 291 - 216
      [PLAYERS.Mack]:    76,   // 292 - 216
      [PLAYERS.Kiki]:    83,   // 299 - 216
    }

    for (const [playerId, expectedVP] of Object.entries(expectedVsPar)) {
      const net = netByPlayer.get(playerId) ?? 0
      const actualVsPar = net - TOTAL_PAR
      expect(actualVsPar, `vs par for ${playerId}`).toBe(expectedVP)
    }
  })

  test('verify per-day net subtotals add up to 3-day total', async () => {
    // Verify each day's net independently then sum matches total
    const dayNets = new Map<string, number[]>() // playerId → [day1, day2, day3]
    for (const playerId of Object.values(PLAYERS)) {
      dayNets.set(playerId, [])
    }

    for (const [, courseId] of Object.entries(COURSES)) {
      const scores = await sbGet(
        `scores?course_id=eq.${courseId}&select=player_id,net_score`
      ) as { player_id: string; net_score: number }[]

      const netByPlayer = new Map<string, number>()
      for (const s of scores) {
        netByPlayer.set(s.player_id, (netByPlayer.get(s.player_id) ?? 0) + s.net_score)
      }

      for (const playerId of Object.values(PLAYERS)) {
        dayNets.get(playerId)!.push(netByPlayer.get(playerId) ?? 0)
      }
    }

    // Verify sum of 3 days = total net from TESTING-PLAN.md
    for (const { name, id, net } of EXPECTED_LEADERBOARD) {
      const days = dayNets.get(id) ?? []
      const sum = days.reduce((a, b) => a + b, 0)
      expect(sum, `${name} day1+day2+day3 net sum`).toBe(net)
    }
  })

  test('leaderboard page loads and is accessible', async ({ page }) => {
    await page.goto('/leaderboard')
    await page.waitForLoadState('networkidle')

    // Page should load (SSR may show empty until realtime fires)
    const title = page.locator('h1, h2').filter({ hasText: /leaderboard/i })
    await expect(title).toBeVisible({ timeout: 10000 })
  })
})
