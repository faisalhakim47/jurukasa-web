import { test, expect } from '@playwright/test';
import { useTursoLibSQLiteServer } from '#test/hooks/use-turso-libsqlite-server.js';
import { useConsoleOutput } from '#test/hooks/use-console-output.js';

/** @import { DatabaseContextElement } from '#web/contexts/database-context.js' */

const { describe } = test;

describe('Inventories View - Price Edit Button', function () {
  // useConsoleOutput(test);
  const tursoLibSQLiteServer = useTursoLibSQLiteServer(test);

  test('it shall display edit button beside unit price column', async function ({ page }) {
    await page.goto('/test/fixtures/empty.html', { waitUntil: 'load' });

    await page.evaluate(async function (tursoDatabaseUrl) {
      localStorage.setItem('tursoDatabaseUrl', tursoDatabaseUrl);
      localStorage.setItem('tursoDatabaseKey', '');

      // First, create temporary container to setup database
      document.body.innerHTML = `
        <ready-context>
          <router-context>
            <database-context></database-context>
          </router-context>
        </ready-context>
      `;

      /** @type {DatabaseContextElement} */
      const database = document.querySelector('database-context');
      
      // Create test account
      await database.sql`
        INSERT INTO accounts (account_code, name, normal_balance, create_time, update_time)
        VALUES (11110, 'Inventory Account', 0, 0, 0)
      `;
      await database.sql`
        INSERT INTO account_tags (account_code, tag)
        VALUES (11110, 'Asset')
      `;
      await database.sql`
        INSERT INTO account_tags (account_code, tag)
        VALUES (11110, 'Current Asset')
      `;
      await database.sql`
        INSERT INTO account_tags (account_code, tag)
        VALUES (11110, 'POS - Inventory')
      `;

      // Create test inventory
      await database.sql`
        INSERT INTO inventories (id, name, unit_price, unit_of_measurement, account_code)
        VALUES (1, 'Test Product', 10000, 'piece', 11110)
      `;

      // Now create the full component tree
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
    }, tursoLibSQLiteServer().url);

    // Wait for inventory to load
    await expect(page.getByRole('table', { name: 'Inventories list' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Test Product', exact: true })).toBeVisible();

    // Verify edit button exists beside unit price
    await expect(page.getByRole('button', { name: 'Edit price for Test Product' })).toBeVisible();
  });

  test('it shall open price update dialog when edit button is clicked', async function ({ page }) {
    await page.goto('/test/fixtures/empty.html', { waitUntil: 'load' });

    await page.evaluate(async function (tursoDatabaseUrl) {
      localStorage.setItem('tursoDatabaseUrl', tursoDatabaseUrl);
      localStorage.setItem('tursoDatabaseKey', '');

      // First, create temporary container to setup database
      document.body.innerHTML = `
        <ready-context>
          <router-context>
            <database-context></database-context>
          </router-context>
        </ready-context>
      `;

      /** @type {DatabaseContextElement} */
      const database = document.querySelector('database-context');
      
      // Create test account
      await database.sql`
        INSERT INTO accounts (account_code, name, normal_balance, create_time, update_time)
        VALUES (11110, 'Inventory Account', 0, 0, 0)
      `;
      await database.sql`
        INSERT INTO account_tags (account_code, tag)
        VALUES (11110, 'POS - Inventory')
      `;

      // Create test inventory
      await database.sql`
        INSERT INTO inventories (id, name, unit_price, unit_of_measurement, account_code)
        VALUES (1, 'Test Product', 10000, 'piece', 11110)
      `;

      // Now create the full component tree
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
    }, tursoLibSQLiteServer().url);

    // Wait for inventory to load
    await expect(page.getByRole('table', { name: 'Inventories list' })).toBeVisible();

    // Click edit button
    await page.getByRole('button', { name: 'Edit price for Test Product' }).click();

    // Price update dialog should open
    await expect(page.getByRole('dialog', { name: 'Update Unit Price' })).toBeVisible();
    await expect(page.getByRole('dialog', { name: 'Update Unit Price' }).getByText('Test Product')).toBeVisible();
    await expect(page.getByLabel('New Unit Price')).toHaveValue('10000');
  });

  test('it shall update price and refresh table after successful update', async function ({ page }) {
    await page.goto('/test/fixtures/empty.html', { waitUntil: 'load' });

    await page.evaluate(async function (tursoDatabaseUrl) {
      localStorage.setItem('tursoDatabaseUrl', tursoDatabaseUrl);
      localStorage.setItem('tursoDatabaseKey', '');

      // First, create temporary container to setup database
      document.body.innerHTML = `
        <ready-context>
          <router-context>
            <database-context></database-context>
          </router-context>
        </ready-context>
      `;

      /** @type {DatabaseContextElement} */
      const database = document.querySelector('database-context');
      
      // Create test account
      await database.sql`
        INSERT INTO accounts (account_code, name, normal_balance, create_time, update_time)
        VALUES (11110, 'Inventory Account', 0, 0, 0)
      `;
      await database.sql`
        INSERT INTO account_tags (account_code, tag)
        VALUES (11110, 'POS - Inventory')
      `;

      // Create test inventory
      await database.sql`
        INSERT INTO inventories (id, name, unit_price, unit_of_measurement, account_code)
        VALUES (1, 'Test Product', 10000, 'piece', 11110)
      `;

      // Now create the full component tree
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
    }, tursoLibSQLiteServer().url);

    // Wait for inventory to load
    await expect(page.getByRole('table', { name: 'Inventories list' })).toBeVisible();

    // Verify original price is displayed in table (IDR 10,000 = 10000 in lowest denomination)
    const tableRow = page.getByRole('row').filter({ has: page.getByRole('button', { name: 'Test Product' }) });
    await expect(tableRow).toContainText('IDR 10,000');

    // Click edit button
    await page.getByRole('button', { name: 'Edit price for Test Product' }).click();

    // Update price in dialog
    await page.getByLabel('New Unit Price').clear();
    await page.getByLabel('New Unit Price').fill('25000');
    await page.getByRole('dialog', { name: 'Update Unit Price' }).getByRole('button', { name: 'Update Price' }).click();

    // Dialog should close
    await expect(page.getByRole('dialog', { name: 'Update Unit Price' })).not.toBeVisible();

    // Table should refresh and show updated price (IDR 25,000 = 25000 in lowest denomination)
    await expect(tableRow).toContainText('IDR 25,000');

    // Verify in database
    const inventory = await page.evaluate(async function () {
      /** @type {DatabaseContextElement} */
      const database = document.querySelector('database-context');
      const result = await database.sql`
        SELECT id, name, unit_price
        FROM inventories
        WHERE id = 1
      `;
      return result.rows[0];
    });

    expect(inventory.unit_price).toBe(25000);
  });

  test('it shall show edit button for multiple inventories', async function ({ page }) {
    await page.goto('/test/fixtures/empty.html', { waitUntil: 'load' });

    await page.evaluate(async function (tursoDatabaseUrl) {
      localStorage.setItem('tursoDatabaseUrl', tursoDatabaseUrl);
      localStorage.setItem('tursoDatabaseKey', '');

      // First, create temporary container to setup database
      document.body.innerHTML = `
        <ready-context>
          <router-context>
            <database-context></database-context>
          </router-context>
        </ready-context>
      `;

      /** @type {DatabaseContextElement} */
      const database = document.querySelector('database-context');
      
      // Create test account
      await database.sql`
        INSERT INTO accounts (account_code, name, normal_balance, create_time, update_time)
        VALUES (11110, 'Inventory Account', 0, 0, 0)
      `;
      await database.sql`
        INSERT INTO account_tags (account_code, tag)
        VALUES (11110, 'POS - Inventory')
      `;

      // Create multiple test inventories
      await database.sql`
        INSERT INTO inventories (id, name, unit_price, unit_of_measurement, account_code)
        VALUES
          (1, 'Product A', 10000, 'piece', 11110),
          (2, 'Product B', 20000, 'kg', 11110),
          (3, 'Product C', 30000, 'liter', 11110)
      `;

      // Now create the full component tree
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
    }, tursoLibSQLiteServer().url);

    // Wait for inventories to load
    await expect(page.getByRole('table', { name: 'Inventories list' })).toBeVisible();

    // Verify edit buttons exist for all inventories
    await expect(page.getByRole('button', { name: 'Edit price for Product A' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Edit price for Product B' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Edit price for Product C' })).toBeVisible();

    // Click edit button for Product B
    await page.getByRole('button', { name: 'Edit price for Product B' }).click();

    // Verify correct product is shown in dialog
    await expect(page.getByRole('dialog', { name: 'Update Unit Price' })).toBeVisible();
    await expect(page.getByRole('dialog', { name: 'Update Unit Price' }).getByText('Product B')).toBeVisible();
    await expect(page.getByLabel('New Unit Price')).toHaveValue('20000');
  });
});
