import { test, expect } from '@playwright/test';
import { useTursoLibSQLiteServer } from '#test/hooks/use-turso-libsqlite-server.js';
import { useStrict } from '#test/hooks/use-strict.js';
import { loadEmptyFixture } from '#test/tools/fixture.js';
import { setupDatabase } from '#test/tools/database.js';
/** @import { DatabaseContextElement } from '#web/contexts/database-context.js' */

const { describe } = test;

/** @param {string} tursoDatabaseUrl */
async function setupView(tursoDatabaseUrl) {
  document.body.innerHTML = `
    <ready-context>
      <time-context>
        <router-context>
          <database-context provider="turso" turso-url="${tursoDatabaseUrl}">
            <device-context>
              <i18n-context>
                <onboarding-context>
                  <main-view></main-view>
                </onboarding-context>
              </i18n-context>
            </device-context>
          </database-context>
        </router-context>
      <time-context>
    </ready-context>
  `;
}

describe('Account Tag Assignment Dialog', function () {
  useStrict(test);

  describe('Dialog Opening', function () {
    const tursoLibSQLiteServer = useTursoLibSQLiteServer(test);

    test('shall open dialog when manage button is clicked', async function ({ page }) {
      await Promise.all([
        loadEmptyFixture(page),
        setupDatabase(tursoLibSQLiteServer(), async function setupData(sql) {}),
      ]);

      await page.evaluate(setupView, tursoLibSQLiteServer().url);

      await page.pause();
      await page.getByRole('link', { name: 'Books' }).click();

      await page.getByRole('tab', { name: 'Account Tags' }).click();

      const treegrid = page.getByRole('treegrid', { name: 'Account Tags' });
      const tagRow = treegrid.getByRole('row').nth(1);
      const manageButton = tagRow.getByRole('button').first();
      await manageButton.click();

      const dialog = page.getByRole('dialog');
      await expect(dialog).toBeVisible();
    });

    test('shall display dialog title with tag name', async function ({ page }) {
      await Promise.all([
        loadEmptyFixture(page),
        setupDatabase(tursoLibSQLiteServer(), async function setupData(sql) {}),
      ]);

      await page.evaluate(setupView, tursoLibSQLiteServer().url);

      await page.getByRole('link', { name: 'Books' }).click();

      await page.getByRole('tab', { name: 'Account Tags' }).click();

      const treegrid = page.getByRole('treegrid', { name: 'Account Tags' });
      const tagRow = treegrid.getByRole('row').nth(1);
      const manageButton = tagRow.getByRole('button').first();
      await manageButton.click();

      const dialog = page.getByRole('dialog');
      await expect(dialog).toBeVisible();
      await expect(dialog.locator('h2')).toBeVisible();
    });

    test('shall have close button in dialog', async function ({ page }) {
      await Promise.all([
        loadEmptyFixture(page),
        setupDatabase(tursoLibSQLiteServer(), async function setupData(sql) {}),
      ]);

      await page.evaluate(setupView, tursoLibSQLiteServer().url);

      await page.getByRole('link', { name: 'Books' }).click();

      await page.getByRole('tab', { name: 'Account Tags' }).click();

      const treegrid = page.getByRole('treegrid', { name: 'Account Tags' });
      const tagRow = treegrid.getByRole('row').nth(1);
      const manageButton = tagRow.getByRole('button').first();
      await manageButton.click();

      const dialog = page.getByRole('dialog');
      await expect(dialog).toBeVisible();
      await expect(dialog.getByRole('button').first()).toBeVisible();
    });
  });

  describe('Accounts List Display', function () {
    const tursoLibSQLiteServer = useTursoLibSQLiteServer(test);

    test('shall display accounts list table', async function ({ page }) {
      await Promise.all([
        loadEmptyFixture(page),
        setupDatabase(tursoLibSQLiteServer(), async function setupData(sql) {}),
      ]);

      await page.evaluate(setupView, tursoLibSQLiteServer().url);

      await page.getByRole('link', { name: 'Books' }).click();

      await page.getByRole('tab', { name: 'Account Tags' }).click();

      const treegrid = page.getByRole('treegrid', { name: 'Account Tags' });
      const tagRow = treegrid.getByRole('row').nth(1);
      const manageButton = tagRow.getByRole('button').first();
      await manageButton.click();

      const dialog = page.getByRole('dialog');
      await expect(dialog).toBeVisible();

      const accountsTable = dialog.getByRole('table', { name: 'Accounts list' });
      await expect(accountsTable).toBeVisible();
    });

    test('shall display table column headers', async function ({ page }) {
      await Promise.all([
        loadEmptyFixture(page),
        setupDatabase(tursoLibSQLiteServer(), async function setupData(sql) {}),
      ]);

      await page.evaluate(setupView, tursoLibSQLiteServer().url);

      await page.getByRole('link', { name: 'Books' }).click();

      await page.getByRole('tab', { name: 'Account Tags' }).click();

      const treegrid = page.getByRole('treegrid', { name: 'Account Tags' });
      const tagRow = treegrid.getByRole('row').nth(1);
      const manageButton = tagRow.getByRole('button').first();
      await manageButton.click();

      const dialog = page.getByRole('dialog');
      await expect(dialog).toBeVisible();

      await expect(dialog.getByRole('columnheader', { name: 'Code' })).toBeVisible();
      await expect(dialog.getByRole('columnheader', { name: 'Name' })).toBeVisible();
    });

    test('shall display all active accounts', async function ({ page }) {
      await Promise.all([
        loadEmptyFixture(page),
        setupDatabase(tursoLibSQLiteServer(), async function setupData(sql) {}),
      ]);

      await page.evaluate(setupView, tursoLibSQLiteServer().url);

      await page.getByRole('link', { name: 'Books' }).click();

      await page.getByRole('tab', { name: 'Account Tags' }).click();

      const treegrid = page.getByRole('treegrid', { name: 'Account Tags' });
      const tagRow = treegrid.getByRole('row').nth(1);
      const manageButton = tagRow.getByRole('button').first();
      await manageButton.click();

      const dialog = page.getByRole('dialog');
      await expect(dialog).toBeVisible();

      const accountsTable = dialog.getByRole('table', { name: 'Accounts list' });
      await expect(accountsTable).toBeVisible();
    });

    test('shall display loading indicator while loading accounts', async function ({ page }) {
      await Promise.all([
        loadEmptyFixture(page),
        setupDatabase(tursoLibSQLiteServer(), async function setupData(sql) {}),
      ]);

      await page.evaluate(setupView, tursoLibSQLiteServer().url);

      await page.getByRole('link', { name: 'Books' }).click();

      await page.getByRole('tab', { name: 'Account Tags' }).click();

      const treegrid = page.getByRole('treegrid', { name: 'Account Tags' });
      const tagRow = treegrid.getByRole('row').nth(1);
      const manageButton = tagRow.getByRole('button').first();
      await manageButton.click();

      const dialog = page.getByRole('dialog');
      await expect(dialog).toBeVisible();
    });
  });

  describe('Search Functionality', function () {
    const tursoLibSQLiteServer = useTursoLibSQLiteServer(test);

    test('shall have search input field', async function ({ page }) {
      await Promise.all([
        loadEmptyFixture(page),
        setupDatabase(tursoLibSQLiteServer(), async function setupData(sql) {}),
      ]);

      await page.evaluate(setupView, tursoLibSQLiteServer().url);

      await page.getByRole('link', { name: 'Books' }).click();

      await page.getByRole('tab', { name: 'Account Tags' }).click();

      const treegrid = page.getByRole('treegrid', { name: 'Account Tags' });
      const tagRow = treegrid.getByRole('row').nth(1);
      const manageButton = tagRow.getByRole('button').first();
      await manageButton.click();

      const dialog = page.getByRole('dialog');
      await expect(dialog).toBeVisible();
      await expect(dialog.getByLabel('Search accounts')).toBeVisible();
    });

    test('shall filter accounts by name', async function ({ page }) {
      await Promise.all([
        loadEmptyFixture(page),
        setupDatabase(tursoLibSQLiteServer(), async function setupData(sql) {
          await sql`INSERT INTO accounts (account_code, name, normal_balance, create_time, update_time) VALUES (99001, 'Cash', 0, 0, 0)`;
          await sql`INSERT INTO accounts (account_code, name, normal_balance, create_time, update_time) VALUES (99002, 'Bank Account', 0, 0, 0)`;
          await sql`INSERT INTO accounts (account_code, name, normal_balance, create_time, update_time) VALUES (99003, 'Accounts Payable', 1, 0, 0)`;
        }),
      ]);

      await page.evaluate(setupView, tursoLibSQLiteServer().url);

      await page.getByRole('link', { name: 'Books' }).click();

      await page.getByRole('tab', { name: 'Account Tags' }).click();

      const treegrid = page.getByRole('treegrid', { name: 'Account Tags' });
      const tagRow = treegrid.getByRole('row').nth(1);
      const manageButton = tagRow.getByRole('button').first();
      await manageButton.click();

      const dialog = page.getByRole('dialog');
      await expect(dialog).toBeVisible();

      await dialog.getByLabel('Search accounts').fill('Cash');

      const accountsTable = dialog.getByRole('table', { name: 'Accounts list' });
      await expect(accountsTable.getByText('Cash')).toBeVisible();
      await expect(accountsTable.getByText('Bank Account')).not.toBeVisible();
    });

    test('shall filter accounts by code', async function ({ page }) {
      await Promise.all([
        loadEmptyFixture(page),
        setupDatabase(tursoLibSQLiteServer(), async function setupData(sql) {
          await sql`INSERT INTO accounts (account_code, name, normal_balance, create_time, update_time) VALUES (99001, 'Cash', 0, 0, 0)`;
          await sql`INSERT INTO accounts (account_code, name, normal_balance, create_time, update_time) VALUES (99002, 'Bank Account', 0, 0, 0)`;
          await sql`INSERT INTO accounts (account_code, name, normal_balance, create_time, update_time) VALUES (99003, 'Accounts Payable', 1, 0, 0)`;
        }),
      ]);

      await page.evaluate(setupView, tursoLibSQLiteServer().url);

      await page.getByRole('link', { name: 'Books' }).click();

      await page.getByRole('tab', { name: 'Account Tags' }).click();

      const treegrid = page.getByRole('treegrid', { name: 'Account Tags' });
      const tagRow = treegrid.getByRole('row').nth(1);
      const manageButton = tagRow.getByRole('button').first();
      await manageButton.click();

      const dialog = page.getByRole('dialog');
      await expect(dialog).toBeVisible();

      await dialog.getByLabel('Search accounts').fill('990');

      const accountsTable = dialog.getByRole('table', { name: 'Accounts list' });
      await expect(accountsTable.getByText('99003')).toBeVisible();
      await expect(accountsTable.getByText('99001')).toBeVisible();
    });

    test('shall show empty state when no accounts match search', async function ({ page }) {
      await Promise.all([
        loadEmptyFixture(page),
        setupDatabase(tursoLibSQLiteServer(), async function setupData(sql) {
          await sql`INSERT INTO accounts (account_code, name, normal_balance, create_time, update_time) VALUES (99001, 'Cash', 0, 0, 0)`;
        }),
      ]);

      await page.evaluate(setupView, tursoLibSQLiteServer().url);

      await page.getByRole('link', { name: 'Books' }).click();

      await page.getByRole('tab', { name: 'Account Tags' }).click();

      const treegrid = page.getByRole('treegrid', { name: 'Account Tags' });
      const tagRow = treegrid.getByRole('row').nth(1);
      const manageButton = tagRow.getByRole('button').first();
      await manageButton.click();

      const dialog = page.getByRole('dialog');
      await expect(dialog).toBeVisible();

      await dialog.getByLabel('Search accounts').fill('Nonexistent Account');

      await expect(dialog.getByText('No accounts match your search')).toBeVisible();
    });
  });

  describe('Tag Assignment', function () {
    const tursoLibSQLiteServer = useTursoLibSQLiteServer(test);

    test('shall show checkbox for each account', async function ({ page }) {
      await Promise.all([
        loadEmptyFixture(page),
        setupDatabase(tursoLibSQLiteServer(), async function setupData(sql) {
          await sql`INSERT INTO accounts (account_code, name, normal_balance, create_time, update_time) VALUES (99001, 'Cash', 0, 0, 0)`;
        }),
      ]);

      await page.evaluate(setupView, tursoLibSQLiteServer().url);

      await page.getByRole('link', { name: 'Books' }).click();

      await page.getByRole('tab', { name: 'Account Tags' }).click();

      const treegrid = page.getByRole('treegrid', { name: 'Account Tags' });
      const tagRow = treegrid.getByRole('row').nth(1);
      const manageButton = tagRow.getByRole('button').first();
      await manageButton.click();

      const dialog = page.getByRole('dialog');
      await expect(dialog).toBeVisible();

      const accountsTable = dialog.getByRole('table', { name: 'Accounts list' });
      const accountCheckbox = accountsTable.getByRole('row').getByRole('checkbox', { name: 'Cash' });
      await expect(accountCheckbox).toBeVisible();
    });

    test('shall assign tag when clicking unchecked account', async function ({ page }) {
      await Promise.all([
        loadEmptyFixture(page),
        setupDatabase(tursoLibSQLiteServer(), async function setupData(sql) {
          await sql`INSERT INTO accounts (account_code, name, normal_balance, create_time, update_time) VALUES (99001, 'Cash', 0, 0, 0)`;
        }),
      ]);

      await page.evaluate(setupView, tursoLibSQLiteServer().url);

      await page.getByRole('link', { name: 'Books' }).click();
      await page.getByRole('tab', { name: 'Account Tags' }).click();

      const treegrid = page.getByRole('treegrid', { name: 'Account Tags' });
      const tagRow = treegrid.getByRole('row').nth(1);
      const manageButton = tagRow.getByRole('button').first();
      await manageButton.click();

      const dialog = page.getByRole('dialog', { name: 'Manage Tag' });
      await expect(dialog).toBeVisible();

      const accountsTable = dialog.getByRole('table', { name: 'Accounts list' });
      const accountCheckbox = accountsTable.getByRole('row').getByRole('checkbox', { name: 'Cash' });
      await accountCheckbox.click();

      await expect(accountCheckbox).toBeChecked();
    });

    test('shall remove tag when clicking checked account', async function ({ page }) {
      await Promise.all([
        loadEmptyFixture(page),
        setupDatabase(tursoLibSQLiteServer(), async function setupData(sql) {
          await sql`INSERT INTO accounts (account_code, name, normal_balance, create_time, update_time) VALUES (99001, 'Cash', 0, 0, 0)`;
          await sql`INSERT INTO account_tags (account_code, tag) VALUES (99001, 'Asset')`;
        }),
      ]);

      await page.evaluate(setupView, tursoLibSQLiteServer().url);

      await page.getByRole('link', { name: 'Books' }).click();

      await page.getByRole('tab', { name: 'Account Tags' }).click();

      const treegrid = page.getByRole('treegrid', { name: 'Account Tags' });
      const assetTagRow = treegrid.getByRole('row').filter({ hasText: 'Asset' });
      const manageButton = assetTagRow.getByRole('button').first();
      await manageButton.click();

      const dialog = page.getByRole('dialog');
      await expect(dialog).toBeVisible();

      const accountsTable = dialog.getByRole('table', { name: 'Accounts list' });
      const accountCheckbox = accountsTable.getByRole('checkbox', { name: 'Cash' });
      await expect(accountCheckbox).toBeChecked();

      await accountCheckbox.click();

      await expect(accountCheckbox).not.toBeChecked();
    });

    test('shall display assigned count', async function ({ page }) {
      await Promise.all([
        loadEmptyFixture(page),
        setupDatabase(tursoLibSQLiteServer(), async function setupData(sql) {
          await sql`INSERT INTO accounts (account_code, name, normal_balance, create_time, update_time) VALUES (99001, 'Cash', 0, 0, 0)`;
          await sql`INSERT INTO accounts (account_code, name, normal_balance, create_time, update_time) VALUES (99002, 'Bank', 0, 0, 0)`;
          await sql`INSERT INTO account_tags (account_code, tag) VALUES (99001, 'Asset')`;
        }),
      ]);

      await page.evaluate(setupView, tursoLibSQLiteServer().url);

      await page.getByRole('link', { name: 'Books' }).click();

      await page.getByRole('tab', { name: 'Account Tags' }).click();

      const treegrid = page.getByRole('treegrid', { name: 'Account Tags' });
      const assetTagRow = treegrid.getByRole('row').filter({ hasText: 'Asset' });
      const manageButton = assetTagRow.getByRole('button').first();
      await manageButton.click();

      const dialog = page.getByRole('dialog');
      await expect(dialog).toBeVisible();

      await expect(dialog.getByText(/1 account assigned|accounts assigned/)).toBeVisible();
    });
  });

  describe('Unique Tags', function () {
    const tursoLibSQLiteServer = useTursoLibSQLiteServer(test);

    test('shall show warning for unique tags', async function ({ page }) {
      await Promise.all([
        loadEmptyFixture(page),
        setupDatabase(tursoLibSQLiteServer(), async function setupData(sql) {
          await sql`INSERT INTO accounts (account_code, name, normal_balance, create_time, update_time) VALUES (99001, 'Cash', 0, 0, 0)`;
        }),
      ]);

      await page.evaluate(setupView, tursoLibSQLiteServer().url);

      await page.getByRole('link', { name: 'Books' }).click();

      await page.getByRole('tab', { name: 'Account Tags' }).click();

      const treegrid = page.getByRole('treegrid', { name: 'Account Tags' });
      const uniqueTagRow = treegrid.getByRole('row').filter({ hasText: 'Fiscal Year Closing - Retained Earning' });
      const manageButton = uniqueTagRow.getByRole('button').first();
      await manageButton.click();

      const dialog = page.getByRole('dialog');
      await expect(dialog).toBeVisible();

      await expect(dialog.getByText(/Only one account can have this tag|unique/i)).toBeVisible();
    });

    test('shall unassign from previous account when assigning unique tag', async function ({ page }) {
      await Promise.all([
        loadEmptyFixture(page),
        setupDatabase(tursoLibSQLiteServer(), async function setupData(sql) {
          await sql`DELETE FROM account_tags WHERE tag = 'Fiscal Year Closing - Retained Earning'`;
          await sql`INSERT INTO accounts (account_code, name, normal_balance, create_time, update_time) VALUES (99004, 'Retained Earnings', 1, 0, 0)`;
          await sql`INSERT INTO accounts (account_code, name, normal_balance, create_time, update_time) VALUES (99005, 'Other Equity', 1, 0, 0)`;
          await sql`INSERT INTO account_tags (account_code, tag) VALUES (99004, 'Fiscal Year Closing - Retained Earning')`;
        }),
      ]);

      await page.evaluate(setupView, tursoLibSQLiteServer().url);

      await page.getByRole('link', { name: 'Books' }).click();

      await page.getByRole('tab', { name: 'Account Tags' }).click();

      const treegrid = page.getByRole('treegrid', { name: 'Account Tags' });
      const uniqueTagRow = treegrid.getByRole('row').filter({ hasText: 'Fiscal Year Closing - Retained Earning' });
      const manageButton = uniqueTagRow.getByRole('button').first();
      await manageButton.click();

      const dialog = page.getByRole('dialog');
      await expect(dialog).toBeVisible();

      const accountsTable = dialog.getByRole('table', { name: 'Accounts list' });
      const firstAccountCheckbox = accountsTable.getByRole('checkbox', { name: 'Retained Earnings' });
      const secondAccountCheckbox = accountsTable.getByRole('checkbox', { name: 'Other Equity' });

      await expect(firstAccountCheckbox).toBeChecked();
      await expect(secondAccountCheckbox).not.toBeChecked();

      await secondAccountCheckbox.click();

      await expect(firstAccountCheckbox).not.toBeChecked();
      await expect(secondAccountCheckbox).toBeChecked();
    });
  });

  describe('Category Display', function () {
    const tursoLibSQLiteServer = useTursoLibSQLiteServer(test);

    test('shall display tag category', async function ({ page }) {
      await Promise.all([
        loadEmptyFixture(page),
        setupDatabase(tursoLibSQLiteServer(), async function setupData(sql) {}),
      ]);

      await page.evaluate(setupView, tursoLibSQLiteServer().url);

      await page.getByRole('link', { name: 'Books' }).click();

      await page.getByRole('tab', { name: 'Account Tags' }).click();

      const treegrid = page.getByRole('treegrid', { name: 'Account Tags' });
      const tagRow = treegrid.getByRole('row').nth(1);
      const manageButton = tagRow.getByRole('button').first();
      await manageButton.click();

      const dialog = page.getByRole('dialog');
      await expect(dialog).toBeVisible();

      await expect(dialog.getByText('Category')).toBeVisible();
    });
  });

  describe('Dialog Closing', function () {
    const tursoLibSQLiteServer = useTursoLibSQLiteServer(test);

    test('shall close dialog when close button is clicked', async function ({ page }) {
      await Promise.all([
        loadEmptyFixture(page),
        setupDatabase(tursoLibSQLiteServer(), async function setupData(sql) {}),
      ]);

      await page.evaluate(setupView, tursoLibSQLiteServer().url);

      await page.getByRole('link', { name: 'Books' }).click();

      await page.getByRole('tab', { name: 'Account Tags' }).click();

      const treegrid = page.getByRole('treegrid', { name: 'Account Tags' });
      const tagRow = treegrid.getByRole('row').nth(1);
      const manageButton = tagRow.getByRole('button').first();
      await manageButton.click();

      const dialog = page.getByRole('dialog');
      await expect(dialog).toBeVisible();

      await dialog.getByRole('button').first().click();

      await expect(dialog).not.toBeVisible();
    });

    test('shall close dialog when escape key is pressed', async function ({ page }) {
      await Promise.all([
        loadEmptyFixture(page),
        setupDatabase(tursoLibSQLiteServer(), async function setupData(sql) {}),
      ]);

      await page.evaluate(setupView, tursoLibSQLiteServer().url);

      await page.getByRole('link', { name: 'Books' }).click();

      await page.getByRole('tab', { name: 'Account Tags' }).click();

      const treegrid = page.getByRole('treegrid', { name: 'Account Tags' });
      const tagRow = treegrid.getByRole('row').nth(1);
      const manageButton = tagRow.getByRole('button').first();
      await manageButton.click();

      const dialog = page.getByRole('dialog');
      await expect(dialog).toBeVisible();

      await page.keyboard.press('Escape');

      await expect(dialog).not.toBeVisible();
    });

    test('shall update tag count in main view after assignment', async function ({ page }) {
      await Promise.all([
        loadEmptyFixture(page),
        setupDatabase(tursoLibSQLiteServer(), async function setupData(sql) {
          await sql`INSERT INTO accounts (account_code, name, normal_balance, create_time, update_time) VALUES (99001, 'Cash', 0, 0, 0)`;
        }),
      ]);

      await page.evaluate(setupView, tursoLibSQLiteServer().url);

      await page.getByRole('link', { name: 'Books' }).click();

      await page.getByRole('tab', { name: 'Account Tags' }).click();

      const treegrid = page.getByRole('treegrid', { name: 'Account Tags' });
      const tagRow = treegrid.getByRole('row').nth(1);
      const manageButton = tagRow.getByRole('button').first();
      await manageButton.click();

      const dialog = page.getByRole('dialog');
      await expect(dialog).toBeVisible();

      const accountsTable = dialog.getByRole('table', { name: 'Accounts list' });
      const accountCheckbox = accountsTable.getByRole('checkbox', { name: 'Cash' });
      await accountCheckbox.click();

      await expect(accountCheckbox).toBeChecked();

      await dialog.getByRole('button').first().click();
      await expect(dialog).not.toBeVisible();
    });
  });

  describe('Error Handling', function () {
    const tursoLibSQLiteServer = useTursoLibSQLiteServer(test);

    test('shall display error dialog on assignment failure', async function ({ page }) {
      await Promise.all([
        loadEmptyFixture(page),
        setupDatabase(tursoLibSQLiteServer(), async function setupData(sql) {
          await sql`INSERT INTO accounts (account_code, name, normal_balance, create_time, update_time) VALUES (99001, 'Cash', 0, 0, 0)`;
        }),
      ]);

      await page.evaluate(setupView, tursoLibSQLiteServer().url);

      await page.getByRole('link', { name: 'Books' }).click();

      await page.getByRole('tab', { name: 'Account Tags' }).click();

      const treegrid = page.getByRole('treegrid', { name: 'Account Tags' });
      const tagRow = treegrid.getByRole('row').nth(1);
      const manageButton = tagRow.getByRole('button').first();
      await manageButton.click();

      const dialog = page.getByRole('dialog');
      await expect(dialog).toBeVisible();

      await page.evaluate(async function simulateDatabaseError() {
        /** @type {DatabaseContextElement} */
        const database = document.querySelector('database-context');
        const originalTransaction = database.transaction.bind(database);
        database.transaction = async function faultyTransaction() {
          const tx = await originalTransaction('write');
          const originalSql = tx.sql.bind(tx);
          /**
           * @param {TemplateStringsArray} strings
           * @param  {...unknown} values
           */
          tx.sql = function faultySql(strings, ...values) {
            if (strings[0].includes('INSERT INTO account_tags')) {
              throw new Error('Simulated database error');
            }
            return originalSql(strings, ...values);
          };
          return tx;
        };
      });

      const accountsTable = dialog.getByRole('table', { name: 'Accounts list' });
      const accountCheckbox = accountsTable.getByRole('checkbox', { name: 'Cash' });
      await accountCheckbox.click();

      await expect(page.getByRole('alertdialog')).toBeVisible();
      await expect(page.getByText('Simulated database error')).toBeVisible();
    });

    test('shall dismiss error dialog when clicking dismiss button', async function ({ page }) {
      await Promise.all([
        loadEmptyFixture(page),
        setupDatabase(tursoLibSQLiteServer(), async function setupData(sql) {
          await sql`INSERT INTO accounts (account_code, name, normal_balance, create_time, update_time) VALUES (99001, 'Cash', 0, 0, 0)`;
        }),
      ]);

      await page.evaluate(setupView, tursoLibSQLiteServer().url);

      await page.getByRole('link', { name: 'Books' }).click();

      await page.getByRole('tab', { name: 'Account Tags' }).click();

      const treegrid = page.getByRole('treegrid', { name: 'Account Tags' });
      const tagRow = treegrid.getByRole('row').nth(1);
      const manageButton = tagRow.getByRole('button').first();
      await manageButton.click();

      const dialog = page.getByRole('dialog');
      await expect(dialog).toBeVisible();

      await page.evaluate(async function simulateDatabaseError() {
        /** @type {DatabaseContextElement} */
        const database = document.querySelector('database-context');
        const originalTransaction = database.transaction.bind(database);
        database.transaction = async function faultyTransaction() {
          const tx = await originalTransaction('write');
          const originalSql = tx.sql.bind(tx);
          /**
           * @param {TemplateStringsArray} strings
           * @param  {...unknown} values
           */
          tx.sql = function faultySql(strings, ...values) {
            if (strings[0].includes('INSERT INTO account_tags')) {
              throw new Error('Simulated database error');
            }
            return originalSql(strings, ...values);
          };
          return tx;
        };
      });

      const accountsTable = dialog.getByRole('table', { name: 'Accounts list' });
      const accountCheckbox = accountsTable.getByRole('checkbox', { name: 'Cash' });
      await accountCheckbox.click();

      const errorDialog = page.getByRole('alertdialog');
      await expect(errorDialog).toBeVisible();

      await errorDialog.getByRole('button', { name: 'Dismiss' }).click();

      await expect(errorDialog).not.toBeVisible();
    });
  });
});
