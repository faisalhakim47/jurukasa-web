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

describe('Account Reconciliation Creation Dialog', function () {
  useConsoleOutput(test);
  useStrict(test);
  const tursoLibSQLiteServer = useTursoLibSQLiteServer(test);

  test('shall calculate internal balances correctly', async function ({ page }) {
    await Promise.all([
      loadEmptyFixture(page),
      setupDatabase(tursoLibSQLiteServer(), async function setupData(sql) {
        // 1. Create Account 11110 (Kas) - already exists in default

        // 2. Insert Journal Entries
        // Entry 1: 2025-01-01, Debit 11110 500000
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

        // Entry 2: 2025-01-15, Credit 11110 100000
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

        // Entry 3: 2025-02-01, Debit 11110 200000
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
      }),
    ]);
    await page.evaluate(setupView, tursoLibSQLiteServer().url);

    await page.getByRole('button', { name: 'Open Dialog' }).click();
    const dialog = page.getByRole('dialog', { name: 'Create Reconciliation' });
    await expect(dialog).toBeVisible();

    await dialog.getByRole('button', { name: 'Select Account' }).click();
    const accountSelector = page.getByRole('dialog', { name: 'Select Account' });
    await expect(accountSelector).toBeVisible();
    await page.getByRole('menuitemradio', { name: 'Kas 11110' }).click();

    await dialog.getByLabel('Statement Begin Date').fill('2025-01-02');
    await dialog.getByLabel('Statement End Date').fill('2025-01-31');

    // "Opening Balance (Internal)" field should be updated.
    // 500,000 (from Entry 1)
    await expect(dialog.getByLabel('Opening Balance (Internal)')).toHaveValue('500000');

    // "Closing Balance (Internal)"
    // 400,000 (500k - 100k - Entry 2)
    // Entry 3 is after period so ignored.
    await expect(dialog.getByLabel('Closing Balance (Internal)')).toHaveValue('400000');
  });

  test('shall validate period (begin < end)', async function ({ page }) {
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
    await expect(errorDialog).toBeVisible();
    await expect(errorDialog).toContainText('Statement begin date must be before end date.');
  });

  test('shall submit and emit event on success', async function ({ page }) {
    await Promise.all([
      loadEmptyFixture(page),
      setupDatabase(tursoLibSQLiteServer(), async function setupData(sql) { }),
    ]);
    await page.evaluate(setupView, tursoLibSQLiteServer().url);

    await page.getByRole('button', { name: 'Open Dialog' }).click();
    const dialog = page.getByRole('dialog', { name: 'Create Reconciliation' });
    await expect(dialog).toBeVisible();

    await dialog.getByRole('button', { name: 'Select Account' }).click();
    const accountSelector = page.getByRole('dialog', { name: 'Select Account' });
    await expect(accountSelector).toBeVisible();
    
    await expect(accountSelector.getByRole('menuitemradio', { name: 'Kas 11110' })).toBeVisible();
    await page.getByRole('menuitemradio', { name: 'Kas 11110' }).click();

    await dialog.getByLabel('Statement Begin Date').fill('2025-01-01');
    await dialog.getByLabel('Statement End Date').fill('2025-01-02');

    await expect(dialog.getByLabel('Opening Balance (Internal)')).toHaveValue(/^0$/, { timeout: 10000 });
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

    expect(detail).toHaveProperty('reconciliationId');
    expect(Number(detail.reconciliationId)).toBeGreaterThan(0);

    const result = await page.evaluate(async function verifyReconciliationData() {
      /** @type {DatabaseContextElement} */
      const database = document.querySelector('database-context');
      return await database.sql`SELECT * FROM reconciliation_sessions`;
    });
    expect(result.rows.length).toBe(1);
    expect(result.rows[0].statement_closing_balance).toBe('1000');
  });
});
