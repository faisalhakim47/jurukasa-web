import { expect } from '@playwright/test';
import { jurukasaTest } from '#test/playwright/test-setup.js';
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
              <purchases-view></purchases-view>
            </i18n-context>
          </device-context>
        </database-context>
      </router-context>
    </ready-context>
  `;
}

function insertNewPurchase() {
  /** @type {DatabaseContextElement} */
  const database = document.querySelector('database-context');
  return database.sql`INSERT INTO purchases (id, supplier_id, purchase_time, post_time) VALUES (2, 1, 2000000, 2000000)`;
}

describe('Purchases View', function () {
  useStrict(test);
  const tursoLibSQLiteServer = useTursoLibSQLiteServer(test);

  test('display empty state when no purchases exist', async function ({ page }) {
    await loadEmptyFixture(page);

    await page.evaluate(setupView, tursoLibSQLiteServer().url);

    await expect(page.getByRole('table', { name: 'Purchases list' }), 'it shall not display purchases table when no purchases exist').not.toBeVisible();
    await expect(page.getByText('No Purchases Found'), 'it shall display "No Purchases Found" message').toBeVisible();
    await expect(page.getByText('Start by recording your first purchase to track inventory costs'), 'it shall display empty state helper text').toBeVisible();
    await expect(page.getByRole('button', { name: 'New Purchase' }).first(), 'it shall display "New Purchase" button').toBeVisible();
  });

  test('display purchases list with supplier and status information', async function ({ page }) {
    await Promise.all([
      loadEmptyFixture(page),
      setupDatabase(tursoLibSQLiteServer(), async function setupData(sql) {
        await sql`INSERT INTO suppliers (id, name, phone_number) VALUES (1, 'Supplier A', '081234567890')`;
        await sql`INSERT INTO suppliers (id, name, phone_number) VALUES (2, 'Supplier B', '082345678901')`;
        await sql`INSERT INTO accounts (account_code, name, normal_balance, create_time, update_time) VALUES (11111, 'Inventory Account', 0, 0, 0)`;
        await sql`INSERT INTO account_tags (account_code, tag) VALUES (11111, 'POS - Inventory')`;
        await sql`INSERT INTO inventories (id, name, unit_price, unit_of_measurement, account_code) VALUES (1, 'Product A', 10000, 'piece', 11111)`;
        await sql`INSERT INTO inventories (id, name, unit_price, unit_of_measurement, account_code) VALUES (2, 'Product B', 20000, 'piece', 11111)`;
        await sql`INSERT INTO purchases (id, supplier_id, purchase_time, post_time) VALUES (1, 1, 1000000, 1000000)`;
        await sql`INSERT INTO purchases (id, supplier_id, purchase_time, post_time) VALUES (2, 2, 2000000, NULL)`;
        await sql`INSERT INTO purchase_lines (purchase_id, line_number, inventory_id, supplier_quantity, quantity, price) VALUES (1, 1, 1, 10, 10, 100000)`;
        await sql`INSERT INTO purchase_lines (purchase_id, line_number, inventory_id, supplier_quantity, quantity, price) VALUES (1, 2, 2, 5, 5, 100000)`;
        await sql`INSERT INTO purchase_lines (purchase_id, line_number, inventory_id, supplier_quantity, quantity, price) VALUES (2, 1, 1, 3, 3, 30000)`;
      }),
    ]);

    await page.evaluate(setupView, tursoLibSQLiteServer().url);

    await expect(page.getByRole('table', { name: 'Purchases list' }), 'it shall display purchases table').toBeVisible();
    await expect(page.getByRole('button', { name: '#1' }), 'it shall display purchase #1 button').toBeVisible();
    await expect(page.getByRole('button', { name: '#2' }), 'it shall display purchase #2 button').toBeVisible();
    
    const tableContent = page.getByRole('table', { name: 'Purchases list' });
    await expect(tableContent.getByText('Supplier A'), 'it shall display Supplier A in table').toBeVisible();
    await expect(tableContent.getByText('Supplier B'), 'it shall display Supplier B in table').toBeVisible();
    await expect(tableContent.getByText('Posted'), 'it shall display Posted status').toBeVisible();
    await expect(tableContent.getByText('Draft'), 'it shall display Draft status').toBeVisible();
  });

  test('filter purchases by status and display correct results', async function ({ page }) {
    await Promise.all([
      loadEmptyFixture(page),
      setupDatabase(tursoLibSQLiteServer(), async function setupData(sql) {
        await sql`INSERT INTO suppliers (id, name, phone_number) VALUES (1, 'Test Supplier', NULL)`;
        await sql`INSERT INTO purchases (id, supplier_id, purchase_time, post_time) VALUES (1, 1, 1000000, 1000000)`;
        await sql`INSERT INTO purchases (id, supplier_id, purchase_time, post_time) VALUES (2, 1, 2000000, NULL)`;
        await sql`INSERT INTO purchases (id, supplier_id, purchase_time, post_time) VALUES (3, 1, 3000000, NULL)`;
      }),
    ]);

    await page.evaluate(setupView, tursoLibSQLiteServer().url);

    await expect(page.getByRole('table', { name: 'Purchases list' }), 'it shall display purchases table').toBeVisible();
    await expect(page.getByRole('button', { name: '#1' }), 'it shall display purchase #1 button initially').toBeVisible();
    await expect(page.getByRole('button', { name: '#2' }), 'it shall display purchase #2 button initially').toBeVisible();
    await expect(page.getByRole('button', { name: '#3' }), 'it shall display purchase #3 button initially').toBeVisible();

    await page.getByLabel('Status').click();
    await page.getByRole('menuitem', { name: 'Posted' }).click();

    await expect(page.getByRole('button', { name: '#1' }), 'it shall display only posted purchase #1 after filtering by Posted status').toBeVisible();
    await expect(page.getByRole('button', { name: '#2' }), 'it shall not display draft purchase #2 after filtering by Posted status').not.toBeVisible();
    await expect(page.getByRole('button', { name: '#3' }), 'it shall not display draft purchase #3 after filtering by Posted status').not.toBeVisible();

    await page.getByLabel('Status').click();
    await page.getByRole('menuitem', { name: 'Draft' }).click();

    await expect(page.getByRole('button', { name: '#1' }), 'it shall not display posted purchase #1 after filtering by Draft status').not.toBeVisible();
    await expect(page.getByRole('button', { name: '#2' }), 'it shall display draft purchase #2 after filtering by Draft status').toBeVisible();
    await expect(page.getByRole('button', { name: '#3' }), 'it shall display draft purchase #3 after filtering by Draft status').toBeVisible();
  });

  test('filter purchases by supplier search query', async function ({ page }) {
    await Promise.all([
      loadEmptyFixture(page),
      setupDatabase(tursoLibSQLiteServer(), async function setupData(sql) {
        await sql`INSERT INTO suppliers (id, name, phone_number) VALUES (1, 'ABC Supplier', NULL)`;
        await sql`INSERT INTO suppliers (id, name, phone_number) VALUES (2, 'XYZ Trading', NULL)`;
        await sql`INSERT INTO purchases (id, supplier_id, purchase_time, post_time) VALUES (1, 1, 1000000, 1000000)`;
        await sql`INSERT INTO purchases (id, supplier_id, purchase_time, post_time) VALUES (2, 2, 2000000, 2000000)`;
      }),
    ]);

    await page.evaluate(setupView, tursoLibSQLiteServer().url);

    await expect(page.getByRole('table', { name: 'Purchases list' }), 'it shall display purchases table').toBeVisible();
    
    const tableContent = page.getByRole('table', { name: 'Purchases list' });
    await expect(tableContent.getByText('ABC Supplier'), 'it shall display ABC Supplier initially').toBeVisible();
    await expect(tableContent.getByText('XYZ Trading'), 'it shall display XYZ Trading initially').toBeVisible();

    await page.getByLabel('Search').fill('ABC');

    await expect(tableContent.getByText('ABC Supplier'), 'it shall display ABC Supplier after search').toBeVisible();
    await expect(tableContent.getByText('XYZ Trading'), 'it shall not display XYZ Trading after ABC search').not.toBeVisible();
  });

  test('navigate through paginated purchases list', async function ({ page }) {
    await Promise.all([
      loadEmptyFixture(page),
      setupDatabase(tursoLibSQLiteServer(), async function setupData(sql) {
        await sql`INSERT INTO suppliers (id, name, phone_number) VALUES (1, 'Test Supplier', NULL)`;
        for (let index = 1; index <= 25; index++) {
          await sql`INSERT INTO purchases (id, supplier_id, purchase_time, post_time) VALUES (${index}, 1, ${index * 1000}, ${index * 1000})`;
        }
      }),
    ]);

    await page.evaluate(setupView, tursoLibSQLiteServer().url);

    await expect(page.getByRole('table', { name: 'Purchases list' }), 'it shall display purchases table').toBeVisible();
    await expect(page.getByRole('navigation', { name: 'Pagination' }), 'it shall display pagination navigation').toBeVisible();
    await expect(page.getByText('Showing 1–20 of 25'), 'it shall display correct pagination info on first page').toBeVisible();
    await expect(page.getByRole('button', { name: '#25' }), 'it shall display purchase #25 button on first page').toBeVisible();
    await expect(page.getByRole('button', { name: '#6' }), 'it shall display purchase #6 button on first page').toBeVisible();
    await expect(page.getByRole('button', { name: '#5' }), 'it shall not display purchase #5 button on first page').not.toBeVisible();

    await page.getByRole('button', { name: 'Next page' }).click();

    await expect(page.getByText('Showing 21–25 of 25'), 'it shall display correct pagination info on second page').toBeVisible();
    await expect(page.getByRole('button', { name: '#5' }), 'it shall display purchase #5 button on second page').toBeVisible();
    await expect(page.getByRole('button', { name: '#1' }), 'it shall display purchase #1 button on second page').toBeVisible();
    await expect(page.getByRole('button', { name: '#25' }), 'it shall not display purchase #25 button on second page').not.toBeVisible();
  });

  test('display item count and total amount for each purchase', async function ({ page }) {
    await Promise.all([
      loadEmptyFixture(page),
      setupDatabase(tursoLibSQLiteServer(), async function setupData(sql) {
        await sql`INSERT INTO suppliers (id, name, phone_number) VALUES (1, 'Test Supplier', NULL)`;
        await sql`INSERT INTO accounts (account_code, name, normal_balance, create_time, update_time) VALUES (11112, 'Inventory Account', 0, 0, 0)`;
        await sql`INSERT INTO account_tags (account_code, tag) VALUES (11112, 'POS - Inventory')`;
        await sql`INSERT INTO inventories (id, name, unit_price, unit_of_measurement, account_code) VALUES (1, 'Product A', 10000, 'piece', 11112)`;
        await sql`INSERT INTO purchases (id, supplier_id, purchase_time, post_time) VALUES (1, 1, 1000000, 1000000)`;
        await sql`INSERT INTO purchase_lines (purchase_id, line_number, inventory_id, supplier_quantity, quantity, price) VALUES (1, 1, 1, 10, 10, 100000)`;
        await sql`INSERT INTO purchase_lines (purchase_id, line_number, inventory_id, supplier_quantity, quantity, price) VALUES (1, 2, 1, 5, 5, 50000)`;
      }),
    ]);

    await page.evaluate(setupView, tursoLibSQLiteServer().url);

    await expect(page.getByRole('table', { name: 'Purchases list' }), 'it shall display purchases table').toBeVisible();
    
    const purchaseRow = page.getByRole('row').filter({ has: page.getByRole('button', { name: '#1' }) });
    await expect(purchaseRow.locator('span').filter({ hasText: /^2$/ }), 'it shall display item count of 2 for purchase').toBeVisible();
    await expect(purchaseRow.getByText(/150/), 'it shall display total amount of 150 for purchase').toBeVisible();
  });

  test('open purchase details dialog when purchase ID is clicked', async function ({ page }) {
    await Promise.all([
      loadEmptyFixture(page),
      setupDatabase(tursoLibSQLiteServer(), async function setupData(sql) {
        await sql`INSERT INTO suppliers (id, name, phone_number) VALUES (1, 'Test Supplier', NULL)`;
        await sql`INSERT INTO purchases (id, supplier_id, purchase_time, post_time) VALUES (1, 1, 1000000, 1000000)`;
      }),
    ]);

    await page.evaluate(setupView, tursoLibSQLiteServer().url);

    await expect(page.getByRole('table', { name: 'Purchases list' }), 'it shall display purchases table').toBeVisible();

    await page.getByRole('button', { name: '#1' }).click();

    await expect(page.getByRole('dialog', { name: 'Purchase #1' }), 'it shall display Purchase Details dialog').toBeVisible();
  });

  test('refresh purchases list when refresh button is clicked', async function ({ page }) {
    await Promise.all([
      loadEmptyFixture(page),
      setupDatabase(tursoLibSQLiteServer(), async function setupData(sql) {
        await sql`INSERT INTO suppliers (id, name, phone_number) VALUES (1, 'Test Supplier', NULL)`;
        await sql`INSERT INTO purchases (id, supplier_id, purchase_time, post_time) VALUES (1, 1, 1000000, 1000000)`;
      }),
    ]);

    await page.evaluate(setupView, tursoLibSQLiteServer().url);

    await expect(page.getByRole('table', { name: 'Purchases list' }), 'it shall display purchases table').toBeVisible();
    await expect(page.getByRole('button', { name: '#1' }), 'it shall display purchase #1 button initially').toBeVisible();

    await page.evaluate(insertNewPurchase);

    await page.getByRole('button', { name: 'Refresh' }).click();

    await expect(page.getByRole('button', { name: '#2' }), 'it shall display newly added purchase #2 after refresh').toBeVisible();
  });
});
