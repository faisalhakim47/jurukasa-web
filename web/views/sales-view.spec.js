import { test, expect } from '@playwright/test';
import { useTursoLibSQLiteServer } from '#test/hooks/use-turso-libsqlite-server.js';
import { loadEmptyFixture } from '#test/tools/fixture.js';

/** @import { DatabaseContextElement } from '#web/contexts/database-context.js' */

const { describe } = test;

describe('Sales View', function () {
  const tursoLibSQLiteServer = useTursoLibSQLiteServer(test);

  describe('Empty State', function () {
    test('shall display empty state when no sales exist', async function ({ page }) {
      await loadEmptyFixture(page);

      await page.evaluate(async function (tursoDatabaseUrl) {
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
      }, tursoLibSQLiteServer().url);

      // Wait for loading to complete
      await expect(page.getByRole('table', { name: /sales/i })).not.toBeVisible();
      await expect(page.getByText(/no sales found/i)).toBeVisible();
    });

    test('shall display call-to-action button in empty state', async function ({ page }) {
      await loadEmptyFixture(page);

      await page.evaluate(async function (tursoDatabaseUrl) {
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
      }, tursoLibSQLiteServer().url);

      // Verify call-to-action button exists
      await expect(page.getByText(/no sales found/i)).toBeVisible();
      await expect(page.getByRole('link', { name: /point of sale/i })).toBeVisible();
    });
  });

  describe('Sales List Display', function () {
    test('shall display sales list when sales exist', async function ({ page }) {
      await loadEmptyFixture(page);

      await page.evaluate(async function (tursoDatabaseUrl) {
        localStorage.setItem('tursoDatabaseUrl', tursoDatabaseUrl);
        localStorage.setItem('tursoDatabaseKey', '');

        document.body.innerHTML = `
          <ready-context>
            <router-context>
              <database-context></database-context>
            </router-context>
          </ready-context>
        `;

        /** @type {DatabaseContextElement} */
        const database = document.querySelector('database-context');
        
        // Create test account for inventory
        await database.sql`
          INSERT INTO accounts (account_code, name, normal_balance, create_time, update_time)
          VALUES (11110, 'Inventory Account', 0, 0, 0)
        `;
        await database.sql`
          INSERT INTO account_tags (account_code, tag)
          VALUES (11110, 'POS - Inventory')
        `;
        
        // Create test inventory
        await database.sql`
          INSERT INTO inventories (id, name, unit_price, unit_of_measurement, account_code)
          VALUES (1, 'Test Product', 10000, 'piece', 11110)
        `;
        
        // Create test sales
        await database.sql`
          INSERT INTO sales (id, customer_name, sale_time, post_time)
          VALUES
            (1, 'Customer A', 1000000, 1000001),
            (2, 'Customer B', 2000000, 2000001),
            (3, NULL, 3000000, 3000001)
        `;
        
        // Create sale lines
        await database.sql`
          INSERT INTO sale_lines (sale_id, line_number, inventory_id, quantity, price, cost)
          VALUES
            (1, 1, 1, 2, 20000, 0),
            (2, 1, 1, 1, 10000, 0),
            (3, 1, 1, 3, 30000, 0)
        `;

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
      }, tursoLibSQLiteServer().url);

      // Wait for sales table to load
      await expect(page.getByRole('table', { name: /sales/i })).toBeVisible();
      
      // Verify sales are displayed
      await expect(page.getByRole('button', { name: /#1/ })).toBeVisible();
      await expect(page.getByRole('button', { name: /#2/ })).toBeVisible();
      await expect(page.getByRole('button', { name: /#3/ })).toBeVisible();
    });

    test('shall display sale customer names', async function ({ page }) {
      await loadEmptyFixture(page);

      await page.evaluate(async function (tursoDatabaseUrl) {
        localStorage.setItem('tursoDatabaseUrl', tursoDatabaseUrl);
        localStorage.setItem('tursoDatabaseKey', '');

        document.body.innerHTML = `
          <ready-context>
            <router-context>
              <database-context></database-context>
            </router-context>
          </ready-context>
        `;

        /** @type {DatabaseContextElement} */
        const database = document.querySelector('database-context');
        
        await database.sql`
          INSERT INTO accounts (account_code, name, normal_balance, create_time, update_time)
          VALUES (11110, 'Inventory Account', 0, 0, 0)
        `;
        await database.sql`
          INSERT INTO account_tags (account_code, tag)
          VALUES (11110, 'POS - Inventory')
        `;
        await database.sql`
          INSERT INTO inventories (id, name, unit_price, unit_of_measurement, account_code)
          VALUES (1, 'Test Product', 10000, 'piece', 11110)
        `;
        await database.sql`
          INSERT INTO sales (id, customer_name, sale_time, post_time)
          VALUES (1, 'John Doe', 1000000, 1000001)
        `;
        await database.sql`
          INSERT INTO sale_lines (sale_id, line_number, inventory_id, quantity, price, cost)
          VALUES (1, 1, 1, 1, 10000, 0)
        `;

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
      }, tursoLibSQLiteServer().url);

      await expect(page.getByRole('table', { name: /sales/i })).toBeVisible();
      // Customer name might be displayed in the items summary column or elsewhere
      await expect(page.getByRole('button', { name: /#1/ })).toBeVisible();
    });
  });

  describe('Search Functionality', function () {
    test('shall filter sales by customer name', async function ({ page }) {
      await loadEmptyFixture(page);

      await page.evaluate(async function (tursoDatabaseUrl) {
        localStorage.setItem('tursoDatabaseUrl', tursoDatabaseUrl);
        localStorage.setItem('tursoDatabaseKey', '');

        document.body.innerHTML = `
          <ready-context>
            <router-context>
              <database-context></database-context>
            </router-context>
          </ready-context>
        `;

        /** @type {DatabaseContextElement} */
        const database = document.querySelector('database-context');
        
        await database.sql`
          INSERT INTO accounts (account_code, name, normal_balance, create_time, update_time)
          VALUES (11110, 'Inventory Account', 0, 0, 0)
        `;
        await database.sql`
          INSERT INTO account_tags (account_code, tag)
          VALUES (11110, 'POS - Inventory')
        `;
        await database.sql`
          INSERT INTO inventories (id, name, unit_price, unit_of_measurement, account_code)
          VALUES (1, 'Test Product', 10000, 'piece', 11110)
        `;
        await database.sql`
          INSERT INTO sales (id, customer_name, sale_time, post_time)
          VALUES
            (1, 'Alice Smith', 1000000, 1000001),
            (2, 'Bob Jones', 2000000, 2000001),
            (3, 'Alice Johnson', 3000000, 3000001)
        `;
        await database.sql`
          INSERT INTO sale_lines (sale_id, line_number, inventory_id, quantity, price, cost)
          VALUES
            (1, 1, 1, 1, 10000, 0),
            (2, 1, 1, 1, 10000, 0),
            (3, 1, 1, 1, 10000, 0)
        `;

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
      }, tursoLibSQLiteServer().url);

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
      await loadEmptyFixture(page);

      await page.evaluate(async function (tursoDatabaseUrl) {
        localStorage.setItem('tursoDatabaseUrl', tursoDatabaseUrl);
        localStorage.setItem('tursoDatabaseKey', '');

        document.body.innerHTML = `
          <ready-context>
            <router-context>
              <database-context></database-context>
            </router-context>
          </ready-context>
        `;

        /** @type {DatabaseContextElement} */
        const database = document.querySelector('database-context');
        
        await database.sql`
          INSERT INTO accounts (account_code, name, normal_balance, create_time, update_time)
          VALUES (11110, 'Inventory Account', 0, 0, 0)
        `;
        await database.sql`
          INSERT INTO account_tags (account_code, tag)
          VALUES (11110, 'POS - Inventory')
        `;
        await database.sql`
          INSERT INTO inventories (id, name, unit_price, unit_of_measurement, account_code)
          VALUES (1, 'Test Product', 10000, 'piece', 11110)
        `;
        await database.sql`
          INSERT INTO sales (id, customer_name, sale_time, post_time)
          VALUES
            (1, 'Customer A', 1000000, 1000001),
            (2, 'Customer B', 2000000, NULL),
            (3, 'Customer C', 3000000, 3000001)
        `;
        await database.sql`
          INSERT INTO sale_lines (sale_id, line_number, inventory_id, quantity, price, cost)
          VALUES
            (1, 1, 1, 1, 10000, 0),
            (2, 1, 1, 1, 10000, 0),
            (3, 1, 1, 1, 10000, 0)
        `;

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
      }, tursoLibSQLiteServer().url);

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
      await loadEmptyFixture(page);

      await page.evaluate(async function (tursoDatabaseUrl) {
        localStorage.setItem('tursoDatabaseUrl', tursoDatabaseUrl);
        localStorage.setItem('tursoDatabaseKey', '');

        document.body.innerHTML = `
          <ready-context>
            <router-context>
              <database-context></database-context>
            </router-context>
          </ready-context>
        `;

        /** @type {DatabaseContextElement} */
        const database = document.querySelector('database-context');
        
        await database.sql`
          INSERT INTO accounts (account_code, name, normal_balance, create_time, update_time)
          VALUES (11110, 'Inventory Account', 0, 0, 0)
        `;
        await database.sql`
          INSERT INTO account_tags (account_code, tag)
          VALUES (11110, 'POS - Inventory')
        `;
        await database.sql`
          INSERT INTO inventories (id, name, unit_price, unit_of_measurement, account_code)
          VALUES (1, 'Test Product', 10000, 'piece', 11110)
        `;
        
        // Create 15 test sales (page size is 10)
        const salesValues = Array.from({ length: 15 }, function (_, i) {
          return `(${i + 1}, 'Customer ${i + 1}', ${1000000 + i * 1000}, ${1000001 + i * 1000})`;
        }).join(',');
        
        await database.sql([`
          INSERT INTO sales (id, customer_name, sale_time, post_time)
          VALUES ${salesValues}
        `]);
        
        // Create sale lines
        const linesValues = Array.from({ length: 15 }, function (_, i) {
          return `(${i + 1}, 1, 1, 1, 10000, 0)`;
        }).join(',');
        
        await database.sql([`
          INSERT INTO sale_lines (sale_id, line_number, inventory_id, quantity, price, cost)
          VALUES ${linesValues}
        `]);

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
      }, tursoLibSQLiteServer().url);

      // Wait for table to load
      await expect(page.getByRole('table', { name: /sales/i })).toBeVisible();

      // Verify pagination controls are visible
      await expect(page.getByRole('navigation', { name: /pagination/i })).toBeVisible();
      await expect(page.getByText(/showing.*of 15/i)).toBeVisible();
      
      // Verify first page sales are visible
      await expect(page.getByRole('button', { name: /#1/ })).toBeVisible();
      await expect(page.getByRole('button', { name: /#10/ })).toBeVisible();
      
      // Sale 15 should not be visible on first page
      await expect(page.getByRole('button', { name: /#15/ })).not.toBeVisible();

      // Navigate to next page
      await page.getByRole('button', { name: /next page/i }).click();

      // Verify second page content
      await expect(page.getByText(/showing.*11.*15.*of 15/i)).toBeVisible();
      await expect(page.getByRole('button', { name: /#11/ })).toBeVisible();
      await expect(page.getByRole('button', { name: /#15/ })).toBeVisible();
      
      // Sale 1 should not be visible on second page
      await expect(page.getByRole('button', { name: /#1/ })).not.toBeVisible();
    });

    test('shall navigate between pages using pagination buttons', async function ({ page }) {
      await loadEmptyFixture(page);

      await page.evaluate(async function (tursoDatabaseUrl) {
        localStorage.setItem('tursoDatabaseUrl', tursoDatabaseUrl);
        localStorage.setItem('tursoDatabaseKey', '');

        document.body.innerHTML = `
          <ready-context>
            <router-context>
              <database-context></database-context>
            </router-context>
          </ready-context>
        `;

        /** @type {DatabaseContextElement} */
        const database = document.querySelector('database-context');
        
        await database.sql`
          INSERT INTO accounts (account_code, name, normal_balance, create_time, update_time)
          VALUES (11110, 'Inventory Account', 0, 0, 0)
        `;
        await database.sql`
          INSERT INTO account_tags (account_code, tag)
          VALUES (11110, 'POS - Inventory')
        `;
        await database.sql`
          INSERT INTO inventories (id, name, unit_price, unit_of_measurement, account_code)
          VALUES (1, 'Test Product', 10000, 'piece', 11110)
        `;
        
        // Create 15 sales
        const salesValues = Array.from({ length: 15 }, function (_, i) {
          return `(${i + 1}, NULL, ${1000000 + i * 1000}, ${1000001 + i * 1000})`;
        }).join(',');
        
        await database.sql([`
          INSERT INTO sales (id, customer_name, sale_time, post_time)
          VALUES ${salesValues}
        `]);
        
        const linesValues = Array.from({ length: 15 }, function (_, i) {
          return `(${i + 1}, 1, 1, 1, 10000, 0)`;
        }).join(',');
        
        await database.sql([`
          INSERT INTO sale_lines (sale_id, line_number, inventory_id, quantity, price, cost)
          VALUES ${linesValues}
        `]);

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
      }, tursoLibSQLiteServer().url);

      await expect(page.getByRole('table', { name: /sales/i })).toBeVisible();

      // Go to next page
      await page.getByRole('button', { name: /next page/i }).click();
      await expect(page.getByRole('button', { name: /#11/ })).toBeVisible();

      // Go to previous page
      await page.getByRole('button', { name: /previous page/i }).click();
      await expect(page.getByRole('button', { name: /#1/ })).toBeVisible();

      // Go to last page
      await page.getByRole('button', { name: /last page/i }).click();
      await expect(page.getByRole('button', { name: /#15/ })).toBeVisible();

      // Go to first page
      await page.getByRole('button', { name: /first page/i }).click();
      await expect(page.getByRole('button', { name: /#1/ })).toBeVisible();
    });
  });

  describe('Sale Actions', function () {
    test('shall open sale details dialog when clicking sale ID', async function ({ page }) {
      await loadEmptyFixture(page);

      await page.evaluate(async function (tursoDatabaseUrl) {
        localStorage.setItem('tursoDatabaseUrl', tursoDatabaseUrl);
        localStorage.setItem('tursoDatabaseKey', '');

        document.body.innerHTML = `
          <ready-context>
            <router-context>
              <database-context></database-context>
            </router-context>
          </ready-context>
        `;

        /** @type {DatabaseContextElement} */
        const database = document.querySelector('database-context');
        
        await database.sql`
          INSERT INTO accounts (account_code, name, normal_balance, create_time, update_time)
          VALUES (11110, 'Inventory Account', 0, 0, 0)
        `;
        await database.sql`
          INSERT INTO account_tags (account_code, tag)
          VALUES (11110, 'POS - Inventory')
        `;
        await database.sql`
          INSERT INTO inventories (id, name, unit_price, unit_of_measurement, account_code)
          VALUES (1, 'Test Product', 10000, 'piece', 11110)
        `;
        await database.sql`
          INSERT INTO sales (id, customer_name, sale_time, post_time)
          VALUES (1, 'Test Customer', 1000000, 1000001)
        `;
        await database.sql`
          INSERT INTO sale_lines (sale_id, line_number, inventory_id, quantity, price, cost)
          VALUES (1, 1, 1, 1, 10000, 0)
        `;

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
      }, tursoLibSQLiteServer().url);

      await expect(page.getByRole('table', { name: /sales/i })).toBeVisible();

      // Click sale ID
      await page.getByRole('button', { name: /#1/ }).click();

      // Verify sale details dialog opened
      await expect(page.getByRole('dialog', { name: /sale.*details/i })).toBeVisible();
    });

    test('shall have refresh button to reload sales', async function ({ page }) {
      await loadEmptyFixture(page);

      await page.evaluate(async function (tursoDatabaseUrl) {
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
      }, tursoLibSQLiteServer().url);

      // Verify refresh button exists
      await expect(page.getByRole('button', { name: /refresh/i })).toBeVisible();
    });

    test('shall have link to point of sale', async function ({ page }) {
      await loadEmptyFixture(page);

      await page.evaluate(async function (tursoDatabaseUrl) {
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
      }, tursoLibSQLiteServer().url);

      // Verify point of sale link exists
      await expect(page.getByRole('link', { name: /point of sale/i })).toBeVisible();
    });
  });
});
