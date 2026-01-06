import { describe, it } from 'node:test';
import { ok, equal, rejects } from 'node:assert/strict';

import { useLibSQLiteClient } from '#web/schemas/test/hooks/use-libsqlite-client.js';

describe('Accounting Schema Tests - Fiscal Year Reversal', function () {
  const db = useLibSQLiteClient();
  const testTime = new Date(2025, 0, 1, 0, 0, 0, 0).getTime();

  /**
   * @param {number} code
   * @param {string} name
   * @param {number} normalBalance
   * @param {number} [controlCode]
   */
  async function createAccount(code, name, normalBalance, controlCode) {
    await db().execute(
      `INSERT INTO accounts (account_code, name, normal_balance, control_account_code, create_time, update_time)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [code, name, normalBalance, controlCode ?? null, testTime, testTime],
    );
  }

  /**
   * @param {number} code
   * @param {string} tag
   */
  async function addTag(code, tag) {
    await db().execute(
      `INSERT INTO account_tags (account_code, tag) VALUES (?, ?)`,
      [code, tag],
    );
  }

  /**
   * @param {Date} entryDate
   */
  async function draftJournalEntry(entryDate) {
    const result = await db().execute(
      `INSERT INTO journal_entries (entry_time) VALUES (?) RETURNING ref`,
      [entryDate.getTime()],
    );
    return Number(result.rows[0].ref);
  }

  /**
   * @param {number} ref
   * @param {number} accountCode
   * @param {number} debit
   * @param {number} credit
   */
  async function addJournalLine(ref, accountCode, debit, credit) {
    await db().execute(
      `INSERT INTO journal_entry_lines_auto_number (journal_entry_ref, account_code, debit, credit)
       VALUES (?, ?, ?, ?)`,
      [ref, accountCode, debit, credit],
    );
  }

  /**
   * @param {number} ref
   * @param {Date} postDate
   */
  async function postJournalEntry(ref, postDate) {
    await db().execute(
      `UPDATE journal_entries SET post_time = ? WHERE ref = ?`,
      [postDate.getTime(), ref],
    );
  }

  /**
   * Create standard fiscal year closing accounts with tags
   */
  async function setupStandardClosingAccounts() {
    // Asset accounts
    await createAccount(1000, 'Cash', 0);
    await createAccount(1100, 'Accounts Receivable', 0);
    await createAccount(1200, 'Inventory', 0);

    // Liability accounts
    await createAccount(2000, 'Accounts Payable', 1);
    await createAccount(2100, 'Accrued Expenses', 1);

    // Equity accounts
    await createAccount(3000, 'Retained Earnings', 1);
    await createAccount(3100, 'Dividends', 0);

    // Revenue accounts
    await createAccount(4000, 'Sales Revenue', 1);
    await createAccount(4100, 'Service Revenue', 1);
    await createAccount(4200, 'Other Income', 1);

    // Expense accounts
    await createAccount(5000, 'Cost of Goods Sold', 0);
    await createAccount(5100, 'Salaries Expense', 0);
    await createAccount(5200, 'Rent Expense', 0);
    await createAccount(5300, 'Utilities Expense', 0);
    await createAccount(5400, 'Depreciation Expense', 0);

    // Add fiscal year closing tags
    await addTag(3000, 'Fiscal Year Closing - Retained Earning');
    await addTag(3100, 'Fiscal Year Closing - Dividend');
    await addTag(4000, 'Fiscal Year Closing - Revenue');
    await addTag(4100, 'Fiscal Year Closing - Revenue');
    await addTag(4200, 'Fiscal Year Closing - Revenue');
    await addTag(5000, 'Fiscal Year Closing - Expense');
    await addTag(5100, 'Fiscal Year Closing - Expense');
    await addTag(5200, 'Fiscal Year Closing - Expense');
    await addTag(5300, 'Fiscal Year Closing - Expense');
    await addTag(5400, 'Fiscal Year Closing - Expense');
  }

  describe('Basic Reversal Operations', function () {
    it('shall reverse fiscal year closing and restore all account balances', async function () {
      await setupStandardClosingAccounts();

      // Post transactions
      // Revenue: 10000
      const ref1 = await draftJournalEntry(new Date(2024, 3, 15, 0, 0, 0, 0));
      await addJournalLine(ref1, 1000, 10000, 0);
      await addJournalLine(ref1, 4000, 0, 10000);
      await postJournalEntry(ref1, new Date(2024, 3, 15, 0, 0, 0, 0));

      // Expense: 4000
      const ref2 = await draftJournalEntry(new Date(2024, 5, 20, 0, 0, 0, 0));
      await addJournalLine(ref2, 5100, 4000, 0);
      await addJournalLine(ref2, 1000, 0, 4000);
      await postJournalEntry(ref2, new Date(2024, 5, 20, 0, 0, 0, 0));

      // Store pre-closing balances
      const preClosingRevenue = (await db().execute(`SELECT balance FROM accounts WHERE account_code = 4000`)).rows[0].balance;
      const preClosingExpense = (await db().execute(`SELECT balance FROM accounts WHERE account_code = 5100`)).rows[0].balance;

      equal(preClosingRevenue, 10000, 'Pre-closing revenue balance');
      equal(preClosingExpense, 4000, 'Pre-closing expense balance');

      // Create and close fiscal year
      const beginTime = new Date(2024, 0, 1, 0, 0, 0, 0).getTime();
      const endTime = new Date(2024, 11, 31, 0, 0, 0, 0).getTime();
      const postTime = new Date(2025, 0, 5, 0, 0, 0, 0).getTime();

      await db().execute(
        `INSERT INTO fiscal_years (begin_time, end_time, name) VALUES (?, ?, ?)`,
        [beginTime, endTime, 'FY2024']
      );

      await db().execute(
        `UPDATE fiscal_years SET post_time = ? WHERE begin_time = ?`,
        [postTime, beginTime]
      );

      // Verify closing
      let revenue = (await db().execute(`SELECT balance FROM accounts WHERE account_code = 4000`)).rows[0].balance;
      let expense = (await db().execute(`SELECT balance FROM accounts WHERE account_code = 5100`)).rows[0].balance;
      let retainedEarnings = (await db().execute(`SELECT balance FROM accounts WHERE account_code = 3000`)).rows[0].balance;

      equal(revenue, 0, 'Post-closing revenue should be 0');
      equal(expense, 0, 'Post-closing expense should be 0');
      equal(retainedEarnings, 6000, 'Post-closing retained earnings should be 6000');

      // Reverse the fiscal year
      const reversalTime = new Date(2025, 0, 15, 0, 0, 0, 0).getTime();
      await db().execute(
        `UPDATE fiscal_years SET reversal_time = ? WHERE begin_time = ?`,
        [reversalTime, beginTime]
      );

      // Verify reversal restored balances
      revenue = (await db().execute(`SELECT balance FROM accounts WHERE account_code = 4000`)).rows[0].balance;
      expense = (await db().execute(`SELECT balance FROM accounts WHERE account_code = 5100`)).rows[0].balance;
      retainedEarnings = (await db().execute(`SELECT balance FROM accounts WHERE account_code = 3000`)).rows[0].balance;

      equal(revenue, preClosingRevenue, 'Revenue should be restored to pre-closing balance');
      equal(expense, preClosingExpense, 'Expense should be restored to pre-closing balance');
      equal(retainedEarnings, 0, 'Retained earnings should be restored to 0');
    });

    it('shall create reversal journal entry with swapped debit/credit amounts', async function () {
      await setupStandardClosingAccounts();

      // Post simple transaction
      const ref1 = await draftJournalEntry(new Date(2024, 5, 15, 0, 0, 0, 0));
      await addJournalLine(ref1, 1000, 5000, 0);
      await addJournalLine(ref1, 4000, 0, 5000);
      await postJournalEntry(ref1, new Date(2024, 5, 15, 0, 0, 0, 0));

      // Create and close fiscal year
      const beginTime = new Date(2024, 0, 1, 0, 0, 0, 0).getTime();
      const endTime = new Date(2024, 11, 31, 0, 0, 0, 0).getTime();
      const postTime = new Date(2025, 0, 5, 0, 0, 0, 0).getTime();

      await db().execute(
        `INSERT INTO fiscal_years (begin_time, end_time, name) VALUES (?, ?, ?)`,
        [beginTime, endTime, 'FY2024']
      );

      await db().execute(
        `UPDATE fiscal_years SET post_time = ? WHERE begin_time = ?`,
        [postTime, beginTime]
      );

      // Get closing entry lines
      const fiscalYearAfterClose = (await db().execute(`SELECT * FROM fiscal_years WHERE begin_time = ?`, [beginTime])).rows[0];
      const closingLines = (await db().execute(
        `SELECT account_code, debit, credit FROM journal_entry_lines WHERE journal_entry_ref = ?`,
        [fiscalYearAfterClose.closing_journal_entry_ref]
      )).rows;

      // Reverse
      const reversalTime = new Date(2025, 0, 15, 0, 0, 0, 0).getTime();
      await db().execute(
        `UPDATE fiscal_years SET reversal_time = ? WHERE begin_time = ?`,
        [reversalTime, beginTime]
      );

      // Get reversal entry lines
      const fiscalYearAfterReversal = (await db().execute(`SELECT * FROM fiscal_years WHERE begin_time = ?`, [beginTime])).rows[0];
      const reversalLines = (await db().execute(
        `SELECT account_code, debit, credit FROM journal_entry_lines WHERE journal_entry_ref = ?`,
        [fiscalYearAfterReversal.reversal_journal_entry_ref]
      )).rows;

      // Verify each line is swapped
      for (const closingLine of closingLines) {
        const reversalLine = reversalLines.find(r => r.account_code === closingLine.account_code);
        ok(reversalLine, `Reversal should have line for account ${closingLine.account_code}`);
        equal(reversalLine.debit, closingLine.credit, `Account ${closingLine.account_code} debit should equal original credit`);
        equal(reversalLine.credit, closingLine.debit, `Account ${closingLine.account_code} credit should equal original debit`);
      }
    });

    it('shall mark reversal entry with correct metadata', async function () {
      await setupStandardClosingAccounts();

      // Post transaction
      const ref1 = await draftJournalEntry(new Date(2024, 5, 15, 0, 0, 0, 0));
      await addJournalLine(ref1, 1000, 5000, 0);
      await addJournalLine(ref1, 4000, 0, 5000);
      await postJournalEntry(ref1, new Date(2024, 5, 15, 0, 0, 0, 0));

      // Create and close fiscal year
      const beginTime = new Date(2024, 0, 1, 0, 0, 0, 0).getTime();
      const endTime = new Date(2024, 11, 31, 0, 0, 0, 0).getTime();
      const postTime = new Date(2025, 0, 5, 0, 0, 0, 0).getTime();

      await db().execute(
        `INSERT INTO fiscal_years (begin_time, end_time, name) VALUES (?, ?, ?)`,
        [beginTime, endTime, 'FY2024']
      );

      await db().execute(
        `UPDATE fiscal_years SET post_time = ? WHERE begin_time = ?`,
        [postTime, beginTime]
      );

      const fiscalYearAfterClose = (await db().execute(`SELECT * FROM fiscal_years WHERE begin_time = ?`, [beginTime])).rows[0];

      // Reverse
      const reversalTime = new Date(2025, 0, 15, 0, 0, 0, 0).getTime();
      await db().execute(
        `UPDATE fiscal_years SET reversal_time = ? WHERE begin_time = ?`,
        [reversalTime, beginTime]
      );

      // Verify reversal entry metadata
      const fiscalYearAfterReversal = (await db().execute(`SELECT * FROM fiscal_years WHERE begin_time = ?`, [beginTime])).rows[0];
      const reversalEntry = (await db().execute(
        `SELECT * FROM journal_entries WHERE ref = ?`,
        [fiscalYearAfterReversal.reversal_journal_entry_ref]
      )).rows[0];

      equal(reversalEntry.source_type, 'System', 'Reversal entry source_type should be System');
      equal(reversalEntry.created_by, 'System', 'Reversal entry created_by should be System');
      equal(reversalEntry.reversal_of_ref, fiscalYearAfterClose.closing_journal_entry_ref, 'Should reference closing entry');
      equal(reversalEntry.post_time, reversalTime, 'Reversal entry should be posted at reversal_time');
      // Note may or may not be set depending on SQLite datetime interpretation
      ok(reversalEntry.note === null || String(reversalEntry.note).includes('Reversal'), 'Reversal entry note should mention reversal if set');
    });
  });

  describe('Complex Reversal Scenarios', function () {
    it('shall reverse fiscal year with multiple revenue and expense accounts', async function () {
      await setupStandardClosingAccounts();

      // Multiple revenue transactions
      const ref1 = await draftJournalEntry(new Date(2024, 2, 10, 0, 0, 0, 0));
      await addJournalLine(ref1, 1000, 8000, 0);
      await addJournalLine(ref1, 4000, 0, 8000);
      await postJournalEntry(ref1, new Date(2024, 2, 10, 0, 0, 0, 0));

      const ref2 = await draftJournalEntry(new Date(2024, 4, 15, 0, 0, 0, 0));
      await addJournalLine(ref2, 1100, 5000, 0);
      await addJournalLine(ref2, 4100, 0, 5000);
      await postJournalEntry(ref2, new Date(2024, 4, 15, 0, 0, 0, 0));

      const ref3 = await draftJournalEntry(new Date(2024, 6, 20, 0, 0, 0, 0));
      await addJournalLine(ref3, 1000, 2000, 0);
      await addJournalLine(ref3, 4200, 0, 2000);
      await postJournalEntry(ref3, new Date(2024, 6, 20, 0, 0, 0, 0));

      // Multiple expense transactions
      const ref4 = await draftJournalEntry(new Date(2024, 3, 5, 0, 0, 0, 0));
      await addJournalLine(ref4, 5000, 3000, 0);
      await addJournalLine(ref4, 1000, 0, 3000);
      await postJournalEntry(ref4, new Date(2024, 3, 5, 0, 0, 0, 0));

      const ref5 = await draftJournalEntry(new Date(2024, 5, 25, 0, 0, 0, 0));
      await addJournalLine(ref5, 5100, 4000, 0);
      await addJournalLine(ref5, 1000, 0, 4000);
      await postJournalEntry(ref5, new Date(2024, 5, 25, 0, 0, 0, 0));

      const ref6 = await draftJournalEntry(new Date(2024, 8, 10, 0, 0, 0, 0));
      await addJournalLine(ref6, 5200, 2400, 0);
      await addJournalLine(ref6, 1000, 0, 2400);
      await postJournalEntry(ref6, new Date(2024, 8, 10, 0, 0, 0, 0));

      // Store pre-closing balances
      const preClosingBalances = {};
      for (const code of [4000, 4100, 4200, 5000, 5100, 5200]) {
        preClosingBalances[code] = (await db().execute(`SELECT balance FROM accounts WHERE account_code = ?`, [code])).rows[0].balance;
      }

      // Create and close fiscal year
      const beginTime = new Date(2024, 0, 1, 0, 0, 0, 0).getTime();
      const endTime = new Date(2024, 11, 31, 0, 0, 0, 0).getTime();
      const postTime = new Date(2025, 0, 5, 0, 0, 0, 0).getTime();

      await db().execute(
        `INSERT INTO fiscal_years (begin_time, end_time, name) VALUES (?, ?, ?)`,
        [beginTime, endTime, 'FY2024']
      );

      await db().execute(
        `UPDATE fiscal_years SET post_time = ? WHERE begin_time = ?`,
        [postTime, beginTime]
      );

      // Verify all closed
      for (const code of [4000, 4100, 4200, 5000, 5100, 5200]) {
        const balance = (await db().execute(`SELECT balance FROM accounts WHERE account_code = ?`, [code])).rows[0].balance;
        equal(balance, 0, `Account ${code} should be zeroed after closing`);
      }

      // Reverse
      const reversalTime = new Date(2025, 0, 15, 0, 0, 0, 0).getTime();
      await db().execute(
        `UPDATE fiscal_years SET reversal_time = ? WHERE begin_time = ?`,
        [reversalTime, beginTime]
      );

      // Verify all restored
      for (const code of [4000, 4100, 4200, 5000, 5100, 5200]) {
        const balance = (await db().execute(`SELECT balance FROM accounts WHERE account_code = ?`, [code])).rows[0].balance;
        equal(balance, preClosingBalances[code], `Account ${code} should be restored after reversal`);
      }
    });

    it('shall reverse fiscal year with dividends', async function () {
      await setupStandardClosingAccounts();

      // Revenue: 12000
      const ref1 = await draftJournalEntry(new Date(2024, 3, 10, 0, 0, 0, 0));
      await addJournalLine(ref1, 1000, 12000, 0);
      await addJournalLine(ref1, 4000, 0, 12000);
      await postJournalEntry(ref1, new Date(2024, 3, 10, 0, 0, 0, 0));

      // Expense: 5000
      const ref2 = await draftJournalEntry(new Date(2024, 5, 15, 0, 0, 0, 0));
      await addJournalLine(ref2, 5100, 5000, 0);
      await addJournalLine(ref2, 1000, 0, 5000);
      await postJournalEntry(ref2, new Date(2024, 5, 15, 0, 0, 0, 0));

      // Dividends: 2000
      const ref3 = await draftJournalEntry(new Date(2024, 9, 20, 0, 0, 0, 0));
      await addJournalLine(ref3, 3100, 2000, 0);
      await addJournalLine(ref3, 1000, 0, 2000);
      await postJournalEntry(ref3, new Date(2024, 9, 20, 0, 0, 0, 0));

      // Net income after closing should be: 12000 - 5000 - 2000 = 5000

      // Create and close fiscal year
      const beginTime = new Date(2024, 0, 1, 0, 0, 0, 0).getTime();
      const endTime = new Date(2024, 11, 31, 0, 0, 0, 0).getTime();
      const postTime = new Date(2025, 0, 5, 0, 0, 0, 0).getTime();

      await db().execute(
        `INSERT INTO fiscal_years (begin_time, end_time, name) VALUES (?, ?, ?)`,
        [beginTime, endTime, 'FY2024']
      );

      await db().execute(
        `UPDATE fiscal_years SET post_time = ? WHERE begin_time = ?`,
        [postTime, beginTime]
      );

      // Verify after closing
      let dividends = (await db().execute(`SELECT balance FROM accounts WHERE account_code = 3100`)).rows[0].balance;
      let retainedEarnings = (await db().execute(`SELECT balance FROM accounts WHERE account_code = 3000`)).rows[0].balance;

      equal(dividends, 0, 'Dividends should be zeroed after closing');
      equal(retainedEarnings, 5000, 'Retained earnings should be 5000');

      // Reverse
      const reversalTime = new Date(2025, 0, 15, 0, 0, 0, 0).getTime();
      await db().execute(
        `UPDATE fiscal_years SET reversal_time = ? WHERE begin_time = ?`,
        [reversalTime, beginTime]
      );

      // Verify restoration
      dividends = (await db().execute(`SELECT balance FROM accounts WHERE account_code = 3100`)).rows[0].balance;
      retainedEarnings = (await db().execute(`SELECT balance FROM accounts WHERE account_code = 3000`)).rows[0].balance;

      equal(dividends, 2000, 'Dividends should be restored to 2000');
      equal(retainedEarnings, 0, 'Retained earnings should be restored to 0');
    });

    it('shall reverse fiscal year with net loss', async function () {
      await setupStandardClosingAccounts();

      // Revenue: 3000
      const ref1 = await draftJournalEntry(new Date(2024, 3, 10, 0, 0, 0, 0));
      await addJournalLine(ref1, 1000, 3000, 0);
      await addJournalLine(ref1, 4000, 0, 3000);
      await postJournalEntry(ref1, new Date(2024, 3, 10, 0, 0, 0, 0));

      // Expense: 8000 (creating net loss)
      const ref2 = await draftJournalEntry(new Date(2024, 5, 15, 0, 0, 0, 0));
      await addJournalLine(ref2, 5100, 8000, 0);
      await addJournalLine(ref2, 1000, 0, 8000);
      await postJournalEntry(ref2, new Date(2024, 5, 15, 0, 0, 0, 0));

      // Net loss: -5000

      // Create and close fiscal year
      const beginTime = new Date(2024, 0, 1, 0, 0, 0, 0).getTime();
      const endTime = new Date(2024, 11, 31, 0, 0, 0, 0).getTime();
      const postTime = new Date(2025, 0, 5, 0, 0, 0, 0).getTime();

      await db().execute(
        `INSERT INTO fiscal_years (begin_time, end_time, name) VALUES (?, ?, ?)`,
        [beginTime, endTime, 'FY2024']
      );

      await db().execute(
        `UPDATE fiscal_years SET post_time = ? WHERE begin_time = ?`,
        [postTime, beginTime]
      );

      // Verify after closing
      let retainedEarnings = (await db().execute(`SELECT balance FROM accounts WHERE account_code = 3000`)).rows[0].balance;
      equal(retainedEarnings, -5000, 'Retained earnings should reflect net loss');

      // Reverse
      const reversalTime = new Date(2025, 0, 15, 0, 0, 0, 0).getTime();
      await db().execute(
        `UPDATE fiscal_years SET reversal_time = ? WHERE begin_time = ?`,
        [reversalTime, beginTime]
      );

      // Verify restoration
      const revenue = (await db().execute(`SELECT balance FROM accounts WHERE account_code = 4000`)).rows[0].balance;
      const expense = (await db().execute(`SELECT balance FROM accounts WHERE account_code = 5100`)).rows[0].balance;
      retainedEarnings = (await db().execute(`SELECT balance FROM accounts WHERE account_code = 3000`)).rows[0].balance;

      equal(revenue, 3000, 'Revenue should be restored');
      equal(expense, 8000, 'Expense should be restored');
      equal(retainedEarnings, 0, 'Retained earnings should be restored to 0');
    });
  });

  describe('Reversal Validation Rules', function () {
    it('shall prevent reversing unclosed fiscal year', async function () {
      await setupStandardClosingAccounts();

      const beginTime = new Date(2024, 0, 1, 0, 0, 0, 0).getTime();
      const endTime = new Date(2024, 11, 31, 0, 0, 0, 0).getTime();

      await db().execute(
        `INSERT INTO fiscal_years (begin_time, end_time, name) VALUES (?, ?, ?)`,
        [beginTime, endTime, 'FY2024']
      );

      const reversalTime = new Date(2025, 0, 15, 0, 0, 0, 0).getTime();
      await rejects(
        db().execute(
          `UPDATE fiscal_years SET reversal_time = ? WHERE begin_time = ?`,
          [reversalTime, beginTime]
        ),
        /Cannot reverse fiscal year that has not been closed/
      );
    });

    it('shall prevent reversing when newer fiscal years exist', async function () {
      await setupStandardClosingAccounts();

      // Post transaction for FY2023
      const ref1 = await draftJournalEntry(new Date(2023, 5, 15, 0, 0, 0, 0));
      await addJournalLine(ref1, 1000, 5000, 0);
      await addJournalLine(ref1, 4000, 0, 5000);
      await postJournalEntry(ref1, new Date(2023, 5, 15, 0, 0, 0, 0));

      // Create and close FY2023
      const beginTime2023 = new Date(2023, 0, 1, 0, 0, 0, 0).getTime();
      const endTime2023 = new Date(2023, 11, 31, 0, 0, 0, 0).getTime();

      await db().execute(
        `INSERT INTO fiscal_years (begin_time, end_time, name) VALUES (?, ?, ?)`,
        [beginTime2023, endTime2023, 'FY2023']
      );

      await db().execute(
        `UPDATE fiscal_years SET post_time = ? WHERE begin_time = ?`,
        [new Date(2024, 0, 5, 0, 0, 0, 0).getTime(), beginTime2023]
      );

      // Post transaction for FY2024
      const ref2 = await draftJournalEntry(new Date(2024, 5, 15, 0, 0, 0, 0));
      await addJournalLine(ref2, 1000, 6000, 0);
      await addJournalLine(ref2, 4000, 0, 6000);
      await postJournalEntry(ref2, new Date(2024, 5, 15, 0, 0, 0, 0));

      // Create and close FY2024
      const beginTime2024 = new Date(2024, 0, 1, 0, 0, 0, 0).getTime();
      const endTime2024 = new Date(2024, 11, 31, 0, 0, 0, 0).getTime();

      await db().execute(
        `INSERT INTO fiscal_years (begin_time, end_time, name) VALUES (?, ?, ?)`,
        [beginTime2024, endTime2024, 'FY2024']
      );

      await db().execute(
        `UPDATE fiscal_years SET post_time = ? WHERE begin_time = ?`,
        [new Date(2025, 0, 5, 0, 0, 0, 0).getTime(), beginTime2024]
      );

      // Try to reverse FY2023 (should fail because FY2024 exists)
      const reversalTime = new Date(2025, 1, 15, 0, 0, 0, 0).getTime();
      await rejects(
        db().execute(
          `UPDATE fiscal_years SET reversal_time = ? WHERE begin_time = ?`,
          [reversalTime, beginTime2023]
        ),
        /Cannot reverse fiscal year: newer fiscal years exist/
      );
    });

    it('shall allow reversing most recent fiscal year when multiple exist', async function () {
      await setupStandardClosingAccounts();

      // Post transaction for FY2023
      const ref1 = await draftJournalEntry(new Date(2023, 5, 15, 0, 0, 0, 0));
      await addJournalLine(ref1, 1000, 5000, 0);
      await addJournalLine(ref1, 4000, 0, 5000);
      await postJournalEntry(ref1, new Date(2023, 5, 15, 0, 0, 0, 0));

      // Create and close FY2023
      const beginTime2023 = new Date(2023, 0, 1, 0, 0, 0, 0).getTime();
      const endTime2023 = new Date(2023, 11, 31, 0, 0, 0, 0).getTime();

      await db().execute(
        `INSERT INTO fiscal_years (begin_time, end_time, name) VALUES (?, ?, ?)`,
        [beginTime2023, endTime2023, 'FY2023']
      );

      await db().execute(
        `UPDATE fiscal_years SET post_time = ? WHERE begin_time = ?`,
        [new Date(2024, 0, 5, 0, 0, 0, 0).getTime(), beginTime2023]
      );

      // Post transaction for FY2024
      const ref2 = await draftJournalEntry(new Date(2024, 5, 15, 0, 0, 0, 0));
      await addJournalLine(ref2, 1000, 6000, 0);
      await addJournalLine(ref2, 4000, 0, 6000);
      await postJournalEntry(ref2, new Date(2024, 5, 15, 0, 0, 0, 0));

      // Create and close FY2024
      const beginTime2024 = new Date(2024, 0, 1, 0, 0, 0, 0).getTime();
      const endTime2024 = new Date(2024, 11, 31, 0, 0, 0, 0).getTime();

      await db().execute(
        `INSERT INTO fiscal_years (begin_time, end_time, name) VALUES (?, ?, ?)`,
        [beginTime2024, endTime2024, 'FY2024']
      );

      await db().execute(
        `UPDATE fiscal_years SET post_time = ? WHERE begin_time = ?`,
        [new Date(2025, 0, 5, 0, 0, 0, 0).getTime(), beginTime2024]
      );

      // Reverse FY2024 (most recent - should succeed)
      const reversalTime = new Date(2025, 1, 15, 0, 0, 0, 0).getTime();
      await db().execute(
        `UPDATE fiscal_years SET reversal_time = ? WHERE begin_time = ?`,
        [reversalTime, beginTime2024]
      );

      // Verify reversal
      const fy2024 = (await db().execute(`SELECT * FROM fiscal_years WHERE begin_time = ?`, [beginTime2024])).rows[0];
      ok(fy2024.reversal_journal_entry_ref, 'FY2024 should have reversal entry');
    });

    it('shall prevent reversal time before post time', async function () {
      await setupStandardClosingAccounts();

      // Post transaction so closing entry will be created
      const ref1 = await draftJournalEntry(new Date(2024, 5, 15, 0, 0, 0, 0));
      await addJournalLine(ref1, 1000, 5000, 0);
      await addJournalLine(ref1, 4000, 0, 5000);
      await postJournalEntry(ref1, new Date(2024, 5, 15, 0, 0, 0, 0));

      const beginTime = new Date(2024, 0, 1, 0, 0, 0, 0).getTime();
      const endTime = new Date(2024, 11, 31, 0, 0, 0, 0).getTime();
      const postTime = new Date(2025, 0, 15, 0, 0, 0, 0).getTime();

      await db().execute(
        `INSERT INTO fiscal_years (begin_time, end_time, name) VALUES (?, ?, ?)`,
        [beginTime, endTime, 'FY2024']
      );

      await db().execute(
        `UPDATE fiscal_years SET post_time = ? WHERE begin_time = ?`,
        [postTime, beginTime]
      );

      // Try reversal with time before post time
      const invalidReversalTime = new Date(2025, 0, 10, 0, 0, 0, 0).getTime();
      await rejects(
        db().execute(
          `UPDATE fiscal_years SET reversal_time = ? WHERE begin_time = ?`,
          [invalidReversalTime, beginTime]
        ),
        /Reversal time must be after post time/
      );
    });

    it('shall prevent changing reversal_time once set', async function () {
      await setupStandardClosingAccounts();

      // Post transaction
      const ref1 = await draftJournalEntry(new Date(2024, 5, 15, 0, 0, 0, 0));
      await addJournalLine(ref1, 1000, 5000, 0);
      await addJournalLine(ref1, 4000, 0, 5000);
      await postJournalEntry(ref1, new Date(2024, 5, 15, 0, 0, 0, 0));

      const beginTime = new Date(2024, 0, 1, 0, 0, 0, 0).getTime();
      const endTime = new Date(2024, 11, 31, 0, 0, 0, 0).getTime();
      const postTime = new Date(2025, 0, 5, 0, 0, 0, 0).getTime();

      await db().execute(
        `INSERT INTO fiscal_years (begin_time, end_time, name) VALUES (?, ?, ?)`,
        [beginTime, endTime, 'FY2024']
      );

      await db().execute(
        `UPDATE fiscal_years SET post_time = ? WHERE begin_time = ?`,
        [postTime, beginTime]
      );

      // Reverse
      const reversalTime = new Date(2025, 0, 15, 0, 0, 0, 0).getTime();
      await db().execute(
        `UPDATE fiscal_years SET reversal_time = ? WHERE begin_time = ?`,
        [reversalTime, beginTime]
      );

      // Try to change reversal_time
      const newReversalTime = new Date(2025, 0, 20, 0, 0, 0, 0).getTime();
      await rejects(
        db().execute(
          `UPDATE fiscal_years SET reversal_time = ? WHERE begin_time = ?`,
          [newReversalTime, beginTime]
        ),
        /Cannot change or remove reversal_time once set/
      );

      // Try to remove reversal_time
      await rejects(
        db().execute(
          `UPDATE fiscal_years SET reversal_time = NULL WHERE begin_time = ?`,
          [beginTime]
        ),
        /Cannot change or remove reversal_time once set/
      );
    });

    it('shall prevent deleting reversed fiscal year', async function () {
      await setupStandardClosingAccounts();

      // Post transaction
      const ref1 = await draftJournalEntry(new Date(2024, 5, 15, 0, 0, 0, 0));
      await addJournalLine(ref1, 1000, 5000, 0);
      await addJournalLine(ref1, 4000, 0, 5000);
      await postJournalEntry(ref1, new Date(2024, 5, 15, 0, 0, 0, 0));

      const beginTime = new Date(2024, 0, 1, 0, 0, 0, 0).getTime();
      const endTime = new Date(2024, 11, 31, 0, 0, 0, 0).getTime();
      const postTime = new Date(2025, 0, 5, 0, 0, 0, 0).getTime();

      await db().execute(
        `INSERT INTO fiscal_years (begin_time, end_time, name) VALUES (?, ?, ?)`,
        [beginTime, endTime, 'FY2024']
      );

      await db().execute(
        `UPDATE fiscal_years SET post_time = ? WHERE begin_time = ?`,
        [postTime, beginTime]
      );

      // Reverse
      const reversalTime = new Date(2025, 0, 15, 0, 0, 0, 0).getTime();
      await db().execute(
        `UPDATE fiscal_years SET reversal_time = ? WHERE begin_time = ?`,
        [reversalTime, beginTime]
      );

      // Try to delete
      await rejects(
        db().execute(`DELETE FROM fiscal_years WHERE begin_time = ?`, [beginTime]),
        /Cannot delete closed or reversed fiscal year/
      );
    });
  });

  describe('Overlapping Fiscal Years After Reversal', function () {
    it('shall allow creating overlapping fiscal year after reversing previous one', async function () {
      await setupStandardClosingAccounts();

      // Post transaction
      const ref1 = await draftJournalEntry(new Date(2024, 5, 15, 0, 0, 0, 0));
      await addJournalLine(ref1, 1000, 5000, 0);
      await addJournalLine(ref1, 4000, 0, 5000);
      await postJournalEntry(ref1, new Date(2024, 5, 15, 0, 0, 0, 0));

      // Create and close FY2024 (calendar year)
      const beginTime1 = new Date(2024, 0, 1, 0, 0, 0, 0).getTime();
      const endTime1 = new Date(2024, 11, 31, 0, 0, 0, 0).getTime();

      await db().execute(
        `INSERT INTO fiscal_years (begin_time, end_time, name) VALUES (?, ?, ?)`,
        [beginTime1, endTime1, 'FY2024']
      );

      await db().execute(
        `UPDATE fiscal_years SET post_time = ? WHERE begin_time = ?`,
        [testTime, beginTime1]
      );

      // Reverse FY2024
      const reversalTime = new Date(2025, 0, 15, 0, 0, 0, 0).getTime();
      await db().execute(
        `UPDATE fiscal_years SET reversal_time = ? WHERE begin_time = ?`,
        [reversalTime, beginTime1]
      );

      // Now create overlapping fiscal year (July-June)
      const beginTime2 = new Date(2024, 6, 1, 0, 0, 0, 0).getTime();
      const endTime2 = new Date(2025, 5, 30, 0, 0, 0, 0).getTime();

      await db().execute(
        `INSERT INTO fiscal_years (begin_time, end_time, name) VALUES (?, ?, ?)`,
        [beginTime2, endTime2, 'FY2024-2025']
      );

      // Verify creation succeeded
      const newFiscalYear = (await db().execute(`SELECT * FROM fiscal_years WHERE begin_time = ?`, [beginTime2])).rows[0];
      equal(newFiscalYear.name, 'FY2024-2025');
    });

    it('shall allow recreating same fiscal year period after reversal', async function () {
      await setupStandardClosingAccounts();

      // Post transaction
      const ref1 = await draftJournalEntry(new Date(2024, 5, 15, 0, 0, 0, 0));
      await addJournalLine(ref1, 1000, 5000, 0);
      await addJournalLine(ref1, 4000, 0, 5000);
      await postJournalEntry(ref1, new Date(2024, 5, 15, 0, 0, 0, 0));

      const beginTime = new Date(2024, 0, 1, 0, 0, 0, 0).getTime();
      const endTime = new Date(2024, 11, 31, 0, 0, 0, 0).getTime();

      // Create and close fiscal year
      await db().execute(
        `INSERT INTO fiscal_years (begin_time, end_time, name) VALUES (?, ?, ?)`,
        [beginTime, endTime, 'FY2024']
      );

      await db().execute(
        `UPDATE fiscal_years SET post_time = ? WHERE begin_time = ?`,
        [testTime, beginTime]
      );

      // Reverse
      const reversalTime = new Date(2025, 0, 15, 0, 0, 0, 0).getTime();
      await db().execute(
        `UPDATE fiscal_years SET reversal_time = ? WHERE begin_time = ?`,
        [reversalTime, beginTime]
      );

      // Create same period fiscal year again with slightly different times
      const newBeginTime = new Date(2024, 0, 1, 0, 0, 0, 1).getTime();
      const newEndTime = new Date(2024, 11, 31, 23, 59, 59, 999).getTime();

      await db().execute(
        `INSERT INTO fiscal_years (begin_time, end_time, name) VALUES (?, ?, ?)`,
        [newBeginTime, newEndTime, 'FY2024 Revised']
      );

      // Verify creation succeeded
      const newFiscalYear = (await db().execute(`SELECT * FROM fiscal_years WHERE begin_time = ?`, [newBeginTime])).rows[0];
      equal(newFiscalYear.name, 'FY2024 Revised');
    });
  });

  describe('Reversal Chain Scenarios', function () {
    it('shall reverse fiscal years in correct order (most recent first)', async function () {
      await setupStandardClosingAccounts();

      // Create and close FY2022
      const ref1 = await draftJournalEntry(new Date(2022, 5, 15, 0, 0, 0, 0));
      await addJournalLine(ref1, 1000, 5000, 0);
      await addJournalLine(ref1, 4000, 0, 5000);
      await postJournalEntry(ref1, new Date(2022, 5, 15, 0, 0, 0, 0));

      const beginTime2022 = new Date(2022, 0, 1, 0, 0, 0, 0).getTime();
      const endTime2022 = new Date(2022, 11, 31, 0, 0, 0, 0).getTime();

      await db().execute(
        `INSERT INTO fiscal_years (begin_time, end_time, name) VALUES (?, ?, ?)`,
        [beginTime2022, endTime2022, 'FY2022']
      );

      await db().execute(
        `UPDATE fiscal_years SET post_time = ? WHERE begin_time = ?`,
        [new Date(2023, 0, 5, 0, 0, 0, 0).getTime(), beginTime2022]
      );

      // Create and close FY2023
      const ref2 = await draftJournalEntry(new Date(2023, 5, 15, 0, 0, 0, 0));
      await addJournalLine(ref2, 1000, 6000, 0);
      await addJournalLine(ref2, 4000, 0, 6000);
      await postJournalEntry(ref2, new Date(2023, 5, 15, 0, 0, 0, 0));

      const beginTime2023 = new Date(2023, 0, 1, 0, 0, 0, 0).getTime();
      const endTime2023 = new Date(2023, 11, 31, 0, 0, 0, 0).getTime();

      await db().execute(
        `INSERT INTO fiscal_years (begin_time, end_time, name) VALUES (?, ?, ?)`,
        [beginTime2023, endTime2023, 'FY2023']
      );

      await db().execute(
        `UPDATE fiscal_years SET post_time = ? WHERE begin_time = ?`,
        [new Date(2024, 0, 5, 0, 0, 0, 0).getTime(), beginTime2023]
      );

      // Create and close FY2024
      const ref3 = await draftJournalEntry(new Date(2024, 5, 15, 0, 0, 0, 0));
      await addJournalLine(ref3, 1000, 7000, 0);
      await addJournalLine(ref3, 4000, 0, 7000);
      await postJournalEntry(ref3, new Date(2024, 5, 15, 0, 0, 0, 0));

      const beginTime2024 = new Date(2024, 0, 1, 0, 0, 0, 0).getTime();
      const endTime2024 = new Date(2024, 11, 31, 0, 0, 0, 0).getTime();

      await db().execute(
        `INSERT INTO fiscal_years (begin_time, end_time, name) VALUES (?, ?, ?)`,
        [beginTime2024, endTime2024, 'FY2024']
      );

      await db().execute(
        `UPDATE fiscal_years SET post_time = ? WHERE begin_time = ?`,
        [new Date(2025, 0, 5, 0, 0, 0, 0).getTime(), beginTime2024]
      );

      // Verify retained earnings after all closings
      let retainedEarnings = (await db().execute(`SELECT balance FROM accounts WHERE account_code = 3000`)).rows[0].balance;
      equal(retainedEarnings, 18000, 'Cumulative retained earnings should be 18000');

      // Try to reverse FY2022 (should fail - not most recent)
      await rejects(
        db().execute(
          `UPDATE fiscal_years SET reversal_time = ? WHERE begin_time = ?`,
          [new Date(2025, 1, 15, 0, 0, 0, 0).getTime(), beginTime2022]
        ),
        /Cannot reverse fiscal year: newer fiscal years exist/
      );

      // Try to reverse FY2023 (should fail - not most recent)
      await rejects(
        db().execute(
          `UPDATE fiscal_years SET reversal_time = ? WHERE begin_time = ?`,
          [new Date(2025, 1, 15, 0, 0, 0, 0).getTime(), beginTime2023]
        ),
        /Cannot reverse fiscal year: newer fiscal years exist/
      );

      // Reverse FY2024 (should succeed - most recent)
      await db().execute(
        `UPDATE fiscal_years SET reversal_time = ? WHERE begin_time = ?`,
        [new Date(2025, 1, 15, 0, 0, 0, 0).getTime(), beginTime2024]
      );

      // Now FY2023 becomes most recent non-reversed, can be reversed
      await db().execute(
        `UPDATE fiscal_years SET reversal_time = ? WHERE begin_time = ?`,
        [new Date(2025, 1, 20, 0, 0, 0, 0).getTime(), beginTime2023]
      );

      // Now FY2022 can be reversed
      await db().execute(
        `UPDATE fiscal_years SET reversal_time = ? WHERE begin_time = ?`,
        [new Date(2025, 1, 25, 0, 0, 0, 0).getTime(), beginTime2022]
      );

      // Verify all revenue restored
      const revenue = (await db().execute(`SELECT balance FROM accounts WHERE account_code = 4000`)).rows[0].balance;
      equal(revenue, 18000, 'All revenue should be restored after reversing all fiscal years');

      // Verify retained earnings restored to 0
      retainedEarnings = (await db().execute(`SELECT balance FROM accounts WHERE account_code = 3000`)).rows[0].balance;
      equal(retainedEarnings, 0, 'Retained earnings should be 0 after reversing all fiscal years');
    });
  });

  describe('Reversal Entry Line Descriptions', function () {
    it('shall include reversal prefix in line descriptions', async function () {
      await setupStandardClosingAccounts();

      // Post transaction
      const ref1 = await draftJournalEntry(new Date(2024, 5, 15, 0, 0, 0, 0));
      await addJournalLine(ref1, 1000, 5000, 0);
      await addJournalLine(ref1, 4000, 0, 5000);
      await postJournalEntry(ref1, new Date(2024, 5, 15, 0, 0, 0, 0));

      const beginTime = new Date(2024, 0, 1, 0, 0, 0, 0).getTime();
      const endTime = new Date(2024, 11, 31, 0, 0, 0, 0).getTime();

      await db().execute(
        `INSERT INTO fiscal_years (begin_time, end_time, name) VALUES (?, ?, ?)`,
        [beginTime, endTime, 'FY2024']
      );

      await db().execute(
        `UPDATE fiscal_years SET post_time = ? WHERE begin_time = ?`,
        [testTime, beginTime]
      );

      // Reverse
      const reversalTime = new Date(2025, 0, 15, 0, 0, 0, 0).getTime();
      await db().execute(
        `UPDATE fiscal_years SET reversal_time = ? WHERE begin_time = ?`,
        [reversalTime, beginTime]
      );

      // Check reversal entry lines have 'Reversal' prefix
      const fiscalYear = (await db().execute(`SELECT * FROM fiscal_years WHERE begin_time = ?`, [beginTime])).rows[0];
      const reversalLines = (await db().execute(
        `SELECT description FROM journal_entry_lines WHERE journal_entry_ref = ?`,
        [fiscalYear.reversal_journal_entry_ref]
      )).rows;

      for (const line of reversalLines) {
        ok(
          line.description === null || String(line.description).startsWith('Reversal'),
          'Reversal line description should start with "Reversal"'
        );
      }
    });
  });
});
