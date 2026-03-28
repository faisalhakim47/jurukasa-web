import { expect } from '@playwright/test';
import { jurukasaTest } from '#test/playwright/test-setup.js';
import { useTursoLibSQLiteServer } from '#test/playwright/hooks/use-turso-libsqlite-server.js';
import { loadEmptyFixture } from '#test/playwright/tools/fixture.js';
import { useStrict } from '#test/playwright/hooks/use-strict.js';

const test = jurukasaTest;
const { describe } = test;

/** @param {string} tursoDatabaseUrl */
async function setupView(tursoDatabaseUrl) {
  window.history.replaceState({}, '', '/sale');
  document.body.innerHTML = `
    <ready-context>
      <router-context>
        <database-context provider="turso" name="My Business" turso-url=${tursoDatabaseUrl}>
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

function navigateToInvalidRoute() {
  /** @type {import('#web/contexts/router-context.js').RouterContextElement} */
  const router = document.querySelector('router-context');
  router.navigate({ pathname: '/sale/invalid-route' });
}

describe('Sale View', function () {
  useStrict(test);
  const tursoLibSQLiteServer = useTursoLibSQLiteServer(test);

  test('display sales tab by default with page header and tab navigation', async function ({ page }) {
    await loadEmptyFixture(page);

    await page.evaluate(setupView, tursoLibSQLiteServer().url);

    await expect(page.getByRole('heading', { level: 1 }), 'it shall display page header').toBeVisible();
    await expect(page.getByRole('tablist'), 'it shall display tab navigation').toBeVisible();
    await expect(page.getByRole('tab', { name: 'Sales' }), 'it shall display Sales tab').toBeVisible();
    await expect(page.getByRole('tabpanel', { name: 'Sales' }), 'it shall display Sales panel by default').toBeVisible();
  });

  test('display discounts tab and navigate to discounts panel when clicked', async function ({ page }) {
    await loadEmptyFixture(page);

    await page.evaluate(setupView, tursoLibSQLiteServer().url);

    await expect(page.getByRole('tab', { name: 'Discounts' }), 'it shall display Discounts tab').toBeVisible();

    await page.getByRole('tab', { name: 'Discounts' }).click();

    await expect(page.getByRole('tabpanel', { name: 'Discounts' }), 'it shall display Discounts panel after clicking Discounts tab').toBeVisible();
  });

  test('display not found dialog for invalid routes', async function ({ page }) {
    await loadEmptyFixture(page);

    await page.evaluate(setupView, tursoLibSQLiteServer().url);

    await page.evaluate(navigateToInvalidRoute);

    await expect(page.getByRole('dialog'), 'it shall display not found dialog for invalid routes').toBeVisible();
  });
});
