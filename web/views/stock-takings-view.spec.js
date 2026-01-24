import { test, expect } from '@playwright/test';
import { useTursoLibSQLiteServer } from '#test/playwright/hooks/use-turso-libsqlite-server.js';
import { loadEmptyFixture } from '#test/playwright/tools/fixture.js';
import { setupDatabase } from '#test/playwright/tools/database.js';
import { useStrict } from '#test/playwright/hooks/use-strict.js';
/** @import { DatabaseContextElement } from '#web/contexts/database-context.js' */

const { describe } = test;

/** @param {string} tursoDatabaseUrl */
async function setupView(tursoDatabaseUrl) {
  document.body.innerHTML = `
    <ready-context>
      <router-context>
        <database-context provider="turso" turso-url=${tursoDatabaseUrl}>
          <device-context>
            <i18n-context>
              <stock-takings-view></stock-takings-view>
            </i18n-context>
          </device-context>
        </database-context>
      </router-context>
    </ready-context>
  `;
}

describe('Stock Takings View', function () {
  useStrict(test);
  const tursoLibSQLiteServer = useTursoLibSQLiteServer(test);

  test('it shall display empty state when no stock takings exist', async function ({ page }) {
    await loadEmptyFixture(page);

    await page.evaluate(setupView, tursoLibSQLiteServer().url);

    await expect(page.getByRole('table', { name: 'Stock takings list' })).not.toBeVisible();
    await expect(page.getByText('No Stock Takings Found')).toBeVisible();
    await expect(page.getByText('Perform stock taking to audit your inventory and reconcile discrepancies')).toBeVisible();
    await expect(page.getByRole('button', { name: 'New Stock Taking' }).first()).toBeVisible();
  });

  test('it shall display stock takings list when stock takings exist', async function ({ page }) {
    await Promise.all([
      loadEmptyFixture(page),
      setupDatabase(tursoLibSQLiteServer(), async function setupData(sql) {
        await sql`INSERT INTO inventories (id, name, unit_price, unit_of_measurement, account_code) VALUES (1, 'Product A', 10000, 'piece', 11310)`;
        await sql`INSERT INTO inventories (id, name, unit_price, unit_of_measurement, account_code) VALUES (2, 'Product B', 20000, 'piece', 11310)`;
        await sql`INSERT INTO stock_takings (id, inventory_id, audit_time, expected_stock, actual_stock, expected_cost, actual_cost) VALUES (1, 1, 1000000, 100, 110, 1000000, 1100000)`;
        await sql`INSERT INTO stock_takings (id, inventory_id, audit_time, expected_stock, actual_stock, expected_cost, actual_cost) VALUES (2, 2, 2000000, 50, 45, 1000000, 900000)`;
        await sql`INSERT INTO stock_takings (id, inventory_id, audit_time, expected_stock, actual_stock, expected_cost, actual_cost) VALUES (3, 1, 3000000, 30, 30, 300000, 300000)`;
      }),
    ]);

    await page.evaluate(setupView, tursoLibSQLiteServer().url);

    await expect(page.getByRole('table', { name: 'Stock takings list' })).toBeVisible();
    
    const tableContent = page.getByRole('table', { name: 'Stock takings list' });
    await expect(tableContent.getByText('#1')).toBeVisible();
    await expect(tableContent.getByText('#2')).toBeVisible();
    await expect(tableContent.getByText('#3')).toBeVisible();
    await expect(tableContent.getByText('Product A').first()).toBeVisible();
    await expect(tableContent.getByText('Product B')).toBeVisible();
    await expect(tableContent.getByText('Gain')).toBeVisible();
    await expect(tableContent.getByText('Loss')).toBeVisible();
    await expect(tableContent.getByText('No Change')).toBeVisible();
  });

  test('it shall filter stock takings by variance type', async function ({ page }) {
    await Promise.all([
      loadEmptyFixture(page),
      setupDatabase(tursoLibSQLiteServer(), async function setupData(sql) {
        await sql`INSERT INTO inventories (id, name, unit_price, unit_of_measurement, account_code) VALUES (1, 'Product A', 10000, 'piece', 11310)`;
        await sql`INSERT INTO stock_takings (id, inventory_id, audit_time, expected_stock, actual_stock, expected_cost, actual_cost) VALUES (1, 1, 1000000, 100, 110, 1000000, 1100000)`;
        await sql`INSERT INTO stock_takings (id, inventory_id, audit_time, expected_stock, actual_stock, expected_cost, actual_cost) VALUES (2, 1, 2000000, 50, 45, 500000, 450000)`;
        await sql`INSERT INTO stock_takings (id, inventory_id, audit_time, expected_stock, actual_stock, expected_cost, actual_cost) VALUES (3, 1, 3000000, 30, 30, 300000, 300000)`;
      }),
    ]);

    await page.evaluate(setupView, tursoLibSQLiteServer().url);

    await expect(page.getByRole('table', { name: 'Stock takings list' })).toBeVisible();
    const tableContent = page.getByRole('table', { name: 'Stock takings list' });
    await expect(tableContent.getByText('#1')).toBeVisible();
    await expect(tableContent.getByText('#2')).toBeVisible();
    await expect(tableContent.getByText('#3')).toBeVisible();

    await page.getByLabel('Variance').click();
    await page.getByRole('menuitem', { name: 'Gains Only' }).click();

    await expect(tableContent.getByText('#1')).toBeVisible();
    await expect(tableContent.getByText('#2')).not.toBeVisible();
    await expect(tableContent.getByText('#3')).not.toBeVisible();

    await page.getByLabel('Variance').click();
    await page.getByRole('menuitem', { name: 'Losses Only' }).click();

    await expect(tableContent.getByText('#1')).not.toBeVisible();
    await expect(tableContent.getByText('#2')).toBeVisible();
    await expect(tableContent.getByText('#3')).not.toBeVisible();

    await page.getByLabel('Variance').click();
    await page.getByRole('menuitem', { name: 'No Change' }).click();

    await expect(tableContent.getByText('#1')).not.toBeVisible();
    await expect(tableContent.getByText('#2')).not.toBeVisible();
    await expect(tableContent.getByText('#3')).toBeVisible();
  });

  test('it shall display stock and cost variance correctly', async function ({ page }) {
    await Promise.all([
      loadEmptyFixture(page),
      setupDatabase(tursoLibSQLiteServer(), async function setupData(sql) {
        await sql`INSERT INTO inventories (id, name, unit_price, unit_of_measurement, account_code) VALUES (1, 'Product A', 10000, 'piece', 11310)`;
        await sql`INSERT INTO stock_takings (id, inventory_id, audit_time, expected_stock, actual_stock, expected_cost, actual_cost) VALUES (1, 1, 1000000, 100, 110, 1000000, 1100000)`;
      }),
    ]);

    await page.evaluate(setupView, tursoLibSQLiteServer().url);

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
    await Promise.all([
      loadEmptyFixture(page),
      setupDatabase(tursoLibSQLiteServer(), async function setupData(sql) {
        await sql`INSERT INTO inventories (id, name, unit_price, unit_of_measurement, account_code) VALUES (1, 'Product A', 10000, 'piece', 11310)`;
        for (let i = 1; i <= 25; i++) {
          await sql`INSERT INTO stock_takings (id, inventory_id, audit_time, expected_stock, actual_stock, expected_cost, actual_cost) VALUES (${i}, 1, ${i * 1000}, 100, 100, 1000000, 1000000)`;
        }
      }),
    ]);

    await page.evaluate(setupView, tursoLibSQLiteServer().url);

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
    await Promise.all([
      loadEmptyFixture(page),
      setupDatabase(tursoLibSQLiteServer(), async function setupData(sql) {
        await sql`INSERT INTO inventories (id, name, unit_price, unit_of_measurement, account_code) VALUES (1, 'Product A', 10000, 'piece', 11310)`;
        await sql`INSERT INTO stock_takings (id, inventory_id, audit_time, expected_stock, actual_stock, expected_cost, actual_cost) VALUES (1, 1, 1000000, 100, 100, 1000000, 1000000)`;
      }),
    ]);

    await page.evaluate(setupView, tursoLibSQLiteServer().url);

    // Wait for initial load
    await expect(page.getByRole('table', { name: 'Stock takings list' })).toBeVisible();
    const tableContent = page.getByRole('table', { name: 'Stock takings list' });
    await expect(tableContent.getByText('#1')).toBeVisible();

    // Add a new stock taking via database
    await page.evaluate(insertNewStockTaking);

    // Click refresh button
    await page.getByRole('button', { name: 'Refresh' }).click();

    // Verify new stock taking appears
    await expect(tableContent.getByText('#2')).toBeVisible();
  });

  function insertNewStockTaking() {
    /** @type {DatabaseContextElement} */
    const database = document.querySelector('database-context');
    
    return database.sql`
      INSERT INTO stock_takings (id, inventory_id, audit_time, expected_stock, actual_stock, expected_cost, actual_cost)
      VALUES (2, 1, 2000000, 50, 50, 500000, 500000)
    `;
  }

  test('it shall display correct date format for audit time', async function ({ page }) {
    const timestamp = new Date('2025-01-01T10:00:00Z').getTime();
    await Promise.all([
      loadEmptyFixture(page),
      setupDatabase(tursoLibSQLiteServer(), async function setupData(sql) {
        await sql`INSERT INTO inventories (id, name, unit_price, unit_of_measurement, account_code) VALUES (1, 'Product A', 10000, 'piece', 11310)`;
        await sql`INSERT INTO stock_takings (id, inventory_id, audit_time, expected_stock, actual_stock, expected_cost, actual_cost) VALUES (1, 1, ${timestamp}, 100, 100, 1000000, 1000000)`;
      }),
    ]);

    await page.evaluate(setupView, tursoLibSQLiteServer().url);

    // Wait for table to load
    await expect(page.getByRole('table', { name: 'Stock takings list' })).toBeVisible();
    
    // Verify date is formatted (the exact format depends on i18n configuration)
    // We just check that some date-like text appears
    const tableContent = page.getByRole('table', { name: 'Stock takings list' });
    const dateCell = tableContent.getByText('Jan 1, 2025', { exact: true });
    await expect(dateCell).toBeVisible();
  });
});
