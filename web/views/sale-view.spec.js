import { expect, test } from '@playwright/test';
import { useTursoLibSQLiteServer } from '#test/hooks/use-turso-libsqlite-server.js';
import { loadEmptyFixture } from '#test/tools/fixture.js';

const { describe } = test;

describe('Sale View', function () {
  const tursoLibSQLiteServer = useTursoLibSQLiteServer(test);

  /**
   * Helper function to setup sale-view component in test environment
   * @param {import('@playwright/test').Page} page
   * @param {string} databaseUrl
   */
  async function setupSaleView(page, databaseUrl) {
    await page.evaluate(async function (tursoDatabaseUrl) {
      localStorage.setItem('tursoDatabaseUrl', tursoDatabaseUrl);
      localStorage.setItem('tursoDatabaseKey', '');

      await import('/web/views/sale-view.js');
      await customElements.whenDefined('sale-view');
      await customElements.whenDefined('sales-view');
      await customElements.whenDefined('discounts-view');

      document.body.innerHTML = `
        <ready-context>
          <router-context>
            <database-context>
              <device-context>
                <i18n-context>
                  <sale-view></sale-view>
                </i18n-context>
              </device-context>
            </database-context>
          </router-context>
        </ready-context>
      `;
    }, databaseUrl);
    
    // Wait for component to be fully rendered
    await page.waitForSelector('sale-view', { state: 'attached' });
  }

  describe('Sale View Navigation', function () {
    test('shall display sales tab by default', async function ({ page }) {
      await loadEmptyFixture(page);
      await setupSaleView(page, tursoLibSQLiteServer().url);

      // Verify sales tab is visible
      await expect(page.getByRole('tab', { name: /sales/i })).toBeVisible();
    });

    test('shall display discounts tab', async function ({ page }) {
      await loadEmptyFixture(page);
      await setupSaleView(page, tursoLibSQLiteServer().url);

      // Verify discounts tab is visible
      await expect(page.getByRole('tab', { name: /discounts/i })).toBeVisible();
    });

    test('shall navigate to sales panel when sales tab is clicked', async function ({ page }) {
      await loadEmptyFixture(page);
      await setupSaleView(page, tursoLibSQLiteServer().url);

      // Click sales tab
      await page.getByRole('tab', { name: /sales/i }).click();

      // Verify sales panel is visible
      await expect(page.getByRole('tabpanel', { name: /sales/i })).toBeVisible();
    });

    test('shall navigate to discounts panel when discounts tab is clicked', async function ({ page }) {
      await loadEmptyFixture(page);
      await setupSaleView(page, tursoLibSQLiteServer().url);

      // Click discounts tab
      await page.getByRole('tab', { name: /discounts/i }).click();

      // Verify discounts panel is visible
      await expect(page.getByRole('tabpanel', { name: /discounts/i })).toBeVisible();
    });
  });

  describe('Sale View Page Display', function () {
    test('shall display page header', async function ({ page }) {
      await loadEmptyFixture(page);
      await setupSaleView(page, tursoLibSQLiteServer().url);

      // Verify page header is visible
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    });

    test('shall display tab navigation', async function ({ page }) {
      await loadEmptyFixture(page);
      await setupSaleView(page, tursoLibSQLiteServer().url);

      // Verify tab list is visible
      await expect(page.getByRole('tablist')).toBeVisible();
    });
  });

  describe('Sale View Tab Panels', function () {
    test('shall render sales-view component in sales panel', async function ({ page }) {
      await loadEmptyFixture(page);
      await setupSaleView(page, tursoLibSQLiteServer().url);

      // Click sales tab
      await page.getByRole('tab', { name: /sales/i }).click();

      // Verify sales panel contains sales content
      const salesPanel = page.getByRole('tabpanel', { name: /sales/i });
      await expect(salesPanel).toBeVisible();
    });

    test('shall render discounts-view component in discounts panel', async function ({ page }) {
      await loadEmptyFixture(page);
      await setupSaleView(page, tursoLibSQLiteServer().url);

      // Click discounts tab
      await page.getByRole('tab', { name: /discounts/i }).click();

      // Verify discounts panel contains discounts content
      const discountsPanel = page.getByRole('tabpanel', { name: /discounts/i });
      await expect(discountsPanel).toBeVisible();
    });
  });

  describe('Sale View Error Handling', function () {
    test('shall display not found dialog for invalid routes', async function ({ page }) {
      await loadEmptyFixture(page);
      await setupSaleView(page, tursoLibSQLiteServer().url);

      await page.evaluate(async function () {
        // Navigate to invalid route
        /** @type {import('#web/contexts/router-context.js').RouterContextElement} */
        const router = document.querySelector('router-context');
        router.navigate({ pathname: '/sale/invalid-route' });
      });

      // Verify not found dialog is visible
      await expect(page.getByRole('dialog')).toBeVisible();
    });
  });
});
