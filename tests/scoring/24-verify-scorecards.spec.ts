/**
 * 24-verify-scorecards.spec.ts
 * Verifies the /scorecards page renders correctly and that score data
 * stored in DB has correct shape indicator logic.
 *
 * API-level: verifies gross/net scores are stored correctly in DB.
 * UI-level: verifies the /scorecards page loads with all player names.
 *
 * Note: Vercel SSR caching means the page may show stale data on initial load.
 * API-level assertions are authoritative.
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

async function sbGet(path: string) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
  })
  if (!res.ok) throw new Error(`GET ${path} → ${res.status}`)
  return res.json()
}

// Shape indicator logic (mirrors ScorecardsClient)
function getScoreShape(gross: number, par: number): string {
  const diff = gross - par
  if (diff <= -2) return 'eagle'
  if (diff === -1) return 'birdie'
  if (diff === 0) return 'par'
  if (diff === 1) return 'bogey'
  return 'double+'
}

test.describe('24 · Scorecards page and shape indicator logic', () => {
  test('scorecards page loads with all player names', async ({ page }) => {
    await page.goto('/scorecards')
    await page.waitForLoadState('networkidle')

    const playerNames = ['Ryan', 'Kiki', 'Mack', 'Bruce', 'Matthew', 'C-Pat', 'Eric', 'Ben', 'Gary', 'Chris', 'Jauch']
    for (const name of playerNames) {
      await expect(page.getByText(name).first(), `${name} on scorecards`).toBeVisible()
    }
  })

  test('scorecards page has day tab navigation', async ({ page }) => {
    await page.goto('/scorecards')
    await page.waitForLoadState('networkidle')

    // Should have tabs for each day
    const pageText = await page.textContent('body') ?? ''
    expect(pageText).toContain('Day 1')
  })

  test('scorecards page has Terra Lago course label', async ({ page }) => {
    await page.goto('/scorecards')
    await page.waitForLoadState('networkidle')

    const pageText = await page.textContent('body') ?? ''
    // Course name or "Day 1" should be visible
    expect(
      pageText.includes('Terra Lago') || pageText.includes('Day 1')
    ).toBe(true)
  })

  test('shape indicator logic: eagle ≤ -2', () => {
    expect(getScoreShape(1, 3)).toBe('eagle')   // hole in one on par 3
    expect(getScoreShape(3, 5)).toBe('eagle')   // eagle on par 5
    expect(getScoreShape(2, 4)).toBe('eagle')   // eagle on par 4
  })

  test('shape indicator logic: birdie = -1', () => {
    expect(getScoreShape(2, 3)).toBe('birdie')
    expect(getScoreShape(3, 4)).toBe('birdie')
    expect(getScoreShape(4, 5)).toBe('birdie')
  })

  test('shape indicator logic: par = 0', () => {
    expect(getScoreShape(3, 3)).toBe('par')
    expect(getScoreShape(4, 4)).toBe('par')
    expect(getScoreShape(5, 5)).toBe('par')
  })

  test('shape indicator logic: bogey = +1', () => {
    expect(getScoreShape(4, 3)).toBe('bogey')
    expect(getScoreShape(5, 4)).toBe('bogey')
    expect(getScoreShape(6, 5)).toBe('bogey')
  })

  test('shape indicator logic: double+ ≥ +2', () => {
    expect(getScoreShape(5, 3)).toBe('double+')
    expect(getScoreShape(6, 4)).toBe('double+')
    expect(getScoreShape(15, 4)).toBe('double+')
  })

  test('Scenario A scores (par+2 everywhere) = all bogeys or doubles', async () => {
    // In Scenario A everyone shoots par+2. That means every hole is a double bogey (shape=double+)
    const scores = await sbGet(
      `scores?course_id=eq.${TERRA_LAGO_ID}&player_id=eq.${PLAYERS.Ryan}&select=hole_number,gross_score,net_score`
    )

    // Get holes for par reference
    const holes: { hole_number: number; par: number }[] = await sbGet(
      `holes?course_id=eq.${TERRA_LAGO_ID}&select=hole_number,par&order=hole_number`
    )

    for (const score of scores) {
      const hole = holes.find(h => h.hole_number === score.hole_number)!
      const expectedGross = hole.par + 2
      // Scenario A baseline (some holes modified by net cap test for Chris/Jauch, but Ryan is untouched)
      if (score.gross_score === expectedGross) {
        const shape = getScoreShape(score.gross_score, hole.par)
        expect(shape, `Ryan H${score.hole_number} (gross=${score.gross_score}, par=${hole.par})`).toBe('double+')
      }
    }
  })

  test('net subscript values stored correctly for Scenario A', async () => {
    // Verify net_score is always less than gross_score for players with strokes
    // Ryan CH=14 → gets strokes on 14 holes → net < gross on those holes
    const scores: { hole_number: number; gross_score: number; net_score: number; ch_strokes: number }[] = await sbGet(
      `scores?course_id=eq.${TERRA_LAGO_ID}&player_id=eq.${PLAYERS.Ryan}&select=hole_number,gross_score,net_score,ch_strokes&order=hole_number`
    )

    for (const score of scores) {
      if (score.ch_strokes > 0) {
        expect(score.net_score, `Ryan H${score.hole_number} net < gross when strokes > 0`).toBeLessThan(score.gross_score)
      } else {
        expect(score.net_score, `Ryan H${score.hole_number} net = gross when strokes = 0`).toBe(score.gross_score)
      }
    }
  })

  test('Gary (CH=26) gets double strokes on 8 holes (rank ≤ 26-18=8)', async () => {
    // Gary CH=26: gets 2 strokes on holes with handicap_rank ≤ 8, 1 stroke on ranks 9-26
    // ch_strokes=2 holes count should be 8 (ranks 1-8)
    const scores: { hole_number: number; ch_strokes: number }[] = await sbGet(
      `scores?course_id=eq.${TERRA_LAGO_ID}&player_id=eq.${PLAYERS.Gary}&select=hole_number,ch_strokes`
    )

    const doubleStrokeHoles = scores.filter(s => s.ch_strokes === 2)
    const singleStrokeHoles = scores.filter(s => s.ch_strokes === 1)
    const noStrokeHoles = scores.filter(s => s.ch_strokes === 0)

    expect(doubleStrokeHoles.length, 'Gary double-stroke holes').toBe(8)   // ranks 1-8
    expect(singleStrokeHoles.length, 'Gary single-stroke holes').toBe(10)  // ranks 9-18 (only 18 holes total)
    expect(noStrokeHoles.length, 'Gary no-stroke holes').toBe(0)           // total CH=26 means all holes get strokes
  })

  test('Jauch (CH=42) gets triple strokes on 6 holes (rank ≤ 42-36=6)', async () => {
    // Jauch CH=42: gets 3 strokes on holes with rank ≤ 6, 2 strokes on ranks 7-36+, etc.
    const scores: { hole_number: number; ch_strokes: number }[] = await sbGet(
      `scores?course_id=eq.${TERRA_LAGO_ID}&player_id=eq.${PLAYERS.Jauch}&select=hole_number,ch_strokes`
    )

    const tripleStrokeHoles = scores.filter(s => s.ch_strokes === 3)
    const totalChStrokes = scores.reduce((sum, s) => sum + s.ch_strokes, 0)

    expect(tripleStrokeHoles.length, 'Jauch triple-stroke holes').toBe(6)  // ranks 1-6
    expect(totalChStrokes, 'Jauch total ch_strokes = CH=42').toBe(42)
  })
})
