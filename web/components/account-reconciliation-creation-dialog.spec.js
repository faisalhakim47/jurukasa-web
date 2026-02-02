import { expect } from '@playwright/test';
import { jurukasaTest } from '#test/playwright/test-setup.js';
import { useConsoleOutput } from '#test/playwright/hooks/use-console-output.js';
import { useStrict } from '#test/playwright/hooks/use-strict.js';
import { useTursoLibSQLiteServer } from '#test/playwright/hooks/use-turso-libsqlite-server.js';
import { setupDatabase } from '#test/playwright/tools/database.js';
import { loadEmptyFixture } from '#test/playwright/tools/fixture.js';

/** @import { AccountReconciliationCreationDialogElement } from '#web/components/account-reconciliation-creation-dialog.js' */
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
              <account-reconciliation-creation-dialog id="account-reconciliation-creation-dialog"></account-reconciliation-creation-dialog>
              <button commandfor="account-reconciliation-creation-dialog" command="--open">Open Dialog</button>
            </i18n-context>
          </device-context>
        </database-context>
      </router-context>
    </ready-context>
  `;
  await import('#web/components/account-reconciliation-creation-dialog.js');
  await customElements.whenDefined('account-reconciliation-creation-dialog');
}

async function setupJournalEntries(sql) {
  const t1 = new Date('2025-01-01').getTime();
  await sql`
    INSERT INTO journal_entries (entry_time, note, source_type, source_reference, created_by, post_time)
    VALUES (${t1}, 'Initial Deposit', 'Manual', 'REF1', 'User', ${t1})
  `;
  await sql`
     INSERT INTO journal_entry_lines_auto_number (journal_entry_ref, account_code, debit, credit, description)
     SELECT ref, 11110, 500000, 0, 'Deposit'
     FROM journal_entries WHERE source_reference = 'REF1'
  `;
  const t2 = new Date('2025-01-15').getTime();
  await sql`
    INSERT INTO journal_entries (entry_time, note, source_type, source_reference, created_by, post_time)
    VALUES (${t2}, 'Expense', 'Manual', 'REF2', 'User', ${t2})
  `;
  await sql`
     INSERT INTO journal_entry_lines_auto_number (journal_entry_ref, account_code, debit, credit, description)
     SELECT ref, 11110, 0, 100000, 'Expense'
     FROM journal_entries WHERE source_reference = 'REF2'
  `;
  const t3 = new Date('2025-02-01').getTime();
  await sql`
    INSERT INTO journal_entries (entry_time, note, source_type, source_reference, created_by, post_time)
    VALUES (${t3}, 'Late Deposit', 'Manual', 'REF3', 'User', ${t3})
  `;
  await sql`
     INSERT INTO journal_entry_lines_auto_number (journal_entry_ref, account_code, debit, credit, description)
     SELECT ref, 11110, 200000, 0, 'Late Deposit'
     FROM journal_entries WHERE source_reference = 'REF3'
  `;
}

describe('Account Reconciliation Creation Dialog', function () {
  useConsoleOutput(test);
  useStrict(test);
  const tursoLibSQLiteServer = useTursoLibSQLiteServer(test);

  test('user calculates internal balances by selecting account and period', async function ({ page }) {
    await Promise.all([
      loadEmptyFixture(page),
      setupDatabase(tursoLibSQLiteServer(), setupJournalEntries),
    ]);
    await page.evaluate(setupView, tursoLibSQLiteServer().url);

    await page.getByRole('button', { name: 'Open Dialog' }).click();
    const dialog = page.getByRole('dialog', { name: 'Create Reconciliation' });
    await expect(dialog, 'it shall display reconciliation creation dialog').toBeVisible();

    await dialog.getByRole('button', { name: 'Select Account' }).click();
    const accountSelector = page.getByRole('dialog', { name: 'Select Account' });
    await expect(accountSelector, 'it shall display account selector dialog').toBeVisible();
    await page.getByRole('menuitemradio', { name: 'Kas 11110' }).click();

    await dialog.getByLabel('Statement Begin Date').fill('2025-01-02');
    await dialog.getByLabel('Statement End Date').fill('2025-01-31');

    await expect(dialog.getByLabel('Opening Balance (Internal)'), 'it shall display opening balance from Entry 1').toHaveValue('500000');
    await expect(dialog.getByLabel('Closing Balance (Internal)'), 'it shall display closing balance after Entry 2').toHaveValue('400000');
  });

  test('user receives validation error when period dates are invalid', async function ({ page }) {
    await Promise.all([
      loadEmptyFixture(page),
      setupDatabase(tursoLibSQLiteServer(), async function setupData(sql) { }),
    ]);
    await page.evaluate(setupView, tursoLibSQLiteServer().url);

    await page.getByRole('button', { name: 'Open Dialog' }).click();
    const dialog = page.getByRole('dialog', { name: 'Create Reconciliation' });

    await dialog.getByRole('button', { name: 'Select Account' }).click();
    await page.getByRole('menuitemradio', { name: 'Kas 11110' }).click();

    await dialog.getByLabel('Statement Begin Date').fill('2025-01-31');
    await dialog.getByLabel('Statement End Date').fill('2025-01-01');

    await dialog.getByRole('button', { name: 'Create' }).click();

    const errorDialog = page.getByRole('alertdialog', { name: 'Error' });
    await expect(errorDialog, 'it shall display error dialog for invalid period').toBeVisible();
    await expect(errorDialog, 'it shall display period validation error message').toContainText('Statement begin date must be before end date.');
  });

  test('user creates reconciliation and system emits success event with persisted data', async function ({ page }) {
    await Promise.all([
      loadEmptyFixture(page),
      setupDatabase(tursoLibSQLiteServer(), async function setupData(sql) { }),
    ]);
    await page.evaluate(setupView, tursoLibSQLiteServer().url);

    await page.getByRole('button', { name: 'Open Dialog' }).click();
    const dialog = page.getByRole('dialog', { name: 'Create Reconciliation' });
    await expect(dialog, 'it shall display reconciliation creation dialog').toBeVisible();

    await dialog.getByRole('button', { name: 'Select Account' }).click();
    const accountSelector = page.getByRole('dialog', { name: 'Select Account' });
    await expect(accountSelector, 'it shall display account selector dialog').toBeVisible();
    
    await expect(accountSelector.getByRole('menuitemradio', { name: 'Kas 11110' }), 'it shall display Kas account option').toBeVisible();
    await page.getByRole('menuitemradio', { name: 'Kas 11110' }).click();

    await dialog.getByLabel('Statement Begin Date').fill('2025-01-01');
    await dialog.getByLabel('Statement End Date').fill('2025-01-02');

    await expect(dialog.getByLabel('Opening Balance (Internal)'), 'it shall display zero opening balance').toHaveValue(/^0$/, { timeout: 10000 });
    await dialog.getByLabel('Opening Balance (Statement)').fill('0');
    await dialog.getByLabel('Closing Balance (Statement)').fill('1000');

    const [detail] = await Promise.all([
      page.evaluate(async function waitForCreatedEvent() {
        const { waitForEvent } = await import('#web/tools/dom.js');
        /** @type {AccountReconciliationCreationDialogElement} */
        const accountReconciliationCreationDialog = document.querySelector('account-reconciliation-creation-dialog');
        const createdEvent = await waitForEvent(accountReconciliationCreationDialog, 'account-reconciliation-created', 3000);
        if (createdEvent instanceof CustomEvent) return createdEvent.detail;
        throw new Error('Event is not a CustomEvent');
      }),
      dialog.getByRole('button', { name: 'Create' }).click(),
    ]);

    expect(detail, 'it shall return reconciliation detail').toHaveProperty('reconciliationId');
    expect(Number(detail.reconciliationId), 'it shall return valid reconciliation ID').toBeGreaterThan(0);

    const result = await page.evaluate(async function verifyReconciliationData() {
      /** @type {DatabaseContextElement} */
      const database = document.querySelector('database-context');
      return await database.sql`SELECT * FROM reconciliation_sessions`;
    });
    expect(result.rows.length, 'it shall persist one reconciliation session').toBe(1);
    expect(result.rows[0].statement_closing_balance, 'it shall persist correct closing balance').toBe('1000');
  });
});
