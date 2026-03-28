import { expect } from '@playwright/test';
import { jurukasaTest } from '#test/playwright/test-setup.js';
import { useTursoLibSQLiteServer } from '#test/playwright/hooks/use-turso-libsqlite-server.js';
import { setupDatabase } from '#test/playwright/tools/database.js';
import { useStrict } from '#test/playwright/hooks/use-strict.js';
import { loadEmptyFixture } from '#test/playwright/tools/fixture.js';
import { useConsoleOutput } from '#test/playwright/hooks/use-console-output.js';

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

async function seedStatementCheckpoint(sql) {
  const entryTime = new Date('2025-01-01T00:00:00.000Z').getTime();
  const checkpointTime = new Date('2025-01-31T23:00:00.000Z').getTime();
  await sql`
    INSERT INTO journal_entries (ref, entry_time, note)
    VALUES (${94001}, ${entryTime}, ${'Seed bank balance'})
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
      ${94001},
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
      ${94001},
      ${31000},
      ${0},
      ${10000000},
      ${'Capital injection'}
    )
  `;
  await sql`
    UPDATE journal_entries
    SET post_time = ${entryTime}
    WHERE ref = ${94001}
  `;
  await sql`
    INSERT INTO reconciliation_checkpoints (
      account_code,
      type,
      checkpoint_time,
      external_balance,
      adjustment_journal_entry_ref,
      note,
      create_time
    ) VALUES (
      ${11120},
      ${'STATEMENT'},
      ${checkpointTime},
      ${9500000},
      ${94002},
      ${'January statement'},
      ${checkpointTime}
    )
  `;
}

describe('Account Reconciliation List View', function () {
  useConsoleOutput(test);
  useStrict(test);
  const tursoLibSQLiteServer = useTursoLibSQLiteServer(test);

  test('it shows warning when reconciliation adjustment account tag is missing', async function ({ page }) {
    await Promise.all([
      loadEmptyFixture(page),
      setupDatabase(tursoLibSQLiteServer(), async function removeAdjustmentTag(sql) {
        await sql`DELETE FROM account_tags WHERE tag = 'Reconciliation - Adjustment'`;
      }),
    ]);
    await page.evaluate(setupView, tursoLibSQLiteServer().url);

    await expect(page.getByRole('heading', { name: 'Reconciliation Adjustment Account Required' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Create Account' })).toBeVisible();
  });

  test('it lists seeded statement checkpoint rows', async function ({ page }) {
    await Promise.all([
      loadEmptyFixture(page),
      setupDatabase(tursoLibSQLiteServer(), seedStatementCheckpoint),
    ]);
    await page.evaluate(setupView, tursoLibSQLiteServer().url);

    await expect(page.getByRole('table', { name: 'Statement reconciliation history' })).toBeVisible();
    await expect(page.getByText('Bank BCA')).toBeVisible();
    await expect(page.getByText('9,500,000')).toBeVisible();
    await expect(page.getByText('93002')).not.toBeVisible();
    await expect(page.getByText('94002')).toBeVisible();
  });
});
