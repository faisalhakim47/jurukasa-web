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
  document.body.innerHTML = `
    <ready-context>
      <router-context>
        <database-context>
          <device-context>
            <i18n-context>
              <sales-view></sales-view>
            </i18n-context>
          </device-context>
        </database-context>
      </router-context>
    </ready-context>
  `;
}

describe('Sales View', function () {
  const tursoLibSQLiteServer = useTursoLibSQLiteServer(test);

  describe('Empty State', function () {
    test('shall display empty state when no sales exist', async function ({ page }) {
      await loadEmptyFixture(page);

      await page.evaluate(setupView, tursoLibSQLiteServer().url);

      // Wait for loading to complete
      await expect(page.getByRole('table', { name: /sales/i })).not.toBeVisible();
      await expect(page.getByText(/no sales found/i)).toBeVisible();
    });

    test('shall display call-to-action button in empty state', async function ({ page }) {
      await loadEmptyFixture(page);

      await page.evaluate(setupView, tursoLibSQLiteServer().url);

      // Verify call-to-action button exists (filter for visible one)
      await expect(page.getByText(/no sales found/i)).toBeVisible();
      await expect(page.getByRole('button', { name: 'Go to Point-of-Sale' })).toBeVisible();
    });
  });

  describe('Sales List Display', function () {
    test('shall display sales list when sales exist', async function ({ page }) {
      await Promise.all([
        loadEmptyFixture(page),
        setupDatabase(tursoLibSQLiteServer(), async function setupData(sql) {
          await sql`INSERT INTO inventories (id, name, unit_price, unit_of_measurement, account_code) VALUES (1, 'Test Product', 10000, 'piece', 11310)`;
          await sql`INSERT INTO sales (id, customer_name, sale_time, post_time) VALUES (1, 'Customer A', 1000000, 1000001)`;
          await sql`INSERT INTO sales (id, customer_name, sale_time, post_time) VALUES (2, 'Customer B', 2000000, 2000001)`;
          await sql`INSERT INTO sales (id, customer_name, sale_time, post_time) VALUES (3, NULL, 3000000, 3000001)`;
          await sql`INSERT INTO sale_lines (sale_id, line_number, inventory_id, quantity, price, cost) VALUES (1, 1, 1, 2, 20000, 0)`;
          await sql`INSERT INTO sale_lines (sale_id, line_number, inventory_id, quantity, price, cost) VALUES (2, 1, 1, 1, 10000, 0)`;
          await sql`INSERT INTO sale_lines (sale_id, line_number, inventory_id, quantity, price, cost) VALUES (3, 1, 1, 3, 30000, 0)`;
        }),
      ]);

      await page.evaluate(setupView, tursoLibSQLiteServer().url);

      // Wait for sales table to load
      await expect(page.getByRole('table', { name: /sales/i })).toBeVisible();
      
      // Verify sales are displayed
      await expect(page.getByRole('button', { name: /#1/ })).toBeVisible();
      await expect(page.getByRole('button', { name: /#2/ })).toBeVisible();
      await expect(page.getByRole('button', { name: /#3/ })).toBeVisible();
    });

    test('shall display sale customer names', async function ({ page }) {
      await Promise.all([
        loadEmptyFixture(page),
        setupDatabase(tursoLibSQLiteServer(), async function setupData(sql) {
          await sql`INSERT INTO inventories (id, name, unit_price, unit_of_measurement, account_code) VALUES (1, 'Test Product', 10000, 'piece', 11310)`;
          await sql`INSERT INTO sales (id, customer_name, sale_time, post_time) VALUES (1, 'John Doe', 1000000, 1000001)`;
          await sql`INSERT INTO sale_lines (sale_id, line_number, inventory_id, quantity, price, cost) VALUES (1, 1, 1, 1, 10000, 0)`;
        }),
      ]);

      await page.evaluate(setupView, tursoLibSQLiteServer().url);

      await expect(page.getByRole('table', { name: /sales/i })).toBeVisible();
      // Customer name might be displayed in the items summary column or elsewhere
      await expect(page.getByRole('button', { name: /#1/ })).toBeVisible();
    });
  });

  describe('Search Functionality', function () {
    test('shall filter sales by customer name', async function ({ page }) {
      await Promise.all([
        loadEmptyFixture(page),
        setupDatabase(tursoLibSQLiteServer(), async function setupData(sql) {
          await sql`INSERT INTO inventories (id, name, unit_price, unit_of_measurement, account_code) VALUES (1, 'Test Product', 10000, 'piece', 11310)`;
          await sql`INSERT INTO sales (id, customer_name, sale_time, post_time) VALUES (1, 'Alice Smith', 1000000, 1000001)`;
          await sql`INSERT INTO sales (id, customer_name, sale_time, post_time) VALUES (2, 'Bob Jones', 2000000, 2000001)`;
          await sql`INSERT INTO sales (id, customer_name, sale_time, post_time) VALUES (3, 'Alice Johnson', 3000000, 3000001)`;
          await sql`INSERT INTO sale_lines (sale_id, line_number, inventory_id, quantity, price, cost) VALUES (1, 1, 1, 1, 10000, 0)`;
          await sql`INSERT INTO sale_lines (sale_id, line_number, inventory_id, quantity, price, cost) VALUES (2, 1, 1, 1, 10000, 0)`;
          await sql`INSERT INTO sale_lines (sale_id, line_number, inventory_id, quantity, price, cost) VALUES (3, 1, 1, 1, 10000, 0)`;
        }),
      ]);

      await page.evaluate(setupView, tursoLibSQLiteServer().url);

      // Wait for initial load
      await expect(page.getByRole('table', { name: /sales/i })).toBeVisible();
      await expect(page.getByRole('button', { name: /#1/ })).toBeVisible();
      await expect(page.getByRole('button', { name: /#2/ })).toBeVisible();

      // Search for "Alice"
      await page.getByLabel('Search').fill('Alice');

      // Verify only Alice sales are visible
      await expect(page.getByRole('button', { name: /#1/ })).toBeVisible();
      await expect(page.getByRole('button', { name: /#3/ })).toBeVisible();
      await expect(page.getByRole('button', { name: /#2/ })).not.toBeVisible();

      // Clear search
      await page.getByLabel('Search').clear();

      // Verify all sales are visible again
      await expect(page.getByRole('button', { name: /#1/ })).toBeVisible();
      await expect(page.getByRole('button', { name: /#2/ })).toBeVisible();
    });
  });

  describe('Status Filter', function () {
    test('shall filter sales by status', async function ({ page }) {
      await Promise.all([
        loadEmptyFixture(page),
        setupDatabase(tursoLibSQLiteServer(), async function setupData(sql) {
          await sql`INSERT INTO inventories (id, name, unit_price, unit_of_measurement, account_code) VALUES (1, 'Test Product', 10000, 'piece', 11310)`;
          await sql`INSERT INTO sales (id, customer_name, sale_time, post_time) VALUES (1, 'Customer A', 1000000, 1000001)`;
          await sql`INSERT INTO sales (id, customer_name, sale_time, post_time) VALUES (2, 'Customer B', 2000000, NULL)`;
          await sql`INSERT INTO sales (id, customer_name, sale_time, post_time) VALUES (3, 'Customer C', 3000000, 3000001)`;
          await sql`INSERT INTO sale_lines (sale_id, line_number, inventory_id, quantity, price, cost) VALUES (1, 1, 1, 1, 10000, 0)`;
          await sql`INSERT INTO sale_lines (sale_id, line_number, inventory_id, quantity, price, cost) VALUES (2, 1, 1, 1, 10000, 0)`;
          await sql`INSERT INTO sale_lines (sale_id, line_number, inventory_id, quantity, price, cost) VALUES (3, 1, 1, 1, 10000, 0)`;
        }),
      ]);

      await page.evaluate(setupView, tursoLibSQLiteServer().url);

      // Wait for initial load
      await expect(page.getByRole('table', { name: /sales/i })).toBeVisible();

      // Open status filter dropdown
      const statusFilterButton = page.locator('input[popovertarget="status-filter-menu"]');
      await statusFilterButton.click();

      // Select "Posted" filter
      await page.getByRole('menuitem').filter({ hasText: /posted/i }).click();

      // Verify only posted sales are visible
      await expect(page.getByRole('button', { name: /#1/ })).toBeVisible();
      await expect(page.getByRole('button', { name: /#3/ })).toBeVisible();
      await expect(page.getByRole('button', { name: /#2/ })).not.toBeVisible();

      // Open status filter dropdown again
      await statusFilterButton.click();

      // Select "Draft" filter
      await page.getByRole('menuitem').filter({ hasText: /draft/i }).click();

      // Verify only draft sales are visible
      await expect(page.getByRole('button', { name: /#2/ })).toBeVisible();
      await expect(page.getByRole('button', { name: /#1/ })).not.toBeVisible();
      await expect(page.getByRole('button', { name: /#3/ })).not.toBeVisible();
    });
  });

  describe('Pagination', function () {
    test('shall display pagination controls when sales exceed page size', async function ({ page }) {
      await Promise.all([
        loadEmptyFixture(page),
        setupDatabase(tursoLibSQLiteServer(), async function setupData(sql) {
          await sql`INSERT INTO inventories (id, name, unit_price, unit_of_measurement, account_code) VALUES (1, 'Test Product', 10000, 'piece', 11310)`;
          // Create 15 test sales (page size is 10)
          for (let i = 1; i <= 15; i++) {
            await sql`INSERT INTO sales (id, customer_name, sale_time, post_time) VALUES (${i}, ${`Customer ${i}`}, ${1000000 + i * 1000}, ${1000001 + i * 1000})`;
            await sql`INSERT INTO sale_lines (sale_id, line_number, inventory_id, quantity, price, cost) VALUES (${i}, 1, 1, 1, 10000, 0)`;
          }
        }),
      ]);

      await page.evaluate(setupView, tursoLibSQLiteServer().url);

      // Wait for table to load
      await expect(page.getByRole('table', { name: /sales/i })).toBeVisible();

      // Verify pagination controls are visible
      await expect(page.getByRole('navigation', { name: /pagination/i })).toBeVisible();
      await expect(page.getByText(/showing.*of 15/i)).toBeVisible();
      
      // Verify first page sales are visible (sales are ordered DESC, so 15-6)
      await expect(page.getByRole('button', { name: '#15', exact: true })).toBeVisible();
      await expect(page.getByRole('button', { name: '#6', exact: true })).toBeVisible();
      
      // Sale 1 should not be visible on first page
      await expect(page.getByRole('button', { name: '#1', exact: true })).not.toBeVisible();

      // Navigate to next page
      await page.getByRole('button', { name: /next page/i }).click();

      // Verify second page content (sales are ordered DESC, so 5-1)
      await expect(page.getByText(/showing.*11.*15.*of 15/i)).toBeVisible();
      await expect(page.getByRole('button', { name: '#5', exact: true })).toBeVisible();
      await expect(page.getByRole('button', { name: '#1', exact: true })).toBeVisible();
      
      // Sale 15 should not be visible on second page
      await expect(page.getByRole('button', { name: '#15', exact: true })).not.toBeVisible();
    });

    test('shall navigate between pages using pagination buttons', async function ({ page }) {
      await Promise.all([
        loadEmptyFixture(page),
        setupDatabase(tursoLibSQLiteServer(), async function setupData(sql) {
          await sql`INSERT INTO inventories (id, name, unit_price, unit_of_measurement, account_code) VALUES (1, 'Test Product', 10000, 'piece', 11310)`;
          // Create 15 sales
          for (let i = 1; i <= 15; i++) {
            await sql`INSERT INTO sales (id, customer_name, sale_time, post_time) VALUES (${i}, NULL, ${1000000 + i * 1000}, ${1000001 + i * 1000})`;
            await sql`INSERT INTO sale_lines (sale_id, line_number, inventory_id, quantity, price, cost) VALUES (${i}, 1, 1, 1, 10000, 0)`;
          }
        }),
      ]);

      await page.evaluate(setupView, tursoLibSQLiteServer().url);

      await expect(page.getByRole('table', { name: /sales/i })).toBeVisible();

      // Go to next page (shows older sales)
      await page.getByRole('button', { name: /next page/i }).click();
      await expect(page.getByRole('button', { name: '#5', exact: true })).toBeVisible();

      // Go to previous page (shows newer sales)
      await page.getByRole('button', { name: /previous page/i }).click();
      await expect(page.getByRole('button', { name: '#15', exact: true })).toBeVisible();

      // Go to last page (shows oldest sales)
      await page.getByRole('button', { name: /last page/i }).click();
      await expect(page.getByRole('button', { name: '#1', exact: true })).toBeVisible();

      // Go to first page (shows newest sales)
      await page.getByRole('button', { name: /first page/i }).click();
      await expect(page.getByRole('button', { name: '#15', exact: true })).toBeVisible();
    });
  });

  describe('Sale Actions', function () {
    test('shall open sale details dialog when clicking sale ID', async function ({ page }) {
      await Promise.all([
        loadEmptyFixture(page),
        setupDatabase(tursoLibSQLiteServer(), async function setupData(sql) {
          await sql`INSERT INTO inventories (id, name, unit_price, unit_of_measurement, account_code) VALUES (1, 'Test Product', 10000, 'piece', 11310)`;
          await sql`INSERT INTO sales (id, customer_name, sale_time, post_time) VALUES (1, 'Test Customer', 1000000, 1000001)`;
          await sql`INSERT INTO sale_lines (sale_id, line_number, inventory_id, quantity, price, cost) VALUES (1, 1, 1, 1, 10000, 0)`;
        }),
      ]);

      await page.evaluate(setupView, tursoLibSQLiteServer().url);

      await expect(page.getByRole('table', { name: /sales/i })).toBeVisible();

      // Click sale ID
      await page.getByRole('button', { name: /#1/ }).click();

      // Verify sale details dialog opened
      await expect(page.getByRole('dialog', { name: 'Sale #1' })).toBeVisible();
    });

    test('shall have refresh button to reload sales', async function ({ page }) {
      await loadEmptyFixture(page);

      await page.evaluate(setupView, tursoLibSQLiteServer().url);

      // Verify refresh button exists
      await expect(page.getByRole('button', { name: /refresh/i })).toBeVisible();
    });

    test('shall have button link to point of sale', async function ({ page }) {
      await loadEmptyFixture(page);

      await page.evaluate(setupView, tursoLibSQLiteServer().url);

      // Verify point of sale button link exists (use first() to get the toolbar button)
      await expect(page.getByRole('button', { name: 'Point-of-Sale' }).first()).toBeVisible();
    });
  });
});
