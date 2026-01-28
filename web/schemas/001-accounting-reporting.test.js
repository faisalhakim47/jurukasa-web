import { ok, equal, deepEqual } from 'node:assert/strict';
import { describe, it } from 'node:test';

import { useSql } from '#test/nodejs/hooks/use-sql.js';

describe('Accounting Schema Tests - Financial Reporting', function () {
  const sql = useSql();
  const testTime = new Date(2025, 0, 1, 0, 0, 0, 0).getTime();

  /**
   * @param {number} code
   * @param {string} name
   * @param {number} normalBalance
   * @param {number} [controlCode]
   */
  async function createAccount(code, name, normalBalance, controlCode) {
    await sql`
      INSERT INTO accounts (account_code, name, normal_balance, control_account_code, create_time, update_time)
      VALUES (${code}, ${name}, ${normalBalance}, ${controlCode ?? null}, ${testTime}, ${testTime})
    `;
  }

  /**
   * @param {number} code
   * @param {string} tag
   */
  async function addTag(code, tag) {
    await sql`INSERT INTO account_tags (account_code, tag) VALUES (${code}, ${tag})`;
  }

  /** @param {Date} entryDate */
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
    await sql`
      INSERT INTO journal_entry_lines_auto_number (journal_entry_ref, account_code, debit, credit)
      VALUES (${ref}, ${accountCode}, ${debit}, ${credit})
    `;
  }

  /**
   * @param {number} ref
   * @param {Date} postDate
   */
  async function postJournalEntry(ref, postDate) {
    await sql`UPDATE journal_entries SET post_time = ${postDate.getTime()} WHERE ref = ${ref}`;
  }

  /**
   * Setup complete chart of accounts using the Retail Business - Indonesia template
   */
  async function setupCompleteChartOfAccounts() {
    await sql`INSERT INTO chart_of_accounts_templates (name) VALUES (${'Retail Business - Indonesia'})`;
  }

  describe('Trial Balance Generation', function () {
    it('shall generate trial balance with all active accounts', async function () {
      await setupCompleteChartOfAccounts();

      // Post transactions
      // Initial investment
      const ref1 = await draftJournalEntry(new Date(2024, 0, 2, 0, 0, 0, 0));
      await addJournalLine(ref1, 11110, 100000, 0);
      await addJournalLine(ref1, 31000, 0, 100000);
      await postJournalEntry(ref1, new Date(2024, 0, 2, 0, 0, 0, 0));

      // Purchase inventory
      const ref2 = await draftJournalEntry(new Date(2024, 1, 15, 0, 0, 0, 0));
      await addJournalLine(ref2, 11310, 30000, 0);
      await addJournalLine(ref2, 11110, 0, 30000);
      await postJournalEntry(ref2, new Date(2024, 1, 15, 0, 0, 0, 0));

      // Sales transaction
      const ref3 = await draftJournalEntry(new Date(2024, 3, 10, 0, 0, 0, 0));
      await addJournalLine(ref3, 11110, 50000, 0);
      await addJournalLine(ref3, 41000, 0, 50000);
      await postJournalEntry(ref3, new Date(2024, 3, 10, 0, 0, 0, 0));

      // COGS
      const ref4 = await draftJournalEntry(new Date(2024, 3, 10, 0, 0, 0, 0));
      await addJournalLine(ref4, 51000, 20000, 0);
      await addJournalLine(ref4, 11310, 0, 20000);
      await postJournalEntry(ref4, new Date(2024, 3, 10, 0, 0, 0, 0));

      // Generate balance report
      const reportTime = new Date(2024, 5, 30, 0, 0, 0, 0).getTime();
      await sql`
        INSERT INTO balance_reports (report_time, report_type, name, create_time)
        VALUES (${reportTime}, 'Ad Hoc', 'Q2 2024 Trial Balance', ${testTime})
      `;

      // Check trial balance lines
      const trialBalance = (await sql`SELECT * FROM trial_balance ORDER BY account_code`).rows;

      // Verify total debits equal total credits
      const totalDebits = trialBalance.reduce((sum, row) => sum + Number(row.debit), 0);
      const totalCredits = trialBalance.reduce((sum, row) => sum + Number(row.credit), 0);
      equal(totalDebits, totalCredits, 'Trial balance should balance (debits = credits)');

      // Verify specific account balances
      const cashLine = trialBalance.find(r => r.account_code === 11110);
      equal(cashLine.debit, 120000, 'Cash debit should be 120000');
      equal(cashLine.credit, 0, 'Cash credit should be 0');

      const inventoryLine = trialBalance.find(r => r.account_code === 11310);
      equal(inventoryLine.debit, 10000, 'Inventory debit should be 10000');

      const commonStockLine = trialBalance.find(r => r.account_code === 31000);
      equal(commonStockLine.credit, 100000, 'Common Stock credit should be 100000');

      const salesRevenueLine = trialBalance.find(r => r.account_code === 41000);
      equal(salesRevenueLine.credit, 50000, 'Sales Revenue credit should be 50000');

      const cogsLine = trialBalance.find(r => r.account_code === 51000);
      equal(cogsLine.debit, 20000, 'COGS debit should be 20000');
    });

    it('shall generate trial balance showing contra account balances correctly', async function () {
      await setupCompleteChartOfAccounts();

      // Initial investment
      const ref1 = await draftJournalEntry(new Date(2024, 0, 2, 0, 0, 0, 0));
      await addJournalLine(ref1, 11110, 200000, 0);
      await addJournalLine(ref1, 31000, 0, 200000);
      await postJournalEntry(ref1, new Date(2024, 0, 2, 0, 0, 0, 0));

      // Purchase equipment
      const ref2 = await draftJournalEntry(new Date(2024, 1, 15, 0, 0, 0, 0));
      await addJournalLine(ref2, 12110, 50000, 0);
      await addJournalLine(ref2, 11110, 0, 50000);
      await postJournalEntry(ref2, new Date(2024, 1, 15, 0, 0, 0, 0));

      // Record depreciation (contra account)
      const ref3 = await draftJournalEntry(new Date(2024, 11, 31, 0, 0, 0, 0));
      await addJournalLine(ref3, 61900, 5000, 0);
      await addJournalLine(ref3, 12190, 0, 5000);
      await postJournalEntry(ref3, new Date(2024, 11, 31, 0, 0, 0, 0));

      // Generate balance report
      const reportTime = new Date(2024, 11, 31, 0, 0, 0, 0).getTime();
      await sql`
        INSERT INTO balance_reports (report_time, report_type, name, create_time)
        VALUES (${reportTime}, 'Period End', 'Year End 2024 Trial Balance', ${testTime})
      `;

      // Check trial balance
      const trialBalance = (await sql`SELECT * FROM trial_balance ORDER BY account_code`).rows;

      // Verify equipment and accumulated depreciation
      const equipmentLine = trialBalance.find(r => r.account_code === 12110);
      equal(equipmentLine.debit, 50000, 'Equipment debit should be 50000');

      const accumDepLine = trialBalance.find(r => r.account_code === 12190);
      equal(accumDepLine.credit, 5000, 'Accumulated Depreciation credit should be 5000');

      const depExpenseLine = trialBalance.find(r => r.account_code === 61900);
      equal(depExpenseLine.debit, 5000, 'Depreciation Expense debit should be 5000');

      // Verify balance
      const totalDebits = trialBalance.reduce((sum, row) => sum + Number(row.debit), 0);
      const totalCredits = trialBalance.reduce((sum, row) => sum + Number(row.credit), 0);
      equal(totalDebits, totalCredits, 'Trial balance should balance');
    });

    it('shall handle accounts with negative balances in trial balance', async function () {
      await setupCompleteChartOfAccounts();

      // Initial investment
      const ref1 = await draftJournalEntry(new Date(2024, 0, 2, 0, 0, 0, 0));
      await addJournalLine(ref1, 11110, 10000, 0);
      await addJournalLine(ref1, 31000, 0, 10000);
      await postJournalEntry(ref1, new Date(2024, 0, 2, 0, 0, 0, 0));

      // Overdraw cash (negative balance for debit-normal account)
      const ref2 = await draftJournalEntry(new Date(2024, 2, 15, 0, 0, 0, 0));
      await addJournalLine(ref2, 61300, 15000, 0);
      await addJournalLine(ref2, 11110, 0, 15000);
      await postJournalEntry(ref2, new Date(2024, 2, 15, 0, 0, 0, 0));

      // Generate balance report
      const reportTime = new Date(2024, 5, 30, 0, 0, 0, 0).getTime();
      await sql`
        INSERT INTO balance_reports (report_time, report_type, name, create_time)
        VALUES (${reportTime}, 'Ad Hoc', 'Trial Balance with Overdraft', ${testTime})
      `;

      // Check trial balance
      const trialBalance = (await sql`SELECT * FROM trial_balance ORDER BY account_code`).rows;

      // Cash has negative balance (shown as credit for debit-normal account)
      const cashLine = trialBalance.find(r => r.account_code === 11110);
      equal(cashLine.debit, 0, 'Cash debit should be 0 (negative balance)');
      equal(cashLine.credit, 5000, 'Cash credit should be 5000 (negative balance shown as credit)');

      // Verify balance
      const totalDebits = trialBalance.reduce((sum, row) => sum + Number(row.debit), 0);
      const totalCredits = trialBalance.reduce((sum, row) => sum + Number(row.credit), 0);
      equal(totalDebits, totalCredits, 'Trial balance should balance');
    });
  });

  describe('Balance Sheet Generation', function () {
    it('shall generate balance sheet with proper classifications', async function () {
      await setupCompleteChartOfAccounts();

      // Add additional accounts not in template
      await createAccount(25000, 'Long-term Loans', 1, 20000);
      await addTag(25000, 'Balance Sheet - Non-Current Liability');

      // Initial investment
      const ref1 = await draftJournalEntry(new Date(2024, 0, 2, 0, 0, 0, 0));
      await addJournalLine(ref1, 11110, 100000, 0);
      await addJournalLine(ref1, 31000, 0, 100000);
      await postJournalEntry(ref1, new Date(2024, 0, 2, 0, 0, 0, 0));

      // Purchase equipment
      const ref2 = await draftJournalEntry(new Date(2024, 1, 15, 0, 0, 0, 0));
      await addJournalLine(ref2, 12110, 30000, 0);
      await addJournalLine(ref2, 11110, 0, 30000);
      await postJournalEntry(ref2, new Date(2024, 1, 15, 0, 0, 0, 0));

      // Take out loan
      const ref3 = await draftJournalEntry(new Date(2024, 2, 20, 0, 0, 0, 0));
      await addJournalLine(ref3, 11110, 50000, 0);
      await addJournalLine(ref3, 25000, 0, 50000);
      await postJournalEntry(ref3, new Date(2024, 2, 20, 0, 0, 0, 0));

      // Accounts payable
      const ref4 = await draftJournalEntry(new Date(2024, 3, 5, 0, 0, 0, 0));
      await addJournalLine(ref4, 11310, 15000, 0);
      await addJournalLine(ref4, 21100, 0, 15000);
      await postJournalEntry(ref4, new Date(2024, 3, 5, 0, 0, 0, 0));

      // Generate balance report
      const reportTime = new Date(2024, 5, 30, 0, 0, 0, 0).getTime();
      await sql`
        INSERT INTO balance_reports (report_time, report_type, name, create_time)
        VALUES (${reportTime}, 'Period End', 'Q2 2024 Balance Sheet', ${testTime})
      `;

      // Check balance sheet
      const balanceSheet = (await sql`SELECT * FROM balance_sheet ORDER BY classification, category, account_code`).rows;

      // Verify classifications exist
      const classifications = [...new Set(balanceSheet.map(r => r.classification))];
      deepEqual(classifications.sort(), ['Assets', 'Equity', 'Liabilities'].sort(), 'Should have all three classifications');

      // Verify Assets
      const assets = balanceSheet.filter(r => r.classification === 'Assets');
      const currentAssets = assets.filter(r => r.category === 'Current Assets');
      const nonCurrentAssets = assets.filter(r => r.category === 'Non-Current Assets');

      ok(currentAssets.length > 0, 'Should have current assets');
      ok(nonCurrentAssets.length > 0, 'Should have non-current assets');

      // Verify specific asset amounts
      const cashBS = assets.find(r => r.account_code === 11110);
      equal(cashBS.amount, 120000, 'Cash should be 120000');

      const equipmentBS = assets.find(r => r.account_code === 12110);
      equal(equipmentBS.amount, 30000, 'Equipment should be 30000');

      // Verify Liabilities
      const liabilities = balanceSheet.filter(r => r.classification === 'Liabilities');
      const currentLiabilities = liabilities.filter(r => r.category === 'Current Liabilities');
      const nonCurrentLiabilities = liabilities.filter(r => r.category === 'Non-Current Liabilities');

      ok(currentLiabilities.length > 0, 'Should have current liabilities');
      ok(nonCurrentLiabilities.length > 0, 'Should have non-current liabilities');

      // Verify Equity
      const equity = balanceSheet.filter(r => r.classification === 'Equity');
      ok(equity.length > 0, 'Should have equity accounts');

      const commonStockBS = equity.find(r => r.account_code === 31000);
      equal(commonStockBS.amount, 100000, 'Common Stock should be 100000');
    });

    it('shall verify accounting equation (Assets = Liabilities + Equity)', async function () {
      await setupCompleteChartOfAccounts();

      // Add additional accounts not in template
      await createAccount(25000, 'Long-term Loans', 1, 20000);
      await addTag(25000, 'Balance Sheet - Non-Current Liability');
      await createAccount(26000, 'Bonds Payable', 1, 20000);
      await addTag(26000, 'Balance Sheet - Non-Current Liability');
      await createAccount(16000, 'Buildings', 0, 12000);
      await addTag(16000, 'Balance Sheet - Non-Current Asset');

      // Complex set of transactions
      // Initial investment
      const ref1 = await draftJournalEntry(new Date(2024, 0, 2, 0, 0, 0, 0));
      await addJournalLine(ref1, 11110, 150000, 0);
      await addJournalLine(ref1, 31000, 0, 150000);
      await postJournalEntry(ref1, new Date(2024, 0, 2, 0, 0, 0, 0));

      // Purchase inventory on credit
      const ref2 = await draftJournalEntry(new Date(2024, 1, 15, 0, 0, 0, 0));
      await addJournalLine(ref2, 11310, 40000, 0);
      await addJournalLine(ref2, 21100, 0, 40000);
      await postJournalEntry(ref2, new Date(2024, 1, 15, 0, 0, 0, 0));

      // Sales (cash and receivables)
      const ref3 = await draftJournalEntry(new Date(2024, 3, 10, 0, 0, 0, 0));
      await addJournalLine(ref3, 11110, 30000, 0);
      await addJournalLine(ref3, 11200, 20000, 0);
      await addJournalLine(ref3, 41000, 0, 50000);
      await postJournalEntry(ref3, new Date(2024, 3, 10, 0, 0, 0, 0));

      // COGS
      const ref4 = await draftJournalEntry(new Date(2024, 3, 10, 0, 0, 0, 0));
      await addJournalLine(ref4, 51000, 25000, 0);
      await addJournalLine(ref4, 11310, 0, 25000);
      await postJournalEntry(ref4, new Date(2024, 3, 10, 0, 0, 0, 0));

      // Pay expenses
      const ref5 = await draftJournalEntry(new Date(2024, 4, 20, 0, 0, 0, 0));
      await addJournalLine(ref5, 61300, 8000, 0);
      await addJournalLine(ref5, 61100, 3000, 0);
      await addJournalLine(ref5, 11110, 0, 11000);
      await postJournalEntry(ref5, new Date(2024, 4, 20, 0, 0, 0, 0));

      // Take loan
      const ref6 = await draftJournalEntry(new Date(2024, 5, 1, 0, 0, 0, 0));
      await addJournalLine(ref6, 11110, 75000, 0);
      await addJournalLine(ref6, 25000, 0, 75000);
      await postJournalEntry(ref6, new Date(2024, 5, 1, 0, 0, 0, 0));

      // Purchase building
      const ref7 = await draftJournalEntry(new Date(2024, 6, 15, 0, 0, 0, 0));
      await addJournalLine(ref7, 16000, 200000, 0);
      await addJournalLine(ref7, 11110, 0, 100000);
      await addJournalLine(ref7, 26000, 0, 100000);
      await postJournalEntry(ref7, new Date(2024, 6, 15, 0, 0, 0, 0));

      // Generate balance report
      const reportTime = new Date(2024, 11, 31, 0, 0, 0, 0).getTime();
      await sql`
        INSERT INTO balance_reports (report_time, report_type, name, create_time)
        VALUES (${reportTime}, 'Annual', 'Year End 2024 Balance Sheet', ${testTime})
      `;

      // Get balance sheet
      const balanceSheet = (await sql`SELECT * FROM balance_sheet`).rows;

      // Calculate totals by classification
      const totalAssets = balanceSheet
        .filter(r => r.classification === 'Assets')
        .reduce((sum, r) => sum + Number(r.amount), 0);

      const totalLiabilities = balanceSheet
        .filter(r => r.classification === 'Liabilities')
        .reduce((sum, r) => sum + Number(r.amount), 0);

      const totalEquity = balanceSheet
        .filter(r => r.classification === 'Equity')
        .reduce((sum, r) => sum + Number(r.amount), 0);

      // Note: Net income is not yet in retained earnings (fiscal year not closed)
      // So we need to add unrealized income/expense to equity for the equation to balance

      // Get current income statement totals
      const accounts = (await sql`SELECT account_code, balance FROM accounts WHERE account_code IN (${41000}, ${51000}, ${61300}, ${61100})`).rows;

      const revenue = Number(accounts.find(a => Number(a.account_code) === 41000)?.balance || 0);
      const cogs = Number(accounts.find(a => a.account_code === 51000)?.balance || 0);
      const salaries = Number(accounts.find(a => a.account_code === 61300)?.balance || 0);
      const rent = Number(accounts.find(a => a.account_code === 61100)?.balance || 0);
      const netIncome = revenue - cogs - salaries - rent;

      // Verify accounting equation
      equal(
        totalAssets, totalLiabilities + totalEquity + netIncome,
        'Assets should equal Liabilities + Equity + Unrealized Net Income',
      );
    });
  });

  describe('Income Statement via Fiscal Year Account Mutation', function () {
    it('shall track revenue and expense mutations for fiscal year', async function () {
      await setupCompleteChartOfAccounts();

      // Create fiscal year
      const beginTime = new Date(2024, 0, 1, 0, 0, 0, 0).getTime();
      const endTime = new Date(2024, 11, 31, 0, 0, 0, 0).getTime();

      await sql`INSERT INTO fiscal_years (begin_time, end_time, name) VALUES (${beginTime}, ${endTime}, 'FY2024')`;

      // Post transactions within fiscal year
      // Sales Revenue
      const ref1 = await draftJournalEntry(new Date(2024, 2, 15, 0, 0, 0, 0));
      await addJournalLine(ref1, 11110, 100000, 0);
      await addJournalLine(ref1, 41000, 0, 100000);
      await postJournalEntry(ref1, new Date(2024, 2, 15, 0, 0, 0, 0));

      // Interest Income
      const ref2 = await draftJournalEntry(new Date(2024, 6, 10, 0, 0, 0, 0));
      await addJournalLine(ref2, 11110, 2000, 0);
      await addJournalLine(ref2, 81200, 0, 2000);
      await postJournalEntry(ref2, new Date(2024, 6, 10, 0, 0, 0, 0));

      // COGS
      const ref3 = await draftJournalEntry(new Date(2024, 3, 1, 0, 0, 0, 0));
      await addJournalLine(ref3, 51000, 45000, 0);
      await addJournalLine(ref3, 11110, 0, 45000);
      await postJournalEntry(ref3, new Date(2024, 3, 1, 0, 0, 0, 0));

      // Operating Expenses
      const ref4 = await draftJournalEntry(new Date(2024, 5, 25, 0, 0, 0, 0));
      await addJournalLine(ref4, 61300, 20000, 0);
      await addJournalLine(ref4, 61100, 6000, 0);
      await addJournalLine(ref4, 61200, 2000, 0);
      await addJournalLine(ref4, 11110, 0, 28000);
      await postJournalEntry(ref4, new Date(2024, 5, 25, 0, 0, 0, 0));

      // Interest Expense
      const ref5 = await draftJournalEntry(new Date(2024, 8, 15, 0, 0, 0, 0));
      await addJournalLine(ref5, 82100, 3000, 0);
      await addJournalLine(ref5, 11110, 0, 3000);
      await postJournalEntry(ref5, new Date(2024, 8, 15, 0, 0, 0, 0));

      // Check fiscal year account mutation view
      const mutations = (await sql`SELECT * FROM fiscal_year_account_mutation WHERE fiscal_year_id = ${1} ORDER BY account_code`).rows;

      // Verify revenue accounts
      const salesMutation = mutations.find(m => m.account_code === 41000);
      equal(salesMutation.net_change, 100000, 'Sales Revenue net change should be 100000');

      // Verify expense accounts
      const cogsMutation = mutations.find(m => m.account_code === 51000);
      equal(cogsMutation.net_change, 45000, 'COGS net change should be 45000');

      const salariesMutation = mutations.find(m => m.account_code === 61300);
      equal(salariesMutation.net_change, 20000, 'Salaries net change should be 20000');
    });

    it('shall generate income statement view with proper categorization', async function () {
      await setupCompleteChartOfAccounts();

      // Add additional account not in template
      await createAccount(46000, 'Other Income', 1, 40000);
      await addTag(46000, 'Income Statement - Other Revenue');
      await addTag(46000, 'Fiscal Year Closing - Revenue');

      // Create fiscal year
      const beginTime = new Date(2024, 0, 1, 0, 0, 0, 0).getTime();
      const endTime = new Date(2024, 11, 31, 0, 0, 0, 0).getTime();

      await sql`INSERT INTO fiscal_years (begin_time, end_time, name) VALUES (${beginTime}, ${endTime}, 'FY2024')`;

      // Post comprehensive transactions
      // Sales Revenue
      const ref1 = await draftJournalEntry(new Date(2024, 2, 15, 0, 0, 0, 0));
      await addJournalLine(ref1, 11110, 80000, 0);
      await addJournalLine(ref1, 41000, 0, 80000);
      await postJournalEntry(ref1, new Date(2024, 2, 15, 0, 0, 0, 0));

      // Sales Returns (Contra Revenue)
      const ref2 = await draftJournalEntry(new Date(2024, 3, 5, 0, 0, 0, 0));
      await addJournalLine(ref2, 42000, 5000, 0);
      await addJournalLine(ref2, 11110, 0, 5000);
      await postJournalEntry(ref2, new Date(2024, 3, 5, 0, 0, 0, 0));

      // Other Income
      const ref3 = await draftJournalEntry(new Date(2024, 6, 10, 0, 0, 0, 0));
      await addJournalLine(ref3, 11110, 3000, 0);
      await addJournalLine(ref3, 46000, 0, 3000);
      await postJournalEntry(ref3, new Date(2024, 6, 10, 0, 0, 0, 0));

      // COGS
      const ref4 = await draftJournalEntry(new Date(2024, 3, 1, 0, 0, 0, 0));
      await addJournalLine(ref4, 51000, 35000, 0);
      await addJournalLine(ref4, 11110, 0, 35000);
      await postJournalEntry(ref4, new Date(2024, 3, 1, 0, 0, 0, 0));

      // Operating Expenses
      const ref5 = await draftJournalEntry(new Date(2024, 5, 25, 0, 0, 0, 0));
      await addJournalLine(ref5, 61300, 15000, 0);
      await addJournalLine(ref5, 61100, 4000, 0);
      await addJournalLine(ref5, 11110, 0, 19000);
      await postJournalEntry(ref5, new Date(2024, 5, 25, 0, 0, 0, 0));

      // Other Expense (Interest)
      const ref6 = await draftJournalEntry(new Date(2024, 8, 15, 0, 0, 0, 0));
      await addJournalLine(ref6, 82100, 2000, 0);
      await addJournalLine(ref6, 11110, 0, 2000);
      await postJournalEntry(ref6, new Date(2024, 8, 15, 0, 0, 0, 0));

      // Check income statement view
      const incomeStatement = (await sql`
        SELECT * FROM income_statement WHERE fiscal_year_id = ${1} ORDER BY classification, category, account_code
      `).rows;

      // Verify classifications exist
      const classifications = [...new Set(incomeStatement.map(r => r.classification))];
      ok(classifications.includes('Revenue'), 'Should have Revenue classification');
      ok(classifications.includes('Cost of Goods Sold'), 'Should have COGS classification');
      ok(classifications.includes('Expenses'), 'Should have Expenses classification');

      // Verify specific amounts
      const salesRevenue = incomeStatement.find(r => r.account_code === 41000);
      equal(salesRevenue.amount, 80000, 'Sales Revenue should be 80000');
      equal(salesRevenue.category, 'Revenue', 'Sales should be in Revenue category');

      const salesReturns = incomeStatement.find(r => r.account_code === 42000);
      equal(salesReturns.amount, 5000, 'Sales Returns should be 5000');
      equal(salesReturns.category, 'Contra Revenue', 'Returns should be in Contra Revenue category');

      const cogs = incomeStatement.find(r => r.account_code === 51000);
      equal(cogs.amount, 35000, 'COGS should be 35000');

      const interestExpense = incomeStatement.find(r => r.account_code === 82100);
      equal(interestExpense.category, 'Other Expenses', 'Interest should be in Other Expenses');
    });

    it('shall calculate gross profit correctly', async function () {
      await setupCompleteChartOfAccounts();

      // Create fiscal year
      const beginTime = new Date(2024, 0, 1, 0, 0, 0, 0).getTime();
      const endTime = new Date(2024, 11, 31, 0, 0, 0, 0).getTime();

      await sql`INSERT INTO fiscal_years (begin_time, end_time, name) VALUES (${beginTime}, ${endTime}, 'FY2024')`;

      // Revenue: 100000
      const ref1 = await draftJournalEntry(new Date(2024, 3, 15, 0, 0, 0, 0));
      await addJournalLine(ref1, 11110, 100000, 0);
      await addJournalLine(ref1, 41000, 0, 100000);
      await postJournalEntry(ref1, new Date(2024, 3, 15, 0, 0, 0, 0));

      // Sales Returns: 8000
      const ref2 = await draftJournalEntry(new Date(2024, 4, 5, 0, 0, 0, 0));
      await addJournalLine(ref2, 42000, 8000, 0);
      await addJournalLine(ref2, 11110, 0, 8000);
      await postJournalEntry(ref2, new Date(2024, 4, 5, 0, 0, 0, 0));

      // COGS: 40000
      const ref3 = await draftJournalEntry(new Date(2024, 4, 10, 0, 0, 0, 0));
      await addJournalLine(ref3, 51000, 40000, 0);
      await addJournalLine(ref3, 11110, 0, 40000);
      await postJournalEntry(ref3, new Date(2024, 4, 10, 0, 0, 0, 0));

      // Get income statement
      const incomeStatement = (await sql`SELECT * FROM income_statement WHERE fiscal_year_id = 1`).rows;

      // Calculate Net Revenue
      const grossRevenue = incomeStatement
        .filter(r => r.category === 'Revenue')
        .reduce((sum, r) => sum + Number(r.amount), 0);

      const contraRevenue = incomeStatement
        .filter(r => r.category === 'Contra Revenue')
        .reduce((sum, r) => sum + Number(r.amount), 0);

      const netRevenue = grossRevenue - contraRevenue;
      equal(netRevenue, 92000, 'Net Revenue should be 92000 (100000 - 8000)');

      // Calculate Gross Profit
      const cogs = incomeStatement
        .filter(r => r.classification === 'Cost of Goods Sold')
        .reduce((sum, r) => sum + Number(r.amount), 0);

      const grossProfit = netRevenue - cogs;
      equal(grossProfit, 52000, 'Gross Profit should be 52000 (92000 - 40000)');
    });
  });

  describe('Report Generation with Fiscal Year Context', function () {
    it('shall generate reports linked to specific fiscal year', async function () {
      await setupCompleteChartOfAccounts();

      // Create and close fiscal year with transactions
      const beginTime = new Date(2024, 0, 1, 0, 0, 0, 0).getTime();
      const endTime = new Date(2024, 11, 31, 0, 0, 0, 0).getTime();

      await sql`INSERT INTO fiscal_years (begin_time, end_time, name) VALUES (${beginTime}, ${endTime}, 'FY2024')`;

      // Initial investment
      const ref1 = await draftJournalEntry(new Date(2024, 0, 2, 0, 0, 0, 0));
      await addJournalLine(ref1, 11110, 100000, 0);
      await addJournalLine(ref1, 31000, 0, 100000);
      await postJournalEntry(ref1, new Date(2024, 0, 2, 0, 0, 0, 0));

      // Revenue
      const ref2 = await draftJournalEntry(new Date(2024, 5, 15, 0, 0, 0, 0));
      await addJournalLine(ref2, 11110, 50000, 0);
      await addJournalLine(ref2, 41000, 0, 50000);
      await postJournalEntry(ref2, new Date(2024, 5, 15, 0, 0, 0, 0));

      // Generate fiscal year report
      const reportTime = new Date(2024, 11, 31, 0, 0, 0, 0).getTime();
      await sql`
        INSERT INTO balance_reports (report_time, report_type, fiscal_year_id, name, create_time)
        VALUES (${reportTime}, 'Annual', 1, 'FY2024 Year End Report', ${testTime})
      `;

      // Verify report is linked to fiscal year
      const report = (await sql`SELECT * FROM balance_reports WHERE fiscal_year_id = 1`).rows[0];

      ok(report, 'Report should be linked to fiscal year');
      equal(report.report_type, 'Annual', 'Report type should be Annual');
      equal(report.name, 'FY2024 Year End Report', 'Report name should match');
    });

    it('shall support multiple reports for same fiscal year', async function () {
      await setupCompleteChartOfAccounts();

      // Create fiscal year
      const beginTime = new Date(2024, 0, 1, 0, 0, 0, 0).getTime();
      const endTime = new Date(2024, 11, 31, 0, 0, 0, 0).getTime();

      await sql`INSERT INTO fiscal_years (begin_time, end_time, name) VALUES (${beginTime}, ${endTime}, 'FY2024')`;

      // Initial investment
      const ref1 = await draftJournalEntry(new Date(2024, 0, 2, 0, 0, 0, 0));
      await addJournalLine(ref1, 11110, 100000, 0);
      await addJournalLine(ref1, 31000, 0, 100000);
      await postJournalEntry(ref1, new Date(2024, 0, 2, 0, 0, 0, 0));

      // Q1 Report
      await sql`
        INSERT INTO balance_reports (report_time, report_type, fiscal_year_id, name, create_time)
        VALUES (${new Date(2024, 2, 31, 0, 0, 0, 0).getTime()}, 'Quarterly', 1, 'FY2024 Q1 Report', ${testTime})
      `;

      // Q2 transaction
      const ref2 = await draftJournalEntry(new Date(2024, 4, 15, 0, 0, 0, 0));
      await addJournalLine(ref2, 11110, 25000, 0);
      await addJournalLine(ref2, 41000, 0, 25000);
      await postJournalEntry(ref2, new Date(2024, 4, 15, 0, 0, 0, 0));

      // Q2 Report
      await sql`
        INSERT INTO balance_reports (report_time, report_type, fiscal_year_id, name, create_time)
        VALUES (${new Date(2024, 5, 30, 0, 0, 0, 0).getTime()}, 'Quarterly', 1, 'FY2024 Q2 Report', ${testTime})
      `;

      // More transactions
      const ref3 = await draftJournalEntry(new Date(2024, 8, 10, 0, 0, 0, 0));
      await addJournalLine(ref3, 11110, 30000, 0);
      await addJournalLine(ref3, 41000, 0, 30000);
      await postJournalEntry(ref3, new Date(2024, 8, 10, 0, 0, 0, 0));

      // Annual Report
      await sql`
        INSERT INTO balance_reports (report_time, report_type, fiscal_year_id, name, create_time)
        VALUES (${new Date(2024, 11, 31, 0, 0, 0, 0).getTime()}, 'Annual', 1, 'FY2024 Annual Report', ${testTime})
      `;

      // Verify multiple reports exist for same fiscal year
      const reports = (await sql`SELECT * FROM balance_reports WHERE fiscal_year_id = 1 ORDER BY report_time`).rows;

      equal(reports.length, 3, 'Should have 3 reports for FY2024');

      // Verify Q1 cash balance (100000)
      const q1TrialBalance = (await sql`
        SELECT debit, credit FROM trial_balance_lines WHERE balance_report_id = 1 AND account_code = 11110
      `).rows[0];
      equal(q1TrialBalance.debit, 100000, 'Q1 cash should be 100000');

      // Verify Q2 cash balance (125000)
      const q2TrialBalance = (await sql`
        SELECT debit, credit FROM trial_balance_lines WHERE balance_report_id = 2 AND account_code = 11110
      `).rows[0];
      equal(q2TrialBalance.debit, 125000, 'Q2 cash should be 125000');

      // Verify Annual cash balance (155000)
      const annualTrialBalance = (await sql`
        SELECT debit, credit FROM trial_balance_lines WHERE balance_report_id = 3 AND account_code = 11110
      `).rows[0];
      equal(annualTrialBalance.debit, 155000, 'Annual cash should be 155000');
    });
  });

  describe('Reports After Fiscal Year Closing', function () {
    it('shall generate correct reports after fiscal year closing', async function () {
      await setupCompleteChartOfAccounts();

      // Create fiscal year
      const beginTime = new Date(2024, 0, 1, 0, 0, 0, 0).getTime();
      const endTime = new Date(2024, 11, 31, 0, 0, 0, 0).getTime();

      await sql`INSERT INTO fiscal_years (begin_time, end_time, name) VALUES (${beginTime}, ${endTime}, 'FY2024')`;

      // Initial investment
      const ref1 = await draftJournalEntry(new Date(2024, 0, 2, 0, 0, 0, 0));
      await addJournalLine(ref1, 11110, 100000, 0);
      await addJournalLine(ref1, 31000, 0, 100000);
      await postJournalEntry(ref1, new Date(2024, 0, 2, 0, 0, 0, 0));

      // Revenue
      const ref2 = await draftJournalEntry(new Date(2024, 5, 15, 0, 0, 0, 0));
      await addJournalLine(ref2, 11110, 50000, 0);
      await addJournalLine(ref2, 41000, 0, 50000);
      await postJournalEntry(ref2, new Date(2024, 5, 15, 0, 0, 0, 0));

      // Expenses
      const ref3 = await draftJournalEntry(new Date(2024, 8, 20, 0, 0, 0, 0));
      await addJournalLine(ref3, 61300, 20000, 0);
      await addJournalLine(ref3, 11110, 0, 20000);
      await postJournalEntry(ref3, new Date(2024, 8, 20, 0, 0, 0, 0));

      // Net Income = 50000 - 20000 = 30000

      // Close fiscal year
      const postTime = new Date(2025, 0, 5, 0, 0, 0, 0).getTime();
      await sql`UPDATE fiscal_years SET post_time = ${postTime} WHERE begin_time = ${beginTime}`;

      // Generate post-closing report
      const reportTime = new Date(2025, 0, 10, 0, 0, 0, 0).getTime();
      await sql`
        INSERT INTO balance_reports (report_time, report_type, fiscal_year_id, name, create_time)
        VALUES (${reportTime}, 'Period End', 1, 'Post-Closing Report FY2024', ${testTime})
      `;

      // Verify trial balance after closing
      const trialBalance = (await sql`
        SELECT * FROM trial_balance WHERE balance_report_id = 1 ORDER BY account_code
      `).rows;

      // Revenue and Expense should be zero
      const salesLine = trialBalance.find(r => r.account_code === 41000);
      equal(Number(salesLine.debit) + Number(salesLine.credit), 0, 'Sales Revenue should be zero after closing');

      const salariesLine = trialBalance.find(r => r.account_code === 61300);
      equal(Number(salariesLine.debit) + Number(salariesLine.credit), 0, 'Salaries Expense should be zero after closing');

      // Retained Earnings should reflect net income
      const retainedEarningsLine = trialBalance.find(r => r.account_code === 32000);
      equal(retainedEarningsLine.credit, 30000, 'Retained Earnings should be 30000');

      // Verify balance sheet
      const balanceSheet = (await sql`
        SELECT * FROM balance_sheet WHERE balance_report_id = 1 ORDER BY classification, account_code
      `).rows;

      const retainedEarningsBS = balanceSheet.find(r => r.account_code === 32000);
      equal(retainedEarningsBS.amount, 30000, 'Balance Sheet Retained Earnings should be 30000');
    });
  });
});
