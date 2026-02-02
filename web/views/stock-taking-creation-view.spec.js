import { expect } from '@playwright/test';
import { jurukasaTest } from '#test/playwright/test-setup.js';
import { useTursoLibSQLiteServer } from '#test/playwright/hooks/use-turso-libsqlite-server.js';
import { loadEmptyFixture } from '#test/playwright/tools/fixture.js';
import { setupDatabase } from '#test/playwright/tools/database.js';
import { useConsoleOutput } from '#test/playwright/hooks/use-console-output.js';
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
              <stock-taking-creation-view></stock-taking-creation-view>
            </i18n-context>
          </device-context>
        </database-context>
      </router-context>
    </ready-context>
  `;
}

function mockDateTo2025_01_16() {
  const mockNow = new Date('2025-01-16T00:00:00Z').getTime();
  // eslint-disable-next-line no-global-assign
  Date = class extends Date {
    static now() {
      return mockNow;
    }
  };
}

async function setupThreeInventories(sql) {
  await sql`INSERT INTO inventories (id, name, unit_price, unit_of_measurement, account_code) VALUES (1, 'Product A', 10000, 'piece', 11310)`;
  await sql`INSERT INTO inventories (id, name, unit_price, unit_of_measurement, account_code) VALUES (2, 'Product B', 20000, 'piece', 11310)`;
  await sql`INSERT INTO inventories (id, name, unit_price, unit_of_measurement, account_code) VALUES (3, 'Product C', 15000, 'unit', 11310)`;
}

async function setupInventoriesWithStock(sql) {
  await sql`INSERT INTO inventories (id, name, unit_price, unit_of_measurement, account_code, stock) VALUES (1, 'Product A', 10000, 'piece', 11310, 100)`;
  await sql`INSERT INTO inventories (id, name, unit_price, unit_of_measurement, account_code, stock) VALUES (2, 'Product B', 20000, 'piece', 11310, 50)`;
  await sql`INSERT INTO inventories (id, name, unit_price, unit_of_measurement, account_code, stock) VALUES (3, 'Product C', 15000, 'unit', 11310, 75)`;
}

async function setupRecentAuditInventory(sql) {
  const recentTime = new Date('2025-01-15T00:00:00Z').getTime();
  await sql`INSERT INTO inventories (id, name, unit_price, unit_of_measurement, account_code, latest_stock_taking_time) VALUES (1, 'Product A', 10000, 'piece', 11310, ${recentTime})`;
}

async function setupOverdueAuditInventory(sql) {
  const overdueTime = new Date('2024-12-01T00:00:00Z').getTime();
  await sql`INSERT INTO inventories (id, name, unit_price, unit_of_measurement, account_code, latest_stock_taking_time) VALUES (1, 'Product A', 10000, 'piece', 11310, ${overdueTime})`;
}

async function setupPaginationInventories(sql) {
  for (let index = 1; index <= 25; index++) {
    await sql`INSERT INTO inventories (id, name, unit_price, unit_of_measurement, account_code) VALUES (${index}, ${'Product ' + index}, 10000, 'piece', 11310)`;
  }
}

async function setupInventoriesWithCost(sql) {
  await sql`INSERT INTO inventories (id, name, unit_price, unit_of_measurement, account_code) VALUES (1, 'Product A', 10000, 'piece', 11310)`;
  await sql`INSERT INTO inventories (id, name, unit_price, unit_of_measurement, account_code) VALUES (2, 'Product B', 20000, 'piece', 11310)`;
  await sql`INSERT INTO inventories (id, name, unit_price, unit_of_measurement, account_code) VALUES (3, 'Product C', 15000, 'unit', 11310)`;
  await sql`UPDATE accounts SET balance = 22500 WHERE account_code = 11310`;
  await sql`UPDATE inventories SET cost = 5000, stock = 1 WHERE id = 1`;
  await sql`UPDATE inventories SET cost = 10000, stock = 1 WHERE id = 2`;
  await sql`UPDATE inventories SET cost = 7500, stock = 1 WHERE id = 3`;
}

async function setupInventoryWithAuditDate(sql) {
  const timestamp = new Date('2025-01-01T10:00:00Z').getTime();
  await sql`INSERT INTO inventories (id, name, unit_price, unit_of_measurement, account_code, latest_stock_taking_time) VALUES (1, 'Product A', 10000, 'piece', 11310, ${timestamp})`;
}

function insertNewInventory() {
  /** @type {import('#web/contexts/database-context.js').DatabaseContextElement} */
  const database = document.querySelector('database-context');

  return database.sql`INSERT INTO inventories (id, name, unit_price, unit_of_measurement, account_code) VALUES (4, 'Product D', 25000, 'piece', 11310)`;
}

describe('Stock Taking Creation View', function () {
  useConsoleOutput(test);
  useStrict(test);
  const tursoLibSQLiteServer = useTursoLibSQLiteServer(test);

  test('user views stock taking creation page with header and inventory list', async function ({ page }) {
    await Promise.all([
      loadEmptyFixture(page),
      setupDatabase(tursoLibSQLiteServer(), setupThreeInventories),
    ]);

    await page.evaluate(setupView, tursoLibSQLiteServer().url);

    await expect(page.getByRole('heading', { name: 'New Stock Taking' }), 'it shall display page heading').toBeVisible();
    await expect(page.getByText('Select an inventory item to perform stock taking'), 'it shall display page description').toBeVisible();
    await expect(page.getByRole('table'), 'it shall display inventories table').toBeVisible();
    await expect(page.getByText('Product A'), 'it shall display Product A in list').toBeVisible();
    await expect(page.getByText('Product B'), 'it shall display Product B in list').toBeVisible();
    await expect(page.getByText('Product C'), 'it shall display Product C in list').toBeVisible();
  });

  test('user views empty state when no inventories exist', async function ({ page }) {
    await loadEmptyFixture(page);

    await page.evaluate(setupView, tursoLibSQLiteServer().url);

    await expect(page.getByText('No inventories found'), 'it shall display empty state message').toBeVisible();
  });

  test('user views stock quantities and audit buttons for each inventory', async function ({ page }) {
    await Promise.all([
      loadEmptyFixture(page),
      setupDatabase(tursoLibSQLiteServer(), setupInventoriesWithStock),
    ]);

    await page.evaluate(setupView, tursoLibSQLiteServer().url);

    const inventoriesTable = page.getByRole('table');

    await expect(inventoriesTable.getByText('100'), 'it shall display stock quantity 100').toBeVisible();
    await expect(inventoriesTable.getByText('50'), 'it shall display stock quantity 50').toBeVisible();
    await expect(inventoriesTable.getByText('75'), 'it shall display stock quantity 75').toBeVisible();

    const auditButtons = page.getByRole('button', { name: 'Audit' });
    await expect(auditButtons.first(), 'it shall display audit button').toBeVisible();
    await expect(auditButtons, 'it shall display three audit buttons').toHaveCount(3);
  });

  test('user views audit status indicators for inventories', async function ({ page }) {
    await Promise.all([
      loadEmptyFixture(page),
      setupDatabase(tursoLibSQLiteServer(), setupThreeInventories),
    ]);

    await page.evaluate(setupView, tursoLibSQLiteServer().url);

    await expect(page.getByText('Never').first(), 'it shall display Never audit status for unaudited items').toBeVisible();
  });

  test('user views Recent audit status for recently audited inventory', async function ({ page }) {
    await Promise.all([
      loadEmptyFixture(page),
      setupDatabase(tursoLibSQLiteServer(), setupRecentAuditInventory),
    ]);

    // Mock Date.now() to return a fixed time (2025-01-16) so the audit from 2025-01-15 is "Recent"
    await page.evaluate(mockDateTo2025_01_16);

    await page.evaluate(setupView, tursoLibSQLiteServer().url);

    await expect(page.getByText('Recent'), 'it shall display Recent audit status').toBeVisible();
  });

  test('user views Overdue audit status for inventory not audited recently', async function ({ page }) {
    await Promise.all([
      loadEmptyFixture(page),
      setupDatabase(tursoLibSQLiteServer(), setupOverdueAuditInventory),
    ]);

    // Mock Date.now() to return a fixed time (2025-01-16) so the audit from 2024-12-01 is "Overdue" (>30 days)
    await page.evaluate(mockDateTo2025_01_16);

    await page.evaluate(setupView, tursoLibSQLiteServer().url);

    await expect(page.getByText('Overdue'), 'it shall display Overdue audit status').toBeVisible();
  });

  test('user filters inventory list by search query', async function ({ page }) {
    await Promise.all([
      loadEmptyFixture(page),
      setupDatabase(tursoLibSQLiteServer(), setupThreeInventories),
    ]);

    await page.evaluate(setupView, tursoLibSQLiteServer().url);

    await expect(page.getByText('Product A'), 'it shall display Product A initially').toBeVisible();
    await expect(page.getByText('Product B'), 'it shall display Product B initially').toBeVisible();
    await expect(page.getByText('Product C'), 'it shall display Product C initially').toBeVisible();

    await page.getByLabel('Search').fill('Product A');

    await expect(page.getByText('Product A'), 'it shall display Product A after search').toBeVisible();
    await expect(page.getByText('Product B'), 'it shall not display Product B after search').not.toBeVisible();
    await expect(page.getByText('Product C'), 'it shall not display Product C after search').not.toBeVisible();
  });

  test('user navigates paginated inventory list', async function ({ page }) {
    await Promise.all([
      loadEmptyFixture(page),
      setupDatabase(tursoLibSQLiteServer(), setupPaginationInventories),
    ]);

    await page.evaluate(setupView, tursoLibSQLiteServer().url);

    await expect(page.getByRole('table'), 'it shall display inventories table').toBeVisible();
    await expect(page.getByRole('navigation', { name: 'Pagination' }), 'it shall display pagination controls').toBeVisible();
    await expect(page.getByText('Showing 1–20 of 25'), 'it shall display first page range').toBeVisible();

    await expect(page.getByText('Product 1', { exact: true }), 'it shall display Product 1 on first page').toBeVisible();
    await expect(page.getByText('Product 2', { exact: true }), 'it shall display Product 2 on first page').toBeVisible();
    await expect(page.getByText('Product 4', { exact: true }), 'it shall display Product 4 on first page').toBeVisible();
    await expect(page.getByText('Product 5', { exact: true }), 'it shall not display Product 5 on first page').not.toBeVisible();

    await page.getByRole('button', { name: 'Next page' }).click();

    await expect(page.getByText('Showing 21–25 of 25'), 'it shall display second page range').toBeVisible();
    await expect(page.getByText('Product 5', { exact: true }), 'it shall display Product 5 on second page').toBeVisible();
    await expect(page.getByText('Product 9', { exact: true }), 'it shall display Product 9 on second page').toBeVisible();
    await expect(page.getByText('Product 1', { exact: true }), 'it shall not display Product 1 on second page').not.toBeVisible();
  });

  test('user navigates to first page from later page', async function ({ page }) {
    await Promise.all([
      loadEmptyFixture(page),
      setupDatabase(tursoLibSQLiteServer(), setupPaginationInventories),
    ]);

    await page.evaluate(setupView, tursoLibSQLiteServer().url);

    await expect(page.getByRole('table'), 'it shall display inventories table').toBeVisible();

    await page.getByRole('button', { name: 'Next page' }).click();
    await expect(page.getByText('Showing 21–25 of 25'), 'it shall display second page range').toBeVisible();

    await page.getByRole('button', { name: 'First page' }).click();

    await expect(page.getByText('Showing 1–20 of 25'), 'it shall display first page range after navigation').toBeVisible();
    await expect(page.getByText('Product 1', { exact: true }), 'it shall display Product 1 on first page').toBeVisible();
  });

  test('user refreshes inventory list to see new entries', async function ({ page }) {
    await Promise.all([
      loadEmptyFixture(page),
      setupDatabase(tursoLibSQLiteServer(), setupThreeInventories),
    ]);

    await page.evaluate(setupView, tursoLibSQLiteServer().url);

    await expect(page.getByRole('table'), 'it shall display inventories table').toBeVisible();
    await expect(page.getByText('Product A'), 'it shall display Product A initially').toBeVisible();

    await page.evaluate(insertNewInventory);

    await page.getByRole('button', { name: 'Refresh' }).click();

    await expect(page.getByText('Product D'), 'it shall display newly added Product D after refresh').toBeVisible();
  });

  test('user views cost information for each inventory', async function ({ page }) {
    await Promise.all([
      loadEmptyFixture(page),
      setupDatabase(tursoLibSQLiteServer(), setupInventoriesWithCost),
    ]);

    await page.evaluate(setupView, tursoLibSQLiteServer().url);

    const inventoriesTable = page.getByRole('table');

    await expect(inventoriesTable.getByText('IDR 5,000', { exact: true }), 'it shall display cost IDR 5,000 for Product A').toBeVisible();
    await expect(inventoriesTable.getByText('IDR 10,000', { exact: true }), 'it shall display cost IDR 10,000 for Product B').toBeVisible();
  });

  test('user views last audit date for inventoried items', async function ({ page }) {
    await Promise.all([
      loadEmptyFixture(page),
      setupDatabase(tursoLibSQLiteServer(), setupInventoryWithAuditDate),
    ]);

    await page.evaluate(setupView, tursoLibSQLiteServer().url);

    await expect(page.getByRole('table'), 'it shall display inventories table').toBeVisible();

    const table = page.getByRole('table');
    await expect(table.getByText('2025', { exact: false }).first(), 'it shall display audit year 2025').toBeVisible();
  });
});
