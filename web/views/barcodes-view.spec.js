import { test, expect } from '@playwright/test';
import { useConsoleOutput } from '#test/hooks/use-console-output.js';
import { useTursoLibSQLiteServer } from '#test/hooks/use-turso-libsqlite-server.js';
import { loadEmptyFixture } from '#test/tools/fixture.js';
import { setupDatabase } from '#test/tools/database.js';
/** @import { DatabaseContextElement } from '#web/contexts/database-context.js' */

const { describe } = test;

/** @param {string} tursoDatabaseUrl */
async function setupView(tursoDatabaseUrl) {
  localStorage.setItem('tursoDatabaseUrl', tursoDatabaseUrl);
  localStorage.setItem('tursoDatabaseKey', '');
  document.body.innerHTML = `
    <ready-context>
      <router-context>
        <database-context>
          <device-context>
            <i18n-context>
              <barcodes-view></barcodes-view>
            </i18n-context>
          </device-context>
        </database-context>
      </router-context>
    </ready-context>
  `;
}

describe('Barcodes View', function () {
  // useConsoleOutput(test);
  const tursoLibSQLiteServer = useTursoLibSQLiteServer(test);

  test('it shall display empty state when no barcodes exist', async function ({ page }) {
    await loadEmptyFixture(page);

    await page.evaluate(setupView, tursoLibSQLiteServer().url);

    await expect(page.getByText('No barcodes assigned yet')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Assign Barcode' }).first()).toBeVisible();
  });

  test('it shall display list of barcodes', async function ({ page }) {
    await Promise.all([
      loadEmptyFixture(page),
      setupDatabase(tursoLibSQLiteServer(), async function setupData(sql) {
        await sql`INSERT INTO inventories (name, unit_price, unit_of_measurement, account_code, cost, stock) VALUES ('Product A', 10000, 'pcs', 11310, 0, 0)`;
        await sql`INSERT INTO inventories (name, unit_price, unit_of_measurement, account_code, cost, stock) VALUES ('Product B', 20000, 'pcs', 11310, 0, 0)`;
        await sql`INSERT INTO inventory_barcodes (code, inventory_id) VALUES ('1234567890', 1)`;
        await sql`INSERT INTO inventory_barcodes (code, inventory_id) VALUES ('9876543210', 2)`;
      }),
    ]);

    await page.evaluate(setupView, tursoLibSQLiteServer().url);

    await expect(page.getByRole('table', { name: 'Barcodes list' })).toBeVisible();
    await expect(page.getByRole('row').filter({ hasText: '1234567890' })).toBeVisible();
    await expect(page.getByRole('row').filter({ hasText: 'Product A' })).toBeVisible();
    await expect(page.getByRole('row').filter({ hasText: '9876543210' })).toBeVisible();
    await expect(page.getByRole('row').filter({ hasText: 'Product B' })).toBeVisible();
  });

  test('it shall search barcodes by code', async function ({ page }) {
    await Promise.all([
      loadEmptyFixture(page),
      setupDatabase(tursoLibSQLiteServer(), async function setupData(sql) {
        await sql`INSERT INTO inventories (name, unit_price, unit_of_measurement, account_code, cost, stock) VALUES ('Product A', 10000, 'pcs', 11310, 0, 0)`;
        await sql`INSERT INTO inventories (name, unit_price, unit_of_measurement, account_code, cost, stock) VALUES ('Product B', 20000, 'pcs', 11310, 0, 0)`;
        await sql`INSERT INTO inventory_barcodes (code, inventory_id) VALUES ('1234567890', 1)`;
        await sql`INSERT INTO inventory_barcodes (code, inventory_id) VALUES ('9876543210', 2)`;
      }),
    ]);

    await page.evaluate(setupView, tursoLibSQLiteServer().url);

    await page.getByLabel('Search', { exact: true }).fill('1234');

    await expect(page.getByRole('row').filter({ hasText: '1234567890' })).toBeVisible();
    await expect(page.getByRole('row').filter({ hasText: '9876543210' })).not.toBeVisible();
  });

  test('it shall search barcodes by product name', async function ({ page }) {
    await Promise.all([
      loadEmptyFixture(page),
      setupDatabase(tursoLibSQLiteServer(), async function setupData(sql) {
        await sql`INSERT INTO inventories (name, unit_price, unit_of_measurement, account_code, cost, stock) VALUES ('Laptop Dell', 10000, 'pcs', 11310, 0, 0)`;
        await sql`INSERT INTO inventories (name, unit_price, unit_of_measurement, account_code, cost, stock) VALUES ('Mouse Wireless', 20000, 'pcs', 11310, 0, 0)`;
        await sql`INSERT INTO inventory_barcodes (code, inventory_id) VALUES ('1234567890', 1)`;
        await sql`INSERT INTO inventory_barcodes (code, inventory_id) VALUES ('9876543210', 2)`;
      }),
    ]);

    await page.evaluate(setupView, tursoLibSQLiteServer().url);

    await page.getByLabel('Search', { exact: true }).fill('laptop');

    await expect(page.getByRole('row').filter({ hasText: 'Laptop Dell' })).toBeVisible();
    await expect(page.getByRole('row').filter({ hasText: 'Mouse Wireless' })).not.toBeVisible();
  });

  test('it shall clear search', async function ({ page }) {
    await Promise.all([
      loadEmptyFixture(page),
      setupDatabase(tursoLibSQLiteServer(), async function setupData(sql) {
        await sql`INSERT INTO inventories (name, unit_price, unit_of_measurement, account_code, cost, stock) VALUES ('Product A', 10000, 'pcs', 11310, 0, 0)`;
        await sql`INSERT INTO inventories (name, unit_price, unit_of_measurement, account_code, cost, stock) VALUES ('Product B', 20000, 'pcs', 11310, 0, 0)`;
        await sql`INSERT INTO inventory_barcodes (code, inventory_id) VALUES ('1234567890', 1)`;
        await sql`INSERT INTO inventory_barcodes (code, inventory_id) VALUES ('9876543210', 2)`;
      }),
    ]);

    await page.evaluate(setupView, tursoLibSQLiteServer().url);

    await page.getByLabel('Search', { exact: true }).fill('9875');
    await expect(page.getByRole('row').filter({ hasText: '9876543210' })).not.toBeVisible();

    await page.getByLabel('Clear search').click();
    await expect(page.getByLabel('Search', { exact: true })).toHaveValue('');
    await expect(page.getByRole('row').filter({ hasText: '1234567890' })).toBeVisible();
    await expect(page.getByRole('row').filter({ hasText: '9876543210' })).toBeVisible();
  });

  test('it shall display empty state when search has no results', async function ({ page }) {
    await Promise.all([
      loadEmptyFixture(page),
      setupDatabase(tursoLibSQLiteServer(), async function setupData(sql) {
        await sql`INSERT INTO inventories (name, unit_price, unit_of_measurement, account_code, cost, stock) VALUES ('Product A', 10000, 'pcs', 11310, 0, 0)`;
        await sql`INSERT INTO inventory_barcodes (code, inventory_id) VALUES ('1234567890', 1)`;
      }),
    ]);

    await page.evaluate(setupView, tursoLibSQLiteServer().url);

    await page.getByLabel('Search', { exact: true }).fill('Nonexistent Product');

    await expect(page.getByText('No barcodes match your search')).toBeVisible();
  });

  test('it shall paginate barcodes list', async function ({ page }) {
    await Promise.all([
      loadEmptyFixture(page),
      setupDatabase(tursoLibSQLiteServer(), async function setupData(sql) {
        // Insert 25 barcodes (page size is 20)
        for (let index = 1; index <= 25; index++) {
          await sql`INSERT INTO inventories (name, unit_price, unit_of_measurement, account_code, cost, stock) VALUES (${`Product ${index}`}, 10000, 'pcs', 11310, 0, 0)`;
          await sql`INSERT INTO inventory_barcodes (code, inventory_id) VALUES (${String(index).padStart(10, '0')}, ${index})`;
        }
      }),
    ]);

    await page.evaluate(setupView, tursoLibSQLiteServer().url);

    await expect(page.getByText('1-20 of 25')).toBeVisible();
    await expect(page.getByRole('row').filter({ has: page.getByRole('cell', { name: 'Product 1', exact: true }) })).toBeVisible();
    await expect(page.getByRole('row').filter({ has: page.getByRole('cell', { name: 'Product 25', exact: true }) })).not.toBeVisible();

    await page.getByRole('button', { name: 'Next page' }).click();

    await expect(page.getByText('21-25 of 25')).toBeVisible();
    await expect(page.getByRole('row').filter({ has: page.getByRole('cell', { name: 'Product 21', exact: true }) })).toBeVisible();
    await expect(page.getByRole('row').filter({ has: page.getByRole('cell', { name: 'Product 1', exact: true }) })).not.toBeVisible();

    await page.getByRole('button', { name: 'Previous page' }).click();

    await expect(page.getByText('1-20 of 25')).toBeVisible();
    await expect(page.getByRole('row').filter({ has: page.getByRole('cell', { name: 'Product 1', exact: true }) })).toBeVisible();
  });

  test('it shall disable pagination buttons appropriately', async function ({ page }) {
    await Promise.all([
      loadEmptyFixture(page),
      setupDatabase(tursoLibSQLiteServer(), async function setupData(sql) {
        // Insert 25 barcodes (page size is 20)
        for (let index = 1; index <= 25; index++) {
          await sql`INSERT INTO inventories (name, unit_price, unit_of_measurement, account_code, cost, stock) VALUES (${`Product ${index}`}, 10000, 'pcs', 11310, 0, 0)`;
          await sql`INSERT INTO inventory_barcodes (code, inventory_id) VALUES (${String(index).padStart(10, '0')}, ${index})`;
        }
      }),
    ]);

    await page.evaluate(setupView, tursoLibSQLiteServer().url);

    await expect(page.getByRole('button', { name: 'Previous page' })).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Next page' })).toBeEnabled();

    await page.getByRole('button', { name: 'Next page' }).click();

    await expect(page.getByRole('button', { name: 'Previous page' })).toBeEnabled();
    await expect(page.getByRole('button', { name: 'Next page' })).toBeDisabled();
  });

  test('it shall open barcode assignment dialog', async function ({ page }) {
    await loadEmptyFixture(page);

    await page.evaluate(setupView, tursoLibSQLiteServer().url);

    await page.getByRole('button', { name: 'Assign Barcode' }).first().click();

    await expect(page.getByRole('dialog', { name: 'Assign Barcode' })).toBeVisible();
  });

  test('it shall unassign barcode with confirmation', async function ({ page }) {
    await Promise.all([
      loadEmptyFixture(page),
      setupDatabase(tursoLibSQLiteServer(), async function setupData(sql) {
        await sql`INSERT INTO inventories (name, unit_price, unit_of_measurement, account_code, cost, stock) VALUES ('Product A', 10000, 'pcs', 11310, 0, 0)`;
        await sql`INSERT INTO inventory_barcodes (code, inventory_id) VALUES ('1234567890', 1)`;
      }),
    ]);

    await page.evaluate(setupView, tursoLibSQLiteServer().url);

    await page.getByRole('button', { name: 'Unassign barcode 1234567890' }).click();

    const unassignBarcodeDialog = page.getByRole('dialog', { name: 'Unassign Barcode' });
    await expect(unassignBarcodeDialog).toBeVisible();
    await expect(unassignBarcodeDialog.getByText('Are you sure you want to unassign barcode')).toBeVisible();
    await expect(unassignBarcodeDialog.getByText('1234567890')).toBeVisible();
    await expect(unassignBarcodeDialog.getByText('Product A')).toBeVisible();

    await unassignBarcodeDialog.getByRole('button', { name: 'Unassign' }).click();

    await expect(unassignBarcodeDialog).not.toBeVisible();
    await expect(page.getByText('No barcodes assigned yet')).toBeVisible();
  });

  test('it shall cancel unassign barcode', async function ({ page }) {
    await Promise.all([
      loadEmptyFixture(page),
      setupDatabase(tursoLibSQLiteServer(), async function setupData(sql) {
        await sql`INSERT INTO inventories (name, unit_price, unit_of_measurement, account_code, cost, stock) VALUES ('Product A', 10000, 'pcs', 11310, 0, 0)`;
        await sql`INSERT INTO inventory_barcodes (code, inventory_id) VALUES ('1234567890', 1)`;
      })
    ]);

    await page.evaluate(setupView, tursoLibSQLiteServer().url);

    await page.getByRole('button', { name: 'Unassign barcode 1234567890' }).click();
    await expect(page.getByRole('dialog', { name: 'Unassign Barcode' })).toBeVisible();

    await page.getByRole('dialog', { name: 'Unassign Barcode' }).getByRole('button', { name: 'Cancel' }).click();

    await expect(page.getByRole('dialog', { name: 'Unassign Barcode' })).not.toBeVisible();
    await expect(page.getByRole('row').filter({ hasText: '1234567890' })).toBeVisible();
  });

  test('it shall reload barcodes after assignment', async function ({ page }) {
    await Promise.all([
      loadEmptyFixture(page),
      setupDatabase(tursoLibSQLiteServer(), async function setupData(sql) {
        await sql`INSERT INTO inventories (name, unit_price, unit_of_measurement, account_code, cost, stock) VALUES ('Product A', 10000, 'pcs', 11310, 0, 0)`;
      })
    ]);

    await page.evaluate(setupView, tursoLibSQLiteServer().url);

    await expect(page.getByText('No barcodes assigned yet')).toBeVisible();

    await page.getByRole('button', { name: 'Assign Barcode' }).first().click();
    await page.getByRole('textbox', { name: 'Barcode' }).fill('1234567890');
    await page.getByRole('button', { name: 'Select inventory' }).click();
    await page.getByRole('menuitemradio').filter({ hasText: 'Product A' }).click();
    await page.getByRole('dialog', { name: 'Assign Barcode' }).getByRole('button', { name: 'Assign' }).click();

    await expect(page.getByRole('row').filter({ hasText: '1234567890' })).toBeVisible();
    await expect(page.getByRole('row').filter({ hasText: 'Product A' })).toBeVisible();
  });

  test('it shall display error dialog on unassign failure', async function ({ page }) {
    await Promise.all([
      loadEmptyFixture(page),
      setupDatabase(tursoLibSQLiteServer(), async function setupData(sql) {
        await sql`INSERT INTO inventories (name, unit_price, unit_of_measurement, account_code, cost, stock) VALUES ('Product A', 10000, 'pcs', 11310, 0, 0)`;
        await sql`INSERT INTO inventory_barcodes (code, inventory_id) VALUES ('1234567890', 1)`;
      })
    ]);

    await page.evaluate(setupView, tursoLibSQLiteServer().url);
    await page.evaluate(async function simulateFaultyClient(tursoDatabaseUrl) {
      /** @type {DatabaseContextElement} */
      const database = document.querySelector('database-context');
      // Simulate error by corrupting database state
      const originalTransaction = database.transaction.bind(database);
      database.transaction = async function transaction() {
        const tx = await originalTransaction('write');
        const originalSql = tx.sql.bind(tx);
        /**
         * @param {TemplateStringsArray} strings
         * @param {...unknown} values
         */
        tx.sql = function sql(strings, ...values) {
          if (strings[0].includes('DELETE FROM inventory_barcodes')) {
            throw new Error('Simulated database error');
          }
          return originalSql(strings, ...values);
        };
        return tx;
      };
    }, tursoLibSQLiteServer().url);

    await page.getByRole('button', { name: 'Unassign barcode 1234567890' }).click();
    await page.getByRole('dialog', { name: 'Unassign Barcode' }).getByRole('button', { name: 'Unassign' }).click();

    await expect(page.getByRole('dialog', { name: 'Error' })).toBeVisible();
    await expect(page.getByText('Simulated database error')).toBeVisible();

    await page.getByRole('dialog', { name: 'Error' }).getByRole('button', { name: 'Dismiss' }).click();

    await expect(page.getByRole('dialog', { name: 'Error' })).not.toBeVisible();
  });

  test('it shall reset to first page on new search', async function ({ page }) {
    await Promise.all([
      loadEmptyFixture(page),
      setupDatabase(tursoLibSQLiteServer(), async function setupData(sql) {
        // Insert 25 barcodes (page size is 20)
        for (let index = 1; index <= 25; index++) {
          await sql`INSERT INTO inventories (name, unit_price, unit_of_measurement, account_code, cost, stock) VALUES (${`Product ${index}`}, 10000, 'pcs', 11310, 0, 0)`;
          await sql`INSERT INTO inventory_barcodes (code, inventory_id) VALUES (${String(index).padStart(10, '0')}, ${index})`;
        }
      })
    ]);

    await page.evaluate(setupView, tursoLibSQLiteServer().url);

    await page.getByRole('button', { name: 'Next page' }).click();
    await expect(page.getByText('21-25 of 25')).toBeVisible();

    await page.getByLabel('Search', { exact: true }).fill('Product 1');

    await expect(page.getByText('1-11 of 11')).toBeVisible();
  });
});
