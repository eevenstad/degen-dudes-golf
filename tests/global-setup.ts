import { chromium } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

export default async function globalSetup() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  
  // Step 1: Authenticate with PIN 2626
  await page.goto('https://degen-dudes-golf.vercel.app/login');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(2000);
  
  // Click PIN digits - find buttons by text content
  // Try both "Enter" and "GO" button names
  for (const digit of ['2', '6', '2', '6']) {
    const btn = page.locator(`button:has-text("${digit}")`).first();
    await btn.click();
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
  
  await page.waitForURL('**/', { timeout: 15000 });
  console.log('Global setup: authenticated, at', page.url());
  
  // Step 2: Set player name in localStorage to skip onboarding
  await page.evaluate(() => {
    localStorage.setItem('degen_player_name', 'Eric');
  });
  
  // Step 3: Save auth state
  fs.mkdirSync(path.join('tests', '.auth'), { recursive: true });
  await context.storageState({ path: 'tests/.auth/state.json' });
  await browser.close();
  
  console.log('Global setup: Auth + localStorage set successfully');
}
