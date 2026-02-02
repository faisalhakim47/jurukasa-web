import { expect } from '@playwright/test';
import { jurukasaTest } from '#test/playwright/test-setup.js';
import { useTursoLibSQLiteServer } from '#test/playwright/hooks/use-turso-libsqlite-server.js';
import { useConsoleOutput } from '#test/playwright/hooks/use-console-output.js';
import { loadEmptyFixture } from '#test/playwright/tools/fixture.js';
import { setupDatabase } from '#test/playwright/tools/database.js';
import { useStrict } from '#test/playwright/hooks/use-strict.js';

const test = jurukasaTest;
const { describe } = test;

/** @param {string} tursoDatabaseUrl */
async function setupView(tursoDatabaseUrl) {
  document.body.innerHTML = `
    <ready-context>
      <time-context>
        <router-context>
          <database-context provider="turso" name="My Business" turso-url=${tursoDatabaseUrl}>
            <device-context>
              <i18n-context>
                <journal-entries-view></journal-entries-view>
              </i18n-context>
            </device-context>
          </database-context>
        </router-context>
      </time-context>
    </ready-context>
  `;
}

describe('Journal Entries View', function () {
  useConsoleOutput(test);
  useStrict(test);
  const tursoLibSQLiteServer = useTursoLibSQLiteServer(test);

  test('display empty state when no journal entries exist', async function ({ page }) {
    await loadEmptyFixture(page);

    await page.evaluate(setupView, tursoLibSQLiteServer().url);

    await expect(page.getByRole('table', { name: 'Journal entries list' }), 'table shall not be visible when no entries exist').not.toBeVisible();
    await expect(page.getByText('No journal entries found'), 'empty state heading shall be visible').toBeVisible();
    await expect(page.getByText('Journal entries will appear here once you create them.'), 'empty state description shall be visible').toBeVisible();
    await expect(page.getByRole('button', { name: 'New Entry' }).first(), 'New Entry button shall be visible').toBeVisible();
  });

  test('display journal entries list with correct data, status badges, and source type badges', async function ({ page }) {
    await Promise.all([
      loadEmptyFixture(page),
      setupDatabase(tursoLibSQLiteServer(), async function setupData(sql) {
        await sql`INSERT INTO accounts (account_code, name, normal_balance, create_time, update_time) VALUES (10100, 'Cash', 0, 0, 0)`;
        await sql`INSERT INTO accounts (account_code, name, normal_balance, create_time, update_time) VALUES (40100, 'Revenue', 1, 0, 0)`;

        await sql`INSERT INTO journal_entries (ref, entry_time, note, source_type, post_time) VALUES (1, 1704067200000, 'Posted manual entry', 'Manual', 1704067200000)`;
        await sql`INSERT INTO journal_entry_lines (journal_entry_ref, line_number, account_code, debit, credit) VALUES (1, 1, 10100, 100000, 0)`;
        await sql`INSERT INTO journal_entry_lines (journal_entry_ref, line_number, account_code, debit, credit) VALUES (1, 2, 40100, 0, 100000)`;

        await sql`INSERT INTO journal_entries (ref, entry_time, note, source_type, post_time) VALUES (2, 1704153600000, 'Posted system entry', 'System', 1704153600000)`;
        await sql`INSERT INTO journal_entry_lines (journal_entry_ref, line_number, account_code, debit, credit) VALUES (2, 1, 10100, 200000, 0)`;
        await sql`INSERT INTO journal_entry_lines (journal_entry_ref, line_number, account_code, debit, credit) VALUES (2, 2, 40100, 0, 200000)`;

        await sql`INSERT INTO journal_entries (ref, entry_time, note, source_type) VALUES (3, 1704240000000, 'Draft entry', 'Manual')`;
        await sql`INSERT INTO journal_entry_lines (journal_entry_ref, line_number, account_code, debit, credit) VALUES (3, 1, 10100, 300000, 0)`;
        await sql`INSERT INTO journal_entry_lines (journal_entry_ref, line_number, account_code, debit, credit) VALUES (3, 2, 40100, 0, 300000)`;
      }),
    ]);

    await page.evaluate(setupView, tursoLibSQLiteServer().url);

    await expect(page.getByRole('table', { name: 'Journal entries list' }), 'journal entries table shall be visible').toBeVisible();
    await expect(page.getByRole('button', { name: '#1', exact: true }), 'journal entry ref button #1 shall be visible').toBeVisible();
    await expect(page.getByRole('button', { name: '#2', exact: true }), 'journal entry ref button #2 shall be visible').toBeVisible();
    await expect(page.getByRole('button', { name: '#3', exact: true }), 'journal entry ref button #3 shall be visible').toBeVisible();

    const tableContent = page.getByRole('table', { name: 'Journal entries list' });
    await expect(tableContent.getByText('Posted manual entry'), 'first entry note shall be visible').toBeVisible();
    await expect(tableContent.getByText('Posted system entry'), 'second entry note shall be visible').toBeVisible();
    await expect(tableContent.getByText('Draft entry'), 'third entry note shall be visible').toBeVisible();
    await expect(tableContent.getByText('IDR 100,000'), 'first entry amount shall be visible').toBeVisible();
    await expect(tableContent.getByText('IDR 200,000'), 'second entry amount shall be visible').toBeVisible();
    await expect(tableContent.getByText('IDR 300,000'), 'third entry amount shall be visible').toBeVisible();

    await expect(tableContent.getByText('Posted', { exact: true }).first(), 'Posted status badge shall be visible').toBeVisible();
    await expect(tableContent.getByText('Draft', { exact: true }), 'Draft status badge shall be visible').toBeVisible();

    const manualRow = page.getByRole('row').filter({ hasText: 'Posted manual entry' });
    await expect(manualRow.getByRole('cell', { name: 'Manual', exact: true }), 'Manual source type badge shall be visible').toBeVisible();

    const systemRow = page.getByRole('row').filter({ hasText: 'Posted system entry' });
    await expect(systemRow.getByRole('cell', { name: 'System', exact: true }), 'System source type badge shall be visible').toBeVisible();
  });

  test('filter journal entries by source type and reset to all sources', async function ({ page }) {
    await Promise.all([
      loadEmptyFixture(page),
      setupDatabase(tursoLibSQLiteServer(), async function setupData(sql) {
        await sql`INSERT INTO accounts (account_code, name, normal_balance, create_time, update_time) VALUES (10100, 'Cash', 0, 0, 0)`;
        await sql`INSERT INTO accounts (account_code, name, normal_balance, create_time, update_time) VALUES (40100, 'Revenue', 1, 0, 0)`;

        await sql`INSERT INTO journal_entries (ref, entry_time, note, source_type, post_time) VALUES (1, 1704067200000, 'Manual entry', 'Manual', 1704067200000)`;
        await sql`INSERT INTO journal_entry_lines (journal_entry_ref, line_number, account_code, debit, credit) VALUES (1, 1, 10100, 100000, 0)`;
        await sql`INSERT INTO journal_entry_lines (journal_entry_ref, line_number, account_code, debit, credit) VALUES (1, 2, 40100, 0, 100000)`;

        await sql`INSERT INTO journal_entries (ref, entry_time, note, source_type, post_time) VALUES (2, 1704153600000, 'System entry', 'System', 1704153600000)`;
        await sql`INSERT INTO journal_entry_lines (journal_entry_ref, line_number, account_code, debit, credit) VALUES (2, 1, 10100, 200000, 0)`;
        await sql`INSERT INTO journal_entry_lines (journal_entry_ref, line_number, account_code, debit, credit) VALUES (2, 2, 40100, 0, 200000)`;
      }),
    ]);

    await page.evaluate(setupView, tursoLibSQLiteServer().url);

    await expect(page.getByRole('table', { name: 'Journal entries list' }), 'journal entries table shall be visible').toBeVisible();
    await expect(page.getByRole('button', { name: '#1', exact: true }), 'entry #1 shall be visible initially').toBeVisible();
    await expect(page.getByRole('button', { name: '#2', exact: true }), 'entry #2 shall be visible initially').toBeVisible();

    await page.getByLabel('Source').click();
    await page.getByRole('menuitem', { name: 'Manual' }).click();

    await expect(page.getByRole('button', { name: '#1', exact: true }), 'manual entry shall be visible after filtering by Manual source').toBeVisible();
    await expect(page.getByRole('button', { name: '#2', exact: true }), 'system entry shall not be visible when filtering by Manual source').not.toBeVisible();
    await expect(page.getByText('Manual entry'), 'manual entry text shall be visible').toBeVisible();
    await expect(page.getByText('System entry'), 'system entry text shall not be visible when filtering by Manual source').not.toBeVisible();

    await page.getByLabel('Source').click();
    await page.getByRole('menuitem', { name: 'System' }).click();

    await expect(page.getByRole('button', { name: '#2', exact: true }), 'system entry shall be visible after filtering by System source').toBeVisible();
    await expect(page.getByRole('button', { name: '#1', exact: true }), 'manual entry shall not be visible when filtering by System source').not.toBeVisible();
    await expect(page.getByText('System entry'), 'system entry text shall be visible').toBeVisible();
    await expect(page.getByText('Manual entry'), 'manual entry text shall not be visible when filtering by System source').not.toBeVisible();

    await page.getByLabel('Source').click();
    await page.getByRole('menuitem', { name: 'All Sources' }).click();

    await expect(page.getByRole('button', { name: '#1', exact: true }), 'entry #1 shall be visible after resetting to all sources').toBeVisible();
    await expect(page.getByRole('button', { name: '#2', exact: true }), 'entry #2 shall be visible after resetting to all sources').toBeVisible();
  });

  test('filter journal entries by status and reset to all statuses', async function ({ page }) {
    await Promise.all([
      loadEmptyFixture(page),
      setupDatabase(tursoLibSQLiteServer(), async function setupData(sql) {
        await sql`INSERT INTO accounts (account_code, name, normal_balance, create_time, update_time) VALUES (10100, 'Cash', 0, 0, 0)`;
        await sql`INSERT INTO accounts (account_code, name, normal_balance, create_time, update_time) VALUES (40100, 'Revenue', 1, 0, 0)`;

        await sql`INSERT INTO journal_entries (ref, entry_time, note, source_type, post_time) VALUES (1, 1704067200000, 'Posted entry', 'Manual', 1704067200000)`;
        await sql`INSERT INTO journal_entry_lines (journal_entry_ref, line_number, account_code, debit, credit) VALUES (1, 1, 10100, 100000, 0)`;
        await sql`INSERT INTO journal_entry_lines (journal_entry_ref, line_number, account_code, debit, credit) VALUES (1, 2, 40100, 0, 100000)`;

        await sql`INSERT INTO journal_entries (ref, entry_time, note, source_type) VALUES (2, 1704153600000, 'Draft entry', 'Manual')`;
        await sql`INSERT INTO journal_entry_lines (journal_entry_ref, line_number, account_code, debit, credit) VALUES (2, 1, 10100, 200000, 0)`;
        await sql`INSERT INTO journal_entry_lines (journal_entry_ref, line_number, account_code, debit, credit) VALUES (2, 2, 40100, 0, 200000)`;
      }),
    ]);

    await page.evaluate(setupView, tursoLibSQLiteServer().url);

    await expect(page.getByRole('table', { name: 'Journal entries list' }), 'journal entries table shall be visible').toBeVisible();
    await expect(page.getByRole('button', { name: '#1', exact: true }), 'entry #1 shall be visible initially').toBeVisible();
    await expect(page.getByRole('button', { name: '#2', exact: true }), 'entry #2 shall be visible initially').toBeVisible();

    await page.getByLabel('Status').click();
    await page.getByRole('menuitemradio', { name: 'Posted' }).click();

    await expect(page.getByRole('button', { name: '#1', exact: true }), 'posted entry shall be visible after filtering by Posted status').toBeVisible();
    await expect(page.getByRole('button', { name: '#2', exact: true }), 'draft entry shall not be visible when filtering by Posted status').not.toBeVisible();
    await expect(page.getByText('Posted entry'), 'posted entry text shall be visible').toBeVisible();
    await expect(page.getByText('Draft entry'), 'draft entry text shall not be visible when filtering by Posted status').not.toBeVisible();

    await page.getByLabel('Status').click();
    await page.getByRole('menuitemradio', { name: 'Draft' }).click();

    await expect(page.getByRole('button', { name: '#2', exact: true }), 'draft entry shall be visible after filtering by Draft status').toBeVisible();
    await expect(page.getByRole('button', { name: '#1', exact: true }), 'posted entry shall not be visible when filtering by Draft status').not.toBeVisible();
    const tableContent = page.getByRole('table', { name: 'Journal entries list' });
    await expect(tableContent.getByText('Draft entry'), 'draft entry text shall be visible in table').toBeVisible();
    await expect(tableContent.getByText('Posted entry'), 'posted entry text shall not be visible in table when filtering by Draft status').not.toBeVisible();

    await page.getByLabel('Status').click();
    await page.getByRole('menuitemradio', { name: 'All Statuses' }).click();

    await expect(page.getByRole('button', { name: '#1', exact: true }), 'entry #1 shall be visible after resetting to all statuses').toBeVisible();
    await expect(page.getByRole('button', { name: '#2', exact: true }), 'entry #2 shall be visible after resetting to all statuses').toBeVisible();
  });

  test('display pagination and navigate between pages', async function ({ page }) {
    await Promise.all([
      loadEmptyFixture(page),
      setupDatabase(tursoLibSQLiteServer(), async function setupData(sql) {
        await sql`INSERT INTO accounts (account_code, name, normal_balance, create_time, update_time) VALUES (10100, 'Cash', 0, 0, 0)`;
        await sql`INSERT INTO accounts (account_code, name, normal_balance, create_time, update_time) VALUES (40100, 'Revenue', 1, 0, 0)`;

        for (let i = 1; i <= 15; i++) {
          await sql`INSERT INTO journal_entries (ref, entry_time, note, source_type, post_time) VALUES (${i}, ${1704067200000 + i * 1000}, ${'Entry ' + i}, 'Manual', ${1704067200000 + i * 1000})`;
          await sql`INSERT INTO journal_entry_lines (journal_entry_ref, line_number, account_code, debit, credit) VALUES (${i}, 1, 10100, 100000, 0)`;
          await sql`INSERT INTO journal_entry_lines (journal_entry_ref, line_number, account_code, debit, credit) VALUES (${i}, 2, 40100, 0, 100000)`;
        }
      }),
    ]);

    await page.evaluate(setupView, tursoLibSQLiteServer().url);

    await expect(page.getByRole('navigation'), 'pagination navigation shall be visible').toBeVisible();
    await expect(page.getByText('Showing 1–10 of 15'), 'pagination info shall show correct range on first page').toBeVisible();
    await expect(page.getByText('Page 1 of 2'), 'page number shall show 1 of 2 on first page').toBeVisible();

    await page.getByRole('button', { name: 'Next page' }).click();

    await expect(page.getByText('Showing 11–15 of 15'), 'pagination info shall show correct range after navigating to next page').toBeVisible();
    await expect(page.getByText('Page 2 of 2'), 'page number shall show 2 of 2 on second page').toBeVisible();

    await page.getByRole('button', { name: 'Previous page' }).click();

    await expect(page.getByText('Showing 1–10 of 15'), 'pagination info shall show correct range after navigating to previous page').toBeVisible();
    await expect(page.getByText('Page 1 of 2'), 'page number shall show 1 of 2 after navigating to previous page').toBeVisible();

    await page.getByRole('button', { name: 'Next page' }).click();
    await expect(page.getByText('Page 2 of 2'), 'page number shall show 2 of 2 before navigating to last page').toBeVisible();

    await page.getByRole('button', { name: 'First page' }).click();

    await expect(page.getByText('Showing 1–10 of 15'), 'pagination info shall show correct range after navigating to first page').toBeVisible();
    await expect(page.getByText('Page 1 of 2'), 'page number shall show 1 of 2 after navigating to first page').toBeVisible();

    await page.getByRole('button', { name: 'Last page' }).click();

    await expect(page.getByText('Showing 11–15 of 15'), 'pagination info shall show correct range after navigating to last page').toBeVisible();
    await expect(page.getByText('Page 2 of 2'), 'page number shall show 2 of 2 after navigating to last page').toBeVisible();
  });

  test('open details dialog when clicking journal entry ref', async function ({ page }) {
    await Promise.all([
      loadEmptyFixture(page),
      setupDatabase(tursoLibSQLiteServer(), async function setupData(sql) {
        await sql`INSERT INTO accounts (account_code, name, normal_balance, create_time, update_time) VALUES (10100, 'Cash', 0, 0, 0)`;
        await sql`INSERT INTO accounts (account_code, name, normal_balance, create_time, update_time) VALUES (40100, 'Revenue', 1, 0, 0)`;

        await sql`INSERT INTO journal_entries (ref, entry_time, note, source_type, post_time) VALUES (1, 1704067200000, 'Test entry', 'Manual', 1704067200000)`;
        await sql`INSERT INTO journal_entry_lines (journal_entry_ref, line_number, account_code, debit, credit) VALUES (1, 1, 10100, 100000, 0)`;
        await sql`INSERT INTO journal_entry_lines (journal_entry_ref, line_number, account_code, debit, credit) VALUES (1, 2, 40100, 0, 100000)`;
      }),
    ]);

    await page.evaluate(setupView, tursoLibSQLiteServer().url);

    await expect(page.getByRole('table', { name: 'Journal entries list' }), 'journal entries table shall be visible').toBeVisible();

    await page.getByRole('button', { name: '#1', exact: true }).click();

    await expect(page.getByRole('dialog', { name: 'Journal Entry #1' }), 'journal entry details dialog shall be visible').toBeVisible();
  });
});
