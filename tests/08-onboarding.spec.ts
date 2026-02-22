import { test, expect } from '@playwright/test';

test.describe('Onboarding Modal', () => {
  test('Onboarding shows when no player name in localStorage', async ({ browser }) => {
    const context = await browser.newContext({ storageState: 'tests/.auth/state.json' });
    const page = await context.newPage();
    
    // Clear player name but keep auth
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.evaluate(() => localStorage.removeItem('degen_player_name'));
    await page.reload();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    
    // Onboarding modal should appear (button says "Let's Go →")
    const letsGoBtn = page.locator('button:has-text("Let")').first();
    const isVisible = await letsGoBtn.isVisible({ timeout: 3000 }).catch(() => false);
    expect(isVisible).toBe(true);
    
    await context.close();
  });

  test('Completing onboarding stores player name', async ({ browser }) => {
    const context = await browser.newContext({ storageState: 'tests/.auth/state.json' });
    const page = await context.newPage();
    
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.evaluate(() => localStorage.removeItem('degen_player_name'));
    await page.reload();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    
    // Step 1: click Let's Go (button text is "Let's Go →")
    await page.locator('button:has-text("Let")').first().click();
    await page.waitForTimeout(1000);
    
    // Step 2: select Eric
    await page.locator('button:has-text("Eric")').first().click();
    await page.waitForTimeout(300);
    // Continue button text is "Continue →"
    await page.locator('button:has-text("Continue")').first().click();
    await page.waitForTimeout(1000);
    
    // Step 3: Start Playing
    await page.locator('button:has-text("Start Playing")').first().click();
    await page.waitForTimeout(1000);
    
    const stored = await page.evaluate(() => localStorage.getItem('degen_player_name'));
    expect(stored).toBe('Eric');
    
    await context.close();
  });

  test('Onboarding does NOT appear on /admin', async ({ browser }) => {
    const context = await browser.newContext({ storageState: 'tests/.auth/state.json' });
    const page = await context.newPage();
    
    await page.goto('/admin');
    await page.waitForLoadState('networkidle');
    await page.evaluate(() => localStorage.removeItem('degen_player_name'));
    await page.reload();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    
    // Onboarding should NOT appear on admin
    const letsGoBtn = page.locator('button:has-text("Let")').first();
    const isVisible = await letsGoBtn.isVisible({ timeout: 2000 }).catch(() => false);
    expect(isVisible).toBe(false);
    
    await context.close();
  });
});
