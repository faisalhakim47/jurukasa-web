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
              <stock-takings-view></stock-takings-view>
            </i18n-context>
          </device-context>
        </database-context>
      </router-context>
    </ready-context>
  `;
}

async function setupStockTakingsData(sql) {
  await sql`INSERT INTO inventories (id, name, unit_price, unit_of_measurement, account_code) VALUES (1, 'Product A', 10000, 'piece', 11310)`;
  await sql`INSERT INTO inventories (id, name, unit_price, unit_of_measurement, account_code) VALUES (2, 'Product B', 20000, 'piece', 11310)`;
  await sql`INSERT INTO stock_takings (id, inventory_id, audit_time, expected_stock, actual_stock, expected_cost, actual_cost) VALUES (1, 1, 1000000, 100, 110, 1000000, 1100000)`;
  await sql`INSERT INTO stock_takings (id, inventory_id, audit_time, expected_stock, actual_stock, expected_cost, actual_cost) VALUES (2, 2, 2000000, 50, 45, 1000000, 900000)`;
  await sql`INSERT INTO stock_takings (id, inventory_id, audit_time, expected_stock, actual_stock, expected_cost, actual_cost) VALUES (3, 1, 3000000, 30, 30, 300000, 300000)`;
}

async function setupVarianceFilterData(sql) {
  await sql`INSERT INTO inventories (id, name, unit_price, unit_of_measurement, account_code) VALUES (1, 'Product A', 10000, 'piece', 11310)`;
  await sql`INSERT INTO stock_takings (id, inventory_id, audit_time, expected_stock, actual_stock, expected_cost, actual_cost) VALUES (1, 1, 1000000, 100, 110, 1000000, 1100000)`;
  await sql`INSERT INTO stock_takings (id, inventory_id, audit_time, expected_stock, actual_stock, expected_cost, actual_cost) VALUES (2, 1, 2000000, 50, 45, 500000, 450000)`;
  await sql`INSERT INTO stock_takings (id, inventory_id, audit_time, expected_stock, actual_stock, expected_cost, actual_cost) VALUES (3, 1, 3000000, 30, 30, 300000, 300000)`;
}

async function setupSingleStockTaking(sql) {
  await sql`INSERT INTO inventories (id, name, unit_price, unit_of_measurement, account_code) VALUES (1, 'Product A', 10000, 'piece', 11310)`;
  await sql`INSERT INTO stock_takings (id, inventory_id, audit_time, expected_stock, actual_stock, expected_cost, actual_cost) VALUES (1, 1, 1000000, 100, 110, 1000000, 1100000)`;
}

async function setupPaginationData(sql) {
  await sql`INSERT INTO inventories (id, name, unit_price, unit_of_measurement, account_code) VALUES (1, 'Product A', 10000, 'piece', 11310)`;
  for (let i = 1; i <= 25; i++) {
    await sql`INSERT INTO stock_takings (id, inventory_id, audit_time, expected_stock, actual_stock, expected_cost, actual_cost) VALUES (${i}, 1, ${i * 1000}, 100, 100, 1000000, 1000000)`;
  }
}

async function setupSingleStockTakingForRefresh(sql) {
  await sql`INSERT INTO inventories (id, name, unit_price, unit_of_measurement, account_code) VALUES (1, 'Product A', 10000, 'piece', 11310)`;
  await sql`INSERT INTO stock_takings (id, inventory_id, audit_time, expected_stock, actual_stock, expected_cost, actual_cost) VALUES (1, 1, 1000000, 100, 100, 1000000, 1000000)`;
}

function insertNewStockTaking() {
  /** @type {DatabaseContextElement} */
  const database = document.querySelector('database-context');
  
  return database.sql`
    INSERT INTO stock_takings (id, inventory_id, audit_time, expected_stock, actual_stock, expected_cost, actual_cost)
    VALUES (2, 1, 2000000, 50, 50, 500000, 500000)
  `;
}

describe('Stock Takings View', function () {
  useStrict(test);
  const tursoLibSQLiteServer = useTursoLibSQLiteServer(test);

  test('user views empty stock takings list with guidance', async function ({ page }) {
    await loadEmptyFixture(page);

    await page.evaluate(setupView, tursoLibSQLiteServer().url);

    await expect(page.getByRole('table', { name: 'Stock takings list' }), 'it shall not display stock takings table').not.toBeVisible();
    await expect(page.getByText('No Stock Takings Found'), 'it shall display empty state heading').toBeVisible();
    await expect(page.getByText('Perform stock taking to audit your inventory and reconcile discrepancies'), 'it shall display empty state description').toBeVisible();
    await expect(page.getByRole('button', { name: 'New Stock Taking' }).first(), 'it shall display new stock taking button').toBeVisible();
  });

  test('user views stock takings list with variance indicators', async function ({ page }) {
    await Promise.all([
      loadEmptyFixture(page),
      setupDatabase(tursoLibSQLiteServer(), setupStockTakingsData),
    ]);

    await page.evaluate(setupView, tursoLibSQLiteServer().url);

    await expect(page.getByRole('table', { name: 'Stock takings list' }), 'it shall display stock takings table').toBeVisible();
    
    const tableContent = page.getByRole('table', { name: 'Stock takings list' });
    await expect(tableContent.getByText('#1'), 'it shall display stock taking #1').toBeVisible();
    await expect(tableContent.getByText('#2'), 'it shall display stock taking #2').toBeVisible();
    await expect(tableContent.getByText('#3'), 'it shall display stock taking #3').toBeVisible();
    await expect(tableContent.getByText('Product A').first(), 'it shall display Product A').toBeVisible();
    await expect(tableContent.getByText('Product B'), 'it shall display Product B').toBeVisible();
    await expect(tableContent.getByText('Gain'), 'it shall display Gain variance label').toBeVisible();
    await expect(tableContent.getByText('Loss'), 'it shall display Loss variance label').toBeVisible();
    await expect(tableContent.getByText('No Change'), 'it shall display No Change variance label').toBeVisible();
  });

  test('user filters stock takings by variance type', async function ({ page }) {
    await Promise.all([
      loadEmptyFixture(page),
      setupDatabase(tursoLibSQLiteServer(), setupVarianceFilterData),
    ]);

    await page.evaluate(setupView, tursoLibSQLiteServer().url);

    await expect(page.getByRole('table', { name: 'Stock takings list' }), 'it shall display stock takings table').toBeVisible();
    const tableContent = page.getByRole('table', { name: 'Stock takings list' });
    await expect(tableContent.getByText('#1'), 'it shall display stock taking #1 initially').toBeVisible();
    await expect(tableContent.getByText('#2'), 'it shall display stock taking #2 initially').toBeVisible();
    await expect(tableContent.getByText('#3'), 'it shall display stock taking #3 initially').toBeVisible();

    await page.getByLabel('Variance').click();
    await page.getByRole('menuitem', { name: 'Gains Only' }).click();

    await expect(tableContent.getByText('#1'), 'it shall display stock taking #1 after gains filter').toBeVisible();
    await expect(tableContent.getByText('#2'), 'it shall not display stock taking #2 after gains filter').not.toBeVisible();
    await expect(tableContent.getByText('#3'), 'it shall not display stock taking #3 after gains filter').not.toBeVisible();

    await page.getByLabel('Variance').click();
    await page.getByRole('menuitem', { name: 'Losses Only' }).click();

    await expect(tableContent.getByText('#1'), 'it shall not display stock taking #1 after losses filter').not.toBeVisible();
    await expect(tableContent.getByText('#2'), 'it shall display stock taking #2 after losses filter').toBeVisible();
    await expect(tableContent.getByText('#3'), 'it shall not display stock taking #3 after losses filter').not.toBeVisible();

    await page.getByLabel('Variance').click();
    await page.getByRole('menuitem', { name: 'No Change' }).click();

    await expect(tableContent.getByText('#1'), 'it shall not display stock taking #1 after no change filter').not.toBeVisible();
    await expect(tableContent.getByText('#2'), 'it shall not display stock taking #2 after no change filter').not.toBeVisible();
    await expect(tableContent.getByText('#3'), 'it shall display stock taking #3 after no change filter').toBeVisible();
  });

  test('user views stock and cost variance calculations', async function ({ page }) {
    await Promise.all([
      loadEmptyFixture(page),
      setupDatabase(tursoLibSQLiteServer(), setupSingleStockTaking),
    ]);

    await page.evaluate(setupView, tursoLibSQLiteServer().url);

    await expect(page.getByRole('table', { name: 'Stock takings list' }), 'it shall display stock takings table').toBeVisible();
    
    const stockTakingRow = page.getByRole('row').filter({ has: page.getByText('#1') });
    
    await expect(stockTakingRow.getByRole('cell', { name: '100', exact: true }), 'it shall display expected stock quantity').toBeVisible();
    await expect(stockTakingRow.getByRole('cell', { name: '110', exact: true }), 'it shall display actual stock quantity').toBeVisible();
    await expect(stockTakingRow.getByText('+10'), 'it shall display positive stock variance').toBeVisible();
    await expect(stockTakingRow.getByText(/\+.*100,000/), 'it shall display cost variance in IDR format').toBeVisible();
  });

  test('user navigates paginated stock takings list', async function ({ page }) {
    await Promise.all([
      loadEmptyFixture(page),
      setupDatabase(tursoLibSQLiteServer(), setupPaginationData),
    ]);

    await page.evaluate(setupView, tursoLibSQLiteServer().url);

    await expect(page.getByRole('table', { name: 'Stock takings list' }), 'it shall display stock takings table').toBeVisible();

    await expect(page.getByRole('navigation', { name: 'Pagination' }), 'it shall display pagination controls').toBeVisible();
    await expect(page.getByText('Showing 1–20 of 25'), 'it shall display first page range').toBeVisible();
    
    const tableContent = page.getByRole('table', { name: 'Stock takings list' });
    
    await expect(tableContent.getByText('#25'), 'it shall display stock taking #25 on first page').toBeVisible();
    await expect(tableContent.getByText('#6'), 'it shall display stock taking #6 on first page').toBeVisible();
    await expect(tableContent.getByText('#5'), 'it shall not display stock taking #5 on first page').not.toBeVisible();

    await page.getByRole('button', { name: 'Next page' }).click();

    await expect(page.getByText('Showing 21–25 of 25'), 'it shall display second page range').toBeVisible();
    await expect(tableContent.getByText('#5'), 'it shall display stock taking #5 on second page').toBeVisible();
    await expect(tableContent.getByText('#1'), 'it shall display stock taking #1 on second page').toBeVisible();
    await expect(tableContent.getByText('#25'), 'it shall not display stock taking #25 on second page').not.toBeVisible();
  });

  test('user refreshes stock takings list to see new entries', async function ({ page }) {
    await Promise.all([
      loadEmptyFixture(page),
      setupDatabase(tursoLibSQLiteServer(), setupSingleStockTakingForRefresh),
    ]);

    await page.evaluate(setupView, tursoLibSQLiteServer().url);

    await expect(page.getByRole('table', { name: 'Stock takings list' }), 'it shall display stock takings table').toBeVisible();
    const tableContent = page.getByRole('table', { name: 'Stock takings list' });
    await expect(tableContent.getByText('#1'), 'it shall display initial stock taking #1').toBeVisible();

    await page.evaluate(insertNewStockTaking);

    await page.getByRole('button', { name: 'Refresh' }).click();

    await expect(tableContent.getByText('#2'), 'it shall display newly added stock taking #2 after refresh').toBeVisible();
  });

  test('user views formatted audit dates in stock takings list', async function ({ page }) {
    const timestamp = new Date('2025-01-01T10:00:00Z').getTime();
    await Promise.all([
      loadEmptyFixture(page),
      setupDatabase(tursoLibSQLiteServer(), async function setupData(sql) {
        await sql`INSERT INTO inventories (id, name, unit_price, unit_of_measurement, account_code) VALUES (1, 'Product A', 10000, 'piece', 11310)`;
        await sql`INSERT INTO stock_takings (id, inventory_id, audit_time, expected_stock, actual_stock, expected_cost, actual_cost) VALUES (1, 1, ${timestamp}, 100, 100, 1000000, 1000000)`;
      }),
    ]);

    await page.evaluate(setupView, tursoLibSQLiteServer().url);

    await expect(page.getByRole('table', { name: 'Stock takings list' }), 'it shall display stock takings table').toBeVisible();
    
    const tableContent = page.getByRole('table', { name: 'Stock takings list' });
    const dateCell = tableContent.getByText('Jan 1, 2025', { exact: true });
    await expect(dateCell, 'it shall display formatted audit date').toBeVisible();
  });
});
