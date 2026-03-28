import { expect } from '@playwright/test';
import { useTursoLibSQLiteServer } from '#test/playwright/hooks/use-turso-libsqlite-server.js';
import { useConsoleOutput } from '#test/playwright/hooks/use-console-output.js';
import { jurukasaTest } from '#test/playwright/test-setup.js';
import { loadEmptyFixture } from '#test/playwright/tools/fixture.js';
import { useStrict } from '#test/playwright/hooks/use-strict.js';
import { waitForDOMCustomEventDetail } from '#test/playwright/tools/dom.js';

/** @import { DatabaseContextElement } from '#web/contexts/database-context.js' */

const test = jurukasaTest;
const { describe } = test;

/** @param {string} tursoDatabaseUrl */
async function setupView(tursoDatabaseUrl) {
  document.body.innerHTML = `
    <ready-context>
      <router-context>
        <database-context provider="turso" name="My Business" turso-url="${tursoDatabaseUrl}">
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
}

async function setupDuplicateAccountTest(tursoDatabaseUrl) {
  document.body.innerHTML = `
    <ready-context>
      <router-context>
        <database-context provider="turso" name="My Business" turso-url="${tursoDatabaseUrl}">
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
}

describe('Account Creation Dialog', function () {
  useConsoleOutput(test);
  useStrict(test);
  const tursoLibSQLiteServer = useTursoLibSQLiteServer(test);

  test('creates new account with all fields and persists to database', async function ({ page }) {
    await loadEmptyFixture(page);

    await page.evaluate(setupView, tursoLibSQLiteServer().url);

    await page.getByRole('button', { name: 'Create Account' }).click();

    const dialog = page.getByRole('dialog', { name: 'Create New Account' });
    await expect(dialog, 'it shall open creation dialog').toBeVisible();

    await dialog.getByLabel('Account Code').fill('12345');
    await dialog.getByLabel('Account Name').fill('Test Account');

    await dialog.getByLabel('Normal Balance').click();
    await dialog.getByRole('menuitem', { name: 'Debit' }).click();

    await dialog.getByLabel('Account Type').click();
    await dialog.getByRole('menuitem', { name: 'Asset', exact: true }).click();

    const [accountCreatedEvent] = await Promise.all([
      waitForDOMCustomEventDetail(page, 'account-creation-dialog', 'account-created'),
      dialog.getByRole('button', { name: 'Create Account' }).click(),
    ]);

    expect(accountCreatedEvent.accountCode, 'it shall dispatch correct account code in event').toBe(12345);

    const account = await page.evaluate(async function getAccountFromDatabase() {
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

    expect(account.account_code, 'Account code shall be persisted').toBe('12345');
    expect(account.name, 'Account name shall be persisted').toBe('Test Account');
    expect(account.normal_balance, 'Normal balance shall be persisted').toBe('0');
    expect(account.tag, 'Account tag shall be persisted').toBe('Asset');
  });

  test('validates duplicate account code with browser validation', async function ({ page }) {
    await loadEmptyFixture(page);

    await page.evaluate(setupDuplicateAccountTest, tursoLibSQLiteServer().url);

    await page.getByRole('button', { name: 'Create Account' }).click();

    await page.getByLabel('Account Code').fill('11111');
    await page.getByLabel('Account Code').blur();

    await expect(page.getByLabel('Account Code'), 'it shall mark input as invalid').toHaveJSProperty('validity.valid', false);
    await expect(page.getByLabel('Account Code'), 'it shall show validation message').toHaveJSProperty('validationMessage', 'Account code already exists.');
  });
});
