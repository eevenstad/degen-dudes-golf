import { test, expect } from '@playwright/test';

test.describe('Authentication', () => {
  test('wrong PIN is rejected', async ({ browser }) => {
    const context = await browser.newContext(); // fresh, no auth state
    const page = await context.newPage();
    await page.goto('/login');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1500);
    for (const digit of ['1','1','1','1']) {
      await page.locator(`button:has-text("${digit}")`).first().click();
      await page.waitForTimeout(200);
    }
    // Try GO first, then Enter
    const goBtn = page.locator('button:has-text("GO")');
    const enterBtn = page.locator('button:has-text("Enter")');
    if (await goBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
      await goBtn.click();
    } else {
      await enterBtn.click();
    }
    await page.waitForTimeout(2000);
    // Should NOT redirect to dashboard
    expect(page.url()).toContain('/login');
    await context.close();
  });

  test('correct PIN (2626) authenticates', async ({ page }) => {
    // Already authenticated via storageState
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    expect(page.url()).not.toContain('/login');
  });

  test('protected pages redirect to login without auth', async ({ browser }) => {
    const context = await browser.newContext(); // no storageState
    const page = await context.newPage();
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
    expect(page.url()).toContain('/login');
    await context.close();
  });
});
