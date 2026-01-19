import { test, expect } from '@playwright/test';
import { useConsoleOutput } from '#test/hooks/use-console-output.js';
import { useStrict } from '#test/hooks/use-strict.js';
import { useTursoLibSQLiteServer } from '#test/hooks/use-turso-libsqlite-server.js';
import { setupDatabase } from '#test/tools/database.js';
import { loadEmptyFixture } from '#test/tools/fixture.js';

/** @import { DatabaseContextElement } from '#web/contexts/database-context.js' */
/** @import { AccountTagAssignmentDialogElement } from '#web/components/account-tag-assignment-dialog.js' */

const { describe } = test;

/** 
 * @param {[string, string]} arg
 */
async function setupView([tursoDatabaseUrl, tag]) {
  document.body.innerHTML = `
    <ready-context>
      <router-context>
        <database-context provider="turso" turso-url="${tursoDatabaseUrl}">
          <device-context>
            <i18n-context>
              <account-tag-assignment-dialog id="account-tag-assignment-dialog"></account-tag-assignment-dialog>
              <button
                id="open-dialog-btn" 
                commandfor="account-tag-assignment-dialog" 
                command="--open"
                data-tag="${tag}"
              >Open Dialog</button>
            </i18n-context>
          </device-context>
        </database-context>
      </router-context>
    </ready-context>
  `;
}

describe('Account Tag Assignment Dialog', function () {
  // useConsoleOutput(test);
  useStrict(test);
  const tursoLibSQLiteServer = useTursoLibSQLiteServer(test);

  test('shall display dialog title with tag name and category', async function ({ page }) {
    await Promise.all([
      loadEmptyFixture(page),
      setupDatabase(tursoLibSQLiteServer(), async function setupData(sql) { }),
    ]);
    await page.evaluate(setupView, [tursoLibSQLiteServer().url, 'Asset']);

    await page.getByRole('button', { name: 'Open Dialog' }).click();
    const dialog = page.getByRole('dialog', { name: 'Manage Tag Asset' });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('heading', { name: 'Manage Tag Asset' })).toBeVisible();
    await expect(dialog.getByText('Account Types')).toBeVisible();
  });

  test('shall display list of accounts', async function ({ page }) {
    await Promise.all([
      loadEmptyFixture(page),
      setupDatabase(tursoLibSQLiteServer(), async function setupData(sql) {
        await sql`INSERT INTO accounts (account_code, name, normal_balance, create_time, update_time) VALUES (10001, 'Cash', 0, 0, 0)`;
        await sql`INSERT INTO accounts (account_code, name, normal_balance, create_time, update_time) VALUES (10002, 'Bank', 0, 0, 0)`;
      }),
    ]);
    await page.evaluate(setupView, [tursoLibSQLiteServer().url, 'Asset']);

    await page.getByRole('button', { name: 'Open Dialog' }).click();
    const dialog = page.getByRole('dialog', { name: 'Manage Tag Asset' });

    const table = dialog.getByRole('table', { name: 'Accounts list' });
    await expect(table).toBeVisible();
    await expect(table.getByRole('row', { name: 'Cash' })).toBeVisible();
    await expect(table.getByRole('row', { name: 'Bank 10002' })).toBeVisible();
  });

  test('shall filter accounts by search query', async function ({ page }) {
    await Promise.all([
      loadEmptyFixture(page),
      setupDatabase(tursoLibSQLiteServer(), async function setupData(sql) {
        await sql`INSERT INTO accounts (account_code, name, normal_balance, create_time, update_time) VALUES (10001, 'Cash', 0, 0, 0)`;
        await sql`INSERT INTO accounts (account_code, name, normal_balance, create_time, update_time) VALUES (20001, 'Liability', 0, 0, 0)`;
      }),
    ]);
    await page.evaluate(setupView, [tursoLibSQLiteServer().url, 'Asset']);
    await page.getByRole('button', { name: 'Open Dialog' }).click();
    const dialog = page.getByRole('dialog', { name: 'Manage Tag Asset' });

    await dialog.getByLabel('Search accounts').fill('Cash');
    const table = dialog.getByRole('table', { name: 'Accounts list' });
    await expect(table.getByText('Cash')).toBeVisible();
    await expect(table.getByText('Liability')).not.toBeVisible();

    await dialog.getByLabel('Search accounts').fill('20001');
    await expect(table.getByText('Liability')).toBeVisible();
    await expect(table.getByText('Cash')).not.toBeVisible();
  });

  test('shall show empty state when no accounts match search', async function ({ page }) {
    await Promise.all([
      loadEmptyFixture(page),
      setupDatabase(tursoLibSQLiteServer(), async function setupData(sql) {
        await sql`INSERT INTO accounts (account_code, name, normal_balance, create_time, update_time) VALUES (10001, 'Cash', 0, 0, 0)`;
      }),
    ]);
    await page.evaluate(setupView, [tursoLibSQLiteServer().url, 'Asset']);
    await page.getByRole('button', { name: 'Open Dialog' }).click();
    const dialog = page.getByRole('dialog', { name: 'Manage Tag Asset' });

    await dialog.getByLabel('Search accounts').fill('XYZ');
    await expect(dialog.getByText('No accounts match your search')).toBeVisible();
  });

  test('shall assign tag to account', async function ({ page }) {
    await Promise.all([
      loadEmptyFixture(page),
      setupDatabase(tursoLibSQLiteServer(), async function setupData(sql) {
        await sql`INSERT INTO accounts (account_code, name, normal_balance, create_time, update_time) VALUES (10001, 'Cash', 0, 0, 0)`;
      }),
    ]);
    await page.evaluate(setupView, [tursoLibSQLiteServer().url, 'Asset']);
    await page.getByRole('button', { name: 'Open Dialog' }).click();
    const dialog = page.getByRole('dialog', { name: 'Manage Tag Asset' });
    const table = dialog.getByRole('table', { name: 'Accounts list' });
    const checkbox = table.getByRole('row', { name: 'Cash' }).getByRole('checkbox');

    await expect(checkbox).not.toBeChecked();

    const [event] = await Promise.all([
      page.evaluate(async function waitForEvent() {
        const { waitForEvent } = await import('#web/tools/dom.js');
        /** @type {AccountTagAssignmentDialogElement} */
        const accountTagAssignmentDialog = document.querySelector('account-tag-assignment-dialog');
        const event = await waitForEvent(accountTagAssignmentDialog, 'tag-assignment-changed');
        if (event instanceof CustomEvent) return event.detail;
        else throw new Error(`Expected CustomEvent from tag-assignment-changed, got ${event.constructor.name} instead.`);
      }),
      checkbox.click()
    ]);

    expect(event).toEqual({ tag: 'Asset', accountCode: 10001, action: 'assign' });
    await expect(checkbox).toBeChecked();
    await expect(dialog.getByText('1 account assigned')).toBeVisible();
  });

  test('shall remove tag from account', async function ({ page }) {
    await Promise.all([
      loadEmptyFixture(page),
      setupDatabase(tursoLibSQLiteServer(), async function setupData(sql) {
        await sql`INSERT INTO accounts (account_code, name, normal_balance, create_time, update_time) VALUES (10001, 'Cash', 0, 0, 0)`;
        await sql`INSERT INTO account_tags (account_code, tag) VALUES (10001, 'Asset')`;
      }),
    ]);
    await page.evaluate(setupView, [tursoLibSQLiteServer().url, 'Asset']);
    await page.getByRole('button', { name: 'Open Dialog' }).click();
    const dialog = page.getByRole('dialog', { name: 'Manage Tag Asset' });
    const table = dialog.getByRole('table', { name: 'Accounts list' });
    const checkbox = table.getByRole('row', { name: 'Cash' }).getByRole('checkbox');

    await expect(checkbox).toBeChecked();

    const [event] = await Promise.all([
      page.evaluate(async function waitForEvent() {
        const { waitForEvent } = await import('#web/tools/dom.js');
        /** @type {AccountTagAssignmentDialogElement} */
        const accountTagAssignmentDialog = document.querySelector('account-tag-assignment-dialog');
        const event = await waitForEvent(accountTagAssignmentDialog, 'tag-assignment-changed');
        if (event instanceof CustomEvent) return event.detail;
        else throw new Error(`Expected CustomEvent from tag-assignment-changed, got ${event.constructor.name} instead.`);
      }),
      checkbox.click()
    ]);

    expect(event).toEqual({ tag: 'Asset', accountCode: 10001, action: 'remove' });
    await expect(checkbox).not.toBeChecked();
  });

  test('shall handle unique tags', async function ({ page }) {
    await Promise.all([
      loadEmptyFixture(page),
      setupDatabase(tursoLibSQLiteServer(), async function setupData(sql) {
        await sql`INSERT INTO accounts (account_code, name, normal_balance, create_time, update_time) VALUES (90001, 'Acc 1', 0, 0, 0)`;
        await sql`INSERT INTO accounts (account_code, name, normal_balance, create_time, update_time) VALUES (90002, 'Acc 2', 0, 0, 0)`;
        await sql`DELETE FROM account_tags WHERE tag = 'POS - Sales Revenue'`;
        await sql`INSERT INTO account_tags (account_code, tag) VALUES (90001, 'POS - Sales Revenue')`;
      }),
    ]);
    const uniqueTag = 'POS - Sales Revenue';
    await page.evaluate(setupView, [tursoLibSQLiteServer().url, uniqueTag]);

    await page.getByRole('button', { name: 'Open Dialog' }).click();
    const dialog = page.getByRole('dialog', { name: `Manage Tag ${uniqueTag}` });
    const table = dialog.getByRole('table', { name: 'Accounts list' });
    const cb1 = table.getByRole('row', { name: 'Acc 1' }).getByRole('checkbox');
    const cb2 = table.getByRole('row', { name: 'Acc 2' }).getByRole('checkbox');

    await expect(dialog.getByText('(unique tag - only one account allowed)')).toBeVisible();
    await expect(cb1).toBeChecked();
    await expect(cb2).not.toBeChecked();

    await cb2.click();

    await expect(cb1).not.toBeChecked();
    await expect(cb2).toBeChecked();
  });

  test('shall display error dialog on database error', async function ({ page }) {
    await Promise.all([
      loadEmptyFixture(page),
      setupDatabase(tursoLibSQLiteServer(), async function setupData(sql) {
        await sql`INSERT INTO accounts (account_code, name, normal_balance, create_time, update_time) VALUES (10001, 'Cash', 0, 0, 0)`;
      }),
    ]);
    await page.evaluate(setupView, [tursoLibSQLiteServer().url, 'Asset']);
    await page.getByRole('button', { name: 'Open Dialog' }).click();
    const dialog = page.getByRole('dialog', { name: 'Manage Tag Asset' });

    // Simulate error
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

    const table = dialog.getByRole('table', { name: 'Accounts list' });
    const checkbox = table.getByRole('row', { name: 'Cash' }).getByRole('checkbox');
    await checkbox.click();

    const errorDialog = page.getByRole('alertdialog');
    await expect(errorDialog).toBeVisible();
    await expect(errorDialog).toContainText('Simulated database error');

    await errorDialog.getByRole('button', { name: 'Dismiss' }).click();
    await expect(errorDialog).not.toBeVisible();

    const checkboxAfterError = dialog.getByRole('table', { name: 'Accounts list' }).getByRole('row', { name: 'Cash' }).getByRole('checkbox');
    await expect(checkboxAfterError).not.toBeChecked();
  });
});
