import { expect } from '@playwright/test';
import { jurukasaTest } from '#test/playwright/test-setup.js';
import { useTursoLibSQLiteServer } from '#test/playwright/hooks/use-turso-libsqlite-server.js';
import { useConsoleOutput } from '#test/playwright/hooks/use-console-output.js';
import { useStrict } from '#test/playwright/hooks/use-strict.js';
import { loadEmptyFixture } from '#test/playwright/tools/fixture.js';
import { setupDatabase } from '#test/playwright/tools/database.js';

const test = jurukasaTest;
const { describe } = test;

/** @param {string} tursoDatabaseUrl */
async function setupView(tursoDatabaseUrl) {
  window.history.replaceState({}, '', '/books/reports/income-statement?beginTime=1704067200000');
  document.body.innerHTML = `
    <ready-context>
      <time-context>
        <router-context>
          <database-context provider="turso" name="My Business" turso-url=${tursoDatabaseUrl}>
            <device-context>
              <i18n-context>
                <income-statement-view></income-statement-view>
              </i18n-context>
            </device-context>
          </database-context>
        </router-context>
      </time-context>
    </ready-context>
  `;
}

describe('Income Statement View', function () {
  useConsoleOutput(test);
  useStrict(test);

  const tursoLibSQLiteServer = useTursoLibSQLiteServer(test);

  test('shall display error state when fiscal year does not exist', async function ({ page }) {
    await loadEmptyFixture(page);
    await page.evaluate(function setupViewImpl(tursoDatabaseUrl) {
      window.history.replaceState({}, '', '/books/reports/income-statement?beginTime=1704067200000');
      document.body.innerHTML = `
        <ready-context>
          <time-context>
            <router-context>
              <database-context provider="turso" name="My Business" turso-url=${tursoDatabaseUrl}>
                <device-context>
                  <i18n-context>
                    <income-statement-view></income-statement-view>
                  </i18n-context>
                </device-context>
              </database-context>
            </router-context>
          </time-context>
        </ready-context>
      `;
    }, tursoLibSQLiteServer().url);

    await expect(page.getByRole('heading', { name: 'Unable to load income statement' })).toBeVisible();
  });

  test('shall display refresh button', async function ({ page }) {
    await loadEmptyFixture(page);
    await page.evaluate(setupView, tursoLibSQLiteServer().url);

    await expect(page.getByRole('button', { name: 'Refresh' })).toBeVisible();
  });
});
