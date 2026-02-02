import { expect } from '@playwright/test';
import { jurukasaTest } from '#test/playwright/test-setup.js';
import { useTursoLibSQLiteServer } from '#test/playwright/hooks/use-turso-libsqlite-server.js';
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
              <suppliers-view></suppliers-view>
            </i18n-context>
          </device-context>
        </database-context>
      </router-context>
    </ready-context>
  `;
}

describe('Suppliers View', function () {
  useStrict(test);
  const tursoLibSQLiteServer = useTursoLibSQLiteServer(test);

  test('displays empty state with add supplier option when no suppliers exist', async function ({ page }) {
    await loadEmptyFixture(page);
    await page.evaluate(setupView, tursoLibSQLiteServer().url);

    await expect(page.getByRole('table', { name: 'Suppliers list' }), 'it shall hide suppliers table when empty').not.toBeVisible();
    await expect(page.getByText('No Suppliers Found'), 'it shall display empty state heading').toBeVisible();
    await expect(page.getByText('Start by adding your first supplier'), 'it shall display empty state description').toBeVisible();
    await expect(page.getByRole('button', { name: 'Add Supplier' }).first(), 'it shall display add supplier button in empty state').toBeVisible();
  });

  test('displays suppliers list with names and phone numbers when suppliers exist', async function ({ page }) {
    await Promise.all([
      loadEmptyFixture(page),
      setupDatabase(tursoLibSQLiteServer(), async function setupData(sql) {
        await sql`INSERT INTO suppliers (id, name, phone_number) VALUES (1, 'Supplier A', '081234567890')`;
        await sql`INSERT INTO suppliers (id, name, phone_number) VALUES (2, 'Supplier B', '082345678901')`;
        await sql`INSERT INTO suppliers (id, name, phone_number) VALUES (3, 'Supplier C', NULL)`;
      }),
    ]);

    await page.evaluate(setupView, tursoLibSQLiteServer().url);

    await expect(page.getByRole('table', { name: 'Suppliers list' }), 'it shall display suppliers table').toBeVisible();
    await expect(page.getByRole('button', { name: 'Supplier A', exact: true }), 'it shall display Supplier A button').toBeVisible();
    await expect(page.getByRole('button', { name: 'Supplier B', exact: true }), 'it shall display Supplier B button').toBeVisible();
    await expect(page.getByRole('button', { name: 'Supplier C', exact: true }), 'it shall display Supplier C button').toBeVisible();

    const tableContent = page.getByRole('table', { name: 'Suppliers list' });
    await expect(tableContent.getByText('081234567890'), 'it shall display Supplier A phone number').toBeVisible();
    await expect(tableContent.getByText('082345678901'), 'it shall display Supplier B phone number').toBeVisible();
  });

  test('filters suppliers by search query and clears to restore full list', async function ({ page }) {
    await Promise.all([
      loadEmptyFixture(page),
      setupDatabase(tursoLibSQLiteServer(), async function setupData(sql) {
        await sql`INSERT INTO suppliers (id, name, phone_number) VALUES (1, 'ABC Supplier', '081234567890')`;
        await sql`INSERT INTO suppliers (id, name, phone_number) VALUES (2, 'XYZ Trading', '082345678901')`;
        await sql`INSERT INTO suppliers (id, name, phone_number) VALUES (3, 'ABC Corporation', '083456789012')`;
      }),
    ]);

    await page.evaluate(setupView, tursoLibSQLiteServer().url);

    await expect(page.getByRole('table', { name: 'Suppliers list' }), 'it shall display suppliers table').toBeVisible();
    await expect(page.getByRole('button', { name: 'ABC Supplier', exact: true }), 'it shall display ABC Supplier initially').toBeVisible();
    await expect(page.getByRole('button', { name: 'XYZ Trading', exact: true }), 'it shall display XYZ Trading initially').toBeVisible();

    await page.getByLabel('Search').fill('ABC');

    await expect(page.getByRole('button', { name: 'ABC Supplier', exact: true }), 'it shall keep ABC Supplier visible after filter').toBeVisible();
    await expect(page.getByRole('button', { name: 'ABC Corporation', exact: true }), 'it shall display ABC Corporation after filter').toBeVisible();
    await expect(page.getByRole('button', { name: 'XYZ Trading', exact: true }), 'it shall hide XYZ Trading after ABC filter').not.toBeVisible();

    await page.getByLabel('Search').clear();

    await expect(page.getByRole('button', { name: 'ABC Supplier', exact: true }), 'it shall restore ABC Supplier after clear').toBeVisible();
    await expect(page.getByRole('button', { name: 'XYZ Trading', exact: true }), 'it shall restore XYZ Trading after clear').toBeVisible();
  });

  test('paginates through supplier list when items exceed page size', async function ({ page }) {
    await Promise.all([
      loadEmptyFixture(page),
      setupDatabase(tursoLibSQLiteServer(), async function setupData(sql) {
        for (let index = 1; index <= 25; index++) {
          await sql`INSERT INTO suppliers (id, name, phone_number) VALUES (${index}, ${`Supplier ${String(index).padStart(2, '0')}`}, NULL)`;
        }
      }),
    ]);

    await page.evaluate(setupView, tursoLibSQLiteServer().url);

    await expect(page.getByRole('table', { name: 'Suppliers list' }), 'it shall display suppliers table').toBeVisible();
    await expect(page.getByRole('navigation', { name: 'Pagination' }), 'it shall display pagination controls').toBeVisible();
    await expect(page.getByText('Showing 1–20 of 25'), 'it shall display first page range indicator').toBeVisible();
    await expect(page.getByRole('button', { name: 'Supplier 01', exact: true }), 'it shall display Supplier 01 on first page').toBeVisible();
    await expect(page.getByRole('button', { name: 'Supplier 20', exact: true }), 'it shall display Supplier 20 on first page').toBeVisible();
    await expect(page.getByRole('button', { name: 'Supplier 25', exact: true }), 'it shall hide Supplier 25 on first page').not.toBeVisible();

    await page.getByRole('button', { name: 'Next page' }).click();

    await expect(page.getByText('Showing 21–25 of 25'), 'it shall display second page range indicator').toBeVisible();
    await expect(page.getByRole('button', { name: 'Supplier 21', exact: true }), 'it shall display Supplier 21 on second page').toBeVisible();
    await expect(page.getByRole('button', { name: 'Supplier 25', exact: true }), 'it shall display Supplier 25 on second page').toBeVisible();
    await expect(page.getByRole('button', { name: 'Supplier 01', exact: true }), 'it shall hide Supplier 01 on second page').not.toBeVisible();
  });

  test('opens supplier creation dialog when add button is clicked', async function ({ page }) {
    await loadEmptyFixture(page);
    await page.evaluate(setupView, tursoLibSQLiteServer().url);

    await expect(page.getByText('No Suppliers Found'), 'it shall display empty state initially').toBeVisible();
    await page.getByRole('button', { name: 'Add Supplier' }).first().click();

    await expect(page.getByRole('dialog', { name: 'Add Supplier' }), 'it shall display add supplier dialog').toBeVisible();
  });

  test('displays supplier inventory and purchase counts in list', async function ({ page }) {
    await Promise.all([
      loadEmptyFixture(page),
      setupDatabase(tursoLibSQLiteServer(), async function setupData(sql) {
        await sql`INSERT INTO suppliers (id, name, phone_number) VALUES (1, 'Test Supplier', NULL)`;
        await sql`INSERT INTO inventories (id, name, unit_price, unit_of_measurement, account_code) VALUES (1, 'Product A', 10000, 'piece', 11310)`;
        await sql`INSERT INTO inventories (id, name, unit_price, unit_of_measurement, account_code) VALUES (2, 'Product B', 20000, 'piece', 11310)`;
        await sql`INSERT INTO supplier_inventories (supplier_id, inventory_id) VALUES (1, 1)`;
        await sql`INSERT INTO supplier_inventories (supplier_id, inventory_id) VALUES (1, 2)`;
        await sql`INSERT INTO purchases (id, supplier_id, purchase_time) VALUES (1, 1, 0)`;
        await sql`INSERT INTO purchases (id, supplier_id, purchase_time) VALUES (2, 1, 1000)`;
        await sql`INSERT INTO purchases (id, supplier_id, purchase_time) VALUES (3, 1, 2000)`;
      }),
    ]);

    await page.evaluate(setupView, tursoLibSQLiteServer().url);

    await expect(page.getByRole('table', { name: 'Suppliers list' }), 'it shall display suppliers table').toBeVisible();

    const supplierRow = page.getByRole('row').filter({ has: page.getByRole('button', { name: 'Test Supplier' }) });
    await expect(supplierRow.locator('span').filter({ hasText: /^2$/ }).first(), 'it shall display inventory count badge as 2').toBeVisible();
    await expect(supplierRow.locator('span').filter({ hasText: /^3$/ }).last(), 'it shall display purchase count badge as 3').toBeVisible();
  });

  test('creates new supplier and refreshes list to show the added supplier', async function ({ page }) {
    await loadEmptyFixture(page);
    await page.evaluate(setupView, tursoLibSQLiteServer().url);

    await expect(page.getByText('No Suppliers Found'), 'it shall display empty state initially').toBeVisible();
    await page.getByRole('button', { name: 'Add Supplier' }).first().click();
    await expect(page.getByRole('dialog', { name: 'Add Supplier' }), 'it shall display add supplier dialog').toBeVisible();

    await page.getByLabel('Supplier Name').fill('New Supplier');
    await page.getByLabel('Phone Number').fill('081234567890');
    await page.getByRole('dialog', { name: 'Add Supplier' }).getByRole('button', { name: 'Add' }).click();

    await expect(page.getByRole('dialog', { name: 'Add Supplier' }), 'it shall close dialog after submission').not.toBeVisible();
    await expect(page.getByRole('table', { name: 'Suppliers list' }), 'it shall display suppliers table after creation').toBeVisible();
    await expect(page.getByRole('button', { name: 'New Supplier', exact: true }), 'it shall display newly created supplier in list').toBeVisible();
  });
});
