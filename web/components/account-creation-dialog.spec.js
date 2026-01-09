import { test, expect } from '@playwright/test';
import { useTursoLibSQLiteServer } from '#test/hooks/use-turso-libsqlite-server.js';
import { useConsoleOutput } from '#test/hooks/use-console-output.js';
import { loadEmptyFixture } from '#test/tools/fixture.js';
import { useStrict } from '#test/hooks/use-strict.js';

/** @import { DatabaseContextElement } from '#web/contexts/database-context.js' */

const { describe } = test;

describe('Account Creation Dialog', function () {
  // useConsoleOutput(test);
  useStrict(test);
  const tursoLibSQLiteServer = useTursoLibSQLiteServer(test);

  test('it shall create a new account', async function ({ page }) {
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
                    commandfor="account-creation-dialog"
                    command="--open"
                  >Create Account</button>
                  <account-creation-dialog
                    id="account-creation-dialog"
                  ></account-creation-dialog>
                </i18n-context>
              </device-context>
            </database-context>
          </router-context>
        </ready-context>
      `;
    }, tursoLibSQLiteServer().url);

    await page.getByRole('button', { name: 'Create Account' }).click();
    await expect(page.getByRole('dialog', { name: 'Create New Account' })).toBeVisible();

    await page.getByLabel('Account Code').fill('12345');
    await page.getByLabel('Account Name').fill('Test Account');
    
    await page.getByLabel('Normal Balance').click();
    await page.getByRole('menuitem', { name: 'Debit' }).click();

    await page.getByLabel('Account Type').click();
    await page.getByRole('menuitem', { name: 'Asset', exact: true }).click();

    const [accountCreatedEvent] = await Promise.all([
      page.evaluate(async function () {
        return new Promise(function (resolve, reject) {
          let settled = false;
          const dialog = document.getElementById('account-creation-dialog');
          dialog.addEventListener('account-created', function (event) {
            if (settled) return;
            settled = true;
            resolve(event.detail);
          });
          setTimeout(function () {
            if (settled) return;
            settled = true;
            reject(new Error('Timeout waiting for account-created event'));
          }, 5000);
        });
      }),
      page.getByRole('dialog', { name: 'Create New Account' }).getByRole('button', { name: 'Create Account' }).click(), // The submit button inside dialog
    ]);

    expect(accountCreatedEvent.accountCode).toBe(12345);

    const account = await page.evaluate(async function () {
      /** @type {DatabaseContextElement} */
      const database = document.querySelector('database-context');
      const result = await database.sql`
        SELECT a.account_code, a.name, a.normal_balance, at.tag
        FROM accounts a
        JOIN account_tags at ON at.account_code = a.account_code
        WHERE a.account_code = 12345
      `;
      return result.rows[0];
    });

    expect(account.account_code).toBe(12345);
    expect(account.name).toBe('Test Account');
    expect(account.normal_balance).toBe(0);
    expect(account.tag).toBe('Asset');
  });

  test('it shall validate duplicate account code', async function ({ page }) {
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
                    commandfor="account-creation-dialog"
                    command="--open"
                  >Create Account</button>
                  <account-creation-dialog
                    id="account-creation-dialog"
                  ></account-creation-dialog>
                </i18n-context>
              </device-context>
            </database-context>
          </router-context>
        </ready-context>
      `;

      /** @type {DatabaseContextElement} */
      const database = document.querySelector('database-context');
      await database.sql`
        INSERT INTO accounts (account_code, name, normal_balance, create_time, update_time)
        VALUES (11111, 'Existing Account', 0, 0, 0)
      `;
    }, tursoLibSQLiteServer().url);

    await page.getByRole('button', { name: 'Create Account' }).click();

    // Fill duplicate code
    await page.getByLabel('Account Code').fill('11111');
    await page.getByLabel('Account Code').blur();

    // Note: Browser validation message handling in Playwright can be tricky.
    // We can check if the input is invalid.
    await expect(page.getByLabel('Account Code')).toHaveJSProperty('validity.valid', false);
    await expect(page.getByLabel('Account Code')).toHaveJSProperty('validationMessage', 'Account code already exists.');
  });
});
