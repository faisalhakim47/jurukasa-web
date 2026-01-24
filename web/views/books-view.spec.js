import { expect, test } from '@playwright/test';
import { useTursoLibSQLiteServer } from '#test/playwright/hooks/use-turso-libsqlite-server.js';
import { loadEmptyFixture } from '#test/playwright/tools/fixture.js';
import { setupDatabase } from '#test/playwright/tools/database.js';
import { bypassForbiddenLocator, useStrict } from '#test/playwright/hooks/use-strict.js';

const { describe } = test;

/** @param {string} tursoDatabaseUrl */
async function setupView(tursoDatabaseUrl) {
  window.history.replaceState({}, '', '/books/journal-entries');
  document.body.innerHTML = `
    <ready-context>
      <time-context>
        <router-context>
          <database-context provider="turso" turso-url=${tursoDatabaseUrl}>
            <device-context>
              <i18n-context>
                <books-view></books-view>
              </i18n-context>
            </device-context>
          </database-context>
        </router-context>
      </time-context>
    </ready-context>
  `;
}

/** @param {string} tursoDatabaseUrl */
async function setupViewWithChartOfAccounts(tursoDatabaseUrl) {
  window.history.replaceState({}, '', '/books/chart-of-accounts');
  document.body.innerHTML = `
    <ready-context>
      <time-context>
        <router-context>
          <database-context provider="turso" turso-url=${tursoDatabaseUrl}>
            <device-context>
              <i18n-context>
                <books-view></books-view>
              </i18n-context>
            </device-context>
          </database-context>
        </router-context>
      </time-context>
    </ready-context>
  `;
}

describe('Journal Entries', function () {
  useStrict(test);

  const tursoLibSQLiteServer = useTursoLibSQLiteServer(test);

  describe('Journal Entries List', function () {
    test('shall display empty state when no entries exist', async function ({ page }) {
      await Promise.all([
        loadEmptyFixture(page),
        setupDatabase(tursoLibSQLiteServer(), async function setupData() {}),
      ]);

      await page.evaluate(setupView, tursoLibSQLiteServer().url);

      await expect(page.getByRole('heading', { name: 'Accounting' })).toBeVisible();
      await expect(page.getByRole('tab', { name: 'Journal Entries' })).toHaveAttribute('aria-selected', 'true');
      await expect(page.getByRole('heading', { name: 'No journal entries found' })).toBeVisible();
      await expect(page.getByText('Journal entries will appear here once you create them.')).toBeVisible();
    });

    test('shall display New Entry button in empty state', async function ({ page }) {
      await Promise.all([
        loadEmptyFixture(page),
        setupDatabase(tursoLibSQLiteServer(), async function setupData() {}),
      ]);

      await page.evaluate(setupView, tursoLibSQLiteServer().url);

      await expect(page.getByRole('button', { name: 'New Entry' }).first()).toBeVisible();
    });

    test('shall have filters for source type and status', async function ({ page }) {
      await Promise.all([
        loadEmptyFixture(page),
        setupDatabase(tursoLibSQLiteServer(), async function setupData() {}),
      ]);

      await page.evaluate(setupView, tursoLibSQLiteServer().url);

      const journalEntriesPanel = page.getByRole('tabpanel', { name: 'Journal Entries' });
      await expect(journalEntriesPanel.getByLabel('Source', { exact: true })).toBeVisible();
      await expect(journalEntriesPanel.getByLabel('Status', { exact: true })).toBeVisible();
    });

    test('shall have refresh button in header', async function ({ page }) {
      await Promise.all([
        loadEmptyFixture(page),
        setupDatabase(tursoLibSQLiteServer(), async function setupData() {}),
      ]);

      await page.evaluate(setupView, tursoLibSQLiteServer().url);

      const journalEntriesPanel = page.getByRole('tabpanel', { name: 'Journal Entries' });
      await expect(journalEntriesPanel.getByRole('button', { name: 'Refresh' })).toBeVisible();
    });
  });

  describe('Tab Navigation', function () {
    test('shall show Journal Entries tab as selected by default', async function ({ page }) {
      await Promise.all([
        loadEmptyFixture(page),
        setupDatabase(tursoLibSQLiteServer(), async function setupData() {}),
      ]);

      await page.evaluate(setupView, tursoLibSQLiteServer().url);

      await expect(page.getByRole('tab', { name: 'Journal Entries' })).toHaveAttribute('aria-selected', 'true');
      await expect(page.getByRole('tab', { name: 'Chart of Accounts' })).toHaveAttribute('aria-selected', 'false');
      await expect(page.getByRole('tab', { name: 'Reports' })).toHaveAttribute('aria-selected', 'false');
    });

    test('shall switch to Chart of Accounts tab when clicked', async function ({ page }) {
      await Promise.all([
        loadEmptyFixture(page),
        setupDatabase(tursoLibSQLiteServer(), async function setupData() {}),
      ]);

      await page.evaluate(setupView, tursoLibSQLiteServer().url);

      await page.getByRole('tab', { name: 'Chart of Accounts' }).click();

      await expect(page.getByRole('tab', { name: 'Chart of Accounts' })).toHaveAttribute('aria-selected', 'true');
      await expect(page.getByRole('tab', { name: 'Journal Entries' })).toHaveAttribute('aria-selected', 'false');
      await expect(page.getByRole('treegrid', { name: 'Chart of Accounts' })).toBeVisible();
    });

    test('shall switch to Reports tab when clicked', async function ({ page }) {
      await Promise.all([
        loadEmptyFixture(page),
        setupDatabase(tursoLibSQLiteServer(), async function setupData() {}),
      ]);

      await page.evaluate(setupView, tursoLibSQLiteServer().url);

      await page.getByRole('tab', { name: 'Reports' }).click();

      await expect(page.getByRole('tab', { name: 'Reports' })).toHaveAttribute('aria-selected', 'true');
      await expect(page.getByRole('tab', { name: 'Journal Entries' })).toHaveAttribute('aria-selected', 'false');

      await expect(page.getByRole('button', { name: 'Generate Report' })).toHaveCount(2);
    });
  });
});

describe('Chart of Accounts', function () {
  useStrict(test);

  const tursoLibSQLiteServer = useTursoLibSQLiteServer(test);

  describe('Chart of Accounts Display', function () {
    test('shall display Chart of Accounts treegrid', async function ({ page }) {
      await Promise.all([
        loadEmptyFixture(page),
        setupDatabase(tursoLibSQLiteServer(), async function setupData() {}),
      ]);

      await page.evaluate(setupViewWithChartOfAccounts, tursoLibSQLiteServer().url);

      await expect(page.getByRole('treegrid', { name: 'Chart of Accounts' })).toBeVisible();
    });

    test('shall display accounts from Retail Business - Indonesia template', async function ({ page }) {
      await Promise.all([
        loadEmptyFixture(page),
        setupDatabase(tursoLibSQLiteServer(), async function setupData() {}),
      ]);

      await page.evaluate(setupViewWithChartOfAccounts, tursoLibSQLiteServer().url);

      await expect(page.getByRole('treegrid', { name: 'Chart of Accounts' })).toBeVisible();

      // Verify some top-level accounts from the template are displayed
      await expect(page.getByRole('row', { name: 'Aset' })).toBeVisible();
      await expect(page.getByRole('row', { name: 'Liabilitas' })).toBeVisible();
      await expect(page.getByRole('row', { name: 'Ekuitas' })).toBeVisible();
      await expect(page.getByRole('row', { name: 'Expand Pendapatan Pendapatan — Cr IDR 0 Active Control' })).toBeVisible();
    });

    test('shall display account type tags', async function ({ page }) {
      await Promise.all([
        loadEmptyFixture(page),
        setupDatabase(tursoLibSQLiteServer(), async function setupData() {}),
      ]);

      await page.evaluate(setupViewWithChartOfAccounts, tursoLibSQLiteServer().url);

      await page.getByRole('button', { name: 'Expand all accounts' }).click();

      await expect(page.getByRole('columnheader', { name: 'Type' })).toBeVisible();
    });

    test('shall display column headers in table', async function ({ page }) {
      await Promise.all([
        loadEmptyFixture(page),
        setupDatabase(tursoLibSQLiteServer(), async function setupData() {}),
      ]);

      await page.evaluate(setupViewWithChartOfAccounts, tursoLibSQLiteServer().url);

      await expect(page.getByRole('columnheader', { name: 'Code' })).toBeVisible();
      await expect(page.getByRole('columnheader', { name: 'Name' })).toBeVisible();
      await expect(page.getByRole('columnheader', { name: 'Type' })).toBeVisible();
      await expect(page.getByRole('columnheader', { name: 'Normal' })).toBeVisible();
      await expect(page.getByRole('columnheader', { name: 'Balance' })).toBeVisible();
      await expect(page.getByRole('columnheader', { name: 'Status' })).toBeVisible();
      await expect(page.getByRole('columnheader', { name: 'Kind' })).toBeVisible();
    });
  });

  describe('Chart of Accounts Filtering', function () {
    test('shall have search input for filtering accounts', async function ({ page }) {
      await Promise.all([
        loadEmptyFixture(page),
        setupDatabase(tursoLibSQLiteServer(), async function setupData() {}),
      ]);

      await page.evaluate(setupViewWithChartOfAccounts, tursoLibSQLiteServer().url);

      const chartOfAccountsPanel = page.getByRole('tabpanel', { name: 'Chart of Accounts' });
      await expect(chartOfAccountsPanel.getByLabel('Search', { exact: true })).toBeVisible();
    });

    test('shall filter accounts by search query', async function ({ page }) {
      await Promise.all([
        loadEmptyFixture(page),
        setupDatabase(tursoLibSQLiteServer(), async function setupData() {}),
      ]);

      await page.evaluate(setupViewWithChartOfAccounts, tursoLibSQLiteServer().url);

      const chartOfAccountsPanel = page.getByRole('treegrid', { name: 'Chart of Accounts' });
      await expect(chartOfAccountsPanel).toBeVisible();

      // 1 Header + 7 root parent accounts
      await expect(chartOfAccountsPanel.getByRole('row')).toHaveCount(8);

      await page.getByRole('textbox', { name: 'Search', exact: true }).fill('Kas & Bank');

      // 1 Header + 1 filtered account
      await expect(chartOfAccountsPanel.getByRole('row')).toHaveCount(2);
    });

    test('shall have type filter dropdown', async function ({ page }) {
      await Promise.all([
        loadEmptyFixture(page),
        setupDatabase(tursoLibSQLiteServer(), async function setupData() {}),
      ]);

      await page.evaluate(setupViewWithChartOfAccounts, tursoLibSQLiteServer().url);

      const chartOfAccountsPanel = page.getByRole('tabpanel', { name: 'Chart of Accounts' });
      await expect(chartOfAccountsPanel.getByLabel('Type', { exact: true })).toBeVisible();
    });

    test('shall filter accounts by type', async function ({ page }) {
      await Promise.all([
        loadEmptyFixture(page),
        setupDatabase(tursoLibSQLiteServer(), async function setupData() {}),
      ]);

      await page.evaluate(setupViewWithChartOfAccounts, tursoLibSQLiteServer().url);

      const chartOfAccountsPanel = page.getByRole('tabpanel', { name: 'Chart of Accounts' });

      await chartOfAccountsPanel.getByLabel('Type', { exact: true }).click();

      const typeMenu = page.getByRole('menu', { name: 'Account type filter' });
      await expect(typeMenu).toBeVisible();

      // Click Asset option using keyboard navigation for stability
      await page.keyboard.press('ArrowDown'); // All -> Asset
      await page.keyboard.press('Enter');

      await expect(page.getByRole('treegrid', { name: 'Chart of Accounts' })).toBeVisible();
    });

    test('shall have status filter dropdown', async function ({ page }) {
      await Promise.all([
        loadEmptyFixture(page),
        setupDatabase(tursoLibSQLiteServer(), async function setupData() {}),
      ]);

      await page.evaluate(setupViewWithChartOfAccounts, tursoLibSQLiteServer().url);

      const chartOfAccountsPanel = page.getByRole('tabpanel', { name: 'Chart of Accounts' });
      await expect(chartOfAccountsPanel.getByLabel('Status')).toBeVisible();
    });
  });

  describe('Chart of Accounts Hierarchy', function () {
    test('shall display expand/collapse buttons', async function ({ page }) {
      await Promise.all([
        loadEmptyFixture(page),
        setupDatabase(tursoLibSQLiteServer(), async function setupData() {}),
      ]);

      await page.evaluate(setupViewWithChartOfAccounts, tursoLibSQLiteServer().url);

      await expect(page.getByRole('button', { name: 'Expand all accounts' })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Collapse all accounts' })).toBeVisible();
    });

    test('shall expand all accounts when expand all button is clicked', async function ({ page }) {
      await Promise.all([
        loadEmptyFixture(page),
        setupDatabase(tursoLibSQLiteServer(), async function setupData() {}),
      ]);

      await page.evaluate(setupViewWithChartOfAccounts, tursoLibSQLiteServer().url);

      await expect(page.getByRole('treegrid', { name: 'Chart of Accounts' })).toBeVisible();
      await page.getByRole('button', { name: 'Expand all accounts' }).click();

      await expect(page.getByRole('row', { name: 'Aset Lancar' })).toBeVisible();
    });

    test('shall collapse all accounts when collapse all button is clicked', async function ({ page }) {
      await Promise.all([
        loadEmptyFixture(page),
        setupDatabase(tursoLibSQLiteServer(), async function setupData() {}),
      ]);

      await page.evaluate(setupViewWithChartOfAccounts, tursoLibSQLiteServer().url);

      await expect(page.getByRole('treegrid', { name: 'Chart of Accounts' })).toBeVisible();
      await page.getByRole('button', { name: 'Expand all accounts' }).click();

      await expect(page.getByRole('row', { name: 'Aset Lancar' })).toBeVisible();

      await page.getByRole('button', { name: 'Collapse all accounts' }).click();

      await expect(page.getByRole('row', { name: 'Aset Lancar' })).not.toBeVisible();
    });

    test('shall toggle expand/collapse when clicking on parent account row', async function ({ page }) {
      await Promise.all([
        loadEmptyFixture(page),
        setupDatabase(tursoLibSQLiteServer(), async function setupData() {}),
      ]);

      await page.evaluate(setupViewWithChartOfAccounts, tursoLibSQLiteServer().url);

      const coaTree = page.getByRole('treegrid', { name: 'Chart of Accounts' });
      await expect(coaTree).toBeVisible();

      await coaTree.getByRole('button', { name: 'Expand Aset', exact: true }).click();
      await expect(coaTree.getByRole('button', { name: 'Expand Aset Lancar' })).toBeVisible();

      await coaTree.getByRole('button', { name: 'Collapse Aset', exact: true }).click();
      await expect(coaTree.getByRole('button', { name: 'Expand Aset Lancar' })).not.toBeVisible();
    });
  });

  describe('Chart of Accounts Actions', function () {
    test('shall have refresh button', async function ({ page }) {
      await Promise.all([
        loadEmptyFixture(page),
        setupDatabase(tursoLibSQLiteServer(), async function setupData() {}),
      ]);

      await page.evaluate(setupViewWithChartOfAccounts, tursoLibSQLiteServer().url);

      await expect(page.getByRole('button', { name: 'Refresh accounts' })).toBeVisible();
    });

    test('shall reload accounts when refresh button is clicked', async function ({ page }) {
      await Promise.all([
        loadEmptyFixture(page),
        setupDatabase(tursoLibSQLiteServer(), async function setupData() {}),
      ]);

      await page.evaluate(setupViewWithChartOfAccounts, tursoLibSQLiteServer().url);

      await page.getByRole('button', { name: 'Refresh accounts' }).click();

      await expect(page.getByRole('treegrid', { name: 'Chart of Accounts' })).toBeVisible();
      await expect(page.getByRole('row', { name: 'Aset' })).toBeVisible();
    });
  });
});
