import { expect, test } from '@playwright/test';
import { useConsoleOutput } from '#test/hooks/use-console-output.js';
import { useTursoLibSQLiteServer } from '#test/hooks/use-turso-libsqlite-server.js';
import { loadEmptyFixture } from '#test/tools/fixture.js';
import { useStrict } from '#test/hooks/use-strict.js';
import { setupDatabase } from '#test/tools/database.js';

const { describe } = test;

/**
 * @param {string} tursoDatabaseUrl
 */
async function setupSettingView(tursoDatabaseUrl) {
  window.history.replaceState({}, '', '/settings/database');
  document.body.innerHTML = `
    <ready-context>
      <router-context>
        <database-context provider="turso" turso-url=${tursoDatabaseUrl}>
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
  // Store previous route state for cancel functionality testing
  sessionStorage.setItem('previousRouteState', JSON.stringify({
    pathname: '/settings/database',
    databaseProvider: 'turso',
    databaseConfig: { provider: 'turso', url: tursoDatabaseUrl },
  }));
  document.body.innerHTML = `
    <ready-context>
      <time-context>
        <router-context>
          <database-context provider="turso" turso-url=${tursoDatabaseUrl}>
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

  describe('Database Tab in Settings', function () {
    const tursoLibSQLiteServer = useTursoLibSQLiteServer(test);

    test('shall display Database tab in Settings', async function ({ page }) {
      await Promise.all([
        loadEmptyFixture(page),
        setupDatabase(tursoLibSQLiteServer()),
      ]);
      await page.evaluate(setupSettingView, tursoLibSQLiteServer().url);

      await expect(page.getByRole('tab', { name: 'Database' })).toBeVisible();
    });

    test('shall display Database Management title when on database tab', async function ({ page }) {
      await Promise.all([
        loadEmptyFixture(page),
        setupDatabase(tursoLibSQLiteServer()),
      ]);
      await page.evaluate(setupSettingView, tursoLibSQLiteServer().url);

      await expect(page.getByRole('heading', { name: 'Database Management' })).toBeVisible();
    });

    test('shall display New Database button', async function ({ page }) {
      await Promise.all([
        loadEmptyFixture(page),
        setupDatabase(tursoLibSQLiteServer()),
      ]);
      await page.evaluate(setupSettingView, tursoLibSQLiteServer().url);

      const databasePanel = page.getByRole('tabpanel', { name: 'Database' });
      await expect(databasePanel.getByRole('button', { name: 'New Database' })).toBeVisible();
    });

    test('shall display Refresh button', async function ({ page }) {
      await Promise.all([
        loadEmptyFixture(page),
        setupDatabase(tursoLibSQLiteServer()),
      ]);
      await page.evaluate(setupSettingView, tursoLibSQLiteServer().url);

      const databasePanel = page.getByRole('tabpanel', { name: 'Database' });
      await expect(databasePanel.getByRole('button', { name: 'Refresh' })).toBeVisible();
    });

    test('shall display database list table headers', async function ({ page }) {
      await Promise.all([
        loadEmptyFixture(page),
        setupDatabase(tursoLibSQLiteServer()),
      ]);
      await page.evaluate(setupSettingView, tursoLibSQLiteServer().url);

      const databasePanel = page.getByRole('tabpanel', { name: 'Database' });
      await expect(databasePanel.getByText('Provider')).toBeVisible();
      await expect(databasePanel.getByText('Name')).toBeVisible();
      await expect(databasePanel.getByText('Actions')).toBeVisible();
    });

    test('shall display current Turso database in list', async function ({ page }) {
      await Promise.all([
        loadEmptyFixture(page),
        setupDatabase(tursoLibSQLiteServer()),
      ]);
      await page.evaluate(setupSettingView, tursoLibSQLiteServer().url);

      const databasePanel = page.getByRole('tabpanel', { name: 'Database' });
      await expect(databasePanel.getByText('Turso')).toBeVisible();
      await expect(databasePanel.getByText('Active')).toBeVisible();
    });

    test('shall display Info button for database entry', async function ({ page }) {
      await Promise.all([
        loadEmptyFixture(page),
        setupDatabase(tursoLibSQLiteServer()),
      ]);
      await page.evaluate(setupSettingView, tursoLibSQLiteServer().url);

      const databasePanel = page.getByRole('tabpanel', { name: 'Database' });
      await expect(databasePanel.getByRole('button', { name: 'Info' })).toBeVisible();
    });

    test('shall open Info dialog when clicking Info button', async function ({ page }) {
      await Promise.all([
        loadEmptyFixture(page),
        setupDatabase(tursoLibSQLiteServer()),
      ]);
      await page.evaluate(setupSettingView, tursoLibSQLiteServer().url);

      const databasePanel = page.getByRole('tabpanel', { name: 'Database' });
      await databasePanel.getByRole('button', { name: 'Info' }).click();

      await expect(page.getByRole('dialog', { name: 'Database Information' })).toBeVisible();
    });

    test('shall display database details in Info dialog', async function ({ page }) {
      await Promise.all([
        loadEmptyFixture(page),
        setupDatabase(tursoLibSQLiteServer()),
      ]);
      await page.evaluate(setupSettingView, tursoLibSQLiteServer().url);

      const databasePanel = page.getByRole('tabpanel', { name: 'Database' });
      await databasePanel.getByRole('button', { name: 'Info' }).click();

      const dialog = page.getByRole('dialog', { name: 'Database Information' });
      await expect(dialog.getByText('Provider')).toBeVisible();
      await expect(dialog.getByText('Turso')).toBeVisible();
      await expect(dialog.getByText('Status')).toBeVisible();
      await expect(dialog.getByText('Active')).toBeVisible();
    });

    test('shall close Info dialog when clicking Close button', async function ({ page }) {
      await Promise.all([
        loadEmptyFixture(page),
        setupDatabase(tursoLibSQLiteServer()),
      ]);
      await page.evaluate(setupSettingView, tursoLibSQLiteServer().url);

      const databasePanel = page.getByRole('tabpanel', { name: 'Database' });
      await databasePanel.getByRole('button', { name: 'Info' }).click();

      const dialog = page.getByRole('dialog', { name: 'Database Information' });
      await dialog.getByRole('button', { name: 'Close' }).click();

      await expect(dialog).not.toBeVisible();
    });
  });

  describe('Database Setup View', function () {
    const tursoLibSQLiteServer = useTursoLibSQLiteServer(test);

    test('shall display Database Setup title', async function ({ page }) {
      await Promise.all([
        loadEmptyFixture(page),
        setupDatabase(tursoLibSQLiteServer()),
      ]);
      await page.evaluate(setupDatabaseSetupView, tursoLibSQLiteServer().url);

      await expect(page.getByRole('heading', { name: 'Database Setup' })).toBeVisible();
    });

    test('shall display Cancel button', async function ({ page }) {
      await Promise.all([
        loadEmptyFixture(page),
        setupDatabase(tursoLibSQLiteServer()),
      ]);
      await page.evaluate(setupDatabaseSetupView, tursoLibSQLiteServer().url);

      await expect(page.getByRole('button', { name: 'Cancel' })).toBeVisible();
    });

    test('shall display Connect button', async function ({ page }) {
      await Promise.all([
        loadEmptyFixture(page),
        setupDatabase(tursoLibSQLiteServer()),
      ]);
      await page.evaluate(setupDatabaseSetupView, tursoLibSQLiteServer().url);

      await expect(page.getByRole('button', { name: 'Connect' })).toBeVisible();
    });

    test('shall display Local Database option', async function ({ page }) {
      await Promise.all([
        loadEmptyFixture(page),
        setupDatabase(tursoLibSQLiteServer()),
      ]);
      await page.evaluate(setupDatabaseSetupView, tursoLibSQLiteServer().url);

      await expect(page.getByText('Local Database')).toBeVisible();
    });

    test('shall display Turso SQLite option', async function ({ page }) {
      await Promise.all([
        loadEmptyFixture(page),
        setupDatabase(tursoLibSQLiteServer()),
      ]);
      await page.evaluate(setupDatabaseSetupView, tursoLibSQLiteServer().url);

      await expect(page.getByText('Turso SQLite')).toBeVisible();
    });

    test('shall display setup description', async function ({ page }) {
      await Promise.all([
        loadEmptyFixture(page),
        setupDatabase(tursoLibSQLiteServer()),
      ]);
      await page.evaluate(setupDatabaseSetupView, tursoLibSQLiteServer().url);

      await expect(page.getByText('Configure a new database for your business data.')).toBeVisible();
    });

    test('shall show Turso URL field when Turso is selected', async function ({ page }) {
      await Promise.all([
        loadEmptyFixture(page),
        setupDatabase(tursoLibSQLiteServer()),
      ]);
      await page.evaluate(setupDatabaseSetupView, tursoLibSQLiteServer().url);

      await page.getByRole('radio', { name: 'Turso SQLite' }).check();

      await expect(page.getByLabel('Database URL')).toBeVisible();
      await expect(page.getByLabel('Auth Token')).toBeVisible();
    });

    test('shall hide Turso URL field when Local is selected', async function ({ page }) {
      await Promise.all([
        loadEmptyFixture(page),
        setupDatabase(tursoLibSQLiteServer()),
      ]);
      await page.evaluate(setupDatabaseSetupView, tursoLibSQLiteServer().url);

      // Local is selected by default
      await expect(page.getByLabel('Database URL')).not.toBeVisible();
    });
  });

  describe('Tab Navigation', function () {
    const tursoLibSQLiteServer = useTursoLibSQLiteServer(test);

    test('shall switch to Database tab when clicked', async function ({ page }) {
      await Promise.all([
        loadEmptyFixture(page),
        setupDatabase(tursoLibSQLiteServer()),
      ]);
      await page.evaluate(setupSettingView, tursoLibSQLiteServer().url);

      await page.getByRole('tab', { name: 'Database' }).click();

      const databasePanel = page.getByRole('tabpanel', { name: 'Database' });
      await expect(databasePanel).toHaveAttribute('aria-hidden', 'false');
    });
  });
});
