import { expect } from '@playwright/test';
import { jurukasaTest } from '#test/playwright/test-setup.js';
import { useTursoLibSQLiteServer } from '#test/playwright/hooks/use-turso-libsqlite-server.js';
import { setupDatabase } from '#test/playwright/tools/database.js';
import { useStrict } from '#test/playwright/hooks/use-strict.js';
import { loadEmptyFixture } from '#test/playwright/tools/fixture.js';
import { useConsoleOutput } from '#test/playwright/hooks/use-console-output.js';

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
              <account-reconciliation-list-view></account-reconciliation-list-view>
            </i18n-context>
          </device-context>
        </database-context>
      </router-context>
    </ready-context>
  `;
}

describe('Account Reconciliation List View', function () {
  useConsoleOutput(test);
  useStrict(test);
  const tursoLibSQLiteServer = useTursoLibSQLiteServer(test);

  test('show warning and create reconciliation adjustment account to enable reconciliations', async function ({ page }) {
    await Promise.all([
      loadEmptyFixture(page),
      setupDatabase(tursoLibSQLiteServer(), async function setupData(sql) {
        await sql`DELETE FROM account_tags WHERE tag IN ('Reconciliation - Adjustment', 'Reconciliation - Cash Over/Short')`;
      }),
    ]);
    await page.evaluate(setupView, tursoLibSQLiteServer().url);

    await expect(page.getByRole('heading', { name: 'Reconciliation Accounts Required' }), 'warning heading shall be visible when no accounts exist').toBeVisible();
    await expect(page.getByRole('button', { name: 'Create Account' }), 'create account button shall be visible').toBeVisible();

    await page.getByRole('button', { name: 'Create Account' }).click();

    const dialog = page.getByRole('dialog', { name: 'Create Reconciliation Account' });
    await expect(dialog, 'reconciliation account creation dialog shall be visible').toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Reconciliation Adjustment' }), 'reconciliation adjustment button shall be visible').toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Cash Over/Short' }), 'cash over/short button shall be visible').toBeVisible();

    await dialog.getByRole('button', { name: 'Reconciliation Adjustment' }).click();
    await dialog.getByLabel('Account Code').fill('82201');
    await dialog.getByLabel('Account Name').fill('Reconciliation Adjustment');
    await dialog.getByRole('button', { name: 'Create Account' }).click();

    await expect(dialog, 'dialog shall close after account creation').not.toBeVisible();
    await expect(page.getByRole('heading', { name: 'Reconciliation Accounts Required' }), 'warning heading shall be hidden after account creation').not.toBeVisible();
    await expect(page.getByRole('button', { name: 'Create Reconciliation' }).first(), 'create reconciliation button shall be visible').toBeVisible();

    const accountData = await page.evaluate(async function fetchAccountData() {
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

    expect(accountData.account_code, 'account code shall match in database').toBe('82201');
    expect(accountData.name, 'account name shall match in database').toBe('Reconciliation Adjustment');
    expect(accountData.normal_balance, 'normal balance shall be debit for expense accounts').toBe('0');

    const tags = String(accountData.tags).split(',');
    expect(tags, 'account shall have Expense tag').toContain('Expense');
    expect(tags, 'account shall have Reconciliation - Adjustment tag').toContain('Reconciliation - Adjustment');
  });

  test('show warning and create cash over/short account to enable reconciliations', async function ({ page }) {
    await Promise.all([
      loadEmptyFixture(page),
      setupDatabase(tursoLibSQLiteServer(), async function setupData(sql) {
        await sql`DELETE FROM account_tags WHERE tag IN ('Reconciliation - Adjustment', 'Reconciliation - Cash Over/Short')`;
      }),
    ]);
    await page.evaluate(setupView, tursoLibSQLiteServer().url);

    await expect(page.getByRole('heading', { name: 'Reconciliation Accounts Required' }), 'warning heading shall be visible initially').toBeVisible();

    await page.getByRole('button', { name: 'Create Account' }).click();

    const dialog = page.getByRole('dialog', { name: 'Create Reconciliation Account' });
    await dialog.getByRole('button', { name: 'Cash Over/Short' }).click();
    await dialog.getByLabel('Account Code').fill('82210');
    await dialog.getByLabel('Account Name').fill('Cash Over and Short');
    await dialog.getByRole('button', { name: 'Create Account' }).click();

    await expect(dialog, 'dialog shall close after account creation').not.toBeVisible();
    await expect(page.getByRole('heading', { name: 'Reconciliation Accounts Required' }), 'warning heading shall be hidden after account creation').not.toBeVisible();
    await expect(page.getByRole('button', { name: 'Create Reconciliation' }).first(), 'create reconciliation button shall be visible').toBeVisible();
  });

  test('hide warning when reconciliation accounts already exist', async function ({ page }) {
    await Promise.all([
      loadEmptyFixture(page),
      setupDatabase(tursoLibSQLiteServer(), async function setupData(sql) {
        // Default chart of accounts already includes reconciliation accounts
      }),
    ]);
    await page.evaluate(setupView, tursoLibSQLiteServer().url);

    await expect(page.getByRole('heading', { name: 'Reconciliation Accounts Required' }), 'warning heading shall not be visible when accounts exist').not.toBeVisible();
    await expect(page.getByRole('button', { name: 'Create Reconciliation' }).first(), 'create reconciliation button shall be visible').toBeVisible();
  });

  test('create new reconciliation session and display it in list', async function ({ page }) {
    await Promise.all([
      loadEmptyFixture(page),
      setupDatabase(tursoLibSQLiteServer(), async function setupData(sql) {
        // Default chart of accounts already has Bank BCA (11120)
      }),
    ]);
    await page.evaluate(setupView, tursoLibSQLiteServer().url);

    await page.getByRole('heading', { name: 'No Reconciliations Found' }).waitFor({ state: 'visible', timeout: 10000 });
    await page.getByRole('button', { name: 'Create Reconciliation' }).first().click();

    const dialog = page.getByRole('dialog', { name: 'Create Reconciliation' });
    await expect(dialog, 'create reconciliation dialog shall be visible').toBeVisible();

    await dialog.getByRole('button', { name: 'Select Account' }).click();
    const accountSelector = page.getByRole('dialog', { name: 'Select Account' });
    await expect(accountSelector, 'account selector dialog shall be visible').toBeVisible();
    await expect(accountSelector.getByRole('menuitemradio', { name: 'Bank BCA' }), 'Bank BCA option shall be visible').toBeVisible();
    await page.getByRole('menuitemradio', { name: 'Bank BCA' }).click();

    await dialog.getByLabel('Begin Date').fill('2025-01-01');
    await dialog.getByLabel('End Date').fill('2025-01-31');
    await dialog.getByPlaceholder('e.g. Bank Statement Jan 2026').fill('REF-2025-01');
    await dialog.getByRole('button', { name: 'Create' }).click();

    await expect(dialog, 'create reconciliation dialog shall close').not.toBeVisible();

    await page.getByRole('button', { name: 'Refresh' }).click();

    const table = page.getByRole('table', { name: 'Reconciliation sessions' });
    await expect(table, 'reconciliation sessions table shall be visible').toBeVisible();
    await expect(table.getByText('Bank BCA'), 'Bank BCA shall appear in table').toBeVisible();
    await expect(table.getByText('REF-2025-01'), 'reference shall appear in table').toBeVisible();
    await expect(table.getByText('Draft'), 'status shall appear in table').toBeVisible();
  });

  test('display empty state when no reconciliations exist', async function ({ page }) {
    await Promise.all([
      loadEmptyFixture(page),
      setupDatabase(tursoLibSQLiteServer(), async function setupData(sql) {
        // Default chart of accounts already has reconciliation account
      }),
    ]);
    await page.evaluate(setupView, tursoLibSQLiteServer().url);

    await expect(page.getByRole('heading', { name: 'No Reconciliations Found' }), 'empty state heading shall be visible').toBeVisible();
    await expect(page.getByRole('button', { name: 'Create Reconciliation' }).first(), 'create reconciliation button shall be visible').toBeVisible();
  });

  test('display reconciliation sessions in table with correct data', async function ({ page }) {
    await Promise.all([
      loadEmptyFixture(page),
      setupDatabase(tursoLibSQLiteServer(), async function setupData(sql) {
        const reconciliationTime = new Date(2025, 0, 31, 0, 0, 0, 0).getTime();
        const beginTime = new Date(2025, 0, 1, 0, 0, 0, 0).getTime();
        const endTime = new Date(2025, 0, 31, 0, 0, 0, 0).getTime();

        await sql`
          INSERT INTO reconciliation_sessions (
            account_code, reconciliation_time, statement_begin_time, statement_end_time,
            statement_reference, statement_opening_balance, statement_closing_balance,
            internal_opening_balance, internal_closing_balance, create_time
          ) VALUES (
            ${11120}, ${reconciliationTime}, ${beginTime}, ${endTime},
            ${'Bank Statement Jan 2025'}, ${0}, ${10000000},
            ${0}, ${10000000}, ${reconciliationTime}
          )
        `;
      }),
    ]);
    await page.evaluate(setupView, tursoLibSQLiteServer().url);

    const table = page.getByRole('table', { name: 'Reconciliation sessions' });
    await expect(table, 'reconciliation sessions table shall be visible').toBeVisible();
    await expect(page.getByText('Bank BCA'), 'Bank BCA shall be visible').toBeVisible();
    await expect(page.getByText('Bank Statement Jan 2025'), 'statement reference shall be visible').toBeVisible();
    await expect(table.getByText('Draft'), 'status shall be visible').toBeVisible();
  });

  test('filter reconciliations by status across all and specific states', async function ({ page }) {
    await Promise.all([
      loadEmptyFixture(page),
      setupDatabase(tursoLibSQLiteServer(), async function setupData(sql) {
        const reconciliationTime1 = new Date(2025, 0, 31, 0, 0, 0, 0).getTime();
        const beginTime1 = new Date(2025, 0, 1, 0, 0, 0, 0).getTime();
        const endTime1 = new Date(2025, 0, 31, 0, 0, 0, 0).getTime();

        await sql`
          INSERT INTO reconciliation_sessions (
            account_code, reconciliation_time, statement_begin_time, statement_end_time,
            statement_reference, statement_opening_balance, statement_closing_balance,
            internal_opening_balance, internal_closing_balance, create_time
          ) VALUES (
            ${11120}, ${reconciliationTime1}, ${beginTime1}, ${endTime1},
            ${'Draft Session'}, ${0}, ${10000000},
            ${0}, ${10000000}, ${reconciliationTime1}
          )
        `;

        const reconciliationTime2 = new Date(2025, 1, 28, 0, 0, 0, 0).getTime();
        const beginTime2 = new Date(2025, 1, 1, 0, 0, 0, 0).getTime();
        const endTime2 = new Date(2025, 1, 28, 0, 0, 0, 0).getTime();
        const completeTime2 = new Date(2025, 1, 28, 0, 0, 0, 0).getTime();

        await sql`
          INSERT INTO reconciliation_sessions (
            account_code, reconciliation_time, statement_begin_time, statement_end_time,
            statement_reference, statement_opening_balance, statement_closing_balance,
            internal_opening_balance, internal_closing_balance, complete_time, create_time
          ) VALUES (
            ${11110}, ${reconciliationTime2}, ${beginTime2}, ${endTime2},
            ${'Completed Session'}, ${0}, ${10000000},
            ${0}, ${10000000}, ${completeTime2}, ${reconciliationTime2}
          )
        `;
      }),
    ]);
    await page.evaluate(setupView, tursoLibSQLiteServer().url);

    await expect(page.getByText('Draft Session'), 'draft session shall be visible initially').toBeVisible();
    await expect(page.getByText('Completed Session'), 'completed session shall be visible initially').toBeVisible();

    await page.getByRole('button', { name: 'All' }).click();
    await page.getByRole('menuitem', { name: 'Draft' }).click();

    await expect(page.getByText('Draft Session'), 'draft session shall be visible when filtered by Draft').toBeVisible();
    await expect(page.getByText('Completed Session'), 'completed session shall not be visible when filtered by Draft').not.toBeVisible();

    await page.getByRole('button', { name: 'Draft' }).click();
    await page.getByRole('menuitem', { name: 'Completed' }).click();

    await expect(page.getByText('Draft Session'), 'draft session shall not be visible when filtered by Completed').not.toBeVisible();
    await expect(page.getByText('Completed Session'), 'completed session shall be visible when filtered by Completed').toBeVisible();

    await page.getByRole('button', { name: 'Completed' }).click();
    await page.getByRole('menuitem', { name: 'All' }).click();

    await expect(page.getByText('Draft Session'), 'draft session shall be visible when filtered by All').toBeVisible();
    await expect(page.getByText('Completed Session'), 'completed session shall be visible when filtered by All').toBeVisible();
  });

  test('search reconciliations by account name', async function ({ page }) {
    await Promise.all([
      loadEmptyFixture(page),
      setupDatabase(tursoLibSQLiteServer(), async function setupData(sql) {
        const reconciliationTime = new Date(2025, 0, 31, 0, 0, 0, 0).getTime();
        const beginTime = new Date(2025, 0, 1, 0, 0, 0, 0).getTime();
        const endTime = new Date(2025, 0, 31, 0, 0, 0, 0).getTime();

        await sql`
          INSERT INTO reconciliation_sessions (
            account_code, reconciliation_time, statement_begin_time, statement_end_time,
            statement_reference, statement_opening_balance, statement_closing_balance,
            internal_opening_balance, internal_closing_balance, create_time
          ) VALUES (
            ${11120}, ${reconciliationTime}, ${beginTime}, ${endTime},
            ${'Bank Statement'}, ${0}, ${10000000},
            ${0}, ${10000000}, ${reconciliationTime}
          )
        `;

        await sql`
          INSERT INTO reconciliation_sessions (
            account_code, reconciliation_time, statement_begin_time, statement_end_time,
            statement_reference, statement_opening_balance, statement_closing_balance,
            internal_opening_balance, internal_closing_balance, create_time
          ) VALUES (
            ${11110}, ${reconciliationTime}, ${beginTime}, ${endTime},
            ${'Cash Count'}, ${0}, ${5000000},
            ${0}, ${5000000}, ${reconciliationTime}
          )
        `;
      }),
    ]);
    await page.evaluate(setupView, tursoLibSQLiteServer().url);

    await expect(page.getByText('Bank BCA'), 'Bank BCA shall be visible initially').toBeVisible();
    await expect(page.getByText('Kas'), 'Kas shall be visible initially').toBeVisible();

    await page.getByLabel('Search', { exact: true }).fill('Bank');

    await expect(page.getByText('Bank BCA'), 'Bank BCA shall be visible when searching for Bank').toBeVisible();
    await expect(page.getByText('Kas'), 'Kas shall not be visible when searching for Bank').not.toBeVisible();

    await page.getByLabel('Search', { exact: true }).clear();

    await expect(page.getByText('Bank BCA'), 'Bank BCA shall be visible after clearing search').toBeVisible();
    await expect(page.getByText('Kas'), 'Kas shall be visible after clearing search').toBeVisible();
  });

  test('reload reconciliations when refresh button is clicked', async function ({ page }) {
    await Promise.all([
      loadEmptyFixture(page),
      setupDatabase(tursoLibSQLiteServer(), async function setupData(sql) {
        // Default chart of accounts already has reconciliation account
      }),
    ]);
    await page.evaluate(setupView, tursoLibSQLiteServer().url);

    await expect(page.getByRole('heading', { name: 'No Reconciliations Found' }), 'empty state shall be visible initially').toBeVisible();

    await page.evaluate(async function addReconciliationSession() {
      /** @type {DatabaseContextElement} */
      const database = document.querySelector('database-context');

      const reconciliationTime = new Date(2025, 0, 31, 0, 0, 0, 0).getTime();
      const beginTime = new Date(2025, 0, 1, 0, 0, 0, 0).getTime();
      const endTime = new Date(2025, 0, 31, 0, 0, 0, 0).getTime();

      await database.sql`
        INSERT INTO reconciliation_sessions (
          account_code, reconciliation_time, statement_begin_time, statement_end_time,
          statement_reference, statement_opening_balance, statement_closing_balance,
          internal_opening_balance, internal_closing_balance, create_time
        ) VALUES (
          ${11120}, ${reconciliationTime}, ${beginTime}, ${endTime},
          ${'New Session'}, ${0}, ${10000000},
          ${0}, ${10000000}, ${reconciliationTime}
        )
      `;
    });

    await page.getByRole('button', { name: 'Refresh' }).click();

    await expect(page.getByText('Bank BCA'), 'Bank BCA shall be visible after refresh').toBeVisible();
    await expect(page.getByText('New Session'), 'new session reference shall be visible after refresh').toBeVisible();
  });

  test('reconciliation account creation dialog component exists in view', async function ({ page }) {
    await Promise.all([
      loadEmptyFixture(page),
      setupDatabase(tursoLibSQLiteServer(), async function setupData(sql) {
        // Default chart of accounts already has reconciliation account
      }),
    ]);
    await page.evaluate(setupView, tursoLibSQLiteServer().url);

    await page.getByRole('button', { name: 'Create Reconciliation' }).first().waitFor({ state: 'attached' });

    const hasDialog = await page.evaluate(function checkDialogExists() {
      const view = document.querySelector('account-reconciliation-list-view');
      if (!view || !view.shadowRoot) return false;
      const dialog = view.shadowRoot.querySelector('reconciliation-account-creation-dialog');
      return dialog !== null;
    });

    expect(hasDialog, 'reconciliation account creation dialog component shall exist in view').toBe(true);
  });
});
