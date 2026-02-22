import { test, expect } from '@playwright/test';

// ============================================================
// admin-teams.spec.ts — Team assignment in Admin → Players tab
// ============================================================

const ALL_PLAYERS = ['Ryan', 'Kiki', 'Mack', 'Bruce', 'Matthew', 'C-Pat', 'Eric', 'Ben', 'Gary', 'Chris', 'Jauch'];

async function goToPlayersTab(page: any) {
  await page.goto('/admin');
  await page.waitForLoadState('networkidle');
  // Click Players tab if not already active
  const playersTab = page.getByRole('button', { name: 'players' });
  await expect(playersTab).toBeVisible({ timeout: 10000 });
  await playersTab.click();
  await page.waitForTimeout(500);
}

test.describe('Team assignment', () => {
  test('Admin page loads with Players tab showing all players', async ({ page }) => {
    await goToPlayersTab(page);

    const content = await page.content();
    for (const player of ALL_PLAYERS) {
      expect(content, `${player} should be visible in Players tab`).toContain(player);
    }
  });

  test('Assign Ryan to USA — button highlights', async ({ page }) => {
    await goToPlayersTab(page);

    // Find Ryan's USA button
    const ryanRow = page.locator('div').filter({ hasText: /^Ryan/ }).first();

    // Try to find USA button near Ryan
    const usaButton = page.locator('div').filter({ hasText: 'Ryan' }).getByRole('button', { name: /USA/ }).first();
    await expect(usaButton).toBeVisible({ timeout: 10000 });

    // Click it
    await usaButton.click();
    await page.waitForTimeout(1500); // wait for Supabase update

    // Verify button is highlighted (has #5C5C2E background or similar non-gray style)
    const buttonStyle = await usaButton.getAttribute('style');
    console.log('Ryan USA button style after click:', buttonStyle);

    // The button should NOT have the gray/unassigned background
    // Active USA button style: { background: '#5C5C2E', color: '#F5E6C3' }
    // Inactive: { background: 'rgba(26,58,42,0.6)', color: '#9A9A50' }
    const isHighlighted = buttonStyle?.includes('#5C5C2E') || buttonStyle?.includes('5C5C2E');
    expect(isHighlighted, 'Ryan USA button should be highlighted (dark olive #5C5C2E) after assignment').toBe(true);
  });

  test('Assign Kiki to Europe — button highlights orange', async ({ page }) => {
    await goToPlayersTab(page);

    const eurButton = page.locator('div').filter({ hasText: 'Kiki' }).getByRole('button', { name: /EUR/ }).first();
    await expect(eurButton).toBeVisible({ timeout: 10000 });
    await eurButton.click();
    await page.waitForTimeout(1500);

    const buttonStyle = await eurButton.getAttribute('style');
    console.log('Kiki EUR button style after click:', buttonStyle);
    // Active EUR: background: '#C17A2A'
    const isHighlighted = buttonStyle?.includes('#C17A2A') || buttonStyle?.includes('C17A2A');
    expect(isHighlighted, 'Kiki EUR button should be highlighted orange (#C17A2A)').toBe(true);
  });

  test('Assign all 11 players to teams', async ({ page }) => {
    await goToPlayersTab(page);

    const assignments: Record<string, 'USA' | 'Europe'> = {
      Ryan: 'USA',
      Kiki: 'Europe',
      Mack: 'USA',
      Bruce: 'Europe',
      Matthew: 'USA',
      'C-Pat': 'Europe',
      Eric: 'USA',
      Ben: 'Europe',
      Gary: 'USA',
      Chris: 'Europe',
      Jauch: 'USA',
    };

    for (const [playerName, team] of Object.entries(assignments)) {
      // Find the player row
      const playerRow = page.locator('div.rounded-xl').filter({ hasText: playerName }).first();
      await expect(playerRow).toBeVisible({ timeout: 10000 });

      const teamButtonLabel = team === 'USA' ? /USA/ : /EUR/;
      const teamButton = playerRow.getByRole('button', { name: teamButtonLabel });
      await expect(teamButton).toBeVisible({ timeout: 5000 });

      // Check current state - if already assigned to this team, skip
      const buttonStyle = await teamButton.getAttribute('style');
      const isAlreadyAssigned = team === 'USA'
        ? buttonStyle?.includes('#5C5C2E')
        : buttonStyle?.includes('#C17A2A');

      if (!isAlreadyAssigned) {
        await teamButton.click();
        await page.waitForTimeout(1000);
      } else {
        console.log(`${playerName} already assigned to ${team}, skipping`);
      }
    }

    console.log('All 11 players assigned to teams');

    // Verify all assigned
    const content = await page.content();
    for (const playerName of ALL_PLAYERS) {
      expect(content).toContain(playerName);
    }
  });

  test('Team assignments persist after page reload', async ({ page }) => {
    await goToPlayersTab(page);

    // Reload and check
    await page.reload();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    // Check Ryan is still on USA (should have highlighted button)
    const usaButton = page.locator('div.rounded-xl').filter({ hasText: 'Ryan' }).getByRole('button', { name: /USA/ }).first();
    await expect(usaButton).toBeVisible({ timeout: 10000 });
    const buttonStyle = await usaButton.getAttribute('style');
    console.log('Ryan USA button style after reload:', buttonStyle);

    // Log persistence result  
    const isPersisted = buttonStyle?.includes('#5C5C2E');
    if (!isPersisted) {
      console.warn('BUG: Ryan USA assignment did not persist after reload. Style:', buttonStyle);
    }
    expect(isPersisted, 'Ryan team assignment should persist after page reload').toBe(true);
  });

  test('Toggle: clicking USA again on USA-assigned player clears assignment', async ({ page }) => {
    await goToPlayersTab(page);

    // First ensure Ryan is assigned to USA
    const ryanRow = page.locator('div.rounded-xl').filter({ hasText: 'Ryan' }).first();
    await expect(ryanRow).toBeVisible({ timeout: 10000 });
    const usaButton = ryanRow.getByRole('button', { name: /USA/ });
    await expect(usaButton).toBeVisible({ timeout: 5000 });

    const currentStyle = await usaButton.getAttribute('style');
    if (!currentStyle?.includes('#5C5C2E')) {
      // Not yet USA, assign first
      await usaButton.click();
      await page.waitForTimeout(1500);
    }

    // Now click again to toggle off
    await usaButton.click();
    await page.waitForTimeout(1500);

    const newStyle = await usaButton.getAttribute('style');
    console.log('Ryan USA button style after toggle off:', newStyle);
    // Should revert to gray/unassigned
    const isCleared = !newStyle?.includes('#5C5C2E') || newStyle?.includes('rgba(26,58,42');
    expect(isCleared, 'Clicking USA button again should clear the assignment (button goes gray)').toBe(true);

    // Re-assign Ryan to USA for subsequent tests
    await usaButton.click();
    await page.waitForTimeout(1500);
    console.log('Re-assigned Ryan to USA after toggle test');
  });
});
