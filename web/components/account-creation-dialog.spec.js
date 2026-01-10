import { test, expect } from '@playwright/test';
import { useTursoLibSQLiteServer } from '#test/hooks/use-turso-libsqlite-server.js';
import { useConsoleOutput } from '#test/hooks/use-console-output.js';
import { loadEmptyFixture } from '#test/tools/fixture.js';
import { useStrict } from '#test/hooks/use-strict.js';

/** @import { DatabaseContextElement } from '#web/contexts/database-context.js' */

const { describe } = test;

describe('Account Creation Dialog', function () {
  useConsoleOutput(test);
  useStrict(test);
  const tursoLibSQLiteServer = useTursoLibSQLiteServer(test);

  test('it shall create a new account', async function ({ page }) {
    await loadEmptyFixture(page);

    await page.evaluate(async function setupView(tursoDatabaseUrl) {
      document.body.innerHTML = `
        <ready-context>
          <router-context>
            <database-context provider="turso" turso-url="${tursoDatabaseUrl}">
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

    const dialog = page.getByRole('dialog', { name: 'Create New Account' });
    await expect(dialog).toBeVisible();

    await dialog.getByLabel('Account Code').fill('12345');
    await dialog.getByLabel('Account Name').fill('Test Account');

    await dialog.getByLabel('Normal Balance').click();
    await dialog.getByRole('menuitem', { name: 'Debit' }).click();

    await dialog.getByLabel('Account Type').click();
    await dialog.getByRole('menuitem', { name: 'Asset', exact: true }).click();

    await page.pause();

    const [accountCreatedEvent] = await Promise.all([
      page.evaluate(async function eventTest() {
        const { waitForEvent } = await import('#web/tools/dom.js');
        const accountCreationDialog = document.getElementsByTagName('account-creation-dialog').item(0);
        const event = await waitForEvent(accountCreationDialog, 'account-created', 5000);
        if (event instanceof CustomEvent) return event.detail;
        else throw new Error('Unexpected event type');
      }),
      dialog.getByRole('button', { name: 'Create Account' }).click(),
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
      document.body.innerHTML = `
        <ready-context>
          <router-context>
            <database-context provider="turso" turso-url="${tursoDatabaseUrl}">
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
