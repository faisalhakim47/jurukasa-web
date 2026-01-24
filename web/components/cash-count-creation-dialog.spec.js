import { test, expect } from '@playwright/test';
import { useTursoLibSQLiteServer } from '#test/playwright/hooks/use-turso-libsqlite-server.js';
import { useConsoleOutput } from '#test/playwright/hooks/use-console-output.js';
import { loadEmptyFixture } from '#test/playwright/tools/fixture.js';
import { setupDatabase } from '#test/playwright/tools/database.js';
import { useStrict } from '#test/playwright/hooks/use-strict.js';

/** @import { DatabaseContextElement } from '#web/contexts/database-context.js' */

const { describe } = test;

/** @param {string} tursoDatabaseUrl */
async function setupView(tursoDatabaseUrl) {
  document.body.innerHTML = `
    <ready-context>
      <time-context>
        <router-context>
          <database-context provider="turso" turso-url="${tursoDatabaseUrl}">
            <device-context>
              <i18n-context>
                <button
                  type="button"
                  commandfor="cash-count-creation-dialog"
                  command="--open"
                >Count Cash</button>
                <cash-count-creation-dialog
                  id="cash-count-creation-dialog"
                ></cash-count-creation-dialog>
              </i18n-context>
            </device-context>
          </database-context>
        </router-context>
      </time-context>
    </ready-context>
  `;
}

/**
 * Setup a test database with cash accounts
 * @param {any} sql
 */
async function setupCashAccounts(sql) {
  const testTime = Date.now();

  // Cash account (11110) already exists from chart of accounts fixture
  // It already has the 'Cash Flow - Cash Equivalents' tag

  const entryTime = testTime;
  await sql`INSERT INTO journal_entries (entry_time) VALUES (${entryTime})`;
  const result = await sql`SELECT ref FROM journal_entries WHERE entry_time = ${entryTime}`;
  const ref = Number(result.rows[0].ref);

  await sql`INSERT INTO journal_entry_lines_auto_number (journal_entry_ref, account_code, debit, credit) VALUES (${ref}, 11110, 500000, 0)`;
  await sql`INSERT INTO journal_entry_lines_auto_number (journal_entry_ref, account_code, debit, credit) VALUES (${ref}, 31000, 0, 500000)`;

  await sql`UPDATE journal_entries SET post_time = ${entryTime} WHERE ref = ${ref}`;
}

describe('Cash Count Creation Dialog', function () {
  // useConsoleOutput(test);
  useStrict(test);
  const tursoLibSQLiteServer = useTursoLibSQLiteServer(test);

  test('it shall create a cash count when balanced', async function ({ page }) {
    await Promise.all([
      loadEmptyFixture(page),
      setupDatabase(tursoLibSQLiteServer(), setupCashAccounts),
    ]);

    await page.evaluate(setupView, tursoLibSQLiteServer().url);

    await page.getByRole('button', { name: 'Count Cash' }).click();

    const dialog = page.getByRole('dialog', { name: 'Record Cash Count' });
    await expect(dialog).toBeVisible();

    await dialog.getByLabel('Cash Account').click();
    await page.getByRole('menu').getByRole('menuitem').filter({ hasText: '11110' }).click();

    await expect(dialog.getByText('System Balance')).toBeVisible();

    await dialog.getByLabel('Counted Amount').fill('500000');

    await expect(dialog.getByText('Cash Shortage')).not.toBeVisible();
    await expect(dialog.getByText('Cash Overage')).not.toBeVisible();

    const [cashCountCreatedEvent] = await Promise.all([
      page.evaluate(async function eventTest() {
        const { waitForEvent } = await import('#web/tools/dom.js');
        const cashCountDialog = document.getElementsByTagName('cash-count-creation-dialog').item(0);
        const event = await waitForEvent(cashCountDialog, 'cash-count-created', 5000);
        if (event instanceof CustomEvent) return event.detail;
        else throw new Error('Unexpected event type');
      }),
      dialog.getByRole('button', { name: 'Count Cash' }).click(),
    ]);

    expect(cashCountCreatedEvent.countTime).toBeDefined();

    const cashCount = await page.evaluate(async function getLatestCashCountFromDatabase() {
      /** @type {DatabaseContextElement} */
      const database = document.querySelector('database-context');
      const result = await database.sql`
        SELECT account_code, counted_amount, discrepancy
        FROM cash_count_history
        ORDER BY count_time DESC
        LIMIT 1
      `;
      return result.rows[0];
    });

    expect(Number(cashCount.account_code)).toBe(11110);
    expect(Number(cashCount.counted_amount)).toBe(500000);
    expect(Number(cashCount.discrepancy)).toBe(0);
  });

  test('it shall show shortage warning when counted less', async function ({ page }) {
    await Promise.all([
      loadEmptyFixture(page),
      setupDatabase(tursoLibSQLiteServer(), setupCashAccounts),
    ]);

    await page.evaluate(setupView, tursoLibSQLiteServer().url);

    await page.getByRole('button', { name: 'Count Cash' }).click();

    const dialog = page.getByRole('dialog', { name: 'Record Cash Count' });
    await expect(dialog).toBeVisible();

    await dialog.getByLabel('Cash Account').click();
    await page.getByRole('menu').getByRole('menuitem').filter({ hasText: '11110' }).click();

    await dialog.getByLabel('Counted Amount').fill('450000');

    await page.pause();
    await expect(dialog.getByText('Cash Shortage')).toBeVisible();
    await expect(dialog.getByText('This discrepancy will be automatically recorded')).toBeVisible();

    await dialog.getByRole('button', { name: 'Count Cash' }).click();

    await expect(dialog).not.toBeVisible();

    const cashCount = await page.evaluate(async function getLatestCashCountFromDatabase() {
      /** @type {DatabaseContextElement} */
      const database = document.querySelector('database-context');
      const result = await database.sql`
        SELECT account_code, counted_amount, discrepancy, discrepancy_type
        FROM cash_count_history
        ORDER BY count_time DESC
        LIMIT 1
      `;
      return result.rows[0];
    });

    expect(Number(cashCount.account_code)).toBe(11110);
    expect(Number(cashCount.counted_amount)).toBe(450000);
    expect(Number(cashCount.discrepancy)).toBe(-50000);
    expect(String(cashCount.discrepancy_type)).toBe('shortage');
  });

  test('it shall show overage warning when counted more', async function ({ page }) {
    await Promise.all([
      loadEmptyFixture(page),
      setupDatabase(tursoLibSQLiteServer(), setupCashAccounts),
    ]);

    await page.evaluate(setupView, tursoLibSQLiteServer().url);

    await page.getByRole('button', { name: 'Count Cash' }).click();

    const dialog = page.getByRole('dialog', { name: 'Record Cash Count' });
    await expect(dialog).toBeVisible();

    await dialog.getByLabel('Cash Account').click();
    await page.getByRole('menu').getByRole('menuitem').filter({ hasText: '11110' }).click();

    await dialog.getByLabel('Counted Amount').fill('550000');

    await expect(dialog.getByText('Cash Overage')).toBeVisible();

    await dialog.getByRole('button', { name: 'Count Cash' }).click();

    await expect(dialog).not.toBeVisible();

    const cashCount = await page.evaluate(async function getLatestCashCountFromDatabase() {
      /** @type {DatabaseContextElement} */
      const database = document.querySelector('database-context');
      const result = await database.sql`
        SELECT account_code, counted_amount, discrepancy, discrepancy_type
        FROM cash_count_history
        ORDER BY count_time DESC
        LIMIT 1
      `;
      return result.rows[0];
    });

    expect(Number(cashCount.account_code)).toBe(11110);
    expect(Number(cashCount.counted_amount)).toBe(550000);
    expect(Number(cashCount.discrepancy)).toBe(50000);
    expect(String(cashCount.discrepancy_type)).toBe('overage');
  });
});
