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

  test('it shall display empty state when no suppliers exist', async function ({ page }) {
    await loadEmptyFixture(page);

    await page.evaluate(setupView, tursoLibSQLiteServer().url);

    // Wait for loading to complete
    await expect(page.getByRole('table', { name: 'Suppliers list' })).not.toBeVisible();
    await expect(page.getByText('No Suppliers Found')).toBeVisible();
    await expect(page.getByText('Start by adding your first supplier')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Add Supplier' }).first()).toBeVisible();
  });

  test('it shall display suppliers list when suppliers exist', async function ({ page }) {
    await Promise.all([
      loadEmptyFixture(page),
      setupDatabase(tursoLibSQLiteServer(), async function setupData(sql) {
        await sql`INSERT INTO suppliers (id, name, phone_number) VALUES (1, 'Supplier A', '081234567890')`;
        await sql`INSERT INTO suppliers (id, name, phone_number) VALUES (2, 'Supplier B', '082345678901')`;
        await sql`INSERT INTO suppliers (id, name, phone_number) VALUES (3, 'Supplier C', NULL)`;
      }),
    ]);

    await page.evaluate(setupView, tursoLibSQLiteServer().url);

    // Wait for suppliers table to load
    await expect(page.getByRole('table', { name: 'Suppliers list' })).toBeVisible();
    
    // Verify suppliers are displayed
    await expect(page.getByRole('button', { name: 'Supplier A', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Supplier B', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Supplier C', exact: true })).toBeVisible();
    
    // Verify phone numbers are displayed
    const tableContent = page.getByRole('table', { name: 'Suppliers list' });
    await expect(tableContent.getByText('081234567890')).toBeVisible();
    await expect(tableContent.getByText('082345678901')).toBeVisible();
  });

  test('it shall filter suppliers by search query', async function ({ page }) {
    await Promise.all([
      loadEmptyFixture(page),
      setupDatabase(tursoLibSQLiteServer(), async function setupData(sql) {
        await sql`INSERT INTO suppliers (id, name, phone_number) VALUES (1, 'ABC Supplier', '081234567890')`;
        await sql`INSERT INTO suppliers (id, name, phone_number) VALUES (2, 'XYZ Trading', '082345678901')`;
        await sql`INSERT INTO suppliers (id, name, phone_number) VALUES (3, 'ABC Corporation', '083456789012')`;
      }),
    ]);

    await page.evaluate(setupView, tursoLibSQLiteServer().url);

    // Wait for initial load
    await expect(page.getByRole('table', { name: 'Suppliers list' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'ABC Supplier', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'XYZ Trading', exact: true })).toBeVisible();

    // Search for "ABC"
    await page.getByLabel('Search').fill('ABC');

    // Verify only ABC suppliers are visible
    await expect(page.getByRole('button', { name: 'ABC Supplier', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'ABC Corporation', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'XYZ Trading', exact: true })).not.toBeVisible();

    // Clear search
    await page.getByLabel('Search').clear();

    // Verify all suppliers are visible again
    await expect(page.getByRole('button', { name: 'ABC Supplier', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'XYZ Trading', exact: true })).toBeVisible();
  });

  test('it shall display pagination controls when suppliers exceed page size', async function ({ page }) {
    await Promise.all([
      loadEmptyFixture(page),
      setupDatabase(tursoLibSQLiteServer(), async function setupData(sql) {
        // Create 25 test suppliers (page size is 20)
        for (let index = 1; index <= 25; index++) {
          await sql`INSERT INTO suppliers (id, name, phone_number) VALUES (${index}, ${`Supplier ${String(index).padStart(2, '0')}`}, NULL)`;
        }
      }),
    ]);

    await page.evaluate(setupView, tursoLibSQLiteServer().url);

    // Wait for table to load
    await expect(page.getByRole('table', { name: 'Suppliers list' })).toBeVisible();

    // Verify pagination controls are visible
    await expect(page.getByRole('navigation', { name: 'Pagination' })).toBeVisible();
    await expect(page.getByText('Showing 1–20 of 25')).toBeVisible();
    
    // Verify first page suppliers are visible
    await expect(page.getByRole('button', { name: 'Supplier 01', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Supplier 20', exact: true })).toBeVisible();
    
    // Supplier 25 should not be visible on first page
    await expect(page.getByRole('button', { name: 'Supplier 25', exact: true })).not.toBeVisible();

    // Navigate to next page
    await page.getByRole('button', { name: 'Next page' }).click();

    // Verify second page content
    await expect(page.getByText('Showing 21–25 of 25')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Supplier 21', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Supplier 25', exact: true })).toBeVisible();
    
    // Supplier 01 should not be visible on second page
    await expect(page.getByRole('button', { name: 'Supplier 01', exact: true })).not.toBeVisible();
  });

  test('it shall open supplier creation dialog when add button is clicked', async function ({ page }) {
    await loadEmptyFixture(page);

    await page.evaluate(setupView, tursoLibSQLiteServer().url);

    // Wait for view to load
    await expect(page.getByText('No Suppliers Found')).toBeVisible();

    // Click add supplier button
    await page.getByRole('button', { name: 'Add Supplier' }).first().click();

    // Verify creation dialog opened
    await expect(page.getByRole('dialog', { name: 'Add Supplier' })).toBeVisible();
  });

  test('it shall display supplier inventory and purchase counts', async function ({ page }) {
    await Promise.all([
      loadEmptyFixture(page),
      setupDatabase(tursoLibSQLiteServer(), async function setupData(sql) {
        // Create test supplier
        await sql`INSERT INTO suppliers (id, name, phone_number) VALUES (1, 'Test Supplier', NULL)`;
        
        // Create test inventories (11310 is POS - Inventory account from migrations)
        await sql`INSERT INTO inventories (id, name, unit_price, unit_of_measurement, account_code) VALUES (1, 'Product A', 10000, 'piece', 11310)`;
        await sql`INSERT INTO inventories (id, name, unit_price, unit_of_measurement, account_code) VALUES (2, 'Product B', 20000, 'piece', 11310)`;
        
        // Link supplier to inventories
        await sql`INSERT INTO supplier_inventories (supplier_id, inventory_id) VALUES (1, 1)`;
        await sql`INSERT INTO supplier_inventories (supplier_id, inventory_id) VALUES (1, 2)`;
        
        // Create test purchases
        await sql`INSERT INTO purchases (id, supplier_id, purchase_time) VALUES (1, 1, 0)`;
        await sql`INSERT INTO purchases (id, supplier_id, purchase_time) VALUES (2, 1, 1000)`;
        await sql`INSERT INTO purchases (id, supplier_id, purchase_time) VALUES (3, 1, 2000)`;
      }),
    ]);

    await page.evaluate(setupView, tursoLibSQLiteServer().url);

    // Wait for table to load
    await expect(page.getByRole('table', { name: 'Suppliers list' })).toBeVisible();
    
    // Find the supplier row
    const supplierRow = page.getByRole('row').filter({ has: page.getByRole('button', { name: 'Test Supplier' }) });
    
    // Verify inventory count badge shows 2
    await expect(supplierRow.locator('span').filter({ hasText: /^2$/ }).first()).toBeVisible();
    
    // Verify purchase count badge shows 3
    await expect(supplierRow.locator('span').filter({ hasText: /^3$/ }).last()).toBeVisible();
  });

  test('it shall reload suppliers list after creating new supplier', async function ({ page }) {
    await loadEmptyFixture(page);

    await page.evaluate(setupView, tursoLibSQLiteServer().url);

    // Wait for empty state
    await expect(page.getByText('No Suppliers Found')).toBeVisible();

    // Open creation dialog
    await page.getByRole('button', { name: 'Add Supplier' }).first().click();
    await expect(page.getByRole('dialog', { name: 'Add Supplier' })).toBeVisible();

    // Fill in supplier details
    await page.getByLabel('Supplier Name').fill('New Supplier');
    await page.getByLabel('Phone Number').fill('081234567890');
    
    // Submit form
    await page.getByRole('dialog', { name: 'Add Supplier' }).getByRole('button', { name: 'Add' }).click();

    // Dialog should close
    await expect(page.getByRole('dialog', { name: 'Add Supplier' })).not.toBeVisible();

    // Verify new supplier appears in the list
    await expect(page.getByRole('table', { name: 'Suppliers list' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'New Supplier', exact: true })).toBeVisible();
  });
});
