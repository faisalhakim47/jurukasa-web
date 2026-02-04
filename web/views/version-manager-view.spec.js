import { expect } from '@playwright/test';
import { jurukasaTest } from '#test/playwright/test-setup.js';
import { useTursoLibSQLiteServer } from '#test/playwright/hooks/use-turso-libsqlite-server.js';
import { loadEmptyFixture } from '#test/playwright/tools/fixture.js';
import { setupDatabase } from '#test/playwright/tools/database.js';
import { useStrict } from '#test/playwright/hooks/use-strict.js';
import { useConsoleOutput } from '#test/playwright/hooks/use-console-output.js';

const test = jurukasaTest;
const { describe } = test;

describe('Version Manager View', function () {
  useConsoleOutput(test);
  useStrict(test);
  const tursoLibSQLiteServer = useTursoLibSQLiteServer(test);

  test('displays version list with npm sources after loading', async function ({ page }) {
    await Promise.all([
      loadEmptyFixture(page),
      setupDatabase(tursoLibSQLiteServer()),
    ]);
    await page.evaluate(function injectVersionManagerView(tursoDatabaseUrl) {
      window.history.replaceState({}, '', '/settings/versions');
      document.body.innerHTML = `
        <ready-context>
          <router-context>
            <database-context provider="turso" name="My Business" turso-url=${tursoDatabaseUrl}>
              <device-context>
                <i18n-context>
                  <service-worker-context>
                    <settings-view></settings-view>
                  </service-worker-context>
                </i18n-context>
              </device-context>
            </database-context>
          </router-context>
        </ready-context>
      `;
    }, tursoLibSQLiteServer().url);

    await expect(page.getByRole('heading', { name: 'Version Manager' }), 'it shall display version manager heading').toBeVisible();

    await expect(page.getByRole('button', { name: 'Refresh version list' }), 'it shall display refresh version list button').toBeVisible();

    const appVersionsTable = page.getByRole('table', { name: 'App versions list' });
    await expect(appVersionsTable, 'it shall display app versions table').toBeVisible();

    await expect(appVersionsTable.getByRole('columnheader', { name: 'Prefix' }), 'it shall display prefix column header').toBeVisible();
    await expect(appVersionsTable.getByRole('columnheader', { name: 'Version' }), 'it shall display version column header').toBeVisible();
    await expect(appVersionsTable.getByRole('columnheader', { name: 'Sources' }), 'it shall display sources column header').toBeVisible();
    await expect(appVersionsTable.getByRole('columnheader', { name: 'Actions' }), 'it shall display actions column header').toBeVisible();

    await expect(appVersionsTable.getByRole('cell', { name: '2026.2.4', exact: true }), 'it shall display version number in table').toBeVisible();
    await expect(appVersionsTable.getByText('NPM').first(), 'it shall display NPM source chip').toBeVisible();
  });

  test('refreshes version list when refresh button is clicked', async function ({ page }) {
    await Promise.all([
      loadEmptyFixture(page),
      setupDatabase(tursoLibSQLiteServer()),
    ]);
    await page.evaluate(function injectVersionManagerView(tursoDatabaseUrl) {
      window.history.replaceState({}, '', '/settings/versions');
      document.body.innerHTML = `
        <ready-context>
          <router-context>
            <database-context provider="turso" name="My Business" turso-url=${tursoDatabaseUrl}>
              <device-context>
                <i18n-context>
                  <service-worker-context>
                    <settings-view></settings-view>
                  </service-worker-context>
                </i18n-context>
              </device-context>
            </database-context>
          </router-context>
        </ready-context>
      `;
    }, tursoLibSQLiteServer().url);

    await expect(page.getByRole('button', { name: 'Refresh version list' }), 'it shall display refresh button before click').toBeVisible();

    await page.getByRole('button', { name: 'Refresh version list' }).click();

    await expect(page.getByRole('heading', { name: 'Version Manager' }), 'it shall display version manager heading after refresh').toBeVisible();
  });

  test('opens switch version confirmation dialog when Use button is clicked', async function ({ page }) {
    await Promise.all([
      loadEmptyFixture(page),
      setupDatabase(tursoLibSQLiteServer()),
    ]);
    await page.evaluate(function injectVersionManagerView(tursoDatabaseUrl) {
      window.history.replaceState({}, '', '/settings/versions');
      document.body.innerHTML = `
        <ready-context>
          <router-context>
            <database-context provider="turso" name="My Business" turso-url=${tursoDatabaseUrl}>
              <device-context>
                <i18n-context>
                  <service-worker-context>
                    <settings-view></settings-view>
                  </service-worker-context>
                </i18n-context>
              </device-context>
            </database-context>
          </router-context>
        </ready-context>
      `;
    }, tursoLibSQLiteServer().url);

    const appVersionsTable = page.getByRole('table', { name: 'App versions list' });
    await expect(appVersionsTable, 'it shall display app versions table').toBeVisible();

    const rows = await appVersionsTable.getByRole('row').all();

    let useButton = null;
    for (const row of rows) {
      const button = row.getByRole('button', { name: /Use/ });
      if (await button.isVisible().catch(() => false)) {
        useButton = button;
        break;
      }
    }

    if (!useButton) {
      return;
    }

    await useButton.click();

    const switchDialog = page.getByRole('dialog', { name: 'Switch Version' });
    await expect(switchDialog, 'it shall display switch version dialog').toBeVisible();
    await expect(switchDialog.getByRole('paragraph').filter({ has: page.getByText('Are you sure you want to switch to version') }), 'it shall display confirmation message in dialog').toBeVisible();
    await expect(switchDialog.getByRole('button', { name: 'Cancel' }), 'it shall display Cancel button in dialog').toBeVisible();
    await expect(switchDialog.getByRole('button', { name: 'Switch' }), 'it shall display Switch button in dialog').toBeVisible();

    await switchDialog.getByRole('button', { name: 'Cancel' }).click();

    await expect(switchDialog, 'it shall close dialog when Cancel is clicked').not.toBeVisible();
  });
});
