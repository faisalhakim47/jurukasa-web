import { expect } from '@playwright/test';
import { jurukasaTest } from '#test/playwright/test-setup.js';
import { useTursoLibSQLiteServer } from '#test/playwright/hooks/use-turso-libsqlite-server.js';
import { loadDevFixture } from '#test/playwright/tools/fixture.js';
import { setupDatabase } from '#test/playwright/tools/database.js';
import { useStrict } from '#test/playwright/hooks/use-strict.js';
import { useConsoleOutput } from '#test/playwright/hooks/use-console-output.js';

/** @import { Route } from '#web/contexts/router-context.js' */

const test = jurukasaTest;
const { describe } = test;

describe('Version Manager View', function () {
  useConsoleOutput(test);
  useStrict(test);
  const tursoLibSQLiteServer = useTursoLibSQLiteServer(test);

  test('shall display list of app versions from sw:config', async function ({ context, page }) {
    const initialPage = await context.newPage();
    await Promise.all([
      loadDevFixture(initialPage),
      setupDatabase(tursoLibSQLiteServer()),
    ]);
    await initialPage.close();

    const initialRoute = btoa(JSON.stringify(/** @type {Route} */({
      database: {
        provider: 'turso',
        name: 'My Business',
        url: tursoLibSQLiteServer().url,
      },
    })));
    await page.goto(`/settings/versions?initialRoute=${initialRoute}`, { waitUntil: 'networkidle' });
    await expect(page.getByRole('dialog', { name: 'Application is loading' })).not.toBeVisible();

    await expect(page.getByRole('heading', { name: 'Version Manager' })).toBeVisible();

    // Verify the table headers are displayed
    await expect(page.getByRole('columnheader', { name: 'Value' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Name' })).toBeVisible();

    // Verify refresh button is present
    await expect(page.getByRole('button', { name: 'Refresh version list' })).toBeVisible();

    await page.pause();
  });

  test('shall refresh version list when refresh button is clicked', async function ({ context, page }) {
    const initialPage = await context.newPage();
    await Promise.all([
      loadDevFixture(initialPage),
      setupDatabase(tursoLibSQLiteServer()),
    ]);
    await initialPage.close();

    const initialRoute = btoa(JSON.stringify(/** @type {Route} */({
      database: {
        provider: 'turso',
        name: 'My Business',
        url: tursoLibSQLiteServer().url,
      },
    })));
    await page.goto(`/settings/versions?initialRoute=${initialRoute}`, { waitUntil: 'networkidle' });
    await expect(page.getByRole('dialog', { name: 'Application is loading' })).not.toBeVisible();

    // Click refresh button
    await page.getByRole('button', { name: 'Refresh version list' }).click();

    // Verify the view is still displayed after refresh
    await expect(page.getByRole('heading', { name: 'Version Manager' })).toBeVisible();
  });
});
