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

describe('Fiscal Years View - Basic Display', function () {
  // useConsoleOutput(test);
  useStrict(test);

  const tursoLibSQLiteServer = useTursoLibSQLiteServer(test);

  test('it shall display empty state when no fiscal years exist', async function ({ page }) {
    await loadEmptyFixture(page);

    await page.evaluate(setupView, tursoLibSQLiteServer().url);

    await expect(page.getByRole('table', { name: 'Fiscal years list' })).not.toBeVisible();
    await expect(page.getByText('No fiscal years found')).toBeVisible();
    await expect(page.getByText('Create your first fiscal year to start managing your accounting periods.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Create Fiscal Year' }).first()).toBeVisible();
  });

  test('it shall display fiscal years list when fiscal years exist', async function ({ page }) {
    await Promise.all([
      loadEmptyFixture(page),
      setupDatabase(tursoLibSQLiteServer(), async function setupData(sql) {
        await sql`INSERT INTO fiscal_years (begin_time, end_time, name) VALUES (${new Date('2023-01-01').getTime()}, ${new Date('2023-12-31').getTime()}, 'Fiscal Year 2023')`;
        await sql`INSERT INTO fiscal_years (begin_time, end_time, name) VALUES (${new Date('2024-01-01').getTime()}, ${new Date('2024-12-31').getTime()}, 'Fiscal Year 2024')`;
        await sql`INSERT INTO fiscal_years (begin_time, end_time, name) VALUES (${new Date('2025-01-01').getTime()}, ${new Date('2025-12-31').getTime()}, 'Fiscal Year 2025')`;
      }),
    ]);

    await page.evaluate(setupView, tursoLibSQLiteServer().url);

    await expect(page.getByRole('table', { name: 'Fiscal years list' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Fiscal Year 2023', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Fiscal Year 2024', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Fiscal Year 2025', exact: true })).toBeVisible();
  });

  test('it shall display fiscal year with Open status when not closed', async function ({ page }) {
    await Promise.all([
      loadEmptyFixture(page),
      setupDatabase(tursoLibSQLiteServer(), async function setupData(sql) {
        await sql`INSERT INTO fiscal_years (begin_time, end_time, name) VALUES (${new Date('2025-01-01').getTime()}, ${new Date('2025-12-31').getTime()}, 'FY 2025')`;
      }),
    ]);

    await page.evaluate(setupView, tursoLibSQLiteServer().url);

    await expect(page.getByRole('table', { name: 'Fiscal years list' })).toBeVisible();
    const statusCell = page.getByRole('cell').filter({ hasText: 'Open' });
    await expect(statusCell).toBeVisible();
  });

  test('it shall display fiscal year with Closed status when closed', async function ({ page }) {
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

    await expect(page.getByRole('table', { name: 'Fiscal years list' })).toBeVisible();
    const statusCell = page.getByRole('cell').filter({ hasText: 'Closed' });
    await expect(statusCell).toBeVisible();
  });

  test('it shall display fiscal year with Reversed status when reversed', async function ({ page }) {
    await Promise.all([
      loadEmptyFixture(page),
      setupDatabase(tursoLibSQLiteServer(), async function setupData(sql) {
        const beginTime = new Date('2023-01-01').getTime();
        const endTime = new Date('2023-12-31').getTime();
        const postTime = new Date('2024-01-15').getTime();
        const reversalTime = new Date('2024-02-01').getTime();
        await sql`INSERT INTO fiscal_years (begin_time, end_time, name) VALUES (${beginTime}, ${endTime}, 'FY 2023')`;
        await sql`UPDATE fiscal_years SET post_time = ${postTime} WHERE begin_time = ${beginTime}`;
        await sql`UPDATE fiscal_years SET reversal_time = ${reversalTime} WHERE begin_time = ${beginTime}`;
      }),
    ]);

    await page.evaluate(setupView, tursoLibSQLiteServer().url);

    await expect(page.getByRole('table', { name: 'Fiscal years list' })).toBeVisible();
    await expect(page.getByRole('table', { name: 'Fiscal years list' }).getByText('Reversed')).toBeVisible();
  });

  test('it shall display closing journal entry reference for closed fiscal year', async function ({ page }) {
    await Promise.all([
      loadEmptyFixture(page),
      setupDatabase(tursoLibSQLiteServer(), async function setupData(sql) {
        const beginTime = new Date('2024-01-01').getTime();
        const endTime = new Date('2024-12-31').getTime();
        const postTime = new Date('2025-01-15').getTime();
        const entryTime = new Date('2024-06-15').getTime();

        // Use existing accounts from the default chart of accounts
        // Account 41000 (Penjualan / Sales) already has 'Fiscal Year Closing - Revenue' tag
        // Account 51000 (Beban Pokok Penjualan) already has 'Fiscal Year Closing - Expense' tag
        // Account 32000 (Saldo Laba / Retained Earnings) already has 'Fiscal Year Closing - Retained Earning' tag

        // Create a journal entry to generate some activity
        await sql`INSERT INTO journal_entries (entry_time, note, source_type, created_by, post_time) VALUES (${entryTime}, 'Test entry', 'Manual', 'User', ${entryTime})`;
        await sql`INSERT INTO journal_entry_lines (journal_entry_ref, line_number, account_code, debit, credit) VALUES (1, 1, 41000, 0, 10000)`;
        await sql`INSERT INTO journal_entry_lines (journal_entry_ref, line_number, account_code, debit, credit) VALUES (1, 2, 51000, 10000, 0)`;

        // Create closing journal entry (ref = 2) that the fiscal year will reference
        await sql`INSERT INTO journal_entries (entry_time, note, source_type, created_by, post_time) VALUES (${postTime}, 'Fiscal Year Closing - FY 2024', 'System', 'System', ${postTime})`;

        // Create and close fiscal year with reference to closing journal entry
        await sql`INSERT INTO fiscal_years (begin_time, end_time, name, closing_journal_entry_ref) VALUES (${beginTime}, ${endTime}, 'FY 2024', 2)`;
        await sql`UPDATE fiscal_years SET post_time = ${postTime} WHERE begin_time = ${beginTime}`;
      }),
    ]);

    await page.evaluate(setupView, tursoLibSQLiteServer().url);

    await expect(page.getByRole('table', { name: 'Fiscal years list' })).toBeVisible();
    await expect(page.getByRole('table', { name: 'Fiscal years list' }).getByText('#2')).toBeVisible();
  });
});

describe('Fiscal Years View - Fiscal Year Details', function () {
  // useConsoleOutput(test);
  useStrict(test);
  const tursoLibSQLiteServer = useTursoLibSQLiteServer(test);

  test('it shall open fiscal year details dialog when clicking on fiscal year name', async function ({ page }) {
    await Promise.all([
      loadEmptyFixture(page),
      setupDatabase(tursoLibSQLiteServer(), async function setupData(sql) {
        await sql`INSERT INTO fiscal_years (begin_time, end_time, name) VALUES (${new Date('2025-01-01').getTime()}, ${new Date('2025-12-31').getTime()}, 'Test Fiscal Year')`;
      }),
    ]);

    await page.evaluate(setupView, tursoLibSQLiteServer().url);

    await expect(page.getByRole('table', { name: 'Fiscal years list' })).toBeVisible();

    await page.getByRole('button', { name: 'Test Fiscal Year', exact: true }).click();

    await expect(page.getByRole('dialog', { name: 'Test Fiscal Year' })).toBeVisible();
  });

  test('it shall display fiscal year details in dialog', async function ({ page }) {
    await Promise.all([
      loadEmptyFixture(page),
      setupDatabase(tursoLibSQLiteServer(), async function setupData(sql) {
        await sql`INSERT INTO fiscal_years (begin_time, end_time, name) VALUES (${new Date('2025-01-01').getTime()}, ${new Date('2025-12-31').getTime()}, 'Test Fiscal Year')`;
      }),
    ]);

    await page.evaluate(setupView, tursoLibSQLiteServer().url);

    await page.getByRole('button', { name: 'Test Fiscal Year', exact: true }).click();

    await expect(page.getByRole('dialog', { name: 'Test Fiscal Year' })).toBeVisible();
    await expect(page.getByRole('dialog').getByText('Test Fiscal Year')).toBeVisible();
  });
});

describe('Fiscal Years View - Reverse Button', function () {
  // useConsoleOutput(test);
  useStrict(test);
  const tursoLibSQLiteServer = useTursoLibSQLiteServer(test);

  test('it shall display reverse button for closed fiscal year', async function ({ page }) {
    await Promise.all([
      loadEmptyFixture(page),
      setupDatabase(tursoLibSQLiteServer(), async function setupData(sql) {
        const beginTime = new Date('2024-01-01').getTime();
        const endTime = new Date('2024-12-31').getTime();
        const postTime = new Date('2025-01-15').getTime();
        await sql`INSERT INTO fiscal_years (begin_time, end_time, name) VALUES (${beginTime}, ${endTime}, 'Closed FY')`;
        await sql`UPDATE fiscal_years SET post_time = ${postTime} WHERE begin_time = ${beginTime}`;
      }),
    ]);

    await page.evaluate(setupView, tursoLibSQLiteServer().url);

    await expect(page.getByRole('table', { name: 'Fiscal years list' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Reverse Closed FY' })).toBeVisible();
  });

  test('it shall not display reverse button for open fiscal year', async function ({ page }) {
    await Promise.all([
      loadEmptyFixture(page),
      setupDatabase(tursoLibSQLiteServer(), async function setupData(sql) {
        await sql`INSERT INTO fiscal_years (begin_time, end_time, name) VALUES (${new Date('2025-01-01').getTime()}, ${new Date('2025-12-31').getTime()}, 'Open FY')`;
      }),
    ]);

    await page.evaluate(setupView, tursoLibSQLiteServer().url);

    await expect(page.getByRole('table', { name: 'Fiscal years list' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Reverse Open FY' })).not.toBeVisible();
  });

  test('it shall not display reverse button for reversed fiscal year', async function ({ page }) {
    await Promise.all([
      loadEmptyFixture(page),
      setupDatabase(tursoLibSQLiteServer(), async function setupData(sql) {
        const beginTime = new Date('2023-01-01').getTime();
        const endTime = new Date('2023-12-31').getTime();
        const postTime = new Date('2024-01-15').getTime();
        const reversalTime = new Date('2024-02-01').getTime();
        await sql`INSERT INTO fiscal_years (begin_time, end_time, name) VALUES (${beginTime}, ${endTime}, 'Reversed FY')`;
        await sql`UPDATE fiscal_years SET post_time = ${postTime} WHERE begin_time = ${beginTime}`;
        await sql`UPDATE fiscal_years SET reversal_time = ${reversalTime} WHERE begin_time = ${beginTime}`;
      }),
    ]);

    await page.evaluate(setupView, tursoLibSQLiteServer().url);

    await expect(page.getByRole('table', { name: 'Fiscal years list' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Reverse Reversed FY' })).not.toBeVisible();
  });

  test('it shall open reversal dialog when reverse button is clicked', async function ({ page }) {
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

    await expect(page.getByRole('table', { name: 'Fiscal years list' })).toBeVisible();

    await page.getByRole('button', { name: 'Reverse FY for Reversal' }).click();

    await expect(page.getByRole('dialog', { name: 'FY for Reversal' })).toBeVisible();
  });
});

describe('Fiscal Years View - Action Buttons', function () {
  // useConsoleOutput(test);
  useStrict(test);
  const tursoLibSQLiteServer = useTursoLibSQLiteServer(test);

  test('it shall display create fiscal year button', async function ({ page }) {
    await loadEmptyFixture(page);

    await page.evaluate(setupView, tursoLibSQLiteServer().url);

    await expect(page.getByRole('button', { name: 'New Fiscal Year' })).toBeVisible();
  });

  test('it shall display refresh button', async function ({ page }) {
    await loadEmptyFixture(page);

    await page.evaluate(setupView, tursoLibSQLiteServer().url);

    await expect(page.getByRole('button', { name: 'Refresh' })).toBeVisible();
  });

  test('it shall open creation dialog when create button is clicked', async function ({ page }) {
    await loadEmptyFixture(page);

    await page.evaluate(setupView, tursoLibSQLiteServer().url);

    await expect(page.getByText('No fiscal years found')).toBeVisible();
    await page.getByRole('button', { name: 'New Fiscal Year' }).click();

    await expect(page.getByRole('dialog', { name: 'Create New Fiscal Year' })).toBeVisible();
  });
});

describe('Fiscal Years View - Data Display', function () {
  // useConsoleOutput(test);
  useStrict(test);
  const tursoLibSQLiteServer = useTursoLibSQLiteServer(test);

  test('it shall display fiscal years in descending order by begin time', async function ({ page }) {
    await Promise.all([
      loadEmptyFixture(page),
      setupDatabase(tursoLibSQLiteServer(), async function setupData(sql) {
        await sql`INSERT INTO fiscal_years (begin_time, end_time, name) VALUES (${new Date('2023-01-01').getTime()}, ${new Date('2023-12-31').getTime()}, 'FY 2023')`;
        await sql`INSERT INTO fiscal_years (begin_time, end_time, name) VALUES (${new Date('2025-01-01').getTime()}, ${new Date('2025-12-31').getTime()}, 'FY 2025')`;
        await sql`INSERT INTO fiscal_years (begin_time, end_time, name) VALUES (${new Date('2024-01-01').getTime()}, ${new Date('2024-12-31').getTime()}, 'FY 2024')`;
      }),
    ]);

    await page.evaluate(setupView, tursoLibSQLiteServer().url);

    await expect(page.getByRole('table', { name: 'Fiscal years list' })).toBeVisible();

    const rows = page.getByRole('table', { name: 'Fiscal years list' }).getByRole('button', { name: 'FY' });
    await expect(rows.nth(0)).toHaveText('FY 2025');
    await expect(rows.nth(1)).toHaveText('FY 2024');
    await expect(rows.nth(2)).toHaveText('FY 2023');
  });

  test('it shall display default name when fiscal year has no custom name', async function ({ page }) {
    await Promise.all([
      loadEmptyFixture(page),
      setupDatabase(tursoLibSQLiteServer(), async function setupData(sql) {
        await sql`INSERT INTO fiscal_years (begin_time, end_time, name) VALUES (${new Date('2025-01-01').getTime()}, ${new Date('2025-12-31').getTime()}, NULL)`;
      }),
    ]);

    await page.evaluate(setupView, tursoLibSQLiteServer().url);

    await expect(page.getByRole('table', { name: 'Fiscal years list' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Fiscal Year 2025', exact: true })).toBeVisible();
  });

  test('it shall display formatted dates for begin and end dates', async function ({ page }) {
    await Promise.all([
      loadEmptyFixture(page),
      setupDatabase(tursoLibSQLiteServer(), async function setupData(sql) {
        await sql`INSERT INTO fiscal_years (begin_time, end_time, name) VALUES (${new Date('2025-01-01').getTime()}, ${new Date('2025-12-31').getTime()}, 'FY 2025')`;
      }),
    ]);

    await page.evaluate(setupView, tursoLibSQLiteServer().url);

    const table = page.getByRole('table', { name: 'Fiscal years list' });
    await expect(table).toBeVisible();
    await expect(table.getByText('Jan 1, 2025')).toBeVisible();
    await expect(table.getByText('Dec 31, 2025')).toBeVisible();
  });

  test('it shall display formatted closed date for closed fiscal year', async function ({ page }) {
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
    await expect(table).toBeVisible();
    await expect(table.getByText('Jan 15, 2025')).toBeVisible();
  });

  test('it shall display empty placeholder for closed date when fiscal year is open', async function ({ page }) {
    await Promise.all([
      loadEmptyFixture(page),
      setupDatabase(tursoLibSQLiteServer(), async function setupData(sql) {
        await sql`INSERT INTO fiscal_years (begin_time, end_time, name) VALUES (${new Date('2025-01-01').getTime()}, ${new Date('2025-12-31').getTime()}, 'FY 2025')`;
      }),
    ]);

    await page.evaluate(setupView, tursoLibSQLiteServer().url);

    const table = page.getByRole('table', { name: 'Fiscal years list' });
    await expect(table).toBeVisible();

    const row = page.getByRole('row').filter({ has: page.getByRole('button', { name: 'FY 2025' }) });
    const cells = row.getByRole('cell');
    await expect(cells.nth(4)).toHaveText('—');
  });

  test('it shall display empty placeholder for closing entry when fiscal year is open', async function ({ page }) {
    await Promise.all([
      loadEmptyFixture(page),
      setupDatabase(tursoLibSQLiteServer(), async function setupData(sql) {
        await sql`INSERT INTO fiscal_years (begin_time, end_time, name) VALUES (${new Date('2025-01-01').getTime()}, ${new Date('2025-12-31').getTime()}, 'FY 2025')`;
      }),
    ]);

    await page.evaluate(setupView, tursoLibSQLiteServer().url);

    const table = page.getByRole('table', { name: 'Fiscal years list' });
    await expect(table).toBeVisible();

    const row = page.getByRole('row').filter({ has: page.getByRole('button', { name: 'FY 2025' }) });
    const cells = row.getByRole('cell');
    await expect(cells.nth(5)).toHaveText('—');
  });
});
