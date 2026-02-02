import { expect } from '@playwright/test';
import { jurukasaTest } from '#test/playwright/test-setup.js';
import { useConsoleOutput } from '#test/playwright/hooks/use-console-output.js';
import { useTursoLibSQLiteServer } from '#test/playwright/hooks/use-turso-libsqlite-server.js';
import { loadEmptyFixture } from '#test/playwright/tools/fixture.js';
import { useStrict } from '#test/playwright/hooks/use-strict.js';
import { setupDatabase } from '#test/playwright/tools/database.js';
/** @import { RouteTarget } from '#web/contexts/router-context.js' */

const test = jurukasaTest;
const { describe } = test;

/**
 * @param {string} tursoDatabaseUrl
 */
async function setupSettingView(tursoDatabaseUrl) {
  window.history.replaceState(/** @type {RouteTarget} */({
    replace: true,
    database: {
      name: 'My Business',
      provider: 'turso',
      url: tursoDatabaseUrl,
    },
  }), '', '/settings/database');
  document.body.innerHTML = `
    <ready-context>
      <router-context>
        <database-context>
          <device-context>
            <i18n-context>
              <settings-view></settings-view>
            </i18n-context>
          </device-context>
        </database-context>
      </router-context>
    </ready-context>
  `;
}

/**
 * @param {string} tursoDatabaseUrl
 */
async function setupDatabaseSetupView(tursoDatabaseUrl) {
  window.history.replaceState({}, '', '/database-setup');
  document.body.innerHTML = `
    <ready-context>
      <time-context>
        <router-context>
          <database-context provider="turso" name="My Business" turso-url=${tursoDatabaseUrl}>
            <device-context>
              <i18n-context>
                <database-setup-view></database-setup-view>
              </i18n-context>
            </device-context>
          </database-context>
        </router-context>
      </time-context>
    </ready-context>
  `;
}

describe('Database Management Feature', function () {
  useConsoleOutput(test);
  useStrict(test);
  const tursoLibSQLiteServer = useTursoLibSQLiteServer(test);

  test('it shall display Database tab and management interface in Settings', async function ({ page }) {
    await Promise.all([
      loadEmptyFixture(page),
      setupDatabase(tursoLibSQLiteServer()),
    ]);
    await page.evaluate(setupSettingView, tursoLibSQLiteServer().url);

    await expect(page.getByRole('tab', { name: 'Database' }), 'it shall display Database tab').toBeVisible();
    await expect(page.getByRole('heading', { name: 'Database Management' }), 'it shall display Database Management title').toBeVisible();

    const databasePanel = page.getByRole('tabpanel', { name: 'Database' });
    await expect(databasePanel.getByRole('button', { name: 'New Database' }), 'it shall display New Database button').toBeVisible();
    await expect(databasePanel.getByRole('button', { name: 'Refresh' }), 'it shall display Refresh button').toBeVisible();
    await expect(databasePanel.getByText('Provider'), 'it shall display Provider table header').toBeVisible();
    await expect(databasePanel.getByText('Name'), 'it shall display Name table header').toBeVisible();
    await expect(databasePanel.getByText('Actions'), 'it shall display Actions table header').toBeVisible();
    await expect(databasePanel.getByText('Turso'), 'it shall display Turso provider in list').toBeVisible();
    await expect(databasePanel.getByText('My Business'), 'it shall display database name in list').toBeVisible();
    await expect(databasePanel.getByRole('button', { name: 'Info' }), 'it shall display Info button for database entry').toBeVisible();
  });

  test('it shall open and close database Info dialog', async function ({ page }) {
    await Promise.all([
      loadEmptyFixture(page),
      setupDatabase(tursoLibSQLiteServer()),
    ]);
    await page.evaluate(setupSettingView, tursoLibSQLiteServer().url);

    const databasePanel = page.getByRole('tabpanel', { name: 'Database' });
    await databasePanel.getByRole('button', { name: 'Info' }).click();

    const dialog = page.getByRole('dialog', { name: 'Database Information' });
    await expect(dialog, 'it shall display Database Information dialog').toBeVisible();
    await expect(dialog.getByText('Provider'), 'it shall display Provider label in dialog').toBeVisible();
    await expect(dialog.getByText('Turso'), 'it shall display Turso provider value in dialog').toBeVisible();
    await expect(dialog.getByText('Status'), 'it shall display Status label in dialog').toBeVisible();
    await expect(dialog.getByText('Active'), 'it shall display Active status in dialog').toBeVisible();

    await dialog.getByRole('button', { name: 'Close' }).click();
    await expect(dialog, 'it shall close Info dialog').not.toBeVisible();
  });

  test('it shall display Database Setup view with all options', async function ({ page }) {
    await Promise.all([
      loadEmptyFixture(page),
      setupDatabase(tursoLibSQLiteServer()),
    ]);
    await page.evaluate(setupDatabaseSetupView, tursoLibSQLiteServer().url);

    await expect(page.getByRole('heading', { name: 'Database Setup' }), 'it shall display Database Setup title').toBeVisible();
    await expect(page.getByRole('button', { name: 'Cancel' }), 'it shall display Cancel button').toBeVisible();
    await expect(page.getByRole('button', { name: 'Connect' }), 'it shall display Connect button').toBeVisible();
    await expect(page.getByText('Local Database'), 'it shall display Local Database option').toBeVisible();
    await expect(page.getByText('Turso SQLite'), 'it shall display Turso SQLite option').toBeVisible();
    await expect(page.getByText('Configure a new database for your business data.'), 'it shall display setup description').toBeVisible();

    await expect(page.getByLabel('Database URL'), 'it shall hide Database URL field when Local is selected by default').not.toBeVisible();

    await page.getByRole('radio', { name: 'Turso SQLite' }).check();
    await expect(page.getByLabel('Database URL'), 'it shall display Database URL field when Turso is selected').toBeVisible();
    await expect(page.getByLabel('Auth Token'), 'it shall display Auth Token field when Turso is selected').toBeVisible();
  });

  test('it shall switch to Database tab when clicked', async function ({ page }) {
    await Promise.all([
      loadEmptyFixture(page),
      setupDatabase(tursoLibSQLiteServer()),
    ]);
    await page.evaluate(setupSettingView, tursoLibSQLiteServer().url);

    await page.getByRole('tab', { name: 'Database' }).click();

    const databasePanel = page.getByRole('tabpanel', { name: 'Database' });
    await expect(databasePanel, 'it shall show Database tabpanel as active').toHaveAttribute('aria-hidden', 'false');
  });
});
