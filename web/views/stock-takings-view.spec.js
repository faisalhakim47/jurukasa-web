import { test, expect } from '@playwright/test';
import { useTursoLibSQLiteServer } from '#test/hooks/use-turso-libsqlite-server.js';
import { loadEmptyFixture } from '#test/tools/fixture.js';

/** @import { DatabaseContextElement } from '#web/contexts/database-context.js' */

const { describe } = test;

describe('Stock Takings View', function () {
  const tursoLibSQLiteServer = useTursoLibSQLiteServer(test);

  test('it shall display empty state when no stock takings exist', async function ({ page }) {
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
                  <stock-takings-view></stock-takings-view>
                </i18n-context>
              </device-context>
            </database-context>
          </router-context>
        </ready-context>
      `;
    }, tursoLibSQLiteServer().url);

    // Wait for loading to complete
    await expect(page.getByRole('table', { name: 'Stock takings list' })).not.toBeVisible();
    await expect(page.getByText('No Stock Takings Found')).toBeVisible();
    await expect(page.getByText('Perform stock taking to audit your inventory and reconcile discrepancies')).toBeVisible();
    await expect(page.getByRole('button', { name: 'New Stock Taking' }).first()).toBeVisible();
  });

  test('it shall display stock takings list when stock takings exist', async function ({ page }) {
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
      
      // Create test account
      await database.sql`
        INSERT INTO accounts (account_code, name, normal_balance, create_time, update_time)
        VALUES
          (11110, 'Inventory Account', 0, 0, 0),
          (61110, 'Stock Variance', 0, 0, 0),
          (41110, 'Inventory Gain', 1, 0, 0),
          (51110, 'Inventory Shrinkage', 0, 0, 0)
      `;
      await database.sql`
        INSERT INTO account_tags (account_code, tag)
        VALUES
          (11110, 'POS - Inventory'),
          (41110, 'POS - Inventory Gain'),
          (51110, 'POS - Inventory Shrinkage')
      `;

      // Create test inventories
      await database.sql`
        INSERT INTO inventories (id, name, unit_price, unit_of_measurement, account_code)
        VALUES
          (1, 'Product A', 10000, 'piece', 11110),
          (2, 'Product B', 20000, 'piece', 11110)
      `;

      // Create stock takings with gains, losses, and no change
      await database.sql`
        INSERT INTO stock_takings (id, inventory_id, audit_time, expected_stock, actual_stock, expected_cost, actual_cost)
        VALUES
          (1, 1, 1000000, 100, 110, 1000000, 1100000),
          (2, 2, 2000000, 50, 45, 1000000, 900000),
          (3, 1, 3000000, 30, 30, 300000, 300000)
      `;

      document.body.innerHTML = `
        <ready-context>
          <router-context>
            <database-context>
              <device-context>
                <i18n-context>
                  <stock-takings-view></stock-takings-view>
                </i18n-context>
              </device-context>
            </database-context>
          </router-context>
        </ready-context>
      `;
    }, tursoLibSQLiteServer().url);

    // Wait for stock takings table to load
    await expect(page.getByRole('table', { name: 'Stock takings list' })).toBeVisible();
    
    // Verify stock taking IDs are displayed
    const tableContent = page.getByRole('table', { name: 'Stock takings list' });
    await expect(tableContent.getByText('#1')).toBeVisible();
    await expect(tableContent.getByText('#2')).toBeVisible();
    await expect(tableContent.getByText('#3')).toBeVisible();
    
    // Verify product names are displayed
    await expect(tableContent.getByText('Product A').first()).toBeVisible();
    await expect(tableContent.getByText('Product B')).toBeVisible();
    
    // Verify status badges
    await expect(tableContent.getByText('Gain')).toBeVisible();
    await expect(tableContent.getByText('Loss')).toBeVisible();
    await expect(tableContent.getByText('No Change')).toBeVisible();
  });

  test('it shall filter stock takings by variance type', async function ({ page }) {
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
      
      // Create test account
      await database.sql`
        INSERT INTO accounts (account_code, name, normal_balance, create_time, update_time)
        VALUES
          (11110, 'Inventory Account', 0, 0, 0),
          (61110, 'Stock Variance', 0, 0, 0),
          (41110, 'Inventory Gain', 1, 0, 0),
          (51110, 'Inventory Shrinkage', 0, 0, 0)
      `;
      await database.sql`
        INSERT INTO account_tags (account_code, tag)
        VALUES
          (11110, 'POS - Inventory'),
          (41110, 'POS - Inventory Gain'),
          (51110, 'POS - Inventory Shrinkage')
      `;

      // Create test inventory
      await database.sql`
        INSERT INTO inventories (id, name, unit_price, unit_of_measurement, account_code)
        VALUES (1, 'Product A', 10000, 'piece', 11110)
      `;

      // Create stock takings with different variance types
      await database.sql`
        INSERT INTO stock_takings (id, inventory_id, audit_time, expected_stock, actual_stock, expected_cost, actual_cost)
        VALUES
          (1, 1, 1000000, 100, 110, 1000000, 1100000),
          (2, 1, 2000000, 50, 45, 500000, 450000),
          (3, 1, 3000000, 30, 30, 300000, 300000)
      `;

      document.body.innerHTML = `
        <ready-context>
          <router-context>
            <database-context>
              <device-context>
                <i18n-context>
                  <stock-takings-view></stock-takings-view>
                </i18n-context>
              </device-context>
            </database-context>
          </router-context>
        </ready-context>
      `;
    }, tursoLibSQLiteServer().url);

    // Wait for initial load
    await expect(page.getByRole('table', { name: 'Stock takings list' })).toBeVisible();
    const tableContent = page.getByRole('table', { name: 'Stock takings list' });
    await expect(tableContent.getByText('#1')).toBeVisible();
    await expect(tableContent.getByText('#2')).toBeVisible();
    await expect(tableContent.getByText('#3')).toBeVisible();

    // Open variance filter dropdown
    await page.getByLabel('Variance').click();

    // Select "Gains Only" filter
    await page.getByRole('menuitem', { name: 'Gains Only' }).click();

    // Verify only gain stock taking is visible
    await expect(tableContent.getByText('#1')).toBeVisible();
    await expect(tableContent.getByText('#2')).not.toBeVisible();
    await expect(tableContent.getByText('#3')).not.toBeVisible();

    // Open variance filter dropdown again
    await page.getByLabel('Variance').click();

    // Select "Losses Only" filter
    await page.getByRole('menuitem', { name: 'Losses Only' }).click();

    // Verify only loss stock taking is visible
    await expect(tableContent.getByText('#1')).not.toBeVisible();
    await expect(tableContent.getByText('#2')).toBeVisible();
    await expect(tableContent.getByText('#3')).not.toBeVisible();

    // Open variance filter dropdown again
    await page.getByLabel('Variance').click();

    // Select "No Change" filter
    await page.getByRole('menuitem', { name: 'No Change' }).click();

    // Verify only no-change stock taking is visible
    await expect(tableContent.getByText('#1')).not.toBeVisible();
    await expect(tableContent.getByText('#2')).not.toBeVisible();
    await expect(tableContent.getByText('#3')).toBeVisible();
  });

  test('it shall display stock and cost variance correctly', async function ({ page }) {
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
      
      // Create test account
      await database.sql`
        INSERT INTO accounts (account_code, name, normal_balance, create_time, update_time)
        VALUES
          (11110, 'Inventory Account', 0, 0, 0),
          (61110, 'Stock Variance', 0, 0, 0),
          (41110, 'Inventory Gain', 1, 0, 0),
          (51110, 'Inventory Shrinkage', 0, 0, 0)
      `;
      await database.sql`
        INSERT INTO account_tags (account_code, tag)
        VALUES
          (11110, 'POS - Inventory'),
          (41110, 'POS - Inventory Gain'),
          (51110, 'POS - Inventory Shrinkage')
      `;

      // Create test inventory
      await database.sql`
        INSERT INTO inventories (id, name, unit_price, unit_of_measurement, account_code)
        VALUES (1, 'Product A', 10000, 'piece', 11110)
      `;

      // Create stock taking with gain
      await database.sql`
        INSERT INTO stock_takings (id, inventory_id, audit_time, expected_stock, actual_stock, expected_cost, actual_cost)
        VALUES (1, 1, 1000000, 100, 110, 1000000, 1100000)
      `;

      document.body.innerHTML = `
        <ready-context>
          <router-context>
            <database-context>
              <device-context>
                <i18n-context>
                  <stock-takings-view></stock-takings-view>
                </i18n-context>
              </device-context>
            </database-context>
          </router-context>
        </ready-context>
      `;
    }, tursoLibSQLiteServer().url);

    // Wait for table to load
    await expect(page.getByRole('table', { name: 'Stock takings list' })).toBeVisible();
    
    // Find the stock taking row
    const stockTakingRow = page.getByRole('row').filter({ has: page.getByText('#1') });
    
    // Verify expected and actual stock
    await expect(stockTakingRow.getByRole('cell', { name: '100', exact: true })).toBeVisible();
    await expect(stockTakingRow.getByRole('cell', { name: '110', exact: true })).toBeVisible();
    
    // Verify stock variance (+10)
    await expect(stockTakingRow.getByText('+10')).toBeVisible();
    
    // Verify cost variance (+100,000 in IDR format)
    await expect(stockTakingRow.getByText(/\+.*100,000/)).toBeVisible();
  });

  test('it shall display pagination controls when stock takings exceed page size', async function ({ page }) {
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
      
      // Create test account
      await database.sql`
        INSERT INTO accounts (account_code, name, normal_balance, create_time, update_time)
        VALUES
          (11110, 'Inventory Account', 0, 0, 0),
          (61110, 'Stock Variance', 0, 0, 0)
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

      // Create 25 test stock takings (page size is 20)
      for (let i = 1; i <= 25; i++) {
        await database.sql`
          INSERT INTO stock_takings (id, inventory_id, audit_time, expected_stock, actual_stock, expected_cost, actual_cost)
          VALUES (${i}, 1, ${i * 1000}, 100, 100, 1000000, 1000000)
        `;
      }

      document.body.innerHTML = `
        <ready-context>
          <router-context>
            <database-context>
              <device-context>
                <i18n-context>
                  <stock-takings-view></stock-takings-view>
                </i18n-context>
              </device-context>
            </database-context>
          </router-context>
        </ready-context>
      `;
    }, tursoLibSQLiteServer().url);

    // Wait for table to load
    await expect(page.getByRole('table', { name: 'Stock takings list' })).toBeVisible();

    // Verify pagination controls are visible
    await expect(page.getByRole('navigation', { name: 'Pagination' })).toBeVisible();
    await expect(page.getByText('Showing 1–20 of 25')).toBeVisible();
    
    const tableContent = page.getByRole('table', { name: 'Stock takings list' });
    
    // Verify first page stock takings are visible (descending order, newest first)
    await expect(tableContent.getByText('#25')).toBeVisible();
    await expect(tableContent.getByText('#6')).toBeVisible();
    
    // Stock taking #5 should not be visible on first page
    await expect(tableContent.getByText('#5')).not.toBeVisible();

    // Navigate to next page
    await page.getByRole('button', { name: 'Next page' }).click();

    // Verify second page content
    await expect(page.getByText('Showing 21–25 of 25')).toBeVisible();
    await expect(tableContent.getByText('#5')).toBeVisible();
    await expect(tableContent.getByText('#1')).toBeVisible();
    
    // Stock taking #25 should not be visible on second page
    await expect(tableContent.getByText('#25')).not.toBeVisible();
  });



  test('it shall refresh stock takings list when refresh button is clicked', async function ({ page }) {
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

      // Create test stock taking
      await database.sql`
        INSERT INTO stock_takings (id, inventory_id, audit_time, expected_stock, actual_stock, expected_cost, actual_cost)
        VALUES (1, 1, 1000000, 100, 100, 1000000, 1000000)
      `;

      document.body.innerHTML = `
        <ready-context>
          <router-context>
            <database-context>
              <device-context>
                <i18n-context>
                  <stock-takings-view></stock-takings-view>
                </i18n-context>
              </device-context>
            </database-context>
          </router-context>
        </ready-context>
      `;
    }, tursoLibSQLiteServer().url);

    // Wait for initial load
    await expect(page.getByRole('table', { name: 'Stock takings list' })).toBeVisible();
    const tableContent = page.getByRole('table', { name: 'Stock takings list' });
    await expect(tableContent.getByText('#1')).toBeVisible();

    // Add a new stock taking via database
    await page.evaluate(async function () {
      /** @type {DatabaseContextElement} */
      const database = document.querySelector('database-context');
      
      await database.sql`
        INSERT INTO stock_takings (id, inventory_id, audit_time, expected_stock, actual_stock, expected_cost, actual_cost)
        VALUES (2, 1, 2000000, 50, 50, 500000, 500000)
      `;
    });

    // Click refresh button
    await page.getByRole('button', { name: 'Refresh' }).click();

    // Verify new stock taking appears
    await expect(tableContent.getByText('#2')).toBeVisible();
  });

  test('it shall display correct date format for audit time', async function ({ page }) {
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
      
      // Create test account
      await database.sql`
        INSERT INTO accounts (account_code, name, normal_balance, create_time, update_time)
        VALUES
          (11110, 'Inventory Account', 0, 0, 0),
          (61110, 'Stock Variance', 0, 0, 0)
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

      // Create stock taking with specific timestamp (Jan 1, 2025)
      const timestamp = new Date('2025-01-01T10:00:00Z').getTime();
      await database.sql`
        INSERT INTO stock_takings (id, inventory_id, audit_time, expected_stock, actual_stock, expected_cost, actual_cost)
        VALUES (1, 1, ${timestamp}, 100, 100, 1000000, 1000000)
      `;

      document.body.innerHTML = `
        <ready-context>
          <router-context>
            <database-context>
              <device-context>
                <i18n-context>
                  <stock-takings-view></stock-takings-view>
                </i18n-context>
              </device-context>
            </database-context>
          </router-context>
        </ready-context>
      `;
    }, tursoLibSQLiteServer().url);

    // Wait for table to load
    await expect(page.getByRole('table', { name: 'Stock takings list' })).toBeVisible();
    
    // Verify date is formatted (the exact format depends on i18n configuration)
    // We just check that some date-like text appears
    const tableContent = page.getByRole('table', { name: 'Stock takings list' });
    const dateCell = tableContent.getByText(/2025|Jan|01/i);
    await expect(dateCell).toBeVisible();
  });
});
