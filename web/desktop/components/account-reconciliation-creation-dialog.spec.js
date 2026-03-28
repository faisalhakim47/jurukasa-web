import { expect } from '@playwright/test';
import { jurukasaTest } from '#test/playwright/test-setup.js';
import { useConsoleOutput } from '#test/playwright/hooks/use-console-output.js';
import { useStrict } from '#test/playwright/hooks/use-strict.js';
import { useTursoLibSQLiteServer } from '#test/playwright/hooks/use-turso-libsqlite-server.js';
import { setupDatabase } from '#test/playwright/tools/database.js';
import { loadEmptyFixture } from '#test/playwright/tools/fixture.js';

/** @import { DatabaseContextElement } from '#web/contexts/database-context.js' */

const test = jurukasaTest;
const { describe } = test;

/** @param {string} tursoDatabaseUrl */
async function setupView(tursoDatabaseUrl) {
  document.body.innerHTML = `
    <ready-context>
      <time-context time="2026-03-18T09:30:00.000Z">
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
      </time-context>
    </ready-context>
  `;
  await import('#web/desktop/components/account-reconciliation-creation-dialog.js');
  await customElements.whenDefined('account-reconciliation-creation-dialog');
}

async function seedStatementAccount(sql) {
  const entryTime = new Date('2025-01-01T00:00:00.000Z').getTime();
  await sql`
    INSERT INTO journal_entries (ref, entry_time, note)
    VALUES (${91001}, ${entryTime}, ${'Seed bank balance'})
  `;
  await sql`
    INSERT INTO journal_entry_lines_auto_number (
      journal_entry_ref,
      account_code,
      debit,
      credit,
      note,
      cashflow_activity,
      cashflow_category
    ) VALUES (
      ${91001},
      ${11120},
      ${10000000},
      ${0},
      ${'Capital injection'},
      ${3},
      ${7}
    )
  `;
  await sql`
    INSERT INTO journal_entry_lines_auto_number (
      journal_entry_ref,
      account_code,
      debit,
      credit,
      note
    ) VALUES (
      ${91001},
      ${31000},
      ${0},
      ${10000000},
      ${'Capital injection'}
    )
  `;
  await sql`
    UPDATE journal_entries
    SET post_time = ${entryTime}
    WHERE ref = ${91001}
  `;
}

describe('Account Reconciliation Creation Dialog', function () {
  useConsoleOutput(test);
  useStrict(test);
  const tursoLibSQLiteServer = useTursoLibSQLiteServer(test);

  test('it previews book balance after account and checkpoint selection', async function ({ page }) {
    await Promise.all([
      loadEmptyFixture(page),
      setupDatabase(tursoLibSQLiteServer(), seedStatementAccount),
    ]);
    await page.evaluate(setupView, tursoLibSQLiteServer().url);

    await page.getByRole('button', { name: 'Open Dialog' }).click();
    const dialog = page.getByRole('dialog', { name: 'Record Statement Checkpoint' });
    await expect(dialog).toBeVisible();

    await dialog.getByLabel('Account', { exact: true }).click();
    await page.getByRole('menuitemradio', { name: 'Bank BCA 11120 IDR 10,000,000' }).click();
    await dialog.getByLabel('Checkpoint Time').fill('2025-01-31T23:00');

    await expect(dialog.getByText('Book Balance')).toBeVisible();
    await expect(dialog).toContainText('IDR 10,000,000');
  });

  test('it records statement checkpoint and reserves adjustment entry for discrepancy', async function ({ page }) {
    await Promise.all([
      loadEmptyFixture(page),
      setupDatabase(tursoLibSQLiteServer(), seedStatementAccount),
    ]);
    await page.evaluate(setupView, tursoLibSQLiteServer().url);

    await page.getByRole('button', { name: 'Open Dialog' }).click();
    const dialog = page.getByRole('dialog', { name: 'Record Statement Checkpoint' });

    await dialog.getByLabel('Account', { exact: true }).click();
    await page.getByRole('menuitemradio', { name: 'Bank BCA 11120 IDR 10,000,000' }).click();
    await dialog.getByLabel('Checkpoint Time').fill('2025-01-31T23:00');
    await expect(dialog).toContainText('IDR 10,000,000');
    await dialog.getByLabel('Statement Balance').fill('9500000');
    await dialog.getByLabel('Note').fill('January statement');
    await expect(dialog.getByRole('button', { name: 'Record Checkpoint' })).toBeEnabled();

    await dialog.getByRole('button', { name: 'Record Checkpoint' }).click();
    await expect(dialog).not.toBeVisible();

    const checkpoint = await page.evaluate(async function readCheckpoint() {
      /** @type {DatabaseContextElement} */
      const database = document.querySelector('database-context');
      const result = await database.sql`
        SELECT external_balance, book_balance, adjustment_journal_entry_ref, note
        FROM reconciliation_checkpoints
      `;
      return result.rows[0];
    });

    expect(Number(checkpoint.external_balance)).toBe(9500000);
    expect(Number(checkpoint.book_balance)).toBe(10000000);
    expect(Number(checkpoint.adjustment_journal_entry_ref)).toBeGreaterThan(0);
    expect(String(checkpoint.note)).toBe('January statement');
  });
});
