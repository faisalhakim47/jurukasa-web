import { describe, it } from 'node:test';
import { deepEqual, equal, rejects } from 'node:assert/strict';

import { useSql } from '#test/nodejs/hooks/use-sql.js';

describe('Cash Flow Statement - Direct Method', function () {
  const sql = useSql();

  const testTime = new Date(2025, 0, 1, 0, 0, 0, 0).getTime();
  const fy2025Begin = new Date(2025, 0, 1, 0, 0, 0, 0).getTime();
  const fy2025End = new Date(2026, 0, 1, 0, 0, 0, 0).getTime();

  let nextJeRef = 1000;
  function genJeRef() { return nextJeRef++; }

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

  /**
   * @param {Date} entryDate
   */
  async function draftJournalEntry(entryDate) {
    const ref = genJeRef();
    await sql`
      INSERT INTO journal_entries (ref, entry_time) VALUES (${ref}, ${entryDate.getTime()})
    `;
    return ref;
  }

  /**
   * @param {number} ref
   * @param {Date} postDate
   */
  async function postJournalEntry(ref, postDate) {
    await sql`UPDATE journal_entries SET post_time = ${postDate.getTime()} WHERE ref = ${ref}`;
  }

  async function setupAccounts() {
    // Cash accounts (debit-normal)
    await createAccount(11110, 'Kas (Cash)', 0);
    await addTag(11110, 'Cash Flow - Cash Equivalents');
    await createAccount(11120, 'Bank BCA', 0);
    await addTag(11120, 'Cash Flow - Cash Equivalents');

    // Non-cash accounts (various)
    await createAccount(12000, 'Accounts Receivable', 0);
    await createAccount(20000, 'Accounts Payable', 1);
    await createAccount(41000, 'Sales Revenue', 1);
    await createAccount(50000, 'Cost of Goods Sold', 0);
    await createAccount(61000, 'Rent Expense', 0);
    await createAccount(12100, 'Equipment', 0);
    await createAccount(21000, 'Bank Loan', 1);
    await createAccount(30000, 'Owner Capital', 1);
    await createAccount(33000, 'Dividends', 0);
  }

  describe('Classification Validation', function () {
    it('shall require cashflow columns for cash equivalent accounts', async function () {
      await setupAccounts();
      const ref = await draftJournalEntry(new Date(2025, 0, 15));

      // Cash account without cashflow columns should fail
      await rejects(
        sql`INSERT INTO journal_entry_lines_auto_number
          (journal_entry_ref, account_code, debit, credit, note)
          VALUES (${ref}, ${11110}, ${10000}, ${0}, ${'Cash receipt'})`,
        { message: /cashflow_activity/ },
      );
    });

    it('shall reject cashflow columns on non-cash accounts', async function () {
      await setupAccounts();
      const ref = await draftJournalEntry(new Date(2025, 0, 15));

      // Non-cash account with cashflow columns should fail
      await rejects(
        sql`INSERT INTO journal_entry_lines_auto_number
          (journal_entry_ref, account_code, debit, credit, note, cashflow_activity, cashflow_category)
          VALUES (${ref}, ${41000}, ${0}, ${10000}, ${'Revenue'}, ${1}, ${1})`,
        { message: /Non-cash account/ },
      );
    });

    it('shall accept cash equivalent account with proper classification', async function () {
      await setupAccounts();
      const ref = await draftJournalEntry(new Date(2025, 0, 15));

      // Cash account with cashflow columns should succeed
      await sql`INSERT INTO journal_entry_lines_auto_number
        (journal_entry_ref, account_code, debit, credit, note, cashflow_activity, cashflow_category)
        VALUES (${ref}, ${11110}, ${10000}, ${0}, ${'Cash receipt'}, ${1}, ${1})`;

      // Non-cash counterpart without cashflow columns should succeed
      await sql`INSERT INTO journal_entry_lines_auto_number
        (journal_entry_ref, account_code, debit, credit, note)
        VALUES (${ref}, ${41000}, ${0}, ${10000}, ${'Revenue'})`;

      // Verify the entry can be posted
      await postJournalEntry(ref, new Date(2025, 0, 15));
    });

    it('shall reject invalid activity types', async function () {
      await setupAccounts();
      const ref = await draftJournalEntry(new Date(2025, 0, 15));

      await rejects(
        sql`INSERT INTO journal_entry_lines_auto_number
          (journal_entry_ref, account_code, debit, credit, note, cashflow_activity, cashflow_category)
          VALUES (${ref}, ${11110}, ${10000}, ${0}, ${'Cash receipt'}, ${0}, ${1})`,
        { message: /CHECK/ },
      );
    });

    it('shall reject cashflow_activity without cashflow_category', async function () {
      await setupAccounts();
      const ref = await draftJournalEntry(new Date(2025, 0, 15));

      await rejects(
        sql`INSERT INTO journal_entry_lines
          (journal_entry_ref, line_number, account_code, debit, credit, cashflow_activity)
          VALUES (${ref}, ${1}, ${11110}, ${10000}, ${0}, ${1})`,
        { message: /CHECK/ },
      );
    });
  });

  describe('Cash Flow Report Generation', function () {
    it('shall auto-generate statement lines from classified transactions', async function () {
      await setupAccounts();

      // Transaction 1: Customer pays cash (Operating)
      const ref1 = await draftJournalEntry(new Date(2025, 2, 1));
      await sql`INSERT INTO journal_entry_lines_auto_number
        (journal_entry_ref, account_code, debit, credit, note, cashflow_activity, cashflow_category)
        VALUES (${ref1}, ${11110}, ${50000}, ${0}, ${'Cash from customer'}, ${1}, ${1})`;
      await sql`INSERT INTO journal_entry_lines_auto_number
        (journal_entry_ref, account_code, debit, credit, note)
        VALUES (${ref1}, ${41000}, ${0}, ${50000}, ${'Sales revenue'})`;
      await postJournalEntry(ref1, new Date(2025, 2, 1));

      // Transaction 2: Pay supplier (Operating)
      const ref2 = await draftJournalEntry(new Date(2025, 2, 5));
      await sql`INSERT INTO journal_entry_lines_auto_number
        (journal_entry_ref, account_code, debit, credit, note, cashflow_activity, cashflow_category)
        VALUES (${ref2}, ${11110}, ${0}, ${20000}, ${'Pay supplier'}, ${1}, ${2})`;
      await sql`INSERT INTO journal_entry_lines_auto_number
        (journal_entry_ref, account_code, debit, credit, note)
        VALUES (${ref2}, ${20000}, ${20000}, ${0}, ${'Clear payable'})`;
      await postJournalEntry(ref2, new Date(2025, 2, 5));

      // Generate cash flow report
      const reportTime = new Date(2025, 3, 1).getTime();
      await sql`INSERT INTO cashflow_reports (report_time, begin_time, end_time, name, create_time)
        VALUES (${reportTime}, ${fy2025Begin}, ${fy2025End}, ${'Q1 2025 Cash Flow'}, ${reportTime})`;

      // Check the generated statement
      const result = await sql`SELECT activity_type, line_note, amount FROM cashflow_statement ORDER BY activity_type, line_note`;

      equal(result.rows.length, 2);
      deepEqual(result.rows[0], { activity_type: 1, line_note: 'Customer Receipt', amount: 50000 });
      deepEqual(result.rows[1], { activity_type: 1, line_note: 'Supplier Payment', amount: -20000 });
    });

    it('shall categorize operating, investing, and financing activities', async function () {
      await setupAccounts();

      // Operating: Customer receipt
      const ref1 = await draftJournalEntry(new Date(2025, 1, 1));
      await sql`INSERT INTO journal_entry_lines_auto_number
        (journal_entry_ref, account_code, debit, credit, note, cashflow_activity, cashflow_category)
        VALUES (${ref1}, ${11110}, ${100000}, ${0}, ${'Cash receipt'}, ${1}, ${1})`;
      await sql`INSERT INTO journal_entry_lines_auto_number
        (journal_entry_ref, account_code, debit, credit, note)
        VALUES (${ref1}, ${41000}, ${0}, ${100000}, ${'Revenue'})`;
      await postJournalEntry(ref1, new Date(2025, 1, 1));

      // Investing: Buy equipment with cash
      const ref2 = await draftJournalEntry(new Date(2025, 2, 1));
      await sql`INSERT INTO journal_entry_lines_auto_number
        (journal_entry_ref, account_code, debit, credit, note)
        VALUES (${ref2}, ${12100}, ${50000}, ${0}, ${'Equipment purchase'})`;
      await sql`INSERT INTO journal_entry_lines_auto_number
        (journal_entry_ref, account_code, debit, credit, note, cashflow_activity, cashflow_category)
        VALUES (${ref2}, ${11110}, ${0}, ${50000}, ${'Equipment payment'}, ${2}, ${5})`;
      await postJournalEntry(ref2, new Date(2025, 2, 1));

      // Financing: Receive bank loan
      const ref3 = await draftJournalEntry(new Date(2025, 3, 1));
      await sql`INSERT INTO journal_entry_lines_auto_number
        (journal_entry_ref, account_code, debit, credit, note, cashflow_activity, cashflow_category)
        VALUES (${ref3}, ${11120}, ${200000}, ${0}, ${'Loan proceeds'}, ${3}, ${6})`;
      await sql`INSERT INTO journal_entry_lines_auto_number
        (journal_entry_ref, account_code, debit, credit, note)
        VALUES (${ref3}, ${21000}, ${0}, ${200000}, ${'Bank loan'})`;
      await postJournalEntry(ref3, new Date(2025, 3, 1));

      // Financing: Owner capital injection
      const ref4 = await draftJournalEntry(new Date(2025, 4, 1));
      await sql`INSERT INTO journal_entry_lines_auto_number
        (journal_entry_ref, account_code, debit, credit, note, cashflow_activity, cashflow_category)
        VALUES (${ref4}, ${11110}, ${75000}, ${0}, ${'Capital injection'}, ${3}, ${7})`;
      await sql`INSERT INTO journal_entry_lines_auto_number
        (journal_entry_ref, account_code, debit, credit, note)
        VALUES (${ref4}, ${30000}, ${0}, ${75000}, ${'Owner equity'})`;
      await postJournalEntry(ref4, new Date(2025, 4, 1));

      // Generate report
      const reportTime = new Date(2025, 11, 31).getTime();
      await sql`INSERT INTO cashflow_reports (report_time, begin_time, end_time, name, create_time)
        VALUES (${reportTime}, ${fy2025Begin}, ${fy2025End}, ${'FY2025 Cash Flow'}, ${reportTime})`;

      const result = await sql`SELECT activity_type, line_note, amount FROM cashflow_statement
        ORDER BY
          activity_type,
          line_note`;

      equal(result.rows.length, 4);
      deepEqual(result.rows[0], { activity_type: 1, line_note: 'Customer Receipt', amount: 100000 });
      deepEqual(result.rows[1], { activity_type: 2, line_note: 'Asset Purchase', amount: -50000 });
      deepEqual(result.rows[2], { activity_type: 3, line_note: 'Capital Injection', amount: 75000 });
      deepEqual(result.rows[3], { activity_type: 3, line_note: 'Loan Proceeds', amount: 200000 });
    });

    it('shall aggregate multiple transactions with the same category', async function () {
      await setupAccounts();

      // Multiple customer receipts
      for (const [day, amount] of [[5, 10000], [10, 25000], [15, 15000]]) {
        const ref = await draftJournalEntry(new Date(2025, 1, /** @type {number} */ (day)));
        await sql`INSERT INTO journal_entry_lines_auto_number
          (journal_entry_ref, account_code, debit, credit, note, cashflow_activity, cashflow_category)
          VALUES (${ref}, ${11110}, ${amount}, ${0}, ${'Customer payment'}, ${1}, ${1})`;
        await sql`INSERT INTO journal_entry_lines_auto_number
          (journal_entry_ref, account_code, debit, credit, note)
          VALUES (${ref}, ${41000}, ${0}, ${amount}, ${'Revenue'})`;
        await postJournalEntry(ref, new Date(2025, 1, /** @type {number} */ (day)));
      }

      // Generate report
      const reportTime = new Date(2025, 3, 1).getTime();
      await sql`INSERT INTO cashflow_reports (report_time, begin_time, end_time, name, create_time)
        VALUES (${reportTime}, ${fy2025Begin}, ${fy2025End}, ${'Q1 Cash Flow'}, ${reportTime})`;

      const result = await sql`SELECT activity_type, line_note, amount FROM cashflow_statement`;

      equal(result.rows.length, 1);
      deepEqual(result.rows[0], { activity_type: 1, line_note: 'Customer Receipt', amount: 50000 });
    });

    it('shall filter transactions by time range', async function () {
      await setupAccounts();

      const q1Begin = new Date(2025, 0, 1).getTime();
      const q1End = new Date(2025, 3, 1).getTime();
      const q2End = new Date(2025, 6, 1).getTime();

      // Q1 transaction (within range)
      const ref1 = await draftJournalEntry(new Date(2025, 1, 15));
      await sql`INSERT INTO journal_entry_lines_auto_number
        (journal_entry_ref, account_code, debit, credit, note, cashflow_activity, cashflow_category)
        VALUES (${ref1}, ${11110}, ${30000}, ${0}, ${'Q1 receipt'}, ${1}, ${1})`;
      await sql`INSERT INTO journal_entry_lines_auto_number
        (journal_entry_ref, account_code, debit, credit, note)
        VALUES (${ref1}, ${41000}, ${0}, ${30000}, ${'Revenue'})`;
      await postJournalEntry(ref1, new Date(2025, 1, 15));

      // Q2 transaction (outside Q1 range)
      const ref2 = await draftJournalEntry(new Date(2025, 4, 15));
      await sql`INSERT INTO journal_entry_lines_auto_number
        (journal_entry_ref, account_code, debit, credit, note, cashflow_activity, cashflow_category)
        VALUES (${ref2}, ${11110}, ${70000}, ${0}, ${'Q2 receipt'}, ${1}, ${1})`;
      await sql`INSERT INTO journal_entry_lines_auto_number
        (journal_entry_ref, account_code, debit, credit, note)
        VALUES (${ref2}, ${41000}, ${0}, ${70000}, ${'Revenue'})`;
      await postJournalEntry(ref2, new Date(2025, 4, 15));

      // Generate Q1 report only
      const reportTime = new Date(2025, 3, 1).getTime();
      await sql`INSERT INTO cashflow_reports (report_time, begin_time, end_time, name, create_time)
        VALUES (${reportTime}, ${q1Begin}, ${q1End}, ${'Q1 Only'}, ${reportTime})`;

      const q1Result = await sql`SELECT activity_type, line_note, amount FROM cashflow_statement WHERE cashflow_report_id = 1`;
      equal(q1Result.rows.length, 1);
      equal(q1Result.rows[0].amount, 30000);

      // Generate full-year report
      const reportTime2 = new Date(2025, 6, 1).getTime();
      await sql`INSERT INTO cashflow_reports (report_time, begin_time, end_time, name, create_time)
        VALUES (${reportTime2}, ${q1Begin}, ${q2End}, ${'H1 2025'}, ${reportTime2})`;

      const fullResult = await sql`SELECT activity_type, line_note, amount FROM cashflow_statement WHERE cashflow_report_id = 2`;
      equal(fullResult.rows.length, 1);
      equal(fullResult.rows[0].amount, 100000);
    });

    it('shall exclude unposted journal entries', async function () {
      await setupAccounts();

      // Posted transaction
      const ref1 = await draftJournalEntry(new Date(2025, 2, 1));
      await sql`INSERT INTO journal_entry_lines_auto_number
        (journal_entry_ref, account_code, debit, credit, note, cashflow_activity, cashflow_category)
        VALUES (${ref1}, ${11110}, ${10000}, ${0}, ${'Posted'}, ${1}, ${1})`;
      await sql`INSERT INTO journal_entry_lines_auto_number
        (journal_entry_ref, account_code, debit, credit, note)
        VALUES (${ref1}, ${41000}, ${0}, ${10000}, ${'Revenue'})`;
      await postJournalEntry(ref1, new Date(2025, 2, 1));

      // Unposted (draft) transaction
      const ref2 = await draftJournalEntry(new Date(2025, 2, 15));
      await sql`INSERT INTO journal_entry_lines_auto_number
        (journal_entry_ref, account_code, debit, credit, note, cashflow_activity, cashflow_category)
        VALUES (${ref2}, ${11110}, ${99999}, ${0}, ${'Draft'}, ${1}, ${1})`;
      await sql`INSERT INTO journal_entry_lines_auto_number
        (journal_entry_ref, account_code, debit, credit, note)
        VALUES (${ref2}, ${41000}, ${0}, ${99999}, ${'Revenue'})`;
      // Not posted!

      // Generate report
      const reportTime = new Date(2025, 3, 1).getTime();
      await sql`INSERT INTO cashflow_reports (report_time, begin_time, end_time, name, create_time)
        VALUES (${reportTime}, ${fy2025Begin}, ${fy2025End}, ${'Report'}, ${reportTime})`;

      const result = await sql`SELECT amount FROM cashflow_statement`;
      equal(result.rows.length, 1);
      equal(result.rows[0].amount, 10000);
    });

    it('shall produce empty report for period with no cash transactions', async function () {
      await setupAccounts();

      const reportTime = new Date(2025, 3, 1).getTime();
      await sql`INSERT INTO cashflow_reports (report_time, begin_time, end_time, name, create_time)
        VALUES (${reportTime}, ${fy2025Begin}, ${fy2025End}, ${'Empty Period'}, ${reportTime})`;

      const result = await sql`SELECT * FROM cashflow_statement`;
      equal(result.rows.length, 0);
    });

    it('shall net cash flow equal to actual cash account movement', async function () {
      await setupAccounts();

      // Operating: +100,000 from customers, -30,000 to suppliers, -10,000 rent
      const ref1 = await draftJournalEntry(new Date(2025, 1, 1));
      await sql`INSERT INTO journal_entry_lines_auto_number
        (journal_entry_ref, account_code, debit, credit, note, cashflow_activity, cashflow_category)
        VALUES (${ref1}, ${11110}, ${100000}, ${0}, ${'Customer receipt'}, ${1}, ${1})`;
      await sql`INSERT INTO journal_entry_lines_auto_number
        (journal_entry_ref, account_code, debit, credit, note)
        VALUES (${ref1}, ${41000}, ${0}, ${100000}, ${'Revenue'})`;
      await postJournalEntry(ref1, new Date(2025, 1, 1));

      const ref2 = await draftJournalEntry(new Date(2025, 2, 1));
      await sql`INSERT INTO journal_entry_lines_auto_number
        (journal_entry_ref, account_code, debit, credit, note, cashflow_activity, cashflow_category)
        VALUES (${ref2}, ${11110}, ${0}, ${30000}, ${'Supplier payment'}, ${1}, ${2})`;
      await sql`INSERT INTO journal_entry_lines_auto_number
        (journal_entry_ref, account_code, debit, credit, note)
        VALUES (${ref2}, ${20000}, ${30000}, ${0}, ${'Clear AP'})`;
      await postJournalEntry(ref2, new Date(2025, 2, 1));

      const ref3 = await draftJournalEntry(new Date(2025, 3, 1));
      await sql`INSERT INTO journal_entry_lines_auto_number
        (journal_entry_ref, account_code, debit, credit, note, cashflow_activity, cashflow_category)
        VALUES (${ref3}, ${11110}, ${0}, ${10000}, ${'Rent payment'}, ${1}, ${3})`;
      await sql`INSERT INTO journal_entry_lines_auto_number
        (journal_entry_ref, account_code, debit, credit, note)
        VALUES (${ref3}, ${61000}, ${10000}, ${0}, ${'Rent expense'})`;
      await postJournalEntry(ref3, new Date(2025, 3, 1));

      // Investing: -50,000 buy equipment
      const ref4 = await draftJournalEntry(new Date(2025, 4, 1));
      await sql`INSERT INTO journal_entry_lines_auto_number
        (journal_entry_ref, account_code, debit, credit, note)
        VALUES (${ref4}, ${12100}, ${50000}, ${0}, ${'Equipment'})`;
      await sql`INSERT INTO journal_entry_lines_auto_number
        (journal_entry_ref, account_code, debit, credit, note, cashflow_activity, cashflow_category)
        VALUES (${ref4}, ${11110}, ${0}, ${50000}, ${'Equipment payment'}, ${2}, ${5})`;
      await postJournalEntry(ref4, new Date(2025, 4, 1));

      // Financing: +200,000 loan
      const ref5 = await draftJournalEntry(new Date(2025, 5, 1));
      await sql`INSERT INTO journal_entry_lines_auto_number
        (journal_entry_ref, account_code, debit, credit, note, cashflow_activity, cashflow_category)
        VALUES (${ref5}, ${11110}, ${200000}, ${0}, ${'Loan'}, ${3}, ${6})`;
      await sql`INSERT INTO journal_entry_lines_auto_number
        (journal_entry_ref, account_code, debit, credit, note)
        VALUES (${ref5}, ${21000}, ${0}, ${200000}, ${'Bank loan'})`;
      await postJournalEntry(ref5, new Date(2025, 5, 1));

      // Generate report
      const reportTime = new Date(2025, 11, 31).getTime();
      await sql`INSERT INTO cashflow_reports (report_time, begin_time, end_time, name, create_time)
        VALUES (${reportTime}, ${fy2025Begin}, ${fy2025End}, ${'FY2025'}, ${reportTime})`;

      // Get totals by activity
      const result = await sql`
        SELECT activity_type, SUM(amount) as total
        FROM cashflow_statement
        GROUP BY activity_type
        ORDER BY activity_type`;

      equal(result.rows.length, 3);
      equal(result.rows[0].total, 60000);   // Operating: 100k - 30k - 10k
      equal(result.rows[1].total, -50000);  // Investing: -50k
      equal(result.rows[2].total, 200000);  // Financing: +200k

      // Net cash flow = 60k - 50k + 200k = 210k
      const netResult = await sql`SELECT SUM(amount) as net FROM cashflow_statement`;
      equal(netResult.rows[0].net, 210000);

      // Verify this equals the actual cash account balance
      const cashBalance = await sql`SELECT balance FROM accounts WHERE account_code = ${11110}`;
      equal(cashBalance.rows[0].balance, 210000);
    });

    it('shall handle multiple cash accounts across activities', async function () {
      await setupAccounts();

      // Deposit into Kas (Operating)
      const ref1 = await draftJournalEntry(new Date(2025, 1, 1));
      await sql`INSERT INTO journal_entry_lines_auto_number
        (journal_entry_ref, account_code, debit, credit, note, cashflow_activity, cashflow_category)
        VALUES (${ref1}, ${11110}, ${50000}, ${0}, ${'Cash receipt'}, ${1}, ${1})`;
      await sql`INSERT INTO journal_entry_lines_auto_number
        (journal_entry_ref, account_code, debit, credit, note)
        VALUES (${ref1}, ${41000}, ${0}, ${50000}, ${'Revenue'})`;
      await postJournalEntry(ref1, new Date(2025, 1, 1));

      // Deposit into Bank BCA (Operating)
      const ref2 = await draftJournalEntry(new Date(2025, 2, 1));
      await sql`INSERT INTO journal_entry_lines_auto_number
        (journal_entry_ref, account_code, debit, credit, note, cashflow_activity, cashflow_category)
        VALUES (${ref2}, ${11120}, ${80000}, ${0}, ${'Bank deposit'}, ${1}, ${1})`;
      await sql`INSERT INTO journal_entry_lines_auto_number
        (journal_entry_ref, account_code, debit, credit, note)
        VALUES (${ref2}, ${41000}, ${0}, ${80000}, ${'Revenue'})`;
      await postJournalEntry(ref2, new Date(2025, 2, 1));

      // Generate report
      const reportTime = new Date(2025, 3, 1).getTime();
      await sql`INSERT INTO cashflow_reports (report_time, begin_time, end_time, name, create_time)
        VALUES (${reportTime}, ${fy2025Begin}, ${fy2025End}, ${'Multi-account'}, ${reportTime})`;

      // Both cash accounts aggregate under the same category
      const result = await sql`SELECT activity_type, line_note, amount FROM cashflow_statement`;
      equal(result.rows.length, 1);
      equal(result.rows[0].amount, 130000); // 50k + 80k
    });

    it('shall support fiscal year association', async function () {
      await setupAccounts();
      await sql`INSERT INTO fiscal_years (begin_time, end_time, name) VALUES (${fy2025Begin}, ${fy2025End}, ${'FY2025'})`;

      const ref1 = await draftJournalEntry(new Date(2025, 5, 1));
      await sql`INSERT INTO journal_entry_lines_auto_number
        (journal_entry_ref, account_code, debit, credit, note, cashflow_activity, cashflow_category)
        VALUES (${ref1}, ${11110}, ${25000}, ${0}, ${'Receipt'}, ${1}, ${1})`;
      await sql`INSERT INTO journal_entry_lines_auto_number
        (journal_entry_ref, account_code, debit, credit, note)
        VALUES (${ref1}, ${41000}, ${0}, ${25000}, ${'Revenue'})`;
      await postJournalEntry(ref1, new Date(2025, 5, 1));

      const reportTime = new Date(2025, 11, 31).getTime();
      await sql`INSERT INTO cashflow_reports (report_time, begin_time, end_time, fiscal_year_id, name, create_time)
        VALUES (${reportTime}, ${fy2025Begin}, ${fy2025End}, ${1}, ${'FY2025 Cash Flow'}, ${reportTime})`;

      const result = await sql`SELECT * FROM cashflow_reports WHERE fiscal_year_id = 1`;
      equal(result.rows.length, 1);
      equal(result.rows[0].name, 'FY2025 Cash Flow');
    });

    it('shall omit zero-sum categories from the report', async function () {
      await setupAccounts();

      // Receive and then return the exact same amount
      const ref1 = await draftJournalEntry(new Date(2025, 1, 1));
      await sql`INSERT INTO journal_entry_lines_auto_number
        (journal_entry_ref, account_code, debit, credit, note, cashflow_activity, cashflow_category)
        VALUES (${ref1}, ${11110}, ${10000}, ${0}, ${'Receive'}, ${1}, ${1})`;
      await sql`INSERT INTO journal_entry_lines_auto_number
        (journal_entry_ref, account_code, debit, credit, note)
        VALUES (${ref1}, ${41000}, ${0}, ${10000}, ${'Revenue'})`;
      await postJournalEntry(ref1, new Date(2025, 1, 1));

      const ref2 = await draftJournalEntry(new Date(2025, 1, 15));
      await sql`INSERT INTO journal_entry_lines_auto_number
        (journal_entry_ref, account_code, debit, credit, note, cashflow_activity, cashflow_category)
        VALUES (${ref2}, ${11110}, ${0}, ${10000}, ${'Refund'}, ${1}, ${1})`;
      await sql`INSERT INTO journal_entry_lines_auto_number
        (journal_entry_ref, account_code, debit, credit, note)
        VALUES (${ref2}, ${41000}, ${10000}, ${0}, ${'Revenue reversal'})`;
      await postJournalEntry(ref2, new Date(2025, 1, 15));

      // Generate report
      const reportTime = new Date(2025, 3, 1).getTime();
      await sql`INSERT INTO cashflow_reports (report_time, begin_time, end_time, name, create_time)
        VALUES (${reportTime}, ${fy2025Begin}, ${fy2025End}, ${'Zero sum'}, ${reportTime})`;

      // Zero-sum categories should not appear
      const result = await sql`SELECT * FROM cashflow_statement`;
      equal(result.rows.length, 0);
    });
  });

  describe('Cashflow Statement View', function () {
    it('shall order activities as Operating, Investing, Financing', async function () {
      await setupAccounts();

      // Create transactions in reverse order
      const ref1 = await draftJournalEntry(new Date(2025, 1, 1));
      await sql`INSERT INTO journal_entry_lines_auto_number
        (journal_entry_ref, account_code, debit, credit, note, cashflow_activity, cashflow_category)
        VALUES (${ref1}, ${11110}, ${10000}, ${0}, ${'Loan'}, ${3}, ${6})`;
      await sql`INSERT INTO journal_entry_lines_auto_number
        (journal_entry_ref, account_code, debit, credit, note)
        VALUES (${ref1}, ${21000}, ${0}, ${10000}, ${'Loan'})`;
      await postJournalEntry(ref1, new Date(2025, 1, 1));

      const ref2 = await draftJournalEntry(new Date(2025, 2, 1));
      await sql`INSERT INTO journal_entry_lines_auto_number
        (journal_entry_ref, account_code, debit, credit, note)
        VALUES (${ref2}, ${12100}, ${5000}, ${0}, ${'Equipment'})`;
      await sql`INSERT INTO journal_entry_lines_auto_number
        (journal_entry_ref, account_code, debit, credit, note, cashflow_activity, cashflow_category)
        VALUES (${ref2}, ${11110}, ${0}, ${5000}, ${'Buy equip'}, ${2}, ${5})`;
      await postJournalEntry(ref2, new Date(2025, 2, 1));

      const ref3 = await draftJournalEntry(new Date(2025, 3, 1));
      await sql`INSERT INTO journal_entry_lines_auto_number
        (journal_entry_ref, account_code, debit, credit, note, cashflow_activity, cashflow_category)
        VALUES (${ref3}, ${11110}, ${20000}, ${0}, ${'Receipt'}, ${1}, ${1})`;
      await sql`INSERT INTO journal_entry_lines_auto_number
        (journal_entry_ref, account_code, debit, credit, note)
        VALUES (${ref3}, ${41000}, ${0}, ${20000}, ${'Revenue'})`;
      await postJournalEntry(ref3, new Date(2025, 3, 1));

      const reportTime = new Date(2025, 11, 31).getTime();
      await sql`INSERT INTO cashflow_reports (report_time, begin_time, end_time, name, create_time)
        VALUES (${reportTime}, ${fy2025Begin}, ${fy2025End}, ${'Ordering Test'}, ${reportTime})`;

      const result = await sql`SELECT activity_type FROM cashflow_statement`;
      equal(result.rows[0].activity_type, 1);
      equal(result.rows[1].activity_type, 2);
      equal(result.rows[2].activity_type, 3);
    });

    it('shall use entry_time for period filtering, not post_time', async function () {
      await setupAccounts();

      const q1Begin = new Date(2025, 0, 1).getTime();
      const q1End = new Date(2025, 3, 1).getTime();

      // Entry dated in Q1 but posted later (backdated scenario)
      const ref1 = await draftJournalEntry(new Date(2025, 1, 15)); // entry_time in Q1
      await sql`INSERT INTO journal_entry_lines_auto_number
        (journal_entry_ref, account_code, debit, credit, note, cashflow_activity, cashflow_category)
        VALUES (${ref1}, ${11110}, ${40000}, ${0}, ${'Q1 entry backdated'}, ${1}, ${1})`;
      await sql`INSERT INTO journal_entry_lines_auto_number
        (journal_entry_ref, account_code, debit, credit, note)
        VALUES (${ref1}, ${41000}, ${0}, ${40000}, ${'Revenue'})`;
      // Post in Q2 (post_time outside Q1)
      await postJournalEntry(ref1, new Date(2025, 4, 10));

      // Generate Q1 report
      const reportTime = new Date(2025, 3, 15).getTime();
      await sql`INSERT INTO cashflow_reports (report_time, begin_time, end_time, name, create_time)
        VALUES (${reportTime}, ${q1Begin}, ${q1End}, ${'Q1 Boundary Test'}, ${reportTime})`;

      // The backdated entry should appear in Q1 because entry_time is in Q1
      const result = await sql`SELECT activity_type, amount FROM cashflow_statement WHERE cashflow_report_id = 1`;
      equal(result.rows.length, 1);
      equal(result.rows[0].amount, 40000);
    });

    it('shall use exclusive begin and inclusive end boundary (begin, end]', async function () {
      await setupAccounts();

      const periodBegin = new Date(2025, 0, 1).getTime();
      const periodEnd = new Date(2025, 3, 1).getTime();

      // Entry exactly at begin_time (should be EXCLUDED per (begin, end] convention)
      const ref1 = await draftJournalEntry(new Date(2025, 0, 1)); // exactly at begin
      await sql`INSERT INTO journal_entry_lines_auto_number
        (journal_entry_ref, account_code, debit, credit, note, cashflow_activity, cashflow_category)
        VALUES (${ref1}, ${11110}, ${10000}, ${0}, ${'At begin'}, ${1}, ${1})`;
      await sql`INSERT INTO journal_entry_lines_auto_number
        (journal_entry_ref, account_code, debit, credit, note)
        VALUES (${ref1}, ${41000}, ${0}, ${10000}, ${'Revenue'})`;
      await postJournalEntry(ref1, new Date(2025, 0, 1));

      // Entry exactly at end_time (should be INCLUDED per (begin, end] convention)
      const ref2 = await draftJournalEntry(new Date(2025, 3, 1)); // exactly at end
      await sql`INSERT INTO journal_entry_lines_auto_number
        (journal_entry_ref, account_code, debit, credit, note, cashflow_activity, cashflow_category)
        VALUES (${ref2}, ${11110}, ${25000}, ${0}, ${'At end'}, ${1}, ${1})`;
      await sql`INSERT INTO journal_entry_lines_auto_number
        (journal_entry_ref, account_code, debit, credit, note)
        VALUES (${ref2}, ${41000}, ${0}, ${25000}, ${'Revenue'})`;
      await postJournalEntry(ref2, new Date(2025, 3, 1));

      const reportTime = new Date(2025, 6, 1).getTime();
      await sql`INSERT INTO cashflow_reports (report_time, begin_time, end_time, name, create_time)
        VALUES (${reportTime}, ${periodBegin}, ${periodEnd}, ${'Boundary Test'}, ${reportTime})`;

      const result = await sql`SELECT activity_type, amount FROM cashflow_statement WHERE cashflow_report_id = 1`;
      // Only entry at end_time should be included (entry at begin_time excluded)
      equal(result.rows.length, 1);
      equal(result.rows[0].amount, 25000);
    });
  });
});
