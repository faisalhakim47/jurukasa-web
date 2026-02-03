import { expect } from '@playwright/test';
import { jurukasaTest } from '#test/playwright/test-setup.js';
import { useTursoLibSQLiteServer } from '#test/playwright/hooks/use-turso-libsqlite-server.js';
import { useConsoleOutput } from '#test/playwright/hooks/use-console-output.js';
import { loadEmptyFixture } from '#test/playwright/tools/fixture.js';
import { useStrict } from '#test/playwright/hooks/use-strict.js';
/** @import { DatabaseContextElement } from '#web/contexts/database-context.js' */
/** @import { AccountSelectorDialogElement } from '#web/components/account-selector-dialog.js' */

const test = jurukasaTest;
const { describe } = test;

describe('Account Selector Dialog', function () {
  useConsoleOutput(test);
  useStrict(test);
  const tursoLibSQLiteServer = useTursoLibSQLiteServer(test);

  test('it shall make a choise', async function ({ page }) {
    await loadEmptyFixture(page);

    await page.evaluate(async function setupComponentHtml(tursoDatabaseUrl) {
      document.body.innerHTML = `
        <ready-context>
          <router-context>
            <database-context provider="turso" name="My Business" turso-url="${tursoDatabaseUrl}">
              <device-context>
                <i18n-context>
                  <button
                    type="button"
                    commandfor="account-selector-dialog"
                    command="--open"
                  >Open Account Selector</button>
                  <account-selector-dialog
                    id="account-selector-dialog"
                  ></account-selector-dialog>
                </i18n-context>
              </device-context>
            </database-context>
          </router-context>
        </ready-context>
      `;
    }, tursoLibSQLiteServer().url);

    await page.getByRole('button', { name: 'Open Account Selector' }).click();

    const accountSelectorDialog = page.getByRole('dialog', { name: 'Select Account' });
    await expect(accountSelectorDialog.getByText('No accounts available'), 'it shall display no accounts message').toBeVisible();
    await accountSelectorDialog.getByRole('button', { name: 'Cancel' }).click();
    await expect(accountSelectorDialog, 'it shall close dialog when Close is clicked').not.toBeVisible();

    await page.evaluate(async function insertChartOfAccountTemplate() {
      /** @type {DatabaseContextElement} */
      const database = document.querySelector('database-context');
      await database.sql`INSERT INTO chart_of_accounts_templates (name) VALUES ('Retail Business - Indonesia')`;
    });

    await page.getByRole('button', { name: 'Open Account Selector' }).click();
    await expect(accountSelectorDialog, 'it shall display account selector dialog').toBeVisible();
    await accountSelectorDialog.getByLabel('Search accounts').fill('Modal Pemilik');

    const [selectedAccount] = await Promise.all([
      page.evaluate(async function waitForAccountSelectEvent() {
        return new Promise(function (resolve, reject) {
          let settled = false;
          const accountSelectorDialog = /** @type {AccountSelectorDialogElement} */ (document.getElementById('account-selector-dialog'));
          accountSelectorDialog.addEventListener('account-select', function (event) {
            if (settled) return;
            settled = true;
            resolve(event.detail);
          });
          setTimeout(function () {
            if (settled) return;
            settled = true;
            reject(new Error('Timeout waiting for account-select event'));
          }, 5000);
        });
      }),
      page.getByRole('menuitemradio').filter({ hasText: 'Modal Pemilik' }).click(),
    ]);

    expect(selectedAccount.accountCode).toBe(31000);
    expect(selectedAccount.accountName).toBe('Modal Pemilik');
  });
});
