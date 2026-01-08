import { test, expect } from '@playwright/test';
import { useTursoLibSQLiteServer } from '#test/hooks/use-turso-libsqlite-server.js';
import { loadEmptyFixture } from '#test/tools/fixture.js';
import { setupDatabase } from '#test/tools/database.js';

/** @import { DatabaseContextElement } from '#web/contexts/database-context.js' */

const { describe } = test;

/** @param {string} tursoDatabaseUrl */
async function setupView(tursoDatabaseUrl) {
  localStorage.setItem('tursoDatabaseUrl', tursoDatabaseUrl);
  localStorage.setItem('tursoDatabaseKey', '');
  await import('/web/views/pos-view.js');
  await customElements.whenDefined('pos-view');
  document.body.innerHTML = `
    <ready-context>
      <router-context>
        <database-context>
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

describe('POS View', function () {
  const tursoLibSQLiteServer = useTursoLibSQLiteServer(test);

  /**
   * @param {import('#test/tools/database.js').SQLFunction} sql
   */
  async function setupPOSData(sql) {
    // All accounts and most tags already exist from default chart, just add specific inventories, payment methods, and discounts
    await sql`INSERT INTO inventories (id, name, unit_price, unit_of_measurement, account_code) VALUES (1, 'Product A', 10000, 'piece', 11310)`;
    await sql`INSERT INTO inventories (id, name, unit_price, unit_of_measurement, account_code) VALUES (2, 'Product B', 20000, 'piece', 11310)`;
    await sql`INSERT INTO inventories (id, name, unit_price, unit_of_measurement, account_code) VALUES (3, 'Product C', 15000, 'unit', 11310)`;
    await sql`INSERT INTO payment_methods (id, name, min_fee, max_fee, rel_fee, account_code) VALUES (1, 'Cash', 0, 0, 0, 11110)`;
    await sql`INSERT INTO payment_methods (id, name, min_fee, max_fee, rel_fee, account_code) VALUES (2, 'Bank Transfer', 2000, 5000, 10000, 11120)`;
    await sql`INSERT INTO payment_methods (id, name, min_fee, max_fee, rel_fee, account_code) VALUES (3, 'Credit Card', 1000, 10000, 20000, 11120)`;
    await sql`INSERT INTO discounts (id, name, inventory_id, multiple_of_quantity, amount) VALUES (1, 'Buy 2 Get 5k Off', 1, 2, 5000)`;
    await sql`INSERT INTO discounts (id, name, inventory_id, multiple_of_quantity, amount) VALUES (2, 'General 10% Off', NULL, 1, 10000)`;
  }

  test('it shall display POS interface with inventory selector', async function ({ page }) {
    await Promise.all([
      loadEmptyFixture(page),
      setupDatabase(tursoLibSQLiteServer(), setupPOSData),
    ]);

    await page.evaluate(setupView, tursoLibSQLiteServer().url);

    await expect(page.getByRole('heading', { name: /point of sale/i })).toBeVisible();
    await expect(page.getByRole('heading', { name: /products/i })).toBeVisible();
    await expect(page.getByLabel(/search/i)).toBeVisible();
  });

  test('it shall display empty invoice state initially', async function ({ page }) {
    await Promise.all([
      loadEmptyFixture(page),
      setupDatabase(tursoLibSQLiteServer(), setupPOSData),
    ]);

    await page.evaluate(setupView, tursoLibSQLiteServer().url);

    await expect(page.getByText(/no items added/i)).toBeVisible();
    await expect(page.getByText(/no discounts applied/i)).toBeVisible();
    await expect(page.getByText(/no payments added/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /complete sale/i })).toBeDisabled();
  });

  test('it shall display inventories in the selector', async function ({ page }) {
    await Promise.all([
      loadEmptyFixture(page),
      setupDatabase(tursoLibSQLiteServer(), setupPOSData),
    ]);

    await page.evaluate(setupView, tursoLibSQLiteServer().url);

    await expect(page.getByRole('listitem').filter({ hasText: 'Product A' })).toBeVisible();
    await expect(page.getByRole('listitem').filter({ hasText: 'Product B' })).toBeVisible();
    await expect(page.getByRole('listitem').filter({ hasText: 'Product C' })).toBeVisible();
    await expect(page.getByText(/stock.*100/i)).toBeVisible();
  });

  test('it shall add inventory to sale when clicked', async function ({ page }) {
    await Promise.all([
      loadEmptyFixture(page),
      setupDatabase(tursoLibSQLiteServer(), setupPOSData),
    ]);

    await page.evaluate(setupView, tursoLibSQLiteServer().url);

    await expect(page.getByRole('listitem').filter({ hasText: 'Product A' })).toBeVisible();
    await page.getByRole('listitem').filter({ hasText: 'Product A' }).click();

    const itemsTable = page.getByRole('table', { name: /items/i });
    await expect(itemsTable.getByText('Product A')).toBeVisible();
    await expect(itemsTable.getByText('1', { exact: true })).toBeVisible();
  });

  test('it shall increment quantity when same item is added multiple times', async function ({ page }) {
    await Promise.all([
      loadEmptyFixture(page),
      setupDatabase(tursoLibSQLiteServer(), setupPOSData),
    ]);

    await page.evaluate(setupView, tursoLibSQLiteServer().url);

    await expect(page.getByRole('listitem').filter({ hasText: 'Product A' })).toBeVisible();
    await page.getByRole('listitem').filter({ hasText: 'Product A' }).click();
    await page.getByRole('listitem').filter({ hasText: 'Product A' }).click();

    const itemsTable = page.getByRole('table', { name: /items/i });
    const productRow = itemsTable.getByRole('row').filter({ hasText: 'Product A' });
    await expect(productRow.getByText('2')).toBeVisible();
  });

  test('it shall allow incrementing item quantity using plus button', async function ({ page }) {
    await Promise.all([
      loadEmptyFixture(page),
      setupDatabase(tursoLibSQLiteServer(), setupPOSData),
    ]);

    await page.evaluate(setupView, tursoLibSQLiteServer().url);

    await page.getByRole('listitem').filter({ hasText: 'Product A' }).click();
    
    const itemsTable = page.getByRole('table', { name: /items/i });
    const productRow = itemsTable.getByRole('row').filter({ hasText: 'Product A' });
    await productRow.getByRole('button', { name: /increase quantity/i }).click();

    await expect(productRow.getByText('2')).toBeVisible();
  });

  test('it shall allow decrementing item quantity using minus button', async function ({ page }) {
    await Promise.all([
      loadEmptyFixture(page),
      setupDatabase(tursoLibSQLiteServer(), setupPOSData),
    ]);

    await page.evaluate(setupView, tursoLibSQLiteServer().url);

    await page.getByRole('listitem').filter({ hasText: 'Product A' }).click();
    await page.getByRole('listitem').filter({ hasText: 'Product A' }).click();
    
    const itemsTable = page.getByRole('table', { name: /items/i });
    const productRow = itemsTable.getByRole('row').filter({ hasText: 'Product A' });
    await productRow.getByRole('button', { name: /decrease quantity/i }).click();

    await expect(productRow.getByText('1', { exact: true })).toBeVisible();
  });

  test('it shall remove item when quantity is decremented to zero', async function ({ page }) {
    await Promise.all([
      loadEmptyFixture(page),
      setupDatabase(tursoLibSQLiteServer(), setupPOSData),
    ]);

    await page.evaluate(setupView, tursoLibSQLiteServer().url);

    await page.getByRole('listitem').filter({ hasText: 'Product A' }).click();
    
    const itemsTable = page.getByRole('table', { name: /items/i });
    const productRow = itemsTable.getByRole('row').filter({ hasText: 'Product A' });
    await productRow.getByRole('button', { name: /decrease quantity/i }).click();

    await expect(page.getByText(/no items added/i)).toBeVisible();
  });

  test('it shall allow removing item using delete button', async function ({ page }) {
    await Promise.all([
      loadEmptyFixture(page),
      setupDatabase(tursoLibSQLiteServer(), setupPOSData),
    ]);

    await page.evaluate(setupView, tursoLibSQLiteServer().url);

    await page.getByRole('listitem').filter({ hasText: 'Product A' }).click();
    await page.getByRole('listitem').filter({ hasText: 'Product A' }).click();
    await page.getByRole('listitem').filter({ hasText: 'Product A' }).click();
    
    const itemsTable = page.getByRole('table', { name: /items/i });
    const productRow = itemsTable.getByRole('row').filter({ hasText: 'Product A' });
    await productRow.getByRole('button', { name: /remove item/i }).click();

    await expect(page.getByText(/no items added/i)).toBeVisible();
  });

  test('it shall filter inventories when search query is entered', async function ({ page }) {
    await Promise.all([
      loadEmptyFixture(page),
      setupDatabase(tursoLibSQLiteServer(), setupPOSData),
    ]);

    await page.evaluate(setupView, tursoLibSQLiteServer().url);

    await expect(page.getByRole('listitem').filter({ hasText: 'Product A' })).toBeVisible();
    await expect(page.getByRole('listitem').filter({ hasText: 'Product B' })).toBeVisible();
    
    await page.getByLabel(/search/i).fill('Product A');

    await expect(page.getByRole('listitem').filter({ hasText: 'Product A' })).toBeVisible();
    await expect(page.getByRole('listitem').filter({ hasText: 'Product B' })).not.toBeVisible();
  });

  test('it shall display total amount correctly', async function ({ page }) {
    await Promise.all([
      loadEmptyFixture(page),
      setupDatabase(tursoLibSQLiteServer(), setupPOSData),
    ]);

    await page.evaluate(setupView, tursoLibSQLiteServer().url);

    await page.getByRole('listitem').filter({ hasText: 'Product A' }).click();
    await page.getByRole('listitem').filter({ hasText: 'Product B' }).click();

    await expect(page.getByText(/total/i).and(page.getByText(/30,000/i))).toBeVisible();
  });

  test('it shall clear sale when clear button is clicked', async function ({ page }) {
    await Promise.all([
      loadEmptyFixture(page),
      setupDatabase(tursoLibSQLiteServer(), setupPOSData),
    ]);

    await page.evaluate(setupView, tursoLibSQLiteServer().url);

    await page.getByRole('listitem').filter({ hasText: 'Product A' }).click();
    
    const itemsTable = page.getByRole('table', { name: /items/i });
    await expect(itemsTable.getByText('Product A')).toBeVisible();
    
    await page.getByRole('button', { name: /clear/i }).click();

    await expect(page.getByText(/no items added/i)).toBeVisible();
  });

  test('it shall show error when trying to complete sale without payment', async function ({ page }) {
    await Promise.all([
      loadEmptyFixture(page),
      setupDatabase(tursoLibSQLiteServer(), setupPOSData),
    ]);

    await page.evaluate(setupView, tursoLibSQLiteServer().url);

    await page.getByRole('listitem').filter({ hasText: 'Product A' }).click();
    
    await expect(page.getByRole('button', { name: /complete sale/i })).toBeDisabled();
  });
});
