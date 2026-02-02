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

describe('Financial Reports', function () {
  useConsoleOutput(test);
  useStrict(test);
  const tursoLibSQLiteServer = useTursoLibSQLiteServer(test);

  test('displays empty state when no reports exist', async function ({ page }) {
    await Promise.all([
      loadEmptyFixture(page),
      setupDatabase(tursoLibSQLiteServer(), async function setupData(sql) { }),
    ]);

    await page.evaluate(setupView, tursoLibSQLiteServer().url);

    await expect(page.getByRole('heading', { name: 'No reports generated' }), 'it shall display empty state heading').toBeVisible();
    await expect(page.getByText('Generate a new balance report to view trial balance and balance sheet.'), 'it shall display empty state description').toBeVisible();
  });

  test('generates report and adds it to table', async function ({ page }) {
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
    await expect(reportTable, 'it shall display reports table').toBeVisible();

    const firstBodyRow = reportTable.getByRole('row').nth(1);
    await expect(firstBodyRow, 'it shall display report row').toBeVisible();
    await expect(firstBodyRow.getByRole('cell', { name: 'Jan 15, 2025' }), 'it shall display correct report date').toBeVisible();
  });

  test('displays correct table content with existing reports', async function ({ page }) {
    await Promise.all([
      loadEmptyFixture(page),
      setupDatabase(tursoLibSQLiteServer(), async function setupData(sql) {
        await sql`INSERT INTO balance_reports (report_time, report_type, name, create_time) VALUES (1704067200000, 'Ad Hoc', 'Test Report 1', 1704067200000)`;
      }),
    ]);

    await page.evaluate(setupView, tursoLibSQLiteServer().url);

    const reportTable = page.getByRole('table', { name: 'Generated balance reports' });
    await expect(reportTable, 'it shall display reports table').toBeVisible();
    await expect(reportTable.getByRole('columnheader', { name: 'Report Date' }), 'it shall display Report Date column').toBeVisible();
    await expect(reportTable.getByRole('columnheader', { name: 'Report Name' }), 'it shall display Report Name column').toBeVisible();
    await expect(reportTable.getByRole('columnheader', { name: 'Snapshot Date' }), 'it shall display Snapshot Date column').toBeVisible();
    await expect(reportTable.getByRole('columnheader', { name: 'Type' }), 'it shall display Type column').toBeVisible();
    await expect(reportTable.getByRole('columnheader', { name: 'Actions' }), 'it shall display Actions column').toBeVisible();

    await expect(reportTable.getByRole('row'), 'it shall have header plus one data row').toHaveCount(1 + 1);
    const firstBodyRow = reportTable.getByRole('row').nth(1);
    await expect(firstBodyRow, 'it shall display first body row').toBeVisible();

    await expect(firstBodyRow.getByRole('cell', { name: 'Test Report 1' }), 'it shall display report name').toBeVisible();
    await expect(firstBodyRow.getByRole('cell', { name: 'Jan 1, 2024' }), 'it shall display report and snapshot dates').toHaveCount(2);
    await expect(firstBodyRow.getByRole('cell', { name: 'Ad Hoc' }), 'it shall display report type').toBeVisible();
    await expect(firstBodyRow.getByRole('button', { name: 'Trial Balance' }), 'it shall display Trial Balance button').toBeVisible();
    await expect(firstBodyRow.getByRole('button', { name: 'Balance Sheet' }), 'it shall display Balance Sheet button').toBeVisible();
  });

  test('displays correct Trial Balance detail view', async function ({ page }) {
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

    await expect(page.getByRole('heading', { name: 'Trial Balance' }), 'it shall display Trial Balance heading').toBeVisible();
    await expect(page.getByText('Test Report • Jan 4, 2024'), 'it shall display report info').toBeVisible();

    const trialBalanceTable = page.getByRole('table', { name: 'Trial Balance' });
    await expect(trialBalanceTable, 'it shall display trial balance table').toBeVisible();

    await expect(trialBalanceTable.getByRole('columnheader', { name: 'Code' }), 'it shall display Code column').toBeVisible();
    await expect(trialBalanceTable.getByRole('columnheader', { name: 'Account Name' }), 'it shall display Account Name column').toBeVisible();
    await expect(trialBalanceTable.getByRole('columnheader', { name: 'Normal' }), 'it shall display Normal column').toBeVisible();
    await expect(trialBalanceTable.getByRole('columnheader', { name: 'Debit' }), 'it shall display Debit column').toBeVisible();
    await expect(trialBalanceTable.getByRole('columnheader', { name: 'Credit' }), 'it shall display Credit column').toBeVisible();

    await expect(trialBalanceTable.getByRole('cell', { name: '11110' }), 'it shall display Kas account code').toBeVisible();
    await expect(trialBalanceTable.getByRole('cell', { name: 'Kas', exact: true }), 'it shall display Kas account name').toBeVisible();

    const kasRow = page.getByRole('row').filter({ has: page.getByRole('cell', { name: '11110' }) });
    await expect(kasRow.getByRole('cell').nth(2), 'it shall show Dr normal balance for Kas').toContainText('Dr');
    await expect(kasRow.getByRole('cell').nth(3), 'it shall show correct debit amount for Kas').toContainText('IDR 150,000');
    await expect(kasRow.getByRole('cell').nth(4), 'it shall show no credit for Kas').toContainText('—');

    const piutangRow = page.getByRole('row').filter({ has: page.getByRole('cell', { name: '11200' }) });
    await expect(piutangRow.getByRole('cell').nth(1), 'it shall show Piutang Usaha name').toContainText('Piutang Usaha');
    await expect(piutangRow.getByRole('cell').nth(2), 'it shall show Dr normal balance for Piutang').toContainText('Dr');
    await expect(piutangRow.getByRole('cell').nth(3), 'it shall show correct debit amount for Piutang').toContainText('IDR 50,000');
    await expect(piutangRow.getByRole('cell').nth(4), 'it shall show no credit for Piutang').toContainText('—');

    const utangUsahaRow = page.getByRole('row').filter({ has: page.getByRole('cell', { name: '21100' }) });
    await expect(utangUsahaRow.getByRole('cell').nth(1), 'it shall show Utang Usaha name').toContainText('Utang Usaha');
    await expect(utangUsahaRow.getByRole('cell').nth(2), 'it shall show Cr normal balance for Utang').toContainText('Cr');
    await expect(utangUsahaRow.getByRole('cell').nth(3), 'it shall show no debit for Utang').toContainText('—');
    await expect(utangUsahaRow.getByRole('cell').nth(4), 'it shall show correct credit amount for Utang').toContainText('IDR 30,000');

    const penjualanRow = page.getByRole('row').filter({ has: page.getByRole('cell', { name: '41000' }) });
    await expect(penjualanRow.getByRole('cell').nth(1), 'it shall show Penjualan name').toContainText('Penjualan');
    await expect(penjualanRow.getByRole('cell').nth(2), 'it shall show Cr normal balance for Penjualan').toContainText('Cr');
    await expect(penjualanRow.getByRole('cell').nth(3), 'it shall show no debit for Penjualan').toContainText('—');
    await expect(penjualanRow.getByRole('cell').nth(4), 'it shall show correct credit amount for Penjualan').toContainText('IDR 100,000');

    const modalPemilikRow = page.getByRole('row').filter({ has: page.getByRole('cell', { name: '31000' }) });
    await expect(modalPemilikRow.getByRole('cell').nth(1), 'it shall show Modal Pemilik name').toContainText('Modal Pemilik');
    await expect(modalPemilikRow.getByRole('cell').nth(2), 'it shall show Cr normal balance for Modal').toContainText('Cr');
    await expect(modalPemilikRow.getByRole('cell').nth(3), 'it shall show no debit for Modal').toContainText('—');
    await expect(modalPemilikRow.getByRole('cell').nth(4), 'it shall show correct credit amount for Modal').toContainText('IDR 330,000');

    const totalRow = page.getByRole('row').filter({ hasText: 'Total' });
    await expect(totalRow, 'it shall display total row').toBeVisible();
    await expect(totalRow.getByRole('cell', { name: 'Total' }), 'it shall display Total label').toBeVisible();
    await expect(totalRow.getByRole('cell').filter({ hasText: 'IDR 460,000' }), 'it shall show equal debit and credit totals').toHaveCount(2);
  });

  test('displays correct Balance Sheet detail view', async function ({ page }) {
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

    await page.evaluate(setupViewWithBalanceSheetReportId, { url: tursoLibSQLiteServer().url, id: reportId });

    await expect(page.getByRole('heading', { name: 'Balance Sheet' }), 'it shall display Balance Sheet heading').toBeVisible();
    await expect(page.getByText('Q2 2024 Balance Sheet • Jun 30, 2024'), 'it shall display report info').toBeVisible();

    const balanceSheetTable = page.getByRole('table', { name: 'Balance Sheet' });
    await expect(balanceSheetTable, 'it shall display balance sheet table').toBeVisible();

    await expect(balanceSheetTable.getByRole('columnheader', { name: 'Code' }), 'it shall display Code column').toBeVisible();
    await expect(balanceSheetTable.getByRole('columnheader', { name: 'Account Name' }), 'it shall display Account Name column').toBeVisible();
    await expect(balanceSheetTable.getByRole('columnheader', { name: 'Amount' }), 'it shall display Amount column').toBeVisible();

    await expect(balanceSheetTable.getByRole('columnheader', { name: 'Assets', exact: true }).first(), 'it shall display Assets column header').toBeVisible();
    await expect(balanceSheetTable.getByRole('columnheader', { name: 'Liabilities', exact: true }).first(), 'it shall display Liabilities column header').toBeVisible();
    await expect(balanceSheetTable.getByRole('columnheader', { name: 'Equity', exact: true }).first(), 'it shall display Equity column header').toBeVisible();

    await expect(balanceSheetTable.getByRole('cell', { name: '11110' }), 'it shall display Kas account code').toBeVisible();
    await expect(balanceSheetTable.getByRole('cell', { name: 'Kas', exact: true }), 'it shall display Kas account name').toBeVisible();

    const cashRow = page.getByRole('row').filter({ has: page.getByRole('cell', { name: '11110' }) });
    await expect(cashRow.getByRole('cell').nth(2), 'it shall show correct cash amount').toContainText('IDR 50,000');

    await expect(balanceSheetTable.getByRole('cell', { name: '12110' }), 'it shall display Peralatan Toko account code').toBeVisible();
    await expect(balanceSheetTable.getByRole('cell', { name: 'Peralatan Toko', exact: true }), 'it shall display Peralatan Toko account name').toBeVisible();

    const equipmentRow = page.getByRole('row').filter({ has: page.getByRole('cell', { name: '12110' }) });
    await expect(equipmentRow.getByRole('cell').nth(2), 'it shall show correct equipment amount').toContainText('IDR 50,000');

    await expect(balanceSheetTable.getByRole('cell', { name: '11310' }), 'it shall display Persediaan account code').toBeVisible();
    await expect(balanceSheetTable.getByRole('cell', { name: 'Persediaan Barang Dagang', exact: true }), 'it shall display Persediaan account name').toBeVisible();

    const inventoryRow = page.getByRole('row').filter({ has: page.getByRole('cell', { name: '11310' }) });
    await expect(inventoryRow.getByRole('cell').nth(2), 'it shall show correct inventory amount').toContainText('IDR 25,000');

    await expect(balanceSheetTable.getByRole('cell', { name: '21100' }), 'it shall display Utang Usaha account code').toBeVisible();
    await expect(balanceSheetTable.getByRole('cell', { name: 'Utang Usaha', exact: true }), 'it shall display Utang Usaha account name').toBeVisible();

    const accountsPayableRow = page.getByRole('row').filter({ has: page.getByRole('cell', { name: '21100' }) });
    await expect(accountsPayableRow.getByRole('cell').nth(2), 'it shall show correct accounts payable amount').toContainText('IDR 25,000');

    await expect(balanceSheetTable.getByRole('cell', { name: '31000' }), 'it shall display Modal Pemilik account code').toBeVisible();
    await expect(balanceSheetTable.getByRole('cell', { name: 'Modal Pemilik', exact: true }), 'it shall display Modal Pemilik account name').toBeVisible();

    const ownerEquityRow = page.getByRole('row').filter({ has: page.getByRole('cell', { name: '31000' }) });
    await expect(ownerEquityRow.getByRole('cell').nth(2), 'it shall show correct owner equity amount').toContainText('IDR 100,000');

    await expect(balanceSheetTable.getByRole('cell', { name: 'Total Assets' }), 'it shall display Total Assets label').toBeVisible();
    await expect(balanceSheetTable.getByRole('cell', { name: 'Total Liabilities' }), 'it shall display Total Liabilities label').toBeVisible();
    await expect(balanceSheetTable.getByRole('cell', { name: 'Total Equity' }).first(), 'it shall display Total Equity label').toBeVisible();

    const totalAssetsRow = page.getByRole('row').filter({ has: page.getByRole('cell', { name: 'Total Assets' }) });
    await expect(totalAssetsRow.getByRole('cell').filter({ hasText: 'IDR 125,000' }), 'it shall show correct total assets').toBeVisible();

    const liabilitiesEquityTotalRow = page.getByRole('row').filter({ has: page.getByRole('cell', { name: 'Liabilities + Equity' }) }).first();
    await expect(liabilitiesEquityTotalRow, 'it shall display Liabilities + Equity total row').toBeVisible();
    await expect(liabilitiesEquityTotalRow.getByRole('cell').filter({ hasText: 'IDR 125,000' }), 'it shall show correct liabilities plus equity total').toBeVisible();

    await expect(page.getByText('Assets = Liabilities + Equity'), 'it shall display accounting equation').toBeVisible();
  });
});
