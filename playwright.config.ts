import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests',
  testMatch: /\d\d-.*\.spec\.ts/,
  timeout: 60000,
  globalSetup: './tests/global-setup.ts',
  use: {
    baseURL: 'https://degen-dudes-golf.vercel.app',
    headless: true,
    storageState: 'tests/.auth/state.json',
  },
  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }],
  // Run tests sequentially (not parallel) — admin setup must run before score tests
  workers: 1,
});
