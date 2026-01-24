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
          <database-context provider="turso" turso-url=${tursoDatabaseUrl}>
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

describe('Journal Entries View - Basic Display', function () {
  // useConsoleOutput(test);
  useStrict(test);
  const tursoLibSQLiteServer = useTursoLibSQLiteServer(test);

  test('it shall display empty state when no journal entries exist', async function ({ page }) {
    await loadEmptyFixture(page);

    await page.evaluate(setupView, tursoLibSQLiteServer().url);

    await expect(page.getByRole('table', { name: 'Journal entries list' })).not.toBeVisible();
    await expect(page.getByText('No journal entries found')).toBeVisible();
    await expect(page.getByText('Journal entries will appear here once you create them.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'New Entry' }).first()).toBeVisible();
  });

  test('it shall display journal entries list when entries exist', async function ({ page }) {
    await Promise.all([
      loadEmptyFixture(page),
      setupDatabase(tursoLibSQLiteServer(), async function setupData(sql) {
        await sql`INSERT INTO accounts (account_code, name, normal_balance, create_time, update_time) VALUES (10100, 'Cash', 0, 0, 0)`;
        await sql`INSERT INTO accounts (account_code, name, normal_balance, create_time, update_time) VALUES (40100, 'Revenue', 1, 0, 0)`;

        await sql`INSERT INTO journal_entries (ref, entry_time, note, source_type, post_time) VALUES (1, 1704067200000, 'First entry', 'Manual', 1704067200000)`;
        await sql`INSERT INTO journal_entry_lines (journal_entry_ref, line_number, account_code, debit, credit) VALUES (1, 1, 10100, 100000, 0)`;
        await sql`INSERT INTO journal_entry_lines (journal_entry_ref, line_number, account_code, debit, credit) VALUES (1, 2, 40100, 0, 100000)`;

        await sql`INSERT INTO journal_entries (ref, entry_time, note, source_type, post_time) VALUES (2, 1704153600000, 'Second entry', 'System', 1704153600000)`;
        await sql`INSERT INTO journal_entry_lines (journal_entry_ref, line_number, account_code, debit, credit) VALUES (2, 1, 10100, 200000, 0)`;
        await sql`INSERT INTO journal_entry_lines (journal_entry_ref, line_number, account_code, debit, credit) VALUES (2, 2, 40100, 0, 200000)`;
      }),
    ]);

    await page.evaluate(setupView, tursoLibSQLiteServer().url);

    await expect(page.getByRole('table', { name: 'Journal entries list' })).toBeVisible();
    await expect(page.getByRole('button', { name: '#1', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: '#2', exact: true })).toBeVisible();

    const tableContent = page.getByRole('table', { name: 'Journal entries list' });
    await expect(tableContent.getByText('First entry')).toBeVisible();
    await expect(tableContent.getByText('Second entry')).toBeVisible();
    await expect(tableContent.getByText('IDR 100,000')).toBeVisible();
    await expect(tableContent.getByText('IDR 200,000')).toBeVisible();
  });

  test('it shall display posted status for posted entries', async function ({ page }) {
    await Promise.all([
      loadEmptyFixture(page),
      setupDatabase(tursoLibSQLiteServer(), async function setupData(sql) {
        await sql`INSERT INTO accounts (account_code, name, normal_balance, create_time, update_time) VALUES (10100, 'Cash', 0, 0, 0)`;
        await sql`INSERT INTO accounts (account_code, name, normal_balance, create_time, update_time) VALUES (40100, 'Revenue', 1, 0, 0)`;

        await sql`INSERT INTO journal_entries (ref, entry_time, note, source_type, post_time) VALUES (1, 1704067200000, 'Posted entry', 'Manual', 1704067200000)`;
        await sql`INSERT INTO journal_entry_lines (journal_entry_ref, line_number, account_code, debit, credit) VALUES (1, 1, 10100, 100000, 0)`;
        await sql`INSERT INTO journal_entry_lines (journal_entry_ref, line_number, account_code, debit, credit) VALUES (1, 2, 40100, 0, 100000)`;
      }),
    ]);

    await page.evaluate(setupView, tursoLibSQLiteServer().url);

    await expect(page.getByRole('table', { name: 'Journal entries list' })).toBeVisible();
    const tableContent = page.getByRole('table', { name: 'Journal entries list' });
    await expect(tableContent.getByText('Posted', { exact: true })).toBeVisible();
  });

  test('it shall display draft status for unposted entries', async function ({ page }) {
    await Promise.all([
      loadEmptyFixture(page),
      setupDatabase(tursoLibSQLiteServer(), async function setupData(sql) {
        await sql`INSERT INTO accounts (account_code, name, normal_balance, create_time, update_time) VALUES (10100, 'Cash', 0, 0, 0)`;
        await sql`INSERT INTO accounts (account_code, name, normal_balance, create_time, update_time) VALUES (40100, 'Revenue', 1, 0, 0)`;

        await sql`INSERT INTO journal_entries (ref, entry_time, note, source_type) VALUES (1, 1704067200000, 'Draft entry', 'Manual')`;
        await sql`INSERT INTO journal_entry_lines (journal_entry_ref, line_number, account_code, debit, credit) VALUES (1, 1, 10100, 100000, 0)`;
        await sql`INSERT INTO journal_entry_lines (journal_entry_ref, line_number, account_code, debit, credit) VALUES (1, 2, 40100, 0, 100000)`;
      }),
    ]);

    await page.evaluate(setupView, tursoLibSQLiteServer().url);

    await expect(page.getByRole('table', { name: 'Journal entries list' })).toBeVisible();
    const tableContent = page.getByRole('table', { name: 'Journal entries list' });
    await expect(tableContent.getByText('Draft', { exact: true })).toBeVisible();
  });

  test('it shall display source type badges', async function ({ page }) {
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

    await expect(page.getByRole('table', { name: 'Journal entries list' })).toBeVisible();

    const manualRow = page.getByRole('row').filter({ hasText: 'Manual entry' });
    await expect(manualRow.getByRole('cell', { name: 'Manual', exact: true })).toBeVisible();

    const systemRow = page.getByRole('row').filter({ hasText: 'System entry' });
    await expect(systemRow.getByRole('cell', { name: 'System', exact: true })).toBeVisible();
  });
});

describe('Journal Entries View - Source Filter', function () {
  // useConsoleOutput(test);
  const tursoLibSQLiteServer = useTursoLibSQLiteServer(test);

  test('it shall filter by source type', async function ({ page }) {
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

    await expect(page.getByRole('table', { name: 'Journal entries list' })).toBeVisible();
    await expect(page.getByRole('button', { name: '#1', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: '#2', exact: true })).toBeVisible();

    await page.locator('#source-filter-input').click();
    await page.getByRole('menuitem', { name: 'Manual' }).click();

    await expect(page.getByRole('button', { name: '#1', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: '#2', exact: true })).not.toBeVisible();
    await expect(page.getByText('Manual entry')).toBeVisible();
    await expect(page.getByText('System entry')).not.toBeVisible();
  });

  test('it shall filter by system source', async function ({ page }) {
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

    await expect(page.getByRole('table', { name: 'Journal entries list' })).toBeVisible();

    await page.locator('#source-filter-input').click();
    await page.getByRole('menuitem', { name: 'System' }).click();

    await expect(page.getByRole('button', { name: '#2', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: '#1', exact: true })).not.toBeVisible();
    await expect(page.getByText('System entry')).toBeVisible();
    await expect(page.getByText('Manual entry')).not.toBeVisible();
  });

  test('it shall reset to all sources', async function ({ page }) {
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

    await page.locator('#source-filter-input').click();
    await page.getByRole('menuitem', { name: 'Manual' }).click();

    await expect(page.getByRole('button', { name: '#1', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: '#2', exact: true })).not.toBeVisible();

    await page.locator('#source-filter-input').click();
    await page.getByRole('menuitem', { name: 'All Sources' }).click();

    await expect(page.getByRole('button', { name: '#1', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: '#2', exact: true })).toBeVisible();
  });
});

describe('Journal Entries View - Status Filter', function () {
  // useConsoleOutput(test);
  const tursoLibSQLiteServer = useTursoLibSQLiteServer(test);

  test('it shall filter by posted status', async function ({ page }) {
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

    await expect(page.getByRole('table', { name: 'Journal entries list' })).toBeVisible();
    await expect(page.getByRole('button', { name: '#1', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: '#2', exact: true })).toBeVisible();

    await page.locator('#status-filter-input').click();
    await page.getByRole('menuitemradio', { name: 'Posted' }).click();

    await expect(page.getByRole('button', { name: '#1', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: '#2', exact: true })).not.toBeVisible();
    await expect(page.getByText('Posted entry')).toBeVisible();
    await expect(page.getByText('Draft entry')).not.toBeVisible();
  });

  test('it shall filter by draft status', async function ({ page }) {
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

    await expect(page.getByRole('table', { name: 'Journal entries list' })).toBeVisible();

    await page.locator('#status-filter-input').click();
    await page.getByRole('menuitemradio', { name: 'Draft' }).click();

    await expect(page.getByRole('button', { name: '#2', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: '#1', exact: true })).not.toBeVisible();

    const tableContent = page.getByRole('table', { name: 'Journal entries list' });
    await expect(tableContent.getByText('Draft entry')).toBeVisible();
    await expect(tableContent.getByText('Posted entry')).not.toBeVisible();
  });

  test('it shall reset to all statuses', async function ({ page }) {
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

    await page.locator('#status-filter-input').click();
    await page.getByRole('menuitemradio', { name: 'Posted' }).click();

    await expect(page.getByRole('button', { name: '#1', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: '#2', exact: true })).not.toBeVisible();

    await page.locator('#status-filter-input').click();
    await page.getByRole('menuitemradio', { name: 'All Statuses' }).click();

    await expect(page.getByRole('button', { name: '#1', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: '#2', exact: true })).toBeVisible();
  });
});

describe('Journal Entries View - Pagination', function () {
  // useConsoleOutput(test);
  const tursoLibSQLiteServer = useTursoLibSQLiteServer(test);

  test('it shall display pagination when more than 10 entries exist', async function ({ page }) {
    await Promise.all([
      loadEmptyFixture(page),
      setupDatabase(tursoLibSQLiteServer(), async function setupData(sql) {
        await sql`INSERT INTO accounts (account_code, name, normal_balance, create_time, update_time) VALUES (10100, 'Cash', 0, 0, 0)`;
        await sql`INSERT INTO accounts (account_code, name, normal_balance, create_time, update_time) VALUES (40100, 'Revenue', 1, 0, 0)`;

        for (let index = 1; index <= 15; index++) {
          await sql`INSERT INTO journal_entries (ref, entry_time, note, source_type, post_time) VALUES (${index}, ${1704067200000 + index * 1000}, ${'Entry ' + index}, 'Manual', ${1704067200000 + index * 1000})`;
          await sql`INSERT INTO journal_entry_lines (journal_entry_ref, line_number, account_code, debit, credit) VALUES (${index}, 1, 10100, 100000, 0)`;
          await sql`INSERT INTO journal_entry_lines (journal_entry_ref, line_number, account_code, debit, credit) VALUES (${index}, 2, 40100, 0, 100000)`;
        }
      }),
    ]);

    await page.evaluate(setupView, tursoLibSQLiteServer().url);

    await expect(page.getByRole('navigation')).toBeVisible();
    await expect(page.getByText('Showing 1–10 of 15')).toBeVisible();
    await expect(page.getByText('Page 1 of 2')).toBeVisible();
  });

  test('it shall navigate to next page', async function ({ page }) {
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

    await expect(page.getByText('Showing 1–10 of 15')).toBeVisible();

    await page.getByRole('button', { name: 'Next page' }).click();

    await expect(page.getByText('Showing 11–15 of 15')).toBeVisible();
    await expect(page.getByText('Page 2 of 2')).toBeVisible();
  });

  test('it shall navigate to previous page', async function ({ page }) {
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

    await page.getByRole('button', { name: 'Next page' }).click();
    await expect(page.getByText('Showing 11–15 of 15')).toBeVisible();

    await page.getByRole('button', { name: 'Previous page' }).click();

    await expect(page.getByText('Showing 1–10 of 15')).toBeVisible();
    await expect(page.getByText('Page 1 of 2')).toBeVisible();
  });

  test('it shall navigate to first page', async function ({ page }) {
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

    await page.getByRole('button', { name: 'Next page' }).click();
    await expect(page.getByText('Page 2 of 2')).toBeVisible();

    await page.getByRole('button', { name: 'First page' }).click();

    await expect(page.getByText('Showing 1–10 of 15')).toBeVisible();
    await expect(page.getByText('Page 1 of 2')).toBeVisible();
  });

  test('it shall navigate to last page', async function ({ page }) {
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

    await expect(page.getByText('Page 1 of 2')).toBeVisible();

    await page.getByRole('button', { name: 'Last page' }).click();

    await expect(page.getByText('Showing 11–15 of 15')).toBeVisible();
    await expect(page.getByText('Page 2 of 2')).toBeVisible();
  });
});

describe('Journal Entries View - Details Dialog', function () {
  // useConsoleOutput(test);
  const tursoLibSQLiteServer = useTursoLibSQLiteServer(test);

  test('it shall open details dialog when clicking journal entry ref', async function ({ page }) {
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

    await expect(page.getByRole('table', { name: 'Journal entries list' })).toBeVisible();

    await page.getByRole('button', { name: '#1', exact: true }).click();

    await expect(page.getByRole('dialog', { name: 'Journal Entry #1' })).toBeVisible();
  });
});
