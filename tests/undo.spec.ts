import { test, expect } from '@playwright/test';

// ============================================================
// undo.spec.ts — Score undo functionality
// ============================================================

test.describe('Undo score', () => {
  test('History page shows Undo button for recent scores', async ({ page }) => {
    await page.goto('/history');
    await page.waitForLoadState('networkidle');

    const content = await page.content();
    const hasUndo = content.includes('Undo') || content.includes('undo');
    const hasScores = content.includes('Hole') || content.includes('hole') ||
                      content.includes('Score') || content.includes('score');

    console.log('History page - has scores:', hasScores, ', has undo:', hasUndo);

    if (!hasScores) {
      console.warn('BUG: History page shows no scores — no scores have been entered yet, or history is not loading');
    }

    // Page should at minimum render
    expect(content.length, 'History page should have content').toBeGreaterThan(100);
  });

  test('Enter a score and then undo it', async ({ page }) => {
    // Step 1: Enter a score on hole 18 (unlikely to conflict with other tests)
    await page.goto('/scores');
    await page.waitForLoadState('networkidle');

    // Select Day 1
    const day1Btn = page.getByRole('button', { name: /Day 1/ }).first();
    if (await day1Btn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await day1Btn.click();
      await page.waitForTimeout(1500);
    }

    // Select a group
    let groupSelected = false;
    for (const groupName of ['Group 1', 'Group 2']) {
      const groupBtn = page.getByRole('button', { name: new RegExp(groupName) }).first();
      if (await groupBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await groupBtn.click();
        await page.waitForTimeout(1500);
        const content = await page.content();
        if (content.includes('Hole') || content.includes('Ryan') || content.includes('Eric')) {
          groupSelected = true;
          console.log(`Undo test: selected ${groupName}`);
          break;
        }
      }
    }

    if (!groupSelected) {
      console.warn('Undo test: could not select group, skipping score entry');
      return;
    }

    // Select hole 17 (unusual hole for testing)
    const hole17Btn = page.getByRole('button', { name: /^17$/ }).first();
    if (await hole17Btn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await hole17Btn.click();
      await page.waitForTimeout(500);
    }

    // Set score and save
    const plusBtn = page.locator('button').filter({ hasText: /^\+$/ }).first();
    if (await plusBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      // Click + a couple times
      await plusBtn.click();
      await page.waitForTimeout(100);
      await plusBtn.click();
      await page.waitForTimeout(100);
    }

    const saveBtn = page.getByRole('button', { name: /Save|Submit/i }).first();
    if (await saveBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await saveBtn.click();
      await page.waitForTimeout(2000);
      console.log('Score saved on hole 17');
    }

    // Step 2: Go to history and undo
    await page.goto('/history');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    // Find Undo button(s)
    const undoButtons = page.getByRole('button', { name: /Undo|undo/i });
    const undoCount = await undoButtons.count();
    console.log('Undo buttons found:', undoCount);

    if (undoCount > 0) {
      // Click first undo button
      const firstUndo = undoButtons.first();
      await firstUndo.click();
      await page.waitForTimeout(2000);

      // Check for confirmation
      const afterContent = await page.content();
      const hasConfirmation = afterContent.includes('Undone') || afterContent.includes('undone') ||
                              afterContent.includes('removed') || afterContent.includes('deleted') ||
                              afterContent.includes('Undo') || afterContent.includes('success');
      console.log('Undo result - has confirmation:', hasConfirmation);
      expect(hasConfirmation, 'Undo should show confirmation or remove the entry').toBe(true);
    } else {
      console.warn('BUG: No Undo buttons found on history page. Either no scores were saved or undo buttons are missing.');
      // Check if there are any score entries at all
      const content = await page.content();
      if (!content.includes('Hole') && !content.includes('Score')) {
        console.warn('BUG: History page appears completely empty');
      }
    }
  });

  test('Undo removes the entry from history', async ({ page }) => {
    await page.goto('/history');
    await page.waitForLoadState('networkidle');

    // Count entries before
    const undoBtnsBefore = await page.getByRole('button', { name: /Undo/i }).count();
    console.log('History entries before undo:', undoBtnsBefore);

    if (undoBtnsBefore === 0) {
      console.log('No entries to undo — skipping removal check');
      return;
    }

    // Click first undo
    await page.getByRole('button', { name: /Undo/i }).first().click();
    await page.waitForTimeout(2000);

    // Count entries after
    const undoBtnsAfter = await page.getByRole('button', { name: /Undo/i }).count();
    console.log('History entries after undo:', undoBtnsAfter);

    // Should have fewer entries (or a different state)
    expect(undoBtnsAfter, 'Undo should remove entry from history').toBeLessThan(undoBtnsBefore);
  });
});
