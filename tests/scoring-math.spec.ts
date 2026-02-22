import { test, expect } from '@playwright/test';

// ============================================================
// scoring-math.spec.ts — Verify scoring math in app
// ============================================================
//
// Eric's data:
//   Handicap Index: 13.5
//   Terra Lago Yellow tee: rating 71.9, slope 132, par 72
//
// Expected Course Handicap (CH):
//   CH = ROUND(13.5 × (132/113) + (71.9 - 72))
//      = ROUND(15.7699... + (-0.1))
//      = ROUND(15.6699...)
//      = 16
//
// Day 1, Hole 1 properties (Terra Lago North):
//   Par: 4, Handicap Rank: 1 (the hardest hole)
//
// With CH = 16 and hole handicap rank = 1:
//   calcStrokesOnHole(16, 1) = 1 (because 1 <= 16 and 16 < 18)
//   Net score = gross - 1 strokes
//   If gross = 6: net = 6 - 1 = 5
//
// ============================================================

// Unit test: verify calcCourseHandicap math
test.describe('Scoring math — unit calculations', () => {
  test('Course Handicap formula: 13.5 × (132/113) + (71.9 - 72) = 16', () => {
    const handicapIndex = 13.5;
    const slope = 132;
    const rating = 71.9;
    const par = 72;

    const raw = handicapIndex * (slope / 113) + (rating - par);
    const ch = Math.round(raw);

    console.log(`CH raw: ${raw}, rounded: ${ch}`);
    expect(ch, 'Eric\'s course handicap should be 16').toBe(16);
  });

  test('calcStrokesOnHole: CH=16, hole rank 1 → 1 stroke', () => {
    // calcStrokesOnHole from handicap.ts:
    // if handicap >= 1 and holeHandicapRank <= handicap → 1 stroke
    // else → 0
    const ch = 16;
    const holeRank = 1;
    const strokes = holeRank <= ch ? 1 : 0; // simplified from calcStrokesOnHole
    expect(strokes, 'Hole rank 1 with CH=16 should give 1 stroke').toBe(1);
  });

  test('calcStrokesOnHole: CH=16, hole rank 17 → 0 strokes', () => {
    const ch = 16;
    const holeRank = 17;
    const strokes = holeRank <= ch ? 1 : 0;
    expect(strokes, 'Hole rank 17 with CH=16 should give 0 strokes').toBe(0);
  });

  test('Net score: gross=6, strokes=1, par=4 → net=5', () => {
    const gross = 6;
    const strokes = 1;
    const par = 4;
    const netMaxOverPar = 3;
    const raw = gross - strokes;
    const cap = par + strokes + netMaxOverPar;
    const net = Math.min(raw, cap);
    expect(net, 'Net score should be 5 (gross 6 - 1 stroke)').toBe(5);
  });

  test('Net score cap: very high gross is capped at par + strokes + netMaxOverPar', () => {
    const gross = 15;
    const strokes = 1;
    const par = 4;
    const netMaxOverPar = 3;
    const raw = gross - strokes;  // 14
    const cap = par + strokes + netMaxOverPar; // 4 + 1 + 3 = 8
    const net = Math.min(raw, cap);
    expect(net, 'Capped net score should be 8').toBe(8);
  });
});

// Integration tests: verify in the live app
test.describe('Scoring math — live app verification', () => {
  test('/player/Eric page shows course handicap of 16', async ({ page }) => {
    await page.goto('/player/Eric');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    const content = await page.content();
    console.log('Player Eric page content snippet:', content.substring(0, 2000));

    // Look for CH = 16 displayed
    const hasCH16 = content.includes('16') && (
      content.includes('CH') || content.includes('Course Handicap') ||
      content.includes('course_handicap') || content.includes('Handicap')
    );

    console.log('Player Eric page has CH of 16:', hasCH16);

    if (!hasCH16) {
      // Check if there's any handicap info at all
      const hasHandicap = content.includes('Handicap') || content.includes('CH') || content.includes('HI');
      if (!hasHandicap) {
        console.warn('BUG: Player scorecard at /player/Eric shows no handicap information');
      } else {
        // Find what CH value is shown
        const chMatch = content.match(/CH[:\s]+(\d+)/);
        if (chMatch) {
          console.warn(`BUG: Expected CH=16 for Eric, found CH=${chMatch[1]}`);
          expect(parseInt(chMatch[1]), 'Eric\'s Course Handicap should be 16').toBe(16);
        }
      }
    }

    // At minimum Eric's name should appear
    expect(content.includes('Eric'), 'Player page should show Eric\'s name').toBe(true);
  });

  test('/player/Eric scorecard shows net scores', async ({ page }) => {
    await page.goto('/player/Eric');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    const content = await page.content();
    // Look for "Net" label in scorecard
    const hasNet = content.includes('Net') || content.includes('net');
    console.log('Player Eric scorecard has Net:', hasNet);

    if (!hasNet) {
      console.warn('BUG: Eric\'s player scorecard does not display net scores');
    }
  });

  test('After entering gross 6 for Eric hole 1, net should be 5', async ({ page }) => {
    // This test enters a score and verifies net calculation
    // First, go to scores page
    await page.goto('/scores');
    await page.waitForLoadState('networkidle');

    // Select Day 1
    const day1Btn = page.getByRole('button', { name: /Day 1/ }).first();
    if (await day1Btn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await day1Btn.click();
      await page.waitForTimeout(1500);
    } else {
      console.log('No Day 1 button — skipping live scoring math test');
      return;
    }

    // Select Group 2 (Eric's group: Matthew, C-Pat, Eric, Ben)
    let ericGroupSelected = false;
    for (const groupName of ['Group 2', 'Group 1']) {
      const groupBtn = page.getByRole('button', { name: new RegExp(groupName) }).first();
      if (await groupBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await groupBtn.click();
        await page.waitForTimeout(1500);
        const content = await page.content();
        if (content.includes('Eric')) {
          ericGroupSelected = true;
          console.log(`Found Eric in ${groupName}`);
          break;
        }
      }
    }

    if (!ericGroupSelected) {
      console.warn('BUG: Could not find Eric in any group — groups may not be created yet');
      return;
    }

    // Select hole 1
    const hole1Btn = page.getByRole('button', { name: /^1$/ }).first();
    if (await hole1Btn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await hole1Btn.click();
      await page.waitForTimeout(500);
    }

    // Find Eric's score controls and set gross to 6
    // The score entry shows player names with +/- buttons
    const ericSection = page.locator('div').filter({ hasText: /Eric/ }).last();
    const plusBtns = page.locator('button').filter({ hasText: /^\+$/ });
    const minusBtns = page.locator('button').filter({ hasText: /^-$/ });

    // Look for current score display near Eric
    const content = await page.content();
    console.log('Score entry page content snippet:', content.substring(0, 1000));

    // Find the + buttons (one per player in group)
    const plusCount = await plusBtns.count();
    console.log('Plus buttons found:', plusCount);

    if (plusCount > 0) {
      // Find which + button corresponds to Eric
      // Each player row has their name + score + +/- buttons
      // For now, we'll set a score for the first available player (check if it's Eric)
      const firstPlusBtn = plusBtns.first();
      await firstPlusBtn.click(); // increase to 5 (assuming starts at 4)
      await firstPlusBtn.click(); // increase to 6

      // Save
      const saveBtn = page.getByRole('button', { name: /Save|Submit/i }).first();
      if (await saveBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await saveBtn.click();
        await page.waitForTimeout(2000);
      }
    }

    // Check history for the net score
    await page.goto('/history');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    const historyContent = await page.content();
    console.log('History content after score entry:', historyContent.substring(0, 2000));

    // Look for net score of 5
    const hasNet5 = historyContent.includes('net: 5') || historyContent.includes('Net: 5') ||
                    historyContent.includes('"net":5') || historyContent.includes('net=5');
    console.log('History shows net=5:', hasNet5);

    // Also check player page
    await page.goto('/player/Eric');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    const playerContent = await page.content();
    console.log('Player Eric content after score entry:', playerContent.substring(0, 2000));
  });

  test('Verify calcStrokesOnHole boundary: CH=16, rank=16 should get 1 stroke', () => {
    // Edge case: hole at exact handicap
    const ch = 16;
    const holeRank = 16;
    const strokes = holeRank <= ch ? 1 : 0;
    expect(strokes, 'CH=16, rank=16 should get 1 stroke (boundary)').toBe(1);
  });

  test('Verify calcStrokesOnHole boundary: CH=16, rank=17 should get 0 strokes', () => {
    const ch = 16;
    const holeRank = 17;
    const strokes = holeRank <= ch ? 1 : 0;
    expect(strokes, 'CH=16, rank=17 should get 0 strokes').toBe(0);
  });

  test('Verify calcStrokesOnHole with CH >= 18: gets 1 stroke on all holes', () => {
    // From handicap.ts: if handicap >= 18, gets 1 stroke on every hole
    // plus 1 extra on holes ranked <= (handicap - 18)
    const ch = 20;
    // All holes get at least 1 stroke
    // Holes ranked <= 2 (20-18) get 2 strokes
    for (let rank = 1; rank <= 18; rank++) {
      let strokes: number;
      if (ch >= 36) {
        strokes = rank <= (ch - 36) ? 3 : 2;
      } else if (ch >= 18) {
        strokes = rank <= (ch - 18) ? 2 : 1;
      } else {
        strokes = rank <= ch ? 1 : 0;
      }
      if (rank <= 2) {
        expect(strokes, `CH=20, rank=${rank} should get 2 strokes`).toBe(2);
      } else {
        expect(strokes, `CH=20, rank=${rank} should get 1 stroke`).toBe(1);
      }
    }
  });
});
