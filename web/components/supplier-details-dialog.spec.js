import { test, expect } from '@playwright/test';
import { useTursoLibSQLiteServer } from '#test/playwright/hooks/use-turso-libsqlite-server.js';
import { useConsoleOutput } from '#test/playwright/hooks/use-console-output.js';
import { loadEmptyFixture } from '#test/playwright/tools/fixture.js';
import { useStrict } from '#test/playwright/hooks/use-strict.js';

/** @import { DatabaseContextElement } from '#web/contexts/database-context.js' */

const { describe } = test;

/**
 * Helper function to setup page with supplier details dialog
 * @param {import('@playwright/test').Page} page
 * @param {string} tursoDatabaseUrl
 * @param {number} supplierId
 */
async function setupPage(page, tursoDatabaseUrl, supplierId) {
  await loadEmptyFixture(page);
  await page.evaluate(async function setupSupplierDetailsDialog({ tursoDatabaseUrl, supplierId }) {
    document.body.innerHTML = `
      <ready-context>
        <router-context>
          <database-context provider="turso" turso-url="${tursoDatabaseUrl}">
            <device-context>
              <i18n-context>
                <button
                  type="button"
                  commandfor="supplier-details-dialog"
                  command="--open"
                  data-supplier-id="${supplierId}"
                >Open Supplier Details</button>
                <supplier-details-dialog
                  id="supplier-details-dialog"
                ></supplier-details-dialog>
              </i18n-context>
            </device-context>
          </database-context>
        </router-context>
      </ready-context>
    `;
  }, { tursoDatabaseUrl, supplierId });
}

describe('Supplier Details Dialog', function () {
  // useConsoleOutput(test);
  useStrict(test);

  describe('Supplier Inventory Management', function () {
    const tursoLibSQLiteServer = useTursoLibSQLiteServer(test);

    test('it shall display linked inventories table', async function ({ page }) {
      await setupPage(page, tursoLibSQLiteServer().url, 1);

      await page.evaluate(async function insertInventoryTestData() {
        /** @type {DatabaseContextElement} */
        const database = document.querySelector('database-context');
        await database.sql`
          INSERT INTO accounts (account_code, name, normal_balance, is_posting_account, create_time, update_time)
          VALUES (11100, 'Inventory Account', 0, 1, 0, 0)
        `;
        await database.sql`
          INSERT INTO account_tags (account_code, tag) VALUES (11100, 'POS - Inventory')
        `;
        await database.sql`
          INSERT INTO suppliers (id, name, phone_number) VALUES (1, 'Test Supplier', '08123456789')
        `;
        await database.sql`
          INSERT INTO inventories (id, name, unit_price, unit_of_measurement, account_code)
          VALUES (1, 'Test Product', 10000, 'piece', 11100)
        `;
        await database.sql`
          INSERT INTO supplier_inventories (supplier_id, inventory_id, quantity_conversion, name)
          VALUES (1, 1, 12, 'Supplier Product Name')
        `;
      });

      await page.getByRole('button', { name: 'Open Supplier Details' }).click();
      await expect(page.getByRole('dialog', { name: 'Test Supplier' })).toBeVisible();

      await expect(page.getByRole('heading', { name: 'Linked Inventories' })).toBeVisible();

      await expect(page.getByRole('table', { name: 'Linked Inventories' })).toBeVisible();
      await expect(page.getByRole('cell', { name: 'Test Product', exact: true })).toBeVisible();
      await expect(page.getByRole('cell', { name: 'Supplier Product Name' })).toBeVisible();
      await expect(page.getByRole('cell', { name: '12x' })).toBeVisible();
    });

    test('it shall add a new supplier inventory mapping', async function ({ page }) {
      await setupPage(page, tursoLibSQLiteServer().url, 1);

      await page.evaluate(async function insertTestData() {
        /** @type {DatabaseContextElement} */
        const database = document.querySelector('database-context');
        
        await database.sql`
          INSERT INTO accounts (account_code, name, normal_balance, is_posting_account, create_time, update_time)
          VALUES (11100, 'Inventory Account', 0, 1, 0, 0)
        `;
        await database.sql`
          INSERT INTO account_tags (account_code, tag) VALUES (11100, 'POS - Inventory')
        `;

        await database.sql`
          INSERT INTO suppliers (id, name, phone_number) VALUES (1, 'Test Supplier', '08123456789')
        `;

        await database.sql`
          INSERT INTO inventories (id, name, unit_price, unit_of_measurement, account_code)
          VALUES (1, 'Test Product', 10000, 'piece', 11100)
        `;

        await database.sql`
          INSERT INTO supplier_inventories (supplier_id, inventory_id, quantity_conversion, name)
          VALUES (1, 1, 12, 'Existing Mapping')
        `;
      });

      await page.getByRole('button', { name: 'Open Supplier Details' }).click();
      await expect(page.getByRole('dialog', { name: 'Test Supplier' })).toBeVisible();

      await page.getByRole('button', { name: 'Add Mapping' }).click();

      await expect(page.getByRole('heading', { name: 'Add Inventory Mapping' })).toBeVisible();

      await page.getByLabel('Search Inventory').fill('Test');

      await expect(page.getByRole('option', { name: 'Test Product Unit: piece' })).toBeVisible();

      await page.getByRole('option', { name: 'Test Product Unit: piece' }).click();

      await expect(page.getByLabel('Conversion')).toBeVisible({ timeout: 5000 });

      await page.getByLabel('Conversion').clear();
      await page.getByLabel('Conversion').fill('12');

      await page.getByRole('button', { name: 'Add Mapping' }).last().click();

      await expect(page.getByText('This inventory mapping with the same quantity conversion already exists for this supplier.')).toBeVisible();
      await expect(page.getByRole('alertdialog', { name: 'Error' })).toBeVisible();

      // Dismiss error
      function dismissErrorDialog() {
        const dialog = document.querySelector('supplier-details-dialog');
        if (!dialog) return;
        const shadow = dialog.shadowRoot;
        if (!shadow) return;
        const dismissButton = shadow.querySelector('[aria-labelledby="error-alert-dialog-title"] button');
        if (dismissButton instanceof HTMLElement) dismissButton.click();
      }
      await page.evaluate(dismissErrorDialog);
      await expect(page.getByRole('alertdialog', { name: 'Error' })).not.toBeVisible();
    });
  });
});
