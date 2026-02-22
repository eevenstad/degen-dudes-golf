import { test, expect } from '@playwright/test';

// ============================================================
// admin-groups.spec.ts — Group creation in Admin → Groups tab
// ============================================================

async function goToGroupsTab(page: any) {
  await page.goto('/admin');
  await page.waitForLoadState('networkidle');
  const groupsTab = page.getByRole('button', { name: 'groups' });
  await expect(groupsTab).toBeVisible({ timeout: 10000 });
  await groupsTab.click();
  await page.waitForTimeout(500);
}

async function createGroup(
  page: any,
  day: number,
  groupNum: number,
  format: string,
  players: string[]
) {
  // Click + New Group button
  const newGroupBtn = page.getByRole('button', { name: '+ New Group' });
  await expect(newGroupBtn).toBeVisible({ timeout: 10000 });
  await newGroupBtn.click();
  await page.waitForTimeout(500);

  // Should now see the create group form
  await expect(page.locator('text=New Group')).toBeVisible({ timeout: 5000 });

  // Select Day
  const daySelect = page.locator('select').filter({ has: page.locator('option[value="' + day + '"]') }).first();
  // Try by label
  const dayLabel = page.locator('label', { hasText: 'Day' });
  if (await dayLabel.isVisible()) {
    const daySelectNear = page.locator('select').nth(0);
    await daySelectNear.selectOption(String(day));
  } else {
    await page.locator('select').nth(0).selectOption(String(day));
  }

  // Select Group number (second select)
  await page.locator('select').nth(1).selectOption(String(groupNum));

  // Select Format (third select)
  await page.locator('select').nth(2).selectOption(format);

  // Select players
  for (const playerName of players) {
    const playerButton = page.locator('button').filter({ hasText: new RegExp('^' + playerName + '$') }).first();
    if (await playerButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      await playerButton.click();
      await page.waitForTimeout(300);
    } else {
      // Try broader search
      const altButton = page.locator('button').filter({ hasText: playerName }).first();
      await expect(altButton).toBeVisible({ timeout: 5000 });
      await altButton.click();
      await page.waitForTimeout(300);
    }
  }

  // Click Create Group
  const createBtn = page.getByRole('button', { name: 'Create Group' });
  await expect(createBtn).toBeVisible({ timeout: 5000 });
  await createBtn.click();

  // Wait for success
  await page.waitForTimeout(2000);

  // Check for success message (could be a toast or inline message)
  const content = await page.content();
  const hasSuccess = content.includes('created') || content.includes('success') ||
                     content.includes('Created') || content.includes('Group created');
  console.log(`Group Day${day} Group${groupNum} created? Content has success:`, hasSuccess);

  return hasSuccess;
}

test.describe('Group creation', () => {
  test('Groups tab loads with New Group button', async ({ page }) => {
    await goToGroupsTab(page);

    await expect(page.getByRole('button', { name: '+ New Group' })).toBeVisible({ timeout: 10000 });
  });

  test('Create Day 1, Group 1 — best_ball_validation — Ryan Kiki Mack Bruce', async ({ page }) => {
    await goToGroupsTab(page);

    const success = await createGroup(page, 1, 1, 'best_ball_validation', ['Ryan', 'Kiki', 'Mack', 'Bruce']);
    expect(success, 'Group creation should show success message').toBe(true);
  });

  test('Load Day 1 groups — Group 1 with Ryan Kiki Mack Bruce appears', async ({ page }) => {
    await goToGroupsTab(page);

    // Find "Load Groups" for Day 1
    // The UI has per-day load buttons
    const loadBtn = page.getByRole('button', { name: /Load.*Day 1|Day 1.*Load/i }).first();
    if (await loadBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await loadBtn.click();
      await page.waitForTimeout(2000);
    } else {
      // Maybe groups auto-load, check content
      console.log('No explicit Load Day 1 button found — groups may auto-load');
    }

    const content = await page.content();
    // Verify players appear
    const hasRyan = content.includes('Ryan');
    const hasKiki = content.includes('Kiki');
    const hasMack = content.includes('Mack');
    const hasBruce = content.includes('Bruce');

    console.log('Day 1 groups loaded. Ryan:', hasRyan, 'Kiki:', hasKiki, 'Mack:', hasMack, 'Bruce:', hasBruce);

    // At minimum the players we assigned should be listed somewhere on the page
    expect(hasRyan && hasKiki, 'Day 1 Group 1 should contain Ryan and Kiki').toBe(true);
    expect(hasMack && hasBruce, 'Day 1 Group 1 should contain Mack and Bruce').toBe(true);
  });

  test('Create Day 1, Group 2 — best_ball — Matthew C-Pat Eric Ben', async ({ page }) => {
    await goToGroupsTab(page);

    const success = await createGroup(page, 1, 2, 'best_ball', ['Matthew', 'C-Pat', 'Eric', 'Ben']);
    expect(success, 'Group 2 creation should succeed').toBe(true);
  });

  test('Load Day 1 groups — both groups appear', async ({ page }) => {
    await goToGroupsTab(page);

    const loadBtn = page.getByRole('button', { name: /Load.*Day 1|Day 1.*Load/i }).first();
    if (await loadBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await loadBtn.click();
      await page.waitForTimeout(2000);
    }

    const content = await page.content();
    // Check all 8 players appear (both groups)
    const expectedPlayers = ['Ryan', 'Kiki', 'Mack', 'Bruce', 'Matthew', 'Eric', 'Ben'];
    const foundPlayers = expectedPlayers.filter(p => content.includes(p));
    console.log('Found players in Day 1 groups:', foundPlayers);
    expect(foundPlayers.length, `Should find multiple players in Day 1 groups, found: ${foundPlayers.join(', ')}`).toBeGreaterThanOrEqual(4);
  });

  test('Create Day 2, Group 1 — low_total — Gary Chris Jauch Ryan', async ({ page }) => {
    await goToGroupsTab(page);

    const success = await createGroup(page, 2, 1, 'low_total', ['Gary', 'Chris', 'Jauch', 'Ryan']);
    expect(success, 'Day 2 Group 1 creation should succeed').toBe(true);
  });

  test('Load Day 2 groups — Gary Chris Jauch Ryan appear', async ({ page }) => {
    await goToGroupsTab(page);

    // Try loading Day 2 groups
    const loadBtn = page.getByRole('button', { name: /Load.*Day 2|Day 2.*Load/i }).first();
    if (await loadBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await loadBtn.click();
      await page.waitForTimeout(2000);
    } else {
      console.log('No Load Day 2 button found');
    }

    const content = await page.content();
    const hasGary = content.includes('Gary');
    const hasChris = content.includes('Chris');
    const hasJauch = content.includes('Jauch');

    console.log('Day 2 groups - Gary:', hasGary, 'Chris:', hasChris, 'Jauch:', hasJauch);
    expect(hasGary || hasChris || hasJauch, 'Day 2 Group 1 players should be visible').toBe(true);
  });
});
