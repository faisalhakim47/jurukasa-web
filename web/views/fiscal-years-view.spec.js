import { expect, test } from '@playwright/test';
import { useTursoLibSQLiteServer } from '#test/hooks/use-turso-libsqlite-server.js';
import { useConsoleOutput } from '#test/hooks/use-console-output.js';
const { describe } = test;

describe('Fiscal Years', function () {
  // useConsoleOutput(test);

  /**
   * @param {import('@playwright/test').Page} page
   * @param {string} tursoLibSQLiteServerUrl
   */
  async function setupDatabaseAndNavigateToFiscalYears(page, tursoLibSQLiteServerUrl) {
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

    await page.getByText('Books').click();

    await page.getByRole('tab', { name: 'Fiscal Years' }).click();
    await expect(page.getByRole('tab', { name: 'Fiscal Years' })).toHaveAttribute('aria-selected', 'true');
  }

  describe('Fiscal Years Tab Navigation', function () {
    const tursoLibSQLiteServer = useTursoLibSQLiteServer(test);

    test('shall display Fiscal Years tab in navigation', async function ({ page }) {
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
      await page.getByText('Books').click();

      await expect(page.getByRole('tab', { name: 'Fiscal Years' })).toBeVisible();
    });

    test('shall switch to Fiscal Years tab when clicked', async function ({ page }) {
      await setupDatabaseAndNavigateToFiscalYears(page, tursoLibSQLiteServer().url);

      await expect(page.getByRole('tab', { name: 'Fiscal Years' })).toHaveAttribute('aria-selected', 'true');
      await expect(page.getByRole('tab', { name: 'Journal Entries' })).toHaveAttribute('aria-selected', 'false');
    });
  });

  describe('Fiscal Years Display', function () {
    const tursoLibSQLiteServer = useTursoLibSQLiteServer(test);

    test('shall display empty state when no fiscal years exist', async function ({ page }) {
      await setupDatabaseAndNavigateToFiscalYears(page, tursoLibSQLiteServer().url);

      await expect(page.getByRole('heading', { name: 'No fiscal years defined' })).toBeVisible();
      await expect(page.getByText('Create your first fiscal year to organize your accounting periods and enable income statement reporting.')).toBeVisible();
    });

    test('shall display New Fiscal Year button', async function ({ page }) {
      await setupDatabaseAndNavigateToFiscalYears(page, tursoLibSQLiteServer().url);

      await expect(page.getByRole('button', { name: 'New Fiscal Year' })).toBeVisible();
    });

    test('shall display Create Fiscal Year button in empty state', async function ({ page }) {
      await setupDatabaseAndNavigateToFiscalYears(page, tursoLibSQLiteServer().url);

      await expect(page.getByRole('button', { name: 'Create Fiscal Year' })).toBeVisible();
    });

    test('shall display Refresh button', async function ({ page }) {
      await setupDatabaseAndNavigateToFiscalYears(page, tursoLibSQLiteServer().url);

      await expect(page.getByRole('button', { name: 'Refresh' })).toBeVisible();
    });
  });

  describe('Fiscal Year Creation', function () {
    const tursoLibSQLiteServer = useTursoLibSQLiteServer(test);

    test('shall open creation dialog when clicking New Fiscal Year button', async function ({ page }) {
      await setupDatabaseAndNavigateToFiscalYears(page, tursoLibSQLiteServer().url);

      await page.getByRole('button', { name: 'New Fiscal Year' }).click();

      await expect(page.getByRole('dialog', { name: 'Create Fiscal Year' })).toBeVisible();
    });

    test('shall display form fields in creation dialog', async function ({ page }) {
      await setupDatabaseAndNavigateToFiscalYears(page, tursoLibSQLiteServer().url);

      await page.getByRole('button', { name: 'New Fiscal Year' }).click();
      const dialog = page.getByRole('dialog', { name: 'Create Fiscal Year' });

      await expect(dialog.getByLabel('Name (Optional)')).toBeVisible();
      await expect(dialog.getByLabel('Begin Date')).toBeVisible();
      await expect(dialog.getByLabel('End Date')).toBeVisible();
      await expect(dialog.getByRole('button', { name: 'Create' })).toBeVisible();
    });

    test('shall create fiscal year successfully', async function ({ page }) {
      await setupDatabaseAndNavigateToFiscalYears(page, tursoLibSQLiteServer().url);

      await page.getByRole('button', { name: 'New Fiscal Year' }).click();
      const dialog = page.getByRole('dialog', { name: 'Create Fiscal Year' });

      await dialog.getByLabel('Name (Optional)').fill('FY 2025');
      await dialog.getByLabel('Begin Date').fill('2025-01-01');
      await dialog.getByLabel('End Date').fill('2025-12-31');

      await dialog.getByRole('button', { name: 'Create' }).click();

      await expect(dialog).not.toBeVisible();
      await page.pause();
      await expect(page.getByRole('table', { name: 'Fiscal years list' })).toBeVisible();
      await expect(page.getByRole('row', { name: /FY 2025/ })).toBeVisible();
    });

    test('shall display fiscal year in list after creation', async function ({ page }) {
      await setupDatabaseAndNavigateToFiscalYears(page, tursoLibSQLiteServer().url);

      await page.getByRole('button', { name: 'New Fiscal Year' }).click();
      const dialog = page.getByRole('dialog', { name: 'Create Fiscal Year' });
      await dialog.getByLabel('Name (Optional)').fill('FY 2025');
      await dialog.getByLabel('Begin Date').fill('2025-01-01');
      await dialog.getByLabel('End Date').fill('2025-12-31');
      await dialog.getByRole('button', { name: 'Create' }).click();
      await expect(dialog).not.toBeVisible();

      const fiscalYearsPanel = page.getByRole('tabpanel', { name: 'Fiscal Years' });
      await expect(fiscalYearsPanel.getByRole('columnheader', { name: 'Name' })).toBeVisible();
      await expect(fiscalYearsPanel.getByRole('columnheader', { name: 'Begin Date' })).toBeVisible();
      await expect(fiscalYearsPanel.getByRole('columnheader', { name: 'End Date' })).toBeVisible();
      await expect(fiscalYearsPanel.getByRole('columnheader', { name: 'Status' })).toBeVisible();
    });

    test('shall show fiscal year as Open after creation', async function ({ page }) {
      await setupDatabaseAndNavigateToFiscalYears(page, tursoLibSQLiteServer().url);

      await page.getByRole('button', { name: 'New Fiscal Year' }).click();
      const dialog = page.getByRole('dialog', { name: 'Create Fiscal Year' });
      await dialog.getByLabel('Name (Optional)').fill('FY 2025');
      await dialog.getByLabel('Begin Date').fill('2025-01-01');
      await dialog.getByLabel('End Date').fill('2025-12-31');
      await dialog.getByRole('button', { name: 'Create' }).click();
      await expect(dialog).not.toBeVisible();

      // Verify status is Open - look for the text inside a span, not the icon title
      const fiscalYearRow = page.getByRole('row', { name: /FY 2025/ });
      await expect(fiscalYearRow.locator('span.label-small', { hasText: 'Open' })).toBeVisible();
    });

    test('shall close creation dialog when clicking close button', async function ({ page }) {
      await setupDatabaseAndNavigateToFiscalYears(page, tursoLibSQLiteServer().url);

      await page.getByRole('button', { name: 'New Fiscal Year' }).click();
      const dialog = page.getByRole('dialog', { name: 'Create Fiscal Year' });
      await expect(dialog).toBeVisible();

      await dialog.getByRole('button', { name: 'Close dialog' }).click();

      await expect(dialog).not.toBeVisible();
    });
  });

  describe('Fiscal Year Details Dialog', function () {
    const tursoLibSQLiteServer = useTursoLibSQLiteServer(test);

    test('shall open details dialog when clicking on fiscal year row', async function ({ page }) {
      await setupDatabaseAndNavigateToFiscalYears(page, tursoLibSQLiteServer().url);

      await page.getByRole('button', { name: 'New Fiscal Year' }).click();
      const creationDialog = page.getByRole('dialog', { name: 'Create Fiscal Year' });
      await creationDialog.getByLabel('Name (Optional)').fill('FY 2025');
      await creationDialog.getByLabel('Begin Date').fill('2025-01-01');
      await creationDialog.getByLabel('End Date').fill('2025-12-31');
      await creationDialog.getByRole('button', { name: 'Create' }).click();
      await expect(creationDialog).not.toBeVisible();

      await page.getByRole('button', { name: /FY 2025/ }).click();

      await expect(page.getByRole('dialog', { name: /Fiscal Year Details/ })).toBeVisible();
    });

    test('shall display fiscal year details in dialog', async function ({ page }) {
      await setupDatabaseAndNavigateToFiscalYears(page, tursoLibSQLiteServer().url);

      await page.getByRole('button', { name: 'New Fiscal Year' }).click();
      const creationDialog = page.getByRole('dialog', { name: 'Create Fiscal Year' });
      await creationDialog.getByLabel('Name (Optional)').fill('FY 2025');
      await creationDialog.getByLabel('Begin Date').fill('2025-01-01');
      await creationDialog.getByLabel('End Date').fill('2025-12-31');
      await creationDialog.getByRole('button', { name: 'Create' }).click();
      await expect(creationDialog).not.toBeVisible();

      await page.getByRole('button', { name: /FY 2025/ }).click();

      const detailsDialog = page.getByRole('dialog', { name: /Fiscal Year Details/ });
      await expect(detailsDialog.getByText('Period')).toBeVisible();
      await expect(detailsDialog.getByText('Financial Summary')).toBeVisible();
      await expect(detailsDialog.getByText('Total Revenue')).toBeVisible();
      await expect(detailsDialog.getByText('Total Expenses')).toBeVisible();
      await expect(detailsDialog.getByText('Net Income')).toBeVisible();
    });

    test('shall display Close Fiscal Year button for open fiscal year', async function ({ page }) {
      await setupDatabaseAndNavigateToFiscalYears(page, tursoLibSQLiteServer().url);

      await page.getByRole('button', { name: 'New Fiscal Year' }).click();
      const creationDialog = page.getByRole('dialog', { name: 'Create Fiscal Year' });
      await creationDialog.getByLabel('Name (Optional)').fill('FY 2025');
      await creationDialog.getByLabel('Begin Date').fill('2025-01-01');
      await creationDialog.getByLabel('End Date').fill('2025-12-31');
      await creationDialog.getByRole('button', { name: 'Create' }).click();
      await expect(creationDialog).not.toBeVisible();

      await page.getByRole('button', { name: /FY 2025/ }).click();

      const detailsDialog = page.getByRole('dialog', { name: /Fiscal Year Details/ });
      await expect(detailsDialog.getByRole('button', { name: 'Close Fiscal Year' })).toBeVisible();
    });

    test('shall display closing requirements section for open fiscal year', async function ({ page }) {
      await setupDatabaseAndNavigateToFiscalYears(page, tursoLibSQLiteServer().url);

      await page.getByRole('button', { name: 'New Fiscal Year' }).click();
      const creationDialog = page.getByRole('dialog', { name: 'Create Fiscal Year' });
      await creationDialog.getByLabel('Name (Optional)').fill('FY 2025');
      await creationDialog.getByLabel('Begin Date').fill('2025-01-01');
      await creationDialog.getByLabel('End Date').fill('2025-12-31');
      await creationDialog.getByRole('button', { name: 'Create' }).click();
      await expect(creationDialog).not.toBeVisible();

      await page.getByRole('button', { name: /FY 2025/ }).click();

      const detailsDialog = page.getByRole('dialog', { name: /Fiscal Year Details/ });
      await expect(detailsDialog.getByText('Closing Requirements')).toBeVisible();
    });
  });

  describe('Fiscal Year Closing', function () {
    const tursoLibSQLiteServer = useTursoLibSQLiteServer(test);

    test('shall show confirmation dialog when clicking Close Fiscal Year', async function ({ page }) {
      await setupDatabaseAndNavigateToFiscalYears(page, tursoLibSQLiteServer().url);

      await page.getByRole('button', { name: 'New Fiscal Year' }).click();
      const creationDialog = page.getByRole('dialog', { name: 'Create Fiscal Year' });
      await creationDialog.getByLabel('Name (Optional)').fill('FY 2025');
      await creationDialog.getByLabel('Begin Date').fill('2025-01-01');
      await creationDialog.getByLabel('End Date').fill('2025-12-31');
      await creationDialog.getByRole('button', { name: 'Create' }).click();
      await expect(creationDialog).not.toBeVisible();

      await page.getByRole('button', { name: /FY 2025/ }).click();

      const detailsDialog = page.getByRole('dialog', { name: /Fiscal Year Details/ });
      await detailsDialog.getByRole('button', { name: 'Close Fiscal Year' }).click();

      await expect(page.getByRole('alertdialog', { name: /Close Fiscal Year/ })).toBeVisible();
    });

    test('shall close fiscal year successfully', async function ({ page }) {
      await setupDatabaseAndNavigateToFiscalYears(page, tursoLibSQLiteServer().url);

      await page.getByRole('button', { name: 'New Fiscal Year' }).click();
      const creationDialog = page.getByRole('dialog', { name: 'Create Fiscal Year' });
      await creationDialog.getByLabel('Name (Optional)').fill('FY 2025');
      await creationDialog.getByLabel('Begin Date').fill('2025-01-01');
      await creationDialog.getByLabel('End Date').fill('2025-12-31');
      await creationDialog.getByRole('button', { name: 'Create' }).click();
      await expect(creationDialog).not.toBeVisible();

      await page.getByRole('button', { name: /FY 2025/ }).click();

      const detailsDialog = page.getByRole('dialog', { name: /Fiscal Year Details/ });
      await detailsDialog.getByRole('button', { name: 'Close Fiscal Year' }).click();

      const confirmDialog = page.getByRole('alertdialog', { name: /Close Fiscal Year/ });
      await confirmDialog.getByRole('button', { name: 'Close Fiscal Year' }).click();

      await expect(detailsDialog.getByText('lock Closed')).toBeVisible();
    });

    test('shall update fiscal year status in list after closing', async function ({ page }) {
      await setupDatabaseAndNavigateToFiscalYears(page, tursoLibSQLiteServer().url);

      await page.getByRole('button', { name: 'New Fiscal Year' }).click();
      const creationDialog = page.getByRole('dialog', { name: 'Create Fiscal Year' });
      await creationDialog.getByLabel('Name (Optional)').fill('FY 2025');
      await creationDialog.getByLabel('Begin Date').fill('2025-01-01');
      await creationDialog.getByLabel('End Date').fill('2025-12-31');
      await creationDialog.getByRole('button', { name: 'Create' }).click();
      await expect(creationDialog).not.toBeVisible();

      await page.getByRole('button', { name: /FY 2025/ }).click();

      const detailsDialog = page.getByRole('dialog', { name: /Fiscal Year Details/ });
      await detailsDialog.getByRole('button', { name: 'Close Fiscal Year' }).click();
      const confirmDialog = page.getByRole('alertdialog', { name: /Close Fiscal Year/ });
      await confirmDialog.getByRole('button', { name: 'Close Fiscal Year' }).click();

      await detailsDialog.getByRole('button', { name: 'Close dialog' }).click();

      const fiscalYearRow = page.getByRole('row', { name: /FY 2025/ });

      await expect(fiscalYearRow.getByRole('cell', { name: 'Closed' })).toBeVisible();
    });

    test('shall not show Close Fiscal Year button for closed fiscal year', async function ({ page }) {
      await setupDatabaseAndNavigateToFiscalYears(page, tursoLibSQLiteServer().url);

      await page.getByRole('button', { name: 'New Fiscal Year' }).click();
      const creationDialog = page.getByRole('dialog', { name: 'Create Fiscal Year' });
      await creationDialog.getByLabel('Name (Optional)').fill('FY 2025');
      await creationDialog.getByLabel('Begin Date').fill('2025-01-01');
      await creationDialog.getByLabel('End Date').fill('2025-12-31');
      await creationDialog.getByRole('button', { name: 'Create' }).click();
      await expect(creationDialog).not.toBeVisible();

      await page.getByRole('button', { name: /FY 2025/ }).click();
      let detailsDialog = page.getByRole('dialog', { name: /Fiscal Year Details/ });
      await detailsDialog.getByRole('button', { name: 'Close Fiscal Year' }).click();
      const confirmDialog = page.getByRole('alertdialog', { name: /Close Fiscal Year/ });
      await confirmDialog.getByRole('button', { name: 'Close Fiscal Year' }).click();
      await detailsDialog.getByRole('button', { name: 'Close dialog' }).click();

      await page.getByRole('table', { name: 'Fiscal years list' }).getByRole('button', { name: 'FY 2025', exact: true }).click();
      detailsDialog = page.getByRole('dialog', { name: /Fiscal Year Details/ });

      await expect(detailsDialog.getByRole('button', { name: 'Close Fiscal Year' })).not.toBeVisible();
    });
  });

  describe('Fiscal Year Refresh', function () {
    const tursoLibSQLiteServer = useTursoLibSQLiteServer(test);

    test('shall reload fiscal years when clicking Refresh button', async function ({ page }) {
      await setupDatabaseAndNavigateToFiscalYears(page, tursoLibSQLiteServer().url);

      await page.getByRole('button', { name: 'New Fiscal Year' }).click();
      const creationDialog = page.getByRole('dialog', { name: 'Create Fiscal Year' });
      await creationDialog.getByLabel('Name (Optional)').fill('FY 2025');
      await creationDialog.getByLabel('Begin Date').fill('2025-01-01');
      await creationDialog.getByLabel('End Date').fill('2025-12-31');
      await creationDialog.getByRole('button', { name: 'Create' }).click();
      await expect(creationDialog).not.toBeVisible();

      await page.getByRole('button', { name: 'Refresh' }).click();

      await expect(page.getByRole('table', { name: 'Fiscal years list' })).toBeVisible();
      await expect(page.getByRole('row', { name: /FY 2025/ })).toBeVisible();
    });
  });

  describe('Fiscal Year Reversal', function () {
    const tursoLibSQLiteServer = useTursoLibSQLiteServer(test);

    test('shall display Reverse button for closed fiscal year', async function ({ page }) {
      await setupDatabaseAndNavigateToFiscalYears(page, tursoLibSQLiteServer().url);

      await page.getByRole('button', { name: 'New Fiscal Year' }).click();
      const creationDialog = page.getByRole('dialog', { name: 'Create Fiscal Year' });
      await creationDialog.getByLabel('Name (Optional)').fill('FY 2025');
      await creationDialog.getByLabel('Begin Date').fill('2025-01-01');
      await creationDialog.getByLabel('End Date').fill('2025-12-31');
      await creationDialog.getByRole('button', { name: 'Create' }).click();
      await expect(creationDialog).not.toBeVisible();

      await page.getByRole('button', { name: /FY 2025/ }).click();
      const detailsDialog = page.getByRole('dialog', { name: /Fiscal Year Details/ });
      await detailsDialog.getByRole('button', { name: 'Close Fiscal Year' }).click();
      const confirmDialog = page.getByRole('alertdialog', { name: /Close Fiscal Year/ });
      await confirmDialog.getByRole('button', { name: 'Close Fiscal Year' }).click();

      await expect(detailsDialog.getByText('lock Closed')).toBeVisible();

      await detailsDialog.getByRole('button', { name: 'Close dialog' }).click();

      const fiscalYearRow = page.getByRole('row', { name: /FY 2025/ });
      await expect(fiscalYearRow.getByRole('button', { name: /Reverse/ })).toBeVisible();
    });

    test('shall open reversal dialog when clicking Reverse button', async function ({ page }) {
      await setupDatabaseAndNavigateToFiscalYears(page, tursoLibSQLiteServer().url);

      await page.getByRole('button', { name: 'New Fiscal Year' }).click();
      const creationDialog = page.getByRole('dialog', { name: 'Create Fiscal Year' });
      await creationDialog.getByLabel('Name (Optional)').fill('FY 2025');
      await creationDialog.getByLabel('Begin Date').fill('2025-01-01');
      await creationDialog.getByLabel('End Date').fill('2025-12-31');
      await creationDialog.getByRole('button', { name: 'Create' }).click();
      await expect(creationDialog).not.toBeVisible();

      await page.getByRole('button', { name: /FY 2025/ }).click();
      let detailsDialog = page.getByRole('dialog', { name: /Fiscal Year Details/ });
      await detailsDialog.getByRole('button', { name: 'Close Fiscal Year' }).click();
      const confirmCloseDialog = page.getByRole('alertdialog', { name: /Close Fiscal Year/ });
      await confirmCloseDialog.getByRole('button', { name: 'Close Fiscal Year' }).click();

      await expect(detailsDialog.getByText('lock Closed')).toBeVisible();

      await detailsDialog.getByRole('button', { name: 'Close dialog' }).click();

      const fiscalYearRow = page.getByRole('row', { name: /FY 2025/ });
      await fiscalYearRow.getByRole('button', { name: /Reverse/ }).click();

      const reversalDialog = page.getByRole('dialog', { name: 'FY 2025', exact: true });
      await expect(reversalDialog).toBeVisible();
    });

    test('shall display reversal warning in reversal dialog', async function ({ page }) {
      await setupDatabaseAndNavigateToFiscalYears(page, tursoLibSQLiteServer().url);

      await page.getByRole('button', { name: 'New Fiscal Year' }).click();
      const creationDialog = page.getByRole('dialog', { name: 'Create Fiscal Year' });
      await creationDialog.getByLabel('Name (Optional)').fill('FY 2025');
      await creationDialog.getByLabel('Begin Date').fill('2025-01-01');
      await creationDialog.getByLabel('End Date').fill('2025-12-31');
      await creationDialog.getByRole('button', { name: 'Create' }).click();
      await expect(creationDialog).not.toBeVisible();

      await page.getByRole('button', { name: /FY 2025/ }).click();
      const detailsDialog = page.getByRole('dialog', { name: /Fiscal Year Details/ });
      await detailsDialog.getByRole('button', { name: 'Close Fiscal Year' }).click();
      const confirmCloseDialog = page.getByRole('alertdialog', { name: /Close Fiscal Year/ });
      await confirmCloseDialog.getByRole('button', { name: 'Close Fiscal Year' }).click();
      await expect(detailsDialog.getByText('lock Closed')).toBeVisible();

      await detailsDialog.getByRole('button', { name: 'Close dialog' }).click();

      const fiscalYearRow = page.getByRole('row', { name: /FY 2025/ });
      await fiscalYearRow.getByRole('button', { name: /Reverse/ }).click();

      const reversalDialog = page.getByRole('dialog', { name: 'FY 2025', exact: true });
      await expect(reversalDialog.getByText('About Reversal')).toBeVisible();
      await expect(reversalDialog.getByText(/This should only be done if the fiscal year was closed incorrectly/)).toBeVisible();
    });

    test('shall show confirmation dialog when clicking Reverse Fiscal Year', async function ({ page }) {
      await setupDatabaseAndNavigateToFiscalYears(page, tursoLibSQLiteServer().url);

      await page.getByRole('button', { name: 'New Fiscal Year' }).click();
      const creationDialog = page.getByRole('dialog', { name: 'Create Fiscal Year' });
      await creationDialog.getByLabel('Name (Optional)').fill('FY 2025');
      await creationDialog.getByLabel('Begin Date').fill('2025-01-01');
      await creationDialog.getByLabel('End Date').fill('2025-12-31');
      await creationDialog.getByRole('button', { name: 'Create' }).click();
      await expect(creationDialog).not.toBeVisible();

      await page.getByRole('button', { name: /FY 2025/ }).click();
      const detailsDialog = page.getByRole('dialog', { name: /Fiscal Year Details/ });
      await detailsDialog.getByRole('button', { name: 'Close Fiscal Year' }).click();
      const confirmCloseDialog = page.getByRole('alertdialog', { name: /Close Fiscal Year/ });
      await confirmCloseDialog.getByRole('button', { name: 'Close Fiscal Year' }).click();
      await expect(detailsDialog.getByText('lock Closed')).toBeVisible();

      await detailsDialog.getByRole('button', { name: 'Close dialog' }).click();

      const fiscalYearRow = page.getByRole('row', { name: /FY 2025/ });
      await fiscalYearRow.getByRole('button', { name: /Reverse/ }).click();
      const reversalDialog = page.getByRole('dialog', { name: 'FY 2025', exact: true });
      await expect(reversalDialog).toBeVisible();

      await reversalDialog.getByRole('button', { name: 'Reverse Fiscal Year' }).click();

      const confirmReversalDialog = page.getByRole('alertdialog', { name: /Reverse Fiscal Year/ });
      await expect(confirmReversalDialog).toBeVisible();
      await expect(confirmReversalDialog.getByText(/Only proceed if you need to correct an incorrectly closed fiscal year/)).toBeVisible();
    });

    test('shall reverse fiscal year successfully', async function ({ page }) {
      await setupDatabaseAndNavigateToFiscalYears(page, tursoLibSQLiteServer().url);

      await page.getByRole('button', { name: 'New Fiscal Year' }).click();
      const creationDialog = page.getByRole('dialog', { name: 'Create Fiscal Year' });
      await creationDialog.getByLabel('Name (Optional)').fill('FY 2025');
      await creationDialog.getByLabel('Begin Date').fill('2025-01-01');
      await creationDialog.getByLabel('End Date').fill('2025-12-31');
      await creationDialog.getByRole('button', { name: 'Create' }).click();
      await expect(creationDialog).not.toBeVisible();

      await page.getByRole('button', { name: /FY 2025/ }).click();
      const detailsDialog = page.getByRole('dialog', { name: /Fiscal Year Details/ });
      await detailsDialog.getByRole('button', { name: 'Close Fiscal Year' }).click();
      const confirmCloseDialog = page.getByRole('alertdialog', { name: /Close Fiscal Year/ });
      await confirmCloseDialog.getByRole('button', { name: 'Close Fiscal Year' }).click();
      await expect(detailsDialog.getByText('lock Closed')).toBeVisible();

      await detailsDialog.getByRole('button', { name: 'Close dialog' }).click();

      const fiscalYearRow = page.getByRole('row', { name: /FY 2025/ });
      await fiscalYearRow.getByRole('button', { name: /Reverse/ }).click();
      const reversalDialog = page.getByRole('dialog', { name: 'FY 2025', exact: true });
      await reversalDialog.getByRole('button', { name: 'Reverse Fiscal Year' }).click();

      const confirmReversalDialog = page.getByRole('alertdialog', { name: /Reverse Fiscal Year/ });
      await confirmReversalDialog.getByRole('button', { name: 'Reverse Fiscal Year' }).click();

      await expect(reversalDialog.getByText('history Reversed')).toBeVisible();
      await expect(reversalDialog.getByText('Reversal Details')).toBeVisible();
    });

    test('shall update fiscal year status to Reversed in list after reversal', async function ({ page }) {
      await setupDatabaseAndNavigateToFiscalYears(page, tursoLibSQLiteServer().url);

      await page.getByRole('button', { name: 'New Fiscal Year' }).click();
      const creationDialog = page.getByRole('dialog', { name: 'Create Fiscal Year' });
      await creationDialog.getByLabel('Name (Optional)').fill('FY 2025');
      await creationDialog.getByLabel('Begin Date').fill('2025-01-01');
      await creationDialog.getByLabel('End Date').fill('2025-12-31');
      await creationDialog.getByRole('button', { name: 'Create' }).click();
      await expect(creationDialog).not.toBeVisible();

      await page.getByRole('button', { name: /FY 2025/ }).click();
      const detailsDialog = page.getByRole('dialog', { name: /Fiscal Year Details/ });
      await detailsDialog.getByRole('button', { name: 'Close Fiscal Year' }).click();
      const confirmCloseDialog = page.getByRole('alertdialog', { name: /Close Fiscal Year/ });
      await confirmCloseDialog.getByRole('button', { name: 'Close Fiscal Year' }).click();
      await expect(detailsDialog.getByText('lock Closed')).toBeVisible();

      await detailsDialog.getByRole('button', { name: 'Close dialog' }).click();

      const fiscalYearRow = page.getByRole('row', { name: /FY 2025/ });
      await fiscalYearRow.getByRole('button', { name: /Reverse/ }).click();
      const reversalDialog = page.getByRole('dialog', { name: 'FY 2025', exact: true });
      await reversalDialog.getByRole('button', { name: 'Reverse Fiscal Year' }).click();
      const confirmReversalDialog = page.getByRole('alertdialog', { name: /Reverse Fiscal Year/ });
      await confirmReversalDialog.getByRole('button', { name: 'Reverse Fiscal Year' }).click();

      await expect(reversalDialog.getByText('history Reversed')).toBeVisible();

      await reversalDialog.getByRole('button', { name: 'Close dialog' }).click();

      await expect(fiscalYearRow.locator('span.label-small', { hasText: 'Reversed' })).toBeVisible();
    });

    test('shall not show Reverse button for reversed fiscal year', async function ({ page }) {
      await setupDatabaseAndNavigateToFiscalYears(page, tursoLibSQLiteServer().url);

      await page.getByRole('button', { name: 'New Fiscal Year' }).click();
      const creationDialog = page.getByRole('dialog', { name: 'Create Fiscal Year' });
      await creationDialog.getByLabel('Name (Optional)').fill('FY 2025');
      await creationDialog.getByLabel('Begin Date').fill('2025-01-01');
      await creationDialog.getByLabel('End Date').fill('2025-12-31');
      await creationDialog.getByRole('button', { name: 'Create' }).click();
      await expect(creationDialog).not.toBeVisible();

      await page.getByRole('button', { name: /FY 2025/ }).click();
      let detailsDialog = page.getByRole('dialog', { name: /Fiscal Year Details/ });
      await detailsDialog.getByRole('button', { name: 'Close Fiscal Year' }).click();
      const confirmCloseDialog = page.getByRole('alertdialog', { name: /Close Fiscal Year/ });
      await confirmCloseDialog.getByRole('button', { name: 'Close Fiscal Year' }).click();
      await expect(detailsDialog.getByText('lock Closed')).toBeVisible();

      await detailsDialog.getByRole('button', { name: 'Close dialog' }).click();

      const fiscalYearRow = page.getByRole('row', { name: /FY 2025/ });
      await fiscalYearRow.getByRole('button', { name: /Reverse/ }).click();
      const reversalDialog = page.getByRole('dialog', { name: 'FY 2025', exact: true });
      await reversalDialog.getByRole('button', { name: 'Reverse Fiscal Year' }).click();
      const confirmReversalDialog = page.getByRole('alertdialog', { name: /Reverse Fiscal Year/ });
      await confirmReversalDialog.getByRole('button', { name: 'Reverse Fiscal Year' }).click();
      await expect(reversalDialog.getByText('history Reversed')).toBeVisible();

      await reversalDialog.getByRole('button', { name: 'Close dialog' }).click();

      await expect(fiscalYearRow.getByRole('button', { name: /Reverse/ })).not.toBeVisible();

      await page.getByRole('button', { name: /FY 2025/ }).click();
      detailsDialog = page.getByRole('dialog', { name: /Fiscal Year Details/ });
      await expect(detailsDialog.getByText('history Reversed')).toBeVisible();
    });

    test('shall display reversal details for reversed fiscal year', async function ({ page }) {
      await setupDatabaseAndNavigateToFiscalYears(page, tursoLibSQLiteServer().url);

      await page.getByRole('button', { name: 'New Fiscal Year' }).click();
      const creationDialog = page.getByRole('dialog', { name: 'Create Fiscal Year' });
      await creationDialog.getByLabel('Name (Optional)').fill('FY 2025');
      await creationDialog.getByLabel('Begin Date').fill('2025-01-01');
      await creationDialog.getByLabel('End Date').fill('2025-12-31');
      await creationDialog.getByRole('button', { name: 'Create' }).click();
      await expect(creationDialog).not.toBeVisible();

      await page.getByRole('button', { name: /FY 2025/ }).click();
      const detailsDialog = page.getByRole('dialog', { name: /Fiscal Year Details/ });
      await detailsDialog.getByRole('button', { name: 'Close Fiscal Year' }).click();
      const confirmCloseDialog = page.getByRole('alertdialog', { name: /Close Fiscal Year/ });
      await confirmCloseDialog.getByRole('button', { name: 'Close Fiscal Year' }).click();
      await expect(detailsDialog.getByText('lock Closed')).toBeVisible();

      await detailsDialog.getByRole('button', { name: 'Close dialog' }).click();

      const fiscalYearRow = page.getByRole('row', { name: /FY 2025/ });
      await fiscalYearRow.getByRole('button', { name: /Reverse/ }).click();
      const reversalDialog = page.getByRole('dialog', { name: 'FY 2025', exact: true });
      await reversalDialog.getByRole('button', { name: 'Reverse Fiscal Year' }).click();
      const confirmReversalDialog = page.getByRole('alertdialog', { name: /Reverse Fiscal Year/ });
      await confirmReversalDialog.getByRole('button', { name: 'Reverse Fiscal Year' }).click();
      await expect(reversalDialog.getByText('history Reversed')).toBeVisible();

      await reversalDialog.getByRole('button', { name: 'Close dialog' }).click();
      await page.getByRole('button', { name: /FY 2025/ }).click();

      const reopenedDialog = page.getByRole('dialog', { name: /Fiscal Year Details/ });
      await expect(reopenedDialog.getByText('Reversal Details')).toBeVisible();
      await expect(reopenedDialog.getByText('Reversed On')).toBeVisible();
    });
  });
});
