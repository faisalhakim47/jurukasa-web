import { expect, test } from '@playwright/test';
import { useTursoLibSQLiteServer } from '#test/hooks/use-turso-libsqlite-server.js';
import { loadEmptyFixture } from '#test/tools/fixture.js';
import { useStrict } from '#test/hooks/use-strict.js';

const { describe } = test;

/** @param {string} tursoDatabaseUrl */
async function setupView(tursoDatabaseUrl) {
  localStorage.setItem('tursoDatabaseUrl', tursoDatabaseUrl);
  localStorage.setItem('tursoDatabaseKey', '');

  // Set the router to /sale path
  window.history.replaceState({}, '', '/sale');

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
}

describe('Sale View', function () {
  useStrict(test);
  const tursoLibSQLiteServer = useTursoLibSQLiteServer(test);

  describe('Sale View Navigation', function () {
    test('shall display sales tab by default', async function ({ page }) {
      await loadEmptyFixture(page);

      await page.evaluate(setupView, tursoLibSQLiteServer().url);

      await expect(page.getByRole('tab', { name: 'Sales' })).toBeVisible();
    });

    test('shall display discounts tab', async function ({ page }) {
      await loadEmptyFixture(page);

      await page.evaluate(setupView, tursoLibSQLiteServer().url);

      await expect(page.getByRole('tab', { name: 'Discounts' })).toBeVisible();
    });

    test('shall navigate to sales panel when sales tab is clicked', async function ({ page }) {
      await loadEmptyFixture(page);

      await page.evaluate(setupView, tursoLibSQLiteServer().url);

      await page.getByRole('tab', { name: 'Sales' }).click();

      await expect(page.getByRole('tabpanel', { name: 'Sales' })).toBeVisible();
    });

    test('shall navigate to discounts panel when discounts tab is clicked', async function ({ page }) {
      await loadEmptyFixture(page);

      await page.evaluate(setupView, tursoLibSQLiteServer().url);

      await page.getByRole('tab', { name: 'Discounts' }).click();

      await expect(page.getByRole('tabpanel', { name: 'Discounts' })).toBeVisible();
    });
  });

  describe('Sale View Page Display', function () {
    test('shall display page header', async function ({ page }) {
      await loadEmptyFixture(page);

      await page.evaluate(setupView, tursoLibSQLiteServer().url);

      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    });

    test('shall display tab navigation', async function ({ page }) {
      await loadEmptyFixture(page);

      await page.evaluate(setupView, tursoLibSQLiteServer().url);

      await expect(page.getByRole('tablist')).toBeVisible();
    });
  });

  describe('Sale View Tab Panels', function () {
    test('shall render sales-view component in sales panel', async function ({ page }) {
      await loadEmptyFixture(page);

      await page.evaluate(setupView, tursoLibSQLiteServer().url);

      await page.getByRole('tab', { name: 'Sales' }).click();

      const salesPanel = page.getByRole('tabpanel', { name: 'Sales' });
      await expect(salesPanel).toBeVisible();
    });

    test('shall render discounts-view component in discounts panel', async function ({ page }) {
      await loadEmptyFixture(page);

      await page.evaluate(setupView, tursoLibSQLiteServer().url);

      await page.getByRole('tab', { name: 'Discounts' }).click();

      const discountsPanel = page.getByRole('tabpanel', { name: 'Discounts' });
      await expect(discountsPanel).toBeVisible();
    });
  });

  describe('Sale View Error Handling', function () {
    test('shall display not found dialog for invalid routes', async function ({ page }) {
      await loadEmptyFixture(page);

      await page.evaluate(setupView, tursoLibSQLiteServer().url);

      await page.evaluate(async function () {
        /** @type {import('#web/contexts/router-context.js').RouterContextElement} */
        const router = document.querySelector('router-context');
        router.navigate({ pathname: '/sale/invalid-route' });
      });

      await expect(page.getByRole('dialog')).toBeVisible();
    });
  });
});
