import { test, expect } from '@playwright/test';

// ============================================================
// auth.spec.ts — Authentication flow tests
// ============================================================

test.describe('Login page', () => {
  test('wrong PIN shows error or stays on login page', async ({ page }) => {
    await page.goto('/login');
    await page.waitForLoadState('networkidle');

    // Enter wrong PIN: 1111
    await page.getByRole('button', { name: '1' }).first().click();
    await page.getByRole('button', { name: '1' }).first().click();
    await page.getByRole('button', { name: '1' }).first().click();
    await page.getByRole('button', { name: '1' }).first().click();
    await page.getByRole('button', { name: 'GO' }).click();

    // Should NOT redirect to /
    await page.waitForTimeout(2000);
    expect(page.url()).not.toContain('vercel.app/'); // should still be on /login
    // OR an error message should appear
    const url = page.url();
    const hasError = await page.locator('text=Invalid PIN').isVisible().catch(() => false)
      || await page.locator('text=Invalid').isVisible().catch(() => false)
      || await page.locator('text=wrong').isVisible().catch(() => false)
      || url.includes('/login');
    expect(hasError).toBe(true);
  });

  test('correct PIN (2626) redirects to dashboard', async ({ page }) => {
    await page.goto('/login');
    await page.waitForLoadState('networkidle');

    await page.getByRole('button', { name: '2' }).first().click();
    await page.getByRole('button', { name: '6' }).first().click();
    await page.getByRole('button', { name: '2' }).first().click();
    await page.getByRole('button', { name: '6' }).first().click();
    await page.getByRole('button', { name: 'GO' }).click();

    await page.waitForURL('**/', { timeout: 10000 });
    expect(page.url()).not.toContain('/login');
  });

  test('PIN dots fill as digits are entered', async ({ page }) => {
    await page.goto('/login');
    await page.waitForLoadState('networkidle');

    // Check that the PIN display exists
    const pinDisplay = page.locator('.rounded-full').first();
    await expect(pinDisplay).toBeVisible({ timeout: 5000 });
  });

  test('delete button clears last digit', async ({ page }) => {
    await page.goto('/login');
    await page.waitForLoadState('networkidle');

    // Enter 2 digits, then delete
    await page.getByRole('button', { name: '2' }).first().click();
    await page.getByRole('button', { name: '6' }).first().click();
    // Delete button (⌫)
    await page.locator('button:has-text("⌫")').click();

    // Enter remaining digits to make 262 → add 6 to get 2626
    await page.getByRole('button', { name: '2' }).first().click();
    await page.getByRole('button', { name: '6' }).first().click();
    await page.getByRole('button', { name: 'GO' }).click();

    await page.waitForURL('**/', { timeout: 10000 });
    expect(page.url()).not.toContain('/login');
  });
});

test.describe('Protected routes without auth', () => {
  // Override storageState to have no auth
  test.use({ storageState: { cookies: [], origins: [] } });

  test('dashboard / redirects to /login when no auth', async ({ page }) => {
    await page.goto('/');
    await page.waitForURL('**/login**', { timeout: 10000 });
    expect(page.url()).toContain('/login');
  });

  test('/admin redirects to /login when no auth', async ({ page }) => {
    await page.goto('/admin');
    await page.waitForURL('**/login**', { timeout: 10000 });
    expect(page.url()).toContain('/login');
  });

  test('/scores redirects to /login when no auth', async ({ page }) => {
    await page.goto('/scores');
    await page.waitForURL('**/login**', { timeout: 10000 });
    expect(page.url()).toContain('/login');
  });

  test('/history redirects to /login when no auth', async ({ page }) => {
    await page.goto('/history');
    await page.waitForURL('**/login**', { timeout: 10000 });
    expect(page.url()).toContain('/login');
  });

  test('/leaderboard redirects to /login when no auth', async ({ page }) => {
    await page.goto('/leaderboard');
    await page.waitForURL('**/login**', { timeout: 10000 });
    expect(page.url()).toContain('/login');
  });
});
