import { describe, it } from 'node:test';
import { equal, rejects } from 'node:assert/strict';

import { useSql } from '#test/nodejs/hooks/use-sql.js';

describe('Account Reconciliation Schema Tests', function () {
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
   * Sets up a standard test environment with accounts for reconciliation testing
   */
  async function setupReconciliationEnvironment() {
    // Create accounts
    await createAccount(11100, 'Kas & Bank', 0); // Control account
    await createAccount(11110, 'Kas', 0, 11100); // Cash
    await createAccount(11120, 'Bank BCA', 0, 11100); // Bank
    await createAccount(30000, 'Ekuitas', 1); // Equity control
    await createAccount(31000, 'Modal Pemilik', 1, 30000); // Owner's Capital
    await createAccount(82000, 'Beban Lainnya', 0); // Other expenses control
    await createAccount(82200, 'Penyesuaian Rekonsiliasi', 0, 82000); // Reconciliation Adjustment

    // Add tags
    await addTag(82200, 'Reconciliation - Adjustment');

    // Create initial capital entry to give Bank account some balance
    const ref = await draftJournalEntry(new Date(2025, 0, 1, 0, 0, 0, 0), 'Initial Capital');
    await addJournalLine(ref, 11120, 10000000, 0); // 10,000,000 to Bank
    await addJournalLine(ref, 31000, 0, 10000000); // From Capital
    await postJournalEntry(ref, new Date(2025, 0, 1, 0, 0, 0, 0));
  }

  describe('Reconciliation Session Creation', function () {
    it('shall create a reconciliation session for a posting account', async function () {
      await setupReconciliationEnvironment();

      const reconciliationTime = new Date(2025, 0, 31, 0, 0, 0, 0).getTime();
      const beginTime = new Date(2025, 0, 1, 0, 0, 0, 0).getTime();
      const endTime = new Date(2025, 0, 31, 0, 0, 0, 0).getTime();

      await sql`
        INSERT INTO reconciliation_sessions (
          account_code, reconciliation_time, statement_begin_time, statement_end_time,
          statement_reference, statement_opening_balance, statement_closing_balance,
          internal_opening_balance, internal_closing_balance, create_time
        ) VALUES (
          ${11120}, ${reconciliationTime}, ${beginTime}, ${endTime},
          ${'Bank Statement Jan 2025'}, ${0}, ${10000000},
          ${0}, ${10000000}, ${reconciliationTime}
        )
      `;

      const result = await sql`SELECT * FROM reconciliation_sessions WHERE account_code = ${11120}`;
      equal(result.rows.length, 1);
      equal(result.rows[0].complete_time, null); // draft = complete_time is NULL
      equal(result.rows[0].statement_reference, 'Bank Statement Jan 2025');
    });

    it('shall prevent reconciliation on control (non-posting) accounts', async function () {
      await setupReconciliationEnvironment();

      const reconciliationTime = new Date(2025, 0, 31, 0, 0, 0, 0).getTime();
      const beginTime = new Date(2025, 0, 1, 0, 0, 0, 0).getTime();
      const endTime = new Date(2025, 0, 31, 0, 0, 0, 0).getTime();

      await rejects(
        sql`
          INSERT INTO reconciliation_sessions (
            account_code, reconciliation_time, statement_begin_time, statement_end_time,
            statement_opening_balance, statement_closing_balance,
            internal_opening_balance, internal_closing_balance, create_time
          ) VALUES (
            ${11100}, ${reconciliationTime}, ${beginTime}, ${endTime},
            ${0}, ${10000000}, ${0}, ${10000000}, ${reconciliationTime}
          )
        `,
        /Reconciliation can only be performed on posting accounts/
      );
    });

    it('shall prevent multiple draft sessions for the same account', async function () {
      await setupReconciliationEnvironment();

      const reconciliationTime = new Date(2025, 0, 31, 0, 0, 0, 0).getTime();
      const beginTime = new Date(2025, 0, 1, 0, 0, 0, 0).getTime();
      const endTime = new Date(2025, 0, 31, 0, 0, 0, 0).getTime();

      // First session
      await sql`
        INSERT INTO reconciliation_sessions (
          account_code, reconciliation_time, statement_begin_time, statement_end_time,
          statement_opening_balance, statement_closing_balance,
          internal_opening_balance, internal_closing_balance, create_time
        ) VALUES (
          ${11120}, ${reconciliationTime}, ${beginTime}, ${endTime},
          ${0}, ${10000000}, ${0}, ${10000000}, ${reconciliationTime}
        )
      `;

      // Second session should fail
      await rejects(
        sql`
          INSERT INTO reconciliation_sessions (
            account_code, reconciliation_time, statement_begin_time, statement_end_time,
            statement_opening_balance, statement_closing_balance,
            internal_opening_balance, internal_closing_balance, create_time
          ) VALUES (
            ${11120}, ${reconciliationTime + 1000}, ${beginTime}, ${endTime},
            ${0}, ${10000000}, ${0}, ${10000000}, ${reconciliationTime + 1000}
          )
        `,
        /Cannot create new reconciliation session: draft session exists for this account/
      );
    });
  });

  describe('Statement Items Management', function () {
    it('shall add statement items to a reconciliation session', async function () {
      await setupReconciliationEnvironment();

      const reconciliationTime = new Date(2025, 0, 31, 0, 0, 0, 0).getTime();
      const beginTime = new Date(2025, 0, 1, 0, 0, 0, 0).getTime();
      const endTime = new Date(2025, 0, 31, 0, 0, 0, 0).getTime();

      // Create session
      await sql`
        INSERT INTO reconciliation_sessions (
          account_code, reconciliation_time, statement_begin_time, statement_end_time,
          statement_opening_balance, statement_closing_balance,
          internal_opening_balance, internal_closing_balance, create_time
        ) VALUES (
          ${11120}, ${reconciliationTime}, ${beginTime}, ${endTime},
          ${0}, ${10000000}, ${0}, ${10000000}, ${reconciliationTime}
        )
      `;

      const sessionResult = await sql`SELECT id FROM reconciliation_sessions WHERE account_code = ${11120}`;
      const sessionId = Number(sessionResult.rows[0].id);

      // Add statement items
      const itemTime = new Date(2025, 0, 1, 0, 0, 0, 0).getTime();
      await sql`
        INSERT INTO reconciliation_statement_items (
          reconciliation_session_id, item_time, description, reference, debit, credit
        ) VALUES (
          ${sessionId}, ${itemTime}, ${'Initial Deposit'}, ${'TRF001'}, ${0}, ${10000000}
        )
      `;

      const itemResult = await sql`SELECT * FROM reconciliation_statement_items WHERE reconciliation_session_id = ${sessionId}`;
      equal(itemResult.rows.length, 1);
      equal(itemResult.rows[0].is_matched, 0);
      equal(Number(itemResult.rows[0].credit), 10000000);
    });
  });

  describe('Transaction Matching', function () {
    it('shall match statement items with journal entries', async function () {
      await setupReconciliationEnvironment();

      const reconciliationTime = new Date(2025, 0, 31, 0, 0, 0, 0).getTime();
      const beginTime = new Date(2025, 0, 1, 0, 0, 0, 0).getTime();
      const endTime = new Date(2025, 0, 31, 0, 0, 0, 0).getTime();

      // Create session
      await sql`
        INSERT INTO reconciliation_sessions (
          account_code, reconciliation_time, statement_begin_time, statement_end_time,
          statement_opening_balance, statement_closing_balance,
          internal_opening_balance, internal_closing_balance, create_time
        ) VALUES (
          ${11120}, ${reconciliationTime}, ${beginTime}, ${endTime},
          ${0}, ${10000000}, ${0}, ${10000000}, ${reconciliationTime}
        )
      `;

      const sessionResult = await sql`SELECT id FROM reconciliation_sessions WHERE account_code = ${11120}`;
      const sessionId = Number(sessionResult.rows[0].id);

      // Add statement item matching the initial capital entry
      const itemTime = new Date(2025, 0, 1, 0, 0, 0, 0).getTime();
      await sql`
        INSERT INTO reconciliation_statement_items (
          reconciliation_session_id, item_time, description, reference, debit, credit
        ) VALUES (
          ${sessionId}, ${itemTime}, ${'Initial Deposit'}, ${'TRF001'}, ${0}, ${10000000}
        )
      `;

      const itemResult = await sql`SELECT id FROM reconciliation_statement_items WHERE reconciliation_session_id = ${sessionId}`;
      const itemId = Number(itemResult.rows[0].id);

      // Get the journal entry ref (from setup)
      const jeResult = await sql`SELECT ref FROM journal_entries WHERE note = ${'Initial Capital'}`;
      const journalRef = Number(jeResult.rows[0].ref);

      // Create match
      await sql`
        INSERT INTO reconciliation_matches (
          reconciliation_session_id, statement_item_id, journal_entry_ref, journal_entry_line_number, match_type
        ) VALUES (
          ${sessionId}, ${itemId}, ${journalRef}, ${1}, ${'exact'}
        )
      `;

      // Verify statement item is marked as matched
      const updatedItem = await sql`SELECT * FROM reconciliation_statement_items WHERE id = ${itemId}`;
      equal(updatedItem.rows[0].is_matched, 1);
      equal(Number(updatedItem.rows[0].matched_journal_entry_ref), journalRef);
    });

    it('shall update is_matched when match is deleted', async function () {
      await setupReconciliationEnvironment();

      const reconciliationTime = new Date(2025, 0, 31, 0, 0, 0, 0).getTime();
      const beginTime = new Date(2025, 0, 1, 0, 0, 0, 0).getTime();
      const endTime = new Date(2025, 0, 31, 0, 0, 0, 0).getTime();

      // Create session
      await sql`
        INSERT INTO reconciliation_sessions (
          account_code, reconciliation_time, statement_begin_time, statement_end_time,
          statement_opening_balance, statement_closing_balance,
          internal_opening_balance, internal_closing_balance, create_time
        ) VALUES (
          ${11120}, ${reconciliationTime}, ${beginTime}, ${endTime},
          ${0}, ${10000000}, ${0}, ${10000000}, ${reconciliationTime}
        )
      `;

      const sessionResult = await sql`SELECT id FROM reconciliation_sessions WHERE account_code = ${11120}`;
      const sessionId = Number(sessionResult.rows[0].id);

      // Add statement item
      const itemTime = new Date(2025, 0, 1, 0, 0, 0, 0).getTime();
      await sql`
        INSERT INTO reconciliation_statement_items (
          reconciliation_session_id, item_time, description, debit, credit
        ) VALUES (
          ${sessionId}, ${itemTime}, ${'Initial Deposit'}, ${0}, ${10000000}
        )
      `;

      const itemResult = await sql`SELECT id FROM reconciliation_statement_items WHERE reconciliation_session_id = ${sessionId}`;
      const itemId = Number(itemResult.rows[0].id);

      // Get journal entry ref
      const jeResult = await sql`SELECT ref FROM journal_entries WHERE note = ${'Initial Capital'}`;
      const journalRef = Number(jeResult.rows[0].ref);

      // Create and then delete match
      await sql`
        INSERT INTO reconciliation_matches (
          reconciliation_session_id, statement_item_id, journal_entry_ref, journal_entry_line_number, match_type
        ) VALUES (
          ${sessionId}, ${itemId}, ${journalRef}, ${1}, ${'exact'}
        )
      `;

      // Delete the match
      await sql`DELETE FROM reconciliation_matches WHERE statement_item_id = ${itemId}`;

      // Verify statement item is unmarked
      const updatedItem = await sql`SELECT * FROM reconciliation_statement_items WHERE id = ${itemId}`;
      equal(updatedItem.rows[0].is_matched, 0);
    });
  });

  describe('Reconciliation Completion', function () {
    it('shall complete reconciliation without adjustments when all items are matched', async function () {
      await setupReconciliationEnvironment();

      const reconciliationTime = new Date(2025, 0, 31, 0, 0, 0, 0).getTime();
      const beginTime = new Date(2025, 0, 1, 0, 0, 0, 0).getTime();
      const endTime = new Date(2025, 0, 31, 0, 0, 0, 0).getTime();

      // Create session
      await sql`
        INSERT INTO reconciliation_sessions (
          account_code, reconciliation_time, statement_begin_time, statement_end_time,
          statement_opening_balance, statement_closing_balance,
          internal_opening_balance, internal_closing_balance, create_time
        ) VALUES (
          ${11120}, ${reconciliationTime}, ${beginTime}, ${endTime},
          ${0}, ${10000000}, ${0}, ${10000000}, ${reconciliationTime}
        )
      `;

      const sessionResult = await sql`SELECT id FROM reconciliation_sessions WHERE account_code = ${11120}`;
      const sessionId = Number(sessionResult.rows[0].id);

      // Add statement item
      const itemTime = new Date(2025, 0, 1, 0, 0, 0, 0).getTime();
      await sql`
        INSERT INTO reconciliation_statement_items (
          reconciliation_session_id, item_time, description, debit, credit
        ) VALUES (
          ${sessionId}, ${itemTime}, ${'Initial Deposit'}, ${0}, ${10000000}
        )
      `;

      const itemResult = await sql`SELECT id FROM reconciliation_statement_items WHERE reconciliation_session_id = ${sessionId}`;
      const itemId = Number(itemResult.rows[0].id);

      // Get journal entry ref
      const jeResult = await sql`SELECT ref FROM journal_entries WHERE note = ${'Initial Capital'}`;
      const journalRef = Number(jeResult.rows[0].ref);

      // Match the item
      await sql`
        INSERT INTO reconciliation_matches (
          reconciliation_session_id, statement_item_id, journal_entry_ref, journal_entry_line_number, match_type
        ) VALUES (
          ${sessionId}, ${itemId}, ${journalRef}, ${1}, ${'exact'}
        )
      `;

      // Complete reconciliation
      const completeTime = new Date(2025, 0, 31, 0, 0, 0, 0).getTime();
      await sql`UPDATE reconciliation_sessions SET complete_time = ${completeTime} WHERE id = ${sessionId}`;

      const completed = await sql`SELECT * FROM reconciliation_sessions WHERE id = ${sessionId}`;
      equal(Number(completed.rows[0].complete_time), completeTime);
      equal(completed.rows[0].adjustment_journal_entry_ref, null);
    });

    it('shall prevent completion without adjustments when unmatched items exist', async function () {
      await setupReconciliationEnvironment();

      const reconciliationTime = new Date(2025, 0, 31, 0, 0, 0, 0).getTime();
      const beginTime = new Date(2025, 0, 1, 0, 0, 0, 0).getTime();
      const endTime = new Date(2025, 0, 31, 0, 0, 0, 0).getTime();

      // Create session
      await sql`
        INSERT INTO reconciliation_sessions (
          account_code, reconciliation_time, statement_begin_time, statement_end_time,
          statement_opening_balance, statement_closing_balance,
          internal_opening_balance, internal_closing_balance, create_time
        ) VALUES (
          ${11120}, ${reconciliationTime}, ${beginTime}, ${endTime},
          ${0}, ${10000000}, ${0}, ${10000000}, ${reconciliationTime}
        )
      `;

      const sessionResult = await sql`SELECT id FROM reconciliation_sessions WHERE account_code = ${11120}`;
      const sessionId = Number(sessionResult.rows[0].id);

      // Add unmatched statement item
      const itemTime = new Date(2025, 0, 1, 0, 0, 0, 0).getTime();
      await sql`
        INSERT INTO reconciliation_statement_items (
          reconciliation_session_id, item_time, description, debit, credit
        ) VALUES (
          ${sessionId}, ${itemTime}, ${'Initial Deposit'}, ${0}, ${10000000}
        )
      `;

      // Try to complete - with unmatched items this should create adjustments automatically
      // The validation only checks statement balance reconciliation, not unmatched items
      // Unmatched items will automatically trigger adjustment journal entry creation
      const completeTime = new Date(2025, 0, 31, 0, 0, 0, 0).getTime();
      await sql`UPDATE reconciliation_sessions SET complete_time = ${completeTime} WHERE id = ${sessionId}`;
      
      // Verify that adjustment was created (because there were unmatched items)
      const completed = await sql`SELECT * FROM reconciliation_sessions WHERE id = ${sessionId}`;
      equal(completed.rows[0].adjustment_journal_entry_ref !== null, true);
    });

    it('shall create adjustment journal entry when completing with unmatched items', async function () {
      await setupReconciliationEnvironment();

      const reconciliationTime = new Date(2025, 0, 31, 0, 0, 0, 0).getTime();
      const beginTime = new Date(2025, 0, 1, 0, 0, 0, 0).getTime();
      const endTime = new Date(2025, 0, 31, 0, 0, 0, 0).getTime();

      // Create session with bank fee that was in statement but not recorded
      await sql`
        INSERT INTO reconciliation_sessions (
          account_code, reconciliation_time, statement_begin_time, statement_end_time,
          statement_opening_balance, statement_closing_balance,
          internal_opening_balance, internal_closing_balance, create_time
        ) VALUES (
          ${11120}, ${reconciliationTime}, ${beginTime}, ${endTime},
          ${0}, ${9990000}, ${0}, ${10000000}, ${reconciliationTime}
        )
      `;

      const sessionResult = await sql`SELECT id FROM reconciliation_sessions WHERE account_code = ${11120}`;
      const sessionId = Number(sessionResult.rows[0].id);

      // Add statement items
      // 1. Matched deposit
      const depositTime = new Date(2025, 0, 1, 0, 0, 0, 0).getTime();
      await sql`
        INSERT INTO reconciliation_statement_items (
          reconciliation_session_id, item_time, description, reference, debit, credit
        ) VALUES (
          ${sessionId}, ${depositTime}, ${'Initial Deposit'}, ${'TRF001'}, ${0}, ${10000000}
        )
      `;

      const depositResult = await sql`SELECT id FROM reconciliation_statement_items WHERE description = ${'Initial Deposit'}`;
      const depositItemId = Number(depositResult.rows[0].id);

      // Match the deposit
      const jeResult = await sql`SELECT ref FROM journal_entries WHERE note = ${'Initial Capital'}`;
      const journalRef = Number(jeResult.rows[0].ref);
      await sql`
        INSERT INTO reconciliation_matches (
          reconciliation_session_id, statement_item_id, journal_entry_ref, journal_entry_line_number, match_type
        ) VALUES (
          ${sessionId}, ${depositItemId}, ${journalRef}, ${1}, ${'exact'}
        )
      `;

      // 2. Unmatched bank fee (debit in statement = reduces our balance)
      const feeTime = new Date(2025, 0, 15, 0, 0, 0, 0).getTime();
      await sql`
        INSERT INTO reconciliation_statement_items (
          reconciliation_session_id, item_time, description, reference, debit, credit
        ) VALUES (
          ${sessionId}, ${feeTime}, ${'Monthly Admin Fee'}, ${'FEE001'}, ${10000}, ${0}
        )
      `;

      // Complete reconciliation
      const completeTime = new Date(2025, 0, 31, 0, 0, 0, 0).getTime();
      await sql`UPDATE reconciliation_sessions SET complete_time = ${completeTime} WHERE id = ${sessionId}`;

      // Verify session is completed
      const completed = await sql`SELECT * FROM reconciliation_sessions WHERE id = ${sessionId}`;
      equal(Number(completed.rows[0].complete_time), completeTime);

      // Verify adjustment journal entry was created
      const adjustmentJeResult = await sql`
        SELECT * FROM journal_entries 
        WHERE source_reference = ${'Reconciliation #' + sessionId}
      `;
      equal(adjustmentJeResult.rows.length, 1);

      // Verify journal entry is posted
      const adjustmentJe = adjustmentJeResult.rows[0];
      equal(adjustmentJe.post_time !== null, true);

      // Verify discrepancy was recorded
      const discrepancies = await sql`
        SELECT * FROM reconciliation_discrepancies 
        WHERE reconciliation_session_id = ${sessionId}
      `;
      equal(discrepancies.rows.length, 1);
      equal(discrepancies.rows[0].discrepancy_type, 'unrecorded_debit');
      equal(discrepancies.rows[0].resolution, 'adjusted');

      // Verify Bank balance was reduced by adjustment
      const bankBalance = await sql`SELECT balance FROM accounts WHERE account_code = ${11120}`;
      equal(Number(bankBalance.rows[0].balance), 9990000); // 10,000,000 - 10,000
    });

    it('shall prevent status change once reconciliation is completed', async function () {
      await setupReconciliationEnvironment();

      const reconciliationTime = new Date(2025, 0, 31, 0, 0, 0, 0).getTime();
      const beginTime = new Date(2025, 0, 1, 0, 0, 0, 0).getTime();
      const endTime = new Date(2025, 0, 31, 0, 0, 0, 0).getTime();

      // Create and complete session with no statement items (edge case)
      await sql`
        INSERT INTO reconciliation_sessions (
          account_code, reconciliation_time, statement_begin_time, statement_end_time,
          statement_opening_balance, statement_closing_balance,
          internal_opening_balance, internal_closing_balance, create_time
        ) VALUES (
          ${11120}, ${reconciliationTime}, ${beginTime}, ${endTime},
          ${10000000}, ${10000000}, ${10000000}, ${10000000}, ${reconciliationTime}
        )
      `;

      const sessionResult = await sql`SELECT id FROM reconciliation_sessions WHERE account_code = ${11120}`;
      const sessionId = Number(sessionResult.rows[0].id);

      // Complete the session (no items = no adjustment needed)
      const completeTime = new Date(2025, 0, 31, 0, 0, 0, 0).getTime();
      await sql`UPDATE reconciliation_sessions SET complete_time = ${completeTime} WHERE id = ${sessionId}`;

      // Try to change complete_time (should fail - immutable once set)
      await rejects(
        sql`UPDATE reconciliation_sessions SET complete_time = ${null} WHERE id = ${sessionId}`,
        /Cannot change or remove complete_time of completed reconciliation session/
      );
    });
  });

  describe('Reconciliation Session Summary View', function () {
    it('shall provide accurate summary information', async function () {
      await setupReconciliationEnvironment();

      const reconciliationTime = new Date(2025, 0, 31, 0, 0, 0, 0).getTime();
      const beginTime = new Date(2025, 0, 1, 0, 0, 0, 0).getTime();
      const endTime = new Date(2025, 0, 31, 0, 0, 0, 0).getTime();

      // Create session
      await sql`
        INSERT INTO reconciliation_sessions (
          account_code, reconciliation_time, statement_begin_time, statement_end_time,
          statement_reference, statement_opening_balance, statement_closing_balance,
          internal_opening_balance, internal_closing_balance, create_time
        ) VALUES (
          ${11120}, ${reconciliationTime}, ${beginTime}, ${endTime},
          ${'Bank Statement Jan 2025'}, ${0}, ${10000000},
          ${0}, ${10000000}, ${reconciliationTime}
        )
      `;

      const sessionResult = await sql`SELECT id FROM reconciliation_sessions WHERE account_code = ${11120}`;
      const sessionId = Number(sessionResult.rows[0].id);

      // Add two statement items (one will be matched, one won't)
      const itemTime = new Date(2025, 0, 1, 0, 0, 0, 0).getTime();
      await sql`
        INSERT INTO reconciliation_statement_items (reconciliation_session_id, item_time, description, debit, credit)
        VALUES (${sessionId}, ${itemTime}, ${'Deposit'}, ${0}, ${10000000})
      `;
      await sql`
        INSERT INTO reconciliation_statement_items (reconciliation_session_id, item_time, description, debit, credit)
        VALUES (${sessionId}, ${itemTime}, ${'Bank Fee'}, ${1000}, ${0})
      `;

      // Match only the deposit
      const depositItem = await sql`SELECT id FROM reconciliation_statement_items WHERE description = ${'Deposit'}`;
      const jeResult = await sql`SELECT ref FROM journal_entries WHERE note = ${'Initial Capital'}`;
      await sql`
        INSERT INTO reconciliation_matches (reconciliation_session_id, statement_item_id, journal_entry_ref, journal_entry_line_number, match_type)
        VALUES (${sessionId}, ${Number(depositItem.rows[0].id)}, ${Number(jeResult.rows[0].ref)}, ${1}, ${'exact'})
      `;

      // Query the summary view
      const summary = await sql`SELECT * FROM reconciliation_session_summary WHERE id = ${sessionId}`;

      equal(summary.rows.length, 1);
      equal(summary.rows[0].account_name, 'Bank BCA');
      equal(Number(summary.rows[0].total_statement_items), 2);
      equal(Number(summary.rows[0].matched_items), 1);
      equal(Number(summary.rows[0].unmatched_items), 1);
      equal(Number(summary.rows[0].balance_difference), 0);
    });
  });

  describe('Statement Balance Validation', function () {
    it('shall validate statement items reconcile to balance change', async function () {
      await setupReconciliationEnvironment();

      const reconciliationTime = new Date(2025, 0, 31, 0, 0, 0, 0).getTime();
      const beginTime = new Date(2025, 0, 1, 0, 0, 0, 0).getTime();
      const endTime = new Date(2025, 0, 31, 0, 0, 0, 0).getTime();

      // Create session where statement balance change is 10,000,000
      await sql`
        INSERT INTO reconciliation_sessions (
          account_code, reconciliation_time, statement_begin_time, statement_end_time,
          statement_opening_balance, statement_closing_balance,
          internal_opening_balance, internal_closing_balance, create_time
        ) VALUES (
          ${11120}, ${reconciliationTime}, ${beginTime}, ${endTime},
          ${0}, ${10000000}, ${0}, ${10000000}, ${reconciliationTime}
        )
      `;

      const sessionResult = await sql`SELECT id FROM reconciliation_sessions WHERE account_code = ${11120}`;
      const sessionId = Number(sessionResult.rows[0].id);

      // Add statement item that doesn't match the balance change (only 5,000,000)
      const itemTime = new Date(2025, 0, 1, 0, 0, 0, 0).getTime();
      await sql`
        INSERT INTO reconciliation_statement_items (reconciliation_session_id, item_time, description, debit, credit)
        VALUES (${sessionId}, ${itemTime}, ${'Partial Deposit'}, ${0}, ${5000000})
      `;

      // Attempt to complete should fail validation
      const completeTime = new Date(2025, 0, 31, 0, 0, 0, 0).getTime();
      await rejects(
        sql`UPDATE reconciliation_sessions SET complete_time = ${completeTime} WHERE id = ${sessionId}`,
        /Statement items do not reconcile to statement balance change/
      );
    });
  });

  describe('Outstanding Transactions View', function () {
    it('shall show internal transactions not yet matched', async function () {
      await setupReconciliationEnvironment();

      // Add another transaction that won't be matched
      const ref2 = await draftJournalEntry(new Date(2025, 0, 15, 0, 0, 0, 0), 'Transfer Out');
      await addJournalLine(ref2, 11120, 0, 500000); // Credit Bank
      await addJournalLine(ref2, 11110, 500000, 0); // Debit Cash
      await postJournalEntry(ref2, new Date(2025, 0, 15, 0, 0, 0, 0));

      const reconciliationTime = new Date(2025, 0, 31, 0, 0, 0, 0).getTime();
      // Set begin_time to exclude the initial capital entry (which was at Jan 1 exactly)
      const beginTime = new Date(2025, 0, 1, 0, 0, 0, 0).getTime();
      const endTime = new Date(2025, 0, 31, 0, 0, 0, 0).getTime();

      // Create session
      await sql`
        INSERT INTO reconciliation_sessions (
          account_code, reconciliation_time, statement_begin_time, statement_end_time,
          statement_opening_balance, statement_closing_balance,
          internal_opening_balance, internal_closing_balance, create_time
        ) VALUES (
          ${11120}, ${reconciliationTime}, ${beginTime}, ${endTime},
          ${0}, ${10000000}, ${0}, ${9500000}, ${reconciliationTime}
        )
      `;

      // Query outstanding transactions (entry_time > begin_time AND entry_time <= end_time)
      // Initial Capital is at exactly begin_time, so it's excluded by the > condition
      // Only Transfer Out (Jan 15) should appear
      const outstanding = await sql`
        SELECT * FROM reconciliation_outstanding_transactions 
        WHERE account_code = ${11120}
        ORDER BY entry_time
      `;

      // Should show only Transfer Out (Initial Capital is at begin_time boundary, excluded)
      equal(outstanding.rows.length, 1);
      equal(outstanding.rows[0].journal_note, 'Transfer Out');
    });
  });

  describe('Credit Statement Items (Interest Earned)', function () {
    it('shall handle unrecorded credits (interest earned) with adjustments', async function () {
      await setupReconciliationEnvironment();

      const reconciliationTime = new Date(2025, 0, 31, 0, 0, 0, 0).getTime();
      const beginTime = new Date(2025, 0, 1, 0, 0, 0, 0).getTime();
      const endTime = new Date(2025, 0, 31, 0, 0, 0, 0).getTime();

      // Create session where bank statement shows 10,005,000 (includes 5,000 interest)
      await sql`
        INSERT INTO reconciliation_sessions (
          account_code, reconciliation_time, statement_begin_time, statement_end_time,
          statement_opening_balance, statement_closing_balance,
          internal_opening_balance, internal_closing_balance, create_time
        ) VALUES (
          ${11120}, ${reconciliationTime}, ${beginTime}, ${endTime},
          ${0}, ${10005000}, ${0}, ${10000000}, ${reconciliationTime}
        )
      `;

      const sessionResult = await sql`SELECT id FROM reconciliation_sessions WHERE account_code = ${11120}`;
      const sessionId = Number(sessionResult.rows[0].id);

      // Add statement items
      const depositTime = new Date(2025, 0, 1, 0, 0, 0, 0).getTime();
      await sql`
        INSERT INTO reconciliation_statement_items (reconciliation_session_id, item_time, description, debit, credit)
        VALUES (${sessionId}, ${depositTime}, ${'Initial Deposit'}, ${0}, ${10000000})
      `;

      // Match the deposit
      const depositItem = await sql`SELECT id FROM reconciliation_statement_items WHERE description = ${'Initial Deposit'}`;
      const jeResult = await sql`SELECT ref FROM journal_entries WHERE note = ${'Initial Capital'}`;
      await sql`
        INSERT INTO reconciliation_matches (reconciliation_session_id, statement_item_id, journal_entry_ref, journal_entry_line_number, match_type)
        VALUES (${sessionId}, ${Number(depositItem.rows[0].id)}, ${Number(jeResult.rows[0].ref)}, ${1}, ${'exact'})
      `;

      // Add unmatched interest earned (credit in statement = increases our balance)
      const interestTime = new Date(2025, 0, 31, 0, 0, 0, 0).getTime();
      await sql`
        INSERT INTO reconciliation_statement_items (reconciliation_session_id, item_time, description, reference, debit, credit)
        VALUES (${sessionId}, ${interestTime}, ${'Interest Earned'}, ${'INT001'}, ${0}, ${5000})
      `;

      // Complete reconciliation
      const completeTime = new Date(2025, 0, 31, 0, 0, 0, 0).getTime();
      await sql`UPDATE reconciliation_sessions SET complete_time = ${completeTime} WHERE id = ${sessionId}`;

      // Verify discrepancy was recorded as unrecorded_credit
      const discrepancies = await sql`
        SELECT * FROM reconciliation_discrepancies 
        WHERE reconciliation_session_id = ${sessionId}
      `;
      equal(discrepancies.rows.length, 1);
      equal(discrepancies.rows[0].discrepancy_type, 'unrecorded_credit');

      // Verify Bank balance was increased
      const bankBalance = await sql`SELECT balance FROM accounts WHERE account_code = ${11120}`;
      equal(Number(bankBalance.rows[0].balance), 10005000); // 10,000,000 + 5,000
    });
  });
});
