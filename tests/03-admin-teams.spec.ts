import { test, expect } from '@playwright/test';

test.describe('Admin — Team Assignments', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/admin');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    // Ensure we're on Players tab (default)
  });

  test('Players tab shows all 11 players', async ({ page }) => {
    const players = ['Ryan', 'Kiki', 'Mack', 'Bruce', 'Matthew', 'C-Pat', 'Eric', 'Ben', 'Gary', 'Chris', 'Jauch'];
    for (const player of players) {
      await expect(page.locator(`text=${player}`).first()).toBeVisible();
    }
  });

  test('Assign Ryan to USA — button highlights immediately', async ({ page }) => {
    // Find Ryan's row and click USA
    // Players are in order; find the first USA button
    const usaButtons = page.locator('button:has-text("🫡 USA")');
    const firstUSA = usaButtons.first();
    await firstUSA.click();
    await page.waitForTimeout(1500);
    
    // The button should now have the active olive green background (#5C5C2E)
    // Check style attribute changes — active button has background:#5C5C2E
    const style = await firstUSA.getAttribute('style');
    expect(style).toContain('#5C5C2E');
  });

  test('Assign all players to teams', async ({ page }) => {
    // USA: Ryan, Mack, Matthew, Eric, Gary, Jauch (indices 0,2,4,6,8,10 = 0-based)
    // Europe: Kiki, Bruce, C-Pat, Ben, Chris (indices 1,3,5,7,9)
    const usaButtons = page.locator('button:has-text("🫡 USA")');
    const eurButtons = page.locator('button:has-text("🌍 EUR")');
    const count = await usaButtons.count();
    
    for (let i = 0; i < count; i++) {
      if (i % 2 === 0) {
        await usaButtons.nth(i).click();
      } else {
        await eurButtons.nth(i).click();
      }
      await page.waitForTimeout(800);
    }
    
    // Verify some are highlighted
    await page.waitForTimeout(1000);
    const activeUSA = page.locator('button:has-text("🫡 USA")[style*="#5C5C2E"]');
    const count2 = await activeUSA.count();
    expect(count2).toBeGreaterThan(0);
  });

  test('Team assignments persist after reload', async ({ page }) => {
    // Reload and check assignments still there
    await page.reload();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    
    // At least some should be highlighted
    const activeUSA = page.locator('button[style*="#5C5C2E"]');
    const activeEUR = page.locator('button[style*="#C17A2A"]');
    const usaCount = await activeUSA.count();
    const eurCount = await activeEUR.count();
    expect(usaCount + eurCount).toBeGreaterThan(0);
  });
});
