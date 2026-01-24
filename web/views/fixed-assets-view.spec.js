import { expect, test } from '@playwright/test';
import { useTursoLibSQLiteServer } from '#test/playwright/hooks/use-turso-libsqlite-server.js';
import { loadEmptyFixture } from '#test/playwright/tools/fixture.js';
import { setupDatabase } from '#test/playwright/tools/database.js';
import { useStrict } from '#test/playwright/hooks/use-strict.js';

const { describe } = test;

/**
 * @param {string} tursoDatabaseUrl
 */
async function setupView(tursoDatabaseUrl) {
  window.history.replaceState({}, '', '/books/fixed-assets');
  document.body.innerHTML = `
    <ready-context>
      <router-context>
        <database-context provider="turso" turso-url=${tursoDatabaseUrl}>
          <device-context>
            <i18n-context>
              <fixed-assets-view></fixed-assets-view>
            </i18n-context>
          </device-context>
        </database-context>
      </router-context>
    </ready-context>
  `;
}

describe('Fixed Assets', function () {
  // useConsoleOutput(test);
  useStrict(test);

  const tursoLibSQLiteServer = useTursoLibSQLiteServer(test);

  describe('Fixed Assets Display', function () {
    test('shall display empty state when no fixed assets exist', async function ({ page }) {
      await Promise.all([
        loadEmptyFixture(page),
        setupDatabase(tursoLibSQLiteServer(), async function setupData() {}),
      ]);

      await page.evaluate(setupView, tursoLibSQLiteServer().url);

      await expect(page.getByRole('heading', { name: 'No fixed assets found' })).toBeVisible();
      await expect(page.getByText('Start by recording your first fixed asset to track depreciation.')).toBeVisible();
    });

    test('shall display Add Fixed Asset button', async function ({ page }) {
      await Promise.all([
        loadEmptyFixture(page),
        setupDatabase(tursoLibSQLiteServer(), async function setupData() {}),
      ]);

      await page.evaluate(setupView, tursoLibSQLiteServer().url);

      await expect(page.getByRole('button', { name: 'Add Fixed Asset' })).toBeVisible();
    });

    test('shall display Refresh button', async function ({ page }) {
      await Promise.all([
        loadEmptyFixture(page),
        setupDatabase(tursoLibSQLiteServer(), async function setupData() {}),
      ]);

      await page.evaluate(setupView, tursoLibSQLiteServer().url);

      await expect(page.getByRole('button', { name: 'Refresh' })).toBeVisible();
    });

    test('shall display search field', async function ({ page }) {
      await Promise.all([
        loadEmptyFixture(page),
        setupDatabase(tursoLibSQLiteServer(), async function setupData() {}),
      ]);

      await page.evaluate(setupView, tursoLibSQLiteServer().url);

      await expect(page.getByLabel('Search', { exact: true })).toBeVisible();
    });

    test('shall display status filter', async function ({ page }) {
      await Promise.all([
        loadEmptyFixture(page),
        setupDatabase(tursoLibSQLiteServer(), async function setupData() {}),
      ]);

      await page.evaluate(setupView, tursoLibSQLiteServer().url);

      await expect(page.getByLabel('Status')).toBeVisible();
    });
  });

  describe('Fixed Asset Creation', function () {
    test('shall open creation dialog when clicking Add Fixed Asset button', async function ({ page }) {
      await Promise.all([
        loadEmptyFixture(page),
        setupDatabase(tursoLibSQLiteServer(), async function setupData() {}),
      ]);

      await page.evaluate(setupView, tursoLibSQLiteServer().url);

      await page.getByRole('button', { name: 'Add Fixed Asset' }).click();

      await expect(page.getByRole('dialog', { name: 'Add Fixed Asset' })).toBeVisible();
    });

    test('shall display form fields in creation dialog', async function ({ page }) {
      await Promise.all([
        loadEmptyFixture(page),
        setupDatabase(tursoLibSQLiteServer(), async function setupData() {}),
      ]);

      await page.evaluate(setupView, tursoLibSQLiteServer().url);

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
      await Promise.all([
        loadEmptyFixture(page),
        setupDatabase(tursoLibSQLiteServer(), async function setupData() {}),
      ]);

      await page.evaluate(setupView, tursoLibSQLiteServer().url);

      await page.getByRole('button', { name: 'Add Fixed Asset' }).click();
      const dialog = page.getByRole('dialog', { name: 'Add Fixed Asset' });
      await expect(dialog).toBeVisible();

      await dialog.getByRole('button', { name: 'Close' }).click();

      await expect(dialog).not.toBeVisible();
    });
  });

  describe('Fixed Asset Filtering', function () {
    test('shall display All filter option by default', async function ({ page }) {
      await Promise.all([
        loadEmptyFixture(page),
        setupDatabase(tursoLibSQLiteServer(), async function setupData() {}),
      ]);

      await page.evaluate(setupView, tursoLibSQLiteServer().url);

      await expect(page.getByLabel('Status')).toHaveValue('All');
    });

    test('shall show filter options in dropdown menu', async function ({ page }) {
      await Promise.all([
        loadEmptyFixture(page),
        setupDatabase(tursoLibSQLiteServer(), async function setupData() {}),
      ]);

      await page.evaluate(setupView, tursoLibSQLiteServer().url);

      await page.getByLabel('Status').click();

      await expect(page.getByRole('menuitem', { name: 'All' })).toBeVisible();
      await expect(page.getByRole('menuitem', { name: 'Active' })).toBeVisible();
      await expect(page.getByRole('menuitem', { name: 'Fully Depreciated' })).toBeVisible();
    });
  });

  describe('Fixed Asset Refresh', function () {
    test('shall reload fixed assets when clicking Refresh button', async function ({ page }) {
      await Promise.all([
        loadEmptyFixture(page),
        setupDatabase(tursoLibSQLiteServer(), async function setupData() {}),
      ]);

      await page.evaluate(setupView, tursoLibSQLiteServer().url);

      await page.getByRole('button', { name: 'Refresh' }).click();

      // After refresh, the view should still show empty state (no assets yet)
      await expect(page.getByRole('heading', { name: 'No fixed assets found' })).toBeVisible();
    });
  });
});
