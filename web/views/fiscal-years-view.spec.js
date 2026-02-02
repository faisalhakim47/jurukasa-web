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
                <fiscal-years-view></fiscal-years-view>
              </i18n-context>
            </device-context>
          </database-context>
        </router-context>
      </time-context>
    </ready-context>
  `;
}

describe('Fiscal Years View', function () {
  useConsoleOutput(test);
  useStrict(test);
  const tursoLibSQLiteServer = useTursoLibSQLiteServer(test);

  test('view empty state and create new fiscal year flow', async function ({ page }) {
    await loadEmptyFixture(page);
    await page.evaluate(setupView, tursoLibSQLiteServer().url);

    await expect(page.getByRole('table', { name: 'Fiscal years list' }), 'it shall hide the fiscal years table when no data exists').not.toBeVisible();
    await expect(page.getByText('No fiscal years found'), 'it shall display empty state message').toBeVisible();
    await expect(page.getByText('Create your first fiscal year to start managing your accounting periods.'), 'it shall display empty state description').toBeVisible();
    await expect(page.getByRole('button', { name: 'Create Fiscal Year' }).first(), 'it shall display create fiscal year button in empty state').toBeVisible();
    await expect(page.getByRole('button', { name: 'New Fiscal Year' }), 'it shall display new fiscal year button in header').toBeVisible();

    const refreshButton = page.getByRole('button', { name: 'Refresh' });
    await expect(refreshButton, 'it shall display refresh button').toBeVisible();
    await expect(refreshButton, 'it shall have proper aria-label on refresh button').toHaveAttribute('aria-label', 'Refresh');

    await page.getByRole('button', { name: 'New Fiscal Year' }).click();
    await expect(page.getByRole('dialog', { name: 'Create New Fiscal Year' }), 'it shall open creation dialog when create button is clicked').toBeVisible();
  });

  test('view fiscal years list with all statuses and details flow', async function ({ page }) {
    await Promise.all([
      loadEmptyFixture(page),
      setupDatabase(tursoLibSQLiteServer(), async function setupData(sql) {
        const openBeginTime = new Date('2025-01-01').getTime();
        const openEndTime = new Date('2025-12-31').getTime();
        await sql`INSERT INTO fiscal_years (begin_time, end_time, name) VALUES (${openBeginTime}, ${openEndTime}, 'FY 2025 Open')`;

        const closedBeginTime = new Date('2024-01-01').getTime();
        const closedEndTime = new Date('2024-12-31').getTime();
        const postTime = new Date('2025-01-15').getTime();
        await sql`INSERT INTO fiscal_years (begin_time, end_time, name) VALUES (${closedBeginTime}, ${closedEndTime}, 'FY 2024 Closed')`;
        await sql`UPDATE fiscal_years SET post_time = ${postTime} WHERE begin_time = ${closedBeginTime}`;

        const reversedBeginTime = new Date('2023-01-01').getTime();
        const reversedEndTime = new Date('2023-12-31').getTime();
        const reversedPostTime = new Date('2024-01-15').getTime();
        const reversalTime = new Date('2024-02-01').getTime();
        await sql`INSERT INTO fiscal_years (begin_time, end_time, name) VALUES (${reversedBeginTime}, ${reversedEndTime}, 'FY 2023 Reversed')`;
        await sql`UPDATE fiscal_years SET post_time = ${reversedPostTime} WHERE begin_time = ${reversedBeginTime}`;
        await sql`UPDATE fiscal_years SET reversal_time = ${reversalTime} WHERE begin_time = ${reversedBeginTime}`;
      }),
    ]);

    await page.evaluate(setupView, tursoLibSQLiteServer().url);

    const table = page.getByRole('table', { name: 'Fiscal years list' });
    await expect(table, 'it shall display fiscal years table when data exists').toBeVisible();

    await expect(page.getByRole('button', { name: 'FY 2025 Open', exact: true }), 'it shall display open fiscal year').toBeVisible();
    await expect(page.getByRole('button', { name: 'FY 2024 Closed', exact: true }), 'it shall display closed fiscal year').toBeVisible();
    await expect(page.getByRole('button', { name: 'FY 2023 Reversed', exact: true }), 'it shall display reversed fiscal year').toBeVisible();

    await expect(table.getByRole('columnheader', { name: 'Name' }), 'it shall display Name column header').toBeVisible();
    await expect(table.getByRole('columnheader', { name: 'Begin Date' }), 'it shall display Begin Date column header').toBeVisible();
    await expect(table.getByRole('columnheader', { name: 'End Date' }), 'it shall display End Date column header').toBeVisible();
    await expect(table.getByRole('columnheader', { name: 'Status' }), 'it shall display Status column header').toBeVisible();
    await expect(table.getByRole('columnheader', { name: 'Closed On' }), 'it shall display Closed On column header').toBeVisible();
    await expect(table.getByRole('columnheader', { name: 'Closing Entry' }), 'it shall display Closing Entry column header').toBeVisible();

    const openStatusCell = page.getByRole('cell', { name: 'Open', exact: true });
    await expect(openStatusCell, 'it shall display Open status for open fiscal year').toBeVisible();

    await expect(page.getByRole('cell', { name: 'Closed Reverse FY 2024 Closed' }), 'it shall display Closed status for closed fiscal year').toBeVisible();

    await expect(page.getByRole('cell', { name: 'Reversed', exact: true }), 'it shall display Reversed status for reversed fiscal year').toBeVisible();

    await expect(page.getByRole('button', { name: 'Reverse FY 2024 Closed' }), 'it shall display reverse button for closed fiscal year').toBeVisible();
    await expect(page.getByRole('button', { name: 'Reverse FY 2025 Open' }), 'it shall not display reverse button for open fiscal year').not.toBeVisible();
    await expect(page.getByRole('button', { name: 'Reverse FY 2023 Reversed' }), 'it shall not display reverse button for reversed fiscal year').not.toBeVisible();
  });

  test('view fiscal year details dialog flow', async function ({ page }) {
    await Promise.all([
      loadEmptyFixture(page),
      setupDatabase(tursoLibSQLiteServer(), async function setupData(sql) {
        await sql`INSERT INTO fiscal_years (begin_time, end_time, name) VALUES (${new Date('2025-01-01').getTime()}, ${new Date('2025-12-31').getTime()}, 'Test Fiscal Year')`;
      }),
    ]);

    await page.evaluate(setupView, tursoLibSQLiteServer().url);

    await expect(page.getByRole('table', { name: 'Fiscal years list' }), 'it shall display fiscal years table').toBeVisible();

    await page.getByRole('button', { name: 'Test Fiscal Year', exact: true }).click();

    const dialog = page.getByRole('dialog', { name: 'Test Fiscal Year' });
    await expect(dialog, 'it shall open fiscal year details dialog when clicking on fiscal year name').toBeVisible();
    await expect(dialog.getByRole('heading', { name: 'Test Fiscal Year' }), 'it shall display fiscal year name in dialog heading').toBeVisible();
    await expect(dialog.getByText('Period'), 'it shall display Period label in dialog').toBeVisible();
    await expect(dialog.getByText('This fiscal year is open. Close it to view closing statements and income statement.'), 'it shall display open status description in dialog').toBeVisible();
  });

  test('view closed fiscal year details with closing entry flow', async function ({ page }) {
    await Promise.all([
      loadEmptyFixture(page),
      setupDatabase(tursoLibSQLiteServer(), async function setupData(sql) {
        const beginTime = new Date('2024-01-01').getTime();
        const endTime = new Date('2024-12-31').getTime();
        const postTime = new Date('2025-01-15').getTime();
        const entryTime = new Date('2024-06-15').getTime();

        await sql`INSERT INTO journal_entries (entry_time, note, source_type, created_by, post_time) VALUES (${entryTime}, 'Test entry', 'Manual', 'User', ${entryTime})`;
        await sql`INSERT INTO journal_entry_lines (journal_entry_ref, line_number, account_code, debit, credit) VALUES (1, 1, 41000, 0, 10000)`;
        await sql`INSERT INTO journal_entry_lines (journal_entry_ref, line_number, account_code, debit, credit) VALUES (1, 2, 51000, 10000, 0)`;

        await sql`INSERT INTO journal_entries (entry_time, note, source_type, created_by, post_time) VALUES (${postTime}, 'Fiscal Year Closing - FY 2024', 'System', 'System', ${postTime})`;

        await sql`INSERT INTO fiscal_years (begin_time, end_time, name, closing_journal_entry_ref) VALUES (${beginTime}, ${endTime}, 'Closed FY 2024', 2)`;
        await sql`UPDATE fiscal_years SET post_time = ${postTime} WHERE begin_time = ${beginTime}`;
      }),
    ]);

    await page.evaluate(setupView, tursoLibSQLiteServer().url);

    await page.getByRole('button', { name: 'Closed FY 2024', exact: true }).click();

    const dialog = page.getByRole('dialog', { name: 'Closed FY 2024' });
    await expect(dialog, 'it shall open closed fiscal year details dialog').toBeVisible();
    await expect(dialog.getByRole('heading', { name: 'Closed FY 2024' }), 'it shall display closed fiscal year name in dialog heading').toBeVisible();
    await expect(dialog.getByText('Period'), 'it shall display Period label in closed fiscal year dialog').toBeVisible();
    await expect(dialog.getByText('Closing Entry'), 'it shall display Closing Entry label in closed fiscal year dialog').toBeVisible();
    await expect(dialog.getByText('#2'), 'it shall display closing journal entry reference').toBeVisible();

    const table = page.getByRole('table', { name: 'Fiscal years list' });
    await expect(table.getByText('#2'), 'it shall display closing entry reference in table').toBeVisible();
  });

  test('open reversal dialog flow', async function ({ page }) {
    await Promise.all([
      loadEmptyFixture(page),
      setupDatabase(tursoLibSQLiteServer(), async function setupData(sql) {
        const beginTime = new Date('2024-01-01').getTime();
        const endTime = new Date('2024-12-31').getTime();
        const postTime = new Date('2025-01-15').getTime();
        await sql`INSERT INTO fiscal_years (begin_time, end_time, name) VALUES (${beginTime}, ${endTime}, 'FY for Reversal')`;
        await sql`UPDATE fiscal_years SET post_time = ${postTime} WHERE begin_time = ${beginTime}`;
      }),
    ]);

    await page.evaluate(setupView, tursoLibSQLiteServer().url);

    await expect(page.getByRole('table', { name: 'Fiscal years list' }), 'it shall display fiscal years table').toBeVisible();

    await page.getByRole('button', { name: 'Reverse FY for Reversal' }).click();

    await expect(page.getByRole('dialog', { name: 'FY for Reversal' }), 'it shall open reversal dialog when reverse button is clicked').toBeVisible();
  });

  test('view fiscal years sorted in descending order by begin time', async function ({ page }) {
    await Promise.all([
      loadEmptyFixture(page),
      setupDatabase(tursoLibSQLiteServer(), async function setupData(sql) {
        await sql`INSERT INTO fiscal_years (begin_time, end_time, name) VALUES (${new Date('2023-01-01').getTime()}, ${new Date('2023-12-31').getTime()}, 'FY 2023')`;
        await sql`INSERT INTO fiscal_years (begin_time, end_time, name) VALUES (${new Date('2025-01-01').getTime()}, ${new Date('2025-12-31').getTime()}, 'FY 2025')`;
        await sql`INSERT INTO fiscal_years (begin_time, end_time, name) VALUES (${new Date('2024-01-01').getTime()}, ${new Date('2024-12-31').getTime()}, 'FY 2024')`;
      }),
    ]);

    await page.evaluate(setupView, tursoLibSQLiteServer().url);

    await expect(page.getByRole('table', { name: 'Fiscal years list' }), 'it shall display fiscal years table').toBeVisible();

    const rows = page.getByRole('table', { name: 'Fiscal years list' }).getByRole('button', { name: 'FY' });
    await expect(rows.nth(0), 'it shall display most recent fiscal year first').toHaveText('FY 2025');
    await expect(rows.nth(1), 'it shall display second most recent fiscal year second').toHaveText('FY 2024');
    await expect(rows.nth(2), 'it shall display oldest fiscal year last').toHaveText('FY 2023');
  });

  test('view fiscal year with default name and formatted dates', async function ({ page }) {
    await Promise.all([
      loadEmptyFixture(page),
      setupDatabase(tursoLibSQLiteServer(), async function setupData(sql) {
        await sql`INSERT INTO fiscal_years (begin_time, end_time, name) VALUES (${new Date('2025-01-01').getTime()}, ${new Date('2025-12-31').getTime()}, NULL)`;
      }),
    ]);

    await page.evaluate(setupView, tursoLibSQLiteServer().url);

    await expect(page.getByRole('table', { name: 'Fiscal years list' }), 'it shall display fiscal years table').toBeVisible();
    await expect(page.getByRole('button', { name: 'Fiscal Year 2025', exact: true }), 'it shall display default generated name when fiscal year has no custom name').toBeVisible();
    await expect(page.getByText('Jan 1, 2025'), 'it shall display formatted begin date').toBeVisible();
    await expect(page.getByText('Dec 31, 2025'), 'it shall display formatted end date').toBeVisible();
  });

  test('view closed fiscal year with formatted closed date', async function ({ page }) {
    await Promise.all([
      loadEmptyFixture(page),
      setupDatabase(tursoLibSQLiteServer(), async function setupData(sql) {
        const beginTime = new Date('2024-01-01').getTime();
        const endTime = new Date('2024-12-31').getTime();
        const postTime = new Date('2025-01-15').getTime();
        await sql`INSERT INTO fiscal_years (begin_time, end_time, name) VALUES (${beginTime}, ${endTime}, 'FY 2024')`;
        await sql`UPDATE fiscal_years SET post_time = ${postTime} WHERE begin_time = ${beginTime}`;
      }),
    ]);

    await page.evaluate(setupView, tursoLibSQLiteServer().url);

    const table = page.getByRole('table', { name: 'Fiscal years list' });
    await expect(table, 'it shall display fiscal years table').toBeVisible();
    await expect(table.getByText('Jan 15, 2025'), 'it shall display formatted closed date for closed fiscal year').toBeVisible();
  });

  test('view open fiscal year with empty placeholders', async function ({ page }) {
    await Promise.all([
      loadEmptyFixture(page),
      setupDatabase(tursoLibSQLiteServer(), async function setupData(sql) {
        await sql`INSERT INTO fiscal_years (begin_time, end_time, name) VALUES (${new Date('2025-01-01').getTime()}, ${new Date('2025-12-31').getTime()}, 'FY 2025')`;
      }),
    ]);

    await page.evaluate(setupView, tursoLibSQLiteServer().url);

    const table = page.getByRole('table', { name: 'Fiscal years list' });
    await expect(table, 'it shall display fiscal years table').toBeVisible();

    const row = page.getByRole('row').filter({ has: page.getByRole('button', { name: 'FY 2025' }) });
    const cells = row.getByRole('cell');
    await expect(cells.nth(4), 'it shall display empty placeholder for closed date when fiscal year is open').toHaveText('—');
    await expect(cells.nth(5), 'it shall display empty placeholder for closing entry when fiscal year is open').toHaveText('—');
  });
});
