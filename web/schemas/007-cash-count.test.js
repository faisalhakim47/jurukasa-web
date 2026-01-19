import { describe, it } from 'node:test';
import { equal, rejects } from 'node:assert/strict';

import { useSql } from '#web/schemas/test/hooks/use-sql.js';

describe('Cash Count Schema Tests', function () {
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

  /**
   * @param {Date} entryDate
   * @param {string} [note]
   */
  async function draftJournalEntry(entryDate, note) {
    const result = await sql`
      INSERT INTO journal_entries (entry_time, note) VALUES (${entryDate.getTime()}, ${note ?? null}) RETURNING ref
    `;
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
   * Sets up an environment specifically for cash count testing
   * Includes the Selisih Kas (Cash Over/Short) account with proper tags
   */
  async function setupCashCountEnvironment() {
    // Create accounts
    await createAccount(11100, 'Kas & Bank', 0); // Control account
    await createAccount(11110, 'Kas', 0, 11100); // Cash
    await createAccount(11120, 'Bank BCA', 0, 11100); // Bank
    await createAccount(30000, 'Ekuitas', 1); // Equity control
    await createAccount(31000, 'Modal Pemilik', 1, 30000); // Owner's Capital
    await createAccount(82000, 'Beban Lainnya', 0); // Other expenses control
    await createAccount(82200, 'Penyesuaian Rekonsiliasi', 0, 82000); // Reconciliation Adjustment
    await createAccount(82300, 'Selisih Kas', 0, 82000); // Cash Over/Short

    // Add tags
    await addTag(82200, 'Reconciliation - Adjustment');
    await addTag(82300, 'Reconciliation - Cash Over/Short');
    await addTag(11110, 'Cash Flow - Cash Equivalents'); // Required for cash count
    await addTag(11120, 'Cash Flow - Cash Equivalents'); // Required for cash count

    // Create initial capital entry to give Cash account some balance
    const ref = await draftJournalEntry(new Date(2025, 0, 1, 0, 0, 0, 0), 'Initial Capital');
    await addJournalLine(ref, 11110, 500000, 0); // 500,000 to Cash
    await addJournalLine(ref, 31000, 0, 500000); // From Capital
    await postJournalEntry(ref, new Date(2025, 0, 1, 0, 0, 0, 0));
  }

  describe('Cash Count Creation', function () {
    it('shall create a cash count when balance matches (no discrepancy)', async function () {
      await setupCashCountEnvironment();

      const countTime = new Date(2025, 0, 15, 18, 0, 0, 0).getTime(); // 6 PM
      const createTime = new Date(2025, 0, 15, 18, 0, 0, 0).getTime();

      // Record a cash count where counted amount equals system balance
      await sql`
        INSERT INTO cash_counts (account_code, count_time, counted_amount, note, create_time)
        VALUES (${11110}, ${countTime}, ${500000}, ${'End of day cash count'}, ${createTime})
      `;

      // Verify cash count was recorded
      const cashCount = await sql`SELECT * FROM cash_counts WHERE count_time = ${countTime}`;
      equal(cashCount.rows.length, 1);
      equal(Number(cashCount.rows[0].counted_amount), 500000);

      // Verify reconciliation session was created and completed
      const session = await sql`
        SELECT * FROM reconciliation_sessions 
        WHERE statement_reference = ${'Cash Count @' + countTime}
      `;
      equal(session.rows.length, 1);
      equal(session.rows[0].complete_time !== null, true); // completed

      // Verify no adjustment journal entry was created
      equal(session.rows[0].adjustment_journal_entry_ref, null);

      // Verify cash balance remains unchanged
      const cashBalance = await sql`SELECT balance FROM accounts WHERE account_code = ${11110}`;
      equal(Number(cashBalance.rows[0].balance), 500000);
    });

    it('shall prevent cash count on non-posting accounts', async function () {
      await setupCashCountEnvironment();

      const countTime = new Date(2025, 0, 15, 18, 0, 0, 0).getTime();
      const createTime = new Date(2025, 0, 15, 18, 0, 0, 0).getTime();

      // Try to count on control account (non-posting)
      await rejects(
        sql`
          INSERT INTO cash_counts (account_code, count_time, counted_amount, create_time)
          VALUES (${11100}, ${countTime}, ${500000}, ${createTime})
        `,
        /Cash count can only be performed on posting accounts/
      );
    });

    it('shall prevent cash count on non-cash accounts', async function () {
      await setupCashCountEnvironment();

      // Create a non-cash posting account
      await createAccount(21100, 'Utang Usaha', 1); // Accounts Payable

      const countTime = new Date(2025, 0, 15, 18, 0, 0, 0).getTime();
      const createTime = new Date(2025, 0, 15, 18, 0, 0, 0).getTime();

      // Try to count on non-cash account
      await rejects(
        sql`
          INSERT INTO cash_counts (account_code, count_time, counted_amount, create_time)
          VALUES (${21100}, ${countTime}, ${0}, ${createTime})
        `,
        /Cash count can only be performed on cash\/bank accounts/
      );
    });

    it('shall prevent cash count when draft reconciliation exists', async function () {
      await setupCashCountEnvironment();

      // Create a draft reconciliation session
      const reconciliationTime = new Date(2025, 0, 15, 0, 0, 0, 0).getTime();
      const beginTime = new Date(2025, 0, 1, 0, 0, 0, 0).getTime();
      const endTime = new Date(2025, 0, 15, 0, 0, 0, 0).getTime();

      await sql`
        INSERT INTO reconciliation_sessions (
          account_code, reconciliation_time, statement_begin_time, statement_end_time,
          statement_opening_balance, statement_closing_balance,
          internal_opening_balance, internal_closing_balance, create_time
        ) VALUES (
          ${11110}, ${reconciliationTime}, ${beginTime}, ${endTime},
          ${0}, ${500000}, ${0}, ${500000}, ${reconciliationTime}
        )
      `;

      const countTime = new Date(2025, 0, 15, 18, 0, 0, 0).getTime();
      const createTime = new Date(2025, 0, 15, 18, 0, 0, 0).getTime();

      // Try to do cash count while draft session exists
      await rejects(
        sql`
          INSERT INTO cash_counts (account_code, count_time, counted_amount, create_time)
          VALUES (${11110}, ${countTime}, ${500000}, ${createTime})
        `,
        /Cannot perform cash count: a draft reconciliation session exists for this account/
      );
    });
  });

  describe('Cash Shortage Handling', function () {
    it('shall handle cash shortage (counted less than system balance)', async function () {
      await setupCashCountEnvironment();

      const countTime = new Date(2025, 0, 15, 18, 0, 0, 0).getTime();
      const createTime = new Date(2025, 0, 15, 18, 0, 0, 0).getTime();

      // Count shows 450,000 but system shows 500,000 = shortage of 50,000
      await sql`
        INSERT INTO cash_counts (account_code, count_time, counted_amount, note, create_time)
        VALUES (${11110}, ${countTime}, ${450000}, ${'Cash shortage detected'}, ${createTime})
      `;

      const cashCount = await sql`SELECT * FROM cash_count_history WHERE count_time = ${countTime}`;
      equal(Number(cashCount.rows[0].discrepancy), -50000);

      // Verify reconciliation session was completed (with adjustments since there was discrepancy)
      const session = await sql`
        SELECT * FROM reconciliation_sessions 
        WHERE statement_reference = ${'Cash Count @' + countTime}
      `;
      equal(session.rows[0].complete_time !== null, true); // completed

      // Verify adjustment journal entry was created
      const adjustmentRef = session.rows[0].adjustment_journal_entry_ref;
      equal(adjustmentRef !== null, true);

      // Verify journal entry lines
      const journalLines = await sql`
        SELECT * FROM journal_entry_lines 
        WHERE journal_entry_ref = ${adjustmentRef}
        ORDER BY line_number
      `;
      equal(journalLines.rows.length, 2);

      // Line 1: Debit to Cash Over/Short (82300) for shortage
      equal(Number(journalLines.rows[0].account_code), 82300);
      equal(Number(journalLines.rows[0].debit), 50000);
      equal(Number(journalLines.rows[0].credit), 0);

      // Line 2: Credit to Cash (11110) to reduce balance
      equal(Number(journalLines.rows[1].account_code), 11110);
      equal(Number(journalLines.rows[1].debit), 0);
      equal(Number(journalLines.rows[1].credit), 50000);

      // Verify cash balance was reduced
      const cashBalance = await sql`SELECT balance FROM accounts WHERE account_code = ${11110}`;
      equal(Number(cashBalance.rows[0].balance), 450000); // 500,000 - 50,000

      // Verify Cash Over/Short account has debit balance
      const overShortBalance = await sql`SELECT balance FROM accounts WHERE account_code = ${82300}`;
      equal(Number(overShortBalance.rows[0].balance), 50000);
    });

    it('shall create proper discrepancy records for cash shortages', async function () {
      await setupCashCountEnvironment();

      const countTime = new Date(2025, 0, 15, 18, 0, 0, 0).getTime();
      const createTime = new Date(2025, 0, 15, 18, 0, 0, 0).getTime();

      await sql`
        INSERT INTO cash_counts (account_code, count_time, counted_amount, create_time)
        VALUES (${11110}, ${countTime}, ${480000}, ${createTime})
      `;

      const cashCount = await sql`SELECT * FROM cash_counts WHERE count_time = ${countTime}`;
      const sessionId = cashCount.rows[0].reconciliation_session_id;

      // Verify discrepancy record was created
      const discrepancies = await sql`
        SELECT * FROM reconciliation_discrepancies 
        WHERE reconciliation_session_id = ${sessionId}
      `;
      equal(discrepancies.rows.length, 1);
      equal(discrepancies.rows[0].discrepancy_type, 'unrecorded_debit');
      equal(Number(discrepancies.rows[0].difference_amount), -20000);
      equal(discrepancies.rows[0].resolution, 'adjusted');
    });
  });

  describe('Cash Overage Handling', function () {
    it('shall handle cash overage (counted more than system balance)', async function () {
      await setupCashCountEnvironment();

      const countTime = new Date(2025, 0, 15, 18, 0, 0, 0).getTime();
      const createTime = new Date(2025, 0, 15, 18, 0, 0, 0).getTime();

      // Count shows 550,000 but system shows 500,000 = overage of 50,000
      await sql`
        INSERT INTO cash_counts (account_code, count_time, counted_amount, note, create_time)
        VALUES (${11110}, ${countTime}, ${550000}, ${'Found extra cash'}, ${createTime})
      `;

      const cashCount = await sql`SELECT * FROM cash_count_history WHERE count_time = ${countTime}`;
      equal(Number(cashCount.rows[0].discrepancy), 50000);

      // Verify reconciliation session was completed (with adjustments since there was discrepancy)
      const session = await sql`
        SELECT * FROM reconciliation_sessions 
        WHERE statement_reference = ${'Cash Count @' + countTime}
      `;
      equal(session.rows[0].complete_time !== null, true); // completed

      // Verify journal entry lines
      const adjustmentRef = session.rows[0].adjustment_journal_entry_ref;
      const journalLines = await sql`
        SELECT * FROM journal_entry_lines 
        WHERE journal_entry_ref = ${adjustmentRef}
        ORDER BY line_number
      `;
      equal(journalLines.rows.length, 2);

      // Line 1: Credit to Cash Over/Short (82300) for overage
      equal(Number(journalLines.rows[0].account_code), 82300);
      equal(Number(journalLines.rows[0].debit), 0);
      equal(Number(journalLines.rows[0].credit), 50000);

      // Line 2: Debit to Cash (11110) to increase balance
      equal(Number(journalLines.rows[1].account_code), 11110);
      equal(Number(journalLines.rows[1].debit), 50000);
      equal(Number(journalLines.rows[1].credit), 0);

      // Verify cash balance was increased
      const cashBalance = await sql`SELECT balance FROM accounts WHERE account_code = ${11110}`;
      equal(Number(cashBalance.rows[0].balance), 550000); // 500,000 + 50,000

      // Verify Cash Over/Short has credit balance (shown as negative for debit-normal account)
      const overShortBalance = await sql`SELECT balance FROM accounts WHERE account_code = ${82300}`;
      equal(Number(overShortBalance.rows[0].balance), -50000); // Credit to debit-normal = negative
    });
  });

  describe('Cash Count Views', function () {
    it('shall show cash count history correctly', async function () {
      await setupCashCountEnvironment();

      // Perform multiple cash counts
      const count1Time = new Date(2025, 0, 15, 18, 0, 0, 0).getTime();
      await sql`
        INSERT INTO cash_counts (account_code, count_time, counted_amount, create_time)
        VALUES (${11110}, ${count1Time}, ${500000}, ${count1Time})
      `;

      const count2Time = new Date(2025, 0, 16, 18, 0, 0, 0).getTime();
      await sql`
        INSERT INTO cash_counts (account_code, count_time, counted_amount, create_time)
        VALUES (${11110}, ${count2Time}, ${480000}, ${count2Time})
      `;

      // Query cash count history
      const history = await sql`
        SELECT * FROM cash_count_history 
        WHERE account_code = ${11110}
        ORDER BY count_time DESC
      `;

      equal(history.rows.length, 2);

      // Most recent first
      equal(Number(history.rows[0].counted_amount), 480000);
      equal(history.rows[0].discrepancy_type, 'shortage');

      equal(Number(history.rows[1].counted_amount), 500000);
      equal(history.rows[1].discrepancy_type, 'balanced');
    });
  });

  describe('Reconciliation Integration', function () {
    it('shall link cash count to reconciliation session correctly', async function () {
      await setupCashCountEnvironment();

      const countTime = new Date(2025, 0, 15, 18, 0, 0, 0).getTime();
      const createTime = new Date(2025, 0, 15, 18, 0, 0, 0).getTime();

      await sql`
        INSERT INTO cash_counts (account_code, count_time, counted_amount, create_time)
        VALUES (${11110}, ${countTime}, ${450000}, ${createTime})
      `;

      const cashCount = await sql`SELECT * FROM cash_counts WHERE count_time = ${countTime}`;
      const sessionId = cashCount.rows[0].reconciliation_session_id;

      // Verify reconciliation session exists and is linked
      const session = await sql`SELECT * FROM reconciliation_sessions WHERE id = ${sessionId}`;
      equal(session.rows.length, 1);
      equal(session.rows[0].statement_reference, 'Cash Count @' + countTime);

      // Verify statement item was created
      const statementItems = await sql`
        SELECT * FROM reconciliation_statement_items 
        WHERE reconciliation_session_id = ${sessionId}
      `;
      equal(statementItems.rows.length, 1);
      equal(statementItems.rows[0].description, 'Cash Shortage');
      equal(Number(statementItems.rows[0].debit), 50000);
    });
  });
});
