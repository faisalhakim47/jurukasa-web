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
      <time-context time="2026-03-18T09:30:00.000Z">
        <router-context>
          <database-context provider="turso" name="My Business" turso-url="${tursoDatabaseUrl}">
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

async function seedJournalEntryAccounts(sql) {
  await sql`INSERT INTO accounts (account_code, name, normal_balance, create_time, update_time) VALUES (881001, 'Test Cash', 0, 0, 0)`;
  await sql`INSERT INTO accounts (account_code, name, normal_balance, create_time, update_time) VALUES (881002, 'Test Equipment', 0, 0, 0)`;
  await sql`INSERT INTO accounts (account_code, name, normal_balance, create_time, update_time) VALUES (881003, 'Test Owner Equity', 1, 0, 0)`;
  await sql`INSERT INTO accounts (account_code, name, normal_balance, create_time, update_time) VALUES (881004, 'Test Revenue', 1, 0, 0)`;
  await sql`INSERT INTO account_tags (account_code, tag) VALUES (881001, 'Cash Flow - Cash Equivalents')`;
  await sql`INSERT INTO account_tags (account_code, tag) VALUES (881002, 'Cash Flow - Cash Equivalents')`;
  await sql`INSERT INTO account_tags (account_code, tag) VALUES (881003, 'Cash Flow - Cash Equivalents')`;
}

function getJournalEntryLineRow(dialog, lineNumber) {
  return dialog.getByRole('table', { name: 'Journal entry lines' }).getByRole('row').nth(lineNumber);
}

async function selectJournalEntryAccount(page, lineRow, lineNumber, accountName, accountCode) {
  await lineRow.getByRole('button', { name: `Select account for line ${lineNumber}` }).click();

  const accountSelectorDialog = page.getByRole('dialog', { name: 'Select Account' });
  await expect(accountSelectorDialog, `account selector shall be visible for line ${lineNumber}`).toBeVisible();
  await accountSelectorDialog.getByLabel('Search accounts').fill(accountName);
  await accountSelectorDialog.getByRole('menuitemradio').filter({ hasText: accountName }).click();
  await expect(accountSelectorDialog, `account selector shall close after choosing account for line ${lineNumber}`).not.toBeVisible();
  await expect(lineRow.getByLabel('Account Code'), `selected account code shall populate line ${lineNumber}`).toHaveValue(accountCode);
}

/**
 * @param {import('@playwright/test').Locator} lineRow
 * @param {{
 *   accountCode?: string,
 *   lineNote?: string,
 *   debit?: string,
 *   credit?: string,
 *   cashflowActivity?: string,
 *   cashflowCategory?: string,
 * }} values
 */
async function fillJournalEntryLine(lineRow, {
  accountCode,
  lineNote,
  debit,
  credit,
  cashflowActivity,
  cashflowCategory,
}) {
  if (accountCode !== undefined) {
    await lineRow.getByLabel('Account Code').fill(accountCode);
    await lineRow.getByLabel('Account Code').blur();
  }

  if (lineNote !== undefined) {
    await lineRow.getByLabel('Line note').fill(lineNote);
  }

  if (debit !== undefined) {
    await lineRow.getByLabel('Debit').fill(debit);
    await lineRow.getByLabel('Debit').blur();
  }

  if (credit !== undefined) {
    await lineRow.getByLabel('Credit').fill(credit);
    await lineRow.getByLabel('Credit').blur();
  }

  if (cashflowActivity !== undefined) {
    await lineRow.getByLabel('Cash flow activity').selectOption(cashflowActivity);
  }

  if (cashflowCategory !== undefined) {
    await lineRow.getByLabel('Cash flow category').selectOption(cashflowCategory);
  }
}

describe('Journal Entries View', function () {
  useConsoleOutput(test);
  useStrict(test);
  const tursoLibSQLiteServer = useTursoLibSQLiteServer(test);

  test('display empty state when no journal entries exist', async function ({ page }) {
    await Promise.all([
      loadEmptyFixture(page),
      setupDatabase(tursoLibSQLiteServer(), async function setupData() {}),
    ]);

    await page.evaluate(setupView, tursoLibSQLiteServer().url);

    await expect(page.getByRole('table', { name: 'Journal entries list' }), 'table shall not be visible when no entries exist').not.toBeVisible();
    await expect(page.getByText('No journal entries found'), 'empty state heading shall be visible').toBeVisible();
    await expect(page.getByText('Journal entries will appear here once you create them.'), 'empty state description shall be visible').toBeVisible();
    await expect(page.getByRole('button', { name: 'New Entry' }).first(), 'New Entry button shall be visible').toBeVisible();
  });

  test('validate journal entry inputs and create draft entry from creation dialog', async function ({ page }) {
    await Promise.all([
      loadEmptyFixture(page),
      setupDatabase(tursoLibSQLiteServer(), seedJournalEntryAccounts),
    ]);

    await page.evaluate(setupView, tursoLibSQLiteServer().url);

    await page.getByRole('button', { name: 'New Entry' }).first().click();

    const dialog = page.getByRole('dialog');
    await expect(dialog, 'journal entry creation dialog shall be visible').toBeVisible();
    await expect(dialog.getByRole('heading', { name: 'Create Journal Entry' }), 'journal entry creation heading shall be visible').toBeVisible();
    await expect(dialog.getByLabel('Entry Date', { exact: true }), 'entry date input shall be visible').toBeVisible();
    await expect(dialog.getByLabel('Note', { exact: true }), 'note input shall be visible').toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Add Line' }), 'Add Line button shall be visible').toBeVisible();
    await expect(getJournalEntryLineRow(dialog, 1).getByRole('button', { name: 'Remove line 1' }), 'remove button shall be disabled when only two lines exist').toBeDisabled();

    await dialog.getByLabel('Entry Date', { exact: true }).fill('2026-03-18T09:45');
    await dialog.getByLabel('Note', { exact: true }).fill('Owner funding and equipment setup');
    await dialog.getByRole('button', { name: 'Add Line' }).click();

    const firstLine = getJournalEntryLineRow(dialog, 1);
    const secondLine = getJournalEntryLineRow(dialog, 2);
    const thirdLine = getJournalEntryLineRow(dialog, 3);

    await expect(thirdLine.getByRole('button', { name: 'Remove line 3' }), 'remove button shall be enabled after adding third line').toBeEnabled();

    await selectJournalEntryAccount(page, firstLine, 1, 'Test Cash', '881001');
    await fillJournalEntryLine(firstLine, {
      lineNote: 'Capital deposited to cash account',
      debit: '150000',
    });
    await expect(firstLine.getByLabel('Cash flow activity'), 'cashflow activity shall be enabled for cash-equivalent account').toBeEnabled();
    await expect(firstLine.getByLabel('Cash flow category'), 'cashflow category shall be enabled for cash-equivalent account').toBeEnabled();

    await selectJournalEntryAccount(page, secondLine, 2, 'Test Equipment', '881002');
    await fillJournalEntryLine(secondLine, {
      lineNote: 'Store equipment purchase',
      debit: '50000',
      cashflowActivity: '2',
      cashflowCategory: '5',
    });

    await selectJournalEntryAccount(page, thirdLine, 3, 'Test Owner Equity', '881003');
    await fillJournalEntryLine(thirdLine, {
      lineNote: 'Owner contribution',
      credit: '200000',
      cashflowActivity: '3',
      cashflowCategory: '7',
    });

    await dialog.getByRole('button', { name: 'Draft Entry' }).click();

    const errorDialog = page.getByRole('alertdialog');
    await expect(errorDialog, 'error dialog shall be visible when cashflow data is missing for cash-equivalent line').toBeVisible();
    await expect(errorDialog.getByText('Line 1: Cash equivalent accounts require cash flow activity and category.'), 'cashflow validation message shall be visible').toBeVisible();
    await errorDialog.getByRole('button', { name: 'Dismiss' }).click();
    await expect(errorDialog, 'error dialog shall close after dismiss').not.toBeVisible();

    await fillJournalEntryLine(firstLine, {
      cashflowActivity: '3',
      cashflowCategory: '7',
    });

    await dialog.getByRole('button', { name: 'Draft Entry' }).click();

    await expect(dialog, 'creation dialog shall close after successful submission').not.toBeVisible();

    const table = page.getByRole('table', { name: 'Journal entries list' });
    await expect(table, 'journal entries table shall be visible after creating entry').toBeVisible();
    await expect(page.getByRole('button', { name: '#1', exact: true }), 'new journal entry ref button shall be visible').toBeVisible();
    await expect(table.getByText('Owner funding and equipment setup'), 'entry note shall be visible in table').toBeVisible();
    await expect(table.getByText('IDR 200,000'), 'entry amount shall be visible in table').toBeVisible();
    await expect(table.getByText('Draft', { exact: true }), 'draft status badge shall be visible in table').toBeVisible();

    const createdRow = page.getByRole('row').filter({ hasText: 'Owner funding and equipment setup' });
    await expect(createdRow.getByText('Manual', { exact: true }), 'manual workflow badge shall be visible for created entry').toBeVisible();

    await page.getByRole('button', { name: '#1', exact: true }).click();

    const detailsDialog = page.getByRole('dialog', { name: 'Journal Entry #1' });
    await expect(detailsDialog, 'journal entry details dialog shall be visible after opening created entry').toBeVisible();
    await expect(detailsDialog.getByText('Owner funding and equipment setup'), 'details dialog shall show entry note').toBeVisible();
    await expect(detailsDialog.getByText('Test Cash', { exact: true }), 'details dialog shall show first line account name').toBeVisible();
    await expect(detailsDialog.getByText('Test Equipment', { exact: true }), 'details dialog shall show second line account name').toBeVisible();
    await expect(detailsDialog.getByText('Test Owner Equity', { exact: true }), 'details dialog shall show third line account name').toBeVisible();
    await expect(detailsDialog.getByText('Capital deposited to cash account'), 'details dialog shall show first line note').toBeVisible();
    await expect(detailsDialog.getByText('Store equipment purchase'), 'details dialog shall show second line note').toBeVisible();
    await expect(detailsDialog.getByText('Owner contribution'), 'details dialog shall show third line note').toBeVisible();
    await expect(detailsDialog.getByText('Financing: Capital Injection').first(), 'details dialog shall show cashflow classification').toBeVisible();
    await expect(detailsDialog.getByText('IDR 150,000'), 'details dialog shall show first line debit amount').toBeVisible();
    await expect(detailsDialog.getByText('IDR 50,000'), 'details dialog shall show second line debit amount').toBeVisible();
    await expect(detailsDialog.getByText('IDR 200,000').first(), 'details dialog shall show total credit amount').toBeVisible();
  });

  test('create draft journal entry then post it from details dialog', async function ({ page }) {
    await Promise.all([
      loadEmptyFixture(page),
      setupDatabase(tursoLibSQLiteServer(), seedJournalEntryAccounts),
    ]);

    await page.evaluate(setupView, tursoLibSQLiteServer().url);

    await page.getByRole('button', { name: 'New Entry' }).first().click();

    const creationDialog = page.getByRole('dialog');
    await expect(creationDialog, 'creation dialog shall be visible before posting flow').toBeVisible();
    await expect(creationDialog.getByRole('heading', { name: 'Create Journal Entry' }), 'creation dialog heading shall be visible').toBeVisible();

    await creationDialog.getByLabel('Entry Date', { exact: true }).fill('2026-03-18T10:15');
    await creationDialog.getByLabel('Note', { exact: true }).fill('Draft entry to post');

    await selectJournalEntryAccount(page, getJournalEntryLineRow(creationDialog, 1), 1, 'Test Equipment', '881002');
    await fillJournalEntryLine(getJournalEntryLineRow(creationDialog, 1), {
      lineNote: 'Equipment recognized',
      debit: '90000',
      cashflowActivity: '2',
      cashflowCategory: '5',
    });

    await selectJournalEntryAccount(page, getJournalEntryLineRow(creationDialog, 2), 2, 'Test Owner Equity', '881003');
    await fillJournalEntryLine(getJournalEntryLineRow(creationDialog, 2), {
      lineNote: 'Owner funding credit',
      credit: '90000',
      cashflowActivity: '3',
      cashflowCategory: '7',
    });

    await creationDialog.getByRole('button', { name: 'Draft Entry' }).click();
    await expect(creationDialog, 'creation dialog shall close after draft creation').not.toBeVisible();

    const table = page.getByRole('table', { name: 'Journal entries list' });
    const createdRow = page.getByRole('row').filter({ hasText: 'Draft entry to post' });
    await expect(createdRow.getByText('Draft', { exact: true }), 'newly created entry shall appear as draft before posting').toBeVisible();
    await expect(table.getByText('IDR 90,000'), 'newly created draft amount shall be visible').toBeVisible();

    await page.getByRole('button', { name: '#1', exact: true }).click();

    const detailsDialog = page.getByRole('dialog', { name: 'Journal Entry #1' });
    await expect(detailsDialog, 'details dialog shall be visible for posting flow').toBeVisible();
    await expect(detailsDialog.getByText('Draft', { exact: true }), 'details dialog shall show draft status before posting').toBeVisible();
    await expect(detailsDialog.getByText('Unposted', { exact: true }), 'details dialog shall show entry as unposted before posting').toBeVisible();

    await detailsDialog.getByRole('button', { name: 'Post' }).click();

    await expect(page.getByText('Are you sure you want to post journal entry #1?'), 'post confirmation dialog shall be visible').toBeVisible();
    await page.getByRole('button', { name: 'Post Entry' }).click();

    await expect(detailsDialog.getByText('Posted', { exact: true }).first(), 'details dialog shall show posted status after confirmation').toBeVisible();
    await detailsDialog.getByRole('button', { name: 'Close' }).click();
    await expect(detailsDialog, 'details dialog shall close after closing action').not.toBeVisible();

    await expect(createdRow.getByText('Posted', { exact: true }), 'journal entries table shall refresh and show posted status').toBeVisible();
    await expect(createdRow.getByText('Manual', { exact: true }), 'workflow badge shall remain manual after posting').toBeVisible();
  });

  test('display journal entries list with correct data, status badges, and workflow badges', async function ({ page }) {
    await Promise.all([
      loadEmptyFixture(page),
      setupDatabase(tursoLibSQLiteServer(), async function setupData(sql) {
        await sql`INSERT INTO accounts (account_code, name, normal_balance, create_time, update_time) VALUES (10100, 'Cash', 0, 0, 0)`;
        await sql`INSERT INTO accounts (account_code, name, normal_balance, create_time, update_time) VALUES (40100, 'Revenue', 1, 0, 0)`;

        await sql`INSERT INTO journal_entries (ref, entry_time, note) VALUES (1, 1704067200000, 'Posted manual entry')`;
        await sql`INSERT INTO journal_entry_lines (journal_entry_ref, line_number, account_code, debit, credit) VALUES (1, 1, 10100, 100000, 0)`;
        await sql`INSERT INTO journal_entry_lines (journal_entry_ref, line_number, account_code, debit, credit) VALUES (1, 2, 40100, 0, 100000)`;
        await sql`UPDATE journal_entries SET post_time = 1704067200000 WHERE ref = 1`;

        await sql`INSERT INTO journal_entries (ref, entry_time, note) VALUES (2, 1704153600000, 'Posted fiscal closing entry')`;
        await sql`INSERT INTO journal_entry_lines (journal_entry_ref, line_number, account_code, debit, credit) VALUES (2, 1, 10100, 200000, 0)`;
        await sql`INSERT INTO journal_entry_lines (journal_entry_ref, line_number, account_code, debit, credit) VALUES (2, 2, 40100, 0, 200000)`;
        await sql`UPDATE journal_entries SET post_time = 1704153600000 WHERE ref = 2`;
        await sql`INSERT INTO fiscal_years (begin_time, end_time, name, closing_journal_entry_ref, post_time) VALUES (1704067200000, 1735603200000, 'FY 2024', 2, 1704153600000)`;

        await sql`INSERT INTO journal_entries (ref, entry_time, note) VALUES (3, 1704240000000, 'Draft entry')`;
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
    await expect(tableContent.getByText('Posted fiscal closing entry'), 'second entry note shall be visible').toBeVisible();
    await expect(tableContent.getByText('Draft entry'), 'third entry note shall be visible').toBeVisible();
    await expect(tableContent.getByText('IDR 100,000'), 'first entry amount shall be visible').toBeVisible();
    await expect(tableContent.getByText('IDR 200,000'), 'second entry amount shall be visible').toBeVisible();
    await expect(tableContent.getByText('IDR 300,000'), 'third entry amount shall be visible').toBeVisible();

    await expect(tableContent.getByText('Posted', { exact: true }).first(), 'Posted status badge shall be visible').toBeVisible();
    await expect(tableContent.getByText('Draft', { exact: true }), 'Draft status badge shall be visible').toBeVisible();

    const manualRow = page.getByRole('row').filter({ hasText: 'Posted manual entry' });
    await expect(manualRow.getByText('Manual', { exact: true }), 'Manual workflow badge shall be visible').toBeVisible();

    const systemRow = page.getByRole('row').filter({ hasText: 'Posted fiscal closing entry' });
    await expect(systemRow.getByText('Fiscal Year Closing', { exact: true }), 'Fiscal year closing workflow badge shall be visible').toBeVisible();
  });

  test('filter journal entries by status and reset to all statuses', async function ({ page }) {
    await Promise.all([
      loadEmptyFixture(page),
      setupDatabase(tursoLibSQLiteServer(), async function setupData(sql) {
        await sql`INSERT INTO accounts (account_code, name, normal_balance, create_time, update_time) VALUES (10100, 'Cash', 0, 0, 0)`;
        await sql`INSERT INTO accounts (account_code, name, normal_balance, create_time, update_time) VALUES (40100, 'Revenue', 1, 0, 0)`;

        await sql`INSERT INTO journal_entries (ref, entry_time, note) VALUES (1, 1704067200000, 'Posted entry')`;
        await sql`INSERT INTO journal_entry_lines (journal_entry_ref, line_number, account_code, debit, credit) VALUES (1, 1, 10100, 100000, 0)`;
        await sql`INSERT INTO journal_entry_lines (journal_entry_ref, line_number, account_code, debit, credit) VALUES (1, 2, 40100, 0, 100000)`;
        await sql`UPDATE journal_entries SET post_time = 1704067200000 WHERE ref = 1`;

        await sql`INSERT INTO journal_entries (ref, entry_time, note) VALUES (2, 1704153600000, 'Draft entry')`;
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
          await sql`INSERT INTO journal_entries (ref, entry_time, note) VALUES (${i}, ${1704067200000 + i * 1000}, ${'Entry ' + i})`;
          await sql`INSERT INTO journal_entry_lines (journal_entry_ref, line_number, account_code, debit, credit) VALUES (${i}, 1, 10100, 100000, 0)`;
          await sql`INSERT INTO journal_entry_lines (journal_entry_ref, line_number, account_code, debit, credit) VALUES (${i}, 2, 40100, 0, 100000)`;
          await sql`UPDATE journal_entries SET post_time = ${1704067200000 + i * 1000} WHERE ref = ${i}`;
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

        await sql`INSERT INTO journal_entries (ref, entry_time, note) VALUES (1, 1704067200000, 'Test entry')`;
        await sql`INSERT INTO journal_entry_lines (journal_entry_ref, line_number, account_code, debit, credit) VALUES (1, 1, 10100, 100000, 0)`;
        await sql`INSERT INTO journal_entry_lines (journal_entry_ref, line_number, account_code, debit, credit) VALUES (1, 2, 40100, 0, 100000)`;
        await sql`UPDATE journal_entries SET post_time = 1704067200000 WHERE ref = 1`;
      }),
    ]);

    await page.evaluate(setupView, tursoLibSQLiteServer().url);

    await expect(page.getByRole('table', { name: 'Journal entries list' }), 'journal entries table shall be visible').toBeVisible();

    await page.getByRole('button', { name: '#1', exact: true }).click();

    await expect(page.getByRole('dialog', { name: 'Journal Entry #1' }), 'journal entry details dialog shall be visible').toBeVisible();
  });
});
