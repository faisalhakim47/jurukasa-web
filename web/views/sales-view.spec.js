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
              <time-context></time-context>
            </i18n-context>
          </device-context>
        </database-context>
      </router-context>
    </ready-context>
  `;

  const deepestContext = document.querySelector('time-context');
  deepestContext.innerHTML = '<sales-view></sales-view>';
}

/** @param {(query: TemplateStringsArray, ...params: unknown[]) => Promise<unknown>} sql */
async function setupSaleInventory(sql) {
  await sql`INSERT INTO inventories (id, name, unit_price, unit_of_measurement, account_code) VALUES (1, 'Test Product', 10000, 'piece', 11310)`;
}

/** @param {(query: TemplateStringsArray, ...params: unknown[]) => Promise<unknown>} sql */
async function setupCashPaymentMethod(sql) {
  await sql`INSERT INTO payment_methods (id, name, min_fee, max_fee, rel_fee, account_code) VALUES (1, 'Cash', 0, 0, 0, 11110)`;
}

/**
 * @param {(query: TemplateStringsArray, ...params: unknown[]) => Promise<unknown>} sql
 * @param {number} saleId
 * @param {string | null} customerName
 * @param {number} saleTime
 * @param {number} journalEntryRef
 */
async function createPostedSale(sql, saleId, customerName, saleTime, journalEntryRef) {
  await sql`INSERT INTO sales (id, customer_name, sale_time) VALUES (${saleId}, ${customerName}, ${saleTime})`;
  await sql`INSERT INTO sale_lines (sale_id, line_number, inventory_id, quantity, price, cost) VALUES (${saleId}, 1, 1, 1, 10000, 0)`;
  await sql`INSERT INTO sale_payments (sale_id, line_number, payment_method_id, amount) VALUES (${saleId}, 1, 1, 10000)`;
  await sql`UPDATE sales SET journal_entry_ref = ${journalEntryRef}, post_time = ${saleTime + 1} WHERE id = ${saleId}`;
}

describe('Sales View', function () {
  useStrict(test);
  const tursoLibSQLiteServer = useTursoLibSQLiteServer(test);

  test('view empty state when no sales exist', async function ({ page }) {
    await loadEmptyFixture(page);
    await page.evaluate(setupView, tursoLibSQLiteServer().url);

    await expect(page.getByRole('table', { name: 'Sales list' }), 'it shall not display sales table when no sales exist').not.toBeVisible();
    await expect(page.getByText('No sales found'), 'it shall display empty state message').toBeVisible();
    await expect(page.getByRole('button', { name: 'Go to Point-of-Sale' }), 'it shall display call-to-action button in empty state').toBeVisible();
  });

  test('view sales list with multiple sales records', async function ({ page }) {
    await Promise.all([
      loadEmptyFixture(page),
      setupDatabase(tursoLibSQLiteServer(), async function setupData(sql) {
        await setupSaleInventory(sql);
        await sql`INSERT INTO sales (id, customer_name, sale_time) VALUES (1, 'Customer A', 1000000)`;
        await sql`INSERT INTO sales (id, customer_name, sale_time) VALUES (2, 'Customer B', 2000000)`;
        await sql`INSERT INTO sales (id, customer_name, sale_time) VALUES (3, NULL, 3000000)`;
        await sql`INSERT INTO sale_lines (sale_id, line_number, inventory_id, quantity, price, cost) VALUES (1, 1, 1, 2, 20000, 0)`;
        await sql`INSERT INTO sale_lines (sale_id, line_number, inventory_id, quantity, price, cost) VALUES (2, 1, 1, 1, 10000, 0)`;
        await sql`INSERT INTO sale_lines (sale_id, line_number, inventory_id, quantity, price, cost) VALUES (3, 1, 1, 3, 30000, 0)`;
      }),
    ]);

    await page.evaluate(setupView, tursoLibSQLiteServer().url);

    await expect(page.getByRole('table', { name: 'Sales list' }), 'it shall display sales table').toBeVisible();
    await expect(page.getByRole('button', { name: '#1' }), 'it shall display sale #1').toBeVisible();
    await expect(page.getByRole('button', { name: '#2' }), 'it shall display sale #2').toBeVisible();
    await expect(page.getByRole('button', { name: '#3' }), 'it shall display sale #3').toBeVisible();
  });

  test('search sales by customer name', async function ({ page }) {
    await Promise.all([
      loadEmptyFixture(page),
      setupDatabase(tursoLibSQLiteServer(), async function setupData(sql) {
        await setupSaleInventory(sql);
        await sql`INSERT INTO sales (id, customer_name, sale_time) VALUES (1, 'Alice Smith', 1000000)`;
        await sql`INSERT INTO sales (id, customer_name, sale_time) VALUES (2, 'Bob Jones', 2000000)`;
        await sql`INSERT INTO sales (id, customer_name, sale_time) VALUES (3, 'Alice Johnson', 3000000)`;
        await sql`INSERT INTO sale_lines (sale_id, line_number, inventory_id, quantity, price, cost) VALUES (1, 1, 1, 1, 10000, 0)`;
        await sql`INSERT INTO sale_lines (sale_id, line_number, inventory_id, quantity, price, cost) VALUES (2, 1, 1, 1, 10000, 0)`;
        await sql`INSERT INTO sale_lines (sale_id, line_number, inventory_id, quantity, price, cost) VALUES (3, 1, 1, 1, 10000, 0)`;
      }),
    ]);

    await page.evaluate(setupView, tursoLibSQLiteServer().url);

    await expect(page.getByRole('table', { name: 'Sales list' }), 'it shall display sales table').toBeVisible();
    await expect(page.getByRole('button', { name: '#1' }), 'it shall display sale #1 initially').toBeVisible();
    await expect(page.getByRole('button', { name: '#2' }), 'it shall display sale #2 initially').toBeVisible();

    await page.getByLabel('Search').fill('Alice');

    await expect(page.getByRole('button', { name: '#1' }), 'it shall display sale #1 matching Alice').toBeVisible();
    await expect(page.getByRole('button', { name: '#3' }), 'it shall display sale #3 matching Alice').toBeVisible();
    await expect(page.getByRole('button', { name: '#2' }), 'it shall hide sale #2 not matching Alice').not.toBeVisible();

    await page.getByLabel('Search').clear();

    await expect(page.getByRole('button', { name: '#1' }), 'it shall display sale #1 after clearing search').toBeVisible();
    await expect(page.getByRole('button', { name: '#2' }), 'it shall display sale #2 after clearing search').toBeVisible();
  });

  test('filter sales by status', async function ({ page }) {
    await Promise.all([
      loadEmptyFixture(page),
      setupDatabase(tursoLibSQLiteServer(), async function setupData(sql) {
        await setupSaleInventory(sql);
        await setupCashPaymentMethod(sql);
        await createPostedSale(sql, 1, 'Customer A', 1000000, 9101);
        await sql`INSERT INTO sales (id, customer_name, sale_time) VALUES (2, 'Customer B', 2000000)`;
        await sql`INSERT INTO sale_lines (sale_id, line_number, inventory_id, quantity, price, cost) VALUES (2, 1, 1, 1, 10000, 0)`;
        await createPostedSale(sql, 3, 'Customer C', 3000000, 9103);
      }),
    ]);

    await page.evaluate(setupView, tursoLibSQLiteServer().url);

    await expect(page.getByRole('table', { name: 'Sales list' }), 'it shall display sales table').toBeVisible();

    await page.getByLabel('Status', { exact: true }).click();
    await page.getByRole('menuitem').filter({ hasText: 'Posted' }).click();

    await expect(page.getByRole('button', { name: '#1' }), 'it shall display posted sale #1').toBeVisible();
    await expect(page.getByRole('button', { name: '#3' }), 'it shall display posted sale #3').toBeVisible();
    await expect(page.getByRole('button', { name: '#2' }), 'it shall hide draft sale #2 when Posted filter is active').not.toBeVisible();

    await page.getByLabel('Status', { exact: true }).click();
    await page.getByRole('menuitem').filter({ hasText: 'Draft' }).click();

    await expect(page.getByRole('button', { name: '#2' }), 'it shall display draft sale #2').toBeVisible();
    await expect(page.getByRole('button', { name: '#1' }), 'it shall hide posted sale #1 when Draft filter is active').not.toBeVisible();
    await expect(page.getByRole('button', { name: '#3' }), 'it shall hide posted sale #3 when Draft filter is active').not.toBeVisible();
  });

  test('navigate through paginated sales list', async function ({ page }) {
    await Promise.all([
      loadEmptyFixture(page),
      setupDatabase(tursoLibSQLiteServer(), async function setupData(sql) {
        await setupSaleInventory(sql);
        for (let i = 1; i <= 15; i++) {
          await sql`INSERT INTO sales (id, customer_name, sale_time) VALUES (${i}, ${`Customer ${i}`}, ${1000000 + i * 1000})`;
          await sql`INSERT INTO sale_lines (sale_id, line_number, inventory_id, quantity, price, cost) VALUES (${i}, 1, 1, 1, 10000, 0)`;
        }
      }),
    ]);

    await page.evaluate(setupView, tursoLibSQLiteServer().url);

    await expect(page.getByRole('table', { name: 'Sales list' }), 'it shall display sales table').toBeVisible();
    await expect(page.getByRole('navigation', { name: 'Pagination' }), 'it shall display pagination controls').toBeVisible();
    await expect(page.getByText('Showing 1–10 of 15'), 'it shall display first page range').toBeVisible();
    await expect(page.getByRole('button', { name: '#15', exact: true }), 'it shall display newest sale #15 on first page').toBeVisible();
    await expect(page.getByRole('button', { name: '#6', exact: true }), 'it shall display sale #6 on first page').toBeVisible();
    await expect(page.getByRole('button', { name: '#1', exact: true }), 'it shall not display oldest sale #1 on first page').not.toBeVisible();

    await page.getByRole('button', { name: 'Next page' }).click();

    await expect(page.getByText('Showing 11–15 of 15'), 'it shall display second page range').toBeVisible();
    await expect(page.getByRole('button', { name: '#5', exact: true }), 'it shall display sale #5 on second page').toBeVisible();
    await expect(page.getByRole('button', { name: '#1', exact: true }), 'it shall display oldest sale #1 on second page').toBeVisible();
    await expect(page.getByRole('button', { name: '#15', exact: true }), 'it shall not display newest sale #15 on second page').not.toBeVisible();

    await page.getByRole('button', { name: 'Previous page' }).click();
    await expect(page.getByRole('button', { name: '#15', exact: true }), 'it shall display newest sale #15 after navigating back').toBeVisible();

    await page.getByRole('button', { name: 'Last page' }).click();
    await expect(page.getByRole('button', { name: '#1', exact: true }), 'it shall display oldest sale #1 on last page').toBeVisible();

    await page.getByRole('button', { name: 'First page' }).click();
    await expect(page.getByRole('button', { name: '#15', exact: true }), 'it shall display newest sale #15 on first page').toBeVisible();
  });

  test('open sale details dialog and access toolbar actions', async function ({ page }) {
    await Promise.all([
      loadEmptyFixture(page),
      setupDatabase(tursoLibSQLiteServer(), async function setupData(sql) {
        await setupSaleInventory(sql);
        await sql`INSERT INTO sales (id, customer_name, sale_time) VALUES (1, 'Test Customer', 1000000)`;
        await sql`INSERT INTO sale_lines (sale_id, line_number, inventory_id, quantity, price, cost) VALUES (1, 1, 1, 1, 10000, 0)`;
      }),
    ]);

    await page.evaluate(setupView, tursoLibSQLiteServer().url);

    await expect(page.getByRole('table', { name: 'Sales list' }), 'it shall display sales table').toBeVisible();
    await expect(page.getByRole('button', { name: 'Refresh' }), 'it shall display Refresh button').toBeVisible();
    await expect(page.getByRole('button', { name: 'Point-of-Sale' }).first(), 'it shall display Point-of-Sale button').toBeVisible();

    await page.getByRole('button', { name: '#1' }).click();

    await expect(page.getByRole('dialog', { name: 'Sale #1' }), 'it shall display sale details dialog').toBeVisible();
  });
});
