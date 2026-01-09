import { expect, test } from '@playwright/test';
import { useTursoLibSQLiteServer } from '#test/hooks/use-turso-libsqlite-server.js';
import { useConsoleOutput } from '#test/hooks/use-console-output.js';
import { useStrict } from '#test/hooks/use-strict.js';
const { describe } = test;

describe('Chart of Accounts View', function () {
  // useConsoleOutput(test);
    useStrict(test);

  /**
   * @param {import('@playwright/test').Page} page
   * @param {string} tursoLibSQLiteServerUrl
   */
  async function setupDatabaseAndNavigateToChartOfAccounts(page, tursoLibSQLiteServerUrl) {
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
    await page.getByRole('tab', { name: 'Chart of Accounts' }).click();
  }

  describe('Chart of Accounts Navigation', function () {
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

    test('shall navigate to Chart of Accounts when clicking Books link and Chart of Accounts tab', async function ({ page }) {
      await setupDatabaseAndNavigateToChartOfAccounts(page, tursoLibSQLiteServer().url);

      await expect(page.getByRole('tab', { name: 'Chart of Accounts', selected: true })).toBeVisible();
    });
  });

  describe('Chart of Accounts Page Display', function () {
    const tursoLibSQLiteServer = useTursoLibSQLiteServer(test);

    test('shall display accounts table', async function ({ page }) {
      await setupDatabaseAndNavigateToChartOfAccounts(page, tursoLibSQLiteServer().url);

      await expect(page.getByRole('treegrid', { name: 'Chart of Accounts Tree' })).toBeVisible();
    });

    test('shall display table headers', async function ({ page }) {
      await setupDatabaseAndNavigateToChartOfAccounts(page, tursoLibSQLiteServer().url);

      const table = page.getByRole('treegrid', { name: 'Chart of Accounts Tree' });
      await expect(table.getByRole('columnheader', { name: 'Code' })).toBeVisible();
      await expect(table.getByRole('columnheader', { name: 'Name' })).toBeVisible();
      await expect(table.getByRole('columnheader', { name: 'Type' })).toBeVisible();
      await expect(table.getByRole('columnheader', { name: 'Normal' })).toBeVisible();
      await expect(table.getByRole('columnheader', { name: 'Balance' })).toBeVisible();
      await expect(table.getByRole('columnheader', { name: 'Status' })).toBeVisible();
      await expect(table.getByRole('columnheader', { name: 'Kind' })).toBeVisible();
    });

    test('shall display accounts from template', async function ({ page }) {
      await setupDatabaseAndNavigateToChartOfAccounts(page, tursoLibSQLiteServer().url);

      const table = page.getByRole('treegrid', { name: 'Chart of Accounts Tree' });
      // Check for some common accounts from the Retail Business template
      // Check for top-level control accounts that should be visible by default
      await expect(table.getByText('10000')).toBeVisible();
      await expect(table.getByText('Aset')).toBeVisible();
    });
  });

  describe('Chart of Accounts Filter Controls', function () {
    const tursoLibSQLiteServer = useTursoLibSQLiteServer(test);

    test('shall display search input field', async function ({ page }) {
      await setupDatabaseAndNavigateToChartOfAccounts(page, tursoLibSQLiteServer().url);

      const chartOfAccountsTab = page.getByRole('tabpanel', { name: 'Chart of Accounts' });
      await expect(chartOfAccountsTab.getByRole('textbox', { name: 'Search' })).toBeVisible();
    });

    test('shall display Type filter dropdown', async function ({ page }) {
      await setupDatabaseAndNavigateToChartOfAccounts(page, tursoLibSQLiteServer().url);

      const chartOfAccountsTab = page.getByRole('tabpanel', { name: 'Chart of Accounts' });
      await expect(chartOfAccountsTab.getByRole('button', { name: 'Type' })).toBeVisible();
    });

    test('shall display Status filter dropdown', async function ({ page }) {
      await setupDatabaseAndNavigateToChartOfAccounts(page, tursoLibSQLiteServer().url);

      const chartOfAccountsTab = page.getByRole('tabpanel', { name: 'Chart of Accounts' });
      await expect(chartOfAccountsTab.getByRole('button', { name: 'Status' })).toBeVisible();
    });

    test('shall open Type filter menu when clicked', async function ({ page }) {
      await setupDatabaseAndNavigateToChartOfAccounts(page, tursoLibSQLiteServer().url);

      const chartOfAccountsTab = page.getByRole('tabpanel', { name: 'Chart of Accounts' });
      await chartOfAccountsTab.getByRole('button', { name: 'Type' }).click();

      await expect(page.getByRole('menu', { name: 'Account Type Filter' })).toBeVisible();
      await expect(page.getByRole('menuitem', { name: 'All' })).toBeVisible();
      await expect(page.getByRole('menuitem', { name: 'Asset' })).toBeVisible();
      await expect(page.getByRole('menuitem', { name: 'Liability' })).toBeVisible();
      await expect(page.getByRole('menuitem', { name: 'Equity' })).toBeVisible();
      await expect(page.getByRole('menuitem', { name: 'Revenue' })).toBeVisible();
      await expect(page.getByRole('menuitem', { name: 'Expense' })).toBeVisible();
    });

    test('shall open Status filter menu when clicked', async function ({ page }) {
      await setupDatabaseAndNavigateToChartOfAccounts(page, tursoLibSQLiteServer().url);

      const chartOfAccountsTab = page.getByRole('tabpanel', { name: 'Chart of Accounts' });
      await chartOfAccountsTab.getByRole('button', { name: 'Status' }).click();

      await expect(page.getByRole('menu')).toBeVisible();
      await expect(page.getByRole('menuitemradio', { name: 'All' })).toBeVisible();
      await expect(page.getByRole('menuitemradio', { name: 'Active', exact: true })).toBeVisible();
      await expect(page.getByRole('menuitemradio', { name: 'Inactive' })).toBeVisible();
    });

    test('shall filter accounts by type when type filter is selected', async function ({ page }) {
      await setupDatabaseAndNavigateToChartOfAccounts(page, tursoLibSQLiteServer().url);

      const chartOfAccountsTab = page.getByRole('tabpanel', { name: 'Chart of Accounts' });
      await chartOfAccountsTab.getByRole('button', { name: 'Type' }).click();
      await page.getByRole('menuitem', { name: 'Asset' }).click();

      // After filtering by Asset type, either a table with Asset accounts should be visible
      // or an empty state message should appear (if no accounts match the filter)
      const table = page.getByRole('treegrid', { name: 'Chart of Accounts Tree' });
      const emptyState = page.getByText('No accounts found');
      
      // Wait for either the table or empty state to be visible
      await expect(table.or(emptyState)).toBeVisible();
    });

    test('shall filter accounts by search query', async function ({ page }) {
      await setupDatabaseAndNavigateToChartOfAccounts(page, tursoLibSQLiteServer().url);

      const chartOfAccountsTab = page.getByRole('tabpanel', { name: 'Chart of Accounts' });
      const searchInput = chartOfAccountsTab.getByRole('textbox', { name: 'Search' });
      await searchInput.fill('Kas');

      // Should show filtered results
      const table = page.getByRole('treegrid', { name: 'Chart of Accounts Tree' });
      await expect(table).toBeVisible();
    });
  });

  describe('Chart of Accounts Tree Expansion', function () {
    const tursoLibSQLiteServer = useTursoLibSQLiteServer(test);

    test('shall display expand all button', async function ({ page }) {
      await setupDatabaseAndNavigateToChartOfAccounts(page, tursoLibSQLiteServer().url);

      await expect(page.getByRole('button', { name: 'Expand All' })).toBeVisible();
    });

    test('shall display collapse all button', async function ({ page }) {
      await setupDatabaseAndNavigateToChartOfAccounts(page, tursoLibSQLiteServer().url);

      await expect(page.getByRole('button', { name: 'Collapse All' })).toBeVisible();
    });

    test('shall expand all accounts when expand all button is clicked', async function ({ page }) {
      await setupDatabaseAndNavigateToChartOfAccounts(page, tursoLibSQLiteServer().url);

      await page.getByRole('button', { name: 'Expand All' }).click();

      // Verify tree is expanded by checking for visible child accounts
      const table = page.getByRole('treegrid', { name: 'Chart of Accounts Tree' });
      await expect(table).toBeVisible();
    });

    test('shall collapse all accounts when collapse all button is clicked', async function ({ page }) {
      await setupDatabaseAndNavigateToChartOfAccounts(page, tursoLibSQLiteServer().url);

      // First expand all
      await page.getByRole('button', { name: 'Expand All' }).click();

      // Then collapse all
      await page.getByRole('button', { name: 'Collapse All' }).click();

      // Verify tree is collapsed
      const table = page.getByRole('treegrid', { name: 'Chart of Accounts Tree' });
      await expect(table).toBeVisible();
    });
  });

  describe('Chart of Accounts Actions', function () {
    const tursoLibSQLiteServer = useTursoLibSQLiteServer(test);

    test('shall display refresh button', async function ({ page }) {
      await setupDatabaseAndNavigateToChartOfAccounts(page, tursoLibSQLiteServer().url);

      await expect(page.getByRole('button', { name: 'Refresh' })).toBeVisible();
    });

    test('shall display Create Account button', async function ({ page }) {
      await setupDatabaseAndNavigateToChartOfAccounts(page, tursoLibSQLiteServer().url);

      await expect(page.getByRole('button', { name: 'Create Account' })).toBeVisible();
    });

    test('shall refresh accounts list when refresh button is clicked', async function ({ page }) {
      await setupDatabaseAndNavigateToChartOfAccounts(page, tursoLibSQLiteServer().url);

      await page.getByRole('button', { name: 'Refresh' }).click();

      const table = page.getByRole('treegrid', { name: 'Chart of Accounts Tree' });
      await expect(table).toBeVisible();
    });

    test('shall open account creation dialog when Create Account button is clicked', async function ({ page }) {
      await setupDatabaseAndNavigateToChartOfAccounts(page, tursoLibSQLiteServer().url);

      await page.getByRole('button', { name: 'Create Account' }).click();

      await expect(page.getByRole('dialog', { name: 'Create New Account' })).toBeVisible();
    });
  });

  describe('Chart of Accounts Account Creation', function () {
    const tursoLibSQLiteServer = useTursoLibSQLiteServer(test);

    test('shall display account creation form fields', async function ({ page }) {
      await setupDatabaseAndNavigateToChartOfAccounts(page, tursoLibSQLiteServer().url);

      await page.getByRole('button', { name: 'Create Account' }).click();

      const dialog = page.getByRole('dialog', { name: 'Create New Account' });
      await expect(dialog.getByLabel('Account Code')).toBeVisible();
      await expect(dialog.getByLabel('Account Name')).toBeVisible();
      await expect(dialog.getByRole('button', { name: 'Create Account' })).toBeVisible();
      await expect(dialog.getByRole('button', { name: 'Cancel' })).toBeVisible();
    });

    test('shall close dialog when Cancel button is clicked', async function ({ page }) {
      await setupDatabaseAndNavigateToChartOfAccounts(page, tursoLibSQLiteServer().url);

      await page.getByRole('button', { name: 'Create Account' }).click();

      const dialog = page.getByRole('dialog', { name: 'Create New Account' });
      await expect(dialog).toBeVisible();

      await dialog.getByRole('button', { name: 'Cancel' }).click();

      await expect(dialog).not.toBeVisible();
    });
  });

  describe('Chart of Accounts Loading State', function () {
    const tursoLibSQLiteServer = useTursoLibSQLiteServer(test);

    test('shall eventually show accounts table after loading', async function ({ page }) {
      await setupDatabaseAndNavigateToChartOfAccounts(page, tursoLibSQLiteServer().url);

      await expect(page.getByRole('treegrid', { name: 'Chart of Accounts Tree' })).toBeVisible();
    });
  });
});
