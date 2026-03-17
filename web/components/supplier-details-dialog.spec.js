import { expect } from '@playwright/test';
import { jurukasaTest } from '#test/playwright/test-setup.js';
import { useTursoLibSQLiteServer } from '#test/playwright/hooks/use-turso-libsqlite-server.js';
import { useConsoleOutput } from '#test/playwright/hooks/use-console-output.js';
import { loadEmptyFixture } from '#test/playwright/tools/fixture.js';
import { useStrict } from '#test/playwright/hooks/use-strict.js';

/** @import { DatabaseContextElement } from '#web/contexts/database-context.js' */

const test = jurukasaTest;
const { describe } = test;

async function setupSupplierDetailsDialog({ tursoDatabaseUrl, supplierId }) {
  document.body.innerHTML = `
    <ready-context>
      <router-context>
        <database-context provider="turso" name="My Business" turso-url="${tursoDatabaseUrl}">
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
}

async function insertInventoryTestData() {
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
    INSERT INTO supplier_inventories (record_time, supplier_id, inventory_id, name)
    VALUES (1000, 1, 1, 'Supplier Product Name')
  `;
}

async function insertTestDataForMapping() {
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
    INSERT INTO supplier_inventories (record_time, supplier_id, inventory_id, name)
    VALUES (1000, 1, 1, 'Existing Label')
  `;
}

function dismissErrorDialog() {
  const dialog = document.querySelector('supplier-details-dialog');
  if (!dialog) return;
  const shadow = dialog.shadowRoot;
  if (!shadow) return;
  const dismissButton = shadow.querySelector('[aria-labelledby="error-alert-dialog-title"] button');
  if (dismissButton instanceof HTMLElement) dismissButton.click();
}

describe('Supplier Details Dialog', function () {
  useConsoleOutput(test);
  useStrict(test);
  const tursoLibSQLiteServer = useTursoLibSQLiteServer(test);

  test('displays linked inventories table with supplier information', async function ({ page }) {
    await loadEmptyFixture(page);
    await page.evaluate(setupSupplierDetailsDialog, { tursoDatabaseUrl: tursoLibSQLiteServer().url, supplierId: 1 });
    await page.evaluate(insertInventoryTestData);

    await page.getByRole('button', { name: 'Open Supplier Details' }).click();
    await expect(page.getByRole('dialog', { name: 'Test Supplier' }), 'it shall open supplier details dialog').toBeVisible();

    await expect(page.getByRole('heading', { name: 'Linked Inventories' }), 'it shall display Linked Inventories heading').toBeVisible();

    await expect(page.getByRole('table', { name: 'Linked Inventories' }), 'it shall display linked inventories table').toBeVisible();
    await expect(page.getByRole('cell', { name: 'Test Product', exact: true }), 'it shall display product name').toBeVisible();
    await expect(page.getByRole('cell', { name: 'Supplier Product Name' }), 'it shall display supplier product name').toBeVisible();
    await expect(page.getByRole('button', { name: 'Edit inventory link for Test Product' }), 'it shall display edit action').toBeVisible();
  });

  test('adds new supplier inventory mapping with duplicate validation', async function ({ page }) {
    await loadEmptyFixture(page);
    await page.evaluate(setupSupplierDetailsDialog, { tursoDatabaseUrl: tursoLibSQLiteServer().url, supplierId: 1 });
    await page.evaluate(insertTestDataForMapping);

    await page.getByRole('button', { name: 'Open Supplier Details' }).click();
    await expect(page.getByRole('dialog', { name: 'Test Supplier' }), 'it shall open supplier details dialog').toBeVisible();

    await page.getByRole('button', { name: 'Link Inventory' }).click();

    await expect(page.getByRole('heading', { name: 'Link Inventory' }), 'it shall open add mapping dialog').toBeVisible();

    await page.getByLabel('Search Inventory').fill('Test');

    await expect(page.getByRole('option', { name: 'Test Product Unit: piece' }), 'it shall show inventory option').toBeVisible();

    await page.getByRole('option', { name: 'Test Product Unit: piece' }).click();

    await page.getByRole('button', { name: 'Link Inventory' }).last().click();

    await expect(page.getByText('This inventory is already linked to this supplier.'), 'it shall display duplicate error message').toBeVisible();
    await expect(page.getByRole('alertdialog', { name: 'Error' }), 'it shall display error alert dialog').toBeVisible();

    await page.evaluate(dismissErrorDialog);
    await expect(page.getByRole('alertdialog', { name: 'Error' }), 'it shall close error dialog').not.toBeVisible();
  });
});
