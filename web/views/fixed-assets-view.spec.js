import { expect } from '@playwright/test';
import { jurukasaTest } from '#test/playwright/test-setup.js';
import { useTursoLibSQLiteServer } from '#test/playwright/hooks/use-turso-libsqlite-server.js';
import { loadEmptyFixture } from '#test/playwright/tools/fixture.js';
import { setupDatabase } from '#test/playwright/tools/database.js';
import { useStrict } from '#test/playwright/hooks/use-strict.js';
import { useConsoleOutput } from '#test/playwright/hooks/use-console-output.js';

const test = jurukasaTest;
const { describe } = test;

/**
 * @param {string} tursoDatabaseUrl
 */
async function setupView(tursoDatabaseUrl) {
  window.history.replaceState({}, '', '/books/fixed-assets');
  document.body.innerHTML = `
    <ready-context>
      <router-context>
        <database-context provider="turso" name="My Business" turso-url=${tursoDatabaseUrl}>
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
  useConsoleOutput(test);
  useStrict(test);
  const tursoLibSQLiteServer = useTursoLibSQLiteServer(test);

  test('displays empty state with controls when no fixed assets exist', async function ({ page }) {
    await Promise.all([
      loadEmptyFixture(page),
      setupDatabase(tursoLibSQLiteServer(), async function setupData() {}),
    ]);

    await page.evaluate(setupView, tursoLibSQLiteServer().url);

    await expect(page.getByRole('heading', { name: 'No fixed assets found' }), 'it shall display empty state heading').toBeVisible();
    await expect(page.getByText('Start by recording your first fixed asset to track depreciation.'), 'it shall display empty state description').toBeVisible();
    await expect(page.getByRole('button', { name: 'Add Fixed Asset' }), 'it shall display Add Fixed Asset button').toBeVisible();
    await expect(page.getByRole('button', { name: 'Refresh' }), 'it shall display Refresh button').toBeVisible();
    await expect(page.getByLabel('Search', { exact: true }), 'it shall display search field').toBeVisible();
    await expect(page.getByLabel('Status'), 'it shall display status filter').toBeVisible();
    await expect(page.getByLabel('Status'), 'it shall have All filter option by default').toHaveValue('All');
  });

  test('opens creation dialog with all form fields when clicking Add Fixed Asset', async function ({ page }) {
    await Promise.all([
      loadEmptyFixture(page),
      setupDatabase(tursoLibSQLiteServer(), async function setupData() {}),
    ]);

    await page.evaluate(setupView, tursoLibSQLiteServer().url);

    await page.getByRole('button', { name: 'Add Fixed Asset' }).click();

    const dialog = page.getByRole('dialog', { name: 'Add Fixed Asset' });
    await expect(dialog, 'it shall open creation dialog').toBeVisible();
    await expect(dialog.getByLabel('Asset Name'), 'it shall display Asset Name field').toBeVisible();
    await expect(dialog.getByLabel('Description (Optional)'), 'it shall display Description field').toBeVisible();
    await expect(dialog.getByLabel('Acquisition Date'), 'it shall display Acquisition Date field').toBeVisible();
    await expect(dialog.getByLabel('Acquisition Cost'), 'it shall display Acquisition Cost field').toBeVisible();
    await expect(dialog.getByLabel('Useful Life (Years)'), 'it shall display Useful Life field').toBeVisible();
    await expect(dialog.getByLabel('Salvage Value'), 'it shall display Salvage Value field').toBeVisible();
    await expect(dialog.getByLabel('Fixed Asset Account'), 'it shall display Fixed Asset Account field').toBeVisible();
    await expect(dialog.getByLabel('Accumulated Depreciation Account'), 'it shall display Accumulated Depreciation Account field').toBeVisible();
    await expect(dialog.getByLabel('Depreciation Expense Account'), 'it shall display Depreciation Expense Account field').toBeVisible();
    await expect(dialog.getByLabel('Payment Account'), 'it shall display Payment Account field').toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Add Asset' }), 'it shall display Add Asset button').toBeVisible();

    await dialog.getByRole('button', { name: 'Close' }).click();
    await expect(dialog, 'it shall close creation dialog when clicking close button').not.toBeVisible();
  });

  test('shows filter options in dropdown menu', async function ({ page }) {
    await Promise.all([
      loadEmptyFixture(page),
      setupDatabase(tursoLibSQLiteServer(), async function setupData() {}),
    ]);

    await page.evaluate(setupView, tursoLibSQLiteServer().url);

    await page.getByLabel('Status').click();

    await expect(page.getByRole('menuitem', { name: 'All' }), 'it shall display All filter option').toBeVisible();
    await expect(page.getByRole('menuitem', { name: 'Active' }), 'it shall display Active filter option').toBeVisible();
    await expect(page.getByRole('menuitem', { name: 'Fully Depreciated' }), 'it shall display Fully Depreciated filter option').toBeVisible();
  });

  test('reloads fixed assets when clicking Refresh button', async function ({ page }) {
    await Promise.all([
      loadEmptyFixture(page),
      setupDatabase(tursoLibSQLiteServer(), async function setupData() {}),
    ]);

    await page.evaluate(setupView, tursoLibSQLiteServer().url);

    await page.getByRole('button', { name: 'Refresh' }).click();

    await expect(page.getByRole('heading', { name: 'No fixed assets found' }), 'it shall still show empty state after refresh').toBeVisible();
  });
});
