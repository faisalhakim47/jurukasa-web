import { expect } from '@playwright/test';
import { jurukasaTest } from '#test/playwright/test-setup.js';
import { useTursoLibSQLiteServer } from '#test/playwright/hooks/use-turso-libsqlite-server.js';
import { setupDatabase } from '#test/playwright/tools/database.js';
import { useStrict } from '#test/playwright/hooks/use-strict.js';
import { loadEmptyFixture } from '#test/playwright/tools/fixture.js';
import { useConsoleOutput } from '#test/playwright/hooks/use-console-output.js';

const test = jurukasaTest;
const { describe } = test;

/** @param {[string, string]} args */
async function setupView([tursoDatabaseUrl, reconciliationId]) {
  document.body.innerHTML = `
    <ready-context>
      <router-context>
        <database-context provider="turso" name="My Business" turso-url="${tursoDatabaseUrl}">
          <device-context>
            <i18n-context>
              <button type="button" commandfor="account-reconciliation-details-dialog" command="--open" data-reconciliation-id="${reconciliationId}">Open Details</button>
              <account-reconciliation-details-dialog id="account-reconciliation-details-dialog"></account-reconciliation-details-dialog>
            </i18n-context>
          </device-context>
        </database-context>
      </router-context>
    </ready-context>
  `;
  await import('#web/desktop/components/account-reconciliation-details-dialog.js');
  await customElements.whenDefined('account-reconciliation-details-dialog');
}

async function seedCheckpoint(sql) {
  const entryTime = new Date('2025-01-01T00:00:00.000Z').getTime();
  const checkpointTime = new Date('2025-01-31T23:00:00.000Z').getTime();
  await sql`
    INSERT INTO journal_entries (ref, entry_time, note)
    VALUES (${93001}, ${entryTime}, ${'Seed bank balance'})
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
      ${93001},
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
      ${93001},
      ${31000},
      ${0},
      ${10000000},
      ${'Capital injection'}
    )
  `;
  await sql`
    UPDATE journal_entries
    SET post_time = ${entryTime}
    WHERE ref = ${93001}
  `;
  await sql`
    INSERT INTO reconciliation_checkpoints (
      id,
      account_code,
      type,
      checkpoint_time,
      external_balance,
      adjustment_journal_entry_ref,
      note,
      create_time
    ) VALUES (
      ${1},
      ${11120},
      ${'STATEMENT'},
      ${checkpointTime},
      ${9500000},
      ${93002},
      ${'January statement'},
      ${checkpointTime}
    )
  `;
}

describe('Account Reconciliation Details Dialog', function () {
  useConsoleOutput(test);
  useStrict(test);
  const tursoLibSQLiteServer = useTursoLibSQLiteServer(test);

  test('it displays checkpoint balances and adjustment journal reference', async function ({ page }) {
    await Promise.all([
      loadEmptyFixture(page),
      setupDatabase(tursoLibSQLiteServer(), seedCheckpoint),
    ]);
    await page.evaluate(setupView, [tursoLibSQLiteServer().url, '1']);

    await page.getByRole('button', { name: 'Open Details' }).click();
    const dialog = page.getByRole('dialog', { name: 'Reconciliation #1' });

    await expect(dialog).toBeVisible();
    await expect(dialog.getByText('Bank BCA')).toBeVisible();
    await expect(dialog.getByText('Statement', { exact: true })).toBeVisible();
    await expect(dialog.getByText('IDR 9,500,000', { exact: true })).toBeVisible();
    await expect(dialog.getByText('IDR 10,000,000', { exact: true })).toBeVisible();
    await expect(dialog.getByText('93002')).toBeVisible();
    await expect(dialog.getByText('January statement')).toBeVisible();
  });
});
