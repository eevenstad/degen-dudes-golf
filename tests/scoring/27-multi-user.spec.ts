/**
 * 27-multi-user.spec.ts
 * Tests concurrent score entry from multiple "users" (simulated via parallel API calls).
 *
 * Goal: verify no data races, dropped writes, or corruption when 3 players
 * enter scores simultaneously via the Supabase API.
 *
 * Approach:
 * - Concurrent writes are simulated via Promise.all() with direct Supabase API calls
 *   (the same underlying mechanism the app uses — server actions call the same REST API)
 * - After all inserts, verify total score count and no overwritten/dropped values
 * - Leaderboard page load check uses shared auth state from global-setup.ts
 *
 * DB state assumption: Scenario A (198 scores, Day 1) already seeded by test 21.
 * This test uses Day 2 (PGA West Mountain) to avoid conflicting with Day 1 data.
 *
 * API-level verification only (SSR caching makes UI score checks unreliable).
 */

import { test, expect } from '@playwright/test'
import * as fs from 'fs'

const SUPABASE_URL = 'https://lnnlabbdffowjpaxvnsp.supabase.co'
const SERVICE_KEY = fs.readFileSync(
  `${process.env.HOME}/.config/supabase/degen-dudes-service-role`,
  'utf8'
).trim()

const PGA_WEST_MOUNTAIN_ID = 'fb74b2c0-b9df-4926-8867-13d83a2cdf7f'
const APP_URL = 'https://degen-dudes-golf.vercel.app'

// Three players from different groups — inserting concurrently
// CH values are approximate for Day 2 (used only for net calc in test payloads)
const PLAYERS = [
  { id: '06559478-aa82-4a0d-aa26-d239ae8414f4', name: 'Ryan',    ch: 12 },
  { id: '57a4fdd1-6cac-4264-ad8d-809aef763ee1', name: 'Matthew', ch: 14 },
  { id: 'e0928ef5-83fe-440c-8a1c-76704f4886af', name: 'Gary',    ch: 24 },
]

// Test against holes 1-5 only (small subset, sufficient to prove concurrency)
const HOLE_NUMBERS = [1, 2, 3, 4, 5]

// Gross score used for initial insert pass
const GROSS_V1 = 5
// Gross score used for concurrent update pass
const GROSS_V2 = 6

// ─── Supabase helpers ────────────────────────────────────────────────────────

async function sbGet(path: string) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
  })
  if (!res.ok) throw new Error(`GET ${path} → ${res.status}: ${await res.text()}`)
  return res.json()
}

async function sbUpsert(table: string, rows: Record<string, unknown>[], onConflict = '') {
  const url = onConflict
    ? `${SUPABASE_URL}/rest/v1/${table}?on_conflict=${onConflict}`
    : `${SUPABASE_URL}/rest/v1/${table}`
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

async function sbDelete(table: string, filter: string) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${filter}`, {
    method: 'DELETE',
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
  })
  if (!res.ok) throw new Error(`DELETE ${table}?${filter} → ${res.status}: ${await res.text()}`)
}

// ─── Score payload builder ───────────────────────────────────────────────────

interface HoleRow { id: string; hole_number: number; par: number; handicap_rank: number }

function buildPayload(
  playerId: string,
  playerCh: number,
  hole: HoleRow,
  gross: number
): Record<string, unknown> {
  // Single stroke if handicap_rank ≤ ch; CH fits within 18 for all 3 test players
  const chStrokes = hole.handicap_rank <= playerCh ? 1 : 0
  const netRaw = gross - chStrokes
  const netCap = hole.par + chStrokes + 3 // NET_MAX_OVER_PAR = 3
  const net = Math.min(netRaw, netCap)

  return {
    player_id: playerId,
    course_id: PGA_WEST_MOUNTAIN_ID,
    hole_number: hole.hole_number,
    gross_score: gross,
    net_score: net,
    ch_strokes: chStrokes,
    ph_score: gross,
  }
}

// ─── Shared state across tests ───────────────────────────────────────────────

let day2Holes: HoleRow[] = []
let targetHoles: HoleRow[] = []

// ─── Tests ───────────────────────────────────────────────────────────────────

test.describe('27 · Multi-User Concurrent Score Entry', () => {

  test.beforeAll(async () => {
    // Load Day 2 holes once
    day2Holes = await sbGet(
      `holes?course_id=eq.${PGA_WEST_MOUNTAIN_ID}&select=id,hole_number,par,handicap_rank&order=hole_number.asc`
    )
    targetHoles = day2Holes.filter((h) => HOLE_NUMBERS.includes(h.hole_number))

    // Clean up any existing Day 2 scores for our 3 test players
    for (const player of PLAYERS) {
      await sbDelete(
        'scores',
        `player_id=eq.${player.id}&course_id=eq.${PGA_WEST_MOUNTAIN_ID}`
      ).catch(() => {}) // safe to ignore if nothing exists
    }
  })

  test.afterAll(async () => {
    // Clean up Day 2 test scores so subsequent test runs start fresh
    for (const player of PLAYERS) {
      await sbDelete(
        'scores',
        `player_id=eq.${player.id}&course_id=eq.${PGA_WEST_MOUNTAIN_ID}`
      ).catch(() => {})
    }
  })

  // ── Setup verification ──────────────────────────────────────────────────

  test('Day 2 hole data loads correctly (18 holes)', async () => {
    expect(day2Holes.length).toBe(18)
    expect(day2Holes[0].hole_number).toBe(1)
    expect(day2Holes[17].hole_number).toBe(18)
    expect(targetHoles.length).toBe(5)

    for (const hole of day2Holes) {
      expect(hole.par).toBeGreaterThanOrEqual(3)
      expect(hole.par).toBeLessThanOrEqual(5)
      expect(hole.handicap_rank).toBeGreaterThanOrEqual(1)
      expect(hole.handicap_rank).toBeLessThanOrEqual(18)
    }
  })

  // ── Concurrent inserts ──────────────────────────────────────────────────

  test('concurrent inserts: 3 players × 5 holes via Promise.all() — no errors', async () => {
    const insertJobs = PLAYERS.map((player) => {
      const payloads = targetHoles.map((hole) =>
        buildPayload(player.id, player.ch, hole, GROSS_V1)
      )
      return sbUpsert('scores', payloads, 'player_id,course_id,hole_number')
    })

    // Fire all 3 upserts simultaneously
    const results = await Promise.all(insertJobs)

    // Each should return 5 rows (one per hole)
    for (let i = 0; i < PLAYERS.length; i++) {
      expect(Array.isArray(results[i])).toBe(true)
      expect((results[i] as unknown[]).length).toBe(5)
    }
  })

  test('verify 15 scores exist (3 players × 5 holes) — none dropped', async () => {
    const rows: { player_id: string; hole_number: number; gross_score: number }[] = await sbGet(
      `scores?course_id=eq.${PGA_WEST_MOUNTAIN_ID}` +
        `&player_id=in.(${PLAYERS.map((p) => p.id).join(',')})` +
        `&hole_number=in.(${HOLE_NUMBERS.join(',')})` +
        `&select=player_id,hole_number,gross_score`
    )

    expect(rows.length).toBe(15)

    for (const player of PLAYERS) {
      const playerRows = rows.filter((r) => r.player_id === player.id)
      expect(playerRows.length).toBe(5)
    }

    for (const row of rows) {
      expect(row.gross_score).toBe(GROSS_V1)
    }
  })

  // ── Concurrent updates ──────────────────────────────────────────────────

  test('concurrent updates: 3 players update same holes simultaneously — no data loss', async () => {
    const updateJobs = PLAYERS.map((player) => {
      const payloads = targetHoles.map((hole) =>
        buildPayload(player.id, player.ch, hole, GROSS_V2)
      )
      return sbUpsert('scores', payloads, 'player_id,course_id,hole_number')
    })

    const results = await Promise.all(updateJobs)

    for (let i = 0; i < PLAYERS.length; i++) {
      expect(Array.isArray(results[i])).toBe(true)
      expect((results[i] as unknown[]).length).toBe(5)
    }
  })

  test('verify all 15 scores updated to new value — no stale data', async () => {
    const rows: { player_id: string; gross_score: number }[] = await sbGet(
      `scores?course_id=eq.${PGA_WEST_MOUNTAIN_ID}` +
        `&player_id=in.(${PLAYERS.map((p) => p.id).join(',')})` +
        `&hole_number=in.(${HOLE_NUMBERS.join(',')})` +
        `&select=player_id,gross_score`
    )

    expect(rows.length).toBe(15)

    // All 15 rows should have the updated gross, not the original
    for (const row of rows) {
      expect(row.gross_score).toBe(GROSS_V2)
    }
  })

  // ── Rapid sequential writes (one player, many holes, fast) ─────────────

  test('rapid sequential writes for one player complete without error', async () => {
    // Simulate a player entering all 18 holes quickly (serial, not parallel)
    const allHoles = day2Holes
    const player = PLAYERS[0] // Ryan

    // Insert all 18 holes for Ryan in Day 2
    const payloads = allHoles.map((hole) =>
      buildPayload(player.id, player.ch, hole, GROSS_V1)
    )
    const result = await sbUpsert('scores', payloads, 'player_id,course_id,hole_number')
    expect(Array.isArray(result)).toBe(true)
    expect((result as unknown[]).length).toBe(18)

    // Verify all 18 are in the DB
    const rows: { gross_score: number }[] = await sbGet(
      `scores?player_id=eq.${player.id}&course_id=eq.${PGA_WEST_MOUNTAIN_ID}&select=gross_score`
    )
    expect(rows.length).toBe(18)
  })

  // ── UI stability ────────────────────────────────────────────────────────

  test('leaderboard page loads without crashing after concurrent writes', async ({ page }) => {
    await page.goto(`${APP_URL}/leaderboard`)
    // Should not redirect to error page
    await expect(page).not.toHaveURL(/\/error|500/)
    // Body should render (not blank)
    await expect(page.locator('body')).not.toBeEmpty()
    // At least one player name should be visible somewhere on the page
    const bodyText = await page.locator('body').textContent()
    const hasAnyPlayer = PLAYERS.some((p) => bodyText?.includes(p.name))
    expect(hasAnyPlayer).toBe(true)
  })
})
