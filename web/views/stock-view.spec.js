import { expect, test } from '@playwright/test';
import { useTursoLibSQLiteServer } from '#test/hooks/use-turso-libsqlite-server.js';
import { loadEmptyFixture } from '#test/tools/fixture.js';
/** @import { Page } from '@playwright/test' */

const { describe } = test;

/**
 * @param {string} tursoDatabaseUrl
 */
async function setupStockView(tursoDatabaseUrl) {
  await customElements.whenDefined('stock-view');
  await customElements.whenDefined('inventories-view');
  await customElements.whenDefined('barcodes-view');
  await customElements.whenDefined('stock-takings-view');
  localStorage.setItem('tursoDatabaseUrl', tursoDatabaseUrl);
  localStorage.setItem('tursoDatabaseKey', '');
  document.body.innerHTML = `
    <ready-context>
      <router-context>
        <database-context>
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
  const tursoLibSQLiteServer = useTursoLibSQLiteServer(test);

  describe('Stock View Navigation', function () {
    test('shall display inventories tab by default', async function ({ page }) {
      await loadEmptyFixture(page);
      await page.evaluate(setupStockView, tursoLibSQLiteServer().url);

      // Verify inventories tab is visible
      await expect(page.getByRole('tab', { name: /inventories/i })).toBeVisible();
    });

    test('shall display barcodes tab', async function ({ page }) {
      await loadEmptyFixture(page);
      await page.evaluate(setupStockView, tursoLibSQLiteServer().url);

      // Verify barcodes tab is visible
      await expect(page.getByRole('tab', { name: /barcodes/i })).toBeVisible();
    });

    test('shall display stock takings tab', async function ({ page }) {
      await loadEmptyFixture(page);
      await page.evaluate(setupStockView, tursoLibSQLiteServer().url);

      // Verify stock takings tab is visible
      await expect(page.getByRole('tab', { name: /stock takings/i })).toBeVisible();
    });

    test('shall navigate to inventories panel when inventories tab is clicked', async function ({ page }) {
      await loadEmptyFixture(page);
      await page.evaluate(setupStockView, tursoLibSQLiteServer().url);

      // Click inventories tab
      await page.getByRole('tab', { name: /inventories/i }).click();

      // Verify inventories panel is visible
      await expect(page.getByRole('tabpanel', { name: /inventories/i })).toBeVisible();
    });

    test('shall navigate to barcodes panel when barcodes tab is clicked', async function ({ page }) {
      await loadEmptyFixture(page);
      await page.evaluate(setupStockView, tursoLibSQLiteServer().url);

      // Click barcodes tab
      await page.getByRole('tab', { name: /barcodes/i }).click();

      // Verify barcodes panel is visible
      await expect(page.getByRole('tabpanel', { name: /barcodes/i })).toBeVisible();
    });

    test('shall navigate to stock takings panel when stock takings tab is clicked', async function ({ page }) {
      await loadEmptyFixture(page);
      await page.evaluate(setupStockView, tursoLibSQLiteServer().url);

      // Click stock takings tab
      await page.getByRole('tab', { name: /stock takings/i }).click();

      // Verify stock takings panel is visible
      await expect(page.getByRole('tabpanel', { name: /stock takings/i })).toBeVisible();
    });
  });

  describe('Stock View Page Display', function () {
    test('shall display page header', async function ({ page }) {
      await loadEmptyFixture(page);
      await page.evaluate(setupStockView, tursoLibSQLiteServer().url);

      // Verify page header is visible
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    });

    test('shall display tab navigation', async function ({ page }) {
      await loadEmptyFixture(page);
      await page.evaluate(setupStockView, tursoLibSQLiteServer().url);

      // Verify tab list is visible
      await expect(page.getByRole('tablist')).toBeVisible();
    });
  });

  describe('Stock View Tab Panels', function () {
    test('shall render inventories-view component in inventories panel', async function ({ page }) {
      await loadEmptyFixture(page);
      await page.evaluate(setupStockView, tursoLibSQLiteServer().url);

      // Click inventories tab
      await page.getByRole('tab', { name: /inventories/i }).click();

      // Verify inventories panel contains inventories content
      const inventoriesPanel = page.getByRole('tabpanel', { name: /inventories/i });
      await expect(inventoriesPanel).toBeVisible();
    });

    test('shall render barcodes-view component in barcodes panel', async function ({ page }) {
      await loadEmptyFixture(page);
      await page.evaluate(setupStockView, tursoLibSQLiteServer().url);

      // Click barcodes tab
      await page.getByRole('tab', { name: /barcodes/i }).click();

      // Verify barcodes panel contains barcodes content
      const barcodesPanel = page.getByRole('tabpanel', { name: /barcodes/i });
      await expect(barcodesPanel).toBeVisible();
    });

    test('shall render stock-takings-view component in stock takings panel', async function ({ page }) {
      await loadEmptyFixture(page);
      await page.evaluate(setupStockView, tursoLibSQLiteServer().url);

      // Click stock takings tab
      await page.getByRole('tab', { name: /stock takings/i }).click();

      // Verify stock takings panel contains stock takings content
      const stockTakingsPanel = page.getByRole('tabpanel', { name: /stock takings/i });
      await expect(stockTakingsPanel).toBeVisible();
    });
  });

  describe('Stock View Error Handling', function () {
    test('shall display not found dialog for invalid routes', async function ({ page }) {
      await loadEmptyFixture(page);
      await page.evaluate(setupStockView, tursoLibSQLiteServer().url);

      await page.evaluate(async function () {
        // Navigate to invalid route
        /** @type {import('#web/contexts/router-context.js').RouterContextElement} */
        const router = document.querySelector('router-context');
        router.navigate({ pathname: '/stock/invalid-route' });
      });

      // Verify not found dialog is visible
      await expect(page.getByRole('dialog')).toBeVisible();
    });
  });
});
