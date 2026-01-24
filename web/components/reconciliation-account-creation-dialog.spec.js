import { test, expect } from '@playwright/test';
import { useTursoLibSQLiteServer } from '#test/playwright/hooks/use-turso-libsqlite-server.js';
import { setupDatabase } from '#test/playwright/tools/database.js';
import { useStrict } from '#test/playwright/hooks/use-strict.js';
import { loadEmptyFixture } from '#test/playwright/tools/fixture.js';

/** @import { DatabaseContextElement } from '#web/contexts/database-context.js' */

const { describe } = test;

/** @param {string} tursoDatabaseUrl */
async function setupView(tursoDatabaseUrl) {
  document.body.innerHTML = `
    <ready-context>
      <router-context>
        <database-context provider="turso" turso-url="${tursoDatabaseUrl}">
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

describe('Reconciliation Account Creation Dialog', function () {
  useStrict(test);

  describe('Dialog Opening and Account Type Selection', function () {
    const tursoLibSQLiteServer = useTursoLibSQLiteServer(test);

    test('shall open dialog when button is clicked', async function ({ page }) {
      await Promise.all([
        loadEmptyFixture(page),
        setupDatabase(tursoLibSQLiteServer(), async function setupData(sql) { }),
      ]);
      await page.evaluate(setupView, tursoLibSQLiteServer().url);

      await page.getByRole('button', { name: 'Create Reconciliation Account' }).click();

      const dialog = page.getByRole('dialog', { name: 'Create Reconciliation Account' });
      await expect(dialog).toBeVisible();
    });

    test('shall show account type selection initially', async function ({ page }) {
      await Promise.all([
        loadEmptyFixture(page),
        setupDatabase(tursoLibSQLiteServer(), async function setupData(sql) { }),
      ]);
      await page.evaluate(setupView, tursoLibSQLiteServer().url);

      await page.getByRole('button', { name: 'Create Reconciliation Account' }).click();

      const dialog = page.getByRole('dialog', { name: 'Create Reconciliation Account' });

      await expect(dialog.getByRole('button', { name: 'Reconciliation Adjustment' })).toBeVisible();
      await expect(dialog.getByRole('button', { name: 'Cash Over/Short' })).toBeVisible();
    });

    test('shall show form when adjustment account type is selected', async function ({ page }) {
      await Promise.all([
        loadEmptyFixture(page),
        setupDatabase(tursoLibSQLiteServer(), async function setupData(sql) { }),
      ]);
      await page.evaluate(setupView, tursoLibSQLiteServer().url);

      await page.getByRole('button', { name: 'Create Reconciliation Account' }).click();

      const dialog = page.getByRole('dialog', { name: 'Create Reconciliation Account' });
      await dialog.getByRole('button', { name: 'Reconciliation Adjustment' }).click();

      // Should show the form fields
      await expect(dialog.getByLabel('Account Code')).toBeVisible();
      await expect(dialog.getByLabel('Account Name')).toBeVisible();
    });

    test('shall show form when cash over/short account type is selected', async function ({ page }) {
      await Promise.all([
        loadEmptyFixture(page),
        setupDatabase(tursoLibSQLiteServer(), async function setupData(sql) { }),
      ]);
      await page.evaluate(setupView, tursoLibSQLiteServer().url);

      await page.getByRole('button', { name: 'Create Reconciliation Account' }).click();

      const dialog = page.getByRole('dialog', { name: 'Create Reconciliation Account' });
      await dialog.getByRole('button', { name: 'Cash Over/Short' }).click();

      await expect(dialog.getByLabel('Account Code')).toBeVisible();
      await expect(dialog.getByLabel('Account Name')).toBeVisible();
    });

    test('shall allow going back to account type selection', async function ({ page }) {
      await Promise.all([
        loadEmptyFixture(page),
        setupDatabase(tursoLibSQLiteServer(), async function setupData(sql) { }),
      ]);
      await page.evaluate(setupView, tursoLibSQLiteServer().url);

      await page.getByRole('button', { name: 'Create Reconciliation Account' }).click();

      const dialog = page.getByRole('dialog', { name: 'Create Reconciliation Account' });
      await dialog.getByRole('button', { name: 'Reconciliation Adjustment' }).click();

      await dialog.getByRole('button', { name: 'Change account type' }).click();

      await expect(dialog.getByRole('button', { name: 'Reconciliation Adjustment' })).toBeVisible();
      await expect(dialog.getByRole('button', { name: 'Cash Over/Short' })).toBeVisible();
    });
  });

  describe('Creating Reconciliation Adjustment Account', function () {
    const tursoLibSQLiteServer = useTursoLibSQLiteServer(test);

    test('shall create reconciliation adjustment account with correct tags', async function ({ page }) {
      await Promise.all([
        loadEmptyFixture(page),
        setupDatabase(tursoLibSQLiteServer(), async function setupData(sql) { }),
      ]);
      await page.evaluate(setupView, tursoLibSQLiteServer().url);

      await page.getByRole('button', { name: 'Create Reconciliation Account' }).click();

      const dialog = page.getByRole('dialog', { name: 'Create Reconciliation Account' });
      await dialog.getByRole('button', { name: 'Reconciliation Adjustment' }).click();

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

      expect(accountCreatedEvent.accountCode).toBe(82201);
      expect(accountCreatedEvent.accountType).toBe('adjustment');

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

      expect(accountData.account_code).toBe('82201');
      expect(accountData.name).toBe('Reconciliation Adjustments');
      expect(accountData.normal_balance).toBe('0'); // Debit normal balance for expense accounts

      const tags = String(accountData.tags).split(',');
      expect(tags).toContain('Expense');
      expect(tags).toContain('Reconciliation - Adjustment');
    });

    test('shall use suggested values for adjustment account', async function ({ page }) {
      await Promise.all([
        loadEmptyFixture(page),
        setupDatabase(tursoLibSQLiteServer(), async function setupData(sql) { }),
      ]);
      await page.evaluate(setupView, tursoLibSQLiteServer().url);

      await page.getByRole('button', { name: 'Create Reconciliation Account' }).click();

      const dialog = page.getByRole('dialog', { name: 'Create Reconciliation Account' });
      await dialog.getByRole('button', { name: 'Reconciliation Adjustment' }).click();

      // Check suggested values
      await expect(dialog.getByLabel('Account Code')).toHaveValue('82200');
      await expect(dialog.getByLabel('Account Name')).toHaveValue('Reconciliation Adjustment');
    });
  });

  describe('Creating Cash Over/Short Account', function () {
    const tursoLibSQLiteServer = useTursoLibSQLiteServer(test);

    test('shall create cash over/short account with correct tags', async function ({ page }) {
      await Promise.all([
        loadEmptyFixture(page),
        setupDatabase(tursoLibSQLiteServer(), async function setupData(sql) { }),
      ]);
      await page.evaluate(setupView, tursoLibSQLiteServer().url);

      await page.getByRole('button', { name: 'Create Reconciliation Account' }).click();

      const dialog = page.getByRole('dialog', { name: 'Create Reconciliation Account' });
      await dialog.getByRole('button', { name: 'Cash Over/Short' }).click();

      await dialog.getByLabel('Account Code').fill('82210');
      await dialog.getByLabel('Account Name').fill('Cash Over and Short');

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

      expect(accountCreatedEvent.accountCode).toBe(82210);
      expect(accountCreatedEvent.accountType).toBe('cashOverShort');

      // Verify account was created in database with correct properties
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
          WHERE a.account_code = 82210
          GROUP BY a.account_code
        `;
        return result.rows[0];
      });

      expect(accountData.account_code).toBe('82210');
      expect(accountData.name).toBe('Cash Over and Short');
      expect(accountData.normal_balance).toBe('0'); // Debit normal balance for expense accounts

      const tags = String(accountData.tags).split(',');
      expect(tags).toContain('Expense');
      expect(tags).toContain('Reconciliation - Cash Over/Short');
    });

    test('shall replace existing cash over/short tag when creating new account', async function ({ page }) {
      await Promise.all([
        loadEmptyFixture(page),
        setupDatabase(tursoLibSQLiteServer(), async function setupData(sql) { }),
      ]);

      // Create an existing account with Cash Over/Short tag
      await page.evaluate(async function setupExistingCashOverShortAccount(tursoDatabaseUrl) {
        document.body.innerHTML = `
          <ready-context>
            <router-context>
              <database-context provider="turso" turso-url="${tursoDatabaseUrl}">
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
      }, tursoLibSQLiteServer().url);

      await page.getByRole('button', { name: 'Create Reconciliation Account' }).click();

      const dialog = page.getByRole('dialog', { name: 'Create Reconciliation Account' });
      await dialog.getByRole('button', { name: 'Cash Over/Short' }).click();

      await dialog.getByLabel('Account Code').fill('82210');
      await dialog.getByLabel('Account Name').fill('New Cash Over Short');

      await dialog.getByRole('button', { name: 'Create Account' }).click();

      // Wait for dialog to close
      await expect(dialog).not.toBeVisible();

      // Verify old account lost the tag, new account has it
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

      // Old account should only have Expense tag
      expect(accountsData[0].account_code).toBe('82209');
      expect(accountsData[0].tags).toBe('Expense');

      // New account should have both tags
      expect(accountsData[1].account_code).toBe('82210');
      const newTags = String(accountsData[1].tags).split(',');
      expect(newTags).toContain('Expense');
      expect(newTags).toContain('Reconciliation - Cash Over/Short');
    });

    test('shall use suggested values for cash over/short account', async function ({ page }) {
      await Promise.all([
        loadEmptyFixture(page),
        setupDatabase(tursoLibSQLiteServer(), async function setupData(sql) { }),
      ]);
      await page.evaluate(setupView, tursoLibSQLiteServer().url);

      await page.getByRole('button', { name: 'Create Reconciliation Account' }).click();

      const dialog = page.getByRole('dialog', { name: 'Create Reconciliation Account' });
      await dialog.getByRole('button', { name: 'Cash Over/Short' }).click();

      // Check suggested values
      await expect(dialog.getByLabel('Account Code')).toHaveValue('82210');
      await expect(dialog.getByLabel('Account Name')).toHaveValue('Cash Over/Short');
    });
  });

  describe('Validation', function () {
    const tursoLibSQLiteServer = useTursoLibSQLiteServer(test);

    test('shall validate duplicate account code', async function ({ page }) {
      await Promise.all([
        loadEmptyFixture(page),
        setupDatabase(tursoLibSQLiteServer(), async function setupData(sql) { }),
      ]);

      await page.evaluate(async function setupDuplicateAccountCodeTest(tursoDatabaseUrl) {
        document.body.innerHTML = `
          <ready-context>
            <router-context>
              <database-context provider="turso" turso-url="${tursoDatabaseUrl}">
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
        // Account 82200 already exists in seeded data, so we don't need to insert it
      }, tursoLibSQLiteServer().url);

      await page.getByRole('button', { name: 'Create Reconciliation Account' }).click();

      const dialog = page.getByRole('dialog', { name: 'Create Reconciliation Account' });
      await dialog.getByRole('button', { name: 'Reconciliation Adjustment' }).click();

      // The code field should already have 82200 (the suggested value), which exists in seeded data
      // Focus first to ensure blur triggers
      await dialog.getByLabel('Account Code').focus();
      await dialog.getByLabel('Account Code').blur();

      // Should show error message using HTML5 validation
      // Wait for the validation message to be set (async validation)
      await expect(dialog.getByLabel('Account Code')).toHaveJSProperty('validationMessage', 'Account code already exists.');
      await expect(dialog.getByLabel('Account Code')).toHaveJSProperty('validity.valid', false);
    });

    test('shall validate duplicate account name', async function ({ page }) {
      await Promise.all([
        loadEmptyFixture(page),
        setupDatabase(tursoLibSQLiteServer(), async function setupData(sql) { }),
      ]);

      await page.evaluate(async function setupDuplicateAccountNameTest(tursoDatabaseUrl) {
        document.body.innerHTML = `
          <ready-context>
            <router-context>
              <database-context provider="turso" turso-url="${tursoDatabaseUrl}">
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
        await database.sql`
          INSERT INTO accounts (account_code, name, normal_balance, create_time, update_time)
          VALUES (82199, 'Existing Name', 0, 0, 0)
        `;
      }, tursoLibSQLiteServer().url);

      await page.getByRole('button', { name: 'Create Reconciliation Account' }).click();

      const dialog = page.getByRole('dialog', { name: 'Create Reconciliation Account' });
      await dialog.getByRole('button', { name: 'Reconciliation Adjustment' }).click();

      await dialog.getByLabel('Account Code').fill('82201');
      await dialog.getByLabel('Account Name').fill('Existing Name');
      await dialog.getByLabel('Account Name').blur();

      // Should show error message using HTML5 validation
      await expect(dialog.getByLabel('Account Name')).toHaveJSProperty('validity.valid', false);
      await expect(dialog.getByLabel('Account Name')).toHaveJSProperty('validationMessage', 'Account name already exists.');
    });

    test('shall disable submit button when no account type is selected', async function ({ page }) {
      await Promise.all([
        loadEmptyFixture(page),
        setupDatabase(tursoLibSQLiteServer(), async function setupData(sql) { }),
      ]);
      await page.evaluate(setupView, tursoLibSQLiteServer().url);

      await page.getByRole('button', { name: 'Create Reconciliation Account' }).click();

      const dialog = page.getByRole('dialog', { name: 'Create Reconciliation Account' });

      // Submit button should be disabled initially
      await expect(dialog.getByRole('button', { name: 'Create Account' })).toBeDisabled();
    });

    test('shall enable submit button when account type is selected', async function ({ page }) {
      await Promise.all([
        loadEmptyFixture(page),
        setupDatabase(tursoLibSQLiteServer(), async function setupData(sql) { }),
      ]);
      await page.evaluate(setupView, tursoLibSQLiteServer().url);

      await page.getByRole('button', { name: 'Create Reconciliation Account' }).click();

      const dialog = page.getByRole('dialog', { name: 'Create Reconciliation Account' });
      await dialog.getByRole('button', { name: 'Reconciliation Adjustment' }).click();

      // Submit button should be enabled now
      await expect(dialog.getByRole('button', { name: 'Create Account' })).toBeEnabled();
    });
  });

  describe('Dialog Reset', function () {
    const tursoLibSQLiteServer = useTursoLibSQLiteServer(test);

    test('shall reset form when dialog is closed and reopened', async function ({ page }) {
      await Promise.all([
        loadEmptyFixture(page),
        setupDatabase(tursoLibSQLiteServer(), async function setupData(sql) { }),
      ]);
      await page.evaluate(setupView, tursoLibSQLiteServer().url);

      await page.getByRole('button', { name: 'Create Reconciliation Account' }).click();

      const dialog = page.getByRole('dialog', { name: 'Create Reconciliation Account' });
      await dialog.getByRole('button', { name: 'Reconciliation Adjustment' }).click();

      await dialog.getByLabel('Account Code').fill('99999');

      // Close dialog
      await page.keyboard.press('Escape');
      await expect(dialog).not.toBeVisible();

      // Reopen dialog
      await page.getByRole('button', { name: 'Create Reconciliation Account' }).click();
      await expect(dialog).toBeVisible();

      // Should show account type selection (reset state)
      await expect(dialog.getByRole('button', { name: 'Reconciliation Adjustment' })).toBeVisible();
      await expect(dialog.getByRole('button', { name: 'Cash Over/Short' })).toBeVisible();
    });
  });
});
