import { expect } from '@playwright/test';
import { jurukasaTest } from '#test/playwright/test-setup.js';
import { useTursoLibSQLiteServer } from '#test/playwright/hooks/use-turso-libsqlite-server.js';
import { useConsoleOutput } from '#test/playwright/hooks/use-console-output.js';
import { loadEmptyFixture } from '#test/playwright/tools/fixture.js';
import { setupDatabase } from '#test/playwright/tools/database.js';
import { useStrict } from '#test/playwright/hooks/use-strict.js';

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
                <button type="button" commandfor="cash-count-creation-dialog" command="--open">Open Dialog</button>
                <cash-count-creation-dialog id="cash-count-creation-dialog"></cash-count-creation-dialog>
              </i18n-context>
            </device-context>
          </database-context>
        </router-context>
      </time-context>
    </ready-context>
  `;
  await import('#web/desktop/components/cash-count-creation-dialog.js');
  await customElements.whenDefined('cash-count-creation-dialog');
}

async function seedCashAccount(sql) {
  const entryTime = new Date('2025-01-01T00:00:00.000Z').getTime();
  await sql`
    INSERT INTO journal_entries (ref, entry_time, note)
    VALUES (${92001}, ${entryTime}, ${'Seed cash balance'})
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
      ${92001},
      ${11110},
      ${500000},
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
      ${92001},
      ${31000},
      ${0},
      ${500000},
      ${'Capital injection'}
    )
  `;
  await sql`
    UPDATE journal_entries
    SET post_time = ${entryTime}
    WHERE ref = ${92001}
  `;
}

describe('Cash Count Creation Dialog', function () {
  useConsoleOutput(test);
  useStrict(test);
  const tursoLibSQLiteServer = useTursoLibSQLiteServer(test);

  test('it records balanced physical cash count without adjustment journal', async function ({ page }) {
    await Promise.all([
      loadEmptyFixture(page),
      setupDatabase(tursoLibSQLiteServer(), seedCashAccount),
    ]);
    await page.evaluate(setupView, tursoLibSQLiteServer().url);

    await page.getByRole('button', { name: 'Open Dialog' }).click();
    const dialog = page.getByRole('dialog', { name: 'Record Cash Count' });
    await expect(dialog).toBeVisible();

    await dialog.getByLabel('Cash Account', { exact: true }).click();
    await page.getByRole('menuitem', { name: '11110 - Kas' }).click();
    await dialog.getByLabel('Count Time').fill('2025-01-31T23:00');
    await dialog.getByLabel('Counted Amount').fill('500000');

    await dialog.getByRole('button', { name: 'Record Cash Count' }).click();
    await expect(dialog).not.toBeVisible();

    const checkpoint = await page.evaluate(async function readCheckpoint() {
      /** @type {DatabaseContextElement} */
      const database = document.querySelector('database-context');
      const result = await database.sql`
        SELECT external_balance, book_balance, adjustment_journal_entry_ref
        FROM reconciliation_checkpoints
        WHERE type = 'PHYSICAL'
      `;
      return result.rows[0];
    });

    expect(Number(checkpoint.external_balance)).toBe(500000);
    expect(Number(checkpoint.book_balance)).toBe(500000);
    expect(checkpoint.adjustment_journal_entry_ref).toBe(null);
  });

  test('it records shortage physical cash count with adjustment journal', async function ({ page }) {
    await Promise.all([
      loadEmptyFixture(page),
      setupDatabase(tursoLibSQLiteServer(), seedCashAccount),
    ]);
    await page.evaluate(setupView, tursoLibSQLiteServer().url);

    await page.getByRole('button', { name: 'Open Dialog' }).click();
    const dialog = page.getByRole('dialog', { name: 'Record Cash Count' });

    await dialog.getByLabel('Cash Account', { exact: true }).click();
    await page.getByRole('menuitem', { name: '11110 - Kas' }).click();
    await dialog.getByLabel('Count Time').fill('2025-01-31T23:00');
    await dialog.getByLabel('Counted Amount').fill('450000');

    await expect(dialog.getByText('Cash Shortage')).toBeVisible();
    await dialog.getByRole('button', { name: 'Record Cash Count' }).click();

    const checkpoint = await page.evaluate(async function readCheckpoint() {
      /** @type {DatabaseContextElement} */
      const database = document.querySelector('database-context');
      const result = await database.sql`
        SELECT discrepancy, adjustment_journal_entry_ref
        FROM reconciliation_history
        WHERE type = 'PHYSICAL'
      `;
      return result.rows[0];
    });

    expect(Number(checkpoint.discrepancy)).toBe(-50000);
    expect(Number(checkpoint.adjustment_journal_entry_ref)).toBeGreaterThan(0);
  });
});
