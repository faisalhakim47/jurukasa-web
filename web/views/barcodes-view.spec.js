import { expect } from '@playwright/test';
import { jurukasaTest } from '#test/playwright/test-setup.js';
import { useConsoleOutput } from '#test/playwright/hooks/use-console-output.js';
import { useTursoLibSQLiteServer } from '#test/playwright/hooks/use-turso-libsqlite-server.js';
import { loadEmptyFixture } from '#test/playwright/tools/fixture.js';
import { setupDatabase } from '#test/playwright/tools/database.js';
import { useStrict } from '#test/playwright/hooks/use-strict.js';
/** @import { DatabaseContextElement } from '#web/contexts/database-context.js' */

const test = jurukasaTest;
const { describe } = test;

/** @param {string} tursoDatabaseUrl */
async function setupView(tursoDatabaseUrl) {
  document.body.innerHTML = `
    <ready-context>
      <router-context>
        <database-context provider="turso" name="My Business" turso-url=${tursoDatabaseUrl}>
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

describe('Barcodes', function () {
  useConsoleOutput(test);
  useStrict(test);
  const tursoLibSQLiteServer = useTursoLibSQLiteServer(test);

  test('displays empty state when no barcodes exist', async function ({ page }) {
    await loadEmptyFixture(page);

    await page.evaluate(setupView, tursoLibSQLiteServer().url);

    await expect(page.getByText('No barcodes assigned yet'), 'it shall display empty state message').toBeVisible();
    await expect(page.getByRole('button', { name: 'Assign Barcode' }).first(), 'it shall display Assign Barcode button').toBeVisible();
  });

  test('displays list of barcodes with product information', async function ({ page }) {
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

    await expect(page.getByRole('table', { name: 'Barcodes list' }), 'it shall display barcodes table').toBeVisible();
    await expect(page.getByRole('row').filter({ hasText: '1234567890' }), 'it shall display first barcode').toBeVisible();
    await expect(page.getByRole('row').filter({ hasText: 'Product A' }), 'it shall display first product name').toBeVisible();
    await expect(page.getByRole('row').filter({ hasText: '9876543210' }), 'it shall display second barcode').toBeVisible();
    await expect(page.getByRole('row').filter({ hasText: 'Product B' }), 'it shall display second product name').toBeVisible();
  });

  test('searches barcodes by code and product name', async function ({ page }) {
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
    await expect(page.getByRole('table', { name: 'Barcodes list' }), 'it shall display barcodes table').toBeVisible();

    await page.getByLabel('Search', { exact: true }).fill('1234');
    await expect(page.getByRole('row').filter({ hasText: '1234567890' }), 'it shall show matching barcode by code').toBeVisible();
    await expect(page.getByRole('row').filter({ hasText: '9876543210' }), 'it shall hide non-matching barcode').toBeHidden();

    await page.getByLabel('Clear search').click();
    await expect(page.getByLabel('Search', { exact: true }), 'it shall clear search field').toHaveValue('');
    await expect(page.getByRole('row').filter({ hasText: '1234567890' }), 'it shall show all barcodes after clear').toBeVisible();
    await expect(page.getByRole('row').filter({ hasText: '9876543210' }), 'it shall show all barcodes after clear').toBeVisible();
  });

  test('displays empty state when search has no results', async function ({ page }) {
    await Promise.all([
      loadEmptyFixture(page),
      setupDatabase(tursoLibSQLiteServer(), async function setupData(sql) {
        await sql`INSERT INTO inventories (name, unit_price, unit_of_measurement, account_code, cost, stock) VALUES ('Product A', 10000, 'pcs', 11310, 0, 0)`;
        await sql`INSERT INTO inventory_barcodes (code, inventory_id) VALUES ('1234567890', 1)`;
      }),
    ]);

    await page.evaluate(setupView, tursoLibSQLiteServer().url);
    await expect(page.getByRole('table', { name: 'Barcodes list' }), 'it shall display barcodes table').toBeVisible();

    await page.getByLabel('Search', { exact: true }).fill('Nonexistent Product');

    await expect(page.getByText('No barcodes match your search'), 'it shall display no results message').toBeVisible();
  });

  test('paginates barcodes list with disabled button states', async function ({ page }) {
    await Promise.all([
      loadEmptyFixture(page),
      setupDatabase(tursoLibSQLiteServer(), async function setupData(sql) {
        for (let index = 1; index <= 25; index++) {
          await sql`INSERT INTO inventories (name, unit_price, unit_of_measurement, account_code, cost, stock) VALUES (${`Product ${index}`}, 10000, 'pcs', 11310, 0, 0)`;
          await sql`INSERT INTO inventory_barcodes (code, inventory_id) VALUES (${String(index).padStart(10, '0')}, ${index})`;
        }
      }),
    ]);

    await page.evaluate(setupView, tursoLibSQLiteServer().url);

    await expect(page.getByText('1-20 of 25'), 'it shall show first page pagination info').toBeVisible();
    await expect(page.getByRole('row').filter({ has: page.getByRole('cell', { name: 'Product 1', exact: true }) }), 'it shall show first product on first page').toBeVisible();
    await expect(page.getByRole('row').filter({ has: page.getByRole('cell', { name: 'Product 25', exact: true }) }), 'it shall not show last product on first page').not.toBeVisible();
    await expect(page.getByRole('button', { name: 'Previous page' }), 'it shall disable Previous page button on first page').toBeDisabled();
    await expect(page.getByRole('button', { name: 'Next page' }), 'it shall enable Next page button').toBeEnabled();

    await page.getByRole('button', { name: 'Next page' }).click();

    await expect(page.getByText('21-25 of 25'), 'it shall show second page pagination info').toBeVisible();
    await expect(page.getByRole('row').filter({ has: page.getByRole('cell', { name: 'Product 21', exact: true }) }), 'it shall show first product on second page').toBeVisible();
    await expect(page.getByRole('row').filter({ has: page.getByRole('cell', { name: 'Product 1', exact: true }) }), 'it shall not show first product on second page').not.toBeVisible();
    await expect(page.getByRole('button', { name: 'Previous page' }), 'it shall enable Previous page button').toBeEnabled();
    await expect(page.getByRole('button', { name: 'Next page' }), 'it shall disable Next page button on last page').toBeDisabled();

    await page.getByRole('button', { name: 'Previous page' }).click();

    await expect(page.getByText('1-20 of 25'), 'it shall return to first page').toBeVisible();
    await expect(page.getByRole('row').filter({ has: page.getByRole('cell', { name: 'Product 1', exact: true }) }), 'it shall show first product again').toBeVisible();
  });

  test('opens barcode assignment dialog', async function ({ page }) {
    await loadEmptyFixture(page);

    await page.evaluate(setupView, tursoLibSQLiteServer().url);

    await page.getByRole('button', { name: 'Assign Barcode' }).first().click();

    await expect(page.getByRole('dialog', { name: 'Assign Barcode' }), 'it shall open assignment dialog').toBeVisible();
  });

  test('unassigns barcode with confirmation dialog', async function ({ page }) {
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
    await expect(unassignBarcodeDialog, 'it shall open unassign confirmation dialog').toBeVisible();
    await expect(unassignBarcodeDialog.getByText('Are you sure you want to unassign barcode'), 'it shall display confirmation message').toBeVisible();
    await expect(unassignBarcodeDialog.getByText('1234567890'), 'it shall display barcode code').toBeVisible();
    await expect(unassignBarcodeDialog.getByText('Product A'), 'it shall display product name').toBeVisible();

    await unassignBarcodeDialog.getByRole('button', { name: 'Unassign' }).click();

    await expect(unassignBarcodeDialog, 'it shall close unassign dialog').not.toBeVisible();
    await expect(page.getByText('No barcodes assigned yet'), 'it shall show empty state after unassign').toBeVisible();
  });

  test('cancels unassign barcode action', async function ({ page }) {
    await Promise.all([
      loadEmptyFixture(page),
      setupDatabase(tursoLibSQLiteServer(), async function setupData(sql) {
        await sql`INSERT INTO inventories (name, unit_price, unit_of_measurement, account_code, cost, stock) VALUES ('Product A', 10000, 'pcs', 11310, 0, 0)`;
        await sql`INSERT INTO inventory_barcodes (code, inventory_id) VALUES ('1234567890', 1)`;
      })
    ]);

    await page.evaluate(setupView, tursoLibSQLiteServer().url);

    await page.getByRole('button', { name: 'Unassign barcode 1234567890' }).click();
    await expect(page.getByRole('dialog', { name: 'Unassign Barcode' }), 'it shall open unassign dialog').toBeVisible();

    await page.getByRole('dialog', { name: 'Unassign Barcode' }).getByRole('button', { name: 'Cancel' }).click();

    await expect(page.getByRole('dialog', { name: 'Unassign Barcode' }), 'it shall close unassign dialog').not.toBeVisible();
    await expect(page.getByRole('row').filter({ hasText: '1234567890' }), 'it shall still show barcode after cancel').toBeVisible();
  });

  test('assigns barcode and reloads list', async function ({ page }) {
    await Promise.all([
      loadEmptyFixture(page),
      setupDatabase(tursoLibSQLiteServer(), async function setupData(sql) {
        await sql`INSERT INTO inventories (name, unit_price, unit_of_measurement, account_code, cost, stock) VALUES ('Product A', 10000, 'pcs', 11310, 0, 0)`;
      })
    ]);

    await page.evaluate(setupView, tursoLibSQLiteServer().url);

    await expect(page.getByText('No barcodes assigned yet'), 'it shall show empty state initially').toBeVisible();

    await page.getByRole('button', { name: 'Assign Barcode' }).first().click();
    await page.getByRole('textbox', { name: 'Barcode' }).fill('1234567890');
    await page.getByRole('button', { name: 'Select inventory' }).click();
    await page.getByRole('menuitemradio').filter({ hasText: 'Product A' }).click();
    await page.getByRole('dialog', { name: 'Assign Barcode' }).getByRole('button', { name: 'Assign' }).click();

    await expect(page.getByRole('row').filter({ hasText: '1234567890' }), 'it shall show new barcode in list').toBeVisible();
    await expect(page.getByRole('row').filter({ hasText: 'Product A' }), 'it shall show product in list').toBeVisible();
  });

  test('displays error dialog on unassign failure', async function ({ page }) {
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
      const originalTransaction = database.transaction.bind(database);
      database.transaction = async function faultyTransaction() {
        const tx = await originalTransaction('write');
        const originalSql = tx.sql.bind(tx);
        /**
         * @param {TemplateStringsArray} strings
         * @param {...unknown} values
         */
        tx.sql = function faultySql(strings, ...values) {
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

    await expect(page.getByRole('dialog', { name: 'Error' }), 'it shall display error dialog').toBeVisible();
    await expect(page.getByText('Simulated database error'), 'it shall display error message').toBeVisible();

    await page.getByRole('dialog', { name: 'Error' }).getByRole('button', { name: 'Dismiss' }).click();

    await expect(page.getByRole('dialog', { name: 'Error' }), 'it shall close error dialog').not.toBeVisible();
  });

  test('resets to first page on new search', async function ({ page }) {
    await Promise.all([
      loadEmptyFixture(page),
      setupDatabase(tursoLibSQLiteServer(), async function setupData(sql) {
        for (let index = 1; index <= 25; index++) {
          await sql`INSERT INTO inventories (name, unit_price, unit_of_measurement, account_code, cost, stock) VALUES (${`Product ${index}`}, 10000, 'pcs', 11310, 0, 0)`;
          await sql`INSERT INTO inventory_barcodes (code, inventory_id) VALUES (${String(index).padStart(10, '0')}, ${index})`;
        }
      })
    ]);

    await page.evaluate(setupView, tursoLibSQLiteServer().url);
    await expect(page.getByRole('table', { name: 'Barcodes list' }), 'it shall display barcodes table').toBeVisible();

    await page.getByRole('button', { name: 'Next page' }).click();
    await expect(page.getByText('21-25 of 25'), 'it shall be on second page').toBeVisible();

    await page.getByLabel('Search', { exact: true }).fill('Product 1');

    await expect(page.getByText('1-11 of 11'), 'it shall reset to first page on search').toBeVisible();
  });
});
