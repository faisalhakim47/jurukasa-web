import { test, expect } from '@playwright/test';
import { useTursoLibSQLiteServer } from '#test/hooks/use-turso-libsqlite-server.js';
import { useConsoleOutput } from '#test/hooks/use-console-output.js';
/** @import { DatabaseContextElement } from '#web/contexts/database-context.js' */
/** @import { AccountSelectorDialogElement } from '#web/components/account-selector-dialog.js' */

const { describe } = test;

describe('Account Selector Dialog', function () {
  // useConsoleOutput(test);
  const tursoLibSQLiteServer = useTursoLibSQLiteServer(test);

  test('it shall make a choise', async function ({ page }) {
    await page.goto('/test/fixtures/empty.html', { waitUntil: 'load' });

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
                    commandfor="account-selector-dialog"
                    command="--open"
                  >Select Account</button>
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

    await page.getByRole('button', { name: 'Select Account' }).click();

    await expect(page.getByRole('dialog', { name: 'Select Account' }).getByText('No accounts available')).toBeVisible();

    await page.evaluate(async function () {
      /** @type {DatabaseContextElement} */
      const database = document.querySelector('database-context');
      await database.sql`INSERT INTO chart_of_accounts_templates (name) VALUES ('Retail Business - Indonesia')`;
    });

    await page.getByRole('dialog', { name: 'Select Account' }).getByLabel('Search accounts').fill('Modal Pemilik');

    const [selectedAccount] = await Promise.all([
      page.evaluate(async function () {
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
