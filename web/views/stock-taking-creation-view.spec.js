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
              <stock-taking-creation-view></stock-taking-creation-view>
            </i18n-context>
          </device-context>
        </database-context>
      </router-context>
    </ready-context>
  `;
}

describe('Stock Taking Creation View', function () {
  useStrict(test);
  const tursoLibSQLiteServer = useTursoLibSQLiteServer(test);

  test('it shall display page header and description', async function ({ page }) {
    await Promise.all([
      loadEmptyFixture(page),
      setupDatabase(tursoLibSQLiteServer(), async function setupData(sql) {
        // Create inventories (11310 is POS - Inventory account from migrations)
        await sql`INSERT INTO inventories (id, name, unit_price, unit_of_measurement, account_code) VALUES (1, 'Product A', 10000, 'piece', 11310)`;
        await sql`INSERT INTO inventories (id, name, unit_price, unit_of_measurement, account_code) VALUES (2, 'Product B', 20000, 'piece', 11310)`;
        await sql`INSERT INTO inventories (id, name, unit_price, unit_of_measurement, account_code) VALUES (3, 'Product C', 15000, 'unit', 11310)`;
      }),
    ]);

    await page.evaluate(setupView, tursoLibSQLiteServer().url);

    await expect(page.getByRole('heading', { name: 'New Stock Taking' })).toBeVisible();

    await expect(page.getByText('Select an inventory item to perform stock taking')).toBeVisible();
  });

  test('it shall display empty state when no inventories exist', async function ({ page }) {
    await loadEmptyFixture(page);

    await page.evaluate(setupView, tursoLibSQLiteServer().url);

    await expect(page.getByText('No inventories found')).toBeVisible();
  });

  test('it shall display inventories list', async function ({ page }) {
    await Promise.all([
      loadEmptyFixture(page),
      setupDatabase(tursoLibSQLiteServer(), async function setupData(sql) {
        await sql`INSERT INTO inventories (id, name, unit_price, unit_of_measurement, account_code) VALUES (1, 'Product A', 10000, 'piece', 11310)`;
        await sql`INSERT INTO inventories (id, name, unit_price, unit_of_measurement, account_code) VALUES (2, 'Product B', 20000, 'piece', 11310)`;
        await sql`INSERT INTO inventories (id, name, unit_price, unit_of_measurement, account_code) VALUES (3, 'Product C', 15000, 'unit', 11310)`;
      }),
    ]);

    await page.evaluate(setupView, tursoLibSQLiteServer().url);

    await expect(page.getByRole('table')).toBeVisible();

    await expect(page.getByText('Product A')).toBeVisible();
    await expect(page.getByText('Product B')).toBeVisible();
    await expect(page.getByText('Product C')).toBeVisible();
  });

  test('it shall display stock quantities for each inventory', async function ({ page }) {
    await Promise.all([
      loadEmptyFixture(page),
      setupDatabase(tursoLibSQLiteServer(), async function setupData(sql) {
        await sql`INSERT INTO inventories (id, name, unit_price, unit_of_measurement, account_code, stock) VALUES (1, 'Product A', 10000, 'piece', 11310, 100)`;
        await sql`INSERT INTO inventories (id, name, unit_price, unit_of_measurement, account_code, stock) VALUES (2, 'Product B', 20000, 'piece', 11310, 50)`;
        await sql`INSERT INTO inventories (id, name, unit_price, unit_of_measurement, account_code, stock) VALUES (3, 'Product C', 15000, 'unit', 11310, 75)`;
      }),
    ]);

    await page.evaluate(setupView, tursoLibSQLiteServer().url);

    const inventoriesTable = page.getByRole('table');

    await expect(inventoriesTable.getByText('100')).toBeVisible();
    await expect(inventoriesTable.getByText('50')).toBeVisible();
    await expect(inventoriesTable.getByText('75')).toBeVisible();
  });

  test('it shall display audit button for each inventory', async function ({ page }) {
    await Promise.all([
      loadEmptyFixture(page),
      setupDatabase(tursoLibSQLiteServer(), async function setupData(sql) {
        await sql`INSERT INTO inventories (id, name, unit_price, unit_of_measurement, account_code) VALUES (1, 'Product A', 10000, 'piece', 11310)`;
        await sql`INSERT INTO inventories (id, name, unit_price, unit_of_measurement, account_code) VALUES (2, 'Product B', 20000, 'piece', 11310)`;
        await sql`INSERT INTO inventories (id, name, unit_price, unit_of_measurement, account_code) VALUES (3, 'Product C', 15000, 'unit', 11310)`;
      }),
    ]);

    await page.evaluate(setupView, tursoLibSQLiteServer().url);

    const auditButtons = page.getByRole('button', { name: 'Audit' });
    await expect(auditButtons.first()).toBeVisible();

    // Should have 3 audit buttons (one for each product)
    await expect(auditButtons).toHaveCount(3);
  });

  test('it shall display audit status for inventories never audited', async function ({ page }) {
    await Promise.all([
      loadEmptyFixture(page),
      setupDatabase(tursoLibSQLiteServer(), async function setupData(sql) {
        await sql`INSERT INTO inventories (id, name, unit_price, unit_of_measurement, account_code) VALUES (1, 'Product A', 10000, 'piece', 11310)`;
        await sql`INSERT INTO inventories (id, name, unit_price, unit_of_measurement, account_code) VALUES (2, 'Product B', 20000, 'piece', 11310)`;
        await sql`INSERT INTO inventories (id, name, unit_price, unit_of_measurement, account_code) VALUES (3, 'Product C', 15000, 'unit', 11310)`;
      }),
    ]);

    await page.evaluate(setupView, tursoLibSQLiteServer().url);

    // Verify "Never" audit status is displayed for items without latest_stock_taking_time
    await expect(page.getByText('Never').first()).toBeVisible();
  });

  test('it shall display audit status for recently audited inventories', async function ({ page }) {
    await Promise.all([
      loadEmptyFixture(page),
      setupDatabase(tursoLibSQLiteServer(), async function setupData(sql) {
        const recentTime = Date.now() - (3 * 24 * 60 * 60 * 1000); // 3 days ago
        await sql`INSERT INTO inventories (id, name, unit_price, unit_of_measurement, account_code, latest_stock_taking_time) VALUES (1, 'Product A', 10000, 'piece', 11310, ${recentTime})`;
      }),
    ]);

    await page.evaluate(setupView, tursoLibSQLiteServer().url);

    await expect(page.getByText('Recent')).toBeVisible();
  });

  test('it shall display audit status for overdue inventories', async function ({ page }) {
    await Promise.all([
      loadEmptyFixture(page),
      setupDatabase(tursoLibSQLiteServer(), async function setupData(sql) {
        const overdueTime = Date.now() - (40 * 24 * 60 * 60 * 1000); // 40 days ago
        await sql`INSERT INTO inventories (id, name, unit_price, unit_of_measurement, account_code, latest_stock_taking_time) VALUES (1, 'Product A', 10000, 'piece', 11310, ${overdueTime})`;
      }),
    ]);

    await page.evaluate(setupView, tursoLibSQLiteServer().url);

    await expect(page.getByText('Overdue')).toBeVisible();
  });

  test('it shall filter inventories by search query', async function ({ page }) {
    await Promise.all([
      loadEmptyFixture(page),
      setupDatabase(tursoLibSQLiteServer(), async function setupData(sql) {
        await sql`INSERT INTO inventories (id, name, unit_price, unit_of_measurement, account_code) VALUES (1, 'Product A', 10000, 'piece', 11310)`;
        await sql`INSERT INTO inventories (id, name, unit_price, unit_of_measurement, account_code) VALUES (2, 'Product B', 20000, 'piece', 11310)`;
        await sql`INSERT INTO inventories (id, name, unit_price, unit_of_measurement, account_code) VALUES (3, 'Product C', 15000, 'unit', 11310)`;
      }),
    ]);

    await page.evaluate(setupView, tursoLibSQLiteServer().url);

    await expect(page.getByText('Product A')).toBeVisible();
    await expect(page.getByText('Product B')).toBeVisible();
    await expect(page.getByText('Product C')).toBeVisible();

    await page.getByLabel('Search').fill('Product A');

    await expect(page.getByText('Product A')).toBeVisible();
    await expect(page.getByText('Product B')).not.toBeVisible();
    await expect(page.getByText('Product C')).not.toBeVisible();
  });

  test('it shall display pagination controls when inventories exceed page size', async function ({ page }) {
    // This test is skipped until pagination is fixed in the application
    await Promise.all([
      loadEmptyFixture(page),
      setupDatabase(tursoLibSQLiteServer(), async function setupData(sql) {
        // Create 25 test inventories (page size is 20)
        for (let index = 1; index <= 25; index++) {
          await sql`INSERT INTO inventories (id, name, unit_price, unit_of_measurement, account_code) VALUES (${index}, ${'Product ' + index}, 10000, 'piece', 11310)`;
        }
      }),
    ]);

    await page.evaluate(setupView, tursoLibSQLiteServer().url);

    await expect(page.getByRole('table')).toBeVisible();

    await expect(page.getByRole('navigation', { name: 'Pagination' })).toBeVisible();
    await expect(page.getByText('Showing 1–20 of 25')).toBeVisible();

    // Products are sorted alphabetically, so Product 1, 10-19, 2, 20-24 appear on page 1
    await expect(page.getByText('Product 1', { exact: true })).toBeVisible();
    await expect(page.getByText('Product 2', { exact: true })).toBeVisible();
    await expect(page.getByText('Product 4', { exact: true })).toBeVisible();
    // Product 5 should not be visible on first page (it's on page 2 due to alphabetical order)
    await expect(page.getByText('Product 5', { exact: true })).not.toBeVisible();

    await page.getByRole('button', { name: 'Next page' }).click();

    await expect(page.getByText('Showing 21–25 of 25')).toBeVisible();
    // Products 5-9 appear on page 2 due to alphabetical sorting (25, 3-9)
    await expect(page.getByText('Product 5', { exact: true })).toBeVisible();
    await expect(page.getByText('Product 9', { exact: true })).toBeVisible();

    await expect(page.getByText('Product 1', { exact: true })).not.toBeVisible();
  });

  test('it shall allow navigating to first page', async function ({ page }) {
    await Promise.all([
      loadEmptyFixture(page),
      setupDatabase(tursoLibSQLiteServer(), async function setupData(sql) {
        // Create 25 test inventories
        for (let i = 1; i <= 25; i++) {
          await sql`INSERT INTO inventories (id, name, unit_price, unit_of_measurement, account_code) VALUES (${i}, ${'Product ' + i}, 10000, 'piece', 11310)`;
        }
      }),
    ]);

    await page.evaluate(setupView, tursoLibSQLiteServer().url);

    await expect(page.getByRole('table')).toBeVisible();

    await page.getByRole('button', { name: 'Next page' }).click();
    await expect(page.getByText('Showing 21–25 of 25')).toBeVisible();

    await page.getByRole('button', { name: 'First page' }).click();

    await expect(page.getByText('Showing 1–20 of 25')).toBeVisible();
    await expect(page.getByText('Product 1', { exact: true })).toBeVisible();
  });

  test('it shall refresh inventories list when refresh button is clicked', async function ({ page }) {
    await Promise.all([
      loadEmptyFixture(page),
      setupDatabase(tursoLibSQLiteServer(), async function setupData(sql) {
        await sql`INSERT INTO inventories (id, name, unit_price, unit_of_measurement, account_code) VALUES (1, 'Product A', 10000, 'piece', 11310)`;
        await sql`INSERT INTO inventories (id, name, unit_price, unit_of_measurement, account_code) VALUES (2, 'Product B', 20000, 'piece', 11310)`;
        await sql`INSERT INTO inventories (id, name, unit_price, unit_of_measurement, account_code) VALUES (3, 'Product C', 15000, 'unit', 11310)`;
      }),
    ]);

    await page.evaluate(setupView, tursoLibSQLiteServer().url);

    await expect(page.getByRole('table')).toBeVisible();
    await expect(page.getByText('Product A')).toBeVisible();

    await page.evaluate(async function () {
      /** @type {import('#web/contexts/database-context.js').DatabaseContextElement} */
      const database = document.querySelector('database-context');

      await database.sql`INSERT INTO inventories (id, name, unit_price, unit_of_measurement, account_code) VALUES (4, 'Product D', 25000, 'piece', 11310)`;
    });

    await page.getByRole('button', { name: 'Refresh' }).click();

    await expect(page.getByText('Product D')).toBeVisible();
  });

  test('it shall display cost information for each inventory', async function ({ page }) {
    await Promise.all([
      loadEmptyFixture(page),
      setupDatabase(tursoLibSQLiteServer(), async function setupData(sql) {
        // Insert inventories without cost first, then update the balance and add cost
        await sql`INSERT INTO inventories (id, name, unit_price, unit_of_measurement, account_code) VALUES (1, 'Product A', 10000, 'piece', 11310)`;
        await sql`INSERT INTO inventories (id, name, unit_price, unit_of_measurement, account_code) VALUES (2, 'Product B', 20000, 'piece', 11310)`;
        await sql`INSERT INTO inventories (id, name, unit_price, unit_of_measurement, account_code) VALUES (3, 'Product C', 15000, 'unit', 11310)`;
        // Update account balance and inventory costs together
        await sql`UPDATE accounts SET balance = 22500 WHERE account_code = 11310`;
        await sql`UPDATE inventories SET cost = 5000, stock = 1 WHERE id = 1`;
        await sql`UPDATE inventories SET cost = 10000, stock = 1 WHERE id = 2`;
        await sql`UPDATE inventories SET cost = 7500, stock = 1 WHERE id = 3`;
      }),
    ]);

    await page.evaluate(setupView, tursoLibSQLiteServer().url);

    const inventoriesTable = page.getByRole('table');

    await expect(inventoriesTable.getByText(/5,000/)).toBeVisible();
    await expect(inventoriesTable.getByText(/10,000/)).toBeVisible();
  });

  test('it shall display last audit date when available', async function ({ page }) {
    await Promise.all([
      loadEmptyFixture(page),
      setupDatabase(tursoLibSQLiteServer(), async function setupData(sql) {
        const timestamp = new Date('2025-01-01T10:00:00Z').getTime();
        await sql`INSERT INTO inventories (id, name, unit_price, unit_of_measurement, account_code, latest_stock_taking_time) VALUES (1, 'Product A', 10000, 'piece', 11310, ${timestamp})`;
      }),
    ]);

    await page.evaluate(setupView, tursoLibSQLiteServer().url);

    await expect(page.getByRole('table')).toBeVisible();

    // Check for date text that includes the year 2025 or the specific date
    // The date format could be locale-specific, so we check for a visible date element
    const table = page.getByRole('table');
    await expect(table.getByText('2025', { exact: false }).first()).toBeVisible();
  });
});
