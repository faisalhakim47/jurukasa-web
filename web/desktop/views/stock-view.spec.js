import { expect } from '@playwright/test';
import { jurukasaTest } from '#test/playwright/test-setup.js';
import { useTursoLibSQLiteServer } from '#test/playwright/hooks/use-turso-libsqlite-server.js';
import { loadEmptyFixture } from '#test/playwright/tools/fixture.js';
import { useStrict } from '#test/playwright/hooks/use-strict.js';

const test = jurukasaTest;
const { describe } = test;

/**
 * @param {string} tursoDatabaseUrl
 */
async function setupStockView(tursoDatabaseUrl) {
  window.history.replaceState({}, '', '/stock/inventories');
  document.body.innerHTML = `
    <ready-context>
      <router-context>
        <database-context provider="turso" name="My Business" turso-url=${tursoDatabaseUrl}>
          <device-context>
            <i18n-context>
              <stock-view></stock-view>
            </i18n-context>
          </device-context>
        </database-context>
      </router-context>
    </ready-context>
  `;
};

function navigateToInvalidStockRoute() {
  /** @type {import('#web/contexts/router-context.js').RouterContextElement} */
  const router = document.querySelector('router-context');
  router.navigate({ pathname: '/stock/invalid-route' });
}

describe('Stock View', function () {
  useStrict(test);
  const tursoLibSQLiteServer = useTursoLibSQLiteServer(test);

  test('shall display stock view with navigation tabs and default inventories panel', async function ({ page }) {
    await loadEmptyFixture(page);
    await page.evaluate(setupStockView, tursoLibSQLiteServer().url);

    await expect(page.getByRole('heading', { level: 1 }), 'it shall display page header').toBeVisible();
    await expect(page.getByRole('tablist'), 'it shall display tab navigation').toBeVisible();
    await expect(page.getByRole('tab', { name: 'Inventories' }), 'it shall display inventories tab').toBeVisible();
    await expect(page.getByRole('tab', { name: 'Barcodes' }), 'it shall display barcodes tab').toBeVisible();
    await expect(page.getByRole('tab', { name: 'Stock Takings' }), 'it shall display stock takings tab').toBeVisible();
    await expect(page.getByRole('tabpanel', { name: 'Inventories' }), 'it shall display inventories panel by default').toBeVisible();
  });

  test('shall navigate to barcodes panel when barcodes tab is clicked', async function ({ page }) {
    await loadEmptyFixture(page);
    await page.evaluate(setupStockView, tursoLibSQLiteServer().url);

    await page.getByRole('tab', { name: 'Barcodes' }).click();

    await expect(page.getByRole('tabpanel', { name: 'Barcodes' }), 'it shall display barcodes panel').toBeVisible();
  });

  test('shall navigate to stock takings panel when stock takings tab is clicked', async function ({ page }) {
    await loadEmptyFixture(page);
    await page.evaluate(setupStockView, tursoLibSQLiteServer().url);

    await page.getByRole('tab', { name: 'Stock Takings' }).click();

    await expect(page.getByRole('tabpanel', { name: 'Stock Takings' }), 'it shall display stock takings panel').toBeVisible();
  });

  test('shall display not found dialog for invalid stock routes', async function ({ page }) {
    await loadEmptyFixture(page);
    await page.evaluate(setupStockView, tursoLibSQLiteServer().url);

    await page.evaluate(navigateToInvalidStockRoute);

    await expect(page.getByRole('dialog'), 'it shall display not found dialog for invalid routes').toBeVisible();
  });
});
