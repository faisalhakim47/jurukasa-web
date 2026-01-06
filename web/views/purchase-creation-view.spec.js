import { test, expect } from '@playwright/test';
import { useTursoLibSQLiteServer } from '#test/hooks/use-turso-libsqlite-server.js';
import { useConsoleOutput } from '#test/hooks/use-console-output.js';
/** @import { DatabaseContextElement } from '#web/contexts/database-context.js' */

const { describe } = test;

describe('Purchase Creation View with Supplier Selector Dialog', function () {
  useConsoleOutput(test);
  const tursoLibSQLiteServer = useTursoLibSQLiteServer(test);

  test('it shall open supplier selector dialog and select a supplier', async function ({ page }) {
    await page.goto('/test/fixtures/empty.html', { waitUntil: 'networkidle' });

    await page.evaluate(async function setupPOSData(tursoDatabaseUrl) {
      localStorage.setItem('tursoDatabaseUrl', tursoDatabaseUrl);
      localStorage.setItem('tursoDatabaseKey', '');
      document.body.innerHTML = `
        <ready-context>
          <router-context>
            <database-context>
              <device-context>
                <i18n-context>
                  <time-context></time-context>
                </i18n-context>
              </device-context>
            </database-context>
          </router-context>
        </ready-context>
      `;

      /** @type {DatabaseContextElement} */
      const database = document.querySelector('database-context');
      await database.sql`INSERT INTO chart_of_accounts_templates (name) VALUES ('Retail Business - Indonesia')`
      await database.sql`INSERT INTO suppliers (name, phone_number) VALUES ('Test Supplier', '+62812345678')`;
      await database.sql`INSERT INTO inventories (name, unit_price, unit_of_measurement, stock, account_code) VALUES ('Test Product', 10000, 'pcs', 100, 11310)`;

      const deepestContext = document.querySelector('time-context');
      deepestContext.innerHTML = '<purchase-creation-view></purchase-creation-view>';
    }, tursoLibSQLiteServer().url);

    await page.getByRole('button', { name: 'Select Supplier' }).click();
    await expect(page.getByRole('dialog', { name: 'Select Supplier' })).toBeVisible();

    await page.getByRole('menuitemradio').filter({ hasText: 'Test Supplier' }).click();
    await expect(page.getByRole('dialog', { name: 'Select Supplier' })).not.toBeVisible();
    await expect(page.getByText('(+62812345678)')).toBeVisible(); // the bracketed phone number indicates supplier selected

    await page.getByRole('listitem').filter({ hasText: 'Test Product' }).click();
    await expect(page.getByRole('table')).toContainText('Test Product');
  });

  test('it shall allow changing supplier via edit button', async function ({ page }) {
    await page.goto('/test/fixtures/empty.html', { waitUntil: 'networkidle' });

    await page.evaluate(async function setupPOSData(tursoDatabaseUrl) {
      localStorage.setItem('tursoDatabaseUrl', tursoDatabaseUrl);
      localStorage.setItem('tursoDatabaseKey', '');
      document.body.innerHTML = `
        <ready-context>
          <router-context>
            <database-context>
              <device-context>
                <i18n-context>
                  <time-context></time-context>
                </i18n-context>
              </device-context>
            </database-context>
          </router-context>
        </ready-context>
      `;

      /** @type {DatabaseContextElement} */
      const database = document.querySelector('database-context');
      await database.sql`INSERT INTO suppliers (name, phone_number) VALUES ('Supplier A', '+62811111111')`;
      await database.sql`INSERT INTO suppliers (name, phone_number) VALUES ('Supplier B', '+62822222222')`;

      const deepestContext = document.querySelector('time-context');
      deepestContext.innerHTML = '<purchase-creation-view></purchase-creation-view>';
    }, tursoLibSQLiteServer().url);

    await page.getByRole('button', { name: 'Select Supplier' }).click();
    await page.getByRole('menuitemradio').filter({ hasText: 'Supplier A' }).click();
    await expect(page.getByText('(+62811111111)')).toBeVisible();

    await page.getByRole('button', { name: 'Change supplier' }).click();

    await expect(page.getByRole('dialog', { name: 'Select Supplier' })).toBeVisible();
    await page.getByRole('menuitemradio').filter({ hasText: 'Supplier B' }).click();

    await expect(page.getByText('(+62822222222)')).toBeVisible();
    await expect(page.getByText('(+62811111111)')).not.toBeVisible();
  });
});
