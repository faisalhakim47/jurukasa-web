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

describe('Account Reconciliation Details Dialog', function () {
  useConsoleOutput(test);
  useStrict(test);
  const tursoLibSQLiteServer = useTursoLibSQLiteServer(test);

  test('open dialog and view draft reconciliation details with statement items', async function ({ page }) {
    await Promise.all([
      loadEmptyFixture(page),
      setupDatabase(tursoLibSQLiteServer(), async function setupData(sql) {
        const reconciliationTime = new Date(2025, 0, 31, 0, 0, 0, 0).getTime();
        const beginTime = new Date(2025, 0, 1, 0, 0, 0, 0).getTime();
        const endTime = new Date(2025, 0, 31, 0, 0, 0, 0).getTime();
        const itemTime = new Date(2025, 0, 15, 0, 0, 0, 0).getTime();

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

        await sql`
          INSERT INTO reconciliation_statement_items (
            reconciliation_session_id, item_time, description, debit, credit, is_matched
          ) VALUES (1, ${itemTime}, ${'Transfer In'}, ${0}, ${500000}, ${1})
        `;
      }),
    ]);

    await page.evaluate(setupView, [tursoLibSQLiteServer().url, 1]);

    await page.getByRole('button', { name: 'Open Reconciliation Details' }).click();

    await expect(page.getByRole('dialog', { name: 'Reconciliation #1' }), 'dialog shall be visible after opening').toBeVisible();
    await expect(page.getByText('Bank BCA'), 'account name shall be visible').toBeVisible();
    await expect(page.getByText('Bank Statement Jan 2025'), 'statement reference shall be visible').toBeVisible();
    await expect(page.getByRole('heading', { name: 'Balances' }), 'balances section shall be visible').toBeVisible();
    await expect(page.getByText('Opening Balance').first(), 'opening balance label shall be visible').toBeVisible();
    await expect(page.getByText('Closing Balance').first(), 'closing balance label shall be visible').toBeVisible();
    await expect(page.getByText('Draft'), 'draft status shall be visible').toBeVisible();

    const itemsTable = page.getByRole('table', { name: 'Statement Items' });
    await expect(itemsTable, 'statement items table shall be visible').toBeVisible();
    await expect(page.getByText('Transfer In'), 'statement item description shall be visible').toBeVisible();
    await expect(page.getByText('Total Items: 1'), 'total items count shall be visible').toBeVisible();
    await expect(page.getByText('Matched: 1'), 'matched count shall be visible').toBeVisible();
    await expect(page.getByText('Unmatched: 0'), 'unmatched count shall be visible').toBeVisible();
    await expect(page.getByRole('button', { name: 'Complete Reconciliation' }), 'complete button shall be visible for draft').toBeVisible();
    await expect(page.getByRole('button', { name: 'Delete' }), 'delete button shall be visible for draft').toBeVisible();
  });

  test('open dialog and view completed reconciliation details', async function ({ page }) {
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

    await expect(page.getByRole('dialog', { name: 'Reconciliation #1' }), 'dialog shall be visible').toBeVisible();
    await expect(page.getByText('Completed'), 'completed status shall be visible').toBeVisible();
  });

  test('complete reconciliation flow with confirmation', async function ({ page }) {
    await Promise.all([
      loadEmptyFixture(page),
      setupDatabase(tursoLibSQLiteServer(), async function setupData(sql) {
        const reconciliationTime = new Date(2025, 0, 31, 0, 0, 0, 0).getTime();
        const beginTime = new Date(2025, 0, 1, 0, 0, 0, 0).getTime();
        const endTime = new Date(2025, 0, 31, 0, 0, 0, 0).getTime();
        const itemTime = new Date(2025, 0, 15, 0, 0, 0, 0).getTime();

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

        await sql`
          INSERT INTO reconciliation_statement_items (
            reconciliation_session_id, item_time, description, debit, credit, is_matched
          ) VALUES (1, ${itemTime}, ${'Deposit'}, ${0}, ${10000}, ${1})
        `;
      }),
    ]);

    await page.evaluate(setupView, [tursoLibSQLiteServer().url, 1]);

    await page.getByRole('button', { name: 'Open Reconciliation Details' }).click();
    await expect(page.getByRole('dialog', { name: 'Reconciliation #1' }), 'dialog shall be visible').toBeVisible();

    await page.getByRole('button', { name: 'Complete Reconciliation' }).click();

    const confirmationDialog = page.getByRole('alertdialog');
    await expect(confirmationDialog, 'confirmation dialog shall be visible').toBeVisible();
    await expect(confirmationDialog.getByRole('heading', { name: 'Complete Reconciliation' }), 'confirmation heading shall be visible').toBeVisible();

    await confirmationDialog.getByRole('button', { name: 'Confirm' }).click();

    await expect(page.getByRole('dialog'), 'dialog shall close after completion').not.toBeVisible();
  });

  test('delete reconciliation flow with confirmation', async function ({ page }) {
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
    await expect(page.getByRole('dialog', { name: 'Reconciliation #1' }), 'dialog shall be visible').toBeVisible();

    await page.getByRole('button', { name: 'Delete' }).click();

    const confirmationDialog = page.getByRole('alertdialog');
    await expect(confirmationDialog, 'confirmation dialog shall be visible').toBeVisible();
    await expect(confirmationDialog.getByRole('heading', { name: 'Delete Reconciliation' }), 'confirmation heading shall be visible').toBeVisible();

    await confirmationDialog.getByRole('button', { name: 'Confirm' }).click();

    await expect(page.getByRole('dialog', { name: 'Reconciliation #1' }), 'dialog shall close after deletion').not.toBeVisible();
  });

  test('close dialog using close button', async function ({ page }) {
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
    await expect(dialog, 'dialog shall be visible').toBeVisible();

    await page.getByRole('button', { name: 'Close' }).click();

    await expect(dialog, 'dialog shall close after clicking close button').not.toBeVisible();
  });
});
