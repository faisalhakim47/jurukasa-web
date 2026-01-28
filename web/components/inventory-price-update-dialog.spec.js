import { expect } from '@playwright/test';
import { jurukasaTest } from '#test/playwright/test-setup.js';
import { useConsoleOutput } from '#test/playwright/hooks/use-console-output.js';
import { useStrict } from '#test/playwright/hooks/use-strict.js';
import { useTursoLibSQLiteServer } from '#test/playwright/hooks/use-turso-libsqlite-server.js';
import { setupDatabase } from '#test/playwright/tools/database.js';
import { loadEmptyFixture } from '#test/playwright/tools/fixture.js';
/** @import { DatabaseContextElement } from '#web/contexts/database-context.js' */
/** @import { InventoryPriceUpdateDialogElement } from '#web/components/inventory-price-update-dialog.js' */

const test = jurukasaTest;
const { describe } = test;

/**
 * @param {[string, string | number]} arg
 */
async function setupView([tursoDatabaseUrl, inventoryId]) {
  document.body.innerHTML = `
    <ready-context>
      <router-context>
        <database-context provider="turso" name="My Business" turso-url="${tursoDatabaseUrl}">
          <device-context>
            <i18n-context>
              <button
                type="button"
                commandfor="inventory-price-update-dialog"
                command="--open"
                data-inventory-id="${inventoryId}"
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
}

describe('Inventory Price Update Dialog', function () {
  // useConsoleOutput(test);
  useStrict(test);
  const tursoLibSQLiteServer = useTursoLibSQLiteServer(test);

  test('it shall update inventory unit price', async function ({ page }) {
    await Promise.all([
      loadEmptyFixture(page),
      setupDatabase(tursoLibSQLiteServer(), async function setupData(sql) {
        await sql`
          INSERT INTO inventories (id, name, unit_price, unit_of_measurement, account_code)
          VALUES (1, 'Test Product', 10000, 'piece', 11310)
        `;
      }),
    ]);
    await page.evaluate(setupView, [tursoLibSQLiteServer().url, 1]);

    await page.getByRole('button', { name: 'Update Price' }).click();
    await expect(page.getByRole('dialog', { name: 'Update Unit Price' })).toBeVisible();

    await expect(page.getByText('Test Product')).toBeVisible();
    await expect(page.getByText('IDR 10,000')).toBeVisible();
    await expect(page.getByLabel('New Unit Price')).toHaveValue('10000');

    await page.getByLabel('New Unit Price').clear();
    await page.getByLabel('New Unit Price').fill('15000');

    const [priceUpdatedEvent] = await Promise.all([
      page.evaluate(async function waitForPriceUpdatedEvent() {
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

    const inventory = await page.evaluate(async function getInventoryFromDatabase() {
      /** @type {DatabaseContextElement} */
      const database = document.querySelector('database-context');
      const result = await database.sql`
        SELECT id, name, unit_price
        FROM inventories
        WHERE id = 1
      `;
      return result.rows[0];
    });

    expect(inventory.id).toBe('1');
    expect(inventory.name).toBe('Test Product');
    expect(inventory.unit_price).toBe('15000');

    await expect(page.getByRole('dialog', { name: 'Update Unit Price' })).not.toBeVisible();
  });

  test('it shall validate minimum price', async function ({ page }) {
    await Promise.all([
      loadEmptyFixture(page),
      setupDatabase(tursoLibSQLiteServer(), async function setupData(sql) {
        await sql`
          INSERT INTO inventories (id, name, unit_price, unit_of_measurement, account_code)
          VALUES (1, 'Test Product', 10000, 'piece', 11310)
        `;
      }),
    ]);
    await page.evaluate(setupView, [tursoLibSQLiteServer().url, 1]);

    await page.getByRole('button', { name: 'Update Price' }).click();

    await page.getByLabel('New Unit Price').clear();
    await page.getByLabel('New Unit Price').fill('-100');

    const inputValidity = await page.getByLabel('New Unit Price').evaluate(function checkInputValidity(input) {
      return (input instanceof HTMLInputElement) ? input.validity.valid : true;
    });
    expect(inputValidity).toBe(false);
  });

  test('it shall handle non-existent inventory', async function ({ page }) {
    await Promise.all([
      loadEmptyFixture(page),
      setupDatabase(tursoLibSQLiteServer(), async function setupData(sql) { }),
    ]);
    await page.evaluate(setupView, [tursoLibSQLiteServer().url, 999]);

    await page.getByRole('button', { name: 'Update Price' }).click();
    await expect(page.getByRole('dialog', { name: 'Update Unit Price' })).toBeVisible();

    await expect(page.getByRole('heading', { name: 'Inventory Not Found' })).toBeVisible();
    await expect(page.getByText('The requested inventory could not be found.')).toBeVisible();
  });

  test('it shall close dialog on cancel button', async function ({ page }) {
    await Promise.all([
      loadEmptyFixture(page),
      setupDatabase(tursoLibSQLiteServer(), async function setupData(sql) {
        await sql`
          INSERT INTO inventories (id, name, unit_price, unit_of_measurement, account_code)
          VALUES (1, 'Test Product', 10000, 'piece', 11310)
        `;
      }),
    ]);
    await page.evaluate(setupView, [tursoLibSQLiteServer().url, 1]);

    await page.getByRole('button', { name: 'Update Price' }).click();
    await expect(page.getByRole('dialog', { name: 'Update Unit Price' })).toBeVisible();

    await page.getByRole('dialog', { name: 'Update Unit Price' }).getByRole('button', { name: 'Cancel' }).click();

    await expect(page.getByRole('dialog', { name: 'Update Unit Price' })).not.toBeVisible();
  });

  test('it shall accept zero price', async function ({ page }) {
    await Promise.all([
      loadEmptyFixture(page),
      setupDatabase(tursoLibSQLiteServer(), async function setupData(sql) {
        await sql`
          INSERT INTO inventories (id, name, unit_price, unit_of_measurement, account_code)
          VALUES (1, 'Test Product', 10000, 'piece', 11310)
        `;
      }),
    ]);
    await page.evaluate(setupView, [tursoLibSQLiteServer().url, 1]);

    await page.getByRole('button', { name: 'Update Price' }).click();

    await page.getByLabel('New Unit Price').clear();
    await page.getByLabel('New Unit Price').fill('0');

    const [priceUpdatedEvent] = await Promise.all([
      page.evaluate(async function waitForPriceUpdatedEvent() {
        const { waitForEvent } = await import('#web/tools/dom.js');
        /** @type {InventoryPriceUpdateDialogElement} */
        const dialog = document.getElementById('inventory-price-update-dialog');
        const event = await waitForEvent(dialog, 'inventory-price-updated', 2000);
        if (event instanceof CustomEvent) return event.detail;
        else throw new Error('Timeout waiting for inventory-price-updated event');
      }),
      page.getByRole('dialog', { name: 'Update Unit Price' }).getByRole('button', { name: 'Update Price' }).click(),
    ]);

    expect(priceUpdatedEvent.inventoryId).toBe(1);

    const inventory = await page.evaluate(async function getInventoryFromDatabase() {
      /** @type {DatabaseContextElement} */
      const database = document.querySelector('database-context');
      const result = await database.sql`SELECT id, unit_price FROM inventories WHERE id = 1`;
      return result.rows[0];
    });

    expect(inventory.unit_price).toBe('0');
  });
});
