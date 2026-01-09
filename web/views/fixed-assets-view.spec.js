import { expect, test } from '@playwright/test';
import { useTursoLibSQLiteServer } from '#test/hooks/use-turso-libsqlite-server.js';
import { useConsoleOutput } from '#test/hooks/use-console-output.js';
import { useStrict } from '#test/hooks/use-strict.js';
const { describe } = test;

describe('Fixed Assets', function () {
  // useConsoleOutput(test);
  useStrict(test);

  /**
   * @param {import('@playwright/test').Page} page
   * @param {string} tursoLibSQLiteServerUrl
   */
  async function setupDatabaseAndNavigateToFixedAssets(page, tursoLibSQLiteServerUrl) {
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

    await page.getByRole('tab', { name: 'Fixed Assets' }).click();
    await expect(page.getByRole('tab', { name: 'Fixed Assets' })).toHaveAttribute('aria-selected', 'true');
  }

  describe('Fixed Assets Tab Navigation', function () {
    const tursoLibSQLiteServer = useTursoLibSQLiteServer(test);

    test('shall display Fixed Assets tab in navigation', async function ({ page }) {
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

      await expect(page.getByRole('tab', { name: 'Fixed Assets' })).toBeVisible();
    });

    test('shall switch to Fixed Assets tab when clicked', async function ({ page }) {
      await setupDatabaseAndNavigateToFixedAssets(page, tursoLibSQLiteServer().url);

      await expect(page.getByRole('tab', { name: 'Fixed Assets' })).toHaveAttribute('aria-selected', 'true');
      await expect(page.getByRole('tab', { name: 'Journal Entries' })).toHaveAttribute('aria-selected', 'false');
    });
  });

  describe('Fixed Assets Display', function () {
    const tursoLibSQLiteServer = useTursoLibSQLiteServer(test);

    test('shall display empty state when no fixed assets exist', async function ({ page }) {
      await setupDatabaseAndNavigateToFixedAssets(page, tursoLibSQLiteServer().url);

      const fixedAssetsPanel = page.getByRole('tabpanel', { name: 'Fixed Assets' });
      await expect(fixedAssetsPanel.getByRole('heading', { name: 'No fixed assets found' })).toBeVisible();
      await expect(fixedAssetsPanel.getByText('Start by recording your first fixed asset to track depreciation.')).toBeVisible();
    });

    test('shall display Add Fixed Asset button', async function ({ page }) {
      await setupDatabaseAndNavigateToFixedAssets(page, tursoLibSQLiteServer().url);

      const fixedAssetsPanel = page.getByRole('tabpanel', { name: 'Fixed Assets' });
      await expect(fixedAssetsPanel.getByRole('button', { name: 'Add Fixed Asset' })).toBeVisible();
    });

    test('shall display Refresh button', async function ({ page }) {
      await setupDatabaseAndNavigateToFixedAssets(page, tursoLibSQLiteServer().url);

      const fixedAssetsPanel = page.getByRole('tabpanel', { name: 'Fixed Assets' });
      await expect(fixedAssetsPanel.getByRole('button', { name: 'Refresh' })).toBeVisible();
    });

    test('shall display search field', async function ({ page }) {
      await setupDatabaseAndNavigateToFixedAssets(page, tursoLibSQLiteServer().url);

      const fixedAssetsPanel = page.getByRole('tabpanel', { name: 'Fixed Assets' });
      await expect(fixedAssetsPanel.getByLabel('Search', { exact: true })).toBeVisible();
    });

    test('shall display status filter', async function ({ page }) {
      await setupDatabaseAndNavigateToFixedAssets(page, tursoLibSQLiteServer().url);

      const fixedAssetsPanel = page.getByRole('tabpanel', { name: 'Fixed Assets' });
      await expect(fixedAssetsPanel.getByLabel('Status')).toBeVisible();
    });
  });

  describe('Fixed Asset Creation', function () {
    const tursoLibSQLiteServer = useTursoLibSQLiteServer(test);

    test('shall open creation dialog when clicking Add Fixed Asset button', async function ({ page }) {
      await setupDatabaseAndNavigateToFixedAssets(page, tursoLibSQLiteServer().url);

      await page.getByRole('button', { name: 'Add Fixed Asset' }).click();

      await expect(page.getByRole('dialog', { name: 'Add Fixed Asset' })).toBeVisible();
    });

    test('shall display form fields in creation dialog', async function ({ page }) {
      await setupDatabaseAndNavigateToFixedAssets(page, tursoLibSQLiteServer().url);

      await page.getByRole('button', { name: 'Add Fixed Asset' }).click();
      const dialog = page.getByRole('dialog', { name: 'Add Fixed Asset' });

      await expect(dialog.getByLabel('Asset Name')).toBeVisible();
      await expect(dialog.getByLabel('Description (Optional)')).toBeVisible();
      await expect(dialog.getByLabel('Acquisition Date')).toBeVisible();
      await expect(dialog.getByLabel('Acquisition Cost')).toBeVisible();
      await expect(dialog.getByLabel('Useful Life (Years)')).toBeVisible();
      await expect(dialog.getByLabel('Salvage Value')).toBeVisible();
      await expect(dialog.getByLabel('Fixed Asset Account')).toBeVisible();
      await expect(dialog.getByLabel('Accumulated Depreciation Account')).toBeVisible();
      await expect(dialog.getByLabel('Depreciation Expense Account')).toBeVisible();
      await expect(dialog.getByLabel('Payment Account')).toBeVisible();
      await expect(dialog.getByRole('button', { name: 'Add Asset' })).toBeVisible();
    });

    test('shall close creation dialog when clicking close button', async function ({ page }) {
      await setupDatabaseAndNavigateToFixedAssets(page, tursoLibSQLiteServer().url);

      await page.getByRole('button', { name: 'Add Fixed Asset' }).click();
      const dialog = page.getByRole('dialog', { name: 'Add Fixed Asset' });
      await expect(dialog).toBeVisible();

      await dialog.getByRole('button', { name: 'Close' }).click();

      await expect(dialog).not.toBeVisible();
    });
  });

  describe('Fixed Asset Filtering', function () {
    const tursoLibSQLiteServer = useTursoLibSQLiteServer(test);

    test('shall display All filter option by default', async function ({ page }) {
      await setupDatabaseAndNavigateToFixedAssets(page, tursoLibSQLiteServer().url);

      const fixedAssetsPanel = page.getByRole('tabpanel', { name: 'Fixed Assets' });
      await expect(fixedAssetsPanel.getByLabel('Status')).toHaveValue('All');
    });

    test('shall show filter options in dropdown menu', async function ({ page }) {
      await setupDatabaseAndNavigateToFixedAssets(page, tursoLibSQLiteServer().url);

      const fixedAssetsPanel = page.getByRole('tabpanel', { name: 'Fixed Assets' });
      await fixedAssetsPanel.getByLabel('Status').click();

      await expect(page.getByRole('menuitem', { name: 'All' })).toBeVisible();
      await expect(page.getByRole('menuitem', { name: 'Active' })).toBeVisible();
      await expect(page.getByRole('menuitem', { name: 'Fully Depreciated' })).toBeVisible();
    });
  });

  describe('Fixed Asset Refresh', function () {
    const tursoLibSQLiteServer = useTursoLibSQLiteServer(test);

    test('shall reload fixed assets when clicking Refresh button', async function ({ page }) {
      await setupDatabaseAndNavigateToFixedAssets(page, tursoLibSQLiteServer().url);

      const fixedAssetsPanel = page.getByRole('tabpanel', { name: 'Fixed Assets' });
      await fixedAssetsPanel.getByRole('button', { name: 'Refresh' }).click();

      // After refresh, the view should still show empty state (no assets yet)
      await expect(fixedAssetsPanel.getByRole('heading', { name: 'No fixed assets found' })).toBeVisible();
    });
  });
});
