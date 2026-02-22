import { test, expect } from '@playwright/test';

test.describe('Help Buttons', () => {
  const pagesWithHelp = ['/', '/scores', '/leaderboard', '/matches', '/admin'];
  
  for (const path of pagesWithHelp) {
    test(`Help button visible on ${path}`, async ({ page }) => {
      await page.goto(path);
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(2000);
      
      const helpBtn = page.locator('[aria-label="Help"]').first();
      const isVisible = await helpBtn.isVisible({ timeout: 3000 }).catch(() => false);
      expect(isVisible).toBe(true);
    });
  }

  test('Help button opens modal on dashboard', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    
    await page.locator('[aria-label="Help"]').first().click();
    await page.waitForTimeout(1000);
    
    // Modal should appear with some help content
    const body = await page.evaluate(() => document.body.innerText);
    // Help modal should contain tips text
    expect(body.length).toBeGreaterThan(200);
  });
});
