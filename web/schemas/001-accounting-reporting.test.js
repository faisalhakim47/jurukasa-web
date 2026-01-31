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

  describe('Report Time Period Accuracy', function () {
    it('shall generate trial balance with only transactions up to report_time', async function () {
      await setupCompleteChartOfAccounts();

      // Post transactions on different dates
      // Jan 2: Initial investment
      const ref1 = await draftJournalEntry(new Date(2024, 0, 2, 0, 0, 0, 0));
      await addJournalLine(ref1, 11110, 100000, 0);
      await addJournalLine(ref1, 31000, 0, 100000);
      await postJournalEntry(ref1, new Date(2024, 0, 2, 0, 0, 0, 0));

      // Jan 15: Purchase inventory
      const ref2 = await draftJournalEntry(new Date(2024, 0, 15, 0, 0, 0, 0));
      await addJournalLine(ref2, 11310, 30000, 0);
      await addJournalLine(ref2, 11110, 0, 30000);
      await postJournalEntry(ref2, new Date(2024, 0, 15, 0, 0, 0, 0));

      // Feb 10: Sales revenue
      const ref3 = await draftJournalEntry(new Date(2024, 1, 10, 0, 0, 0, 0));
      await addJournalLine(ref3, 11110, 50000, 0);
      await addJournalLine(ref3, 41000, 0, 50000);
      await postJournalEntry(ref3, new Date(2024, 1, 10, 0, 0, 0, 0));

      // Generate report as of Jan 10 (should only include Jan 2 transaction)
      const jan10Report = new Date(2024, 0, 10, 0, 0, 0, 0).getTime();
      await sql`
        INSERT INTO balance_reports (report_time, report_type, name, create_time)
        VALUES (${jan10Report}, 'Ad Hoc', 'Jan 10 2024 Report', ${testTime})
      `;

      // Verify Jan 10 report only has initial investment
      const jan10TrialBalance = (await sql`
        SELECT * FROM trial_balance_lines WHERE balance_report_id = 1 ORDER BY account_code
      `).rows;

      const jan10Cash = jan10TrialBalance.find(r => r.account_code === 11110);
      equal(jan10Cash.debit, 100000, 'Jan 10 report: Cash should be 100000 (only initial investment)');
      equal(jan10Cash.credit, 0, 'Jan 10 report: Cash credit should be 0');

      const jan10Inventory = jan10TrialBalance.find(r => r.account_code === 11310);
      ok(!jan10Inventory, 'Jan 10 report: Inventory should not exist (transaction on Jan 15)');

      const jan10Equity = jan10TrialBalance.find(r => r.account_code === 31000);
      equal(jan10Equity.credit, 100000, 'Jan 10 report: Equity should be 100000');

      // Generate report as of Jan 20 (should include Jan 2 and Jan 15 transactions)
      const jan20Report = new Date(2024, 0, 20, 0, 0, 0, 0).getTime();
      await sql`
        INSERT INTO balance_reports (report_time, report_type, name, create_time)
        VALUES (${jan20Report}, 'Ad Hoc', 'Jan 20 2024 Report', ${testTime})
      `;

      // Verify Jan 20 report includes inventory purchase
      const jan20TrialBalance = (await sql`
        SELECT * FROM trial_balance_lines WHERE balance_report_id = 2 ORDER BY account_code
      `).rows;

      const jan20Cash = jan20TrialBalance.find(r => r.account_code === 11110);
      equal(jan20Cash.debit, 70000, 'Jan 20 report: Cash should be 70000 (100000 - 30000)');

      const jan20Inventory = jan20TrialBalance.find(r => r.account_code === 11310);
      equal(jan20Inventory.debit, 30000, 'Jan 20 report: Inventory should be 30000');

      // Verify Jan 20 report does NOT include Feb 10 revenue
      const jan20Revenue = jan20TrialBalance.find(r => r.account_code === 41000);
      ok(!jan20Revenue, 'Jan 20 report: Revenue should not exist (transaction on Feb 10)');
    });

    it('shall generate balance sheet with only transactions up to report_time', async function () {
      await setupCompleteChartOfAccounts();

      // Post transactions on different dates
      // Jan 5: Initial investment
      const ref1 = await draftJournalEntry(new Date(2024, 0, 5, 0, 0, 0, 0));
      await addJournalLine(ref1, 11110, 200000, 0);
      await addJournalLine(ref1, 31000, 0, 200000);
      await postJournalEntry(ref1, new Date(2024, 0, 5, 0, 0, 0, 0));

      // Feb 1: Purchase equipment (non-current asset)
      const ref2 = await draftJournalEntry(new Date(2024, 1, 1, 0, 0, 0, 0));
      await addJournalLine(ref2, 12110, 50000, 0);
      await addJournalLine(ref2, 11110, 0, 50000);
      await postJournalEntry(ref2, new Date(2024, 1, 1, 0, 0, 0, 0));

      // Mar 15: Take loan
      const ref3 = await draftJournalEntry(new Date(2024, 2, 15, 0, 0, 0, 0));
      await addJournalLine(ref3, 11110, 30000, 0);
      await addJournalLine(ref3, 21100, 0, 30000);
      await postJournalEntry(ref3, new Date(2024, 2, 15, 0, 0, 0, 0));

      // Generate report as of Jan 31 (before equipment purchase)
      const jan31Report = new Date(2024, 0, 31, 0, 0, 0, 0).getTime();
      await sql`
        INSERT INTO balance_reports (report_time, report_type, name, create_time)
        VALUES (${jan31Report}, 'Ad Hoc', 'Jan 31 2024 Balance Sheet', ${testTime})
      `;

      // Verify Jan 31 balance sheet
      const jan31BalanceSheet = (await sql`
        SELECT * FROM balance_sheet_lines WHERE balance_report_id = 1 ORDER BY classification, account_code
      `).rows;

      const jan31Cash = jan31BalanceSheet.find(r => r.account_code === 11110);
      equal(jan31Cash.amount, 200000, 'Jan 31: Cash should be 200000');
      equal(jan31Cash.classification, 'Assets', 'Jan 31: Cash should be Assets');
      equal(jan31Cash.category, 'Current Assets', 'Jan 31: Cash should be Current Assets');

      const jan31Equipment = jan31BalanceSheet.find(r => r.account_code === 12110);
      ok(!jan31Equipment, 'Jan 31: Equipment should not exist (purchased Feb 1)');

      const jan31Payable = jan31BalanceSheet.find(r => r.account_code === 21100);
      ok(!jan31Payable, 'Jan 31: Accounts Payable should not exist (loan taken Mar 15)');

      // Generate report as of Feb 28 (after equipment, before loan)
      const feb28Report = new Date(2024, 1, 28, 0, 0, 0, 0).getTime();
      await sql`
        INSERT INTO balance_reports (report_time, report_type, name, create_time)
        VALUES (${feb28Report}, 'Ad Hoc', 'Feb 28 2024 Balance Sheet', ${testTime})
      `;

      // Verify Feb 28 balance sheet
      const feb28BalanceSheet = (await sql`
        SELECT * FROM balance_sheet_lines WHERE balance_report_id = 2 ORDER BY classification, account_code
      `).rows;

      const feb28Cash = feb28BalanceSheet.find(r => r.account_code === 11110);
      equal(feb28Cash.amount, 150000, 'Feb 28: Cash should be 150000 (200000 - 50000)');

      const feb28Equipment = feb28BalanceSheet.find(r => r.account_code === 12110);
      equal(feb28Equipment.amount, 50000, 'Feb 28: Equipment should be 50000');
      equal(feb28Equipment.classification, 'Assets', 'Feb 28: Equipment should be Assets');
      equal(feb28Equipment.category, 'Non-Current Assets', 'Feb 28: Equipment should be Non-Current Assets');

      const feb28Payable = feb28BalanceSheet.find(r => r.account_code === 21100);
      ok(!feb28Payable, 'Feb 28: Accounts Payable should not exist (loan taken Mar 15)');

      // Calculate totals
      const feb28TotalAssets = feb28BalanceSheet
        .filter(r => r.classification === 'Assets')
        .reduce((sum, r) => sum + Number(r.amount), 0);
      const feb28TotalEquity = feb28BalanceSheet
        .filter(r => r.classification === 'Equity')
        .reduce((sum, r) => sum + Number(r.amount), 0);

      equal(feb28TotalAssets, 200000, 'Feb 28: Total Assets should be 200000');
      equal(feb28TotalEquity, 200000, 'Feb 28: Total Equity should be 200000');
    });

    it('shall handle exact date boundary correctly', async function () {
      await setupCompleteChartOfAccounts();

      // Post transaction exactly at report time boundary
      const ref1 = await draftJournalEntry(new Date(2024, 0, 15, 12, 0, 0, 0)); // Jan 15, noon
      await addJournalLine(ref1, 11110, 100000, 0);
      await addJournalLine(ref1, 31000, 0, 100000);
      await postJournalEntry(ref1, new Date(2024, 0, 15, 12, 0, 0, 0));

      // Generate report at exact same time (should include the transaction)
      const exactTimeReport = new Date(2024, 0, 15, 12, 0, 0, 0).getTime();
      await sql`
        INSERT INTO balance_reports (report_time, report_type, name, create_time)
        VALUES (${exactTimeReport}, 'Ad Hoc', 'Exact Time Report', ${testTime})
      `;

      // Verify transaction IS included (entry_time <= report_time)
      const exactTimeTrialBalance = (await sql`
        SELECT * FROM trial_balance_lines WHERE balance_report_id = 1
      `).rows;

      const exactTimeCash = exactTimeTrialBalance.find(r => r.account_code === 11110);
      equal(exactTimeCash.debit, 100000, 'Transaction at exact report_time should be included');

      // Generate report 1 millisecond before transaction time
      const beforeTimeReport = new Date(2024, 0, 15, 11, 59, 59, 999).getTime();
      await sql`
        INSERT INTO balance_reports (report_time, report_type, name, create_time)
        VALUES (${beforeTimeReport}, 'Ad Hoc', 'Before Time Report', ${testTime})
      `;

      // Verify transaction is NOT included
      const beforeTimeTrialBalance = (await sql`
        SELECT * FROM trial_balance_lines WHERE balance_report_id = 2
      `).rows;

      const beforeTimeCash = beforeTimeTrialBalance.find(r => r.account_code === 11110);
      ok(!beforeTimeCash, 'Transaction before report_time should not be included');
    });

    it('shall show empty trial balance when no transactions before report_time', async function () {
      await setupCompleteChartOfAccounts();

      // Post transactions on Feb 1
      const ref1 = await draftJournalEntry(new Date(2024, 1, 1, 0, 0, 0, 0));
      await addJournalLine(ref1, 11110, 100000, 0);
      await addJournalLine(ref1, 31000, 0, 100000);
      await postJournalEntry(ref1, new Date(2024, 1, 1, 0, 0, 0, 0));

      // Generate report on Jan 1 (before any transactions)
      const jan1Report = new Date(2024, 0, 1, 0, 0, 0, 0).getTime();
      await sql`
        INSERT INTO balance_reports (report_time, report_type, name, create_time)
        VALUES (${jan1Report}, 'Ad Hoc', 'Jan 1 2024 Report', ${testTime})
      `;

      // Verify trial balance has no lines (all accounts have zero balance)
      const jan1TrialBalance = (await sql`
        SELECT * FROM trial_balance_lines WHERE balance_report_id = 1
      `).rows;

      equal(jan1TrialBalance.length, 0, 'Trial balance should be empty when no transactions before report_time');

      // Verify balance sheet also has no lines
      const jan1BalanceSheet = (await sql`
        SELECT * FROM balance_sheet_lines WHERE balance_report_id = 1
      `).rows;

      equal(jan1BalanceSheet.length, 0, 'Balance sheet should be empty when no transactions before report_time');
    });

    it('shall generate sequential reports showing balance progression', async function () {
      await setupCompleteChartOfAccounts();

      // Post multiple transactions over time
      // Jan 1: Initial capital
      const ref1 = await draftJournalEntry(new Date(2024, 0, 1, 0, 0, 0, 0));
      await addJournalLine(ref1, 11110, 50000, 0);
      await addJournalLine(ref1, 31000, 0, 50000);
      await postJournalEntry(ref1, new Date(2024, 0, 1, 0, 0, 0, 0));

      // Feb 1: More investment
      const ref2 = await draftJournalEntry(new Date(2024, 1, 1, 0, 0, 0, 0));
      await addJournalLine(ref2, 11110, 30000, 0);
      await addJournalLine(ref2, 31000, 0, 30000);
      await postJournalEntry(ref2, new Date(2024, 1, 1, 0, 0, 0, 0));

      // Mar 1: Even more investment
      const ref3 = await draftJournalEntry(new Date(2024, 2, 1, 0, 0, 0, 0));
      await addJournalLine(ref3, 11110, 20000, 0);
      await addJournalLine(ref3, 31000, 0, 20000);
      await postJournalEntry(ref3, new Date(2024, 2, 1, 0, 0, 0, 0));

      // Generate 4 reports at different points
      const reportTimes = [
        new Date(2024, 0, 15, 0, 0, 0, 0).getTime(), // After Jan 1 only
        new Date(2024, 1, 15, 0, 0, 0, 0).getTime(), // After Jan 1 and Feb 1
        new Date(2024, 2, 15, 0, 0, 0, 0).getTime(), // After all transactions
        new Date(2024, 5, 30, 0, 0, 0, 0).getTime(), // Long after all transactions
      ];

      for (let i = 0; i < reportTimes.length; i++) {
        await sql`
          INSERT INTO balance_reports (report_time, report_type, name, create_time)
          VALUES (${reportTimes[i]}, 'Ad Hoc', ${`Report ${i + 1}`}, ${testTime})
        `;
      }

      // Verify progressive balances
      const expectedCashBalances = [50000, 80000, 100000, 100000];
      const expectedEquityBalances = [50000, 80000, 100000, 100000];

      for (let i = 0; i < 4; i++) {
        const reportId = i + 1;

        const trialBalance = (await sql`
          SELECT * FROM trial_balance_lines WHERE balance_report_id = ${reportId}
        `).rows;

        const cashLine = trialBalance.find(r => r.account_code === 11110);
        equal(cashLine.debit, expectedCashBalances[i], `Report ${i + 1}: Cash should be ${expectedCashBalances[i]}`);

        const equityLine = trialBalance.find(r => r.account_code === 31000);
        equal(equityLine.credit, expectedEquityBalances[i], `Report ${i + 1}: Equity should be ${expectedEquityBalances[i]}`);

        // Verify trial balance always balances
        const totalDebits = trialBalance.reduce((sum, row) => sum + Number(row.debit), 0);
        const totalCredits = trialBalance.reduce((sum, row) => sum + Number(row.credit), 0);
        equal(totalDebits, totalCredits, `Report ${i + 1}: Trial balance should balance`);
      }
    });

    it('shall handle reports with mixed transaction types and dates correctly', async function () {
      await setupCompleteChartOfAccounts();

      // Create complex transaction history
      // Jan 1: Initial setup - Capital and Loan
      const ref1 = await draftJournalEntry(new Date(2024, 0, 1, 0, 0, 0, 0));
      await addJournalLine(ref1, 11110, 100000, 0);
      await addJournalLine(ref1, 31000, 0, 50000);
      await addJournalLine(ref1, 21100, 0, 50000);
      await postJournalEntry(ref1, new Date(2024, 0, 1, 0, 0, 0, 0));

      // Jan 15: Purchase inventory
      const ref2 = await draftJournalEntry(new Date(2024, 0, 15, 0, 0, 0, 0));
      await addJournalLine(ref2, 11310, 40000, 0);
      await addJournalLine(ref2, 11110, 0, 40000);
      await postJournalEntry(ref2, new Date(2024, 0, 15, 0, 0, 0, 0));

      // Feb 1: Equipment purchase
      const ref3 = await draftJournalEntry(new Date(2024, 1, 1, 0, 0, 0, 0));
      await addJournalLine(ref3, 12110, 20000, 0);
      await addJournalLine(ref3, 11110, 0, 20000);
      await postJournalEntry(ref3, new Date(2024, 1, 1, 0, 0, 0, 0));

      // Feb 20: Sales
      const ref4 = await draftJournalEntry(new Date(2024, 1, 20, 0, 0, 0, 0));
      await addJournalLine(ref4, 11110, 60000, 0);
      await addJournalLine(ref4, 41000, 0, 60000);
      await postJournalEntry(ref4, new Date(2024, 1, 20, 0, 0, 0, 0));

      // Feb 20: COGS
      const ref5 = await draftJournalEntry(new Date(2024, 1, 20, 0, 0, 0, 0));
      await addJournalLine(ref5, 51000, 25000, 0);
      await addJournalLine(ref5, 11310, 0, 25000);
      await postJournalEntry(ref5, new Date(2024, 1, 20, 0, 0, 0, 0));

      // Mar 10: Pay expenses
      const ref6 = await draftJournalEntry(new Date(2024, 2, 10, 0, 0, 0, 0));
      await addJournalLine(ref6, 61300, 8000, 0);
      await addJournalLine(ref6, 61100, 2000, 0);
      await addJournalLine(ref6, 11110, 0, 10000);
      await postJournalEntry(ref6, new Date(2024, 2, 10, 0, 0, 0, 0));

      // Generate report as of Feb 15 (mid-month)
      const feb15Report = new Date(2024, 1, 15, 0, 0, 0, 0).getTime();
      await sql`
        INSERT INTO balance_reports (report_time, report_type, name, create_time)
        VALUES (${feb15Report}, 'Ad Hoc', 'Feb 15 2024 Report', ${testTime})
      `;

      // Verify Feb 15 balances
      const trialBalance = (await sql`
        SELECT * FROM trial_balance_lines WHERE balance_report_id = 1 ORDER BY account_code
      `).rows;

      // Cash: 100000 - 40000 - 20000 = 40000
      const cashLine = trialBalance.find(r => r.account_code === 11110);
      equal(cashLine.debit, 40000, 'Feb 15: Cash should be 40000');

      // Inventory: 40000
      const inventoryLine = trialBalance.find(r => r.account_code === 11310);
      equal(inventoryLine.debit, 40000, 'Feb 15: Inventory should be 40000');

      // Equipment: 20000
      const equipmentLine = trialBalance.find(r => r.account_code === 12110);
      equal(equipmentLine.debit, 20000, 'Feb 15: Equipment should be 20000');

      // AP: 50000
      const payableLine = trialBalance.find(r => r.account_code === 21100);
      equal(payableLine.credit, 50000, 'Feb 15: AP should be 50000');

      // Equity: 50000
      const equityLine = trialBalance.find(r => r.account_code === 31000);
      equal(equityLine.credit, 50000, 'Feb 15: Equity should be 50000');

      // Revenue should NOT be included (transaction on Feb 20)
      const revenueLine = trialBalance.find(r => r.account_code === 41000);
      ok(!revenueLine, 'Feb 15: Revenue should not be included (transaction on Feb 20)');

      // COGS should NOT be included
      const cogsLine = trialBalance.find(r => r.account_code === 51000);
      ok(!cogsLine, 'Feb 15: COGS should not be included (transaction on Feb 20)');

      // Expenses should NOT be included
      const salariesLine = trialBalance.find(r => r.account_code === 61300);
      ok(!salariesLine, 'Feb 15: Salaries should not be included (transaction on Mar 10)');

      // Verify accounting equation via balance sheet
      const balanceSheet = (await sql`
        SELECT * FROM balance_sheet_lines WHERE balance_report_id = 1
      `).rows;

      const totalAssets = balanceSheet
        .filter(r => r.classification === 'Assets')
        .reduce((sum, r) => sum + Number(r.amount), 0);
      const totalLiabilities = balanceSheet
        .filter(r => r.classification === 'Liabilities')
        .reduce((sum, r) => sum + Number(r.amount), 0);
      const totalEquity = balanceSheet
        .filter(r => r.classification === 'Equity')
        .reduce((sum, r) => sum + Number(r.amount), 0);

      equal(totalAssets, 100000, 'Feb 15: Total Assets should be 100000');
      equal(totalLiabilities, 50000, 'Feb 15: Total Liabilities should be 50000');
      equal(totalEquity, 50000, 'Feb 15: Total Equity should be 50000');
      equal(totalAssets, totalLiabilities + totalEquity, 'Feb 15: Accounting equation should balance');
    });

    it('shall handle negative balances correctly in period-specific reports', async function () {
      await setupCompleteChartOfAccounts();

      // Create scenario with negative balance on specific date
      // Jan 1: Start with capital
      const ref1 = await draftJournalEntry(new Date(2024, 0, 1, 0, 0, 0, 0));
      await addJournalLine(ref1, 11110, 10000, 0);
      await addJournalLine(ref1, 31000, 0, 10000);
      await postJournalEntry(ref1, new Date(2024, 0, 1, 0, 0, 0, 0));

      // Jan 15: Large expense creates negative cash
      const ref2 = await draftJournalEntry(new Date(2024, 0, 15, 0, 0, 0, 0));
      await addJournalLine(ref2, 61300, 15000, 0);
      await addJournalLine(ref2, 11110, 0, 15000);
      await postJournalEntry(ref2, new Date(2024, 0, 15, 0, 0, 0, 0));

      // Feb 1: More capital injection fixes negative
      const ref3 = await draftJournalEntry(new Date(2024, 1, 1, 0, 0, 0, 0));
      await addJournalLine(ref3, 11110, 20000, 0);
      await addJournalLine(ref3, 31000, 0, 20000);
      await postJournalEntry(ref3, new Date(2024, 1, 1, 0, 0, 0, 0));

      // Generate report as of Jan 20 (during negative period)
      const jan20Report = new Date(2024, 0, 20, 0, 0, 0, 0).getTime();
      await sql`
        INSERT INTO balance_reports (report_time, report_type, name, create_time)
        VALUES (${jan20Report}, 'Ad Hoc', 'Jan 20 2024 Report', ${testTime})
      `;

      // Verify negative balance shown as credit for debit-normal account
      const jan20TrialBalance = (await sql`
        SELECT * FROM trial_balance_lines WHERE balance_report_id = 1
      `).rows;

      const jan20Cash = jan20TrialBalance.find(r => r.account_code === 11110);
      equal(jan20Cash.debit, 0, 'Jan 20: Negative cash should show 0 debit');
      equal(jan20Cash.credit, 5000, 'Jan 20: Negative cash should show 5000 credit (overdraft)');

      // Generate report as of Feb 15 (after capital injection)
      const feb15Report = new Date(2024, 1, 15, 0, 0, 0, 0).getTime();
      await sql`
        INSERT INTO balance_reports (report_time, report_type, name, create_time)
        VALUES (${feb15Report}, 'Ad Hoc', 'Feb 15 2024 Report', ${testTime})
      `;

      // Verify positive balance restored
      const feb15TrialBalance = (await sql`
        SELECT * FROM trial_balance_lines WHERE balance_report_id = 2
      `).rows;

      const feb15Cash = feb15TrialBalance.find(r => r.account_code === 11110);
      equal(feb15Cash.debit, 15000, 'Feb 15: Cash should be positive 15000');
      equal(feb15Cash.credit, 0, 'Feb 15: Cash credit should be 0');
    });
  });
});
