import { test, expect } from '@playwright/test';

test.describe('Page load checks', () => {
  const pages = [
    { path: '/', name: 'Dashboard' },
    { path: '/scores', name: 'Scores' },
    { path: '/history', name: 'History' },
    { path: '/leaderboard', name: 'Leaderboard' },
    { path: '/matches', name: 'Matches' },
    { path: '/admin', name: 'Admin' },
    { path: '/player/Eric', name: 'Player Scorecard' },
  ];

  for (const { path, name } of pages) {
    test(`${name} page loads without error`, async ({ page }) => {
      const errors: string[] = [];
      page.on('pageerror', err => errors.push(err.message));
      
      await page.goto(path);
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(2000);
      
      // If onboarding modal shows, dismiss it
      const skipBtn = page.locator('button:has-text("Skip")').first();
      if (await skipBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
        await skipBtn.click();
        await page.waitForTimeout(500);
      }
      
      expect(errors).toHaveLength(0);
      expect(page.url()).not.toContain('/login');
    });
  }

  test('Dashboard shows navigation', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    
    // Nav should have Scores, Leaderboard, Matches, Admin
    await expect(page.locator('text=Scores')).toBeVisible();
    await expect(page.locator('text=Admin')).toBeVisible();
  });

  test('Leaderboard shows players', async ({ page }) => {
    await page.goto('/leaderboard');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);
    
    // At least one player name should appear
    const playerNames = ['Eric', 'Ryan', 'Ben', 'Kiki'];
    let found = false;
    for (const name of playerNames) {
      if (await page.locator(`text=${name}`).first().isVisible({ timeout: 1000 }).catch(() => false)) {
        found = true;
        break;
      }
    }
    expect(found).toBe(true);
  });
});
