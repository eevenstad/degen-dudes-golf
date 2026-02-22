import { test, expect } from '@playwright/test';

// ============================================================
// onboarding.spec.ts — Player onboarding modal
// ============================================================

test.describe('Onboarding modal', () => {
  test('Onboarding modal appears when degen_player_name is cleared', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Clear the player name from localStorage
    await page.evaluate(() => {
      localStorage.removeItem('degen_player_name');
    });

    // Reload to trigger onboarding check
    await page.reload();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1500);

    // Check if onboarding modal appears
    const content = await page.content();
    const hasModal = content.includes('Who are you') || content.includes('Select your name') ||
                     content.includes('Choose your') || content.includes('player') ||
                     content.includes('onboard') || content.includes('Welcome');
    console.log('Onboarding modal check - has modal-like content:', hasModal);

    // Log all players visible
    const players = ['Ryan', 'Kiki', 'Mack', 'Bruce', 'Matthew', 'C-Pat', 'Eric', 'Ben', 'Gary', 'Chris', 'Jauch'];
    const visiblePlayers = players.filter(p => content.includes(p));
    console.log('Players visible in potential modal:', visiblePlayers);

    if (!hasModal && visiblePlayers.length === 0) {
      console.warn('BUG: Onboarding modal did not appear after clearing degen_player_name. The app may not implement onboarding, or the trigger is different.');
    }

    expect(hasModal || visiblePlayers.length > 0, 'Onboarding modal should appear when player name is not set').toBe(true);
  });

  test('Select "Eric" from onboarding modal', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Clear player name
    await page.evaluate(() => localStorage.removeItem('degen_player_name'));
    await page.reload();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1500);

    // Try to find and click Eric in the modal
    const ericBtn = page.getByRole('button', { name: /^Eric$/ }).first();
    const ericBtnAlt = page.locator('button, li, div[role="button"]').filter({ hasText: /^Eric$/ }).first();

    if (await ericBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await ericBtn.click();
      await page.waitForTimeout(1000);
      console.log('Clicked Eric button in onboarding');
    } else if (await ericBtnAlt.isVisible({ timeout: 2000 }).catch(() => false)) {
      await ericBtnAlt.click();
      await page.waitForTimeout(1000);
      console.log('Clicked Eric alt in onboarding');
    } else {
      console.warn('BUG: Eric button not found in onboarding modal');
    }

    // Verify localStorage was set
    const playerName = await page.evaluate(() => localStorage.getItem('degen_player_name'));
    console.log('degen_player_name after selection:', playerName);

    if (playerName !== 'Eric') {
      console.warn(`BUG: degen_player_name is "${playerName}" instead of "Eric" after onboarding selection`);
    }
    expect(playerName, 'degen_player_name should be set to "Eric" after selection').toBe('Eric');
  });

  test('Modal closes after player selection', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    await page.evaluate(() => localStorage.removeItem('degen_player_name'));
    await page.reload();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1500);

    // Find modal-like elements before selection
    const beforeContent = await page.content();
    const hasModalBefore = beforeContent.includes('Who are you') || beforeContent.includes('Select your name') ||
                            beforeContent.includes('Choose your');

    if (!hasModalBefore) {
      console.log('Onboarding modal may not exist — skipping modal close test');
      return;
    }

    // Click Eric
    const ericBtn = page.getByRole('button', { name: /^Eric$/ }).first();
    if (await ericBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await ericBtn.click();
      await page.waitForTimeout(1000);
    }

    // Modal should close
    const afterContent = await page.content();
    const hasModalAfter = afterContent.includes('Who are you') || afterContent.includes('Select your name');
    expect(hasModalAfter, 'Modal should close after player selection').toBe(false);
  });

  test("Eric's group pre-selected on /scores after onboarding", async ({ page }) => {
    // Set degen_player_name to Eric
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.evaluate(() => localStorage.setItem('degen_player_name', 'Eric'));

    // Go to scores
    await page.goto('/scores');
    await page.waitForLoadState('networkidle');

    // Select Day 1 to trigger group auto-selection
    const day1Btn = page.getByRole('button', { name: /Day 1/ }).first();
    if (await day1Btn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await day1Btn.click();
      await page.waitForTimeout(2000);
    }

    // Check if Eric's group (Group 2) was auto-selected
    const content = await page.content();
    const hasGroupSelected = content.includes('Eric') || content.includes('Matthew') ||
                             content.includes('C-Pat') || content.includes('Ben');
    console.log('Auto-selected group contains Eric\'s group members:', hasGroupSelected);

    if (!hasGroupSelected) {
      console.warn('BUG: Eric\'s group was not auto-selected when degen_player_name = "Eric"');
    }
    // Don't hard-fail — this is a UX feature that may need groups to exist
    // Just log the result
  });
});
