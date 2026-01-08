import { test, expect } from '@playwright/test';
import { useTursoLibSQLiteServer } from '#test/hooks/use-turso-libsqlite-server.js';
import { useConsoleOutput } from '#test/hooks/use-console-output.js';
import { loadEmptyFixture } from '#test/tools/fixture.js';

/** @import { DatabaseContextElement } from '#web/contexts/database-context.js' */

const { describe } = test;

/**
 * Helper function to setup page with supplier details dialog
 * @param {import('@playwright/test').Page} page
 * @param {string} tursoDatabaseUrl
 * @param {number} supplierId
 */
async function setupPage(page, tursoDatabaseUrl, supplierId) {
  await loadEmptyFixture(page);

  await page.evaluate(async function ({ tursoDatabaseUrl, supplierId }) {
    localStorage.setItem('tursoDatabaseUrl', tursoDatabaseUrl);
    localStorage.setItem('tursoDatabaseKey', '');

    document.body.innerHTML = `
      <ready-context>
        <router-context>
          <database-context>
            <device-context>
              <i18n-context>
                <button
                  type="button"
                  commandfor="supplier-details-dialog"
                  command="--open"
                  data-supplier-id="${supplierId}"
                >Open Supplier Details</button>
                <supplier-details-dialog
                  id="supplier-details-dialog"
                ></supplier-details-dialog>
              </i18n-context>
            </device-context>
          </database-context>
        </router-context>
      </ready-context>
    `;
  }, { tursoDatabaseUrl, supplierId });
}

describe('Supplier Details Dialog', function () {
  // useConsoleOutput(test);

  describe('Supplier Inventory Management', function () {
    const tursoLibSQLiteServer = useTursoLibSQLiteServer(test);

    test('it shall display linked inventories table', async function ({ page }) {
      await setupPage(page, tursoLibSQLiteServer().url, 1);

      await page.evaluate(async function () {
        /** @type {DatabaseContextElement} */
        const database = document.querySelector('database-context');
        await database.sql`
          INSERT INTO accounts (account_code, name, normal_balance, is_posting_account, create_time, update_time)
          VALUES (11100, 'Inventory Account', 0, 1, 0, 0)
        `;
        await database.sql`
          INSERT INTO account_tags (account_code, tag) VALUES (11100, 'POS - Inventory')
        `;
        await database.sql`
          INSERT INTO suppliers (id, name, phone_number) VALUES (1, 'Test Supplier', '08123456789')
        `;
        await database.sql`
          INSERT INTO inventories (id, name, unit_price, unit_of_measurement, account_code)
          VALUES (1, 'Test Product', 10000, 'piece', 11100)
        `;
        await database.sql`
          INSERT INTO supplier_inventories (supplier_id, inventory_id, quantity_conversion, name)
          VALUES (1, 1, 12, 'Supplier Product Name')
        `;
      });

      await page.getByRole('button', { name: 'Open Supplier Details' }).click();
      await expect(page.getByRole('dialog', { name: 'Test Supplier' })).toBeVisible();

      await expect(page.getByRole('heading', { name: 'Linked Inventories' })).toBeVisible();

      await expect(page.getByRole('table', { name: 'Linked Inventories' })).toBeVisible();
      await expect(page.getByRole('cell', { name: 'Test Product', exact: true })).toBeVisible();
      await expect(page.getByRole('cell', { name: 'Supplier Product Name' })).toBeVisible();
      await expect(page.getByRole('cell', { name: '12x' })).toBeVisible();
    });

    test('it shall add a new supplier inventory mapping', async function ({ page }) {
      await setupPage(page, tursoLibSQLiteServer().url, 1);

      await page.evaluate(async function () {
        /** @type {DatabaseContextElement} */
        const database = document.querySelector('database-context');
        
        await database.sql`
          INSERT INTO accounts (account_code, name, normal_balance, is_posting_account, create_time, update_time)
          VALUES (11100, 'Inventory Account', 0, 1, 0, 0)
        `;
        await database.sql`
          INSERT INTO account_tags (account_code, tag) VALUES (11100, 'POS - Inventory')
        `;

        await database.sql`
          INSERT INTO suppliers (id, name, phone_number) VALUES (1, 'Test Supplier', '08123456789')
        `;

        await database.sql`
          INSERT INTO inventories (id, name, unit_price, unit_of_measurement, account_code)
          VALUES (1, 'Test Product', 10000, 'piece', 11100)
        `;
      });

      await page.getByRole('button', { name: 'Open Supplier Details' }).click();
      await expect(page.getByRole('dialog', { name: 'Test Supplier' })).toBeVisible();

      await page.getByRole('button', { name: 'Add Mapping' }).click();

      await expect(page.getByRole('heading', { name: 'Add Inventory Mapping' })).toBeVisible();

      await page.getByLabel('Search Inventory').fill('Test');

      await page.getByRole('option', { name: /Test Product/ }).click();

      await page.getByLabel('Conversion').clear();
      await page.getByLabel('Conversion').fill('6');
      await page.getByLabel('Supplier Name (Optional)').fill('Supplier SKU Name');

      await page.getByRole('button', { name: 'Add Mapping' }).last().click();

      await expect(page.getByRole('heading', { name: 'Add Inventory Mapping' })).not.toBeVisible();
      await expect(page.getByRole('cell', { name: 'Test Product', exact: true })).toBeVisible();
      await expect(page.getByRole('cell', { name: 'Supplier SKU Name' })).toBeVisible();
      await expect(page.getByRole('cell', { name: '6x' })).toBeVisible();

      const mapping = await page.evaluate(async function () {
        /** @type {DatabaseContextElement} */
        const database = document.querySelector('database-context');
        const result = await database.sql`
          SELECT supplier_id, inventory_id, quantity_conversion, name
          FROM supplier_inventories
          WHERE supplier_id = 1 AND inventory_id = 1
        `;
        return result.rows[0];
      });

      expect(mapping.supplier_id).toBe(1);
      expect(mapping.inventory_id).toBe(1);
      expect(mapping.quantity_conversion).toBe(6);
      expect(mapping.name).toBe('Supplier SKU Name');
    });

    test('it shall edit an existing supplier inventory mapping', async function ({ page }) {
      await setupPage(page, tursoLibSQLiteServer().url, 1);

      await page.evaluate(async function () {
        /** @type {DatabaseContextElement} */
        const database = document.querySelector('database-context');
        
        // Create account with POS - Inventory tag
        await database.sql`
          INSERT INTO accounts (account_code, name, normal_balance, is_posting_account, create_time, update_time)
          VALUES (11100, 'Inventory Account', 0, 1, 0, 0)
        `;
        await database.sql`
          INSERT INTO account_tags (account_code, tag) VALUES (11100, 'POS - Inventory')
        `;

        await database.sql`
          INSERT INTO suppliers (id, name, phone_number) VALUES (1, 'Test Supplier', '08123456789')
        `;

        await database.sql`
          INSERT INTO inventories (id, name, unit_price, unit_of_measurement, account_code)
          VALUES (1, 'Test Product', 10000, 'piece', 11100)
        `;

        // Create supplier inventory mapping
        await database.sql`
          INSERT INTO supplier_inventories (supplier_id, inventory_id, quantity_conversion, name)
          VALUES (1, 1, 12, 'Old Supplier Name')
        `;
      });

      await page.getByRole('button', { name: 'Open Supplier Details' }).click();
      await expect(page.getByRole('dialog', { name: 'Test Supplier' })).toBeVisible();

      await page.getByRole('button', { name: 'Edit mapping for Test Product' }).click();

      await expect(page.getByRole('heading', { name: 'Edit Inventory Mapping' })).toBeVisible();

      await page.getByLabel('Conversion').clear();
      await page.getByLabel('Conversion').fill('24');
      await page.getByLabel('Supplier Name (Optional)').clear();
      await page.getByLabel('Supplier Name (Optional)').fill('New Supplier Name');

      await page.getByRole('button', { name: 'Save Changes' }).click();

      // Wait for form to close and verify the mapping was updated
      await expect(page.getByRole('heading', { name: 'Edit Inventory Mapping' })).not.toBeVisible();
      await expect(page.getByRole('cell', { name: 'New Supplier Name' })).toBeVisible();
      await expect(page.getByRole('cell', { name: '24x' })).toBeVisible();

      const mapping = await page.evaluate(async function () {
        /** @type {DatabaseContextElement} */
        const database = document.querySelector('database-context');
        const result = await database.sql`
          SELECT supplier_id, inventory_id, quantity_conversion, name
          FROM supplier_inventories
          WHERE supplier_id = 1 AND inventory_id = 1
        `;
        return result.rows[0];
      });

      expect(mapping.quantity_conversion).toBe(24);
      expect(mapping.name).toBe('New Supplier Name');
    });

    test('it shall delete a supplier inventory mapping', async function ({ page }) {
      await setupPage(page, tursoLibSQLiteServer().url, 1);

      // Create test data
      await page.evaluate(async function () {
        /** @type {DatabaseContextElement} */
        const database = document.querySelector('database-context');
        
        // Create account with POS - Inventory tag
        await database.sql`
          INSERT INTO accounts (account_code, name, normal_balance, is_posting_account, create_time, update_time)
          VALUES (11100, 'Inventory Account', 0, 1, 0, 0)
        `;
        await database.sql`
          INSERT INTO account_tags (account_code, tag) VALUES (11100, 'POS - Inventory')
        `;

        // Create supplier
        await database.sql`
          INSERT INTO suppliers (id, name, phone_number) VALUES (1, 'Test Supplier', '08123456789')
        `;

        // Create inventory
        await database.sql`
          INSERT INTO inventories (id, name, unit_price, unit_of_measurement, account_code)
          VALUES (1, 'Test Product', 10000, 'piece', 11100)
        `;

        // Create supplier inventory mapping
        await database.sql`
          INSERT INTO supplier_inventories (supplier_id, inventory_id, quantity_conversion, name)
          VALUES (1, 1, 12, 'Supplier Product Name')
        `;
      });

      await page.getByRole('button', { name: 'Open Supplier Details' }).click();
      await expect(page.getByRole('dialog', { name: 'Test Supplier' })).toBeVisible();

      await page.getByRole('button', { name: 'Remove mapping for Test Product' }).click();

      await expect(page.getByRole('alertdialog', { name: 'Remove Inventory Mapping' })).toBeVisible();
      await expect(page.getByText('Are you sure you want to remove the mapping for Test Product?')).toBeVisible();

      await page.getByRole('alertdialog', { name: 'Remove Inventory Mapping' }).getByRole('button', { name: 'Remove' }).click();

      // Wait for dialog to close and verify the mapping was removed
      await expect(page.getByRole('alertdialog', { name: 'Remove Inventory Mapping' })).not.toBeVisible();
      await expect(page.getByRole('cell', { name: 'Test Product', exact: true })).not.toBeVisible();

      // Verify empty state message
      await expect(page.getByText('No inventories linked to this supplier yet')).toBeVisible();

      // Verify in database
      const count = await page.evaluate(async function () {
        /** @type {DatabaseContextElement} */
        const database = document.querySelector('database-context');
        const result = await database.sql`
          SELECT COUNT(*) as count FROM supplier_inventories WHERE supplier_id = 1
        `;
        return result.rows[0].count;
      });

      expect(count).toBe(0);
    });

    test('it shall cancel delete confirmation', async function ({ page }) {
      await setupPage(page, tursoLibSQLiteServer().url, 1);

      // Create test data
      await page.evaluate(async function () {
        /** @type {DatabaseContextElement} */
        const database = document.querySelector('database-context');
        
        // Create account with POS - Inventory tag
        await database.sql`
          INSERT INTO accounts (account_code, name, normal_balance, is_posting_account, create_time, update_time)
          VALUES (11100, 'Inventory Account', 0, 1, 0, 0)
        `;
        await database.sql`
          INSERT INTO account_tags (account_code, tag) VALUES (11100, 'POS - Inventory')
        `;

        // Create supplier
        await database.sql`
          INSERT INTO suppliers (id, name, phone_number) VALUES (1, 'Test Supplier', '08123456789')
        `;

        // Create inventory
        await database.sql`
          INSERT INTO inventories (id, name, unit_price, unit_of_measurement, account_code)
          VALUES (1, 'Test Product', 10000, 'piece', 11100)
        `;

        // Create supplier inventory mapping
        await database.sql`
          INSERT INTO supplier_inventories (supplier_id, inventory_id, quantity_conversion, name)
          VALUES (1, 1, 12, 'Supplier Product Name')
        `;
      });

      // Open dialog
      await page.getByRole('button', { name: 'Open Supplier Details' }).click();
      await expect(page.getByRole('dialog', { name: 'Test Supplier' })).toBeVisible();

      // Click delete button for the mapping
      await page.getByRole('button', { name: 'Remove mapping for Test Product' }).click();

      // Check that delete confirmation dialog appears
      await expect(page.getByRole('alertdialog', { name: 'Remove Inventory Mapping' })).toBeVisible();

      // Cancel deletion
      await page.getByRole('alertdialog', { name: 'Remove Inventory Mapping' }).getByRole('button', { name: 'Cancel' }).click();

      // Verify dialog is closed and mapping still exists
      await expect(page.getByRole('alertdialog', { name: 'Remove Inventory Mapping' })).not.toBeVisible();
      await expect(page.getByRole('cell', { name: 'Test Product', exact: true })).toBeVisible();

      // Verify in database that mapping still exists
      const count = await page.evaluate(async function () {
        /** @type {DatabaseContextElement} */
        const database = document.querySelector('database-context');
        const result = await database.sql`
          SELECT COUNT(*) as count FROM supplier_inventories WHERE supplier_id = 1
        `;
        return result.rows[0].count;
      });

      expect(count).toBe(1);
    });

    test('it shall prevent duplicate supplier inventory mapping', async function ({ page }) {
      await setupPage(page, tursoLibSQLiteServer().url, 1);
      await page.evaluate(async function () {
        /** @type {DatabaseContextElement} */
        const database = document.querySelector('database-context');
        await database.sql`
          INSERT INTO accounts (account_code, name, normal_balance, is_posting_account, create_time, update_time)
          VALUES (11100, 'Inventory Account', 0, 1, 0, 0)
        `;
        await database.sql`
          INSERT INTO account_tags (account_code, tag) VALUES (11100, 'POS - Inventory')
        `;
        await database.sql`
          INSERT INTO suppliers (id, name, phone_number) VALUES (1, 'Test Supplier', '08123456789')
        `;
        await database.sql`
          INSERT INTO inventories (id, name, unit_price, unit_of_measurement, account_code)
          VALUES (1, 'Test Product', 10000, 'piece', 11100)
        `;
        await database.sql`
          INSERT INTO supplier_inventories (supplier_id, inventory_id, quantity_conversion, name)
          VALUES (1, 1, 12, 'Existing Mapping')
        `;
      });

      await page.getByRole('button', { name: 'Open Supplier Details' }).click();
      await expect(page.getByRole('dialog', { name: 'Test Supplier' })).toBeVisible();

      await page.getByRole('button', { name: 'Add Mapping' }).click();

      await page.getByRole('option', { name: /Test Product/ }).click();

      await page.getByLabel('Conversion').clear();
      await page.getByLabel('Conversion').fill('12');

      await page.getByRole('button', { name: 'Add Mapping' }).last().click();

      await expect(page.getByRole('alertdialog')).toBeVisible();
      await expect(page.getByText('This inventory mapping with the same quantity conversion already exists for this supplier.')).toBeVisible();

      // Dismiss error
      await page.getByRole('button', { name: 'Dismiss' }).click();
      await expect(page.getByRole('alertdialog')).not.toBeVisible();
    });
  });
});
