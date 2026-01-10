import { expect, test } from '@playwright/test';
import { useTursoLibSQLiteServer } from '#test/hooks/use-turso-libsqlite-server.js';
import { loadEmptyFixture } from '#test/tools/fixture.js';
import { useStrict } from '#test/hooks/use-strict.js';

const { describe } = test;

/**
 * @param {string} tursoDatabaseUrl
 */
async function setupMainView(tursoDatabaseUrl) {
  await import('#web/views/main-view.js');
  localStorage.setItem('tursoDatabaseUrl', tursoDatabaseUrl);
  localStorage.setItem('tursoDatabaseKey', '');
  localStorage.setItem('onboardingCompleted', 'true');
  localStorage.setItem('businessName', 'Test Business');
  
  // Set initial route to root
  window.history.replaceState({}, '', '/');
  
  document.body.innerHTML = `
    <ready-context>
      <router-context>
        <database-context>
          <device-context>
            <i18n-context>
              <main-view></main-view>
            </i18n-context>
          </device-context>
        </database-context>
      </router-context>
    </ready-context>
  `;
}

describe('Main View', function () {
  useStrict(test);
  const tursoLibSQLiteServer = useTursoLibSQLiteServer(test);

  describe('Device Detection', function () {
    test('shall render desktop-view for desktop devices', async function ({ page }) {
      await loadEmptyFixture(page);
      await page.evaluate(setupMainView, tursoLibSQLiteServer().url);

      await expect(page.getByRole('navigation', { name: 'Main Navigation' })).toBeVisible();
      await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
    });
  });

  describe('Initial Routing', function () {
    test('shall redirect to dashboard from root path', async function ({ page }) {
      await loadEmptyFixture(page);
      await page.evaluate(setupMainView, tursoLibSQLiteServer().url);

      await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
    });
  });
});
