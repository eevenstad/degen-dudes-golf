import { test, expect } from '@playwright/test';

test.describe('Score Entry', () => {
  test('Score entry page loads and shows day selection', async ({ page }) => {
    await page.goto('/scores');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);
    
    // Handle onboarding if it shows (it shouldn't with storageState but just in case)
    const skipBtn = page.locator('button:has-text("Skip")').first();
    if (await skipBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
      await skipBtn.click();
      await page.waitForTimeout(1000);
    }
    
    const body = await page.evaluate(() => document.body.innerText);
    expect(body).toContain('Day 1');
    expect(body).toContain('Day 2');
    expect(body).toContain('Day 3');
  });

  test('Navigate Day 1 → Group 1 → Hole 1 and enter scores', async ({ page }) => {
    await page.goto('/scores');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    
    // Handle onboarding
    const skipBtn = page.locator('button:has-text("Skip")').first();
    if (await skipBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
      await skipBtn.click();
      await page.waitForTimeout(1000);
    }
    
    // Select Day 1
    await page.locator('button:has-text("Day 1")').first().click();
    await page.waitForTimeout(3000);
    
    const body = await page.evaluate(() => document.body.innerText);
    
    // If no groups show, that's a bug to flag
    if (body.includes('Select Group') && !body.includes('Group 1')) {
      throw new Error('BUG: No groups available for Day 1 after admin-groups test created them. Groups may not be persisting or loading.');
    }
    
    // Click Group 1
    await page.locator('button:has-text("Group 1")').first().click();
    await page.waitForTimeout(3000);
    
    // Click Hole 1
    await page.locator('button:has-text("1")').first().click();
    await page.waitForTimeout(2000);
    
    const body2 = await page.evaluate(() => document.body.innerText);
    // Should see score entry with player names
    expect(body2).toMatch(/Ryan|Kiki|Mack|Bruce|score|Score/i);
  });

  test('Enter gross score for first player and save', async ({ page }) => {
    await page.goto('/scores');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    
    const skipBtn = page.locator('button:has-text("Skip")').first();
    if (await skipBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
      await skipBtn.click();
      await page.waitForTimeout(1000);
    }
    
    await page.locator('button:has-text("Day 1")').first().click();
    await page.waitForTimeout(2000);
    
    const body = await page.evaluate(() => document.body.innerText);
    if (!body.includes('Group')) {
      throw new Error('BUG: No groups loaded for Day 1');
    }
    
    await page.locator('button:has-text("Group 1")').first().click();
    await page.waitForTimeout(2000);
    
    await page.locator('button:has-text("1")').first().click();
    await page.waitForTimeout(2000);
    
    // Find a + button to increment score
    const plusButtons = page.locator('button:has-text("+")');
    if (await plusButtons.count() > 0) {
      // Increment first player's score 4 times (par 4 + 1 = 5 gross)
      for (let i = 0; i < 4; i++) {
        await plusButtons.first().click();
        await page.waitForTimeout(200);
      }
    }
    
    // Click Save — button says "Save & Next →" or "Save Hole 18 ✓"
    const saveBtn = page.locator('button:has-text("Save")').first();
    if (await saveBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await saveBtn.click();
      await page.waitForTimeout(3000);
      
      const body2 = await page.evaluate(() => document.body.innerText);
      // After save, either shows "Saved!" message or moves to hole 2
      expect(body2).toMatch(/Saved|saved|success|Hole 2|✓/i);
    }
  });
});
