import { expect } from '@playwright/test';
import { jurukasaTest } from '#test/playwright/test-setup.js';
import { useTursoLibSQLiteServer } from '#test/playwright/hooks/use-turso-libsqlite-server.js';
import { loadEmptyFixture } from '#test/playwright/tools/fixture.js';
import { setupDatabase } from '#test/playwright/tools/database.js';
import { useStrict } from '#test/playwright/hooks/use-strict.js';
import { useConsoleOutput } from '#test/playwright/hooks/use-console-output.js';

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
              <pos-view></pos-view>
            </i18n-context>
          </device-context>
        </database-context>
      </router-context>
    </ready-context>
  `;
}

/**
 * @param {import('#test/playwright/tools/database.js').SQLFunction} sql
 */
async function setupPOSData(sql) {
  await sql`INSERT INTO inventories (id, name, unit_price, unit_of_measurement, account_code, stock) VALUES (1, 'Product A', 10000, 'piece', 11310, 100)`;
  await sql`INSERT INTO inventories (id, name, unit_price, unit_of_measurement, account_code, stock) VALUES (2, 'Product B', 20000, 'piece', 11310, 100)`;
  await sql`INSERT INTO inventories (id, name, unit_price, unit_of_measurement, account_code, stock) VALUES (3, 'Product C', 15000, 'unit', 11310, 100)`;
  await sql`INSERT INTO payment_methods (id, name, min_fee, max_fee, rel_fee, account_code) VALUES (1, 'Cash', 0, 0, 0, 11110)`;
  await sql`INSERT INTO payment_methods (id, name, min_fee, max_fee, rel_fee, account_code) VALUES (2, 'Bank Transfer', 2000, 5000, 10000, 11120)`;
  await sql`INSERT INTO payment_methods (id, name, min_fee, max_fee, rel_fee, account_code) VALUES (3, 'Credit Card', 1000, 10000, 20000, 11120)`;
  await sql`INSERT INTO discounts (id, name, inventory_id, multiple_of_quantity, amount) VALUES (1, 'Buy 2 Get 5k Off', 1, 2, 5000)`;
  await sql`INSERT INTO discounts (id, name, inventory_id, multiple_of_quantity, amount) VALUES (2, 'General 10% Off', NULL, 1, 10000)`;
}

describe('POS View', function () {
  useConsoleOutput(test);
  useStrict(test);
  const tursoLibSQLiteServer = useTursoLibSQLiteServer(test);

  test('shall display POS interface with inventory selector and empty invoice state', async function ({ page }) {
    await Promise.all([
      loadEmptyFixture(page),
      setupDatabase(tursoLibSQLiteServer(), setupPOSData),
    ]);

    await page.evaluate(setupView, tursoLibSQLiteServer().url);

    await expect(page.getByRole('heading', { name: 'Point of Sale' }), 'it shall display POS heading').toBeVisible();
    await expect(page.getByRole('heading', { name: 'Products' }), 'it shall display products section heading').toBeVisible();
    await expect(page.getByLabel('Search'), 'it shall display search field').toBeVisible();
    await expect(page.getByText('No items added yet'), 'it shall display empty items state').toBeVisible();
    await expect(page.getByText('No discounts applied'), 'it shall display empty discounts state').toBeVisible();
    await expect(page.getByText('No payments added'), 'it shall display empty payments state').toBeVisible();
    await expect(page.getByRole('button', { name: 'Complete Sale' }), 'it shall display disabled complete sale button initially').toBeDisabled();
  });

  test('shall display inventories in the selector', async function ({ page }) {
    await Promise.all([
      loadEmptyFixture(page),
      setupDatabase(tursoLibSQLiteServer(), setupPOSData),
    ]);

    await page.evaluate(setupView, tursoLibSQLiteServer().url);

    await expect(page.getByRole('listitem').filter({ hasText: 'Product A' }), 'it shall display Product A in inventory list').toBeVisible();
    await expect(page.getByRole('listitem').filter({ hasText: 'Product B' }), 'it shall display Product B in inventory list').toBeVisible();
    await expect(page.getByRole('listitem').filter({ hasText: 'Product C' }), 'it shall display Product C in inventory list').toBeVisible();
    await expect(page.getByRole('listitem').filter({ hasText: 'Product A' }).getByText('Stock: 100 piece'), 'it shall display stock information for Product A').toBeVisible();
  });

  test('shall add inventory to sale when clicked and increment quantity on subsequent clicks', async function ({ page }) {
    await Promise.all([
      loadEmptyFixture(page),
      setupDatabase(tursoLibSQLiteServer(), setupPOSData),
    ]);

    await page.evaluate(setupView, tursoLibSQLiteServer().url);

    await expect(page.getByRole('listitem').filter({ hasText: 'Product A' }), 'it shall display Product A in inventory list').toBeVisible();
    await page.getByRole('listitem').filter({ hasText: 'Product A' }).click();

    const itemsTable = page.getByRole('table', { name: 'Sale items' });
    await expect(itemsTable.getByText('Product A'), 'it shall add Product A to sale items').toBeVisible();
    await expect(itemsTable.getByText('1', { exact: true }), 'it shall display initial quantity of 1').toBeVisible();

    await page.getByRole('listitem').filter({ hasText: 'Product A' }).click();

    const productRow = itemsTable.getByRole('row').filter({ hasText: 'Product A' });
    const quantityCell = productRow.getByRole('cell').filter({ has: page.getByRole('button', { name: 'Increase quantity' }) });
    await expect(quantityCell.getByText('2', { exact: true }), 'it shall increment quantity to 2 on second click').toBeVisible();
  });

  test('shall allow incrementing and decrementing item quantity using buttons', async function ({ page }) {
    await Promise.all([
      loadEmptyFixture(page),
      setupDatabase(tursoLibSQLiteServer(), setupPOSData),
    ]);

    await page.evaluate(setupView, tursoLibSQLiteServer().url);

    await page.getByRole('listitem').filter({ hasText: 'Product A' }).click();

    const itemsTable = page.getByRole('table', { name: 'Sale items' });
    const productRow = itemsTable.getByRole('row').filter({ hasText: 'Product A' });

    await productRow.getByRole('button', { name: 'Increase quantity' }).click();

    const quantityCell = productRow.getByRole('cell').filter({ has: page.getByRole('button', { name: 'Increase quantity' }) });
    await expect(quantityCell.getByText('2', { exact: true }), 'it shall increment quantity to 2 using plus button').toBeVisible();

    await productRow.getByRole('button', { name: 'Decrease quantity' }).click();

    await expect(productRow.getByText('1', { exact: true }), 'it shall decrement quantity back to 1 using minus button').toBeVisible();
  });

  test('shall remove item when quantity is decremented to zero', async function ({ page }) {
    await Promise.all([
      loadEmptyFixture(page),
      setupDatabase(tursoLibSQLiteServer(), setupPOSData),
    ]);

    await page.evaluate(setupView, tursoLibSQLiteServer().url);

    await page.getByRole('listitem').filter({ hasText: 'Product A' }).click();

    const itemsTable = page.getByRole('table', { name: 'Sale items' });
    const productRow = itemsTable.getByRole('row').filter({ hasText: 'Product A' });
    await productRow.getByRole('button', { name: 'Decrease quantity' }).click();

    await expect(page.getByText('No items added yet'), 'it shall display empty state after removing item by decrementing to zero').toBeVisible();
  });

  test('shall allow removing item using delete button', async function ({ page }) {
    await Promise.all([
      loadEmptyFixture(page),
      setupDatabase(tursoLibSQLiteServer(), setupPOSData),
    ]);

    await page.evaluate(setupView, tursoLibSQLiteServer().url);

    await page.getByRole('listitem').filter({ hasText: 'Product A' }).click();
    await page.getByRole('listitem').filter({ hasText: 'Product A' }).click();
    await page.getByRole('listitem').filter({ hasText: 'Product A' }).click();

    const itemsTable = page.getByRole('table', { name: 'Sale items' });
    const productRow = itemsTable.getByRole('row').filter({ hasText: 'Product A' });
    await productRow.getByRole('button', { name: 'Remove item' }).click();

    await expect(page.getByText('No items added yet'), 'it shall display empty state after removing item using delete button').toBeVisible();
  });

  test('shall filter inventories when search query is entered', async function ({ page }) {
    await Promise.all([
      loadEmptyFixture(page),
      setupDatabase(tursoLibSQLiteServer(), setupPOSData),
    ]);

    await page.evaluate(setupView, tursoLibSQLiteServer().url);

    await expect(page.getByRole('listitem').filter({ hasText: 'Product A' }), 'it shall display Product A initially').toBeVisible();
    await expect(page.getByRole('listitem').filter({ hasText: 'Product B' }), 'it shall display Product B initially').toBeVisible();

    await page.getByLabel('Search').fill('Product A');

    await expect(page.getByRole('listitem').filter({ hasText: 'Product A' }), 'it shall display matching product after search').toBeVisible();
    await expect(page.getByRole('listitem').filter({ hasText: 'Product B' }), 'it shall hide non-matching product after search').not.toBeVisible();
  });

  test('shall display total amount correctly for multiple items', async function ({ page }) {
    await Promise.all([
      loadEmptyFixture(page),
      setupDatabase(tursoLibSQLiteServer(), setupPOSData),
    ]);

    await page.evaluate(setupView, tursoLibSQLiteServer().url);

    await page.getByRole('listitem').filter({ hasText: 'Product A' }).click();
    await page.getByRole('listitem').filter({ hasText: 'Product B' }).click();

    await expect(page.getByRole('cell', { name: '30,000' }), 'it shall display correct total amount for selected items').toBeVisible();
  });

  test('shall clear sale when clear button is clicked', async function ({ page }) {
    await Promise.all([
      loadEmptyFixture(page),
      setupDatabase(tursoLibSQLiteServer(), setupPOSData),
    ]);

    await page.evaluate(setupView, tursoLibSQLiteServer().url);

    await page.getByRole('listitem').filter({ hasText: 'Product A' }).click();

    const itemsTable = page.getByRole('table', { name: 'Sale items' });
    await expect(itemsTable.getByText('Product A'), 'it shall display Product A in sale items before clear').toBeVisible();

    await page.getByRole('button', { name: 'Clear' }).click();

    await expect(page.getByText('No items added yet'), 'it shall display empty state after clearing sale').toBeVisible();
  });

  test('shall disable complete sale button when no payment is added', async function ({ page }) {
    await Promise.all([
      loadEmptyFixture(page),
      setupDatabase(tursoLibSQLiteServer(), setupPOSData),
    ]);

    await page.evaluate(setupView, tursoLibSQLiteServer().url);

    await page.getByRole('listitem').filter({ hasText: 'Product A' }).click();

    await expect(page.getByRole('button', { name: 'Complete Sale' }), 'it shall disable complete sale button when no payment is added').toBeDisabled();
  });
});
