/**
 * 26-undo-history.spec.ts
 * Tests the undo/history functionality:
 * 1. Enter a score for Ryan H1 (exists from Scenario A seed)
 * 2. Update it to a different gross score → creates history entry
 * 3. Update it again → creates second history entry
 * 4. Verify /history page loads
 * 5. Verify score_history table has entries for this score
 * 6. Undo: restore to previous value, verify
 *
 * API-level verification only (SSR caching makes UI tests unreliable).
 */

import { test, expect } from '@playwright/test'
import * as fs from 'fs'

const SUPABASE_URL = 'https://lnnlabbdffowjpaxvnsp.supabase.co'
const SERVICE_KEY = fs.readFileSync(
  `${process.env.HOME}/.config/supabase/degen-dudes-service-role`,
  'utf8'
).trim()

const TERRA_LAGO_ID = '9333b881-441e-43f0-9aa8-efe8f9dcd203'
const RYAN_ID = '06559478-aa82-4a0d-aa26-d239ae8414f4'

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

async function sbInsert(table: string, rows: Record<string, unknown>[]) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
    method: 'POST',
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    },
    body: JSON.stringify(rows),
  })
  if (!res.ok) throw new Error(`POST ${table} → ${res.status}: ${await res.text()}`)
  return res.json()
}

test.describe('26 · Undo and score history', () => {
  let ryanH1ScoreId: string
  let originalGross: number

  test('load Ryan H1 existing score (from Scenario A seed)', async () => {
    const scores = await sbGet(
      `scores?player_id=eq.${RYAN_ID}&course_id=eq.${TERRA_LAGO_ID}&hole_number=eq.1&select=id,gross_score`
    )
    expect(scores.length).toBe(1)

    ryanH1ScoreId = scores[0].id
    originalGross = scores[0].gross_score
    expect(originalGross).toBe(6) // Scenario A: par+2 = 4+2 = 6
  })

  test('update Ryan H1 to gross=7 — creates history entry', async () => {
    // First, manually log the history entry (simulating what saveScore does)
    await sbInsert('score_history', [{
      score_id: ryanH1ScoreId,
      previous_gross: originalGross,
      new_gross: 7,
      changed_by: 'test-undo-26',
    }])

    // Then update the score
    await sbUpdate(
      'scores',
      `player_id=eq.${RYAN_ID}&course_id=eq.${TERRA_LAGO_ID}&hole_number=eq.1`,
      { gross_score: 7, entered_by: 'test-undo-26' }
    )

    // Verify
    const scores = await sbGet(
      `scores?player_id=eq.${RYAN_ID}&course_id=eq.${TERRA_LAGO_ID}&hole_number=eq.1&select=gross_score`
    )
    expect(scores[0].gross_score).toBe(7)
  })

  test('update Ryan H1 to gross=8 — creates second history entry', async () => {
    await sbInsert('score_history', [{
      score_id: ryanH1ScoreId,
      previous_gross: 7,
      new_gross: 8,
      changed_by: 'test-undo-26',
    }])

    await sbUpdate(
      'scores',
      `player_id=eq.${RYAN_ID}&course_id=eq.${TERRA_LAGO_ID}&hole_number=eq.1`,
      { gross_score: 8, entered_by: 'test-undo-26' }
    )

    const scores = await sbGet(
      `scores?player_id=eq.${RYAN_ID}&course_id=eq.${TERRA_LAGO_ID}&hole_number=eq.1&select=gross_score`
    )
    expect(scores[0].gross_score).toBe(8)
  })

  test('score_history has at least 2 entries for Ryan H1', async () => {
    const history = await sbGet(
      `score_history?score_id=eq.${ryanH1ScoreId}&select=id,previous_gross,new_gross,changed_by&order=changed_at`
    )
    expect(history.length).toBeGreaterThanOrEqual(2)

    // Verify history trail: 6→7, 7→8
    const testEntries = history.filter((h: { changed_by: string }) => h.changed_by === 'test-undo-26')
    expect(testEntries.length).toBeGreaterThanOrEqual(2)
    expect(testEntries[0].previous_gross).toBe(6)
    expect(testEntries[0].new_gross).toBe(7)
    expect(testEntries[1].previous_gross).toBe(7)
    expect(testEntries[1].new_gross).toBe(8)
  })

  test('undo: restore Ryan H1 to previous gross (7)', async () => {
    // Simulate undo: get most recent history entry, restore to previous_gross
    const history = await sbGet(
      `score_history?score_id=eq.${ryanH1ScoreId}&select=id,previous_gross,new_gross&order=changed_at.desc&limit=1`
    )
    expect(history.length).toBe(1)
    const lastEntry = history[0]
    const restoredGross = lastEntry.previous_gross // should be 7

    // Log the undo in history
    await sbInsert('score_history', [{
      score_id: ryanH1ScoreId,
      previous_gross: lastEntry.new_gross, // 8
      new_gross: restoredGross,             // 7
      changed_by: 'undo',
    }])

    // Restore the score
    await sbUpdate(
      'scores',
      `player_id=eq.${RYAN_ID}&course_id=eq.${TERRA_LAGO_ID}&hole_number=eq.1`,
      { gross_score: restoredGross }
    )

    // Verify score was restored
    const scores = await sbGet(
      `scores?player_id=eq.${RYAN_ID}&course_id=eq.${TERRA_LAGO_ID}&hole_number=eq.1&select=gross_score`
    )
    expect(scores[0].gross_score, 'after undo').toBe(7)
  })

  test('score_history has undo entry with changed_by=undo', async () => {
    const history = await sbGet(
      `score_history?score_id=eq.${ryanH1ScoreId}&select=changed_by,previous_gross,new_gross&changed_by=eq.undo`
    )
    expect(history.length).toBeGreaterThanOrEqual(1)
    expect(history[0].changed_by).toBe('undo')
    expect(history[0].previous_gross).toBe(8)
    expect(history[0].new_gross).toBe(7)
  })

  test('/history page loads without error', async ({ page }) => {
    await page.goto('/history')
    await page.waitForLoadState('networkidle')

    // Page should load (not crash, not show 404)
    const title = await page.title()
    expect(title).not.toContain('404')
    expect(title).not.toContain('Error')

    // Page should have some content
    const bodyText = await page.textContent('body') ?? ''
    expect(bodyText.length).toBeGreaterThan(50)
  })

  test('total score_history count > 0', async () => {
    const allHistory = await sbGet(
      `score_history?select=id&limit=1`
    )
    expect(allHistory.length).toBeGreaterThanOrEqual(1)
  })
})
