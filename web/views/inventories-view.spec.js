import { test, expect } from '@playwright/test';
import { useTursoLibSQLiteServer } from '#test/hooks/use-turso-libsqlite-server.js';
import { useConsoleOutput } from '#test/hooks/use-console-output.js';
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
              <inventories-view></inventories-view>
            </i18n-context>
          </device-context>
        </database-context>
      </router-context>
    </ready-context>
  `;
}

describe('Inventories View - Basic Display', function () {
  const tursoLibSQLiteServer = useTursoLibSQLiteServer(test);

  test('it shall display empty state when no inventories exist', async function ({ page }) {
    await loadEmptyFixture(page);

    await page.evaluate(setupView, tursoLibSQLiteServer().url);

    await expect(page.getByRole('table', { name: 'Inventories list' })).not.toBeVisible();
    await expect(page.getByText('No inventories found')).toBeVisible();
    await expect(page.getByText('Start by adding your first inventory item to track stock levels.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Add Inventory' }).first()).toBeVisible();
  });

  test('it shall display inventories list when inventories exist', async function ({ page }) {
    await Promise.all([
      loadEmptyFixture(page),
      setupDatabase(tursoLibSQLiteServer(), async function setupData(sql) {
        await sql`INSERT INTO inventories (id, name, unit_price, unit_of_measurement, account_code) VALUES (1, 'Product Alpha', 10000, 'piece', 11310)`;
        await sql`INSERT INTO inventories (id, name, unit_price, unit_of_measurement, account_code) VALUES (2, 'Product Beta', 20000, 'kg', 11310)`;
        await sql`INSERT INTO inventories (id, name, unit_price, unit_of_measurement, account_code) VALUES (3, 'Product Gamma', 15000, 'liter', 11310)`;
      }),
    ]);

    await page.evaluate(setupView, tursoLibSQLiteServer().url);

    await expect(page.getByRole('table', { name: 'Inventories list' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Product Alpha', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Product Beta', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Product Gamma', exact: true })).toBeVisible();
    
    const tableContent = page.getByRole('table', { name: 'Inventories list' });
    await expect(tableContent.getByText('piece')).toBeVisible();
    await expect(tableContent.getByText('kg')).toBeVisible();
    await expect(tableContent.getByText('liter')).toBeVisible();
  });

  test('it shall filter inventories by search query', async function ({ page }) {
    await Promise.all([
      loadEmptyFixture(page),
      setupDatabase(tursoLibSQLiteServer(), async function setupData(sql) {
        await sql`INSERT INTO inventories (id, name, unit_price, unit_of_measurement, account_code) VALUES (1, 'Apple Juice', 10000, 'liter', 11310)`;
        await sql`INSERT INTO inventories (id, name, unit_price, unit_of_measurement, account_code) VALUES (2, 'Orange Juice', 12000, 'liter', 11310)`;
        await sql`INSERT INTO inventories (id, name, unit_price, unit_of_measurement, account_code) VALUES (3, 'Apple Pie', 25000, 'piece', 11310)`;
      }),
    ]);

    await page.evaluate(setupView, tursoLibSQLiteServer().url);

    await expect(page.getByRole('table', { name: 'Inventories list' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Apple Juice', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Orange Juice', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Apple Pie', exact: true })).toBeVisible();

    await page.locator('#inventory-search-input').fill('Apple');

    await expect(page.getByRole('button', { name: 'Apple Juice', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Apple Pie', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Orange Juice', exact: true })).not.toBeVisible();
  });

  test('it shall filter inventories by stock status', async function ({ page }) {
    await Promise.all([
      loadEmptyFixture(page),
      setupDatabase(tursoLibSQLiteServer(), async function setupData(sql) {
        await sql`INSERT INTO inventories (id, name, unit_price, unit_of_measurement, account_code, stock) VALUES (1, 'In Stock Item', 10000, 'piece', 11310, 50)`;
        await sql`INSERT INTO inventories (id, name, unit_price, unit_of_measurement, account_code, stock) VALUES (2, 'Low Stock Item', 20000, 'piece', 11310, 5)`;
        await sql`INSERT INTO inventories (id, name, unit_price, unit_of_measurement, account_code, stock) VALUES (3, 'Out of Stock Item', 30000, 'piece', 11310, 0)`;
      }),
    ]);

    await page.evaluate(setupView, tursoLibSQLiteServer().url);

    await expect(page.getByRole('table', { name: 'Inventories list' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'In Stock Item', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Low Stock Item', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Out of Stock Item', exact: true })).toBeVisible();

    await page.locator('#stock-filter-input').click();
    await page.getByRole('menuitem', { name: 'Out of Stock' }).click();

    await expect(page.getByRole('button', { name: 'Out of Stock Item', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'In Stock Item', exact: true })).not.toBeVisible();
    await expect(page.getByRole('button', { name: 'Low Stock Item', exact: true })).not.toBeVisible();
  });
});

describe('Inventories View - Price Edit Button', function () {
  // useConsoleOutput(test);
  const tursoLibSQLiteServer = useTursoLibSQLiteServer(test);

  test('it shall display edit button beside unit price column', async function ({ page }) {
    await Promise.all([
      loadEmptyFixture(page),
      setupDatabase(tursoLibSQLiteServer(), async function setupData(sql) {
        await sql`INSERT INTO inventories (id, name, unit_price, unit_of_measurement, account_code) VALUES (1, 'Test Product', 10000, 'piece', 11310)`;
      }),
    ]);

    await page.evaluate(setupView, tursoLibSQLiteServer().url);

    await expect(page.getByRole('table', { name: 'Inventories list' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Test Product', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Update unit price for Test Product' })).toBeVisible();
  });

  test('it shall open price update dialog when edit button is clicked', async function ({ page }) {
    await Promise.all([
      loadEmptyFixture(page),
      setupDatabase(tursoLibSQLiteServer(), async function setupData(sql) {
        await sql`INSERT INTO inventories (id, name, unit_price, unit_of_measurement, account_code) VALUES (1, 'Test Product', 10000, 'piece', 11310)`;
      }),
    ]);

    await page.evaluate(setupView, tursoLibSQLiteServer().url);

    await expect(page.getByRole('table', { name: 'Inventories list' })).toBeVisible();

    await page.getByRole('button', { name: 'Update unit price for Test Product' }).click();

    await expect(page.getByRole('dialog', { name: 'Update Unit Price' })).toBeVisible();
    await expect(page.getByRole('dialog', { name: 'Update Unit Price' }).getByText('Test Product')).toBeVisible();
    await expect(page.getByLabel('New Unit Price')).toHaveValue('10000');
  });

  test('it shall update price and refresh table after successful update', async function ({ page }) {
    await Promise.all([
      loadEmptyFixture(page),
      setupDatabase(tursoLibSQLiteServer(), async function setupData(sql) {
        await sql`INSERT INTO inventories (id, name, unit_price, unit_of_measurement, account_code) VALUES (1, 'Test Product', 10000, 'piece', 11310)`;
      }),
    ]);

    await page.evaluate(setupView, tursoLibSQLiteServer().url);

    // Wait for inventory to load
    await expect(page.getByRole('table', { name: 'Inventories list' })).toBeVisible();

    // Verify original price is displayed in table (IDR 10,000 = 10000 in lowest denomination)
    const tableRow = page.getByRole('row').filter({ has: page.getByRole('button', { name: 'Test Product' }) });
    await expect(tableRow).toContainText('IDR 10,000');

    // Click edit button
    await page.getByRole('button', { name: 'Update unit price for Test Product' }).click();

    // Update price in dialog
    await page.getByLabel('New Unit Price').clear();
    await page.getByLabel('New Unit Price').fill('25000');
    await page.getByRole('dialog', { name: 'Update Unit Price' }).getByRole('button', { name: 'Update Price' }).click();

    // Dialog should close
    await expect(page.getByRole('dialog', { name: 'Update Unit Price' })).not.toBeVisible();

    // Table should refresh and show updated price (IDR 25,000 = 25000 in lowest denomination)
    await expect(tableRow).toContainText('IDR 25,000');
  });

  test('it shall show edit button for multiple inventories', async function ({ page }) {
    await Promise.all([
      loadEmptyFixture(page),
      setupDatabase(tursoLibSQLiteServer(), async function setupData(sql) {
        await sql`INSERT INTO inventories (id, name, unit_price, unit_of_measurement, account_code) VALUES (1, 'Product A', 10000, 'piece', 11310)`;
        await sql`INSERT INTO inventories (id, name, unit_price, unit_of_measurement, account_code) VALUES (2, 'Product B', 20000, 'kg', 11310)`;
        await sql`INSERT INTO inventories (id, name, unit_price, unit_of_measurement, account_code) VALUES (3, 'Product C', 30000, 'liter', 11310)`;
      }),
    ]);

    await page.evaluate(setupView, tursoLibSQLiteServer().url);

    // Wait for inventories to load
    await expect(page.getByRole('table', { name: 'Inventories list' })).toBeVisible();

    // Verify edit buttons exist for all inventories
    await expect(page.getByRole('button', { name: 'Update unit price for Product A' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Update unit price for Product B' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Update unit price for Product C' })).toBeVisible();

    // Click edit button for Product B
    await page.getByRole('button', { name: 'Update unit price for Product B' }).click();

    // Verify correct product is shown in dialog
    await expect(page.getByRole('dialog', { name: 'Update Unit Price' })).toBeVisible();
    await expect(page.getByRole('dialog', { name: 'Update Unit Price' }).getByText('Product B')).toBeVisible();
    await expect(page.getByLabel('New Unit Price')).toHaveValue('20000');
  });
});
