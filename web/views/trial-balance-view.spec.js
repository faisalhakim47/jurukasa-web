import { expect } from '@playwright/test';
import { createClient } from '@libsql/client';
import { jurukasaTest } from '#test/playwright/test-setup.js';
import { useTursoLibSQLiteServer } from '#test/playwright/hooks/use-turso-libsqlite-server.js';
import { useConsoleOutput } from '#test/playwright/hooks/use-console-output.js';
import { useStrict } from '#test/playwright/hooks/use-strict.js';
import { loadEmptyFixture } from '#test/playwright/tools/fixture.js';
import { setupDatabase } from '#test/playwright/tools/database.js';

const test = jurukasaTest;
const { describe } = test;

async function setupView({ url, id }) {
  window.history.replaceState({}, '', `/books/reports/trial-balance?reportId=${id}`);
  document.body.innerHTML = `
    <ready-context>
      <time-context>
        <router-context>
          <database-context provider="turso" name="My Business" turso-url=${url}>
            <device-context>
              <i18n-context>
                <trial-balance-view></trial-balance-view>
              </i18n-context>
            </device-context>
          </database-context>
        </router-context>
      </time-context>
    </ready-context>
  `;
}

/**
 * @param {string} url
 * @returns {Promise<number>}
 */
async function getReportId(url) {
  const client = createClient({ url });
  const result = await client.execute(`SELECT id FROM balance_reports WHERE name = 'Test Report'`);
  client.close();
  return Number(result.rows[0].id);
}

describe('Trial Balance View', function () {
  useConsoleOutput(test);
  useStrict(test);
  const tursoLibSQLiteServer = useTursoLibSQLiteServer(test);

  test('displays error state with refresh option for non-existent report', async function ({ page }) {
    await loadEmptyFixture(page);
    await page.evaluate(setupView, { url: tursoLibSQLiteServer().url, id: 1 });

    await expect(page.getByRole('heading', { name: 'Unable to load reports' }), 'it shall display error heading when report does not exist').toBeVisible();
    await expect(page.getByRole('button', { name: 'Refresh' }), 'it shall display refresh button for error recovery').toBeVisible();
  });

  test('displays trial balance table with account data and totals', async function ({ page }) {
    await loadEmptyFixture(page);
    await setupDatabase(tursoLibSQLiteServer(), async function setupData(sql) {
      await sql`INSERT INTO accounts (account_code, name, normal_balance, balance, is_active, is_posting_account, create_time, update_time) VALUES (11001, 'Cash', 0, 0, 1, 1, 1704067200000, 1704067200000)`;
      await sql`INSERT INTO accounts (account_code, name, normal_balance, balance, is_active, is_posting_account, create_time, update_time) VALUES (31001, 'Sales Revenue', 1, 0, 1, 1, 1704067200000, 1704067200000)`;
      await sql`INSERT INTO account_tags (account_code, tag) VALUES (11001, 'Balance Sheet - Current Asset')`;
      await sql`INSERT INTO account_tags (account_code, tag) VALUES (31001, 'Income Statement - Revenue')`;
      await sql`INSERT INTO journal_entries (ref, entry_time, note, post_time, source_type, created_by) VALUES (1, 1704067200000, 'Test journal entry', 1704067200000, 'Manual', 'User')`;
      await sql`INSERT INTO journal_entry_lines (journal_entry_ref, line_number, account_code, debit, credit, description) VALUES (1, 1, 11001, 100000, 0, 'Cash debit')`;
      await sql`INSERT INTO journal_entry_lines (journal_entry_ref, line_number, account_code, debit, credit, description) VALUES (1, 2, 31001, 0, 100000, 'Sales revenue credit')`;
      await sql`INSERT INTO balance_reports (report_time, report_type, name, create_time) VALUES (1704067200000, 'Ad Hoc', 'Test Report', 1704067200000)`;
    });
    const reportId = await getReportId(tursoLibSQLiteServer().url);

    await page.evaluate(setupView, { url: tursoLibSQLiteServer().url, id: reportId });

    await expect(page.getByRole('table', { name: 'Trial Balance' }), 'it shall display trial balance table').toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Code' }), 'it shall display code column header').toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Account Name' }), 'it shall display account name column header').toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Normal' }), 'it shall display normal balance column header').toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Debit' }), 'it shall display debit column header').toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Credit' }), 'it shall display credit column header').toBeVisible();
    await expect(page.getByText('11001'), 'it shall display account code in table').toBeVisible();
    await expect(page.getByRole('row').filter({ hasText: 'Total' }), 'it shall display total row').toBeVisible();
  });
});
