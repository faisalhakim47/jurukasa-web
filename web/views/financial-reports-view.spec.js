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

/** @param {string} tursoDatabaseUrl */
async function setupView(tursoDatabaseUrl) {
  document.body.innerHTML = `
    <ready-context>
      <time-context>
        <router-context>
          <database-context provider="turso" name="My Business" turso-url=${tursoDatabaseUrl}>
            <device-context>
              <i18n-context>
                <books-view></books-view>
              </i18n-context>
            </device-context>
          </database-context>
        </router-context>
      </time-context>
    </ready-context>
  `;
  window.history.replaceState({}, '', '/books/reports');
}

function setupViewWithReportId({ id, url }) {
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
};

describe('Financial Reports - Refactored View', function () {
  useConsoleOutput(test);
  useStrict(test);
  const tursoLibSQLiteServer = useTursoLibSQLiteServer(test);

  test('shall display empty state when no reports exist', async function ({ page }) {
    await Promise.all([
      loadEmptyFixture(page),
      setupDatabase(tursoLibSQLiteServer(), async function setupData(sql) { }),
    ]);

    await page.evaluate(setupView, tursoLibSQLiteServer().url);

    await expect(page.getByRole('heading', { name: 'No reports generated' })).toBeVisible();
    await expect(page.getByText('Generate a new balance report to view trial balance and balance sheet.')).toBeVisible();
  });

  test('shall add report to table after generation', async function ({ page }) {
    await Promise.all([
      loadEmptyFixture(page),
      setupDatabase(tursoLibSQLiteServer(), async function setupData(sql) { }),
    ]);

    await page.evaluate(setupView, tursoLibSQLiteServer().url);

    await page.getByRole('button', { name: 'Generate Report' }).first().click();

    const dateTimeInput = page.getByLabel('Report Date & Time', { exact: true });
    await dateTimeInput.fill('2025-01-15T00:00');

    await page.getByRole('dialog', { name: 'Generate Balance Report' }).getByRole('button', { name: 'Generate Report' }).click();

    const reportTable = page.getByRole('table', { name: 'Generated balance reports' });
    await expect(reportTable).toBeVisible();

    const firstBodyRow = reportTable.getByRole('row').nth(1);
    await expect(firstBodyRow).toBeVisible();

    await expect(firstBodyRow.getByRole('cell', { name: 'Jan 15, 2025' })).toBeVisible();
  });

  test('shall display correct table content', async function ({ page }) {
    await Promise.all([
      loadEmptyFixture(page),
      setupDatabase(tursoLibSQLiteServer(), async function setupData(sql) {
        await sql`INSERT INTO balance_reports (report_time, report_type, name, create_time) VALUES (1704067200000, 'Ad Hoc', 'Test Report 1', 1704067200000)`;
      }),
    ]);

    await page.evaluate(setupView, tursoLibSQLiteServer().url);

    const reportTable = page.getByRole('table', { name: 'Generated balance reports' });
    await expect(reportTable).toBeVisible();
    await expect(reportTable.getByRole('columnheader', { name: 'Report Date' })).toBeVisible();
    await expect(reportTable.getByRole('columnheader', { name: 'Report Name' })).toBeVisible();
    await expect(reportTable.getByRole('columnheader', { name: 'Snapshot Date' })).toBeVisible();
    await expect(reportTable.getByRole('columnheader', { name: 'Type' })).toBeVisible();
    await expect(reportTable.getByRole('columnheader', { name: 'Actions' })).toBeVisible();

    await expect(reportTable.getByRole('row')).toHaveCount(1 + 1); // th + tr
    const firstBodyRow = reportTable.getByRole('row').nth(1); // the content row
    await expect(firstBodyRow).toBeVisible();

    await expect(firstBodyRow.getByRole('cell', { name: 'Test Report 1' })).toBeVisible();
    await expect(firstBodyRow.getByRole('cell', { name: 'Jan 1, 2024' })).toHaveCount(2); // The Report Date and Snapshot Date are the same
    await expect(firstBodyRow.getByRole('cell', { name: 'Ad Hoc' })).toBeVisible();
    await expect(firstBodyRow.getByRole('button', { name: 'Trial Balance' })).toBeVisible();
    await expect(firstBodyRow.getByRole('button', { name: 'Balance Sheet' })).toBeVisible();
  });

  test('shall display correct Trial Balance detail view', async function ({ page }) {
    await Promise.all([
      loadEmptyFixture(page),
      setupDatabase(tursoLibSQLiteServer(), async function setupData(sql) {
        const reportTime = new Date(2024, 0, 4, 0, 0, 0, 0).getTime();

        const ref1Result = await sql`INSERT INTO journal_entries (entry_time) VALUES (${new Date(2024, 0, 2, 0, 0, 0, 0).getTime()}) RETURNING ref`;
        const ref1 = Number(ref1Result.rows[0].ref);
        await sql`INSERT INTO journal_entry_lines_auto_number (journal_entry_ref, account_code, debit, credit) VALUES (${ref1}, 11110, 150000, 0)`;
        await sql`INSERT INTO journal_entry_lines_auto_number (journal_entry_ref, account_code, debit, credit) VALUES (${ref1}, 11200, 50000, 0)`;
        await sql`INSERT INTO journal_entry_lines_auto_number (journal_entry_ref, account_code, debit, credit) VALUES (${ref1}, 31000, 0, 200000)`;
        await sql`UPDATE journal_entries SET post_time = ${new Date(2024, 0, 2, 0, 0, 0, 0).getTime()} WHERE ref = ${ref1}`;

        const ref2Result = await sql`INSERT INTO journal_entries (entry_time) VALUES (${new Date(2024, 0, 3, 0, 0, 0, 0).getTime()}) RETURNING ref`;
        const ref2 = Number(ref2Result.rows[0].ref);
        await sql`INSERT INTO journal_entry_lines_auto_number (journal_entry_ref, account_code, debit, credit) VALUES (${ref2}, 11310, 260000, 0)`;
        await sql`INSERT INTO journal_entry_lines_auto_number (journal_entry_ref, account_code, debit, credit) VALUES (${ref2}, 41000, 0, 100000)`;
        await sql`INSERT INTO journal_entry_lines_auto_number (journal_entry_ref, account_code, debit, credit) VALUES (${ref2}, 21100, 0, 30000)`;
        await sql`INSERT INTO journal_entry_lines_auto_number (journal_entry_ref, account_code, debit, credit) VALUES (${ref2}, 31000, 0, 130000)`;
        await sql`UPDATE journal_entries SET post_time = ${new Date(2024, 0, 3, 0, 0, 0, 0).getTime()} WHERE ref = ${ref2}`;

        await sql`INSERT INTO balance_reports (report_time, report_type, name, create_time) VALUES (${reportTime}, 'Ad Hoc', 'Test Report', ${reportTime})`;
      }),
    ]);

    const client = createClient({ url: tursoLibSQLiteServer().url });
    const reportResult = await client.execute(`SELECT id FROM balance_reports WHERE name = 'Test Report'`);
    const reportId = Number(reportResult.rows[0].id);

    await page.evaluate(setupViewWithReportId, { url: tursoLibSQLiteServer().url, id: reportId });

    await expect(page.getByRole('heading', { name: 'Trial Balance' })).toBeVisible();
    await expect(page.getByText('Test Report • Jan 4, 2024')).toBeVisible();

    const trialBalanceTable = page.getByRole('table', { name: 'Trial Balance' });
    await expect(trialBalanceTable).toBeVisible();

    await expect(trialBalanceTable.getByRole('columnheader', { name: 'Code' })).toBeVisible();
    await expect(trialBalanceTable.getByRole('columnheader', { name: 'Account Name' })).toBeVisible();
    await expect(trialBalanceTable.getByRole('columnheader', { name: 'Normal' })).toBeVisible();
    await expect(trialBalanceTable.getByRole('columnheader', { name: 'Debit' })).toBeVisible();
    await expect(trialBalanceTable.getByRole('columnheader', { name: 'Credit' })).toBeVisible();

    await expect(trialBalanceTable.getByRole('cell', { name: '11110' })).toBeVisible();
    await expect(trialBalanceTable.getByRole('cell', { name: 'Kas', exact: true })).toBeVisible();

    const kasRow = page.getByRole('row').filter({ has: page.getByRole('cell', { name: '11110' }) });
    await expect(kasRow.getByRole('cell').nth(2)).toContainText('Dr');
    await expect(kasRow.getByRole('cell').nth(3)).toContainText('IDR 150,000');
    await expect(kasRow.getByRole('cell').nth(4)).toContainText('—');

    const piutangRow = page.getByRole('row').filter({ has: page.getByRole('cell', { name: '11200' }) });
    await expect(piutangRow.getByRole('cell').nth(1)).toContainText('Piutang Usaha');
    await expect(piutangRow.getByRole('cell').nth(2)).toContainText('Dr');
    await expect(piutangRow.getByRole('cell').nth(3)).toContainText('IDR 50,000');
    await expect(piutangRow.getByRole('cell').nth(4)).toContainText('—');

    const utangUsahaRow = page.getByRole('row').filter({ has: page.getByRole('cell', { name: '21100' }) });
    await expect(utangUsahaRow.getByRole('cell').nth(1)).toContainText('Utang Usaha');
    await expect(utangUsahaRow.getByRole('cell').nth(2)).toContainText('Cr');
    await expect(utangUsahaRow.getByRole('cell').nth(3)).toContainText('—');
    await expect(utangUsahaRow.getByRole('cell').nth(4)).toContainText('IDR 30,000');

    const penjualanRow = page.getByRole('row').filter({ has: page.getByRole('cell', { name: '41000' }) });
    await expect(penjualanRow.getByRole('cell').nth(1)).toContainText('Penjualan');
    await expect(penjualanRow.getByRole('cell').nth(2)).toContainText('Cr');
    await expect(penjualanRow.getByRole('cell').nth(3)).toContainText('—');
    await expect(penjualanRow.getByRole('cell').nth(4)).toContainText('IDR 100,000');

    const modalPemilikRow = page.getByRole('row').filter({ has: page.getByRole('cell', { name: '31000' }) });
    await expect(modalPemilikRow.getByRole('cell').nth(1)).toContainText('Modal Pemilik');
    await expect(modalPemilikRow.getByRole('cell').nth(2)).toContainText('Cr');
    await expect(modalPemilikRow.getByRole('cell').nth(3)).toContainText('—');
    await expect(modalPemilikRow.getByRole('cell').nth(4)).toContainText('IDR 330,000');

    const totalRow = page.getByRole('row').filter({ hasText: 'Total' });
    await expect(totalRow).toBeVisible();
    await expect(totalRow.getByRole('cell', { name: 'Total' })).toBeVisible();
    await expect(totalRow.getByRole('cell').filter({ hasText: 'IDR 460,000' })).toHaveCount(2);
  });

  test('shall display correct Balance Sheet detail view', async function ({ page }) {
    await Promise.all([
      loadEmptyFixture(page),
      setupDatabase(tursoLibSQLiteServer(), async function setupData(sql) {
        const entryTime = new Date(2024, 5, 30, 0, 0, 0, 0).getTime();

        const ref1Result = await sql`INSERT INTO journal_entries (entry_time) VALUES (${new Date(2024, 0, 2, 0, 0, 0, 0).getTime()}) RETURNING ref`;
        const ref1 = Number(ref1Result.rows[0].ref);
        await sql`INSERT INTO journal_entry_lines_auto_number (journal_entry_ref, account_code, debit, credit) VALUES (${ref1}, 11110, 100000, 0)`;
        await sql`INSERT INTO journal_entry_lines_auto_number (journal_entry_ref, account_code, debit, credit) VALUES (${ref1}, 31000, 0, 100000)`;
        await sql`UPDATE journal_entries SET post_time = ${new Date(2024, 0, 2, 0, 0, 0, 0).getTime()} WHERE ref = ${ref1}`;

        const ref2Result = await sql`INSERT INTO journal_entries (entry_time) VALUES (${new Date(2024, 1, 15, 0, 0, 0, 0).getTime()}) RETURNING ref`;
        const ref2 = Number(ref2Result.rows[0].ref);
        await sql`INSERT INTO journal_entry_lines_auto_number (journal_entry_ref, account_code, debit, credit) VALUES (${ref2}, 12110, 50000, 0)`;
        await sql`INSERT INTO journal_entry_lines_auto_number (journal_entry_ref, account_code, debit, credit) VALUES (${ref2}, 11110, 0, 50000)`;
        await sql`UPDATE journal_entries SET post_time = ${new Date(2024, 1, 15, 0, 0, 0, 0).getTime()} WHERE ref = ${ref2}`;

        const ref3Result = await sql`INSERT INTO journal_entries (entry_time) VALUES (${new Date(2024, 3, 10, 0, 0, 0, 0).getTime()}) RETURNING ref`;
        const ref3 = Number(ref3Result.rows[0].ref);
        await sql`INSERT INTO journal_entry_lines_auto_number (journal_entry_ref, account_code, debit, credit) VALUES (${ref3}, 11310, 25000, 0)`;
        await sql`INSERT INTO journal_entry_lines_auto_number (journal_entry_ref, account_code, debit, credit) VALUES (${ref3}, 21100, 0, 25000)`;
        await sql`UPDATE journal_entries SET post_time = ${new Date(2024, 3, 10, 0, 0, 0, 0).getTime()} WHERE ref = ${ref3}`;

        await sql`INSERT INTO balance_reports (report_time, report_type, name, create_time) VALUES (${entryTime}, 'Ad Hoc', 'Q2 2024 Balance Sheet', ${new Date(2024, 0, 1, 0, 0, 0, 0).getTime()})`;
      }),
    ]);

    const client = createClient({ url: tursoLibSQLiteServer().url });
    const reportResult = await client.execute(`SELECT id FROM balance_reports WHERE name = 'Q2 2024 Balance Sheet'`);
    const reportId = Number(reportResult.rows[0].id);

    function setupViewWithBalanceSheetReportId({ url, id }) {
      window.history.replaceState({}, '', `/books/reports/balance-sheet?reportId=${id}`);
      document.body.innerHTML = `
        <ready-context>
          <time-context>
            <router-context>
              <database-context provider="turso" name="My Business" turso-url=${url}>
                <device-context>
                  <i18n-context>
                    <balance-sheet-view></balance-sheet-view>
                  </i18n-context>
                </device-context>
              </database-context>
            </router-context>
          </time-context>
        </ready-context>
      `;
    }

    await page.evaluate(setupViewWithBalanceSheetReportId, { url: tursoLibSQLiteServer().url, id: reportId });

    await expect(page.getByRole('heading', { name: 'Balance Sheet' })).toBeVisible();
    await expect(page.getByText('Q2 2024 Balance Sheet • Jun 30, 2024')).toBeVisible();

    const balanceSheetTable = page.getByRole('table', { name: 'Balance Sheet' });
    await expect(balanceSheetTable).toBeVisible();

    await expect(balanceSheetTable.getByRole('columnheader', { name: 'Code' })).toBeVisible();
    await expect(balanceSheetTable.getByRole('columnheader', { name: 'Account Name' })).toBeVisible();
    await expect(balanceSheetTable.getByRole('columnheader', { name: 'Amount' })).toBeVisible();

    await expect(balanceSheetTable.getByRole('columnheader', { name: 'Assets', exact: true }).first()).toBeVisible();
    await expect(balanceSheetTable.getByRole('columnheader', { name: 'Liabilities', exact: true }).first()).toBeVisible();
    await expect(balanceSheetTable.getByRole('columnheader', { name: 'Equity', exact: true }).first()).toBeVisible();

    await expect(balanceSheetTable.getByRole('cell', { name: '11110' })).toBeVisible();
    await expect(balanceSheetTable.getByRole('cell', { name: 'Kas', exact: true })).toBeVisible();

    const cashRow = page.getByRole('row').filter({ has: page.getByRole('cell', { name: '11110' }) });
    await expect(cashRow.getByRole('cell').nth(2)).toContainText('IDR 50,000');

    await expect(balanceSheetTable.getByRole('cell', { name: '12110' })).toBeVisible();
    await expect(balanceSheetTable.getByRole('cell', { name: 'Peralatan Toko', exact: true })).toBeVisible();

    const equipmentRow = page.getByRole('row').filter({ has: page.getByRole('cell', { name: '12110' }) });
    await expect(equipmentRow.getByRole('cell').nth(2)).toContainText('IDR 50,000');

    await expect(balanceSheetTable.getByRole('cell', { name: '11310' })).toBeVisible();
    await expect(balanceSheetTable.getByRole('cell', { name: 'Persediaan Barang Dagang', exact: true })).toBeVisible();

    const inventoryRow = page.getByRole('row').filter({ has: page.getByRole('cell', { name: '11310' }) });
    await expect(inventoryRow.getByRole('cell').nth(2)).toContainText('IDR 25,000');

    await expect(balanceSheetTable.getByRole('cell', { name: '21100' })).toBeVisible();
    await expect(balanceSheetTable.getByRole('cell', { name: 'Utang Usaha', exact: true })).toBeVisible();

    const accountsPayableRow = page.getByRole('row').filter({ has: page.getByRole('cell', { name: '21100' }) });
    await expect(accountsPayableRow.getByRole('cell').nth(2)).toContainText('IDR 25,000');

    await expect(balanceSheetTable.getByRole('cell', { name: '31000' })).toBeVisible();
    await expect(balanceSheetTable.getByRole('cell', { name: 'Modal Pemilik', exact: true })).toBeVisible();

    const ownerEquityRow = page.getByRole('row').filter({ has: page.getByRole('cell', { name: '31000' }) });
    await expect(ownerEquityRow.getByRole('cell').nth(2)).toContainText('IDR 100,000');

    await expect(balanceSheetTable.getByRole('cell', { name: 'Total Assets' })).toBeVisible();
    await expect(balanceSheetTable.getByRole('cell', { name: 'Total Liabilities' })).toBeVisible();
    await expect(balanceSheetTable.getByRole('cell', { name: 'Total Equity' }).first()).toBeVisible();

    const totalAssetsRow = page.getByRole('row').filter({ has: page.getByRole('cell', { name: 'Total Assets' }) });
    await expect(totalAssetsRow.getByRole('cell').filter({ hasText: 'IDR 125,000' })).toBeVisible();

    const liabilitiesEquityTotalRow = page.getByRole('row').filter({ has: page.getByRole('cell', { name: 'Liabilities + Equity' }) }).first();
    await expect(liabilitiesEquityTotalRow).toBeVisible();
    await expect(liabilitiesEquityTotalRow.getByRole('cell').filter({ hasText: 'IDR 125,000' })).toBeVisible();

    await expect(page.getByText('Assets = Liabilities + Equity')).toBeVisible();
  });
});
