import { expect, test } from '@playwright/test';
import { useTursoLibSQLiteServer } from '#test/hooks/use-turso-libsqlite-server.js';
import { loadEmptyFixture } from '#test/tools/fixture.js';
import { useStrict } from '#test/hooks/use-strict.js';

const { describe } = test;

/**
 * @param {string} tursoDatabaseUrl
 */
async function setupStockView(tursoDatabaseUrl) {
  window.history.replaceState({}, '', '/stock/inventories');
  document.body.innerHTML = `
    <ready-context>
      <router-context>
        <database-context provider="turso" turso-url=${tursoDatabaseUrl}>
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

describe('Stock View', function () {
  useStrict(test);
  const tursoLibSQLiteServer = useTursoLibSQLiteServer(test);

  describe('Stock View Navigation', function () {
    test('shall display inventories tab by default', async function ({ page }) {
      await loadEmptyFixture(page);
      await page.evaluate(setupStockView, tursoLibSQLiteServer().url);

      await expect(page.getByRole('tab', { name: 'Inventories' })).toBeVisible();
    });

    test('shall display barcodes tab', async function ({ page }) {
      await loadEmptyFixture(page);
      await page.evaluate(setupStockView, tursoLibSQLiteServer().url);

      await expect(page.getByRole('tab', { name: 'Barcodes' })).toBeVisible();
    });

    test('shall display stock takings tab', async function ({ page }) {
      await loadEmptyFixture(page);
      await page.evaluate(setupStockView, tursoLibSQLiteServer().url);

      await expect(page.getByRole('tab', { name: 'Stock Takings' })).toBeVisible();
    });

    test('shall navigate to inventories panel when inventories tab is clicked', async function ({ page }) {
      await loadEmptyFixture(page);
      await page.evaluate(setupStockView, tursoLibSQLiteServer().url);

      await page.getByRole('tab', { name: 'Inventories' }).click();

      await expect(page.getByRole('tabpanel', { name: 'Inventories' })).toBeVisible();
    });

    test('shall navigate to barcodes panel when barcodes tab is clicked', async function ({ page }) {
      await loadEmptyFixture(page);
      await page.evaluate(setupStockView, tursoLibSQLiteServer().url);

      await page.getByRole('tab', { name: 'Barcodes' }).click();

      await expect(page.getByRole('tabpanel', { name: 'Barcodes' })).toBeVisible();
    });

    test('shall navigate to stock takings panel when stock takings tab is clicked', async function ({ page }) {
      await loadEmptyFixture(page);
      await page.evaluate(setupStockView, tursoLibSQLiteServer().url);

      await page.getByRole('tab', { name: 'Stock Takings' }).click();

      await expect(page.getByRole('tabpanel', { name: 'Stock Takings' })).toBeVisible();
    });
  });

  describe('Stock View Page Display', function () {
    test('shall display page header', async function ({ page }) {
      await loadEmptyFixture(page);
      await page.evaluate(setupStockView, tursoLibSQLiteServer().url);

      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    });

    test('shall display tab navigation', async function ({ page }) {
      await loadEmptyFixture(page);
      await page.evaluate(setupStockView, tursoLibSQLiteServer().url);

      await expect(page.getByRole('tablist')).toBeVisible();
    });
  });

  describe('Stock View Tab Panels', function () {
    test('shall render inventories-view component in inventories panel', async function ({ page }) {
      await loadEmptyFixture(page);
      await page.evaluate(setupStockView, tursoLibSQLiteServer().url);

      await page.getByRole('tab', { name: 'Inventories' }).click();

      const inventoriesPanel = page.getByRole('tabpanel', { name: 'Inventories' });
      await expect(inventoriesPanel).toBeVisible();
    });

    test('shall render barcodes-view component in barcodes panel', async function ({ page }) {
      await loadEmptyFixture(page);
      await page.evaluate(setupStockView, tursoLibSQLiteServer().url);

      await page.getByRole('tab', { name: 'Barcodes' }).click();

      const barcodesPanel = page.getByRole('tabpanel', { name: 'Barcodes' });
      await expect(barcodesPanel).toBeVisible();
    });

    test('shall render stock-takings-view component in stock takings panel', async function ({ page }) {
      await loadEmptyFixture(page);
      await page.evaluate(setupStockView, tursoLibSQLiteServer().url);

      await page.getByRole('tab', { name: 'Stock Takings' }).click();

      const stockTakingsPanel = page.getByRole('tabpanel', { name: 'Stock Takings' });
      await expect(stockTakingsPanel).toBeVisible();
    });
  });

  describe('Stock View Error Handling', function () {
    test('shall display not found dialog for invalid routes', async function ({ page }) {
      await loadEmptyFixture(page);
      await page.evaluate(setupStockView, tursoLibSQLiteServer().url);

      await page.evaluate(async function () {
        /** @type {import('#web/contexts/router-context.js').RouterContextElement} */
        const router = document.querySelector('router-context');
        router.navigate({ pathname: '/stock/invalid-route' });
      });

      await expect(page.getByRole('dialog')).toBeVisible();
    });
  });
});
