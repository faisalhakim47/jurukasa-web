import { test, expect } from '@playwright/test';
import { useTursoLibSQLiteServer } from '#test/hooks/use-turso-libsqlite-server.js';
import { loadEmptyFixture } from '#test/tools/fixture.js';
import { setupDatabase } from '#test/tools/database.js';
import { useStrict } from '#test/hooks/use-strict.js';
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
              <purchases-view></purchases-view>
            </i18n-context>
          </device-context>
        </database-context>
      </router-context>
    </ready-context>
  `;
}

describe('Purchases View', function () {
  useStrict(test);
  const tursoLibSQLiteServer = useTursoLibSQLiteServer(test);

  test('it shall display empty state when no purchases exist', async function ({ page }) {
    await loadEmptyFixture(page);

    await page.evaluate(setupView, tursoLibSQLiteServer().url);

    await expect(page.getByRole('table', { name: 'Purchases list' })).not.toBeVisible();
    await expect(page.getByText('No Purchases Found')).toBeVisible();
    await expect(page.getByText('Start by recording your first purchase to track inventory costs')).toBeVisible();
    await expect(page.getByRole('button', { name: 'New Purchase' }).first()).toBeVisible();
  });

  test('it shall display purchases list when purchases exist', async function ({ page }) {
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

    await expect(page.getByRole('table', { name: 'Purchases list' })).toBeVisible();
    await expect(page.getByRole('button', { name: '#1' })).toBeVisible();
    await expect(page.getByRole('button', { name: '#2' })).toBeVisible();
    
    const tableContent = page.getByRole('table', { name: 'Purchases list' });
    await expect(tableContent.getByText('Supplier A')).toBeVisible();
    await expect(tableContent.getByText('Supplier B')).toBeVisible();
    await expect(tableContent.getByText('Posted')).toBeVisible();
    await expect(tableContent.getByText('Draft')).toBeVisible();
  });

  test('it shall filter purchases by status', async function ({ page }) {
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

    await expect(page.getByRole('table', { name: 'Purchases list' })).toBeVisible();
    await expect(page.getByRole('button', { name: '#1' })).toBeVisible();
    await expect(page.getByRole('button', { name: '#2' })).toBeVisible();
    await expect(page.getByRole('button', { name: '#3' })).toBeVisible();

    await page.getByLabel('Status').click();
    await page.getByRole('menuitem', { name: 'Posted' }).click();

    await expect(page.getByRole('button', { name: '#1' })).toBeVisible();
    await expect(page.getByRole('button', { name: '#2' })).not.toBeVisible();
    await expect(page.getByRole('button', { name: '#3' })).not.toBeVisible();

    await page.getByLabel('Status').click();
    await page.getByRole('menuitem', { name: 'Draft' }).click();

    await expect(page.getByRole('button', { name: '#1' })).not.toBeVisible();
    await expect(page.getByRole('button', { name: '#2' })).toBeVisible();
    await expect(page.getByRole('button', { name: '#3' })).toBeVisible();
  });

  test('it shall filter purchases by supplier search', async function ({ page }) {
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

    await expect(page.getByRole('table', { name: 'Purchases list' })).toBeVisible();
    
    const tableContent = page.getByRole('table', { name: 'Purchases list' });
    await expect(tableContent.getByText('ABC Supplier')).toBeVisible();
    await expect(tableContent.getByText('XYZ Trading')).toBeVisible();

    await page.getByLabel('Search').fill('ABC');

    await expect(tableContent.getByText('ABC Supplier')).toBeVisible();
    await expect(tableContent.getByText('XYZ Trading')).not.toBeVisible();
  });

  test('it shall display pagination controls when purchases exceed page size', async function ({ page }) {
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

    await expect(page.getByRole('table', { name: 'Purchases list' })).toBeVisible();
    await expect(page.getByRole('navigation', { name: 'Pagination' })).toBeVisible();
    await expect(page.getByText('Showing 1–20 of 25')).toBeVisible();
    await expect(page.getByRole('button', { name: '#25' })).toBeVisible();
    await expect(page.getByRole('button', { name: '#6' })).toBeVisible();
    await expect(page.getByRole('button', { name: '#5' })).not.toBeVisible();

    await page.getByRole('button', { name: 'Next page' }).click();

    await expect(page.getByText('Showing 21–25 of 25')).toBeVisible();
    await expect(page.getByRole('button', { name: '#5' })).toBeVisible();
    await expect(page.getByRole('button', { name: '#1' })).toBeVisible();
    await expect(page.getByRole('button', { name: '#25' })).not.toBeVisible();
  });

  test('it shall display item count and total amount for each purchase', async function ({ page }) {
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

    await expect(page.getByRole('table', { name: 'Purchases list' })).toBeVisible();
    
    const purchaseRow = page.getByRole('row').filter({ has: page.getByRole('button', { name: '#1' }) });
    await expect(purchaseRow.locator('span').filter({ hasText: /^2$/ })).toBeVisible();
    await expect(purchaseRow.getByText(/150/)).toBeVisible();
  });

  test('it shall open purchase details dialog when purchase ID is clicked', async function ({ page }) {
    await Promise.all([
      loadEmptyFixture(page),
      setupDatabase(tursoLibSQLiteServer(), async function setupData(sql) {
        await sql`INSERT INTO suppliers (id, name, phone_number) VALUES (1, 'Test Supplier', NULL)`;
        await sql`INSERT INTO purchases (id, supplier_id, purchase_time, post_time) VALUES (1, 1, 1000000, 1000000)`;
      }),
    ]);

    await page.evaluate(setupView, tursoLibSQLiteServer().url);

    await expect(page.getByRole('table', { name: 'Purchases list' })).toBeVisible();

    await page.getByRole('button', { name: '#1' }).click();

    await expect(page.getByRole('dialog', { name: 'Purchase Details' })).toBeVisible();
  });



  test('it shall refresh purchases list when refresh button is clicked', async function ({ page }) {
    await Promise.all([
      loadEmptyFixture(page),
      setupDatabase(tursoLibSQLiteServer(), async function setupData(sql) {
        await sql`INSERT INTO suppliers (id, name, phone_number) VALUES (1, 'Test Supplier', NULL)`;
        await sql`INSERT INTO purchases (id, supplier_id, purchase_time, post_time) VALUES (1, 1, 1000000, 1000000)`;
      }),
    ]);

    await page.evaluate(setupView, tursoLibSQLiteServer().url);

    await expect(page.getByRole('table', { name: 'Purchases list' })).toBeVisible();
    await expect(page.getByRole('button', { name: '#1' })).toBeVisible();

    await page.evaluate(async function () {
      /** @type {DatabaseContextElement} */
      const database = document.querySelector('database-context');
      await database.sql`INSERT INTO purchases (id, supplier_id, purchase_time, post_time) VALUES (2, 1, 2000000, 2000000)`;
    });

    await page.getByRole('button', { name: 'Refresh' }).click();

    await expect(page.getByRole('button', { name: '#2' })).toBeVisible();
  });
});
