import { test, expect } from '@playwright/test';

test.describe('Admin — Groups', () => {
  test('Create Day 1 Group 1 with 4 players', async ({ page }) => {
    await page.goto('/admin');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    
    // Click Groups tab
    await page.locator('button:has-text("groups")').click();
    await page.waitForTimeout(1000);
    
    // Click + New Group
    await page.locator('button:has-text("+ New Group")').click();
    await page.waitForTimeout(500);
    
    // Day 1 should be default; Group 1 default; Format default
    // Select players: Ryan, Kiki, Mack, Bruce
    for (const name of ['Ryan', 'Kiki', 'Mack', 'Bruce']) {
      await page.locator(`button:has-text("${name}")`).first().click();
      await page.waitForTimeout(300);
    }
    
    // Submit
    await page.locator('button:has-text("Create Group")').click();
    await page.waitForTimeout(3000);
    
    // Should see success message
    const body = await page.evaluate(() => document.body.innerText);
    expect(body).toMatch(/Group created|created|success/i);
  });

  test('Create Day 1 Group 2', async ({ page }) => {
    await page.goto('/admin');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    
    await page.locator('button:has-text("groups")').click();
    await page.waitForTimeout(1000);
    
    await page.locator('button:has-text("+ New Group")').click();
    await page.waitForTimeout(500);
    
    // Set Group # to 2
    await page.locator('select').nth(1).selectOption('2');
    
    // Select Matthew, C-Pat, Eric, Ben
    for (const name of ['Matthew', 'C-Pat', 'Eric', 'Ben']) {
      await page.locator(`button:has-text("${name}")`).first().click();
      await page.waitForTimeout(300);
    }
    
    await page.locator('button:has-text("Create Group")').click();
    await page.waitForTimeout(3000);
    
    const body = await page.evaluate(() => document.body.innerText);
    expect(body).toMatch(/Group created|created|success/i);
  });

  test('Create Day 1 Group 3 (3 players)', async ({ page }) => {
    await page.goto('/admin');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    
    await page.locator('button:has-text("groups")').click();
    await page.waitForTimeout(1000);
    
    await page.locator('button:has-text("+ New Group")').click();
    await page.waitForTimeout(500);
    
    await page.locator('select').nth(1).selectOption('3');
    
    for (const name of ['Gary', 'Chris', 'Jauch']) {
      await page.locator(`button:has-text("${name}")`).first().click();
      await page.waitForTimeout(300);
    }
    
    await page.locator('button:has-text("Create Group")').click();
    await page.waitForTimeout(3000);
    
    const body = await page.evaluate(() => document.body.innerText);
    expect(body).toMatch(/Group created|created|success/i);
  });

  test('Load groups and verify they appear', async ({ page }) => {
    await page.goto('/admin');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    
    await page.locator('button:has-text("groups")').click();
    await page.waitForTimeout(1000);
    
    // Click Load Groups for Day 1
    await page.locator('button:has-text("Load Groups")').first().click();
    await page.waitForTimeout(3000);
    
    const body = await page.evaluate(() => document.body.innerText);
    expect(body).toContain('Group 1');
    expect(body).toContain('Group 2');
    expect(body).toContain('Group 3');
  });
});
