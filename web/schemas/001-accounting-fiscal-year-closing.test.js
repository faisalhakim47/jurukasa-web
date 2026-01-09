import { describe, it } from 'node:test';
import { ok, equal, rejects } from 'node:assert/strict';

import { useSql } from '#web/schemas/test/hooks/use-sql.js';

describe('Accounting Schema Tests - Fiscal Year Closing', function () {
  const sql = useSql();
  const testTime = new Date(2025, 0, 1, 0, 0, 0, 0).getTime();

  /**
   * @param {Date} entryDate
   */
  async function draftJournalEntry(entryDate) {
    const result = await sql`INSERT INTO journal_entries (entry_time) VALUES (${entryDate.getTime()}) RETURNING ref`;
    return Number(result.rows[0].ref);
  }

  /**
   * @param {number} ref
   * @param {number} accountCode
   * @param {number} debit
   * @param {number} credit
   */
  async function addJournalLine(ref, accountCode, debit, credit) {
    await sql`INSERT INTO journal_entry_lines_auto_number (journal_entry_ref, account_code, debit, credit)
       VALUES (${ref}, ${accountCode}, ${debit}, ${credit})`;
  }

  /**
   * @param {number} ref
   * @param {Date} postDate
   */
  async function postJournalEntry(ref, postDate) {
    await sql`UPDATE journal_entries SET post_time = ${postDate.getTime()} WHERE ref = ${ref}`;
  }

  /**
   * Setup database with schemas and default chart of accounts
   */
  async function setupStandardClosingAccounts() {
    // The database schemas are already set up by useLibSQLiteClient hook
    // We only need to insert the chart of accounts template
    await sql`INSERT INTO chart_of_accounts_templates (name) VALUES ('Retail Business - Indonesia')`;
  }

  describe('Multiple Revenue and Expense Accounts', function () {
    it('shall close fiscal year with multiple revenue accounts', async function () {
      await setupStandardClosingAccounts();

      // Post multiple revenue transactions
      // Sales Revenue (41000): 5000
      const ref1 = await draftJournalEntry(new Date(2024, 3, 15, 0, 0, 0, 0));
      await addJournalLine(ref1, 11110, 5000, 0); // Cash
      await addJournalLine(ref1, 41000, 0, 5000); // Sales
      await postJournalEntry(ref1, new Date(2024, 3, 15, 0, 0, 0, 0));

      // Other Revenue 1 (81100): 3000
      const ref2 = await draftJournalEntry(new Date(2024, 5, 20, 0, 0, 0, 0));
      await addJournalLine(ref2, 11200, 3000, 0); // AR
      await addJournalLine(ref2, 81100, 0, 3000); // Other Revenue
      await postJournalEntry(ref2, new Date(2024, 5, 20, 0, 0, 0, 0));

      // Other Revenue 2 (81200): 1000
      const ref3 = await draftJournalEntry(new Date(2024, 8, 10, 0, 0, 0, 0));
      await addJournalLine(ref3, 11110, 1000, 0); // Cash
      await addJournalLine(ref3, 81200, 0, 1000); // Interest Income
      await postJournalEntry(ref3, new Date(2024, 8, 10, 0, 0, 0, 0));

      // Total revenue: 9000

      // Create and close fiscal year
      const beginTime = new Date(2024, 0, 1, 0, 0, 0, 0).getTime();
      const endTime = new Date(2024, 11, 31, 0, 0, 0, 0).getTime();

      await sql`INSERT INTO fiscal_years (begin_time, end_time, name) VALUES (${beginTime}, ${endTime}, 'FY2024')`;

      await sql`UPDATE fiscal_years SET post_time = ${testTime} WHERE begin_time = ${beginTime}`;

      // Verify all revenue accounts are zeroed
      const salesRevenue = (await sql`SELECT balance FROM accounts WHERE account_code = 41000`).rows[0];
      const otherRevenue1 = (await sql`SELECT balance FROM accounts WHERE account_code = 81100`).rows[0];
      const otherRevenue2 = (await sql`SELECT balance FROM accounts WHERE account_code = 81200`).rows[0];

      equal(salesRevenue.balance, 0, 'Sales Revenue should be zeroed');
      equal(otherRevenue1.balance, 0, 'Other Revenue 1 should be zeroed');
      equal(otherRevenue2.balance, 0, 'Other Revenue 2 should be zeroed');

      // Verify retained earnings reflects total revenue
      const retainedEarnings = (await sql`SELECT balance FROM accounts WHERE account_code = 32000`).rows[0];
      equal(retainedEarnings.balance, 9000, 'Retained Earnings should equal total revenue');
    });

    it('shall close fiscal year with multiple expense accounts', async function () {
      await setupStandardClosingAccounts();

      // Initial capital injection
      const ref0 = await draftJournalEntry(new Date(2024, 0, 2, 0, 0, 0, 0));
      await addJournalLine(ref0, 11110, 20000, 0); // Cash
      await addJournalLine(ref0, 31000, 0, 20000); // Owner Capital (Not RE 32000)
      await postJournalEntry(ref0, new Date(2024, 0, 2, 0, 0, 0, 0));

      // Post multiple expense transactions
      // COGS (51000): 2000
      const ref1 = await draftJournalEntry(new Date(2024, 2, 15, 0, 0, 0, 0));
      await addJournalLine(ref1, 51000, 2000, 0);
      await addJournalLine(ref1, 11110, 0, 2000); // Cash
      await postJournalEntry(ref1, new Date(2024, 2, 15, 0, 0, 0, 0));

      // Salaries (61300): 5000
      const ref2 = await draftJournalEntry(new Date(2024, 4, 20, 0, 0, 0, 0));
      await addJournalLine(ref2, 61300, 5000, 0);
      await addJournalLine(ref2, 11110, 0, 5000); // Cash
      await postJournalEntry(ref2, new Date(2024, 4, 20, 0, 0, 0, 0));

      // Rent (61100): 3000
      const ref3 = await draftJournalEntry(new Date(2024, 6, 10, 0, 0, 0, 0));
      await addJournalLine(ref3, 61100, 3000, 0);
      await addJournalLine(ref3, 11110, 0, 3000); // Cash
      await postJournalEntry(ref3, new Date(2024, 6, 10, 0, 0, 0, 0));

      // Utilities (61200): 800
      const ref4 = await draftJournalEntry(new Date(2024, 8, 5, 0, 0, 0, 0));
      await addJournalLine(ref4, 61200, 800, 0);
      await addJournalLine(ref4, 11110, 0, 800); // Cash
      await postJournalEntry(ref4, new Date(2024, 8, 5, 0, 0, 0, 0));

      // Depreciation (61900): 1200
      const ref5 = await draftJournalEntry(new Date(2024, 10, 30, 0, 0, 0, 0));
      await addJournalLine(ref5, 61900, 1200, 0);
      await addJournalLine(ref5, 11110, 0, 1200); // Cash (simplified for depreciation)
      await postJournalEntry(ref5, new Date(2024, 10, 30, 0, 0, 0, 0));

      // Total expenses: 12000

      // Create and close fiscal year
      const beginTime = new Date(2024, 0, 1, 0, 0, 0, 0).getTime();
      const endTime = new Date(2024, 11, 31, 0, 0, 0, 0).getTime();

      await sql`INSERT INTO fiscal_years (begin_time, end_time, name) VALUES (${beginTime}, ${endTime}, 'FY2024')`;

      await sql`UPDATE fiscal_years SET post_time = ${testTime} WHERE begin_time = ${beginTime}`;

      // Verify all expense accounts are zeroed
      const cogs = (await sql`SELECT balance FROM accounts WHERE account_code = 51000`).rows[0];
      const salaries = (await sql`SELECT balance FROM accounts WHERE account_code = 61300`).rows[0];
      const rent = (await sql`SELECT balance FROM accounts WHERE account_code = 61100`).rows[0];
      const utilities = (await sql`SELECT balance FROM accounts WHERE account_code = 61200`).rows[0];
      const depreciation = (await sql`SELECT balance FROM accounts WHERE account_code = 61900`).rows[0];

      equal(cogs.balance, 0, 'COGS should be zeroed');
      equal(salaries.balance, 0, 'Salaries Expense should be zeroed');
      equal(rent.balance, 0, 'Rent Expense should be zeroed');
      equal(utilities.balance, 0, 'Utilities Expense should be zeroed');
      equal(depreciation.balance, 0, 'Depreciation Expense should be zeroed');

      // Verify retained earnings reflects net loss (-12000). The RE account starts at 0.
      const retainedEarnings = (await sql`SELECT balance FROM accounts WHERE account_code = 32000`).rows[0];
      equal(retainedEarnings.balance, -12000, 'Retained Earnings should reflect net loss (credit normal, negative balance = debit)');
    });

    it('shall close fiscal year with mixed revenues, expenses, and dividends', async function () {
      await setupStandardClosingAccounts();

      // Revenue transactions
      // Sales (41000): 15000
      const ref1 = await draftJournalEntry(new Date(2024, 2, 10, 0, 0, 0, 0));
      await addJournalLine(ref1, 11110, 15000, 0); // Cash
      await addJournalLine(ref1, 41000, 0, 15000); // Sales
      await postJournalEntry(ref1, new Date(2024, 2, 10, 0, 0, 0, 0));

      // Other Revenue (81100): 8000
      const ref2 = await draftJournalEntry(new Date(2024, 4, 20, 0, 0, 0, 0));
      await addJournalLine(ref2, 11200, 8000, 0); // AR
      await addJournalLine(ref2, 81100, 0, 8000); // Other Revenue
      await postJournalEntry(ref2, new Date(2024, 4, 20, 0, 0, 0, 0));

      // Expense transactions
      // COGS (51000): 6000
      const ref3 = await draftJournalEntry(new Date(2024, 3, 15, 0, 0, 0, 0));
      await addJournalLine(ref3, 51000, 6000, 0);
      await addJournalLine(ref3, 11110, 0, 6000); // Cash
      await postJournalEntry(ref3, new Date(2024, 3, 15, 0, 0, 0, 0));

      // Salaries (61300): 4000
      const ref4 = await draftJournalEntry(new Date(2024, 5, 25, 0, 0, 0, 0));
      await addJournalLine(ref4, 61300, 4000, 0);
      await addJournalLine(ref4, 11110, 0, 4000); // Cash
      await postJournalEntry(ref4, new Date(2024, 5, 25, 0, 0, 0, 0));

      // Rent (61100): 2400
      const ref5 = await draftJournalEntry(new Date(2024, 6, 1, 0, 0, 0, 0));
      await addJournalLine(ref5, 61100, 2400, 0);
      await addJournalLine(ref5, 11110, 0, 2400); // Cash
      await postJournalEntry(ref5, new Date(2024, 6, 1, 0, 0, 0, 0));

      // Dividends (33000): 3000
      const ref6 = await draftJournalEntry(new Date(2024, 9, 15, 0, 0, 0, 0));
      await addJournalLine(ref6, 33000, 3000, 0);
      await addJournalLine(ref6, 11110, 0, 3000); // Cash
      await postJournalEntry(ref6, new Date(2024, 9, 15, 0, 0, 0, 0));

      // Net Income = Revenue (23000) - Expenses (12400) - Dividends (3000) = 7600

      // Create and close fiscal year
      const beginTime = new Date(2024, 0, 1, 0, 0, 0, 0).getTime();
      const endTime = new Date(2024, 11, 31, 0, 0, 0, 0).getTime();

      await sql`INSERT INTO fiscal_years (begin_time, end_time, name) VALUES (${beginTime}, ${endTime}, 'FY2024')`;

      await sql`UPDATE fiscal_years SET post_time = ${testTime} WHERE begin_time = ${beginTime}`;

      // Verify all temporary accounts are zeroed
      const salesRevenue = (await sql`SELECT balance FROM accounts WHERE account_code = 41000`).rows[0];
      const otherRevenue = (await sql`SELECT balance FROM accounts WHERE account_code = 81100`).rows[0];
      const cogs = (await sql`SELECT balance FROM accounts WHERE account_code = 51000`).rows[0];
      const salaries = (await sql`SELECT balance FROM accounts WHERE account_code = 61300`).rows[0];
      const rent = (await sql`SELECT balance FROM accounts WHERE account_code = 61100`).rows[0];
      const dividends = (await sql`SELECT balance FROM accounts WHERE account_code = 33000`).rows[0];

      equal(salesRevenue.balance, 0, 'Sales Revenue should be zeroed');
      equal(otherRevenue.balance, 0, 'Other Revenue should be zeroed');
      equal(cogs.balance, 0, 'COGS should be zeroed');
      equal(salaries.balance, 0, 'Salaries should be zeroed');
      equal(rent.balance, 0, 'Rent should be zeroed');
      equal(dividends.balance, 0, 'Dividends should be zeroed');

      // Verify retained earnings
      const retainedEarnings = (await sql`SELECT balance FROM accounts WHERE account_code = 32000`).rows[0];
      equal(retainedEarnings.balance, 7600, 'Retained Earnings should be 7600');

      // Verify closing entry line count
      const fiscalYear = (await sql`SELECT * FROM fiscal_years WHERE begin_time = ${beginTime}`).rows[0];
      const closingLines = (await sql`SELECT COUNT(*) as count FROM journal_entry_lines WHERE journal_entry_ref = ${fiscalYear.closing_journal_entry_ref}`).rows[0];

      // 2 revenue + 3 expense + 1 dividend + 1 retained earnings = 7
      equal(closingLines.count, 7, 'Should have 7 closing entry lines');
    });
  });

  describe('Edge Cases', function () {
    it('shall handle fiscal year with zero net income (breakeven)', async function () {
      await setupStandardClosingAccounts();

      // Revenue (41000): 5000
      const ref1 = await draftJournalEntry(new Date(2024, 3, 10, 0, 0, 0, 0));
      await addJournalLine(ref1, 11110, 5000, 0); // Cash
      await addJournalLine(ref1, 41000, 0, 5000); // Sales
      await postJournalEntry(ref1, new Date(2024, 3, 10, 0, 0, 0, 0));

      // Expense (61300): 5000 (exact breakeven)
      const ref2 = await draftJournalEntry(new Date(2024, 5, 15, 0, 0, 0, 0));
      await addJournalLine(ref2, 61300, 5000, 0); // Salaries
      await addJournalLine(ref2, 11110, 0, 5000); // Cash
      await postJournalEntry(ref2, new Date(2024, 5, 15, 0, 0, 0, 0));

      // Create and close fiscal year
      const beginTime = new Date(2024, 0, 1, 0, 0, 0, 0).getTime();
      const endTime = new Date(2024, 11, 31, 0, 0, 0, 0).getTime();

      await sql`INSERT INTO fiscal_years (begin_time, end_time, name) VALUES (${beginTime}, ${endTime}, 'FY2024')`;

      await sql`UPDATE fiscal_years SET post_time = ${testTime} WHERE begin_time = ${beginTime}`;

      // Verify accounts are zeroed
      const salesRevenue = (await sql`SELECT balance FROM accounts WHERE account_code = 41000`).rows[0];
      const salaries = (await sql`SELECT balance FROM accounts WHERE account_code = 61300`).rows[0];
      const retainedEarnings = (await sql`SELECT balance FROM accounts WHERE account_code = 32000`).rows[0];

      equal(salesRevenue.balance, 0, 'Sales Revenue should be zeroed');
      equal(salaries.balance, 0, 'Salaries should be zeroed');
      equal(retainedEarnings.balance, 0, 'Retained Earnings should be zero (breakeven)');
    });

    it('shall close fiscal year with no transactions', async function () {
      await setupStandardClosingAccounts();

      // Create fiscal year without any transactions
      const beginTime = new Date(2024, 0, 1, 0, 0, 0, 0).getTime();
      const endTime = new Date(2024, 11, 31, 0, 0, 0, 0).getTime();

      await sql`INSERT INTO fiscal_years (begin_time, end_time, name) VALUES (${beginTime}, ${endTime}, 'FY2024')`;

      await sql`UPDATE fiscal_years SET post_time = ${testTime} WHERE begin_time = ${beginTime}`;

      // Verify fiscal year is closed
      const fiscalYear = (await sql`SELECT * FROM fiscal_years WHERE begin_time = ${beginTime}`).rows[0];
      ok(fiscalYear.post_time, 'Fiscal year should be posted');

      // Verify retained earnings is still zero
      const retainedEarnings = (await sql`SELECT balance FROM accounts WHERE account_code = 32000`).rows[0];
      equal(retainedEarnings.balance, 0, 'Retained Earnings should be zero');
    });

    it('shall handle large transaction amounts correctly', async function () {
      await setupStandardClosingAccounts();

      // Large revenue: 1,000,000,000 (1 billion)
      const ref1 = await draftJournalEntry(new Date(2024, 5, 15, 0, 0, 0, 0));
      await addJournalLine(ref1, 11110, 1000000000, 0); // Cash
      await addJournalLine(ref1, 41000, 0, 1000000000); // Sales
      await postJournalEntry(ref1, new Date(2024, 5, 15, 0, 0, 0, 0));

      // Large expense: 750,000,000
      const ref2 = await draftJournalEntry(new Date(2024, 7, 20, 0, 0, 0, 0));
      await addJournalLine(ref2, 51000, 750000000, 0); // COGS
      await addJournalLine(ref2, 11110, 0, 750000000); // Cash
      await postJournalEntry(ref2, new Date(2024, 7, 20, 0, 0, 0, 0));

      // Net income: 250,000,000

      // Create and close fiscal year
      const beginTime = new Date(2024, 0, 1, 0, 0, 0, 0).getTime();
      const endTime = new Date(2024, 11, 31, 0, 0, 0, 0).getTime();

      await sql`INSERT INTO fiscal_years (begin_time, end_time, name) VALUES (${beginTime}, ${endTime}, 'FY2024')`;

      await sql`UPDATE fiscal_years SET post_time = ${testTime} WHERE begin_time = ${beginTime}`;

      // Verify balances
      const salesRevenue = (await sql`SELECT balance FROM accounts WHERE account_code = 41000`).rows[0];
      const cogs = (await sql`SELECT balance FROM accounts WHERE account_code = 51000`).rows[0];
      const retainedEarnings = (await sql`SELECT balance FROM accounts WHERE account_code = 32000`).rows[0];

      equal(salesRevenue.balance, 0, 'Sales Revenue should be zeroed');
      equal(cogs.balance, 0, 'COGS should be zeroed');
      equal(retainedEarnings.balance, 250000000, 'Retained Earnings should be 250,000,000');
    });

    it('shall handle transactions at exact fiscal year boundaries', async function () {
      await setupStandardClosingAccounts();

      const beginTime = new Date(2024, 0, 1, 0, 0, 0, 0).getTime();
      const endTime = new Date(2024, 11, 31, 0, 0, 0, 0).getTime();

      // Transaction exactly at begin_time (should NOT be included)
      const ref1 = await draftJournalEntry(new Date(2024, 0, 1, 0, 0, 0, 0));
      await addJournalLine(ref1, 11110, 1000, 0); // Cash
      await addJournalLine(ref1, 41000, 0, 1000); // Sales
      await postJournalEntry(ref1, new Date(2024, 0, 1, 0, 0, 0, 0));

      // Transaction 1ms after begin_time (should be included)
      const ref2 = await draftJournalEntry(new Date(2024, 0, 1, 0, 0, 0, 1));
      await addJournalLine(ref2, 11110, 2000, 0); // Cash
      await addJournalLine(ref2, 41000, 0, 2000); // Sales
      await postJournalEntry(ref2, new Date(2024, 0, 1, 0, 0, 0, 1));

      // Transaction exactly at end_time (should be included)
      const ref3 = await draftJournalEntry(new Date(2024, 11, 31, 0, 0, 0, 0));
      await addJournalLine(ref3, 11110, 3000, 0); // Cash
      await addJournalLine(ref3, 41000, 0, 3000); // Sales
      await postJournalEntry(ref3, new Date(2024, 11, 31, 0, 0, 0, 0));

      // Create and close fiscal year
      await sql`INSERT INTO fiscal_years (begin_time, end_time, name) VALUES (${beginTime}, ${endTime}, 'FY2024')`;

      await sql`UPDATE fiscal_years SET post_time = ${testTime} WHERE begin_time = ${beginTime}`;

      // Verify retained earnings (should include all transactions: 2000 + 3000 = 5000)
      const retainedEarnings = (await sql`SELECT balance FROM accounts WHERE account_code = 32000`).rows[0];
      equal(retainedEarnings.balance, 5000, 'Retained Earnings should reflect correct boundary transactions (inclusive end, exclusive begin)');
    });
  });

  describe('Consecutive Fiscal Years', function () {
    it('shall close consecutive fiscal years correctly', async function () {
      await setupStandardClosingAccounts();

      // FY2023 transactions
      const fy2023Begin = new Date(2023, 0, 1, 0, 0, 0, 0).getTime();
      const fy2023End = new Date(2023, 11, 31, 0, 0, 0, 0).getTime();

      // Revenue in FY2023 (41000): 10000
      const ref1 = await draftJournalEntry(new Date(2023, 5, 15, 0, 0, 0, 0));
      await addJournalLine(ref1, 11110, 10000, 0); // Cash
      await addJournalLine(ref1, 41000, 0, 10000); // Sales
      await postJournalEntry(ref1, new Date(2023, 5, 15, 0, 0, 0, 0));

      // Expense in FY2023 (61300): 4000
      const ref2 = await draftJournalEntry(new Date(2023, 8, 20, 0, 0, 0, 0));
      await addJournalLine(ref2, 61300, 4000, 0); // Salaries
      await addJournalLine(ref2, 11110, 0, 4000); // Cash
      await postJournalEntry(ref2, new Date(2023, 8, 20, 0, 0, 0, 0));

      // Create and close FY2023
      await sql`INSERT INTO fiscal_years (begin_time, end_time, name) VALUES (${fy2023Begin}, ${fy2023End}, 'FY2023')`;

      const postTime2023 = new Date(2024, 0, 5, 0, 0, 0, 0).getTime();
      await sql`UPDATE fiscal_years SET post_time = ${postTime2023} WHERE begin_time = ${fy2023Begin}`;

      // Verify FY2023 closing
      let retainedEarnings = (await sql`SELECT balance FROM accounts WHERE account_code = 32000`).rows[0];
      equal(retainedEarnings.balance, 6000, 'FY2023 Retained Earnings should be 6000');

      // FY2024 transactions
      const fy2024Begin = new Date(2024, 0, 1, 0, 0, 0, 0).getTime();
      const fy2024End = new Date(2024, 11, 31, 0, 0, 0, 0).getTime();

      // Revenue in FY2024 (41000): 15000
      const ref3 = await draftJournalEntry(new Date(2024, 3, 10, 0, 0, 0, 0));
      await addJournalLine(ref3, 11110, 15000, 0); // Cash
      await addJournalLine(ref3, 41000, 0, 15000); // Sales
      await postJournalEntry(ref3, new Date(2024, 3, 10, 0, 0, 0, 0));

      // Expense in FY2024 (61300): 7000
      const ref4 = await draftJournalEntry(new Date(2024, 6, 25, 0, 0, 0, 0));
      await addJournalLine(ref4, 61300, 7000, 0); // Salaries
      await addJournalLine(ref4, 11110, 0, 7000); // Cash
      await postJournalEntry(ref4, new Date(2024, 6, 25, 0, 0, 0, 0));

      // Create and close FY2024
      await sql`INSERT INTO fiscal_years (begin_time, end_time, name) VALUES (${fy2024Begin}, ${fy2024End}, 'FY2024')`;

      const postTime2024 = new Date(2025, 0, 5, 0, 0, 0, 0).getTime();
      await sql`UPDATE fiscal_years SET post_time = ${postTime2024} WHERE begin_time = ${fy2024Begin}`;

      // Verify cumulative retained earnings
      retainedEarnings = (await sql`SELECT balance FROM accounts WHERE account_code = 32000`).rows[0];
      equal(retainedEarnings.balance, 14000, 'Cumulative Retained Earnings should be 14000 (6000 + 8000)');

      // Verify both revenue accounts are zeroed
      const salesRevenue = (await sql`SELECT balance FROM accounts WHERE account_code = 41000`).rows[0];
      const salaries = (await sql`SELECT balance FROM accounts WHERE account_code = 61300`).rows[0];

      equal(salesRevenue.balance, 0, 'Sales Revenue should be zeroed after FY2024 closing');
      equal(salaries.balance, 0, 'Salaries should be zeroed after FY2024 closing');
    });

    it('shall handle multiple years of accumulated retained earnings', async function () {
      await setupStandardClosingAccounts();

      const years = [2021, 2022, 2023, 2024];
      const profits = [5000, 8000, -3000, 10000]; // Net income per year

      for (let i = 0; i < years.length; i++) {
        const year = years[i];
        const profit = profits[i];
        const beginTime = new Date(year, 0, 1, 0, 0, 0, 0).getTime();
        const endTime = new Date(year, 11, 31, 0, 0, 0, 0).getTime();

        if (profit > 0) {
          // Post revenue transaction (41000)
          const ref = await draftJournalEntry(new Date(year, 5, 15, 0, 0, 0, 0));
          await addJournalLine(ref, 11110, profit, 0); // Cash
          await addJournalLine(ref, 41000, 0, profit); // Sales
          await postJournalEntry(ref, new Date(year, 5, 15, 0, 0, 0, 0));
        } else {
          // Post expense transaction (for net loss) (61300)
          const ref = await draftJournalEntry(new Date(year, 5, 15, 0, 0, 0, 0));
          await addJournalLine(ref, 61300, Math.abs(profit), 0); // Salaries
          await addJournalLine(ref, 11110, 0, Math.abs(profit)); // Cash
          await postJournalEntry(ref, new Date(year, 5, 15, 0, 0, 0, 0));
        }

        // Create and close fiscal year
        await sql`INSERT INTO fiscal_years (begin_time, end_time, name) VALUES (${beginTime}, ${endTime}, ${'FY' + year})`;

        const postTime = new Date(year + 1, 0, 5, 0, 0, 0, 0).getTime();
        await sql`UPDATE fiscal_years SET post_time = ${postTime} WHERE begin_time = ${beginTime}`;
      }

      // Verify final accumulated retained earnings
      // Total: 5000 + 8000 + (-3000) + 10000 = 20000
      const retainedEarnings = (await sql`SELECT balance FROM accounts WHERE account_code = 32000`).rows[0];
      equal(retainedEarnings.balance, 20000, 'Accumulated Retained Earnings should be 20000');

      // Verify all temporary accounts are zeroed
      const salesRevenue = (await sql`SELECT balance FROM accounts WHERE account_code = 41000`).rows[0];
      const salaries = (await sql`SELECT balance FROM accounts WHERE account_code = 61300`).rows[0];

      equal(salesRevenue.balance, 0, 'Sales Revenue should be zeroed');
      equal(salaries.balance, 0, 'Salaries should be zeroed');
    });
  });

  describe('Validation Rules', function () {
    it('shall prevent closing fiscal year with unposted entries within period', async function () {
      await setupStandardClosingAccounts();

      const beginTime = new Date(2024, 0, 1, 0, 0, 0, 0).getTime();
      const endTime = new Date(2024, 11, 31, 0, 0, 0, 0).getTime();

      // Create posted transaction
      const ref1 = await draftJournalEntry(new Date(2024, 5, 15, 0, 0, 0, 0));
      await addJournalLine(ref1, 11110, 5000, 0); // Cash
      await addJournalLine(ref1, 41000, 0, 5000); // Sales
      await postJournalEntry(ref1, new Date(2024, 5, 15, 0, 0, 0, 0));

      // Create unposted transaction within period
      const ref2 = await draftJournalEntry(new Date(2024, 8, 20, 0, 0, 0, 0));
      await addJournalLine(ref2, 11110, 3000, 0); // Cash
      await addJournalLine(ref2, 41000, 0, 3000); // Sales
      // Note: Not posting ref2

      // Create fiscal year
      await sql`INSERT INTO fiscal_years (begin_time, end_time, name) VALUES (${beginTime}, ${endTime}, 'FY2024')`;

      // Attempt to close should fail
      await rejects(
        sql`UPDATE fiscal_years SET post_time = ${testTime} WHERE begin_time = ${beginTime}`,
        /Cannot close fiscal year with unposted journal entries/
      );
    });

    it('shall allow closing fiscal year when unposted entries are outside period', async function () {
      await setupStandardClosingAccounts();

      const beginTime = new Date(2024, 0, 1, 0, 0, 0, 0).getTime();
      const endTime = new Date(2024, 11, 31, 0, 0, 0, 0).getTime();

      // Create posted transaction within period
      const ref1 = await draftJournalEntry(new Date(2024, 5, 15, 0, 0, 0, 0));
      await addJournalLine(ref1, 11110, 5000, 0);
      await addJournalLine(ref1, 41000, 0, 5000);
      await postJournalEntry(ref1, new Date(2024, 5, 15, 0, 0, 0, 0));

      // Create unposted transaction OUTSIDE period (in 2025)
      const ref2 = await draftJournalEntry(new Date(2025, 1, 20, 0, 0, 0, 0));
      await addJournalLine(ref2, 11110, 3000, 0);
      await addJournalLine(ref2, 41000, 0, 3000);
      // Note: Not posting ref2

      // Create fiscal year
      await sql`INSERT INTO fiscal_years (begin_time, end_time, name) VALUES (${beginTime}, ${endTime}, 'FY2024')`;

      // Closing should succeed
      await sql`UPDATE fiscal_years SET post_time = ${testTime} WHERE begin_time = ${beginTime}`;

      // Verify fiscal year was closed
      const fiscalYear = (await sql`SELECT * FROM fiscal_years WHERE begin_time = ${beginTime}`).rows[0];
      ok(fiscalYear.post_time, 'Fiscal year should be closed');
    });

    it('shall prevent modifying closed fiscal year attributes', async function () {
      await setupStandardClosingAccounts();

      const beginTime = new Date(2024, 0, 1, 0, 0, 0, 0).getTime();
      const endTime = new Date(2024, 11, 31, 0, 0, 0, 0).getTime();

      // Create and close fiscal year
      await sql`INSERT INTO fiscal_years (begin_time, end_time, name) VALUES (${beginTime}, ${endTime}, 'FY2024')`;

      await sql`UPDATE fiscal_years SET post_time = ${testTime} WHERE begin_time = ${beginTime}`;

      // Attempt to change post_time
      const newPostTime = new Date(2025, 0, 10, 0, 0, 0, 0).getTime();
      await rejects(
        sql`UPDATE fiscal_years SET post_time = ${newPostTime} WHERE begin_time = ${beginTime}`,
        /Cannot unpost or change post_time of a posted fiscal year/
      );

      // Attempt to unpost
      await rejects(
        sql`UPDATE fiscal_years SET post_time = NULL WHERE begin_time = ${beginTime}`,
        /Cannot unpost or change post_time of a posted fiscal year/
      );
    });

    it('shall enforce fiscal year duration constraints', async function () {
      // Too short (less than 30 days)
      const shortBegin = new Date(2024, 0, 1, 0, 0, 0, 0).getTime();
      const shortEnd = new Date(2024, 0, 15, 0, 0, 0, 0).getTime();

      await rejects(
        sql`INSERT INTO fiscal_years (begin_time, end_time, name) VALUES (${shortBegin}, ${shortEnd}, 'Short FY')`,
        /Fiscal year must be at least 30 days/
      );

      // Too long (more than 400 days)
      const longBegin = new Date(2024, 0, 1, 0, 0, 0, 0).getTime();
      const longEnd = new Date(2025, 3, 1, 0, 0, 0, 0).getTime(); // ~455 days

      await rejects(
        sql`INSERT INTO fiscal_years (begin_time, end_time, name) VALUES (${longBegin}, ${longEnd}, 'Long FY')`,
        /Fiscal year cannot exceed 400 days/
      );
    });

    it('shall enforce non-overlapping fiscal year constraint', async function () {
      const beginTime1 = new Date(2024, 0, 1, 0, 0, 0, 0).getTime();
      const endTime1 = new Date(2024, 11, 31, 0, 0, 0, 0).getTime();

      await sql`INSERT INTO fiscal_years (begin_time, end_time, name) VALUES (${beginTime1}, ${endTime1}, 'FY2024')`;

      // Completely overlapping
      await rejects(
        sql`INSERT INTO fiscal_years (begin_time, end_time, name) VALUES (${beginTime1}, ${endTime1}, 'FY2024 Duplicate')`,
        /Fiscal year periods cannot overlap/
      );

      // Partially overlapping (start overlaps)
      const beginTime2 = new Date(2024, 6, 1, 0, 0, 0, 0).getTime();
      const endTime2 = new Date(2025, 5, 30, 0, 0, 0, 0).getTime();

      await rejects(
        sql`INSERT INTO fiscal_years (begin_time, end_time, name) VALUES (${beginTime2}, ${endTime2}, 'Overlapping FY')`,
        /Fiscal year periods cannot overlap/
      );

      // Partially overlapping (end overlaps)
      const beginTime3 = new Date(2023, 6, 1, 0, 0, 0, 0).getTime();
      const endTime3 = new Date(2024, 5, 30, 0, 0, 0, 0).getTime();

      await rejects(
        sql`INSERT INTO fiscal_years (begin_time, end_time, name) VALUES (${beginTime3}, ${endTime3}, 'Overlapping FY2')`,
        /Fiscal year periods cannot overlap/
      );
    });
  });

  describe('Closing Entry Details', function () {
    it('shall create closing entry with correct system metadata', async function () {
      await setupStandardClosingAccounts();

      // Post transaction
      const ref1 = await draftJournalEntry(new Date(2024, 5, 15, 0, 0, 0, 0));
      await addJournalLine(ref1, 11110, 10000, 0); // Cash
      await addJournalLine(ref1, 41000, 0, 10000); // Sales
      await postJournalEntry(ref1, new Date(2024, 5, 15, 0, 0, 0, 0));

      const ref2 = await draftJournalEntry(new Date(2024, 7, 20, 0, 0, 0, 0));
      await addJournalLine(ref2, 61300, 4000, 0); // Salaries
      await addJournalLine(ref2, 11110, 0, 4000); // Cash
      await postJournalEntry(ref2, new Date(2024, 7, 20, 0, 0, 0, 0));

      // Create and close fiscal year
      const beginTime = new Date(2024, 0, 1, 0, 0, 0, 0).getTime();
      const endTime = new Date(2024, 11, 31, 0, 0, 0, 0).getTime();

      await sql`INSERT INTO fiscal_years (begin_time, end_time, name) VALUES (${beginTime}, ${endTime}, 'FY2024')`;

      await sql`UPDATE fiscal_years SET post_time = ${testTime} WHERE begin_time = ${beginTime}`;

      // Verify closing entry metadata
      const fiscalYear = (await sql`SELECT * FROM fiscal_years WHERE begin_time = ${beginTime}`).rows[0];
      ok(fiscalYear.closing_journal_entry_ref, 'Closing journal entry should be created');

      const closingEntry = (await sql`SELECT * FROM journal_entries WHERE ref = ${fiscalYear.closing_journal_entry_ref}`).rows[0];

      equal(closingEntry.source_type, 'System', 'Closing entry source_type should be System');
      equal(closingEntry.created_by, 'System', 'Closing entry created_by should be System');
    });

    it('shall post closing entry at fiscal year end time', async function () {
      await setupStandardClosingAccounts();

      // Post transaction
      const ref1 = await draftJournalEntry(new Date(2024, 5, 15, 0, 0, 0, 0));
      await addJournalLine(ref1, 11110, 5000, 0); // Cash
      await addJournalLine(ref1, 41000, 0, 5000); // Sales
      await postJournalEntry(ref1, new Date(2024, 5, 15, 0, 0, 0, 0));

      // Create and close fiscal year
      const beginTime = new Date(2024, 0, 1, 0, 0, 0, 0).getTime();
      const endTime = new Date(2024, 11, 31, 0, 0, 0, 0).getTime();

      await sql`INSERT INTO fiscal_years (begin_time, end_time, name) VALUES (${beginTime}, ${endTime}, 'FY2024')`;

      await sql`UPDATE fiscal_years SET post_time = ${testTime} WHERE begin_time = ${beginTime}`;

      // Verify closing entry post_time equals fiscal year end_time
      const fiscalYear = (await sql`SELECT * FROM fiscal_years WHERE begin_time = ${beginTime}`).rows[0];
      const closingEntry = (await sql`SELECT * FROM journal_entries WHERE ref = ${fiscalYear.closing_journal_entry_ref}`).rows[0];

      equal(closingEntry.post_time, endTime, 'Closing entry post_time should equal fiscal year end_time');
      equal(closingEntry.entry_time, endTime, 'Closing entry entry_time should equal fiscal year end_time');
    });
  });
});
