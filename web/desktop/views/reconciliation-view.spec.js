import { expect } from '@playwright/test';
import { jurukasaTest } from '#test/playwright/test-setup.js';
import { useConsoleOutput } from '#test/playwright/hooks/use-console-output.js';
import { useStrict } from '#test/playwright/hooks/use-strict.js';
import { useTursoLibSQLiteServer } from '#test/playwright/hooks/use-turso-libsqlite-server.js';
import { loadEmptyFixture } from '#test/playwright/tools/fixture.js';
import { setupDatabase } from '#test/playwright/tools/database.js';

const test = jurukasaTest;
const { describe } = test;

/** @param {string} tursoDatabaseUrl */
async function setupView(tursoDatabaseUrl) {
  document.body.innerHTML = `
    <ready-context>
      <font-context>
        <time-context>
          <router-context>
            <database-context provider="turso" name="My Business" turso-url=${tursoDatabaseUrl}>
              <device-context>
                <i18n-context>
                  <main-view></main-view>
                </i18n-context>
              </device-context>
            </database-context>
          </router-context>
        </time-context>
      </font-context>
    </ready-context>
  `;
}

describe('Reconciliation View', function () {
  useConsoleOutput(test);
  useStrict(test);
  const tursoLibSQLiteServer = useTursoLibSQLiteServer(test);

  test('it defaults to account reconciliation tab', async function ({ page }) {
    await Promise.all([
      loadEmptyFixture(page),
      setupDatabase(tursoLibSQLiteServer()),
    ]);
    await page.evaluate(setupView, tursoLibSQLiteServer().url);

    await page.getByRole('link', { name: 'Reconcile' }).click();

    await expect(page.getByRole('heading', { name: 'Reconciliation', level: 1 })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Account Reconciliation' })).toHaveAttribute('aria-selected', 'true');
  });

  test('it opens the statement checkpoint dialog from the account reconciliation tab', async function ({ page }) {
    await Promise.all([
      loadEmptyFixture(page),
      setupDatabase(tursoLibSQLiteServer()),
    ]);
    await page.evaluate(setupView, tursoLibSQLiteServer().url);

    await page.getByRole('link', { name: 'Reconcile' }).click();
    await page.getByRole('button', { name: 'Record Statement Checkpoint' }).first().click();

    await expect(page.getByRole('dialog', { name: 'Record Statement Checkpoint' })).toBeVisible();
  });
});
