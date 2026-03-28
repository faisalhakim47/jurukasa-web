import { expect } from '@playwright/test';
import { useTursoLibSQLiteServer } from '#test/playwright/hooks/use-turso-libsqlite-server.js';
import { loadEmptyFixture } from '#test/playwright/tools/fixture.js';
import { setupDatabase } from '#test/playwright/tools/database.js';
import { jurukasaTest } from '#test/playwright/test-setup.js';
import { useStrict } from '#test/playwright/hooks/use-strict.js';
import { useConsoleOutput } from '#test/playwright/hooks/use-console-output.js';

const test = jurukasaTest;
const { describe } = test;

/** @param {string} tursoDatabaseUrl */
async function setupView(tursoDatabaseUrl) {
  window.history.replaceState({}, '', '/books/journal-entries');
  document.body.innerHTML = `
    <ready-context>
      <time-context>
        <router-context>
          <database-context provider="turso" name="My Business" turso-url=${tursoDatabaseUrl}>
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
          <database-context provider="turso" name="My Business" turso-url=${tursoDatabaseUrl}>
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

describe('Books View', function () {
  useConsoleOutput(test);
  useStrict(test);
  const tursoLibSQLiteServer = useTursoLibSQLiteServer(test);

  test('view Journal Entries tab with empty state and filters', async function ({ page }) {
    await Promise.all([
      loadEmptyFixture(page),
      setupDatabase(tursoLibSQLiteServer(), async function setupData() {}),
    ]);

    await page.evaluate(setupView, tursoLibSQLiteServer().url);

    await expect(page.getByRole('heading', { name: 'Accounting' }), 'it shall display Accounting heading').toBeVisible();
    await expect(page.getByRole('tab', { name: 'Journal Entries' }), 'it shall show Journal Entries tab as selected by default').toHaveAttribute('aria-selected', 'true');
    await expect(page.getByRole('heading', { name: 'No journal entries found' }), 'it shall display empty state heading when no entries exist').toBeVisible();
    await expect(page.getByText('Journal entries will appear here once you create them.'), 'it shall display empty state description').toBeVisible();
    await expect(page.getByRole('button', { name: 'New Entry' }).first(), 'it shall display New Entry button in empty state').toBeVisible();

    const journalEntriesPanel = page.getByRole('tabpanel', { name: 'Journal Entries' });
    await expect(journalEntriesPanel.getByLabel('Source', { exact: true }), 'it shall have Source filter dropdown').toBeVisible();
    await expect(journalEntriesPanel.getByLabel('Status', { exact: true }), 'it shall have Status filter dropdown').toBeVisible();
    await expect(journalEntriesPanel.getByRole('button', { name: 'Refresh' }), 'it shall have refresh button in header').toBeVisible();
  });

  test('switch between tabs', async function ({ page }) {
    await Promise.all([
      loadEmptyFixture(page),
      setupDatabase(tursoLibSQLiteServer(), async function setupData() {}),
    ]);

    await page.evaluate(setupView, tursoLibSQLiteServer().url);

    await expect(page.getByRole('tab', { name: 'Journal Entries' }), 'it shall have Journal Entries tab').toHaveAttribute('aria-selected', 'true');
    await expect(page.getByRole('tab', { name: 'Chart of Accounts' }), 'it shall have Chart of Accounts tab unselected initially').toHaveAttribute('aria-selected', 'false');
    await expect(page.getByRole('tab', { name: 'Reports' }), 'it shall have Reports tab unselected initially').toHaveAttribute('aria-selected', 'false');
    await expect(page.getByRole('tab', { name: 'Fiscal Years' }), 'it shall have Fiscal Years tab unselected initially').toHaveAttribute('aria-selected', 'false');
    await expect(page.getByRole('tab', { name: 'Fixed Assets' }), 'it shall have Fixed Assets tab unselected initially').toHaveAttribute('aria-selected', 'false');

    await page.getByRole('tab', { name: 'Chart of Accounts' }).click();
    await expect(page.getByRole('tab', { name: 'Chart of Accounts' }), 'it shall select Chart of Accounts tab when clicked').toHaveAttribute('aria-selected', 'true');
    await expect(page.getByRole('tab', { name: 'Journal Entries' }), 'it shall deselect Journal Entries tab when Chart of Accounts is selected').toHaveAttribute('aria-selected', 'false');
    await expect(page.getByRole('treegrid', { name: 'Chart of Accounts' }), 'it shall display Chart of Accounts treegrid when tab is selected').toBeVisible();

    await page.getByRole('tab', { name: 'Reports' }).click();
    await expect(page.getByRole('tab', { name: 'Reports' }), 'it shall select Reports tab when clicked').toHaveAttribute('aria-selected', 'true');
    await expect(page.getByRole('tab', { name: 'Journal Entries' }), 'it shall deselect Journal Entries tab when Reports is selected').toHaveAttribute('aria-selected', 'false');
    await expect(page.getByRole('button', { name: 'Generate Report' }), 'it shall display Generate Report button in Reports tab').toHaveCount(1);

    await page.getByRole('tab', { name: 'Fiscal Years' }).click();
    await expect(page.getByRole('tab', { name: 'Fiscal Years' }), 'it shall select Fiscal Years tab when clicked').toHaveAttribute('aria-selected', 'true');
    await expect(page.getByRole('tab', { name: 'Journal Entries' }), 'it shall deselect Journal Entries tab when Fiscal Years is selected').toHaveAttribute('aria-selected', 'false');
    await expect(page.getByRole('heading', { name: 'Fiscal Year ' }), 'it shall display Fiscal Year heading in Fiscal Years tab').toBeVisible();

    await page.getByRole('tab', { name: 'Fixed Assets' }).click();
    await expect(page.getByRole('tab', { name: 'Fixed Assets' }), 'it shall select Fixed Assets tab when clicked').toHaveAttribute('aria-selected', 'true');
    await expect(page.getByRole('tab', { name: 'Journal Entries' }), 'it shall deselect Journal Entries tab when Fixed Assets is selected').toHaveAttribute('aria-selected', 'false');
    await expect(page.getByRole('heading', { name: 'Fixed Assets' }), 'it shall display Fixed Assets heading in Fixed Assets tab').toBeVisible();
  });

  test('view Chart of Accounts with template accounts and column headers', async function ({ page }) {
    await Promise.all([
      loadEmptyFixture(page),
      setupDatabase(tursoLibSQLiteServer(), async function setupData() {}),
    ]);

    await page.evaluate(setupViewWithChartOfAccounts, tursoLibSQLiteServer().url);

    await expect(page.getByRole('treegrid', { name: 'Chart of Accounts' }), 'it shall display Chart of Accounts treegrid').toBeVisible();

    await expect(page.getByRole('row', { name: 'Aset' }), 'it shall display Aset account from template').toBeVisible();
    await expect(page.getByRole('row', { name: 'Liabilitas' }), 'it shall display Liabilitas account from template').toBeVisible();
    await expect(page.getByRole('row', { name: 'Ekuitas' }), 'it shall display Ekuitas account from template').toBeVisible();
    await expect(page.getByRole('row', { name: 'Expand Pendapatan Pendapatan — Cr IDR 0 Active Control' }), 'it shall display Pendapatan account from template').toBeVisible();

    await expect(page.getByRole('columnheader', { name: 'Code' }), 'it shall display Code column header').toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Name' }), 'it shall display Name column header').toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Type' }), 'it shall display Type column header').toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Normal' }), 'it shall display Normal column header').toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Balance' }), 'it shall display Balance column header').toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Status' }), 'it shall display Status column header').toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Kind' }), 'it shall display Kind column header').toBeVisible();
  });

  test('view account type tags and expand all accounts', async function ({ page }) {
    await Promise.all([
      loadEmptyFixture(page),
      setupDatabase(tursoLibSQLiteServer(), async function setupData() {}),
    ]);

    await page.evaluate(setupViewWithChartOfAccounts, tursoLibSQLiteServer().url);

    await page.getByRole('button', { name: 'Expand all accounts' }).click();

    await expect(page.getByRole('columnheader', { name: 'Type' }), 'it shall display account type tags column after expanding').toBeVisible();
    await expect(page.getByRole('row', { name: 'Aset Lancar' }), 'it shall display Aset Lancar child account after expanding').toBeVisible();
  });

  test('filter Chart of Accounts by search query', async function ({ page }) {
    await Promise.all([
      loadEmptyFixture(page),
      setupDatabase(tursoLibSQLiteServer(), async function setupData() {}),
    ]);

    await page.evaluate(setupViewWithChartOfAccounts, tursoLibSQLiteServer().url);

    const chartOfAccountsPanel = page.getByRole('tabpanel', { name: 'Chart of Accounts' });
    await expect(chartOfAccountsPanel.getByLabel('Search', { exact: true }), 'it shall have search input for filtering accounts').toBeVisible();

    const coaTree = page.getByRole('treegrid', { name: 'Chart of Accounts' });
    await expect(coaTree, 'it shall display Chart of Accounts treegrid').toBeVisible();
    await expect(coaTree.getByRole('row'), 'it shall display header plus 7 root parent accounts initially').toHaveCount(8);

    await page.getByRole('textbox', { name: 'Search', exact: true }).fill('Kas & Bank');

    await page.pause();

    await expect(coaTree.getByRole('row'), 'it shall display header plus 1 filtered account after search').toHaveCount(2);
  });

  test('filter Chart of Accounts by type', async function ({ page }) {
    await Promise.all([
      loadEmptyFixture(page),
      setupDatabase(tursoLibSQLiteServer(), async function setupData() {}),
    ]);

    await page.evaluate(setupViewWithChartOfAccounts, tursoLibSQLiteServer().url);

    const chartOfAccountsPanel = page.getByRole('tabpanel', { name: 'Chart of Accounts' });
    await expect(chartOfAccountsPanel.getByLabel('Type', { exact: true }), 'it shall have Type filter dropdown').toBeVisible();

    await chartOfAccountsPanel.getByLabel('Type', { exact: true }).click();

    const typeMenu = page.getByRole('menu', { name: 'Account type filter' });
    await expect(typeMenu, 'it shall open Type filter menu when clicked').toBeVisible();

    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');

    await expect(page.getByRole('treegrid', { name: 'Chart of Accounts' }), 'it shall display treegrid after type filter').toBeVisible();
  });

  test('filter Chart of Accounts by status', async function ({ page }) {
    await Promise.all([
      loadEmptyFixture(page),
      setupDatabase(tursoLibSQLiteServer(), async function setupData() {}),
    ]);

    await page.evaluate(setupViewWithChartOfAccounts, tursoLibSQLiteServer().url);

    const chartOfAccountsPanel = page.getByRole('tabpanel', { name: 'Chart of Accounts' });
    await expect(chartOfAccountsPanel.getByLabel('Status'), 'it shall have Status filter dropdown').toBeVisible();
  });

  test('expand and collapse Chart of Accounts hierarchy', async function ({ page }) {
    await Promise.all([
      loadEmptyFixture(page),
      setupDatabase(tursoLibSQLiteServer(), async function setupData() {}),
    ]);

    await page.evaluate(setupViewWithChartOfAccounts, tursoLibSQLiteServer().url);

    await expect(page.getByRole('button', { name: 'Expand all accounts' }), 'it shall display expand all button').toBeVisible();
    await expect(page.getByRole('button', { name: 'Collapse all accounts' }), 'it shall display collapse all button').toBeVisible();

    await expect(page.getByRole('treegrid', { name: 'Chart of Accounts' }), 'it shall display Chart of Accounts treegrid').toBeVisible();

    await page.getByRole('button', { name: 'Expand all accounts' }).click();

    await expect(page.getByRole('row', { name: 'Aset Lancar' }), 'it shall display Aset Lancar after expanding all').toBeVisible();

    await page.getByRole('button', { name: 'Collapse all accounts' }).click();

    await expect(page.getByRole('row', { name: 'Aset Lancar' }), 'it shall hide Aset Lancar after collapsing all').not.toBeVisible();
  });

  test('toggle expand and collapse by clicking parent account row', async function ({ page }) {
    await Promise.all([
      loadEmptyFixture(page),
      setupDatabase(tursoLibSQLiteServer(), async function setupData() {}),
    ]);

    await page.evaluate(setupViewWithChartOfAccounts, tursoLibSQLiteServer().url);

    const coaTree = page.getByRole('treegrid', { name: 'Chart of Accounts' });
    await expect(coaTree, 'it shall display Chart of Accounts treegrid').toBeVisible();

    await coaTree.getByRole('button', { name: 'Expand Aset', exact: true }).click();
    await expect(coaTree.getByRole('button', { name: 'Expand Aset Lancar' }), 'it shall display Expand Aset Lancar button after expanding Aset').toBeVisible();

    await coaTree.getByRole('button', { name: 'Collapse Aset', exact: true }).click();
    await expect(coaTree.getByRole('button', { name: 'Expand Aset Lancar' }), 'it shall hide Expand Aset Lancar button after collapsing Aset').not.toBeVisible();
  });

  test('refresh Chart of Accounts flow', async function ({ page }) {
    await Promise.all([
      loadEmptyFixture(page),
      setupDatabase(tursoLibSQLiteServer(), async function setupData() {}),
    ]);

    await page.evaluate(setupViewWithChartOfAccounts, tursoLibSQLiteServer().url);

    await expect(page.getByRole('button', { name: 'Refresh accounts' }), 'it shall have refresh button').toBeVisible();

    await page.getByRole('button', { name: 'Refresh accounts' }).click();

    await expect(page.getByRole('treegrid', { name: 'Chart of Accounts' }), 'it shall reload accounts when refresh button is clicked').toBeVisible();
    await expect(page.getByRole('row', { name: 'Aset' }), 'it shall display Aset account after refresh').toBeVisible();
  });
});
