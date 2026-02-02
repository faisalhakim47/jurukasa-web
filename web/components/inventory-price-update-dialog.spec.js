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

async function waitForPriceUpdatedEvent() {
  const { waitForEvent } = await import('#web/tools/dom.js');
  /** @type {InventoryPriceUpdateDialogElement} */
  const dialog = document.getElementById('inventory-price-update-dialog');
  const event = await waitForEvent(dialog, 'inventory-price-updated', 5000);
  if (event instanceof CustomEvent) return event.detail;
  else throw new Error('Timeout waiting for inventory-price-updated event');
}

async function getInventoryFromDatabase() {
  /** @type {DatabaseContextElement} */
  const database = document.querySelector('database-context');
  const result = await database.sql`
    SELECT id, name, unit_price
    FROM inventories
    WHERE id = 1
  `;
  return result.rows[0];
}

async function checkInputValidity(input) {
  return (input instanceof HTMLInputElement) ? input.validity.valid : true;
}

describe('Inventory Price Update Dialog', function () {
  useConsoleOutput(test);
  useStrict(test);
  const tursoLibSQLiteServer = useTursoLibSQLiteServer(test);

  test('it shall update inventory unit price and emit event', async function ({ page }) {
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
    await expect(page.getByRole('dialog', { name: 'Update Unit Price' }), 'it shall display update price dialog').toBeVisible();

    await expect(page.getByText('Test Product'), 'it shall display product name in dialog').toBeVisible();
    await expect(page.getByText('IDR 10,000'), 'it shall display current price in dialog').toBeVisible();
    await expect(page.getByLabel('New Unit Price'), 'it shall prefill new price with current price').toHaveValue('10000');

    await page.getByLabel('New Unit Price').clear();
    await page.getByLabel('New Unit Price').fill('15000');

    const [priceUpdatedEvent] = await Promise.all([
      page.evaluate(waitForPriceUpdatedEvent),
      page.getByRole('dialog', { name: 'Update Unit Price' }).getByRole('button', { name: 'Update Price' }).click(),
    ]);

    expect(priceUpdatedEvent.inventoryId, 'it shall emit event with correct inventory ID').toBe(1);

    const inventory = await page.evaluate(getInventoryFromDatabase);

    expect(inventory.id, 'it shall persist correct inventory ID in database').toBe('1');
    expect(inventory.name, 'it shall preserve inventory name in database').toBe('Test Product');
    expect(inventory.unit_price, 'it shall update unit price in database to new value').toBe('15000');

    await expect(page.getByRole('dialog', { name: 'Update Unit Price' }), 'it shall close dialog after successful update').not.toBeVisible();
  });

  test('it shall validate minimum price and reject negative values', async function ({ page }) {
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

    const inputValidity = await page.evaluate(checkInputValidity, await page.getByLabel('New Unit Price').elementHandle());
    expect(inputValidity, 'it shall mark negative price as invalid').toBe(false);
  });

  test('it shall handle non-existent inventory with error state', async function ({ page }) {
    await Promise.all([
      loadEmptyFixture(page),
      setupDatabase(tursoLibSQLiteServer(), async function setupData(sql) { }),
    ]);
    await page.evaluate(setupView, [tursoLibSQLiteServer().url, 999]);

    await page.getByRole('button', { name: 'Update Price' }).click();
    await expect(page.getByRole('dialog', { name: 'Update Unit Price' }), 'it shall display dialog even for non-existent inventory').toBeVisible();

    await expect(page.getByRole('heading', { name: 'Inventory Not Found' }), 'it shall display not found heading').toBeVisible();
    await expect(page.getByText('The requested inventory could not be found.'), 'it shall display not found message').toBeVisible();
  });

  test('it shall close dialog on cancel button without updating', async function ({ page }) {
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
    await expect(page.getByRole('dialog', { name: 'Update Unit Price' }), 'it shall display dialog').toBeVisible();

    await page.getByRole('dialog', { name: 'Update Unit Price' }).getByRole('button', { name: 'Cancel' }).click();

    await expect(page.getByRole('dialog', { name: 'Update Unit Price' }), 'it shall close dialog on cancel').not.toBeVisible();
  });

  test('it shall accept zero price as valid update', async function ({ page }) {
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
      page.evaluate(waitForPriceUpdatedEvent),
      page.getByRole('dialog', { name: 'Update Unit Price' }).getByRole('button', { name: 'Update Price' }).click(),
    ]);

    expect(priceUpdatedEvent.inventoryId, 'it shall emit event with correct inventory ID for zero price').toBe(1);

    const inventory = await page.evaluate(getInventoryFromDatabase);

    expect(inventory.unit_price, 'it shall update unit price to zero in database').toBe('0');
  });
});
