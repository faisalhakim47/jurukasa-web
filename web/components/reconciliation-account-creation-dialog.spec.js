import { expect } from '@playwright/test';
import { jurukasaTest } from '#test/playwright/test-setup.js';
import { useTursoLibSQLiteServer } from '#test/playwright/hooks/use-turso-libsqlite-server.js';
import { setupDatabase } from '#test/playwright/tools/database.js';
import { useStrict } from '#test/playwright/hooks/use-strict.js';
import { loadEmptyFixture } from '#test/playwright/tools/fixture.js';

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
                commandfor="reconciliation-account-creation-dialog"
                command="--open"
              >Create Reconciliation Account</button>
              <reconciliation-account-creation-dialog
                id="reconciliation-account-creation-dialog"
              ></reconciliation-account-creation-dialog>
            </i18n-context>
          </device-context>
        </database-context>
      </router-context>
    </ready-context>
  `;
  await import('#web/components/reconciliation-account-creation-dialog.js');
  await customElements.whenDefined('reconciliation-account-creation-dialog');
}

/** @param {string} tursoDatabaseUrl */
async function setupExistingCashOverShortAccount(tursoDatabaseUrl) {
  document.body.innerHTML = `
    <ready-context>
      <router-context>
        <database-context provider="turso" name="My Business" turso-url="${tursoDatabaseUrl}">
          <device-context>
            <i18n-context>
              <button
                type="button"
                commandfor="reconciliation-account-creation-dialog"
                command="--open"
              >Create Reconciliation Account</button>
              <reconciliation-account-creation-dialog
                id="reconciliation-account-creation-dialog"
              ></reconciliation-account-creation-dialog>
            </i18n-context>
          </device-context>
        </database-context>
      </router-context>
    </ready-context>
  `;

  /** @type {DatabaseContextElement} */
  const database = document.querySelector('database-context');
  // Remove the Cash Over/Short tag from the seeded account 82300 first
  await database.sql`
    DELETE FROM account_tags WHERE account_code = 82300 AND tag = 'Reconciliation - Cash Over/Short'
  `;
  // Create a new account and give it the tag
  await database.sql`
    INSERT INTO accounts (account_code, name, normal_balance, create_time, update_time)
    VALUES (82209, 'Old Cash Over Short', 0, 0, 0)
  `;
  await database.sql`
    INSERT INTO account_tags (account_code, tag)
    VALUES (82209, 'Expense')
  `;
  await database.sql`
    INSERT INTO account_tags (account_code, tag)
    VALUES (82209, 'Reconciliation - Cash Over/Short')
  `;
}

/** @param {string} tursoDatabaseUrl */
async function setupDuplicateAccountCodeTest(tursoDatabaseUrl) {
  document.body.innerHTML = `
    <ready-context>
      <router-context>
        <database-context provider="turso" name="My Business" turso-url="${tursoDatabaseUrl}">
          <device-context>
            <i18n-context>
              <button
                type="button"
                commandfor="reconciliation-account-creation-dialog"
                command="--open"
              >Create Reconciliation Account</button>
              <reconciliation-account-creation-dialog
                id="reconciliation-account-creation-dialog"
              ></reconciliation-account-creation-dialog>
            </i18n-context>
          </device-context>
        </database-context>
      </router-context>
    </ready-context>
  `;

  // Account 82200 already exists in seeded data
}

  /** @param {{ tursoDatabaseUrl: string, accountCode: number, accountName: string }} params */
async function setupDuplicateAccountNameTest(params) {
  /** @type {DatabaseContextElement} */
  const database = document.querySelector('database-context');
  await database.sql`
    INSERT INTO accounts (account_code, name, normal_balance, create_time, update_time)
    VALUES (${params.accountCode}, ${params.accountName}, 0, 0, 0)
  `;
}

describe('Reconciliation Account Creation Dialog', function () {
  useStrict(test);
  const tursoLibSQLiteServer = useTursoLibSQLiteServer(test);

  test('open dialog and navigate between account type selection and form', async function ({ page }) {
    await Promise.all([
      loadEmptyFixture(page),
      setupDatabase(tursoLibSQLiteServer(), async function setupData(sql) { }),
    ]);
    await page.evaluate(setupView, tursoLibSQLiteServer().url);

    await page.getByRole('button', { name: 'Create Reconciliation Account' }).click();

    const dialog = page.getByRole('dialog', { name: 'Create Reconciliation Account' });
    await expect(dialog, 'dialog shall be visible after button click').toBeVisible();

    await expect(
      dialog.getByRole('button', { name: 'Reconciliation Adjustment' }),
      'reconciliation adjustment button shall be visible in account type selection'
    ).toBeVisible();
    await expect(
      dialog.getByRole('button', { name: 'Cash Over/Short' }),
      'cash over/short button shall be visible in account type selection'
    ).toBeVisible();

    await dialog.getByRole('button', { name: 'Reconciliation Adjustment' }).click();

    await expect(
      dialog.getByLabel('Account Code'),
      'account code field shall be visible after selecting adjustment account type'
    ).toBeVisible();
    await expect(
      dialog.getByLabel('Account Name'),
      'account name field shall be visible after selecting adjustment account type'
    ).toBeVisible();

    await dialog.getByRole('button', { name: 'Change account type' }).click();

    await expect(
      dialog.getByRole('button', { name: 'Reconciliation Adjustment' }),
      'reconciliation adjustment button shall be visible after going back to account type selection'
    ).toBeVisible();
    await expect(
      dialog.getByRole('button', { name: 'Cash Over/Short' }),
      'cash over/short button shall be visible after going back to account type selection'
    ).toBeVisible();
  });

  test('create reconciliation adjustment account with correct tags and suggested values', async function ({ page }) {
    await Promise.all([
      loadEmptyFixture(page),
      setupDatabase(tursoLibSQLiteServer(), async function setupData(sql) { }),
    ]);
    await page.evaluate(setupView, tursoLibSQLiteServer().url);

    await page.getByRole('button', { name: 'Create Reconciliation Account' }).click();

    const dialog = page.getByRole('dialog', { name: 'Create Reconciliation Account' });
    await dialog.getByRole('button', { name: 'Reconciliation Adjustment' }).click();

    await expect(
      dialog.getByLabel('Account Code'),
      'account code shall have suggested value 82200'
    ).toHaveValue('82200');
    await expect(
      dialog.getByLabel('Account Name'),
      'account name shall have suggested value Reconciliation Adjustment'
    ).toHaveValue('Reconciliation Adjustment');

    await dialog.getByLabel('Account Code').fill('82201');
    await dialog.getByLabel('Account Name').fill('Reconciliation Adjustments');

    const [accountCreatedEvent] = await Promise.all([
      page.evaluate(async function eventTest() {
        const { waitForEvent } = await import('#web/tools/dom.js');
        const reconciliationAccountDialog = document.getElementsByTagName('reconciliation-account-creation-dialog').item(0);
        const event = await waitForEvent(reconciliationAccountDialog, 'reconciliation-account-created', 5000);
        if (event instanceof CustomEvent) return event.detail;
        else throw new Error('Unexpected event type');
      }),
      dialog.getByRole('button', { name: 'Create Account' }).click(),
    ]);

    expect(accountCreatedEvent.accountCode, 'account code in event shall be 82201').toBe(82201);
    expect(accountCreatedEvent.accountType, 'account type in event shall be adjustment').toBe('adjustment');

    const accountData = await page.evaluate(async function getAccountData() {
      /** @type {DatabaseContextElement} */
      const database = document.querySelector('database-context');
      const result = await database.sql`
        SELECT 
          a.account_code, 
          a.name, 
          a.normal_balance,
          GROUP_CONCAT(at.tag) as tags
        FROM accounts a
        LEFT JOIN account_tags at ON at.account_code = a.account_code
        WHERE a.account_code = 82201
        GROUP BY a.account_code
      `;
      return result.rows[0];
    });

    expect(accountData.account_code, 'account code in database shall be 82201').toBe('82201');
    expect(accountData.name, 'account name in database shall be Reconciliation Adjustments').toBe('Reconciliation Adjustments');
    expect(accountData.normal_balance, 'normal balance shall be 0 for expense accounts').toBe('0');

    const tags = String(accountData.tags).split(',');
    expect(tags, 'tags shall contain Expense').toContain('Expense');
    expect(tags, 'tags shall contain Reconciliation - Adjustment').toContain('Reconciliation - Adjustment');
  });

  test('create cash over/short account with tag replacement when previous exists', async function ({ page }) {
    await Promise.all([
      loadEmptyFixture(page),
      setupDatabase(tursoLibSQLiteServer(), async function setupData(sql) { }),
    ]);

    await page.evaluate(setupExistingCashOverShortAccount, tursoLibSQLiteServer().url);

    await page.getByRole('button', { name: 'Create Reconciliation Account' }).click();

    const dialog = page.getByRole('dialog', { name: 'Create Reconciliation Account' });
    await dialog.getByRole('button', { name: 'Cash Over/Short' }).click();

    await expect(
      dialog.getByLabel('Account Code'),
      'account code shall have suggested value 82210'
    ).toHaveValue('82210');
    await expect(
      dialog.getByLabel('Account Name'),
      'account name shall have suggested value Cash Over/Short'
    ).toHaveValue('Cash Over/Short');

    await dialog.getByLabel('Account Code').fill('82210');
    await dialog.getByLabel('Account Name').fill('New Cash Over Short');

    const [accountCreatedEvent] = await Promise.all([
      page.evaluate(async function eventTest() {
        const { waitForEvent } = await import('#web/tools/dom.js');
        const reconciliationAccountDialog = document.getElementsByTagName('reconciliation-account-creation-dialog').item(0);
        const event = await waitForEvent(reconciliationAccountDialog, 'reconciliation-account-created', 5000);
        if (event instanceof CustomEvent) return event.detail;
        else throw new Error('Unexpected event type');
      }),
      dialog.getByRole('button', { name: 'Create Account' }).click(),
    ]);

    expect(accountCreatedEvent.accountCode, 'account code in event shall be 82210').toBe(82210);
    expect(accountCreatedEvent.accountType, 'account type in event shall be cashOverShort').toBe('cashOverShort');

    await expect(dialog, 'dialog shall close after account creation').not.toBeVisible();

    const accountsData = await page.evaluate(async function getAccountsData() {
      /** @type {DatabaseContextElement} */
      const database = document.querySelector('database-context');
      const result = await database.sql`
        SELECT 
          a.account_code,
          a.name,
          GROUP_CONCAT(at.tag) as tags
        FROM accounts a
        LEFT JOIN account_tags at ON at.account_code = a.account_code
        WHERE a.account_code IN (82209, 82210)
        GROUP BY a.account_code
        ORDER BY a.account_code
      `;
      return result.rows;
    });

    expect(accountsData[0].account_code, 'old account code shall be 82209').toBe('82209');
    expect(accountsData[0].tags, 'old account shall only have Expense tag').toBe('Expense');

    expect(accountsData[1].account_code, 'new account code shall be 82210').toBe('82210');
    const newTags = String(accountsData[1].tags).split(',');
    expect(newTags, 'new account tags shall contain Expense').toContain('Expense');
    expect(newTags, 'new account tags shall contain Reconciliation - Cash Over/Short').toContain('Reconciliation - Cash Over/Short');
  });

  test('validate duplicate account code and name with submit button state', async function ({ page }) {
    await Promise.all([
      loadEmptyFixture(page),
      setupDatabase(tursoLibSQLiteServer(), async function setupData(sql) { }),
    ]);

    await page.evaluate(setupDuplicateAccountCodeTest, tursoLibSQLiteServer().url);

    await page.getByRole('button', { name: 'Create Reconciliation Account' }).click();

    const dialog = page.getByRole('dialog', { name: 'Create Reconciliation Account' });

    await expect(
      dialog.getByRole('button', { name: 'Create Account' }),
      'submit button shall be disabled when no account type is selected'
    ).toBeDisabled();

    await dialog.getByRole('button', { name: 'Reconciliation Adjustment' }).click();

    await expect(
      dialog.getByRole('button', { name: 'Create Account' }),
      'submit button shall be enabled when account type is selected'
    ).toBeEnabled();

    await dialog.getByLabel('Account Code').focus();
    await dialog.getByLabel('Account Code').blur();

    await expect(
      dialog.getByLabel('Account Code'),
      'account code field shall show validation error for duplicate'
    ).toHaveJSProperty('validationMessage', 'Account code already exists.');
    await expect(
      dialog.getByLabel('Account Code'),
      'account code field shall be invalid for duplicate'
    ).toHaveJSProperty('validity.valid', false);

    await page.evaluate(setupDuplicateAccountNameTest, { tursoDatabaseUrl: tursoLibSQLiteServer().url, accountCode: 82201, accountName: 'Existing Name' });

    await dialog.getByLabel('Account Code').fill('82201');
    await dialog.getByLabel('Account Name').fill('Existing Name');
    await dialog.getByLabel('Account Name').blur();

    await expect(
      dialog.getByLabel('Account Name'),
      'account name field shall be invalid for duplicate'
    ).toHaveJSProperty('validity.valid', false);
    await expect(
      dialog.getByLabel('Account Name'),
      'account name field shall show validation error for duplicate'
    ).toHaveJSProperty('validationMessage', 'Account name already exists.');

    await expect(
      dialog.getByRole('button', { name: 'Create Account' }),
      'submit button shall be disabled when duplicate account name is entered'
    ).toBeDisabled();
  });

  test('reset form when dialog is closed and reopened', async function ({ page }) {
    await Promise.all([
      loadEmptyFixture(page),
      setupDatabase(tursoLibSQLiteServer(), async function setupData(sql) { }),
    ]);
    await page.evaluate(setupView, tursoLibSQLiteServer().url);

    await page.getByRole('button', { name: 'Create Reconciliation Account' }).click();

    const dialog = page.getByRole('dialog', { name: 'Create Reconciliation Account' });
    await dialog.getByRole('button', { name: 'Reconciliation Adjustment' }).click();

    await dialog.getByLabel('Account Code').fill('99999');

    await page.keyboard.press('Escape');
    await expect(dialog, 'dialog shall close on Escape key').not.toBeVisible();

    await page.getByRole('button', { name: 'Create Reconciliation Account' }).click();
    await expect(dialog, 'dialog shall be visible after reopening').toBeVisible();

    await expect(
      dialog.getByRole('button', { name: 'Reconciliation Adjustment' }),
      'reconciliation adjustment button shall be visible after reset'
    ).toBeVisible();
    await expect(
      dialog.getByRole('button', { name: 'Cash Over/Short' }),
      'cash over/short button shall be visible after reset'
    ).toBeVisible();
  });
});
