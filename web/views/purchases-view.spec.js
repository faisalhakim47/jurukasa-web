import { test, expect } from '@playwright/test';
import { useTursoLibSQLiteServer } from '#test/hooks/use-turso-libsqlite-server.js';
import { loadEmptyFixture } from '#test/tools/fixture.js';

/** @import { DatabaseContextElement } from '#web/contexts/database-context.js' */

const { describe } = test;

describe('Purchases View', function () {
  const tursoLibSQLiteServer = useTursoLibSQLiteServer(test);

  test('it shall display empty state when no purchases exist', async function ({ page }) {
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
                  <purchases-view></purchases-view>
                </i18n-context>
              </device-context>
            </database-context>
          </router-context>
        </ready-context>
      `;
    }, tursoLibSQLiteServer().url);

    // Wait for loading to complete
    await expect(page.getByRole('table', { name: 'Purchases list' })).not.toBeVisible();
    await expect(page.getByText('No Purchases Found')).toBeVisible();
    await expect(page.getByText('Start by recording your first purchase to track inventory costs')).toBeVisible();
    await expect(page.getByRole('button', { name: 'New Purchase' }).first()).toBeVisible();
  });

  test('it shall display purchases list when purchases exist', async function ({ page }) {
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
      
      // Create test suppliers
      await database.sql`
        INSERT INTO suppliers (id, name, phone_number)
        VALUES
          (1, 'Supplier A', '081234567890'),
          (2, 'Supplier B', '082345678901')
      `;

      // Create test accounts
      await database.sql`
        INSERT INTO accounts (account_code, name, normal_balance, create_time, update_time)
        VALUES (11110, 'Inventory Account', 0, 0, 0)
      `;
      await database.sql`
        INSERT INTO account_tags (account_code, tag)
        VALUES (11110, 'POS - Inventory')
      `;

      // Create test inventories
      await database.sql`
        INSERT INTO inventories (id, name, unit_price, unit_of_measurement, account_code)
        VALUES
          (1, 'Product A', 10000, 'piece', 11110),
          (2, 'Product B', 20000, 'piece', 11110)
      `;

      // Create test purchases
      await database.sql`
        INSERT INTO purchases (id, supplier_id, purchase_time, post_time)
        VALUES
          (1, 1, 1000000, 1000000),
          (2, 2, 2000000, NULL)
      `;

      // Add purchase lines
      await database.sql`
        INSERT INTO purchase_lines (purchase_id, line_number, inventory_id, supplier_quantity, quantity, price)
        VALUES
          (1, 1, 1, 10, 10, 100000),
          (1, 2, 2, 5, 5, 100000),
          (2, 1, 1, 3, 3, 30000)
      `;

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
    }, tursoLibSQLiteServer().url);

    // Wait for purchases table to load
    await expect(page.getByRole('table', { name: 'Purchases list' })).toBeVisible();
    
    // Verify purchase IDs are displayed
    await expect(page.getByRole('button', { name: '#1' })).toBeVisible();
    await expect(page.getByRole('button', { name: '#2' })).toBeVisible();
    
    // Verify suppliers are displayed
    const tableContent = page.getByRole('table', { name: 'Purchases list' });
    await expect(tableContent.getByText('Supplier A')).toBeVisible();
    await expect(tableContent.getByText('Supplier B')).toBeVisible();
    
    // Verify status badges
    await expect(tableContent.getByText('Posted')).toBeVisible();
    await expect(tableContent.getByText('Draft')).toBeVisible();
  });

  test('it shall filter purchases by status', async function ({ page }) {
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
      
      // Create test supplier
      await database.sql`
        INSERT INTO suppliers (id, name, phone_number)
        VALUES (1, 'Test Supplier', NULL)
      `;

      // Create test purchases (1 posted, 2 drafts)
      await database.sql`
        INSERT INTO purchases (id, supplier_id, purchase_time, post_time)
        VALUES
          (1, 1, 1000000, 1000000),
          (2, 1, 2000000, NULL),
          (3, 1, 3000000, NULL)
      `;

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
    }, tursoLibSQLiteServer().url);

    // Wait for initial load
    await expect(page.getByRole('table', { name: 'Purchases list' })).toBeVisible();
    await expect(page.getByRole('button', { name: '#1' })).toBeVisible();
    await expect(page.getByRole('button', { name: '#2' })).toBeVisible();
    await expect(page.getByRole('button', { name: '#3' })).toBeVisible();

    // Open status filter dropdown
    await page.getByLabel('Status').click();

    // Select "Posted" filter
    await page.getByRole('menuitem', { name: 'Posted' }).click();

    // Verify only posted purchase is visible
    await expect(page.getByRole('button', { name: '#1' })).toBeVisible();
    await expect(page.getByRole('button', { name: '#2' })).not.toBeVisible();
    await expect(page.getByRole('button', { name: '#3' })).not.toBeVisible();

    // Open status filter dropdown again
    await page.getByLabel('Status').click();

    // Select "Draft" filter
    await page.getByRole('menuitem', { name: 'Draft' }).click();

    // Verify only draft purchases are visible
    await expect(page.getByRole('button', { name: '#1' })).not.toBeVisible();
    await expect(page.getByRole('button', { name: '#2' })).toBeVisible();
    await expect(page.getByRole('button', { name: '#3' })).toBeVisible();
  });

  test('it shall filter purchases by supplier search', async function ({ page }) {
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
      
      // Create test suppliers
      await database.sql`
        INSERT INTO suppliers (id, name, phone_number)
        VALUES
          (1, 'ABC Supplier', NULL),
          (2, 'XYZ Trading', NULL)
      `;

      // Create test purchases
      await database.sql`
        INSERT INTO purchases (id, supplier_id, purchase_time, post_time)
        VALUES
          (1, 1, 1000000, 1000000),
          (2, 2, 2000000, 2000000)
      `;

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
    }, tursoLibSQLiteServer().url);

    // Wait for initial load
    await expect(page.getByRole('table', { name: 'Purchases list' })).toBeVisible();
    
    const tableContent = page.getByRole('table', { name: 'Purchases list' });
    await expect(tableContent.getByText('ABC Supplier')).toBeVisible();
    await expect(tableContent.getByText('XYZ Trading')).toBeVisible();

    // Search for "ABC"
    await page.getByLabel('Search').fill('ABC');

    // Verify only ABC supplier purchase is visible
    await expect(tableContent.getByText('ABC Supplier')).toBeVisible();
    await expect(tableContent.getByText('XYZ Trading')).not.toBeVisible();
  });

  test('it shall display pagination controls when purchases exceed page size', async function ({ page }) {
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
      
      // Create test supplier
      await database.sql`
        INSERT INTO suppliers (id, name, phone_number)
        VALUES (1, 'Test Supplier', NULL)
      `;

      // Create 25 test purchases (page size is 20)
      const values = Array.from({ length: 25 }, function (_, i) {
        return `(${i + 1}, 1, ${(i + 1) * 1000}, ${(i + 1) * 1000})`;
      }).join(',');
      
      await database.sql([`
        INSERT INTO purchases (id, supplier_id, purchase_time, post_time)
        VALUES ${values}
      `]);

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
    }, tursoLibSQLiteServer().url);

    // Wait for table to load
    await expect(page.getByRole('table', { name: 'Purchases list' })).toBeVisible();

    // Verify pagination controls are visible
    await expect(page.getByRole('navigation', { name: 'Pagination' })).toBeVisible();
    await expect(page.getByText('Showing 1–20 of 25')).toBeVisible();
    
    // Verify first page purchases are visible (descending order, newest first)
    await expect(page.getByRole('button', { name: '#25' })).toBeVisible();
    await expect(page.getByRole('button', { name: '#6' })).toBeVisible();
    
    // Purchase #5 should not be visible on first page
    await expect(page.getByRole('button', { name: '#5' })).not.toBeVisible();

    // Navigate to next page
    await page.getByRole('button', { name: 'Next page' }).click();

    // Verify second page content
    await expect(page.getByText('Showing 21–25 of 25')).toBeVisible();
    await expect(page.getByRole('button', { name: '#5' })).toBeVisible();
    await expect(page.getByRole('button', { name: '#1' })).toBeVisible();
    
    // Purchase #25 should not be visible on second page
    await expect(page.getByRole('button', { name: '#25' })).not.toBeVisible();
  });

  test('it shall display item count and total amount for each purchase', async function ({ page }) {
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
      
      // Create test supplier
      await database.sql`
        INSERT INTO suppliers (id, name, phone_number)
        VALUES (1, 'Test Supplier', NULL)
      `;

      // Create test account
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
        VALUES (1, 'Product A', 10000, 'piece', 11110)
      `;

      // Create test purchase
      await database.sql`
        INSERT INTO purchases (id, supplier_id, purchase_time, post_time)
        VALUES (1, 1, 1000000, 1000000)
      `;

      // Add purchase lines
      await database.sql`
        INSERT INTO purchase_lines (purchase_id, line_number, inventory_id, supplier_quantity, quantity, price)
        VALUES
          (1, 1, 1, 10, 10, 100000),
          (1, 2, 1, 5, 5, 50000)
      `;

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
    }, tursoLibSQLiteServer().url);

    // Wait for table to load
    await expect(page.getByRole('table', { name: 'Purchases list' })).toBeVisible();
    
    // Find the purchase row
    const purchaseRow = page.getByRole('row').filter({ has: page.getByRole('button', { name: '#1' }) });
    
    // Verify item count badge shows 2
    await expect(purchaseRow.locator('span').filter({ hasText: /^2$/ })).toBeVisible();
    
    // Verify total amount (100000 + 50000 = 150000) - just check 150 appears
    await expect(purchaseRow.getByText(/150/)).toBeVisible();
  });

  test('it shall open purchase details dialog when purchase ID is clicked', async function ({ page }) {
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
      
      // Create test supplier
      await database.sql`
        INSERT INTO suppliers (id, name, phone_number)
        VALUES (1, 'Test Supplier', NULL)
      `;

      // Create test purchase
      await database.sql`
        INSERT INTO purchases (id, supplier_id, purchase_time, post_time)
        VALUES (1, 1, 1000000, 1000000)
      `;

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
    }, tursoLibSQLiteServer().url);

    // Wait for table to load
    await expect(page.getByRole('table', { name: 'Purchases list' })).toBeVisible();

    // Click purchase ID
    await page.getByRole('button', { name: '#1' }).click();

    // Verify details dialog opened
    await expect(page.getByRole('dialog', { name: 'Purchase Details' })).toBeVisible();
  });



  test('it shall refresh purchases list when refresh button is clicked', async function ({ page }) {
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
      
      // Create test supplier
      await database.sql`
        INSERT INTO suppliers (id, name, phone_number)
        VALUES (1, 'Test Supplier', NULL)
      `;

      // Create test purchase
      await database.sql`
        INSERT INTO purchases (id, supplier_id, purchase_time, post_time)
        VALUES (1, 1, 1000000, 1000000)
      `;

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
    }, tursoLibSQLiteServer().url);

    // Wait for initial load
    await expect(page.getByRole('table', { name: 'Purchases list' })).toBeVisible();
    await expect(page.getByRole('button', { name: '#1' })).toBeVisible();

    // Add a new purchase via database
    await page.evaluate(async function () {
      /** @type {DatabaseContextElement} */
      const database = document.querySelector('database-context');
      
      await database.sql`
        INSERT INTO purchases (id, supplier_id, purchase_time, post_time)
        VALUES (2, 1, 2000000, 2000000)
      `;
    });

    // Click refresh button
    await page.getByRole('button', { name: 'Refresh' }).click();

    // Verify new purchase appears
    await expect(page.getByRole('button', { name: '#2' })).toBeVisible();
  });
});
