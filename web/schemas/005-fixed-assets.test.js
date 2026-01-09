import { ok, equal } from 'node:assert/strict';
import { describe, it } from 'node:test';
import { rejects } from 'node:assert/strict';

import { useSql } from '#web/schemas/test/hooks/use-sql.js';

describe('Fixed Assets Schema Tests', function () {
  const sql = useSql();
  const testTime = new Date(2025, 0, 1, 0, 0, 0, 0).getTime();

  /**
   * @param {number} code
   * @param {string} name
   * @param {number} normalBalance
   */
  async function createAccount(code, name, normalBalance) {
    await sql`
      INSERT INTO accounts (account_code, name, normal_balance, create_time, update_time)
      VALUES (${code}, ${name}, ${normalBalance}, ${testTime}, ${testTime})
    `;
  }

  /**
   * @param {number} code
   * @param {string} tag
   */
  async function addTag(code, tag) {
    await sql`INSERT INTO account_tags (account_code, tag) VALUES (${code}, ${tag})`;
  }

  async function setupAssetAccounts() {
    await createAccount(1500, 'Fixed Assets', 0);
    await createAccount(1510, 'Accumulated Depreciation - FA', 1);
    await createAccount(5100, 'Depreciation Expense', 0);
    await createAccount(1000, 'Cash', 0);
  }

  /**
   * @param {string} name
   * @param {number} cost
   * @param {number} years
   * @param {number} salvage
   * @param {number} acquisitionTime
   * @returns {Promise<number>}
   */
  async function createFixedAsset(name, cost, years, salvage, acquisitionTime) {
    const result = await sql`
      INSERT INTO fixed_assets (
        name, acquisition_time, acquisition_cost, useful_life_years, salvage_value,
        asset_account_code, accumulated_depreciation_account_code,
        depreciation_expense_account_code, payment_account_code,
        create_time, update_time
      ) VALUES (${name}, ${acquisitionTime}, ${cost}, ${years}, ${salvage}, 1500, 1510, 5100, 1000, ${testTime}, ${testTime})
      RETURNING id
    `;
    return Number(result.rows[0].id);
  }

  /**
   * @param {number} beginTime
   * @param {number} endTime
   * @param {string} name
   */
  async function createFiscalYear(beginTime, endTime, name) {
    await sql`INSERT INTO fiscal_years (begin_time, end_time, name) VALUES (${beginTime}, ${endTime}, ${name})`;
  }

  /**
   * @param {number} beginTime
   * @param {number} postTime
   */
  async function closeFiscalYear(beginTime, postTime) {
    await sql`UPDATE fiscal_years SET post_time = ${postTime} WHERE begin_time = ${beginTime}`;
  }

  describe('Fixed Asset Creation', function () {
    it('shall create fixed asset with valid data', async function () {
      await setupAssetAccounts();

      const assetId = await createFixedAsset(
        'Office Desk',
        10000000, // 10 million IDR
        5, // 5 years
        1000000, // 1 million salvage
        testTime
      );

      const result = await sql`SELECT * FROM fixed_assets WHERE id = ${assetId}`;
      equal(result.rows.length, 1);
      equal(result.rows[0].name, 'Office Desk');
      equal(result.rows[0].acquisition_cost, 10000000);
      equal(result.rows[0].useful_life_years, 5);
      equal(result.rows[0].salvage_value, 1000000);
      equal(result.rows[0].accumulated_depreciation, 0);
      equal(result.rows[0].is_fully_depreciated, 0);
    });

    it('shall reject asset with invalid acquisition time', async function () {
      await setupAssetAccounts();

      await rejects(
        sql`
          INSERT INTO fixed_assets (
            name, acquisition_time, acquisition_cost, useful_life_years, salvage_value,
            asset_account_code, accumulated_depreciation_account_code,
            depreciation_expense_account_code, payment_account_code,
            create_time, update_time
          ) VALUES ('Desk', 0, 10000000, 5, 1000000, 1500, 1510, 5100, 1000, ${testTime}, ${testTime})
        `,
        { message: /Acquisition time must be positive/ },
      );
    });

    it('shall reject asset with salvage value >= acquisition cost', async function () {
      await setupAssetAccounts();

      await rejects(
        sql`
          INSERT INTO fixed_assets (
            name, acquisition_time, acquisition_cost, useful_life_years, salvage_value,
            asset_account_code, accumulated_depreciation_account_code,
            depreciation_expense_account_code, payment_account_code,
            create_time, update_time
          ) VALUES ('Desk', ${testTime}, 10000000, 5, 10000000, 1500, 1510, 5100, 1000, ${testTime}, ${testTime})
        `,
        { message: /Acquisition cost must be greater than salvage value/ }
      );
    });

    it('shall reject asset with same account codes', async function () {
      await setupAssetAccounts();

      await rejects(
        sql`
          INSERT INTO fixed_assets (
            name, acquisition_time, acquisition_cost, useful_life_years, salvage_value,
            asset_account_code, accumulated_depreciation_account_code,
            depreciation_expense_account_code, payment_account_code,
            create_time, update_time
          ) VALUES ('Desk', ${testTime}, 10000000, 5, 1000000, 1500, 1500, 5100, 1000, ${testTime}, ${testTime})
        `,
        { message: /CHECK constraint failed/ }
      );
    });

    it('shall reject asset creation in closed fiscal year', async function () {
      await setupAssetAccounts();

      const fyBegin = new Date(2024, 0, 1).getTime();
      const fyEnd = new Date(2024, 11, 31).getTime();
      await createFiscalYear(fyBegin, fyEnd, 'FY2024');
      await closeFiscalYear(fyBegin, fyEnd);

      const acquisitionTime = new Date(2024, 5, 1).getTime();

      await rejects(
        createFixedAsset(
          'Backdated Asset',
          10000000,
          5,
          1000000,
          acquisitionTime
        ),
        { message: /Cannot acquire asset in a closed fiscal year/ },
      );
    });
  });

  describe('Asset Acquisition Journal Entry', function () {
    it('shall create and post acquisition journal entry automatically', async function () {
      await setupAssetAccounts();

      const assetId = await createFixedAsset(
        'Office Computer',
        5000000, // 5 million IDR
        3, // 3 years
        500000, // 500k salvage
        testTime
      );

      // Check journal entry was created
      const jeResult = await sql`
        SELECT * FROM journal_entries WHERE source_reference = ${'FixedAsset:' + assetId}
      `;
      equal(jeResult.rows.length, 1);
      equal(jeResult.rows[0].note, 'Asset Acquisition: Office Computer');
      equal(jeResult.rows[0].source_type, 'System');
      equal(jeResult.rows[0].post_time, testTime); // Automatically posted

      // Check journal entry lines
      const jelResult = await sql`
        SELECT * FROM journal_entry_lines WHERE journal_entry_ref = ${jeResult.rows[0].ref} ORDER BY line_number
      `;
      equal(jelResult.rows.length, 2);

      // Debit: Fixed Asset
      equal(jelResult.rows[0].account_code, 1500);
      equal(jelResult.rows[0].debit, 5000000);
      equal(jelResult.rows[0].credit, 0);

      // Credit: Cash
      equal(jelResult.rows[1].account_code, 1000);
      equal(jelResult.rows[1].debit, 0);
      equal(jelResult.rows[1].credit, 5000000);
    });

    it('shall update account balances on acquisition', async function () {
      await setupAssetAccounts();

      const assetId = await createFixedAsset(
        'Office Printer',
        2000000, // 2 million IDR
        5,
        200000,
        testTime,
      );

      // Check if journal entry exists and is posted
      const jeCheck = await sql`
        SELECT * FROM journal_entries WHERE source_reference = ${'FixedAsset:' + assetId}
      `;
      ok(jeCheck.rows.length > 0, 'Journal entry should exist');
      ok(jeCheck.rows[0].post_time, 'Journal entry should be posted');

      // Check journal entry lines exist
      const jelCheck = await sql`
        SELECT * FROM journal_entry_lines WHERE journal_entry_ref = ${jeCheck.rows[0].ref}
      `;
      equal(jelCheck.rows.length, 2, 'Should have 2 journal entry lines');

      // Check Fixed Asset account balance
      const assetResult = await sql`SELECT balance FROM accounts WHERE account_code = 1500`;
      equal(assetResult.rows[0].balance, 2000000);

      // Check Cash account balance
      const cashResult = await sql`SELECT balance FROM accounts WHERE account_code = 1000`;
      equal(cashResult.rows[0].balance, -2000000); // Credit balance (decreased)
    });
  });

  describe('Depreciation Calculation', function () {
    it('shall calculate and post depreciation on fiscal year close', async function () {
      await setupAssetAccounts();

      // Create asset on Jan 1, 2025
      const acquisitionTime = new Date(2025, 0, 1, 0, 0, 0, 0).getTime();
      const assetId = await createFixedAsset(
        'Delivery Van',
        20000000, // 20 million IDR
        5, // 5 years
        2000000, // 2 million salvage
        acquisitionTime
      );

      // Create fiscal year 2025
      const fyBegin = new Date(2025, 0, 1, 0, 0, 0, 0).getTime();
      const fyEnd = new Date(2025, 11, 31, 23, 59, 59, 999).getTime();
      await createFiscalYear(fyBegin, fyEnd, 'FY2025');

      // Close fiscal year
      await closeFiscalYear(fyBegin, fyEnd);

      // Check depreciation journal entry was created
      const jeResult = await sql`
        SELECT * FROM journal_entries WHERE note = 'FY Depreciation Expense' AND entry_time = ${fyEnd}
      `;
      equal(jeResult.rows.length, 1);
      ok(jeResult.rows[0].post_time); // Should be posted

      // Check journal entry lines (should have 2 lines per asset: debit expense, credit accum depr)
      const jelResult = await sql`
        SELECT * FROM journal_entry_lines WHERE journal_entry_ref = ${jeResult.rows[0].ref} ORDER BY debit DESC
      `;
      equal(jelResult.rows.length, 2);

      // Calculate expected depreciation: (20,000,000 - 2,000,000) / 5 = 3,600,000
      const expectedDepreciation = (20000000 - 2000000) / 5;

      // Debit: Depreciation Expense
      equal(jelResult.rows[0].account_code, 5100);
      equal(jelResult.rows[0].debit, expectedDepreciation);
      equal(jelResult.rows[0].credit, 0);

      // Credit: Accumulated Depreciation
      equal(jelResult.rows[1].account_code, 1510);
      equal(jelResult.rows[1].debit, 0);
      equal(jelResult.rows[1].credit, expectedDepreciation);

      // Check accumulated depreciation on asset
      const assetResult = await sql`
        SELECT accumulated_depreciation FROM fixed_assets WHERE id = ${assetId}
      `;
      equal(assetResult.rows[0].accumulated_depreciation, expectedDepreciation);
    });

    it('shall not depreciate fully depreciated assets', async function () {
      await setupAssetAccounts();

      // Create asset that will be fully depreciated in first year
      const acquisitionTime = new Date(2025, 0, 1, 0, 0, 0, 0).getTime();
      const assetId = await createFixedAsset(
        'Small Tool',
        1000000, // 1 million IDR
        1, // 1 year (will fully depreciate in first close)
        0, // No salvage
        acquisitionTime
      );

      // Create and close first fiscal year
      const fy1Begin = new Date(2025, 0, 1, 0, 0, 0, 0).getTime();
      const fy1End = new Date(2025, 11, 31, 23, 59, 59, 999).getTime();
      await createFiscalYear(fy1Begin, fy1End, 'FY2025');
      await closeFiscalYear(fy1Begin, fy1End);

      // Check asset is fully depreciated
      let assetResult = await sql`
        SELECT accumulated_depreciation, is_fully_depreciated FROM fixed_assets WHERE id = ${assetId}
      `;
      equal(assetResult.rows[0].accumulated_depreciation, 1000000);
      equal(assetResult.rows[0].is_fully_depreciated, 1);

      // Create and close second fiscal year
      const fy2Begin = new Date(2026, 0, 1, 0, 0, 0, 0).getTime();
      const fy2End = new Date(2026, 11, 31, 23, 59, 59, 999).getTime();
      await createFiscalYear(fy2Begin, fy2End, 'FY2026');
      await closeFiscalYear(fy2Begin, fy2End);

      // Check no additional depreciation was recorded
      assetResult = await sql`
        SELECT accumulated_depreciation FROM fixed_assets WHERE id = ${assetId}
      `;
      equal(assetResult.rows[0].accumulated_depreciation, 1000000); // Same as before
    });

    it('shall cap depreciation at remaining book value', async function () {
      await setupAssetAccounts();

      // Create asset
      const acquisitionTime = new Date(2025, 0, 1, 0, 0, 0, 0).getTime();
      const assetId = await createFixedAsset(
        'Equipment',
        10000000, // 10 million IDR
        3, // 3 years
        1000000, // 1 million salvage
        acquisitionTime
      );

      // Manually set accumulated depreciation to near-full
      // Depreciable amount: 10,000,000 - 1,000,000 = 9,000,000
      // Set to 8,500,000 (leaving 500,000 remaining)
      await sql`UPDATE fixed_assets SET accumulated_depreciation = 8500000 WHERE id = ${assetId}`;

      // Create and close fiscal year
      const fyBegin = new Date(2025, 0, 1, 0, 0, 0, 0).getTime();
      const fyEnd = new Date(2025, 11, 31, 23, 59, 59, 999).getTime();
      await createFiscalYear(fyBegin, fyEnd, 'FY2025');
      await closeFiscalYear(fyBegin, fyEnd);

      // Check depreciation was capped at remaining 500,000 (not full 3,000,000)
      const assetResult = await sql`
        SELECT accumulated_depreciation FROM fixed_assets WHERE id = ${assetId}
      `;
      equal(assetResult.rows[0].accumulated_depreciation, 9000000); // Fully depreciated
    });

    it('shall depreciate multiple assets in single fiscal year close', async function () {
      await setupAssetAccounts();

      const acquisitionTime = new Date(2025, 0, 1, 0, 0, 0, 0).getTime();

      // Create multiple assets
      await createFixedAsset('Asset 1', 10000000, 5, 0, acquisitionTime);
      await createFixedAsset('Asset 2', 6000000, 3, 0, acquisitionTime);
      await createFixedAsset('Asset 3', 3000000, 2, 0, acquisitionTime);

      // Create and close fiscal year
      const fyBegin = new Date(2025, 0, 1, 0, 0, 0, 0).getTime();
      const fyEnd = new Date(2025, 11, 31, 23, 59, 59, 999).getTime();
      await createFiscalYear(fyBegin, fyEnd, 'FY2025');
      await closeFiscalYear(fyBegin, fyEnd);

      // Check all assets were depreciated
      const assetResult = await sql`
        SELECT name, accumulated_depreciation FROM fixed_assets ORDER BY id
      `;
      equal(assetResult.rows.length, 3);
      equal(assetResult.rows[0].accumulated_depreciation, 10000000 / 5); // 2,000,000
      equal(assetResult.rows[1].accumulated_depreciation, 6000000 / 3); // 2,000,000
      equal(assetResult.rows[2].accumulated_depreciation, 3000000 / 2); // 1,500,000

      // Check journal entry has correct total
      const jeResult = await sql`
        SELECT SUM(debit) as total_debit, SUM(credit) as total_credit 
        FROM journal_entry_lines 
        WHERE journal_entry_ref IN (
          SELECT ref FROM journal_entries WHERE note = 'FY Depreciation Expense'
        )
      `;
      const totalDepreciation = 2000000 + 2000000 + 1500000; // 5,500,000
      equal(jeResult.rows[0].total_debit, totalDepreciation);
      equal(jeResult.rows[0].total_credit, totalDepreciation);
    });

    it('shall not depreciate assets acquired after fiscal year end', async function () {
      await setupAssetAccounts();

      // Create fiscal year 2025
      const fyBegin = new Date(2025, 0, 1, 0, 0, 0, 0).getTime();
      const fyEnd = new Date(2025, 11, 31, 23, 59, 59, 999).getTime();
      await createFiscalYear(fyBegin, fyEnd, 'FY2025');

      // Create asset AFTER fiscal year end
      const acquisitionTime = new Date(2026, 0, 15, 0, 0, 0, 0).getTime();
      const assetId = await createFixedAsset(
        'Future Asset',
        5000000,
        5,
        0,
        acquisitionTime
      );

      // Close fiscal year
      await closeFiscalYear(fyBegin, fyEnd);

      // Check asset has no depreciation
      const assetResult = await sql`
        SELECT accumulated_depreciation FROM fixed_assets WHERE id = ${assetId}
      `;
      equal(assetResult.rows[0].accumulated_depreciation, 0);
    });
  });

  describe('Asset Modification Protection', function () {
    it('shall prevent modification of depreciated asset cost parameters', async function () {
      await setupAssetAccounts();

      const acquisitionTime = new Date(2025, 0, 1, 0, 0, 0, 0).getTime();
      const assetId = await createFixedAsset(
        'Protected Asset',
        10000000,
        5,
        1000000,
        acquisitionTime
      );

      // Manually add some accumulated depreciation
      await sql`UPDATE fixed_assets SET accumulated_depreciation = 2000000 WHERE id = ${assetId}`;

      // Attempt to modify acquisition cost
      await rejects(
        sql`UPDATE fixed_assets SET acquisition_cost = 15000000 WHERE id = ${assetId}`,
        { message: /Cannot modify cost parameters of asset with accumulated depreciation/ }
      );
    });

    it('shall prevent deletion of depreciated asset', async function () {
      await setupAssetAccounts();

      const acquisitionTime = new Date(2025, 0, 1, 0, 0, 0, 0).getTime();
      const assetId = await createFixedAsset(
        'Protected Asset',
        10000000,
        5,
        1000000,
        acquisitionTime
      );

      // Manually add some accumulated depreciation
      await sql`UPDATE fixed_assets SET accumulated_depreciation = 2000000 WHERE id = ${assetId}`;

      // Attempt to delete
      await rejects(
        sql`DELETE FROM fixed_assets WHERE id = ${assetId}`,
        { message: /Cannot delete fixed asset with accumulated depreciation/ }
      );
    });

    it('shall allow deletion of asset with no depreciation', async function () {
      await setupAssetAccounts();

      const acquisitionTime = new Date(2025, 0, 1, 0, 0, 0, 0).getTime();
      const assetId = await createFixedAsset(
        'Deletable Asset',
        5000000,
        5,
        0,
        acquisitionTime
      );

      // Should succeed
      await sql`DELETE FROM fixed_assets WHERE id = ${assetId}`;

      const result = await sql`SELECT * FROM fixed_assets WHERE id = ${assetId}`;
      equal(result.rows.length, 0);
    });
  });

  describe('Integration with Accounting', function () {
    it('shall update account balances correctly through full lifecycle', async function () {
      await setupAssetAccounts();

      // Create asset - this posts acquisition entry
      const acquisitionTime = new Date(2025, 0, 1, 0, 0, 0, 0).getTime();
      await createFixedAsset(
        'Full Lifecycle Asset',
        12000000, // 12 million
        4, // 4 years
        0,
        acquisitionTime
      );

      // Check initial balances
      let faBalance = (await sql`SELECT balance FROM accounts WHERE account_code = 1500`).rows[0].balance;
      let cashBalance = (await sql`SELECT balance FROM accounts WHERE account_code = 1000`).rows[0].balance;
      equal(faBalance, 12000000);
      equal(cashBalance, -12000000);

      // Close fiscal year - this posts depreciation
      const fyBegin = new Date(2025, 0, 1, 0, 0, 0, 0).getTime();
      const fyEnd = new Date(2025, 11, 31, 23, 59, 59, 999).getTime();
      await createFiscalYear(fyBegin, fyEnd, 'FY2025');
      await closeFiscalYear(fyBegin, fyEnd);

      // Check balances after depreciation
      faBalance = (await sql`SELECT balance FROM accounts WHERE account_code = 1500`).rows[0].balance;
      const accumDeprBalance = (await sql`SELECT balance FROM accounts WHERE account_code = 1510`).rows[0].balance;
      const deprExpenseBalance = (await sql`SELECT balance FROM accounts WHERE account_code = 5100`).rows[0].balance;

      equal(faBalance, 12000000); // Asset account unchanged
      equal(accumDeprBalance, 3000000); // 12M / 4 = 3M per year
      equal(deprExpenseBalance, 3000000); // Expense recorded
    });
  });
});
