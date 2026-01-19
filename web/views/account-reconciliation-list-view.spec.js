import { test, expect } from '@playwright/test';
import { useTursoLibSQLiteServer } from '#test/hooks/use-turso-libsqlite-server.js';
import { setupDatabase } from '#test/tools/database.js';
import { useStrict } from '#test/hooks/use-strict.js';
import { loadEmptyFixture } from '#test/tools/fixture.js';
import { useConsoleOutput } from '#test/hooks/use-console-output.js';

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
              <account-reconciliation-list-view></account-reconciliation-list-view>
            </i18n-context>
          </device-context>
        </database-context>
      </router-context>
    </ready-context>
  `;
}

describe('Account Reconciliation List View', function () {
  // useConsoleOutput(test);
  useStrict(test);

  describe('Missing Reconciliation Accounts Warning', function () {
    const tursoLibSQLiteServer = useTursoLibSQLiteServer(test);

    test('shall show warning when no reconciliation accounts exist', async function ({ page }) {
      await Promise.all([
        loadEmptyFixture(page),
        setupDatabase(tursoLibSQLiteServer(), async function setupData(sql) {
          await sql`DELETE FROM account_tags WHERE tag IN ('Reconciliation - Adjustment', 'Reconciliation - Cash Over/Short')`;
        }),
      ]);
      await page.evaluate(setupView, tursoLibSQLiteServer().url);

      await expect(page.getByRole('heading', { name: 'Reconciliation Accounts Required' })).toBeVisible();

      await expect(page.getByRole('button', { name: 'Create Account' })).toBeVisible();
    });

    test('shall not show warning when reconciliation adjustment account exists', async function ({ page }) {
      await Promise.all([
        loadEmptyFixture(page),
        setupDatabase(tursoLibSQLiteServer(), async function setupData(sql) {
          // The default chart of accounts already includes account 82200 with 'Reconciliation - Adjustment' tag
        }),
      ]);
      await page.evaluate(setupView, tursoLibSQLiteServer().url);

      await expect(page.getByRole('heading', { name: 'Reconciliation Accounts Required' })).not.toBeVisible();

      await expect(page.getByRole('button', { name: 'Create Reconciliation' }).first()).toBeVisible();
    });

    test('shall not show warning when cash over/short account exists', async function ({ page }) {
      await Promise.all([
        loadEmptyFixture(page),
        setupDatabase(tursoLibSQLiteServer(), async function setupData(sql) {
          // The default chart of accounts already includes account 82300 with 'Reconciliation - Cash Over/Short' tag
        }),
      ]);
      await page.evaluate(setupView, tursoLibSQLiteServer().url);

      await expect(page.getByRole('heading', { name: 'Reconciliation Accounts Required' })).not.toBeVisible();

      await expect(page.getByRole('button', { name: 'Create Reconciliation' }).first()).toBeVisible();
    });
  });

  describe('Reconciliation Account Creation Integration', function () {
    const tursoLibSQLiteServer = useTursoLibSQLiteServer(test);

    test('shall render dialog component in the view', async function ({ page }) {
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

      expect(hasDialog).toBe(true);
    });

    test('shall open reconciliation account creation dialog when button is clicked', async function ({ page }) {
      await Promise.all([
        loadEmptyFixture(page),
        setupDatabase(tursoLibSQLiteServer(), async function setupData(sql) {
          // Remove reconciliation tags to show warning
          await sql`DELETE FROM account_tags WHERE tag IN ('Reconciliation - Adjustment', 'Reconciliation - Cash Over/Short')`;
        }),
      ]);
      await page.evaluate(setupView, tursoLibSQLiteServer().url);

      await page.getByRole('button', { name: 'Create Account' }).click();

      const dialog = page.getByRole('dialog', { name: 'Create Reconciliation Account' });
      await expect(dialog).toBeVisible();
      await expect(dialog.getByRole('button', { name: 'Reconciliation Adjustment' })).toBeVisible();
      await expect(dialog.getByRole('button', { name: 'Cash Over/Short' })).toBeVisible();
    });

    test('shall hide warning after creating reconciliation adjustment account', async function ({ page }) {
      await Promise.all([
        loadEmptyFixture(page),
        setupDatabase(tursoLibSQLiteServer(), async function setupData(sql) {
          // Remove reconciliation tags to show warning
          await sql`DELETE FROM account_tags WHERE tag IN ('Reconciliation - Adjustment', 'Reconciliation - Cash Over/Short')`;
        }),
      ]);
      await page.evaluate(setupView, tursoLibSQLiteServer().url);

      await expect(page.getByRole('heading', { name: 'Reconciliation Accounts Required' })).toBeVisible();
      await page.getByRole('button', { name: 'Create Account' }).click();

      const dialog = page.getByRole('dialog', { name: 'Create Reconciliation Account' });
      await dialog.getByRole('button', { name: 'Reconciliation Adjustment' }).click();
      await dialog.getByLabel('Account Code').fill('82201');
      await dialog.getByLabel('Account Name').fill('Reconciliation Adjustment');

      await dialog.getByRole('button', { name: 'Create Account' }).click();

      await expect(dialog).not.toBeVisible();

      await expect(page.getByRole('heading', { name: 'Reconciliation Accounts Required' })).not.toBeVisible();

      await expect(page.getByRole('button', { name: 'Create Reconciliation' }).first()).toBeVisible();
    });

    test('shall hide warning after creating cash over short account', async function ({ page }) {
      await Promise.all([
        loadEmptyFixture(page),
        setupDatabase(tursoLibSQLiteServer(), async function setupData(sql) {
          // Remove reconciliation tags to show warning
          await sql`DELETE FROM account_tags WHERE tag IN ('Reconciliation - Adjustment', 'Reconciliation - Cash Over/Short')`;
        }),
      ]);
      await page.evaluate(setupView, tursoLibSQLiteServer().url);

      await expect(page.getByRole('heading', { name: 'Reconciliation Accounts Required' })).toBeVisible();

      await page.getByRole('button', { name: 'Create Account' }).click();

      const dialog = page.getByRole('dialog', { name: 'Create Reconciliation Account' });
      await dialog.getByRole('button', { name: 'Cash Over/Short' }).click();
      await dialog.getByLabel('Account Code').fill('82210');
      await dialog.getByLabel('Account Name').fill('Cash Over and Short');

      await dialog.getByRole('button', { name: 'Create Account' }).click();
      await expect(dialog).not.toBeVisible();

      await expect(page.getByRole('heading', { name: 'Reconciliation Accounts Required' })).not.toBeVisible();

      await expect(page.getByRole('button', { name: 'Create Reconciliation' }).first()).toBeVisible();
    });

    test('shall create new reconciliation session', async function ({ page }) {
      await Promise.all([
        loadEmptyFixture(page),
        setupDatabase(tursoLibSQLiteServer(), async function setupData(sql) {
          // Default chart of accounts already has Bank BCA (11120)
        }),
      ]);
      await page.evaluate(setupView, tursoLibSQLiteServer().url);

      // Wait for the view to load and check if reconciliations can be loaded
      await page.getByRole('heading', { name: 'No Reconciliations Found' }).waitFor({ state: 'visible', timeout: 10000 });

      await page.getByRole('button', { name: 'Create Reconciliation' }).first().click();

      const dialog = page.getByRole('dialog', { name: 'Create Reconciliation' });
      await expect(dialog).toBeVisible();

      // Fill the form using existing accounts from chart of accounts template
      await dialog.getByRole('button', { name: 'Select Account' }).click();
      const accountSelector = page.getByRole('dialog', { name: 'Select Account' });
      await expect(accountSelector).toBeVisible();
      await expect(accountSelector.getByRole('menuitemradio', { name: 'Bank BCA' })).toBeVisible();
      await page.getByRole('menuitemradio', { name: 'Bank BCA' }).click();

      await dialog.getByLabel('Begin Date').fill('2025-01-01');
      await dialog.getByLabel('End Date').fill('2025-01-31');

      await dialog.getByPlaceholder('e.g. Bank Statement Jan 2026').fill('REF-2025-01');

      await dialog.getByRole('button', { name: 'Create' }).click();

      await expect(dialog).not.toBeVisible();

      // Wait for reconciliations to load after creation event
      await page.getByRole('button', { name: 'Refresh' }).click();

      // Wait for the table to appear with the new reconciliation
      await expect(page.getByRole('table', { name: 'Reconciliation sessions' })).toBeVisible();
      await expect(page.getByRole('table', { name: 'Reconciliation sessions' }).getByText('Bank BCA')).toBeVisible();
      await expect(page.getByRole('table', { name: 'Reconciliation sessions' }).getByText('REF-2025-01')).toBeVisible();
      await expect(page.getByRole('table', { name: 'Reconciliation sessions' }).getByText('Draft')).toBeVisible();
    });

    test('shall verify account is created in database', async function ({ page }) {
      await Promise.all([
        loadEmptyFixture(page),
        setupDatabase(tursoLibSQLiteServer(), async function setupData(sql) {
          // Remove reconciliation tags to show warning
          await sql`DELETE FROM account_tags WHERE tag IN ('Reconciliation - Adjustment', 'Reconciliation - Cash Over/Short')`;
        }),
      ]);
      await page.evaluate(setupView, tursoLibSQLiteServer().url);

      await page.getByRole('heading', { name: 'Reconciliation Accounts Required' }).waitFor({ state: 'visible' });

      await page.getByRole('button', { name: 'Create Account' }).click();

      const dialog = page.getByRole('dialog', { name: 'Create Reconciliation Account' });
      await dialog.getByRole('button', { name: 'Reconciliation Adjustment' }).click();

      await dialog.getByLabel('Account Code').fill('82203');
      await dialog.getByLabel('Account Name').fill('Database Test Account');

      await dialog.getByRole('button', { name: 'Create Account' }).click();

      await expect(dialog).not.toBeVisible();

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
          WHERE a.account_code = 82203
          GROUP BY a.account_code
        `;
        return result.rows[0];
      });

      expect(accountData.account_code).toBe(82203);
      expect(accountData.name).toBe('Database Test Account');
      expect(accountData.normal_balance).toBe(0); // Debit normal balance for expense accounts

      const tags = String(accountData.tags).split(',');
      expect(tags).toContain('Expense');
      expect(tags).toContain('Reconciliation - Adjustment');
    });
  });

  describe('Reconciliation List Display', function () {
    const tursoLibSQLiteServer = useTursoLibSQLiteServer(test);

    test('shall display empty state when no reconciliations exist', async function ({ page }) {
      await Promise.all([
        loadEmptyFixture(page),
        setupDatabase(tursoLibSQLiteServer(), async function setupData(sql) {
          // Default chart of accounts already has reconciliation account, no setup needed
        }),
      ]);
      await page.evaluate(setupView, tursoLibSQLiteServer().url);

      await expect(page.getByRole('heading', { name: 'No Reconciliations Found' })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Create Reconciliation' }).first()).toBeVisible();
    });

    test('shall display reconciliation sessions in table', async function ({ page }) {
      await Promise.all([
        loadEmptyFixture(page),
        setupDatabase(tursoLibSQLiteServer(), async function setupData(sql) {
          // Default chart of accounts already has Bank BCA (11120)
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

      await expect(page.getByRole('table', { name: 'Reconciliation sessions' })).toBeVisible();
      await expect(page.getByText('Bank BCA')).toBeVisible();
      await expect(page.getByText('Bank Statement Jan 2025')).toBeVisible();

      const table = page.getByRole('table', { name: 'Reconciliation sessions' });
      await expect(table.getByText('Draft')).toBeVisible();
    });

    test('shall filter reconciliations by status', async function ({ page }) {
      await Promise.all([
        loadEmptyFixture(page),
        setupDatabase(tursoLibSQLiteServer(), async function setupData(sql) {
          // Default chart of accounts already has Bank BCA (11120) and Kas (11110)
          // Use different accounts to avoid constraint: only one draft session per account

          // Create a draft reconciliation session for Bank BCA (11120)
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

          // Create a completed reconciliation session for Kas (11110)
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

      await expect(page.getByText('Draft Session')).toBeVisible();
      await expect(page.getByText('Completed Session')).toBeVisible();

      await page.getByRole('button', { name: 'All' }).click();
      await page.getByRole('menuitem', { name: 'Draft' }).click();

      await expect(page.getByText('Draft Session')).toBeVisible();
      await expect(page.getByText('Completed Session')).not.toBeVisible();

      await page.getByRole('button', { name: 'Draft' }).click();
      await page.getByRole('menuitem', { name: 'Completed' }).click();

      await expect(page.getByText('Draft Session')).not.toBeVisible();
      await expect(page.getByText('Completed Session')).toBeVisible();

      await page.getByRole('button', { name: 'Completed' }).click();
      await page.getByRole('menuitem', { name: 'All' }).click();

      await expect(page.getByText('Draft Session')).toBeVisible();
      await expect(page.getByText('Completed Session')).toBeVisible();
    });

    test('shall search reconciliations by account name', async function ({ page }) {
      await Promise.all([
        loadEmptyFixture(page),
        setupDatabase(tursoLibSQLiteServer(), async function setupData(sql) {
          // Default chart of accounts already has reconciliation account, Bank BCA (11120), and Kas (11110)

          // Create reconciliation sessions using existing accounts
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

      await expect(page.getByText('Bank BCA')).toBeVisible();
      await expect(page.getByText('Kas')).toBeVisible();

      await page.getByLabel('Search', { exact: true }).fill('Bank');

      await expect(page.getByText('Bank BCA')).toBeVisible();
      await expect(page.getByText('Kas')).not.toBeVisible();

      await page.getByLabel('Search', { exact: true }).clear();

      await expect(page.getByText('Bank BCA')).toBeVisible();
      await expect(page.getByText('Kas')).toBeVisible();
    });
  });

  describe('Refresh Functionality', function () {
    const tursoLibSQLiteServer = useTursoLibSQLiteServer(test);

    test('shall reload reconciliations when refresh button is clicked', async function ({ page }) {
      await Promise.all([
        loadEmptyFixture(page),
        setupDatabase(tursoLibSQLiteServer(), async function setupData(sql) {
          // Default chart of accounts already has reconciliation account
        }),
      ]);
      await page.evaluate(setupView, tursoLibSQLiteServer().url);

      await expect(page.getByRole('heading', { name: 'No Reconciliations Found' })).toBeVisible();

      await page.evaluate(async function addReconciliationSession() {
        /** @type {DatabaseContextElement} */
        const database = document.querySelector('database-context');

        // Create reconciliation session using existing Bank BCA (11120)
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

      await expect(page.getByText('Bank BCA'), 'should display added reconciliation session').toBeVisible();
      await expect(page.getByText('New Session'), 'should display added reconciliation session').toBeVisible();
    });
  });
});
