import { test, expect } from '@playwright/test';
import { useTursoLibSQLiteServer } from '#test/hooks/use-turso-libsqlite-server.js';
import { useConsoleOutput } from '#test/hooks/use-console-output.js';
import { loadEmptyFixture } from '#test/tools/fixture.js';

/** @import { DatabaseContextElement } from '#web/contexts/database-context.js' */

const { describe } = test;

describe('Inventory Price Update Dialog', function () {
  // useConsoleOutput(test);
  const tursoLibSQLiteServer = useTursoLibSQLiteServer(test);

  test('it shall update inventory unit price', async function ({ page }) {
    await loadEmptyFixture(page);

    await page.evaluate(async function (tursoDatabaseUrl) {
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
                    commandfor="inventory-price-update-dialog"
                    command="--open"
                    data-inventory-id="1"
                  >Update Price</button>
                  <inventory-price-update-dialog
                    id="inventory-price-update-dialog"
                  ></inventory-price-update-dialog>
                </i18n-context>
              </device-context>
            </database-context>
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
    }, tursoLibSQLiteServer().url);

    // Open dialog
    await page.getByRole('button', { name: 'Update Price' }).click();
    await expect(page.getByRole('dialog', { name: 'Update Unit Price' })).toBeVisible();

    // Verify current price is displayed
    await expect(page.getByText('Test Product')).toBeVisible();
    await expect(page.getByText('IDR 10,000')).toBeVisible(); // displayCurrency format

    // Verify input is prefilled with current price
    await expect(page.getByLabel('New Unit Price')).toHaveValue('10000');

    // Update price
    await page.getByLabel('New Unit Price').clear();
    await page.getByLabel('New Unit Price').fill('15000');

    // Submit form
    const [priceUpdatedEvent] = await Promise.all([
      page.evaluate(async function () {
        return new Promise(function (resolve, reject) {
          let settled = false;
          const dialog = document.getElementById('inventory-price-update-dialog');
          dialog.addEventListener('inventory-price-updated', function (event) {
            if (settled) return;
            settled = true;
            resolve(event.detail);
          });
          setTimeout(function () {
            if (settled) return;
            settled = true;
            reject(new Error('Timeout waiting for inventory-price-updated event'));
          }, 5000);
        });
      }),
      page.getByRole('dialog', { name: 'Update Unit Price' }).getByRole('button', { name: 'Update Price' }).click(),
    ]);

    expect(priceUpdatedEvent.inventoryId).toBe(1);

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

    expect(inventory.id).toBe(1);
    expect(inventory.name).toBe('Test Product');
    expect(inventory.unit_price).toBe(15000);

    // Dialog should close after successful update
    await expect(page.getByRole('dialog', { name: 'Update Unit Price' })).not.toBeVisible();
  });

  test('it shall validate minimum price', async function ({ page }) {
    await loadEmptyFixture(page);

    await page.evaluate(async function (tursoDatabaseUrl) {
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
                    commandfor="inventory-price-update-dialog"
                    command="--open"
                    data-inventory-id="1"
                  >Update Price</button>
                  <inventory-price-update-dialog
                    id="inventory-price-update-dialog"
                  ></inventory-price-update-dialog>
                </i18n-context>
              </device-context>
            </database-context>
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
    }, tursoLibSQLiteServer().url);

    // Open dialog
    await page.getByRole('button', { name: 'Update Price' }).click();

    // Try to set negative price
    await page.getByLabel('New Unit Price').clear();
    await page.getByLabel('New Unit Price').fill('-100');

    // HTML5 validation should prevent submission
    // The input should be invalid due to min="0" attribute
    const inputValidity = await page.getByLabel('New Unit Price').evaluate((input) => {
      return (input instanceof HTMLInputElement) ? input.validity.valid : true;
    });
    expect(inputValidity).toBe(false);
  });

  test('it shall handle non-existent inventory', async function ({ page }) {
    await loadEmptyFixture(page);

    await page.evaluate(async function (tursoDatabaseUrl) {
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
                    commandfor="inventory-price-update-dialog"
                    command="--open"
                    data-inventory-id="999"
                  >Update Price</button>
                  <inventory-price-update-dialog
                    id="inventory-price-update-dialog"
                  ></inventory-price-update-dialog>
                </i18n-context>
              </device-context>
            </database-context>
          </router-context>
        </ready-context>
      `;
    }, tursoLibSQLiteServer().url);

    // Open dialog
    await page.getByRole('button', { name: 'Update Price' }).click();
    await expect(page.getByRole('dialog', { name: 'Update Unit Price' })).toBeVisible();

    // Should show "Inventory Not Found" message
    await expect(page.getByRole('heading', { name: 'Inventory Not Found' })).toBeVisible();
    await expect(page.getByText('The requested inventory could not be found.')).toBeVisible();
  });

  test('it shall close dialog on cancel button', async function ({ page }) {
    await loadEmptyFixture(page);

    await page.evaluate(async function (tursoDatabaseUrl) {
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
                    commandfor="inventory-price-update-dialog"
                    command="--open"
                    data-inventory-id="1"
                  >Update Price</button>
                  <inventory-price-update-dialog
                    id="inventory-price-update-dialog"
                  ></inventory-price-update-dialog>
                </i18n-context>
              </device-context>
            </database-context>
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
    }, tursoLibSQLiteServer().url);

    // Open dialog
    await page.getByRole('button', { name: 'Update Price' }).click();
    await expect(page.getByRole('dialog', { name: 'Update Unit Price' })).toBeVisible();

    // Click cancel button
    await page.getByRole('dialog', { name: 'Update Unit Price' }).getByRole('button', { name: 'Cancel' }).click();

    // Dialog should close
    await expect(page.getByRole('dialog', { name: 'Update Unit Price' })).not.toBeVisible();
  });

  test('it shall accept zero price', async function ({ page }) {
    await loadEmptyFixture(page);

    await page.evaluate(async function (tursoDatabaseUrl) {
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
                    commandfor="inventory-price-update-dialog"
                    command="--open"
                    data-inventory-id="1"
                  >Update Price</button>
                  <inventory-price-update-dialog
                    id="inventory-price-update-dialog"
                  ></inventory-price-update-dialog>
                </i18n-context>
              </device-context>
            </database-context>
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
    }, tursoLibSQLiteServer().url);

    // Open dialog
    await page.getByRole('button', { name: 'Update Price' }).click();

    // Set price to 0
    await page.getByLabel('New Unit Price').clear();
    await page.getByLabel('New Unit Price').fill('0');

    // Submit form
    const [priceUpdatedEvent] = await Promise.all([
      page.evaluate(async function () {
        return new Promise(function (resolve, reject) {
          let settled = false;
          const dialog = document.getElementById('inventory-price-update-dialog');
          dialog.addEventListener('inventory-price-updated', function (event) {
            if (settled) return;
            settled = true;
            resolve(event.detail);
          });
          setTimeout(function () {
            if (settled) return;
            settled = true;
            reject(new Error('Timeout waiting for inventory-price-updated event'));
          }, 5000);
        });
      }),
      page.getByRole('dialog', { name: 'Update Unit Price' }).getByRole('button', { name: 'Update Price' }).click(),
    ]);

    expect(priceUpdatedEvent.inventoryId).toBe(1);

    // Verify in database
    const inventory = await page.evaluate(async function () {
      /** @type {DatabaseContextElement} */
      const database = document.querySelector('database-context');
      const result = await database.sql`
        SELECT id, unit_price
        FROM inventories
        WHERE id = 1
      `;
      return result.rows[0];
    });

    expect(inventory.unit_price).toBe(0);
  });
});
