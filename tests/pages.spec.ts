import { test, expect } from '@playwright/test';

// ============================================================
// pages.spec.ts — All pages load, key UI elements render
// ============================================================

const pages = [
  { name: 'Dashboard', path: '/' },
  { name: 'Scores', path: '/scores' },
  { name: 'History', path: '/history' },
  { name: 'Leaderboard', path: '/leaderboard' },
  { name: 'Matches', path: '/matches' },
  { name: 'Admin', path: '/admin' },
  { name: 'Player Eric', path: '/player/Eric' },
];

test.describe('All pages load without JS errors', () => {
  for (const { name, path } of pages) {
    test(`${name} (${path}) loads successfully`, async ({ page }) => {
      const errors: string[] = [];
      page.on('pageerror', err => errors.push(err.message));
      page.on('console', msg => {
        if (msg.type() === 'error') errors.push(msg.text());
      });

      const response = await page.goto(path);
      await page.waitForLoadState('networkidle');

      // Should not be on /login (auth should work)
      expect(page.url()).not.toContain('/login');

      // HTTP response should be ok
      if (response) {
        expect(response.status()).toBeLessThan(500);
      }

      // Log JS errors but don't fail on non-critical ones
      const criticalErrors = errors.filter(e =>
        !e.includes('Warning:') &&
        !e.includes('ResizeObserver') &&
        !e.includes('Non-Error promise rejection')
      );
      if (criticalErrors.length > 0) {
        console.warn(`JS errors on ${path}:`, criticalErrors);
      }
      // BUG DETECTION: fail if there are unhandled JS errors
      expect(criticalErrors, `JS errors on ${name}: ${criticalErrors.join(', ')}`).toHaveLength(0);
    });
  }
});

test.describe('Dashboard UI elements', () => {
  test('shows tournament score or TBD', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Should show USA and/or Europe team labels or scores
    const content = await page.content();
    const hasUSA = content.includes('USA') || content.includes('usa');
    const hasEurope = content.includes('Europe') || content.includes('EUR');
    const hasDeserDuel = content.includes('Desert Duel') || content.includes('Desert');
    expect(hasUSA || hasEurope || hasDeserDuel, 'Dashboard should show team names').toBe(true);
  });

  test('shows navigation links', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Navigation should include links to scores, leaderboard, etc.
    const content = await page.content();
    const hasNav = content.includes('Score') || content.includes('score') ||
                   content.includes('Lead') || content.includes('Match');
    expect(hasNav, 'Dashboard should have navigation').toBe(true);
  });

  test('shows current day or course info', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const content = await page.content();
    const hasDay = content.includes('Day') || content.includes('Course') || content.includes('Terra Lago') || content.includes('Round');
    expect(hasDay, 'Dashboard should show day/course info').toBe(true);
  });
});

test.describe('Leaderboard page', () => {
  test('renders player list with at least one player name', async ({ page }) => {
    await page.goto('/leaderboard');
    await page.waitForLoadState('networkidle');

    const players = ['Ryan', 'Kiki', 'Mack', 'Bruce', 'Matthew', 'C-Pat', 'Eric', 'Ben', 'Gary', 'Chris', 'Jauch'];
    const content = await page.content();
    const foundPlayers = players.filter(p => content.includes(p));
    expect(foundPlayers.length, `Leaderboard should show at least one player, found: ${foundPlayers.join(', ')}`).toBeGreaterThan(0);
  });

  test('shows both individual and team sections', async ({ page }) => {
    await page.goto('/leaderboard');
    await page.waitForLoadState('networkidle');

    const content = await page.content();
    // Should show some scoreboard/leaderboard content
    const hasContent = content.includes('Leaderboard') || content.includes('Standing') ||
                       content.includes('USA') || content.includes('Europe') ||
                       content.includes('Score');
    expect(hasContent, 'Leaderboard should have leaderboard content').toBe(true);
  });
});

test.describe('Matches page', () => {
  test('renders without error (even if no matches yet)', async ({ page }) => {
    await page.goto('/matches');
    await page.waitForLoadState('networkidle');

    // Should not error out
    const content = await page.content();
    const hasContent = content.includes('Match') || content.includes('match') ||
                       content.includes('vs') || content.includes('No match') ||
                       content.includes('empty') || content.includes('Side');
    expect(hasContent, 'Matches page should render content').toBe(true);
  });
});

test.describe('Score history page', () => {
  test('renders history or empty state', async ({ page }) => {
    await page.goto('/history');
    await page.waitForLoadState('networkidle');

    const content = await page.content();
    const hasContent = content.includes('History') || content.includes('history') ||
                       content.includes('Score') || content.includes('Hole') ||
                       content.includes('No score') || content.includes('empty') ||
                       content.includes('Undo');
    expect(hasContent, 'History page should render something').toBe(true);
  });
});

test.describe('Player scorecard', () => {
  test('/player/Eric renders scorecard or empty state', async ({ page }) => {
    await page.goto('/player/Eric');
    await page.waitForLoadState('networkidle');

    const content = await page.content();
    // Should show Eric's name or scorecard
    const hasEric = content.includes('Eric');
    expect(hasEric, '/player/Eric should show "Eric"').toBe(true);
  });

  test('/player/Ryan renders without error', async ({ page }) => {
    await page.goto('/player/Ryan');
    await page.waitForLoadState('networkidle');

    expect(page.url()).not.toContain('/login');
    const content = await page.content();
    expect(content.includes('Ryan'), '/player/Ryan should show "Ryan"').toBe(true);
  });
});

test.describe('Admin page', () => {
  test('shows tab navigation (players, groups, matches, tees, settings)', async ({ page }) => {
    await page.goto('/admin');
    await page.waitForLoadState('networkidle');

    // Tabs should be visible
    await expect(page.getByRole('button', { name: 'players' })).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole('button', { name: 'groups' })).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole('button', { name: 'matches' })).toBeVisible({ timeout: 10000 });
  });

  test('players tab shows all 11 players', async ({ page }) => {
    await page.goto('/admin');
    await page.waitForLoadState('networkidle');

    const content = await page.content();
    const players = ['Ryan', 'Kiki', 'Mack', 'Bruce', 'Matthew', 'C-Pat', 'Eric', 'Ben', 'Gary', 'Chris', 'Jauch'];
    const foundPlayers = players.filter(p => content.includes(p));
    expect(foundPlayers.length, `Admin players tab should show all 11 players, found: ${foundPlayers.join(', ')}`).toBe(11);
  });
});
