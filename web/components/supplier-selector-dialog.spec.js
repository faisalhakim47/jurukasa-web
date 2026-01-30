import { expect } from '@playwright/test';
import { jurukasaTest } from '#test/playwright/test-setup.js';
import { useTursoLibSQLiteServer } from '#test/playwright/hooks/use-turso-libsqlite-server.js';
import { useConsoleOutput } from '#test/playwright/hooks/use-console-output.js';
import { loadEmptyFixture } from '#test/playwright/tools/fixture.js';
import { useStrict } from '#test/playwright/hooks/use-strict.js';
/** @import { DatabaseContextElement } from '#web/contexts/database-context.js' */

const test = jurukasaTest;
const { describe } = test;

describe('Supplier Selector Dialog', function () {
  useConsoleOutput(test);
  useStrict(test);
  const tursoLibSQLiteServer = useTursoLibSQLiteServer(test);

  test('it shall make a choice', async function ({ page }) {
    await loadEmptyFixture(page);

    await page.evaluate(async function setupComponentHtml(tursoDatabaseUrl) {
      document.body.innerHTML = `
        <ready-context>
          <router-context>
            <database-context provider="turso" name="My Business" turso-url=${tursoDatabaseUrl}>
              <device-context>
                <i18n-context>
                  <button
                    type="button"
                    commandfor="supplier-selector-dialog"
                    command="--open"
                  >Select Supplier</button>
                  <supplier-selector-dialog
                    id="supplier-selector-dialog"
                  ></supplier-selector-dialog>
                </i18n-context>
              </device-context>
            </database-context>
          </router-context>
        </ready-context>
      `;
    }, tursoLibSQLiteServer().url);

    await page.getByRole('button', { name: 'Select Supplier' }).click();

    await expect(page.getByRole('dialog', { name: 'Select Supplier' }).getByText('No suppliers available')).toBeVisible();

    await page.evaluate(async function insertTestSuppliers() {
      /** @type {DatabaseContextElement} */
      const database = document.querySelector('database-context');
      await database.sql`INSERT INTO suppliers (name, phone_number) VALUES ('ABC Suppliers', '+62812345678')`;
      await database.sql`INSERT INTO suppliers (name, phone_number) VALUES ('XYZ Trading', '+62898765432')`;
    });

    await page.getByRole('dialog', { name: 'Select Supplier' }).getByLabel('Search suppliers').fill('ABC');

    const [selectedSupplier] = await Promise.all([
      page.evaluate(async function waitForSupplierSelectEvent() {
        return new Promise(function (resolve, reject) {
          let settled = false;
          const supplierSelectorDialog = document.getElementById('supplier-selector-dialog');
          supplierSelectorDialog.addEventListener('supplier-select', function (event) {
            if (settled) return;
            settled = true;
            resolve(event.detail);
          });
          setTimeout(function () {
            if (settled) return;
            settled = true;
            reject(new Error('Timeout waiting for supplier-select event'));
          }, 5000);
        });
      }),
      page.getByRole('menuitemradio').filter({ hasText: 'ABC Suppliers' }).click(),
    ]);

    expect(selectedSupplier.supplierId).toBe(1);
    expect(selectedSupplier.supplierName).toBe('ABC Suppliers');
    expect(selectedSupplier.phoneNumber).toBe('+62812345678');
  });
});
