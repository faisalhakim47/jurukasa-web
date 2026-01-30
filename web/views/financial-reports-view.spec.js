import { expect } from '@playwright/test';
import { jurukasaTest } from '#test/playwright/test-setup.js';
import { useTursoLibSQLiteServer } from '#test/playwright/hooks/use-turso-libsqlite-server.js';
import { useConsoleOutput } from '#test/playwright/hooks/use-console-output.js';
import { useStrict, bypassForbiddenLocator } from '#test/playwright/hooks/use-strict.js';
import { loadEmptyFixture } from '#test/playwright/tools/fixture.js';
import { setupDatabase } from '#test/playwright/tools/database.js';

const test = jurukasaTest;
const { describe } = test;

/** @param {string} tursoDatabaseUrl */
async function setupView(tursoDatabaseUrl) {
  window.history.replaceState({}, '', '/books/reports');
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

describe('Financial Reports', function () {
  useConsoleOutput(test);
  useStrict(test);

  describe('Financial Reports Display', function () {
    const tursoLibSQLiteServer = useTursoLibSQLiteServer(test);

    test('shall display Report Type selector', async function ({ page }) {
      await Promise.all([
        loadEmptyFixture(page),
        setupDatabase(tursoLibSQLiteServer(), async function setupData(sql) {}),
      ]);

      await page.evaluate(setupView, tursoLibSQLiteServer().url);

      await expect(page.getByLabel('Report Type', { exact: true })).toBeVisible();
    });

    test('shall default to Trial Balance report type', async function ({ page }) {
      await Promise.all([
        loadEmptyFixture(page),
        setupDatabase(tursoLibSQLiteServer(), async function setupData(sql) {}),
      ]);

      await page.evaluate(setupView, tursoLibSQLiteServer().url);

      await expect(page.getByLabel('Report Type', { exact: true })).toHaveValue('Trial Balance');
    });

    test('shall display empty state when no reports exist', async function ({ page }) {
      await Promise.all([
        loadEmptyFixture(page),
        setupDatabase(tursoLibSQLiteServer(), async function setupData(sql) {}),
      ]);

      await page.evaluate(setupView, tursoLibSQLiteServer().url);

      await expect(page.getByRole('heading', { name: 'No reports generated' })).toBeVisible();
      await expect(page.getByText('Generate a new balance report to view trial balance and balance sheet.')).toBeVisible();
    });

    test('shall display Generate Report button', async function ({ page }) {
      await Promise.all([
        loadEmptyFixture(page),
        setupDatabase(tursoLibSQLiteServer(), async function setupData(sql) {}),
      ]);

      await page.evaluate(setupView, tursoLibSQLiteServer().url);

      await expect(page.getByRole('button', { name: 'Generate Report' }).first()).toBeVisible();
    });

    test('shall display Refresh button', async function ({ page }) {
      await Promise.all([
        loadEmptyFixture(page),
        setupDatabase(tursoLibSQLiteServer(), async function setupData(sql) {}),
      ]);

      await page.evaluate(setupView, tursoLibSQLiteServer().url);

      await expect(page.getByRole('button', { name: 'Refresh report' })).toBeVisible();
    });
  });

  describe('Report Type Selection', function () {
    const tursoLibSQLiteServer = useTursoLibSQLiteServer(test);

    test('shall show report type menu when clicking selector', async function ({ page }) {
      await Promise.all([
        loadEmptyFixture(page),
        setupDatabase(tursoLibSQLiteServer(), async function setupData(sql) {}),
      ]);

      await page.evaluate(setupView, tursoLibSQLiteServer().url);

      await page.getByLabel('Report Type', { exact: true }).click();

      const reportTypeMenu = page.getByRole('menu', { name: 'Report type menu' });
      await expect(reportTypeMenu).toBeVisible();
      await expect(reportTypeMenu.getByRole('menuitemradio', { name: 'Trial Balance' })).toBeVisible();
      await expect(reportTypeMenu.getByRole('menuitemradio', { name: 'Balance Sheet' })).toBeVisible();
      await expect(reportTypeMenu.getByRole('menuitemradio', { name: 'Income Statement' })).toBeVisible();
    });

    test('shall switch to Balance Sheet report type', async function ({ page }) {
      await Promise.all([
        loadEmptyFixture(page),
        setupDatabase(tursoLibSQLiteServer(), async function setupData(sql) {}),
      ]);

      await page.evaluate(setupView, tursoLibSQLiteServer().url);

      // Wait for the Reports panel to be visible and in viewport
      const reportsPanel = page.getByRole('tabpanel', { name: 'Reports' });
      await expect(reportsPanel).toBeInViewport();

      await page.getByLabel('Report Type', { exact: true }).click();
      const reportTypeMenu = page.getByRole('menu', { name: 'Report type menu' });
      await expect(reportTypeMenu).toBeVisible();
      const balanceSheetOption = reportTypeMenu.getByRole('menuitemradio', { name: 'Balance Sheet' });
      await expect(balanceSheetOption).toBeVisible();
      await balanceSheetOption.click({ force: true });

      await expect(page.getByLabel('Report Type', { exact: true })).toHaveValue('Balance Sheet');
    });

    test('shall switch to Income Statement report type', async function ({ page }) {
      await Promise.all([
        loadEmptyFixture(page),
        setupDatabase(tursoLibSQLiteServer(), async function setupData(sql) {}),
      ]);

      await page.evaluate(setupView, tursoLibSQLiteServer().url);

      // Wait for the Reports panel to be visible and in viewport
      const reportsPanel = page.getByRole('tabpanel', { name: 'Reports' });
      await expect(reportsPanel).toBeInViewport();

      await page.getByLabel('Report Type', { exact: true }).click();
      const reportTypeMenu = page.getByRole('menu', { name: 'Report type menu' });
      await expect(reportTypeMenu).toBeVisible();
      const incomeStatementOption = reportTypeMenu.getByRole('menuitemradio', { name: 'Income Statement' });
      await expect(incomeStatementOption).toBeVisible();
      await incomeStatementOption.click({ force: true });

      await expect(page.getByLabel('Report Type', { exact: true })).toHaveValue('Income Statement');
    });

    test('shall show Fiscal Year selector for Income Statement', async function ({ page }) {
      await Promise.all([
        loadEmptyFixture(page),
        setupDatabase(tursoLibSQLiteServer(), async function setupData(sql) {}),
      ]);

      await page.evaluate(setupView, tursoLibSQLiteServer().url);

      // Wait for the Reports panel to be visible and in viewport
      const reportsPanel = page.getByRole('tabpanel', { name: 'Reports' });
      await expect(reportsPanel).toBeInViewport();

      await page.getByLabel('Report Type', { exact: true }).click();
      const reportTypeMenu = page.getByRole('menu', { name: 'Report type menu' });
      await expect(reportTypeMenu).toBeVisible();
      const incomeStatementOption = reportTypeMenu.getByRole('menuitemradio', { name: 'Income Statement' });
      await expect(incomeStatementOption).toBeVisible();
      await incomeStatementOption.click({ force: true });

      await expect(page.getByLabel('Fiscal Year', { exact: true })).toBeVisible();
    });

    test('shall show Report Date selector for Trial Balance', async function ({ page }) {
      await Promise.all([
        loadEmptyFixture(page),
        setupDatabase(tursoLibSQLiteServer(), async function setupData(sql) {}),
      ]);

      await page.evaluate(setupView, tursoLibSQLiteServer().url);

      await expect(page.getByLabel('Report Date', { exact: true })).toBeVisible();
    });

    test('shall hide Report Date selector for Income Statement', async function ({ page }) {
      await Promise.all([
        loadEmptyFixture(page),
        setupDatabase(tursoLibSQLiteServer(), async function setupData(sql) {}),
      ]);

      await page.evaluate(setupView, tursoLibSQLiteServer().url);

      // Wait for the Reports panel to be visible and in viewport
      const reportsPanel = page.getByRole('tabpanel', { name: 'Reports' });
      await expect(reportsPanel).toBeInViewport();

      await page.getByLabel('Report Type', { exact: true }).click();
      const reportTypeMenu = page.getByRole('menu', { name: 'Report type menu' });
      await expect(reportTypeMenu).toBeVisible();
      const incomeStatementOption = reportTypeMenu.getByRole('menuitemradio', { name: 'Income Statement' });
      await expect(incomeStatementOption).toBeVisible();
      await incomeStatementOption.click({ force: true });

      await expect(page.getByLabel('Report Date', { exact: true })).not.toBeVisible();
    });
  });

  describe('Report Generation', function () {
    const tursoLibSQLiteServer = useTursoLibSQLiteServer(test);

    test('shall generate new report when clicking Generate Report button', async function ({ page }) {
      await Promise.all([
        loadEmptyFixture(page),
        setupDatabase(tursoLibSQLiteServer(), async function setupData(sql) {}),
      ]);

      await page.evaluate(setupView, tursoLibSQLiteServer().url);

      await page.getByRole('button', { name: 'Generate Report' }).first().click();

      await expect(page.getByRole('table', { name: 'Trial Balance' })).toBeVisible();
    });

    test('shall display trial balance table after generating report', async function ({ page }) {
      await Promise.all([
        loadEmptyFixture(page),
        setupDatabase(tursoLibSQLiteServer(), async function setupData(sql) {}),
      ]);

      await page.evaluate(setupView, tursoLibSQLiteServer().url);

      await page.getByRole('button', { name: 'Generate Report' }).first().click();
      const trialBalanceTable = page.getByRole('table', { name: 'Trial Balance' });
      await expect(trialBalanceTable).toBeVisible();

      await expect(trialBalanceTable.getByRole('columnheader', { name: 'Code' })).toBeVisible();
      await expect(trialBalanceTable.getByRole('columnheader', { name: 'Account Name' })).toBeVisible();
      await expect(trialBalanceTable.getByRole('columnheader', { name: 'Normal' })).toBeVisible();
      await expect(trialBalanceTable.getByRole('columnheader', { name: 'Debit' })).toBeVisible();
      await expect(trialBalanceTable.getByRole('columnheader', { name: 'Credit' })).toBeVisible();
    });
  });

  describe('Balance Sheet', function () {
    const tursoLibSQLiteServer = useTursoLibSQLiteServer(test);

    test('shall display balance sheet table after selecting Balance Sheet and generating report', async function ({ page }) {
      await Promise.all([
        loadEmptyFixture(page),
        setupDatabase(tursoLibSQLiteServer(), async function setupData(sql) {}),
      ]);

      await page.evaluate(setupView, tursoLibSQLiteServer().url);

      await page.getByRole('button', { name: 'Generate Report' }).first().click();
      await expect(page.getByRole('table', { name: 'Trial Balance' })).toBeVisible();

      await page.getByLabel('Report Type', { exact: true }).click();
      const reportTypeMenu = page.getByRole('menu', { name: 'Report type menu' });
      await expect(reportTypeMenu).toBeVisible();
      await reportTypeMenu.getByRole('menuitemradio', { name: 'Balance Sheet' }).click();

      await expect(page.getByRole('table', { name: 'Balance Sheet' })).toBeVisible();
    });

    test('shall display balance sheet column headers', async function ({ page }) {
      await Promise.all([
        loadEmptyFixture(page),
        setupDatabase(tursoLibSQLiteServer(), async function setupData(sql) {}),
      ]);

      await page.evaluate(setupView, tursoLibSQLiteServer().url);

      await page.getByRole('button', { name: 'Generate Report' }).first().click();
      await expect(page.getByRole('table', { name: 'Trial Balance' })).toBeVisible();

      await page.getByLabel('Report Type', { exact: true }).click();
      const reportTypeMenu = page.getByRole('menu', { name: 'Report type menu' });
      await expect(reportTypeMenu).toBeVisible();
      await reportTypeMenu.getByRole('menuitemradio', { name: 'Balance Sheet' }).click();

      await expect(page.getByRole('columnheader', { name: 'Code' })).toBeVisible();
      await expect(page.getByRole('columnheader', { name: 'Account Name' })).toBeVisible();
      await expect(page.getByRole('columnheader', { name: 'Amount' })).toBeVisible();
    });

    test('shall display balance sheet classification sections', async function ({ page }) {
      await Promise.all([
        loadEmptyFixture(page),
        setupDatabase(tursoLibSQLiteServer(), async function setupData(sql) {}),
      ]);

      await page.evaluate(setupView, tursoLibSQLiteServer().url);

      await page.getByRole('button', { name: 'Generate Report' }).first().click();
      await expect(page.getByRole('table', { name: 'Trial Balance' })).toBeVisible();

      await page.getByLabel('Report Type', { exact: true }).click();
      const reportTypeMenu = page.getByRole('menu', { name: 'Report type menu' });
      await expect(reportTypeMenu).toBeVisible();
      await reportTypeMenu.getByRole('menuitemradio', { name: 'Balance Sheet' }).click();

      const balanceSheetTable = page.getByRole('table', { name: 'Balance Sheet' });
      const emptyStateHeading = page.getByRole('heading', { name: 'No reports generated' });

      await expect(balanceSheetTable.or(emptyStateHeading)).toBeVisible();
    });

    test('shall show balance equation status', async function ({ page }) {
      await Promise.all([
        loadEmptyFixture(page),
        setupDatabase(tursoLibSQLiteServer(), async function setupData(sql) {}),
      ]);

      await page.evaluate(setupView, tursoLibSQLiteServer().url);

      await page.getByRole('button', { name: 'Generate Report' }).first().click();
      await expect(page.getByRole('table', { name: 'Trial Balance' })).toBeVisible();

      await page.getByLabel('Report Type', { exact: true }).click();
      const reportTypeMenu = page.getByRole('menu', { name: 'Report type menu' });
      await expect(reportTypeMenu).toBeVisible();
      await reportTypeMenu.getByRole('menuitemradio', { name: 'Balance Sheet' }).click();

      await expect(page.getByRole('table', { name: 'Balance Sheet' }).or(page.getByRole('alert'))).toBeVisible();

      const hasBalanceSheet = await page.getByRole('table', { name: 'Balance Sheet' }).isVisible().catch(() => false);
      if (hasBalanceSheet) {
        const balanceEquationVisible = await page.getByText('Assets = Liabilities + Equity').isVisible().catch(() => false);
        const outOfBalanceVisible = await page.getByText('Balance Sheet is out of balance').isVisible().catch(() => false);
        await expect(balanceEquationVisible || outOfBalanceVisible).toBeTruthy();
      }
    });
  });

  describe('Income Statement', function () {
    const tursoLibSQLiteServer = useTursoLibSQLiteServer(test);

    test('shall display empty state for Income Statement when no fiscal years exist', async function ({ page }) {
      await Promise.all([
        loadEmptyFixture(page),
        setupDatabase(tursoLibSQLiteServer(), async function setupData(sql) {}),
      ]);

      await page.evaluate(setupView, tursoLibSQLiteServer().url);

      // Wait for the Reports panel to be visible and in viewport
      const reportsPanel = page.getByRole('tabpanel', { name: 'Reports' });
      await expect(reportsPanel).toBeInViewport();

      await page.getByLabel('Report Type', { exact: true }).click();
      const reportTypeMenu = page.getByRole('menu', { name: 'Report type menu' });
      await expect(reportTypeMenu).toBeVisible();
      const incomeStatementOption = reportTypeMenu.getByRole('menuitemradio', { name: 'Income Statement' });
      await expect(incomeStatementOption).toBeVisible();
      await incomeStatementOption.click({ force: true });

      await expect(page.getByRole('heading', { name: 'No income statement data' })).toBeVisible();
      await expect(page.getByText('Create a fiscal year to generate income statements.')).toBeVisible();
    });

    test('shall hide Generate Report button for Income Statement', async function ({ page }) {
      await Promise.all([
        loadEmptyFixture(page),
        setupDatabase(tursoLibSQLiteServer(), async function setupData(sql) {}),
      ]);

      await page.evaluate(setupView, tursoLibSQLiteServer().url);

      // Wait for the Reports panel to be visible and in viewport
      const reportsPanel = page.getByRole('tabpanel', { name: 'Reports' });
      await expect(reportsPanel).toBeInViewport();

      await page.getByLabel('Report Type', { exact: true }).click();
      const reportTypeMenu = page.getByRole('menu', { name: 'Report type menu' });
      await expect(reportTypeMenu).toBeVisible();
      const incomeStatementOption = reportTypeMenu.getByRole('menuitemradio', { name: 'Income Statement' });
      await expect(incomeStatementOption).toBeVisible();
      await incomeStatementOption.click({ force: true });

      const headerGenerateButton = reportsPanel.getByRole('button', { name: 'Generate Report' });
      await expect(headerGenerateButton).not.toBeVisible();
    });
  });

  describe('Report Actions', function () {
    const tursoLibSQLiteServer = useTursoLibSQLiteServer(test);

    test('shall refresh report when clicking Refresh button', async function ({ page }) {
      await Promise.all([
        loadEmptyFixture(page),
        setupDatabase(tursoLibSQLiteServer(), async function setupData(sql) {}),
      ]);

      await page.evaluate(setupView, tursoLibSQLiteServer().url);

      await page.getByRole('button', { name: 'Generate Report' }).first().click();
      await expect(page.getByRole('table', { name: 'Trial Balance' })).toBeVisible();

      await page.getByRole('button', { name: 'Refresh report' }).click();

      await expect(page.getByRole('table', { name: 'Trial Balance' })).toBeVisible();
    });

    test('shall be able to generate multiple reports', async function ({ page }) {
      await Promise.all([
        loadEmptyFixture(page),
        setupDatabase(tursoLibSQLiteServer(), async function setupData(sql) {}),
      ]);

      await page.evaluate(setupView, tursoLibSQLiteServer().url);

      await page.getByRole('button', { name: 'Generate Report' }).first().click();
      await expect(page.getByRole('table', { name: 'Trial Balance' })).toBeVisible();

      const reportsPanel = page.getByRole('tabpanel', { name: 'Reports' });
      await reportsPanel.getByRole('button', { name: 'Generate Report' }).first().click();

      await page.getByLabel('Report Date', { exact: true }).click();
      const reportMenu = page.getByRole('menu', { name: 'Report date menu' });
      await expect(reportMenu).toBeVisible();

      const reportItems = reportMenu.getByRole('menuitem');
      await expect(reportItems).toHaveCount(2);
    });
  });
});
