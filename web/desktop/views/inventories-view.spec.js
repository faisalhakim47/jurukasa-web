import { expect } from '@playwright/test';
import { jurukasaTest } from '#test/playwright/test-setup.js';
import { useTursoLibSQLiteServer } from '#test/playwright/hooks/use-turso-libsqlite-server.js';
import { useConsoleOutput } from '#test/playwright/hooks/use-console-output.js';
import { loadEmptyFixture } from '#test/playwright/tools/fixture.js';
import { setupDatabase } from '#test/playwright/tools/database.js';
import { useStrict } from '#test/playwright/hooks/use-strict.js';

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
              <inventories-view></inventories-view>
            </i18n-context>
          </device-context>
        </database-context>
      </router-context>
    </ready-context>
  `;
}

describe('Inventories View', function () {
  useConsoleOutput(test);
  useStrict(test);
  const tursoLibSQLiteServer = useTursoLibSQLiteServer(test);

  test('displays empty state with add inventory option when no inventories exist', async function ({ page }) {
    await loadEmptyFixture(page);
    await page.evaluate(setupView, tursoLibSQLiteServer().url);

    await expect(page.getByRole('table', { name: 'Inventories list' }), 'it shall hide inventories table when empty').not.toBeVisible();
    await expect(page.getByText('No inventories found'), 'it shall display empty state heading').toBeVisible();
    await expect(page.getByText('Start by adding your first inventory item to track stock levels.'), 'it shall display empty state description').toBeVisible();
    await expect(page.getByRole('button', { name: 'Add Inventory' }).first(), 'it shall display add inventory button in empty state').toBeVisible();
  });

  test('displays inventories list with product details when inventories exist', async function ({ page }) {
    await Promise.all([
      loadEmptyFixture(page),
      setupDatabase(tursoLibSQLiteServer(), async function setupData(sql) {
        await sql`INSERT INTO inventories (id, name, unit_price, unit_of_measurement, account_code) VALUES (1, 'Product Alpha', 10000, 'piece', 11310)`;
        await sql`INSERT INTO inventories (id, name, unit_price, unit_of_measurement, account_code) VALUES (2, 'Product Beta', 20000, 'kg', 11310)`;
        await sql`INSERT INTO inventories (id, name, unit_price, unit_of_measurement, account_code) VALUES (3, 'Product Gamma', 15000, 'liter', 11310)`;
      }),
    ]);

    await page.evaluate(setupView, tursoLibSQLiteServer().url);

    await expect(page.getByRole('table', { name: 'Inventories list' }), 'it shall display inventories table').toBeVisible();
    await expect(page.getByRole('button', { name: 'Product Alpha', exact: true }), 'it shall display Product Alpha button').toBeVisible();
    await expect(page.getByRole('button', { name: 'Product Beta', exact: true }), 'it shall display Product Beta button').toBeVisible();
    await expect(page.getByRole('button', { name: 'Product Gamma', exact: true }), 'it shall display Product Gamma button').toBeVisible();

    const tableContent = page.getByRole('table', { name: 'Inventories list' });
    await expect(tableContent.getByText('piece'), 'it shall display piece unit of measurement').toBeVisible();
    await expect(tableContent.getByText('kg'), 'it shall display kg unit of measurement').toBeVisible();
    await expect(tableContent.getByText('liter'), 'it shall display liter unit of measurement').toBeVisible();
  });

  test('filters inventories by search query', async function ({ page }) {
    await Promise.all([
      loadEmptyFixture(page),
      setupDatabase(tursoLibSQLiteServer(), async function setupData(sql) {
        await sql`INSERT INTO inventories (id, name, unit_price, unit_of_measurement, account_code) VALUES (1, 'Apple Juice', 10000, 'liter', 11310)`;
        await sql`INSERT INTO inventories (id, name, unit_price, unit_of_measurement, account_code) VALUES (2, 'Orange Juice', 12000, 'liter', 11310)`;
        await sql`INSERT INTO inventories (id, name, unit_price, unit_of_measurement, account_code) VALUES (3, 'Apple Pie', 25000, 'piece', 11310)`;
      }),
    ]);

    await page.evaluate(setupView, tursoLibSQLiteServer().url);

    await expect(page.getByRole('table', { name: 'Inventories list' }), 'it shall display inventories table').toBeVisible();
    await expect(page.getByRole('button', { name: 'Apple Juice', exact: true }), 'it shall display Apple Juice initially').toBeVisible();
    await expect(page.getByRole('button', { name: 'Orange Juice', exact: true }), 'it shall display Orange Juice initially').toBeVisible();
    await expect(page.getByRole('button', { name: 'Apple Pie', exact: true }), 'it shall display Apple Pie initially').toBeVisible();

    await page.getByRole('textbox', { name: 'Search' }).fill('Apple');

    await expect(page.getByRole('button', { name: 'Apple Juice', exact: true }), 'it shall keep Apple Juice visible after filter').toBeVisible();
    await expect(page.getByRole('button', { name: 'Apple Pie', exact: true }), 'it shall keep Apple Pie visible after filter').toBeVisible();
    await expect(page.getByRole('button', { name: 'Orange Juice', exact: true }), 'it shall hide Orange Juice after Apple filter').not.toBeVisible();
  });

  test('filters inventories by stock status selection', async function ({ page }) {
    await Promise.all([
      loadEmptyFixture(page),
      setupDatabase(tursoLibSQLiteServer(), async function setupData(sql) {
        await sql`INSERT INTO inventories (id, name, unit_price, unit_of_measurement, account_code, stock) VALUES (1, 'In Stock Item', 10000, 'piece', 11310, 50)`;
        await sql`INSERT INTO inventories (id, name, unit_price, unit_of_measurement, account_code, stock) VALUES (2, 'Low Stock Item', 20000, 'piece', 11310, 5)`;
        await sql`INSERT INTO inventories (id, name, unit_price, unit_of_measurement, account_code, stock) VALUES (3, 'Out of Stock Item', 30000, 'piece', 11310, 0)`;
      }),
    ]);

    await page.evaluate(setupView, tursoLibSQLiteServer().url);

    await expect(page.getByRole('table', { name: 'Inventories list' }), 'it shall display inventories table').toBeVisible();
    await expect(page.getByRole('button', { name: 'In Stock Item', exact: true }), 'it shall display In Stock Item initially').toBeVisible();
    await expect(page.getByRole('button', { name: 'Low Stock Item', exact: true }), 'it shall display Low Stock Item initially').toBeVisible();
    await expect(page.getByRole('button', { name: 'Out of Stock Item', exact: true }), 'it shall display Out of Stock Item initially').toBeVisible();

    await page.getByRole('button', { name: 'All' }).click();
    await page.getByRole('menuitem', { name: 'Out of Stock' }).click();

    await expect(page.getByRole('button', { name: 'Out of Stock Item', exact: true }), 'it shall keep Out of Stock Item visible after filter').toBeVisible();
    await expect(page.getByRole('button', { name: 'In Stock Item', exact: true }), 'it shall hide In Stock Item after Out of Stock filter').not.toBeVisible();
    await expect(page.getByRole('button', { name: 'Low Stock Item', exact: true }), 'it shall hide Low Stock Item after Out of Stock filter').not.toBeVisible();
  });

  test('displays edit price button and opens update dialog with current price', async function ({ page }) {
    await Promise.all([
      loadEmptyFixture(page),
      setupDatabase(tursoLibSQLiteServer(), async function setupData(sql) {
        await sql`INSERT INTO inventories (id, name, unit_price, unit_of_measurement, account_code) VALUES (1, 'Test Product', 10000, 'piece', 11310)`;
      }),
    ]);

    await page.evaluate(setupView, tursoLibSQLiteServer().url);

    await expect(page.getByRole('table', { name: 'Inventories list' }), 'it shall display inventories table').toBeVisible();
    await expect(page.getByRole('button', { name: 'Test Product', exact: true }), 'it shall display Test Product button').toBeVisible();
    await expect(page.getByRole('button', { name: 'Update unit price for Test Product' }), 'it shall display update price button for Test Product').toBeVisible();

    await page.getByRole('button', { name: 'Update unit price for Test Product' }).click();

    await expect(page.getByRole('dialog', { name: 'Update Unit Price' }), 'it shall display update unit price dialog').toBeVisible();
    await expect(page.getByRole('dialog', { name: 'Update Unit Price' }).getByText('Test Product'), 'it shall display product name in dialog').toBeVisible();
    await expect(page.getByLabel('New Unit Price'), 'it shall display new unit price input with current value').toHaveValue('10000');
  });

  test('updates unit price and reflects change in inventory list', async function ({ page }) {
    await Promise.all([
      loadEmptyFixture(page),
      setupDatabase(tursoLibSQLiteServer(), async function setupData(sql) {
        await sql`INSERT INTO inventories (id, name, unit_price, unit_of_measurement, account_code) VALUES (1, 'Test Product', 10000, 'piece', 11310)`;
      }),
    ]);

    await page.evaluate(setupView, tursoLibSQLiteServer().url);

    await expect(page.getByRole('table', { name: 'Inventories list' }), 'it shall display inventories table').toBeVisible();

    const tableRow = page.getByRole('row').filter({ has: page.getByRole('button', { name: 'Test Product' }) });
    await expect(tableRow, 'it shall display initial price IDR 10,000 in row').toContainText('IDR 10,000');

    await page.getByRole('button', { name: 'Update unit price for Test Product' }).click();

    await page.getByLabel('New Unit Price').clear();
    await page.getByLabel('New Unit Price').fill('25000');
    await page.getByRole('dialog', { name: 'Update Unit Price' }).getByRole('button', { name: 'Update Price' }).click();

    await expect(page.getByRole('dialog', { name: 'Update Unit Price' }), 'it shall close dialog after successful update').not.toBeVisible();
    await expect(tableRow, 'it shall display updated price IDR 25,000 in row').toContainText('IDR 25,000');
  });

  test('displays edit price buttons for multiple inventories and opens correct dialog', async function ({ page }) {
    await Promise.all([
      loadEmptyFixture(page),
      setupDatabase(tursoLibSQLiteServer(), async function setupData(sql) {
        await sql`INSERT INTO inventories (id, name, unit_price, unit_of_measurement, account_code) VALUES (1, 'Product A', 10000, 'piece', 11310)`;
        await sql`INSERT INTO inventories (id, name, unit_price, unit_of_measurement, account_code) VALUES (2, 'Product B', 20000, 'kg', 11310)`;
        await sql`INSERT INTO inventories (id, name, unit_price, unit_of_measurement, account_code) VALUES (3, 'Product C', 30000, 'liter', 11310)`;
      }),
    ]);

    await page.evaluate(setupView, tursoLibSQLiteServer().url);

    await expect(page.getByRole('table', { name: 'Inventories list' }), 'it shall display inventories table').toBeVisible();
    await expect(page.getByRole('button', { name: 'Update unit price for Product A' }), 'it shall display update price button for Product A').toBeVisible();
    await expect(page.getByRole('button', { name: 'Update unit price for Product B' }), 'it shall display update price button for Product B').toBeVisible();
    await expect(page.getByRole('button', { name: 'Update unit price for Product C' }), 'it shall display update price button for Product C').toBeVisible();

    await page.getByRole('button', { name: 'Update unit price for Product B' }).click();

    await expect(page.getByRole('dialog', { name: 'Update Unit Price' }), 'it shall display update unit price dialog').toBeVisible();
    await expect(page.getByRole('dialog', { name: 'Update Unit Price' }).getByText('Product B'), 'it shall display Product B name in dialog').toBeVisible();
    await expect(page.getByLabel('New Unit Price'), 'it shall display new unit price input with Product B value').toHaveValue('20000');
  });
});
