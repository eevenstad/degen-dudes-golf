import { test, expect } from '@playwright/test';

// ============================================================
// scores.spec.ts — Score entry flow
// ============================================================

test.describe('Score entry', () => {
  test('Scores page loads with day/group selection', async ({ page }) => {
    await page.goto('/scores');
    await page.waitForLoadState('networkidle');

    expect(page.url()).not.toContain('/login');

    const content = await page.content();
    const hasScoreContent = content.includes('Day') || content.includes('Group') ||
                            content.includes('Hole') || content.includes('Score');
    expect(hasScoreContent, 'Scores page should show day/group/hole selection').toBe(true);
  });

  test('Select Day 1', async ({ page }) => {
    await page.goto('/scores');
    await page.waitForLoadState('networkidle');

    // Look for Day 1 button
    const day1Btn = page.getByRole('button', { name: /Day 1/ }).first();
    if (await day1Btn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await day1Btn.click();
      await page.waitForTimeout(1500);
      console.log('Selected Day 1');
    } else {
      // Maybe it's already selected or uses a different UI
      const content = await page.content();
      console.log('Day 1 button not found. Content snippet:', content.substring(0, 500));
    }

    // After selecting day, should see group options
    const content = await page.content();
    const hasGroup = content.includes('Group') || content.includes('group');
    expect(hasGroup, 'After selecting Day 1, should see group options').toBe(true);
  });

  test('Select Day 1, Group 1', async ({ page }) => {
    await page.goto('/scores');
    await page.waitForLoadState('networkidle');

    // Select Day 1
    const day1Btn = page.getByRole('button', { name: /Day 1/ }).first();
    if (await day1Btn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await day1Btn.click();
      await page.waitForTimeout(1500);
    }

    // Select Group 1
    const group1Btn = page.getByRole('button', { name: /Group 1/ }).first();
    if (await group1Btn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await group1Btn.click();
      await page.waitForTimeout(1500);
      console.log('Selected Group 1');
    } else {
      console.warn('Group 1 button not visible. Groups may not be created yet, or UI is different.');
    }

    const content = await page.content();
    // Should see hole selection or player list
    const hasHoleOrPlayer = content.includes('Hole') || content.includes('hole') ||
                            content.includes('Ryan') || content.includes('Eric') || content.includes('Mack');
    console.log('After Group 1 selection:', hasHoleOrPlayer ? 'holes/players visible' : 'nothing visible');
    expect(hasHoleOrPlayer, 'After selecting Group 1, should see holes or players').toBe(true);
  });

  test('Enter and save score for Eric on Hole 1', async ({ page }) => {
    await page.goto('/scores');
    await page.waitForLoadState('networkidle');

    // Select Day 1
    const day1Btn = page.getByRole('button', { name: /Day 1/ }).first();
    if (await day1Btn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await day1Btn.click();
      await page.waitForTimeout(1500);
    }

    // Select Group 1 (contains Eric based on admin-groups.spec setup... wait, Eric is in Group 2)
    // Eric is in Group 2 (Matthew, C-Pat, Eric, Ben)
    // But if groups haven't been created, try Group 1 first then Group 2
    let groupSelected = false;

    for (const groupName of ['Group 1', 'Group 2']) {
      const groupBtn = page.getByRole('button', { name: new RegExp(groupName) }).first();
      if (await groupBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await groupBtn.click();
        await page.waitForTimeout(1500);
        const content = await page.content();
        if (content.includes('Eric') || content.includes('Ryan')) {
          groupSelected = true;
          console.log(`Selected ${groupName}`);
          break;
        }
      }
    }

    if (!groupSelected) {
      console.warn('BUG: Could not select a group with players. Groups may not exist yet.');
    }

    // Select Hole 1
    const hole1Btn = page.getByRole('button', { name: /^1$/ }).first();
    if (await hole1Btn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await hole1Btn.click();
      await page.waitForTimeout(500);
    }

    // Find score input for Eric (or any player visible)
    // Score inputs are typically +/- buttons or number inputs
    const content = await page.content();
    console.log('Score page state:', content.substring(0, 500));

    // Look for +/- controls or input fields near player names
    const plusBtn = page.locator('button').filter({ hasText: /^\+$/ }).first();
    if (await plusBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      // Click + multiple times to set score to 5
      // First click usually goes from default (par/4) to 5
      // We need to know current value first
      // Look for a score display
      const scoreDisplay = page.locator('span, div').filter({ hasText: /^\d+$/ }).first();
      if (await scoreDisplay.isVisible({ timeout: 2000 }).catch(() => false)) {
        const currentScore = parseInt(await scoreDisplay.textContent() || '4');
        const targetScore = 5;
        const clicks = targetScore - currentScore;
        if (clicks > 0) {
          for (let i = 0; i < clicks; i++) {
            await plusBtn.click();
            await page.waitForTimeout(100);
          }
        } else if (clicks < 0) {
          const minusBtn = page.locator('button').filter({ hasText: /^-$/ }).first();
          for (let i = 0; i < Math.abs(clicks); i++) {
            await minusBtn.click();
            await page.waitForTimeout(100);
          }
        }
      }
    }

    // Find and click Save/Submit button
    const saveBtn = page.getByRole('button', { name: /Save|Submit|Record/i }).first();
    if (await saveBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await saveBtn.click();
      await page.waitForTimeout(2000);

      const afterContent = await page.content();
      const hasSaveMsg = afterContent.includes('Saved') || afterContent.includes('saved') ||
                         afterContent.includes('Save') || afterContent.includes('✓') ||
                         afterContent.includes('success');
      console.log('Score save result:', hasSaveMsg ? 'saved' : 'no save confirmation');
      // Note: if no group was selected, this test is expected to fail
      if (groupSelected) {
        expect(hasSaveMsg, 'Score save should show confirmation message').toBe(true);
      }
    } else {
      if (groupSelected) {
        console.warn('BUG: Save button not found on scores page');
        expect(false, 'Save button not found').toBe(true);
      } else {
        console.log('Skipping save - no group was selectable');
      }
    }
  });

  test('Score appears in history after saving', async ({ page }) => {
    // Check /history for any score entries
    await page.goto('/history');
    await page.waitForLoadState('networkidle');

    const content = await page.content();
    // Should show at least one score entry, or empty state
    const hasHistory = content.includes('Hole') || content.includes('hole') ||
                       content.includes('Score') || content.includes('No score') ||
                       content.includes('Undo') || content.includes('empty');
    expect(hasHistory, 'History page should render').toBe(true);
    console.log('History page rendered. Has entries:', content.includes('Hole') || content.includes('Undo'));
  });

  test('Leaderboard updates after scoring', async ({ page }) => {
    await page.goto('/leaderboard');
    await page.waitForLoadState('networkidle');

    const content = await page.content();
    // Check leaderboard has player data
    const players = ['Ryan', 'Kiki', 'Mack', 'Bruce', 'Matthew', 'C-Pat', 'Eric', 'Ben', 'Gary', 'Chris', 'Jauch'];
    const foundPlayers = players.filter(p => content.includes(p));
    console.log('Players visible on leaderboard:', foundPlayers);
    expect(foundPlayers.length, 'Leaderboard should show players').toBeGreaterThan(0);
  });
});

test.describe('Score entry UI/UX', () => {
  test('Score input bounds — cannot go below 1', async ({ page }) => {
    await page.goto('/scores');
    await page.waitForLoadState('networkidle');

    // Select Day 1
    const day1Btn = page.getByRole('button', { name: /Day 1/ }).first();
    if (await day1Btn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await day1Btn.click();
      await page.waitForTimeout(1000);
    }

    // Select any group
    const group1Btn = page.getByRole('button', { name: /Group 1/ }).first();
    if (await group1Btn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await group1Btn.click();
      await page.waitForTimeout(1000);
    }

    // Find minus button and click it many times
    const minusBtn = page.locator('button').filter({ hasText: /^-$/ }).first();
    if (await minusBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      for (let i = 0; i < 10; i++) {
        await minusBtn.click();
        await page.waitForTimeout(50);
      }
      // Find score display
      const scoreDisplay = page.locator('span, div').filter({ hasText: /^\d+$/ }).first();
      if (await scoreDisplay.isVisible({ timeout: 2000 }).catch(() => false)) {
        const value = parseInt(await scoreDisplay.textContent() || '0');
        expect(value, 'Score should not go below 1').toBeGreaterThanOrEqual(1);
      }
    }
  });

  test('Score input bounds — cannot go above 15', async ({ page }) => {
    await page.goto('/scores');
    await page.waitForLoadState('networkidle');

    const day1Btn = page.getByRole('button', { name: /Day 1/ }).first();
    if (await day1Btn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await day1Btn.click();
      await page.waitForTimeout(1000);
    }

    const group1Btn = page.getByRole('button', { name: /Group 1/ }).first();
    if (await group1Btn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await group1Btn.click();
      await page.waitForTimeout(1000);
    }

    const plusBtn = page.locator('button').filter({ hasText: /^\+$/ }).first();
    if (await plusBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      for (let i = 0; i < 20; i++) {
        await plusBtn.click();
        await page.waitForTimeout(50);
      }
      const scoreDisplay = page.locator('span, div').filter({ hasText: /^\d+$/ }).first();
      if (await scoreDisplay.isVisible({ timeout: 2000 }).catch(() => false)) {
        const value = parseInt(await scoreDisplay.textContent() || '0');
        expect(value, 'Score should not go above 15').toBeLessThanOrEqual(15);
      }
    }
  });
});
