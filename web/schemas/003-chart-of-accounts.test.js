import { describe, it } from 'node:test';
import { deepEqual, equal, ok, rejects } from 'node:assert/strict';

import { useSql } from '#test/nodejs/hooks/use-sql.js';

describe('Chart of Accounts Template Tests', function () {
  const sql = useSql();

  describe('Template Insertion', function () {
    it('shall create all accounts from Retail Business - Indonesia template', async function () {
      await sql`INSERT INTO chart_of_accounts_templates (name) VALUES ('Retail Business - Indonesia')`;

      const accounts = (await sql`SELECT COUNT(*) as count FROM accounts`).rows[0];
      // Template defines accounts from 10000 to 82300
      ok(Number(accounts.count) > 0, 'Accounts should be created');

      // Verify some key accounts exist
      const cash = (await sql`SELECT * FROM accounts WHERE account_code = 11110`).rows[0];
      equal(cash.name, 'Kas');
      equal(cash.normal_balance, 0);

      const payable = (await sql`SELECT * FROM accounts WHERE account_code = 21100`).rows[0];
      equal(payable.name, 'Utang Usaha');
      equal(payable.normal_balance, 1);

      const equity = (await sql`SELECT * FROM accounts WHERE account_code = 31000`).rows[0];
      equal(equity.name, 'Modal Pemilik');
      equal(equity.normal_balance, 1);

      const revenue = (await sql`SELECT * FROM accounts WHERE account_code = 41000`).rows[0];
      equal(revenue.name, 'Penjualan');
      equal(revenue.normal_balance, 1);
    });

    it('shall reject unknown template name', async function () {
      await rejects(
        sql`INSERT INTO chart_of_accounts_templates (name) VALUES ('Nonexistent Template')`,
        /Chart of Accounts template not found/,
      );
    });

    it('shall reject applying the same template twice', async function () {
      await sql`INSERT INTO chart_of_accounts_templates (name) VALUES ('Retail Business - Indonesia')`;

      await rejects(
        sql`INSERT INTO chart_of_accounts_templates (name) VALUES ('Retail Business - Indonesia')`,
        /Chart of Accounts template cannot be applied: chart is already initialized or partially populated/,
      );
    });

    it('shall reject applying the template when accounts are partially populated outside sentinel codes', async function () {
      await sql`
        INSERT INTO accounts (account_code, name, normal_balance, create_time, update_time)
        VALUES (${11120}, ${'Preexisting BCA'}, ${0}, ${0}, ${0})
      `;

      await rejects(
        sql`INSERT INTO chart_of_accounts_templates (name) VALUES ('Retail Business - Indonesia')`,
        /Chart of Accounts template cannot be applied: chart is already initialized or partially populated/,
      );
    });
  });

  describe('Account Hierarchy', function () {
    it('shall set is_posting_account correctly for parent and leaf accounts', async function () {
      await sql`INSERT INTO chart_of_accounts_templates (name) VALUES ('Retail Business - Indonesia')`;

      // Top-level parent (10000 Aset) should not be a posting account
      const aset = (await sql`SELECT * FROM accounts WHERE account_code = 10000`).rows[0];
      equal(aset.is_posting_account, 0, 'Top-level parent should not be a posting account');

      // Mid-level parent (11000 Aset Lancar) should not be a posting account
      const asetLancar = (await sql`SELECT * FROM accounts WHERE account_code = 11000`).rows[0];
      equal(asetLancar.is_posting_account, 0, 'Mid-level parent should not be a posting account');

      // Leaf account (11110 Kas) should be a posting account
      const kas = (await sql`SELECT * FROM accounts WHERE account_code = 11110`).rows[0];
      equal(kas.is_posting_account, 1, 'Leaf account should be a posting account');

      // Verify control_account_code hierarchy
      equal(kas.control_account_code, 11100, 'Kas should be under Kas & Bank');
      const kasBank = (await sql`SELECT * FROM accounts WHERE account_code = 11100`).rows[0];
      equal(kasBank.control_account_code, 11000, 'Kas & Bank should be under Aset Lancar');
    });
  });

  describe('Account Tags', function () {
    it('shall assign all required POS system tags', async function () {
      await sql`INSERT INTO chart_of_accounts_templates (name) VALUES ('Retail Business - Indonesia')`;

      const requiredTags = [
        { code: 21100, tag: 'POS - Accounts Payable' },
        { code: 61700, tag: 'POS - Bank Fees' },
        { code: 41000, tag: 'POS - Sales Revenue' },
        { code: 42000, tag: 'POS - Sales Discount' },
        { code: 51000, tag: 'POS - Cost of Goods Sold' },
        { code: 81100, tag: 'POS - Inventory Gain' },
        { code: 61800, tag: 'POS - Inventory Shrinkage' },
        { code: 11310, tag: 'POS - Inventory' },
      ];

      for (const { code, tag } of requiredTags) {
        const result = await sql`SELECT 1 as v FROM account_tags WHERE account_code = ${code} AND tag = ${tag}`;
        equal(result.rows.length, 1, `Account ${code} should have tag '${tag}'`);
      }
    });

    it('shall assign fiscal year closing tags', async function () {
      await sql`INSERT INTO chart_of_accounts_templates (name) VALUES ('Retail Business - Indonesia')`;

      // Retained earnings
      const re = await sql`SELECT account_code FROM account_tags WHERE tag = 'Fiscal Year Closing - Retained Earning'`;
      equal(re.rows.length, 1, 'Exactly one account should be tagged as Retained Earning');
      equal(re.rows[0].account_code, 32000);

      // Revenue accounts (credit-normal)
      const revenue = await sql`SELECT account_code FROM account_tags WHERE tag = 'Fiscal Year Closing - Revenue' ORDER BY account_code`;
      ok(revenue.rows.length > 0, 'Should have revenue-tagged accounts');
      for (const row of revenue.rows) {
        const acct = (await sql`SELECT normal_balance FROM accounts WHERE account_code = ${row.account_code}`).rows[0];
        equal(acct.normal_balance, 1, `Revenue-closing tagged account ${row.account_code} should be credit-normal`);
      }

      // Expense accounts (debit-normal) — includes contra-revenue (42000)
      const expense = await sql`SELECT account_code FROM account_tags WHERE tag = 'Fiscal Year Closing - Expense' ORDER BY account_code`;
      ok(expense.rows.length > 0, 'Should have expense-tagged accounts');
      for (const row of expense.rows) {
        const acct = (await sql`SELECT normal_balance FROM accounts WHERE account_code = ${row.account_code}`).rows[0];
        equal(acct.normal_balance, 0, `Expense-closing tagged account ${row.account_code} should be debit-normal`);
      }

      // Dividend
      const dividend = await sql`SELECT account_code FROM account_tags WHERE tag = 'Fiscal Year Closing - Dividend'`;
      equal(dividend.rows.length, 1);
      equal(dividend.rows[0].account_code, 33000);
    });

    it('shall assign all payment method tags', async function () {
      await sql`INSERT INTO chart_of_accounts_templates (name) VALUES ('Retail Business - Indonesia')`;

      const paymentMethods = await sql`SELECT account_code FROM account_tags WHERE tag = 'POS - Payment Method' ORDER BY account_code`;
      equal(paymentMethods.rows.length, 4, 'Should have 4 payment method accounts');
      equal(paymentMethods.rows[0].account_code, 11110); // Kas
      equal(paymentMethods.rows[1].account_code, 11120); // Bank BCA
      equal(paymentMethods.rows[2].account_code, 11130); // Bank Mandiri
      equal(paymentMethods.rows[3].account_code, 11140); // QRIS / E-Wallet
    });

    it('shall assign cash flow tags to cash equivalent accounts', async function () {
      await sql`INSERT INTO chart_of_accounts_templates (name) VALUES ('Retail Business - Indonesia')`;

      const cashEquivalents = await sql`SELECT account_code FROM account_tags WHERE tag = 'Cash Flow - Cash Equivalents' ORDER BY account_code`;
      equal(cashEquivalents.rows.length, 4);
      equal(cashEquivalents.rows[0].account_code, 11110);
      equal(cashEquivalents.rows[1].account_code, 11120);
      equal(cashEquivalents.rows[2].account_code, 11130);
      equal(cashEquivalents.rows[3].account_code, 11140);
    });

    it('shall assign reconciliation tags', async function () {
      await sql`INSERT INTO chart_of_accounts_templates (name) VALUES ('Retail Business - Indonesia')`;

      const adjustment = await sql`SELECT account_code FROM account_tags WHERE tag = 'Reconciliation - Adjustment'`;
      equal(adjustment.rows.length, 1);
      equal(adjustment.rows[0].account_code, 82200);

      const cashOverShort = await sql`SELECT account_code FROM account_tags WHERE tag = 'Reconciliation - Cash Over/Short'`;
      equal(cashOverShort.rows.length, 1);
      equal(cashOverShort.rows[0].account_code, 82300);
    });
  });

  describe('Balance Sheet Tag Coverage', function () {
    it('shall assign exactly one balance sheet tag to each balance sheet posting account', async function () {
      await sql`INSERT INTO chart_of_accounts_templates (name) VALUES ('Retail Business - Indonesia')`;

      const invalidBalanceSheetPostingAccounts = await sql`
        SELECT a.account_code, COUNT(at.tag) as balance_sheet_tag_count
        FROM accounts a
        LEFT JOIN account_tags at
          ON at.account_code = a.account_code
         AND at.tag LIKE 'Balance Sheet -%'
        WHERE a.is_posting_account = 1
          AND a.account_code < 40000
        GROUP BY a.account_code
        HAVING balance_sheet_tag_count != 1
      `;
      equal(
        invalidBalanceSheetPostingAccounts.rows.length,
        0,
        'Each asset, liability, and equity posting account should have exactly one Balance Sheet tag'
      );

      const nonBalanceSheetPostingAccountsWithBalanceSheetTags = await sql`
        SELECT a.account_code
        FROM accounts a
        JOIN account_tags at
          ON at.account_code = a.account_code
         AND at.tag LIKE 'Balance Sheet -%'
        WHERE a.is_posting_account = 1
          AND a.account_code >= 40000
        ORDER BY a.account_code
      `;
      deepEqual(
        nonBalanceSheetPostingAccountsWithBalanceSheetTags.rows.map((row) => Number(row.account_code)),
        [],
        'Revenue and expense posting accounts should not carry Balance Sheet tags'
      );
    });
  });

  describe('Schema Version', function () {
    it('shall update schema version after template creation', async function () {
      const version = (await sql`SELECT value FROM config WHERE key = 'Schema Version'`).rows[0];
      // The last migration (006) should have set this
      equal(version.value, '006-account-reconciliation');
    });
  });
});
