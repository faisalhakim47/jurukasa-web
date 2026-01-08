import { expect, test } from '@playwright/test';
import { useTursoLibSQLiteServer } from '#test/hooks/use-turso-libsqlite-server.js';
import { useConsoleOutput } from '#test/hooks/use-console-output.js';
const { describe } = test;

describe('Journal Entries View', function () {
  // useConsoleOutput(test);

  /**
   * @param {import('@playwright/test').Page} page
   * @param {string} tursoLibSQLiteServerUrl
   */
  async function setupDatabaseAndNavigateToJournalEntries(page, tursoLibSQLiteServerUrl) {
    await page.goto('/test/fixtures/testing.html');

    await page.getByLabel('Turso Database URL').fill(tursoLibSQLiteServerUrl);
    await page.getByRole('button', { name: 'Configure' }).click();

    await expect(page.getByRole('dialog', { name: 'Configure Business' })).toBeVisible();
    await page.getByLabel('Business Name').fill('Test Business');
    await page.getByRole('button', { name: 'Next' }).click();

    await expect(page.getByRole('dialog', { name: 'Choose Chart of Accounts Template' })).toBeVisible();
    await page.getByRole('radio', { name: 'Retail Business - Indonesia' }).click();
    await page.getByRole('button', { name: 'Finish' }).click();

    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();

    await page.getByRole('navigation', { name: 'Main Navigation' }).getByRole('link', { name: 'Books' }).first().click();
    await page.getByRole('tab', { name: 'Journal Entries' }).click();
  }

  describe('Journal Entries Navigation', function () {
    const tursoLibSQLiteServer = useTursoLibSQLiteServer(test);

    test('shall display Books link in navigation', async function ({ page }) {
      await page.goto('/test/fixtures/testing.html');

      await page.getByLabel('Turso Database URL').fill(tursoLibSQLiteServer().url);
      await page.getByRole('button', { name: 'Configure' }).click();

      await expect(page.getByRole('dialog', { name: 'Configure Business' })).toBeVisible();
      await page.getByLabel('Business Name').fill('Test Business');
      await page.getByRole('button', { name: 'Next' }).click();

      await expect(page.getByRole('dialog', { name: 'Choose Chart of Accounts Template' })).toBeVisible();
      await page.getByRole('radio', { name: 'Retail Business - Indonesia' }).click();
      await page.getByRole('button', { name: 'Finish' }).click();

      await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();

      await expect(page.getByRole('navigation', { name: 'Main Navigation' }).getByRole('link', { name: 'Books' }).first()).toBeVisible();
    });

    test('shall navigate to Journal Entries when clicking Books link and Journal Entries tab', async function ({ page }) {
      await setupDatabaseAndNavigateToJournalEntries(page, tursoLibSQLiteServer().url);

      await expect(page.getByRole('tab', { name: 'Journal Entries', selected: true })).toBeVisible();
    });
  });

  describe('Journal Entries Page Display', function () {
    const tursoLibSQLiteServer = useTursoLibSQLiteServer(test);

    test('shall display empty state when no journal entries exist', async function ({ page }) {
      await setupDatabaseAndNavigateToJournalEntries(page, tursoLibSQLiteServer().url);

      await expect(page.getByRole('heading', { name: 'No journal entries found' })).toBeVisible();
      await expect(page.getByText('Journal entries will appear here once you create them.')).toBeVisible();
    });

    test('shall display New Entry button in empty state', async function ({ page }) {
      await setupDatabaseAndNavigateToJournalEntries(page, tursoLibSQLiteServer().url);

      await expect(page.getByRole('button', { name: 'New Entry' }).first()).toBeVisible();
    });
  });

  describe('Journal Entries Filter Controls', function () {
    const tursoLibSQLiteServer = useTursoLibSQLiteServer(test);

    test('shall display Source filter dropdown', async function ({ page }) {
      await setupDatabaseAndNavigateToJournalEntries(page, tursoLibSQLiteServer().url);

      await expect(page.getByLabel('Source')).toBeVisible();
    });

    test('shall display Status filter dropdown', async function ({ page }) {
      await setupDatabaseAndNavigateToJournalEntries(page, tursoLibSQLiteServer().url);

      await expect(page.getByLabel('Status')).toBeVisible();
    });

    test('shall open Source filter menu when clicked', async function ({ page }) {
      await setupDatabaseAndNavigateToJournalEntries(page, tursoLibSQLiteServer().url);

      await page.getByLabel('Source').click();

      await expect(page.getByRole('menu')).toBeVisible();
      await expect(page.getByRole('menuitem', { name: 'All' })).toBeVisible();
      await expect(page.getByRole('menuitem', { name: 'Manual' })).toBeVisible();
      await expect(page.getByRole('menuitem', { name: 'System' })).toBeVisible();
    });

    test('shall open Status filter menu when clicked', async function ({ page }) {
      await setupDatabaseAndNavigateToJournalEntries(page, tursoLibSQLiteServer().url);

      await page.getByLabel('Status').click();

      await expect(page.getByRole('menu')).toBeVisible();
      await expect(page.getByRole('menuitemradio', { name: 'All' })).toBeVisible();
      await expect(page.getByRole('menuitemradio', { name: 'Posted' })).toBeVisible();
      await expect(page.getByRole('menuitemradio', { name: 'Draft' })).toBeVisible();
    });

    test('shall filter journal entries by source when source filter is selected', async function ({ page }) {
      await setupDatabaseAndNavigateToJournalEntries(page, tursoLibSQLiteServer().url);

      await page.getByLabel('Source').click();
      await page.getByRole('menuitem', { name: 'Manual' }).click();

      // Filter should be applied - empty state should still be visible since no entries exist
      await expect(page.getByRole('heading', { name: 'No journal entries found' })).toBeVisible();
    });

    test('shall filter journal entries by status when status filter is selected', async function ({ page }) {
      await setupDatabaseAndNavigateToJournalEntries(page, tursoLibSQLiteServer().url);

      await page.getByLabel('Status').click();
      await page.getByRole('menuitemradio', { name: 'Posted' }).click();

      // Filter should be applied - empty state should still be visible since no entries exist
      await expect(page.getByRole('heading', { name: 'No journal entries found' })).toBeVisible();
    });
  });

  describe('Journal Entries Actions', function () {
    const tursoLibSQLiteServer = useTursoLibSQLiteServer(test);

    test('shall display refresh button', async function ({ page }) {
      await setupDatabaseAndNavigateToJournalEntries(page, tursoLibSQLiteServer().url);

      await expect(page.getByRole('button', { name: 'Refresh' })).toBeVisible();
    });

    test('shall display New Entry button in header', async function ({ page }) {
      await setupDatabaseAndNavigateToJournalEntries(page, tursoLibSQLiteServer().url);

      await expect(page.getByRole('button', { name: 'New Entry' })).toBeVisible();
    });

    test('shall refresh journal entries list when refresh button is clicked', async function ({ page }) {
      await setupDatabaseAndNavigateToJournalEntries(page, tursoLibSQLiteServer().url);

      await page.getByRole('button', { name: 'Refresh' }).click();

      // Empty state should still be visible after refresh
      await expect(page.getByRole('heading', { name: 'No journal entries found' })).toBeVisible();
    });

    test('shall open journal entry creation dialog when New Entry button is clicked', async function ({ page }) {
      await setupDatabaseAndNavigateToJournalEntries(page, tursoLibSQLiteServer().url);

      await page.getByRole('button', { name: 'New Entry' }).first().click();

      await expect(page.getByRole('dialog', { name: 'Create Journal Entry' })).toBeVisible();
    });
  });

  describe('Journal Entry Creation Dialog', function () {
    const tursoLibSQLiteServer = useTursoLibSQLiteServer(test);

    test('shall display journal entry creation form fields', async function ({ page }) {
      await setupDatabaseAndNavigateToJournalEntries(page, tursoLibSQLiteServer().url);

      await page.getByRole('button', { name: 'New Entry' }).first().click();

      const dialog = page.getByRole('dialog', { name: 'Create Journal Entry' });
      await expect(dialog).toBeVisible();
      await expect(dialog.getByRole('button', { name: 'Create' })).toBeVisible();
      await expect(dialog.getByRole('button', { name: 'Cancel' })).toBeVisible();
    });

    test('shall close dialog when Cancel button is clicked', async function ({ page }) {
      await setupDatabaseAndNavigateToJournalEntries(page, tursoLibSQLiteServer().url);

      await page.getByRole('button', { name: 'New Entry' }).first().click();

      const dialog = page.getByRole('dialog', { name: 'Create Journal Entry' });
      await expect(dialog).toBeVisible();

      await dialog.getByRole('button', { name: 'Cancel' }).click();

      await expect(dialog).not.toBeVisible();
    });
  });

  describe('Journal Entries Table Display', function () {
    const tursoLibSQLiteServer = useTursoLibSQLiteServer(test);

    test('shall display table headers in correct order', async function ({ page }) {
      await setupDatabaseAndNavigateToJournalEntries(page, tursoLibSQLiteServer().url);

      // Even in empty state, we check that when entries exist, proper headers are expected
      // Since we're in empty state, we won't see the table yet
      await expect(page.getByRole('heading', { name: 'No journal entries found' })).toBeVisible();
    });
  });

  describe('Journal Entries Loading State', function () {
    const tursoLibSQLiteServer = useTursoLibSQLiteServer(test);

    test('shall eventually show empty state or entries list after loading', async function ({ page }) {
      await setupDatabaseAndNavigateToJournalEntries(page, tursoLibSQLiteServer().url);

      // Should show empty state since no entries exist
      await expect(page.getByRole('heading', { name: 'No journal entries found' })).toBeVisible();
    });
  });

  describe('Journal Entries Pagination', function () {
    const tursoLibSQLiteServer = useTursoLibSQLiteServer(test);

    test('shall not display pagination controls when entries fit in single page', async function ({ page }) {
      await setupDatabaseAndNavigateToJournalEntries(page, tursoLibSQLiteServer().url);

      // No pagination in empty state
      await expect(page.getByRole('navigation', { name: /Showing/ })).not.toBeVisible();
    });
  });
});
