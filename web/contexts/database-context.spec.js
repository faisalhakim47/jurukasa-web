import { expect, test } from '@playwright/test';
import { useTursoLibSQLiteServer } from '#test/hooks/use-turso-libsqlite-server.js';
const { describe } = test;

describe('Database Context', function () {

  test('it shall guard unconfigured', async function ({ page }) {
    await page.goto('/test/fixtures/empty.html');

    await page.evaluate(function () {
      document.body.innerHTML = `
        <router-context>
          <database-context>
            <p>This text should be guarded</p>
          </database-context>
        </router-context>
      `;
    });

    await expect(page.getByRole('dialog', { name: 'Configure Database' })).toBeVisible();
    await expect(page.getByText('This text should be guarded')).not.toBeVisible();
  });

  describe('Configuration Flow', function () {
    const tursoLibSQLiteServer = useTursoLibSQLiteServer(test);

    test('it shall provide database configuration mechanism', async function ({ page }) {
      await page.goto('/test/fixtures/empty.html');

      await page.evaluate(function () {
        document.body.innerHTML = `
          <router-context>
            <database-context>
              <p>Database Ready</p>
            </database-context>
          </router-context>
        `;
      });

      await page.getByLabel('Turso Database URL').fill(tursoLibSQLiteServer().url);
      await page.getByRole('button', { name: 'Configure' }).click();

      await expect(page.getByText('Database Ready')).toBeVisible();
    });

  });

});
