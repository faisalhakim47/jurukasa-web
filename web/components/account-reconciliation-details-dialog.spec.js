import { expect } from '@playwright/test';
import { jurukasaTest } from '#test/playwright/test-setup.js';
import { useTursoLibSQLiteServer } from '#test/playwright/hooks/use-turso-libsqlite-server.js';
import { setupDatabase } from '#test/playwright/tools/database.js';
import { useStrict } from '#test/playwright/hooks/use-strict.js';
import { loadEmptyFixture } from '#test/playwright/tools/fixture.js';
import { useConsoleOutput } from '#test/playwright/hooks/use-console-output.js';

/** @typedef {import('#web/contexts/database-context.js').DatabaseContextElement} DatabaseContextElement */

const test = jurukasaTest;
const { describe } = test;

/**
 * @param {[string, string]} args
 */
async function setupView([tursoDatabaseUrl, reconciliationId]) {
  document.body.innerHTML = `
    <ready-context>
      <router-context>
        <database-context provider="turso" name="My Business" turso-url="${tursoDatabaseUrl}">
          <device-context>
            <i18n-context>
              <button
                type="button"
                commandfor="account-reconciliation-details-dialog"
                command="--open"
                data-reconciliation-id="${reconciliationId}"
              >Open Reconciliation Details</button>
              <account-reconciliation-details-dialog
                id="account-reconciliation-details-dialog"
              ></account-reconciliation-details-dialog>
            </i18n-context>
          </device-context>
        </database-context>
      </router-context>
    </ready-context>
  `;
}

describe('Account Reconciliation Details Dialog', function () {
  // useConsoleOutput(test);
  useStrict(test);

  describe('Details Display', function () {
    const tursoLibSQLiteServer = useTursoLibSQLiteServer(test);

    test('shall display loading indicator while loading details', async function ({ page }) {
      await Promise.all([
        loadEmptyFixture(page),
        setupDatabase(tursoLibSQLiteServer(), async function setupData() { }),
      ]);

      async function setupEmptyDialog({ tursoDatabaseUrl }) {
        document.body.innerHTML = `
          <ready-context>
            <router-context>
              <database-context provider="turso" name="My Business" turso-url="${tursoDatabaseUrl}">
                <device-context>
                  <i18n-context>
                    <button
                      type="button"
                      commandfor="account-reconciliation-details-dialog"
                      command="--open"
                      data-reconciliation-id="1"
                    >Open Reconciliation Details</button>
                    <account-reconciliation-details-dialog
                      id="account-reconciliation-details-dialog"
                    ></account-reconciliation-details-dialog>
                  </i18n-context>
                </device-context>
              </database-context>
            </router-context>
          </ready-context>
        `;
        await import('#web/components/account-reconciliation-details-dialog.js');
        await customElements.whenDefined('account-reconciliation-details-dialog');
      }

      await page.evaluate(setupEmptyDialog, { tursoDatabaseUrl: tursoLibSQLiteServer().url });

      await page.getByRole('button', { name: 'Open Reconciliation Details' }).click();

      const dialog = page.getByRole('dialog', { name: 'Reconciliation Details' });
      await expect(dialog).toBeVisible();
    });

    test('shall display reconciliation details when session exists', async function ({ page }) {
      await Promise.all([
        loadEmptyFixture(page),
        setupDatabase(tursoLibSQLiteServer(), async function setupData(sql) {
          const reconciliationTime = new Date(2025, 0, 31, 0, 0, 0, 0).getTime();
          const beginTime = new Date(2025, 0, 1, 0, 0, 0, 0).getTime();
          const endTime = new Date(2025, 0, 31, 0, 0, 0, 0).getTime();

          await sql`
            INSERT INTO reconciliation_sessions (
              id, account_code, reconciliation_time, statement_begin_time, statement_end_time,
              statement_reference, statement_opening_balance, statement_closing_balance,
              internal_opening_balance, internal_closing_balance, create_time
            ) VALUES (
              ${1}, ${11120}, ${reconciliationTime}, ${beginTime}, ${endTime},
              ${'Bank Statement Jan 2025'}, ${0}, ${10000000},
              ${0}, ${10000000}, ${reconciliationTime}
            )
          `;
        }),
      ]);

      await page.evaluate(setupView, [tursoLibSQLiteServer().url, 1]);

      await page.getByRole('button', { name: 'Open Reconciliation Details' }).click();

      await expect(page.getByRole('dialog', { name: 'Reconciliation #1' })).toBeVisible();
      await expect(page.getByText('Bank BCA')).toBeVisible();
      await expect(page.getByText('Bank Statement Jan 2025')).toBeVisible();
    });

    test('shall display balances section with correct values', async function ({ page }) {
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

      await page.evaluate(setupView, [tursoLibSQLiteServer().url, 1]);

      await page.getByRole('button', { name: 'Open Reconciliation Details' }).click();

      await expect(page.getByRole('heading', { name: 'Balances' })).toBeVisible();
      await expect(page.getByText('Opening Balance').first()).toBeVisible();
      await expect(page.getByText('Closing Balance').first()).toBeVisible();
    });

    test('shall show draft status for incomplete reconciliation', async function ({ page }) {
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

      await page.evaluate(setupView, [tursoLibSQLiteServer().url, 1]);

      await page.getByRole('button', { name: 'Open Reconciliation Details' }).click();

      await expect(page.getByText('Draft')).toBeVisible();
    });

    test('shall show completed status for finished reconciliation', async function ({ page }) {
      await Promise.all([
        loadEmptyFixture(page),
        setupDatabase(tursoLibSQLiteServer(), async function setupData(sql) {
          const reconciliationTime = new Date(2025, 0, 31, 0, 0, 0, 0).getTime();
          const beginTime = new Date(2025, 0, 1, 0, 0, 0, 0).getTime();
          const endTime = new Date(2025, 0, 31, 0, 0, 0, 0).getTime();
          const completeTime = new Date(2025, 0, 31, 0, 0, 0, 0).getTime();

          await sql`
            INSERT INTO reconciliation_sessions (
              id, account_code, reconciliation_time, statement_begin_time, statement_end_time,
              statement_reference, statement_opening_balance, statement_closing_balance,
              internal_opening_balance, internal_closing_balance, complete_time, create_time
            ) VALUES (
              ${1}, ${11120}, ${reconciliationTime}, ${beginTime}, ${endTime},
              ${'Bank Statement Jan 2025'}, ${0}, ${10000000},
              ${0}, ${10000000}, ${completeTime}, ${reconciliationTime}
            )
          `;
        }),
      ]);

      await page.evaluate(setupView, [tursoLibSQLiteServer().url, 1]);

      await page.getByRole('button', { name: 'Open Reconciliation Details' }).click();

      await expect(page.getByText('Completed')).toBeVisible();
    });
  });

  describe('Statement Items Display', function () {
    const tursoLibSQLiteServer = useTursoLibSQLiteServer(test);

    test('shall display statement items table', async function ({ page }) {
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

          const itemTime = new Date(2025, 0, 15, 0, 0, 0, 0).getTime();
          await sql`
            INSERT INTO reconciliation_statement_items (
              reconciliation_session_id, item_time, description, debit, credit
            ) VALUES (1, ${itemTime}, ${'Transfer In'}, ${0}, ${500000})
          `;
        }),
      ]);

      await page.evaluate(setupView, [tursoLibSQLiteServer().url, 1]);

      await page.getByRole('button', { name: 'Open Reconciliation Details' }).click();

      const itemsTable = page.getByRole('table', { name: 'Statement Items' });
      await expect(itemsTable).toBeVisible();
      await expect(page.getByText('Transfer In')).toBeVisible();
    });

    test('shall show item counts in summary', async function ({ page }) {
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

          const itemTime = new Date(2025, 0, 15, 0, 0, 0, 0).getTime();
          await sql`
            INSERT INTO reconciliation_statement_items (
              reconciliation_session_id, item_time, description, debit, credit, is_matched
            ) VALUES (1, ${itemTime}, ${'Deposit'}, ${0}, ${500000}, ${1})
          `;
        }),
      ]);

      await page.evaluate(setupView, [tursoLibSQLiteServer().url, 1]);

      await page.getByRole('button', { name: 'Open Reconciliation Details' }).click();

      await expect(page.getByText('Total Items: 1')).toBeVisible();
      await expect(page.getByText('Matched: 1')).toBeVisible();
      await expect(page.getByText('Unmatched: 0')).toBeVisible();
    });
  });

  describe('Reconciliation Completion', function () {
    const tursoLibSQLiteServer = useTursoLibSQLiteServer(test);

    test('shall show complete button for draft reconciliation', async function ({ page }) {
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

      await page.evaluate(setupView, [tursoLibSQLiteServer().url, 1]);

      await page.getByRole('button', { name: 'Open Reconciliation Details' }).click();

      await expect(page.getByRole('button', { name: 'Complete Reconciliation' })).toBeVisible();
    });

    test('shall complete reconciliation when confirmed', async function ({ page }) {
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
              ${'Bank Statement Jan 2025'}, ${0}, ${10000},
              ${0}, ${10000000}, ${reconciliationTime}
            )
          `;

          const itemTime = new Date(2025, 0, 15, 0, 0, 0, 0).getTime();
          await sql`
            INSERT INTO reconciliation_statement_items (
              reconciliation_session_id, item_time, description, debit, credit, is_matched
            ) VALUES (1, ${itemTime}, ${'Deposit'}, ${0}, ${10000}, ${1})
          `;
        }),
      ]);

      await page.evaluate(setupView, [tursoLibSQLiteServer().url, 1]);

      await page.getByRole('button', { name: 'Open Reconciliation Details' }).click();

      await page.getByRole('button', { name: 'Complete Reconciliation' }).click();

      const confirmationDialog = page.getByRole('alertdialog');
      await expect(confirmationDialog).toBeVisible();
      await expect(confirmationDialog.getByRole('heading', { name: 'Complete Reconciliation' })).toBeVisible();

      await confirmationDialog.getByRole('button', { name: 'Confirm' }).click();

      await expect(page.getByRole('dialog')).not.toBeVisible();
    });
  });

  describe('Reconciliation Deletion', function () {
    const tursoLibSQLiteServer = useTursoLibSQLiteServer(test);

    test('shall show delete button for draft reconciliation', async function ({ page }) {
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

      await page.evaluate(setupView, [tursoLibSQLiteServer().url, 1]);

      await page.getByRole('button', { name: 'Open Reconciliation Details' }).click();

      await expect(page.getByRole('button', { name: 'Delete' })).toBeVisible();
    });

    test('shall delete draft reconciliation when confirmed', async function ({ page }) {
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

      await page.evaluate(setupView, [tursoLibSQLiteServer().url, 1]);

      await page.getByRole('button', { name: 'Open Reconciliation Details' }).click();

      await page.getByRole('button', { name: 'Delete' }).click();

      const confirmationDialog = page.getByRole('alertdialog');
      await expect(confirmationDialog).toBeVisible();
      await expect(confirmationDialog.getByRole('heading', { name: 'Delete Reconciliation' })).toBeVisible();

      await confirmationDialog.getByRole('button', { name: 'Confirm' }).click();

      const dialog = page.getByRole('dialog', { name: 'Reconciliation #1' });
      await expect(dialog).not.toBeVisible();
    });
  });

  describe('Close Dialog', function () {
    const tursoLibSQLiteServer = useTursoLibSQLiteServer(test);

    test('shall close dialog when close button is clicked', async function ({ page }) {
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

      await page.evaluate(setupView, [tursoLibSQLiteServer().url, 1]);

      await page.getByRole('button', { name: 'Open Reconciliation Details' }).click();

      const dialog = page.getByRole('dialog', { name: 'Reconciliation #1' });
      await expect(dialog).toBeVisible();

      await page.getByRole('button', { name: 'Close' }).click();

      await expect(dialog).not.toBeVisible();
    });
  });
});
