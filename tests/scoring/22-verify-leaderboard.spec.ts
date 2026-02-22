/**
 * 22-verify-leaderboard.spec.ts
 * After Scenario A scores are seeded (by 21-scenario-a-seed.spec.ts),
 * verifies the scoring data is correct at the API level and that the
 * leaderboard page loads with all players visible.
 *
 * NOTE: The leaderboard page uses Next.js SSR + Vercel caching.
 * Initial page loads may show cached empty data until realtime subscription fires.
 * API-level tests verify the actual scoring math; UI tests verify basic page structure.
 *
 * IMPORTANT: Must run AFTER 21-scenario-a-seed.spec.ts
 */

import { test, expect } from '@playwright/test'
import * as fs from 'fs'

const SUPABASE_URL = 'https://lnnlabbdffowjpaxvnsp.supabase.co'
const SERVICE_KEY = fs.readFileSync(
  `${process.env.HOME}/.config/supabase/degen-dudes-service-role`,
  'utf8'
).trim()

const TERRA_LAGO_ID = '9333b881-441e-43f0-9aa8-efe8f9dcd203'

// Player IDs
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

// Expected net totals from TESTING-PLAN.md Section 3, Scenario A, Day 1
const EXPECTED_NET: Record<string, number> = {
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

async function sbGet(path: string) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
    },
  })
  if (!res.ok) throw new Error(`GET ${path} → ${res.status}`)
  return res.json()
}

test.describe('22 · Verify leaderboard data — Scenario A Day 1', () => {
  test('DB has 198 scores for Day 1 (11 players × 18 holes)', async () => {
    const scores = await sbGet(
      `scores?course_id=eq.${TERRA_LAGO_ID}&select=id`
    )
    expect(scores).toHaveLength(198)
  })

  test('all 11 players have exactly 18 scores each', async () => {
    const scores = await sbGet(
      `scores?course_id=eq.${TERRA_LAGO_ID}&select=player_id,gross_score`
    )
    const countByPlayer = new Map<string, number>()
    for (const s of scores) {
      countByPlayer.set(s.player_id, (countByPlayer.get(s.player_id) ?? 0) + 1)
    }
    for (const [, id] of Object.entries(PLAYERS)) {
      expect(countByPlayer.get(id), `${id} should have 18 scores`).toBe(18)
    }
  })

  test('gross totals = 108 for all players (Scenario A: par+2 every hole)', async () => {
    const scores = await sbGet(
      `scores?course_id=eq.${TERRA_LAGO_ID}&select=player_id,gross_score`
    )
    const grossByPlayer = new Map<string, number>()
    for (const s of scores) {
      grossByPlayer.set(s.player_id, (grossByPlayer.get(s.player_id) ?? 0) + s.gross_score)
    }
    for (const [name, id] of Object.entries(PLAYERS)) {
      expect(grossByPlayer.get(id), `${name} gross total`).toBe(108)
    }
  })

  test('net totals match TESTING-PLAN.md Scenario A Day 1 expected values', async () => {
    const scores = await sbGet(
      `scores?course_id=eq.${TERRA_LAGO_ID}&select=player_id,net_score`
    )
    const netByPlayer = new Map<string, number>()
    for (const s of scores) {
      netByPlayer.set(s.player_id, (netByPlayer.get(s.player_id) ?? 0) + s.net_score)
    }
    for (const [playerId, expected] of Object.entries(EXPECTED_NET)) {
      expect(netByPlayer.get(playerId), `player ${playerId} net total`).toBe(expected)
    }
  })

  test('net vs par values correct: Jauch=-6, Ryan=+22, Kiki=+25', async () => {
    // Day 1 par = 72
    const par = 72
    const checks = [
      { id: PLAYERS.Jauch, name: 'Jauch', expectedNet: 66, expectedVsPar: -6 },
      { id: PLAYERS.Ryan,  name: 'Ryan',  expectedNet: 94, expectedVsPar: +22 },
      { id: PLAYERS.Kiki,  name: 'Kiki',  expectedNet: 97, expectedVsPar: +25 },
    ]

    const scores = await sbGet(
      `scores?course_id=eq.${TERRA_LAGO_ID}&select=player_id,net_score`
    )
    const netByPlayer = new Map<string, number>()
    for (const s of scores) {
      netByPlayer.set(s.player_id, (netByPlayer.get(s.player_id) ?? 0) + s.net_score)
    }

    for (const { id, name, expectedNet, expectedVsPar } of checks) {
      const actualNet = netByPlayer.get(id) ?? 0
      expect(actualNet, `${name} net total`).toBe(expectedNet)
      expect(actualNet - par, `${name} vs par`).toBe(expectedVsPar)
    }
  })

  test('leaderboard page loads with all 11 player names visible', async ({ page }) => {
    await page.goto('/leaderboard')
    await page.waitForLoadState('networkidle')

    const playerNames = ['Ryan', 'Kiki', 'Mack', 'Bruce', 'Matthew', 'C-Pat', 'Eric', 'Ben', 'Gary', 'Chris', 'Jauch']
    for (const name of playerNames) {
      await expect(page.getByText(name).first(), `${name} on leaderboard`).toBeVisible()
    }
  })

  test('leaderboard page has Individual and Teams toggle', async ({ page }) => {
    await page.goto('/leaderboard')
    await page.waitForLoadState('networkidle')

    await expect(page.getByRole('button', { name: 'Individual' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Teams' })).toBeVisible()
  })

  test('ch_strokes stored correctly for Ryan on Day 1 (14 total strokes)', async () => {
    // Ryan CH=14 on Day 1. Sum of ch_strokes across all 18 holes should = 14.
    const scores = await sbGet(
      `scores?course_id=eq.${TERRA_LAGO_ID}&player_id=eq.${PLAYERS.Ryan}&select=ch_strokes`
    )
    const totalChStrokes = scores.reduce((sum: number, s: { ch_strokes: number }) => sum + s.ch_strokes, 0)
    expect(totalChStrokes).toBe(14)
  })

  test('Jauch ch_strokes total = 42 on Day 1', async () => {
    // Jauch CH=42 on Day 1. Total ch_strokes should = 42.
    const scores = await sbGet(
      `scores?course_id=eq.${TERRA_LAGO_ID}&player_id=eq.${PLAYERS.Jauch}&select=ch_strokes`
    )
    const total = scores.reduce((sum: number, s: { ch_strokes: number }) => sum + s.ch_strokes, 0)
    expect(total).toBe(42)
  })
})
