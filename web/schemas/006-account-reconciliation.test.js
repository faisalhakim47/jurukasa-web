import { describe, it } from 'node:test';
import { equal, rejects } from 'node:assert/strict';

import { useSql } from '#test/nodejs/hooks/use-sql.js';

describe('Account Reconciliation Schema Tests', function () {
  const sql = useSql();

  const testTime = new Date(2025, 0, 1, 0, 0, 0, 0).getTime();

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
    const isCashEquivalent = (await sql`SELECT 1 as v FROM account_tags WHERE account_code = ${accountCode} AND tag = 'Cash Flow - Cash Equivalents'`).rows.length > 0;
    if (isCashEquivalent) {
      await sql`INSERT INTO journal_entry_lines_auto_number (journal_entry_ref, account_code, debit, credit, cashflow_activity, cashflow_category)
        Values (${ref}, ${accountCode}, ${debit}, ${credit}, ${1}, ${1})`;
    } else {
      await sql`INSERT INTO journal_entry_lines_auto_number (journal_entry_ref, account_code, debit, credit)
        VALUES (${ref}, ${accountCode}, ${debit}, ${credit})`;
    }
  }

  /**
   * @param {number} ref
   * @param {Date} postDate
   */
  async function postJournalEntry(ref, postDate) {
    await sql`UPDATE journal_entries SET post_time = ${postDate.getTime()} WHERE ref = ${ref}`;
  }

  /**
   * Standard accounts for reconciliation testing.
   *
   * Accounts:
   *   11100  Kas & Bank           (control, debit-normal)
   *   11110  Kas                  (posting, debit-normal, tagged: Cash Flow - Cash Equivalents)
   *   11120  Bank BCA             (posting, debit-normal, tagged: Cash Flow - Cash Equivalents)
   *   30000  Ekuitas              (control, credit-normal)
   *   31000  Modal Pemilik        (posting, credit-normal)
   *   82000  Beban Lainnya        (control, debit-normal)
   *   82200  Penyesuaian Rekonsiliasi (posting, debit-normal, tagged: Reconciliation - Adjustment)
   *   82300  Selisih Kas          (posting, debit-normal, tagged: Reconciliation - Cash Over/Short)
   *
   * Initial balances after setup:
   *   Kas (11110):     500,000
   *   Bank BCA (11120): 10,000,000
   */
  async function setupEnvironment() {
    await createAccount(11100, 'Kas & Bank', 0);
    await createAccount(11110, 'Kas', 0, 11100);
    await createAccount(11120, 'Bank BCA', 0, 11100);
    await createAccount(30000, 'Ekuitas', 1);
    await createAccount(31000, 'Modal Pemilik', 1, 30000);
    await createAccount(82000, 'Beban Lainnya', 0);
    await createAccount(82200, 'Penyesuaian Rekonsiliasi', 0, 82000);
    await createAccount(82300, 'Selisih Kas', 0, 82000);

    await addTag(11110, 'Cash Flow - Cash Equivalents');
    await addTag(11120, 'Cash Flow - Cash Equivalents');
    await addTag(82200, 'Reconciliation - Adjustment');
    await addTag(82300, 'Reconciliation - Cash Over/Short');

    // Fund Kas with 500,000
    const ref1 = await draftJournalEntry(new Date(2025, 0, 1), 'Initial Capital - Cash');
    await addJournalLine(ref1, 11110, 500000, 0);
    await addJournalLine(ref1, 31000, 0, 500000);
    await postJournalEntry(ref1, new Date(2025, 0, 1));

    // Fund Bank BCA with 10,000,000
    const ref2 = await draftJournalEntry(new Date(2025, 0, 1), 'Initial Capital - Bank');
    await addJournalLine(ref2, 11120, 10000000, 0);
    await addJournalLine(ref2, 31000, 0, 10000000);
    await postJournalEntry(ref2, new Date(2025, 0, 1));
  }

  // ---------------------------------------------------------------------------
  // BALANCED (no discrepancy)
  // ---------------------------------------------------------------------------

  describe('Balanced reconciliation', function () {
    it('shall record a checkpoint with no adjustment entry when PHYSICAL count matches books', async function () {
      await setupEnvironment();

      const checkpointTime = new Date(2025, 0, 15, 18, 0, 0, 0).getTime();

      await sql`
        INSERT INTO reconciliation_checkpoints (account_code, type, checkpoint_time, external_balance, note, create_time)
        VALUES (${11110}, ${'PHYSICAL'}, ${checkpointTime}, ${500000}, ${'End of day count'}, ${checkpointTime})
      `;

      const rows = (await sql`SELECT * FROM reconciliation_checkpoints WHERE account_code = ${11110}`).rows;
      equal(rows.length, 1);
      equal(Number(rows[0].book_balance), 500000);
      equal(rows[0].adjustment_journal_entry_ref, null);

      // Cash balance must be unchanged
      const balance = (await sql`SELECT balance FROM accounts WHERE account_code = ${11110}`).rows[0];
      equal(Number(balance.balance), 500000);
    });

    it('shall record a checkpoint with no adjustment entry when STATEMENT balance matches books', async function () {
      await setupEnvironment();

      const checkpointTime = new Date(2025, 0, 31).getTime();

      await sql`
        INSERT INTO reconciliation_checkpoints (account_code, type, checkpoint_time, external_balance, create_time)
        VALUES (${11120}, ${'STATEMENT'}, ${checkpointTime}, ${10000000}, ${checkpointTime})
      `;

      const rows = (await sql`SELECT * FROM reconciliation_checkpoints WHERE account_code = ${11120}`).rows;
      equal(rows.length, 1);
      equal(Number(rows[0].book_balance), 10000000);
      equal(rows[0].adjustment_journal_entry_ref, null);
    });

    it('shall prevent modifying a reconciliation checkpoint after it is recorded', async function () {
      await setupEnvironment();

      const checkpointTime = new Date(2025, 0, 15, 18, 0, 0, 0).getTime();

      await sql`
        INSERT INTO reconciliation_checkpoints (account_code, type, checkpoint_time, external_balance, note, create_time)
        VALUES (${11110}, ${'PHYSICAL'}, ${checkpointTime}, ${500000}, ${'Immutable checkpoint'}, ${checkpointTime})
      `;

      await rejects(
        sql`
          UPDATE reconciliation_checkpoints
          SET external_balance = ${480000}, book_balance = ${480000}, note = ${'rewritten'}
          WHERE account_code = ${11110}
        `,
        /Reconciliation checkpoints are immutable once recorded/
      );

      const checkpoint = (await sql`
        SELECT external_balance, book_balance, note
        FROM reconciliation_checkpoints
        WHERE account_code = ${11110}
      `).rows[0];
      equal(Number(checkpoint.external_balance), 500000);
      equal(Number(checkpoint.book_balance), 500000);
      equal(checkpoint.note, 'Immutable checkpoint');
    });

    it('shall prevent deleting a reconciliation checkpoint after it is recorded', async function () {
      await setupEnvironment();

      const checkpointTime = new Date(2025, 0, 15, 18, 0, 0, 0).getTime();

      await sql`
        INSERT INTO reconciliation_checkpoints (account_code, type, checkpoint_time, external_balance, create_time)
        VALUES (${11110}, ${'PHYSICAL'}, ${checkpointTime}, ${500000}, ${checkpointTime})
      `;

      await rejects(
        sql`DELETE FROM reconciliation_checkpoints WHERE account_code = ${11110}`,
        /Reconciliation checkpoints cannot be deleted once recorded/
      );

      const count = (await sql`
        SELECT COUNT(*) AS count
        FROM reconciliation_checkpoints
        WHERE account_code = ${11110}
      `).rows[0];
      equal(Number(count.count), 1);
    });

    it('shall reject reconciliation checkpoint with non-positive checkpoint_time', async function () {
      await setupEnvironment();

      await rejects(
        sql`
          INSERT INTO reconciliation_checkpoints (account_code, type, checkpoint_time, external_balance, create_time)
          VALUES (${11110}, ${'PHYSICAL'}, ${0}, ${500000}, ${testTime})
        `,
        /Checkpoint time must be positive/
      );

      const count = (await sql`
        SELECT COUNT(*) AS count
        FROM reconciliation_checkpoints
      `).rows[0];
      equal(Number(count.count), 0);
    });
  });

  // ---------------------------------------------------------------------------
  // PHYSICAL — Cash Count
  // ---------------------------------------------------------------------------

  describe('Physical cash count (PHYSICAL type)', function () {
    it('shall handle cash shortage: counted less than books → CR cash, DR Cash Over/Short', async function () {
      await setupEnvironment();

      const checkpointTime = new Date(2025, 0, 15, 18, 0, 0, 0).getTime();

      // Counted 450,000 but books say 500,000 → shortage of 50,000
      await sql`
        INSERT INTO reconciliation_checkpoints (account_code, type, checkpoint_time, external_balance, note, adjustment_journal_entry_ref, create_time)
        VALUES (${11110}, ${'PHYSICAL'}, ${checkpointTime}, ${450000}, ${'Cash shortage detected'}, ${genJeRef()}, ${checkpointTime})
      `;

      const cp = (await sql`SELECT * FROM reconciliation_checkpoints WHERE account_code = ${11110}`).rows[0];
      equal(Number(cp.book_balance), 500000);
      equal(Number(cp.external_balance), 450000);
      equal(cp.adjustment_journal_entry_ref !== null, true);

      // Verify adjustment journal entry lines
      const lines = (await sql`
        SELECT * FROM journal_entry_lines
        WHERE journal_entry_ref = ${cp.adjustment_journal_entry_ref}
        ORDER BY line_number
      `).rows;
      equal(lines.length, 2);

      // Line 1: Cash account (11110) credited to reduce balance
      equal(Number(lines[0].account_code), 11110);
      equal(Number(lines[0].debit), 0);
      equal(Number(lines[0].credit), 50000);

      // Line 2: Cash Over/Short (82300) debited to record the shortage expense
      equal(Number(lines[1].account_code), 82300);
      equal(Number(lines[1].debit), 50000);
      equal(Number(lines[1].credit), 0);

      // Cash balance must be reduced to 450,000
      const cashBal = (await sql`SELECT balance FROM accounts WHERE account_code = ${11110}`).rows[0];
      equal(Number(cashBal.balance), 450000);

      // Cash Over/Short must have debit balance of 50,000
      const overShortBal = (await sql`SELECT balance FROM accounts WHERE account_code = ${82300}`).rows[0];
      equal(Number(overShortBal.balance), 50000);
    });

    it('shall handle cash overage: counted more than books → DR cash, CR Cash Over/Short', async function () {
      await setupEnvironment();

      const checkpointTime = new Date(2025, 0, 15, 18, 0, 0, 0).getTime();

      // Counted 550,000 but books say 500,000 → overage of 50,000
      await sql`
        INSERT INTO reconciliation_checkpoints (account_code, type, checkpoint_time, external_balance, note, adjustment_journal_entry_ref, create_time)
        VALUES (${11110}, ${'PHYSICAL'}, ${checkpointTime}, ${550000}, ${'Found extra cash'}, ${genJeRef()}, ${checkpointTime})
      `;

      const cp = (await sql`SELECT * FROM reconciliation_checkpoints WHERE account_code = ${11110}`).rows[0];
      equal(Number(cp.book_balance), 500000);

      const lines = (await sql`
        SELECT * FROM journal_entry_lines
        WHERE journal_entry_ref = ${cp.adjustment_journal_entry_ref}
        ORDER BY line_number
      `).rows;
      equal(lines.length, 2);

      // Line 1: Cash account (11110) debited to increase balance
      equal(Number(lines[0].account_code), 11110);
      equal(Number(lines[0].debit), 50000);
      equal(Number(lines[0].credit), 0);

      // Line 2: Cash Over/Short (82300) credited (overage is a gain)
      equal(Number(lines[1].account_code), 82300);
      equal(Number(lines[1].debit), 0);
      equal(Number(lines[1].credit), 50000);

      // Cash balance must be increased to 550,000
      const cashBal = (await sql`SELECT balance FROM accounts WHERE account_code = ${11110}`).rows[0];
      equal(Number(cashBal.balance), 550000);
    });

    it('shall prevent physical count on non-posting accounts', async function () {
      await setupEnvironment();

      const checkpointTime = new Date(2025, 0, 15, 18, 0, 0, 0).getTime();

      await rejects(
        sql`
          INSERT INTO reconciliation_checkpoints (account_code, type, checkpoint_time, external_balance, create_time)
          VALUES (${11100}, ${'PHYSICAL'}, ${checkpointTime}, ${500000}, ${checkpointTime})
        `,
        /Reconciliation can only be performed on posting accounts/
      );
    });

    it('shall prevent physical count on non-cash accounts', async function () {
      await setupEnvironment();

      // 82200 is a posting account but does NOT have Cash Flow - Cash Equivalents tag
      const checkpointTime = new Date(2025, 0, 15, 18, 0, 0, 0).getTime();

      await rejects(
        sql`
          INSERT INTO reconciliation_checkpoints (account_code, type, checkpoint_time, external_balance, create_time)
          VALUES (${82200}, ${'PHYSICAL'}, ${checkpointTime}, ${0}, ${checkpointTime})
        `,
        /Physical cash count can only be performed on cash\/bank accounts/
      );
    });

    it('shall prevent physical count when no Cash Over/Short account is tagged', async function () {
      // Setup WITHOUT the Cash Over/Short tag
      await createAccount(11100, 'Kas & Bank', 0);
      await createAccount(11110, 'Kas', 0, 11100);
      await createAccount(30000, 'Ekuitas', 1);
      await createAccount(31000, 'Modal Pemilik', 1, 30000);
      await createAccount(82000, 'Beban Lainnya', 0);
      await createAccount(82200, 'Penyesuaian Rekonsiliasi', 0, 82000);
      // No 82300 / Reconciliation - Cash Over/Short tag
      await addTag(11110, 'Cash Flow - Cash Equivalents');
      await addTag(82200, 'Reconciliation - Adjustment');

      const ref = await draftJournalEntry(new Date(2025, 0, 1), 'Capital');
      await addJournalLine(ref, 11110, 500000, 0);
      await addJournalLine(ref, 31000, 0, 500000);
      await postJournalEntry(ref, new Date(2025, 0, 1));

      const checkpointTime = new Date(2025, 0, 15).getTime();

      await rejects(
        sql`
          INSERT INTO reconciliation_checkpoints (account_code, type, checkpoint_time, external_balance, create_time)
          VALUES (${11110}, ${'PHYSICAL'}, ${checkpointTime}, ${400000}, ${checkpointTime})
        `,
        /No account tagged Reconciliation - Cash Over\/Short found/
      );
    });

    it('shall require adjustment_journal_entry_ref when a physical discrepancy exists', async function () {
      await setupEnvironment();

      const checkpointTime = new Date(2025, 0, 15, 18, 0, 0, 0).getTime();

      await rejects(
        sql`
          INSERT INTO reconciliation_checkpoints (account_code, type, checkpoint_time, external_balance, create_time)
          VALUES (${11110}, ${'PHYSICAL'}, ${checkpointTime}, ${450000}, ${checkpointTime})
        `,
        /adjustment_journal_entry_ref is required when reconciliation discrepancy exists/
      );
    });
  });

  // ---------------------------------------------------------------------------
  // STATEMENT — Bank Reconciliation
  // ---------------------------------------------------------------------------

  describe('Bank statement reconciliation (STATEMENT type)', function () {
    it('shall handle statement shortage: statement less than books → CR bank, DR Adjustment', async function () {
      await setupEnvironment();

      const checkpointTime = new Date(2025, 0, 31).getTime();

      // Bank statement shows 9,500,000 but books show 10,000,000 → shortage of 500,000
      await sql`
        INSERT INTO reconciliation_checkpoints (account_code, type, checkpoint_time, external_balance, note, adjustment_journal_entry_ref, create_time)
        VALUES (${11120}, ${'STATEMENT'}, ${checkpointTime}, ${9500000}, ${'Jan bank statement'}, ${genJeRef()}, ${checkpointTime})
      `;

      const cp = (await sql`SELECT * FROM reconciliation_checkpoints WHERE account_code = ${11120}`).rows[0];
      equal(Number(cp.book_balance), 10000000);
      equal(Number(cp.external_balance), 9500000);
      equal(cp.adjustment_journal_entry_ref !== null, true);

      const lines = (await sql`
        SELECT * FROM journal_entry_lines
        WHERE journal_entry_ref = ${cp.adjustment_journal_entry_ref}
        ORDER BY line_number
      `).rows;
      equal(lines.length, 2);

      // Line 1: Bank BCA (11120) credited to reduce balance
      equal(Number(lines[0].account_code), 11120);
      equal(Number(lines[0].debit), 0);
      equal(Number(lines[0].credit), 500000);

      // Line 2: Reconciliation Adjustment (82200) debited (unrecorded debit)
      equal(Number(lines[1].account_code), 82200);
      equal(Number(lines[1].debit), 500000);
      equal(Number(lines[1].credit), 0);

      // Bank balance must be reduced to 9,500,000
      const bankBal = (await sql`SELECT balance FROM accounts WHERE account_code = ${11120}`).rows[0];
      equal(Number(bankBal.balance), 9500000);
    });

    it('shall handle statement overage: statement more than books → DR bank, CR Adjustment', async function () {
      await setupEnvironment();

      const checkpointTime = new Date(2025, 0, 31).getTime();

      // Bank statement shows 10,500,000 but books show 10,000,000 → overage of 500,000
      await sql`
        INSERT INTO reconciliation_checkpoints (account_code, type, checkpoint_time, external_balance, note, adjustment_journal_entry_ref, create_time)
        VALUES (${11120}, ${'STATEMENT'}, ${checkpointTime}, ${10500000}, ${'Interest credited'}, ${genJeRef()}, ${checkpointTime})
      `;

      const cp = (await sql`SELECT * FROM reconciliation_checkpoints WHERE account_code = ${11120}`).rows[0];

      const lines = (await sql`
        SELECT * FROM journal_entry_lines
        WHERE journal_entry_ref = ${cp.adjustment_journal_entry_ref}
        ORDER BY line_number
      `).rows;
      equal(lines.length, 2);

      // Line 1: Bank BCA (11120) debited to increase balance
      equal(Number(lines[0].account_code), 11120);
      equal(Number(lines[0].debit), 500000);
      equal(Number(lines[0].credit), 0);

      // Line 2: Reconciliation Adjustment (82200) credited (unrecorded credit)
      equal(Number(lines[1].account_code), 82200);
      equal(Number(lines[1].debit), 0);
      equal(Number(lines[1].credit), 500000);

      // Bank balance must be increased to 10,500,000
      const bankBal = (await sql`SELECT balance FROM accounts WHERE account_code = ${11120}`).rows[0];
      equal(Number(bankBal.balance), 10500000);
    });

    it('shall prevent statement reconciliation on non-posting accounts', async function () {
      await setupEnvironment();

      const checkpointTime = new Date(2025, 0, 31).getTime();

      await rejects(
        sql`
          INSERT INTO reconciliation_checkpoints (account_code, type, checkpoint_time, external_balance, create_time)
          VALUES (${11100}, ${'STATEMENT'}, ${checkpointTime}, ${10000000}, ${checkpointTime})
        `,
        /Reconciliation can only be performed on posting accounts/
      );
    });

    it('shall prevent statement reconciliation when no Reconciliation Adjustment account is tagged', async function () {
      // Setup WITHOUT the Reconciliation - Adjustment tag
      await createAccount(11100, 'Kas & Bank', 0);
      await createAccount(11120, 'Bank BCA', 0, 11100);
      await createAccount(30000, 'Ekuitas', 1);
      await createAccount(31000, 'Modal Pemilik', 1, 30000);
      // No Reconciliation - Adjustment tagged account

      const ref = await draftJournalEntry(new Date(2025, 0, 1), 'Capital');
      await addJournalLine(ref, 11120, 10000000, 0);
      await addJournalLine(ref, 31000, 0, 10000000);
      await postJournalEntry(ref, new Date(2025, 0, 1));

      const checkpointTime = new Date(2025, 0, 31).getTime();

      await rejects(
        sql`
          INSERT INTO reconciliation_checkpoints (account_code, type, checkpoint_time, external_balance, create_time)
          VALUES (${11120}, ${'STATEMENT'}, ${checkpointTime}, ${9000000}, ${checkpointTime})
        `,
        /No account tagged Reconciliation - Adjustment found/
      );
    });

    it('shall require adjustment_journal_entry_ref when a statement discrepancy exists', async function () {
      await setupEnvironment();

      const checkpointTime = new Date(2025, 0, 31).getTime();

      await rejects(
        sql`
          INSERT INTO reconciliation_checkpoints (account_code, type, checkpoint_time, external_balance, create_time)
          VALUES (${11120}, ${'STATEMENT'}, ${checkpointTime}, ${9500000}, ${checkpointTime})
        `,
        /adjustment_journal_entry_ref is required when reconciliation discrepancy exists/
      );
    });

    it('shall prevent clearing adjustment_journal_entry_ref after a discrepant checkpoint is recorded', async function () {
      await setupEnvironment();

      const checkpointTime = new Date(2025, 0, 31).getTime();
      const adjustmentRef = genJeRef();

      await sql`
        INSERT INTO reconciliation_checkpoints (account_code, type, checkpoint_time, external_balance, note, adjustment_journal_entry_ref, create_time)
        VALUES (${11120}, ${'STATEMENT'}, ${checkpointTime}, ${9500000}, ${'Jan bank statement'}, ${adjustmentRef}, ${checkpointTime})
      `;

      await rejects(
        sql`
          UPDATE reconciliation_checkpoints
          SET adjustment_journal_entry_ref = ${null}
          WHERE account_code = ${11120}
        `,
        /Reconciliation checkpoints are immutable once recorded/
      );

      const checkpoint = (await sql`
        SELECT adjustment_journal_entry_ref
        FROM reconciliation_checkpoints
        WHERE account_code = ${11120}
      `).rows[0];
      equal(Number(checkpoint.adjustment_journal_entry_ref), adjustmentRef);

      const journalEntry = (await sql`
        SELECT reconciliation_id, post_time
        FROM journal_entries
        WHERE ref = ${adjustmentRef}
      `).rows[0];
      equal(Number(journalEntry.reconciliation_id), 1);
      equal(Number(journalEntry.post_time), checkpointTime);
    });

    it('shall use factual book balance as of checkpoint_time', async function () {
      await setupEnvironment();

      const checkpointTime = new Date(2025, 0, 31, 23, 0, 0, 0).getTime();

      const febDepositRef = await draftJournalEntry(new Date(2025, 1, 1, 10, 0, 0, 0), 'February deposit');
      await addJournalLine(febDepositRef, 11120, 500000, 0);
      await addJournalLine(febDepositRef, 31000, 0, 500000);
      await postJournalEntry(febDepositRef, new Date(2025, 1, 1, 10, 0, 0, 0));

      const latePostedRef = await draftJournalEntry(new Date(2025, 0, 30, 9, 0, 0, 0), 'Backdated late post');
      await addJournalLine(latePostedRef, 11120, 700000, 0);
      await addJournalLine(latePostedRef, 31000, 0, 700000);
      await postJournalEntry(latePostedRef, new Date(2025, 1, 2, 8, 0, 0, 0));

      await sql`
        INSERT INTO reconciliation_checkpoints (account_code, type, checkpoint_time, external_balance, adjustment_journal_entry_ref, create_time)
        VALUES (${11120}, ${'STATEMENT'}, ${checkpointTime}, ${10000000}, ${genJeRef()}, ${new Date(2025, 2, 1, 0, 0, 0, 0).getTime()})
      `;

      const cp = (await sql`SELECT * FROM reconciliation_checkpoints WHERE account_code = ${11120}`).rows[0];
      equal(Number(cp.book_balance), 10000000);
      equal(cp.adjustment_journal_entry_ref, null);
    });
  });

  // ---------------------------------------------------------------------------
  // RECONCILIATION HISTORY VIEW
  // ---------------------------------------------------------------------------

  describe('Reconciliation history view', function () {
    it('shall display reconciliation checkpoints with computed discrepancy', async function () {
      await setupEnvironment();

      const checkpointTime = new Date(2025, 0, 15, 18, 0, 0, 0).getTime();

      await sql`
        INSERT INTO reconciliation_checkpoints (account_code, type, checkpoint_time, external_balance, note, adjustment_journal_entry_ref, create_time)
        VALUES (${11110}, ${'PHYSICAL'}, ${checkpointTime}, ${480000}, ${'Slight shortage'}, ${genJeRef()}, ${checkpointTime})
      `;

      const history = (await sql`SELECT * FROM reconciliation_history WHERE account_code = ${11110}`).rows;
      equal(history.length, 1);
      equal(Number(history[0].book_balance), 500000);
      equal(Number(history[0].external_balance), 480000);
      equal(Number(history[0].discrepancy), -20000);
      equal(history[0].discrepancy_type, 'shortage');
      equal(history[0].type, 'PHYSICAL');
    });

    it('shall show balanced discrepancy_type when no adjustment is needed', async function () {
      await setupEnvironment();

      const checkpointTime = new Date(2025, 0, 15, 18, 0, 0, 0).getTime();

      await sql`
        INSERT INTO reconciliation_checkpoints (account_code, type, checkpoint_time, external_balance, create_time)
        VALUES (${11110}, ${'PHYSICAL'}, ${checkpointTime}, ${500000}, ${checkpointTime})
      `;

      const history = (await sql`SELECT * FROM reconciliation_history WHERE account_code = ${11110}`).rows;
      equal(Number(history[0].discrepancy), 0);
      equal(history[0].discrepancy_type, 'balanced');
      equal(history[0].adjustment_journal_entry_ref, null);
    });
  });
});
