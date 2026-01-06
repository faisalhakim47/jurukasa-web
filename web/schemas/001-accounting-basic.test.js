import { describe, it } from 'node:test';
import { equal, rejects } from 'node:assert/strict';

import { useLibSQLiteClient } from '#web/schemas/test/hooks/use-libsqlite-client.js';

describe('Accounting Schema Tests - Basic', function () {
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
  };

  /**
   * @param {number} code
   * @param {string} tag
   */
  async function addTag(code, tag) {
    await db().execute(
      `INSERT INTO account_tags (account_code, tag) VALUES (?, ?)`,
      [code, tag],
    );
  };

  /**
   * @param {Date} entryDate
   */
  async function draftJournalEntry(entryDate) {
    const result = await db().execute(
      `INSERT INTO journal_entries (entry_time) VALUES (?) RETURNING ref`,
      [entryDate.getTime()],
    );
    return Number(result.rows[0].ref);
  };

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
  };

  /**
   * @param {number} ref
   * @param {Date} postDate
   */
  async function postJournalEntry(ref, postDate) {
    await db().execute(
      `UPDATE journal_entries SET post_time = ? WHERE ref = ?`,
      [postDate.getTime(), ref],
    );
  };

  describe('Configuration', function () {
    it('shall have default configuration values', async function () {
      const result = await db().execute(`SELECT * FROM config WHERE key = 'Currency Code'`);
      equal(result.rows[0].value, 'IDR');
    });

    it('shall update configuration', async function () {
      await db().execute(
        `UPDATE config SET value = 'USD', update_time = ? WHERE key = 'Currency Code'`,
        [testTime]
      );
      const result = await db().execute(`SELECT * FROM config WHERE key = 'Currency Code'`);
      equal(result.rows[0].value, 'USD');
      equal(result.rows[0].update_time, testTime);
    });
  });

  describe('Chart of Accounts', function () {
    it('shall create accounts and maintain is_posting_account flag', async function () {
      // Create Parent
      await createAccount(1000, 'Assets', 0);
      let parent = (await db().execute(`SELECT * FROM accounts WHERE account_code = 1000`)).rows[0];
      equal(parent.is_posting_account, 1, 'Parent should be posting initially');

      // Create Child
      await createAccount(1100, 'Current Assets', 0, 1000);

      parent = (await db().execute(`SELECT * FROM accounts WHERE account_code = 1000`)).rows[0];
      const child = (await db().execute(`SELECT * FROM accounts WHERE account_code = 1100`)).rows[0];

      equal(parent.is_posting_account, 0, 'Parent should not be posting after adding child');
      equal(child.is_posting_account, 1, 'Child should be posting');
    });

    it('shall revert parent is_posting_account when child is deleted', async function () {
      await createAccount(1000, 'Assets', 0);
      await createAccount(1100, 'Current Assets', 0, 1000);

      await db().execute(`DELETE FROM accounts WHERE account_code = 1100`);

      const parent = (await db().execute(`SELECT * FROM accounts WHERE account_code = 1000`)).rows[0];
      equal(parent.is_posting_account, 1, 'Parent should revert to posting after child delete');
    });

    it('shall prevent setting control account if it has posted entries', async function () {
      await createAccount(1000, 'Cash', 0);
      await createAccount(2000, 'Equity', 1);

      // Post a transaction to Cash
      const ref = await draftJournalEntry(new Date(2025, 0, 1, 0, 0, 0, 0));
      await addJournalLine(ref, 1000, 100, 0);
      await addJournalLine(ref, 2000, 0, 100);
      await postJournalEntry(ref, new Date(2025, 0, 2, 0, 0, 0, 0));

      // Try to make Cash a parent of Petty Cash
      await rejects(
        createAccount(1100, 'Petty Cash', 0, 1000),
        /Cannot set control_account_code on insert: target control account has non-zero posted entries/
      );
    });
  });

  describe('Account Tags', function () {
    it('shall enforce unique tags where required', async function () {
      await createAccount(1000, 'Cash', 0);
      await createAccount(1100, 'Bank', 0);

      await addTag(1000, 'POS - Sales Revenue');

      await rejects(
        addTag(1100, 'POS - Sales Revenue'),
        /UNIQUE constraint failed: account_tags.tag/
      );
    });

    it('shall prevent updating tags', async function () {
      await createAccount(1000, 'Cash', 0);
      await addTag(1000, 'Asset');

      await rejects(
        db().execute(`UPDATE account_tags SET tag = 'Liability' WHERE account_code = 1000`),
        /Cannot update account_tags: tags are immutable/
      );
    });
  });

  describe('Journal Entries', function () {
    it('shall draft and post journal entry', async function () {
      await createAccount(1000, 'Cash', 0);
      await createAccount(4000, 'Sales', 1);

      const ref = await draftJournalEntry(new Date(2025, 0, 2, 0, 0, 0, 0));
      await addJournalLine(ref, 1000, 500, 0);
      await addJournalLine(ref, 4000, 0, 500);

      // Verify balances before post
      let cash = (await db().execute(`SELECT balance FROM accounts WHERE account_code = 1000`)).rows[0];
      equal(cash.balance, 0);

      await postJournalEntry(ref, new Date(2025, 0, 2, 0, 0, 0, 0));

      // Verify balances after post
      cash = (await db().execute(`SELECT balance FROM accounts WHERE account_code = 1000`)).rows[0];
      const sales = (await db().execute(`SELECT balance FROM accounts WHERE account_code = 4000`)).rows[0];

      equal(cash.balance, 500);
      equal(sales.balance, 500);
    });

    it('shall prevent posting unbalanced journal entry', async function () {
      await createAccount(1000, 'Cash', 0);
      const ref = await draftJournalEntry(new Date(2025, 0, 2, 0, 0, 0, 0));
      await addJournalLine(ref, 1000, 500, 0);

      await rejects(
        postJournalEntry(ref, new Date(2025, 0, 2, 0, 0, 0, 0)),
        /Journal entry does not balance/,
      );
    });

    it('shall prevent posting to control account', async function () {
      await createAccount(1000, 'Assets', 0);
      await createAccount(1100, 'Cash', 0, 1000); // 1000 is now control

      const ref = await draftJournalEntry(new Date(2025, 0, 2, 0, 0, 0, 0));

      await rejects(
        addJournalLine(ref, 1000, 1000, 0),
        /Cannot post journal entry line to a control account/,
      );
    });

    it('shall prevent modifying posted journal entry', async function () {
      await createAccount(1000, 'Cash', 0);
      await createAccount(4000, 'Sales', 1);

      const ref = await draftJournalEntry(new Date(2025, 0, 2, 0, 0, 0, 0));
      await addJournalLine(ref, 1000, 500, 0);
      await addJournalLine(ref, 4000, 0, 500);
      await postJournalEntry(ref, new Date(2025, 0, 2, 0, 0, 0, 0));

      // Try to delete
      await rejects(
        db().execute(`DELETE FROM journal_entries WHERE ref = ?`, [ref]),
        /Cannot delete posted journal entry/
      );

      // Try to unpost
      await rejects(
        db().execute(`UPDATE journal_entries SET post_time = NULL WHERE ref = ?`, [ref]),
        /Cannot unpost or change post_time of a posted journal entry/
      );

      // Try to add line
      // Note: Schema doesn't explicitly prevent INSERT on posted journal entry lines in the provided text,
      // but let's see if it's covered or if I need to add it.
      // If this fails (i.e., it allows insert), I will add the trigger.
    });
  });
});
