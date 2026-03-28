import { ok, equal } from 'node:assert/strict';
import { describe, it } from 'node:test';
import { rejects } from 'node:assert/strict';

import { useSql } from '#test/nodejs/hooks/use-sql.js';

describe('Fixed Assets Schema Tests', function () {
  const sql = useSql();
  const testTime = new Date(2025, 0, 1, 0, 0, 0, 0).getTime();

  let nextJeRef = 1000;
  function genJeRef() { return nextJeRef++; }

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
        journal_entry_ref,
        create_time, update_time
      ) VALUES (${name}, ${acquisitionTime}, ${cost}, ${years}, ${salvage}, 1500, 1510, 5100, 1000, ${genJeRef()}, ${testTime}, ${testTime})
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
    await sql`UPDATE fiscal_years SET closing_journal_entry_ref = ${genJeRef()}, depreciation_journal_entry_ref = ${genJeRef()}, post_time = ${postTime} WHERE begin_time = ${beginTime}`;
  }

  /**
   * @param {number} beginTime
   * @param {number} reversalTime
   */
  async function reverseFiscalYear(beginTime, reversalTime) {
    await sql`UPDATE fiscal_years SET depreciation_reversal_journal_entry_ref = ${genJeRef()}, reversal_time = ${reversalTime} WHERE begin_time = ${beginTime}`;
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
            journal_entry_ref,
            create_time, update_time
          ) VALUES ('Desk', 0, 10000000, 5, 1000000, 1500, 1510, 5100, 1000, ${genJeRef()}, ${testTime}, ${testTime})
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
            journal_entry_ref,
            create_time, update_time
          ) VALUES ('Desk', ${testTime}, 10000000, 5, 10000000, 1500, 1510, 5100, 1000, ${genJeRef()}, ${testTime}, ${testTime})
        `,
        { message: /Acquisition cost must be greater than salvage value/ }
      );
    });

    it('shall require journal_entry_ref when creating a fixed asset', async function () {
      await setupAssetAccounts();

      await rejects(
        sql`
          INSERT INTO fixed_assets (
            name, acquisition_time, acquisition_cost, useful_life_years, salvage_value,
            asset_account_code, accumulated_depreciation_account_code,
            depreciation_expense_account_code, payment_account_code,
            create_time, update_time
          ) VALUES ('Desk', ${testTime}, 10000000, 5, 1000000, 1500, 1510, 5100, 1000, ${testTime}, ${testTime})
        `,
        { message: /journal_entry_ref is required when creating a fixed asset/ }
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
            journal_entry_ref,
            create_time, update_time
          ) VALUES ('Desk', ${testTime}, 10000000, 5, 1000000, 1500, 1500, 5100, 1000, ${genJeRef()}, ${testTime}, ${testTime})
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

    it('shall allow asset creation exactly at closed fiscal year begin_time', async function () {
      await setupAssetAccounts();

      const fyBegin = new Date(2024, 0, 1, 0, 0, 0, 0).getTime();
      const fyEnd = new Date(2024, 11, 31, 23, 59, 59, 999).getTime();
      await createFiscalYear(fyBegin, fyEnd, 'FY2024');
      await closeFiscalYear(fyBegin, fyEnd);

      const assetId = await createFixedAsset(
        'Boundary Begin Asset',
        10000000,
        5,
        1000000,
        fyBegin
      );

      const result = await sql`SELECT * FROM fixed_assets WHERE id = ${assetId}`;
      equal(result.rows.length, 1);
      equal(result.rows[0].acquisition_time, fyBegin);
    });

    it('shall reject asset creation exactly at closed fiscal year end_time', async function () {
      await setupAssetAccounts();

      const fyBegin = new Date(2024, 0, 1, 0, 0, 0, 0).getTime();
      const fyEnd = new Date(2024, 11, 31, 23, 59, 59, 999).getTime();
      await createFiscalYear(fyBegin, fyEnd, 'FY2024');
      await closeFiscalYear(fyBegin, fyEnd);

      await rejects(
        createFixedAsset(
          'Boundary End Asset',
          10000000,
          5,
          1000000,
          fyEnd
        ),
        { message: /Cannot acquire asset in a closed fiscal year/ },
      );
    });

    it('shall allow asset creation in a reversed fiscal year', async function () {
      await setupAssetAccounts();

      const fyBegin = new Date(2024, 0, 1).getTime();
      const fyEnd = new Date(2024, 11, 31, 23, 59, 59, 999).getTime();
      await createFiscalYear(fyBegin, fyEnd, 'FY2024');
      await closeFiscalYear(fyBegin, fyEnd);

      const reversalTime = new Date(2025, 0, 15).getTime();
      await sql`UPDATE fiscal_years SET reversal_time = ${reversalTime} WHERE begin_time = ${fyBegin}`;

      const acquisitionTime = new Date(2024, 5, 1).getTime();
      const assetId = await createFixedAsset(
        'Reopened Period Asset',
        10000000,
        5,
        1000000,
        acquisitionTime
      );

      const result = await sql`SELECT * FROM fixed_assets WHERE id = ${assetId}`;
      equal(result.rows.length, 1);
      equal(result.rows[0].name, 'Reopened Period Asset');
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
        SELECT * FROM journal_entries WHERE fixed_asset_id = ${assetId}
      `;
      equal(jeResult.rows.length, 1);
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
        SELECT * FROM journal_entries WHERE fixed_asset_id = ${assetId}
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

    it('shall prevent multiple journal entries from linking to the same fixed asset', async function () {
      await setupAssetAccounts();

      const assetId = await createFixedAsset(
        'Office Cabinet',
        3000000,
        5,
        300000,
        testTime,
      );

      await rejects(
        sql`
          INSERT INTO journal_entries (ref, entry_time, fixed_asset_id)
          VALUES (${genJeRef()}, ${testTime + 1}, ${assetId})
        `,
        { message: /UNIQUE constraint failed: journal_entries.fixed_asset_id/ }
      );
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
      const fy = (await sql`SELECT * FROM fiscal_years WHERE begin_time = ${fyBegin}`).rows[0];
      ok(fy.depreciation_journal_entry_ref, 'Depreciation journal entry ref should be set');
      const jeResult = await sql`
        SELECT * FROM journal_entries WHERE ref = ${fy.depreciation_journal_entry_ref}
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

      const acquisitionTime = new Date(2025, 0, 1, 0, 0, 0, 0).getTime();
      const assetId = await createFixedAsset(
        'Equipment',
        10000000, // 10 million IDR
        1, // 1 year
        1000000, // 1 million salvage
        acquisitionTime
      );

      const fy1Begin = acquisitionTime;
      const fy1End = new Date(2025, 10, 30, 23, 59, 59, 999).getTime();
      const fy2Begin = fy1End;
      const fy2End = new Date(2025, 11, 31, 23, 59, 59, 999).getTime();
      await createFiscalYear(fy1Begin, fy1End, 'FY2025 Pre-Close');
      await createFiscalYear(fy2Begin, fy2End, 'FY2025 Final Month');

      await closeFiscalYear(fy1Begin, fy1End);
      const afterFirstClose = (await sql`
        SELECT accumulated_depreciation FROM fixed_assets WHERE id = ${assetId}
      `).rows[0];

      await closeFiscalYear(fy2Begin, fy2End);

      const assetResult = await sql`
        SELECT accumulated_depreciation FROM fixed_assets WHERE id = ${assetId}
      `;
      equal(assetResult.rows[0].accumulated_depreciation, 9000000); // Fully depreciated

      const fy2 = (await sql`SELECT depreciation_journal_entry_ref FROM fiscal_years WHERE begin_time = ${fy2Begin}`).rows[0];
      const fy2Je = (await sql`
        SELECT SUM(debit) AS total_debit, SUM(credit) AS total_credit
        FROM journal_entry_lines
        WHERE journal_entry_ref = ${fy2.depreciation_journal_entry_ref}
      `).rows[0];
      const remainingDepreciation = 9000000 - Number(afterFirstClose.accumulated_depreciation);
      equal(Number(fy2Je.total_debit), remainingDepreciation, 'Second close should only post the remaining depreciation amount');
      equal(Number(fy2Je.total_credit), remainingDepreciation, 'Second close should stay balanced while capping at the remaining amount');
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
      const fy = (await sql`SELECT * FROM fiscal_years WHERE begin_time = ${fyBegin}`).rows[0];
      const jeResult = await sql`
        SELECT SUM(debit) as total_debit, SUM(credit) as total_credit
        FROM journal_entry_lines
        WHERE journal_entry_ref = ${fy.depreciation_journal_entry_ref}
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
      const beforeClose = (await sql`
        SELECT accumulated_depreciation, update_time FROM fixed_assets WHERE id = ${assetId}
      `).rows[0];

      await closeFiscalYear(fyBegin, fyEnd);

      // Check asset has no depreciation
      const assetResult = await sql`
        SELECT accumulated_depreciation, update_time FROM fixed_assets WHERE id = ${assetId}
      `;
      equal(assetResult.rows[0].accumulated_depreciation, 0);
      equal(assetResult.rows[0].update_time, beforeClose.update_time, 'No-op depreciation close should not mutate fixed asset update_time');

      const fiscalYearResult = await sql`
        SELECT depreciation_journal_entry_ref FROM fiscal_years WHERE begin_time = ${fyBegin}
      `;
      equal(fiscalYearResult.rows[0].depreciation_journal_entry_ref, null, 'No depreciation journal entry ref should remain when nothing was posted');
    });

    it('shall require depreciation_journal_entry_ref when fiscal year close will post depreciation', async function () {
      await setupAssetAccounts();

      const acquisitionTime = new Date(2025, 0, 1, 0, 0, 0, 0).getTime();
      await createFixedAsset(
        'Missing Ref Asset',
        12000,
        1,
        0,
        acquisitionTime
      );

      const fyBegin = new Date(2025, 0, 1, 0, 0, 0, 0).getTime();
      const fyEnd = new Date(2025, 11, 31, 23, 59, 59, 999).getTime();
      await createFiscalYear(fyBegin, fyEnd, 'FY2025');

      await rejects(
        sql`UPDATE fiscal_years SET closing_journal_entry_ref = ${genJeRef()}, post_time = ${fyEnd} WHERE begin_time = ${fyBegin}`,
        { message: /depreciation_journal_entry_ref is required when depreciation will be posted/ }
      );
    });

    it('shall allow closing fiscal year without depreciation_journal_entry_ref when no depreciation is due', async function () {
      await setupAssetAccounts();

      const fyBegin = new Date(2025, 0, 1, 0, 0, 0, 0).getTime();
      const fyEnd = new Date(2025, 11, 31, 23, 59, 59, 999).getTime();
      await createFiscalYear(fyBegin, fyEnd, 'FY2025');

      await sql`UPDATE fiscal_years SET closing_journal_entry_ref = ${genJeRef()}, post_time = ${fyEnd} WHERE begin_time = ${fyBegin}`;

      const fiscalYear = (await sql`SELECT post_time, depreciation_journal_entry_ref FROM fiscal_years WHERE begin_time = ${fyBegin}`).rows[0];
      equal(fiscalYear.post_time, fyEnd);
      equal(fiscalYear.depreciation_journal_entry_ref, null);

      const journalEntries = await sql`SELECT COUNT(*) AS count FROM journal_entries`;
      equal(Number(journalEntries.rows[0].count), 0, 'No journal entries should remain when neither closing nor depreciation posts lines');
    });

    it('shall prorate depreciation for short fiscal years', async function () {
      await setupAssetAccounts();

      const acquisitionTime = new Date(2025, 0, 1, 0, 0, 0, 0).getTime();
      const assetId = await createFixedAsset(
        'Short Fiscal Year Asset',
        12000,
        1,
        0,
        acquisitionTime
      );

      const fyBegin = acquisitionTime;
      const fyEnd = new Date(2025, 0, 31, 23, 59, 59, 999).getTime();
      await createFiscalYear(fyBegin, fyEnd, 'Jan 2025');
      await closeFiscalYear(fyBegin, fyEnd);

      const millisecondsPerYear = 365 * 24 * 60 * 60 * 1000;
      const expectedDepreciation = Math.round(12000 * ((fyEnd - acquisitionTime) / millisecondsPerYear));
      const asset = (await sql`
        SELECT accumulated_depreciation, is_fully_depreciated FROM fixed_assets WHERE id = ${assetId}
      `).rows[0];

      equal(asset.accumulated_depreciation, expectedDepreciation, 'Depreciation should be prorated to the short fiscal period');
      equal(asset.is_fully_depreciated, 0, 'Asset should not be fully depreciated after a short fiscal year');
    });

    it('shall fully depreciate asset with non-divisible amounts within useful life', async function () {
      await setupAssetAccounts();

      // 10,000 depreciable over 7 years → ROUND(10000/7) = 1429 per year
      // Without ROUND (integer division): 10000/7 = 1428, would need 8 years
      // With ROUND: 1429*6 = 8574, year 7 capped at MIN(1429, 1426) = 1426, total = 10000
      const acquisitionTime = new Date(2025, 0, 1, 0, 0, 0, 0).getTime();
      const assetId = await createFixedAsset(
        'Non-Divisible Asset',
        10000, // acquisition cost
        7, // 7 years
        0, // no salvage
        acquisitionTime
      );

      // Close 7 fiscal years
      for (let year = 0; year < 7; year++) {
        const fyBegin = new Date(2025 + year, 0, 1, 0, 0, 0, 0).getTime();
        const fyEnd = new Date(2025 + year, 11, 31, 23, 59, 59, 999).getTime();
        await createFiscalYear(fyBegin, fyEnd, `FY${2025 + year}`);
        await closeFiscalYear(fyBegin, fyEnd);
      }

      const asset = (await sql`SELECT accumulated_depreciation, is_fully_depreciated FROM fixed_assets WHERE id = ${assetId}`).rows[0];
      equal(asset.accumulated_depreciation, 10000, 'Asset should be fully depreciated within useful life');
      equal(asset.is_fully_depreciated, 1, 'Asset should be marked fully depreciated');
    });

    it('shall reverse posted depreciation and restore accumulated depreciation state', async function () {
      await setupAssetAccounts();

      const acquisitionTime = new Date(2025, 0, 1, 0, 0, 0, 0).getTime();
      const assetId = await createFixedAsset(
        'Reversible Asset',
        12000000,
        3,
        0,
        acquisitionTime
      );

      const fyBegin = new Date(2025, 0, 1, 0, 0, 0, 0).getTime();
      const fyEnd = new Date(2025, 11, 31, 23, 59, 59, 999).getTime();
      await createFiscalYear(fyBegin, fyEnd, 'FY2025');
      await closeFiscalYear(fyBegin, fyEnd);

      const closedFiscalYear = (await sql`
        SELECT depreciation_journal_entry_ref FROM fiscal_years WHERE begin_time = ${fyBegin}
      `).rows[0];
      const depreciationBeforeReversal = Number((await sql`
        SELECT accumulated_depreciation FROM fixed_assets WHERE id = ${assetId}
      `).rows[0].accumulated_depreciation);
      ok(depreciationBeforeReversal > 0, 'Closing the fiscal year should post depreciation before reversal');

      const reversalTime = new Date(2026, 0, 15, 0, 0, 0, 0).getTime();
      await reverseFiscalYear(fyBegin, reversalTime);

      const reversedFiscalYear = (await sql`
        SELECT depreciation_reversal_journal_entry_ref FROM fiscal_years WHERE begin_time = ${fyBegin}
      `).rows[0];
      ok(reversedFiscalYear.depreciation_reversal_journal_entry_ref, 'Depreciation reversal journal entry ref should be set');

      const reversalEntry = (await sql`
        SELECT reversal_of_ref, post_time FROM journal_entries WHERE ref = ${reversedFiscalYear.depreciation_reversal_journal_entry_ref}
      `).rows[0];
      equal(reversalEntry.reversal_of_ref, closedFiscalYear.depreciation_journal_entry_ref, 'Depreciation reversal entry should point at the original depreciation entry');
      equal(reversalEntry.post_time, reversalTime, 'Depreciation reversal entry should be posted at reversal_time');

      const assetAfterReversal = (await sql`
        SELECT accumulated_depreciation FROM fixed_assets WHERE id = ${assetId}
      `).rows[0];
      equal(assetAfterReversal.accumulated_depreciation, 0, 'Reversal should restore accumulated depreciation to the pre-close amount');

      const accountBalances = (await sql`
        SELECT account_code, balance FROM accounts WHERE account_code IN (1510, 5100) ORDER BY account_code
      `).rows;
      equal(accountBalances[0].balance, 0, 'Accumulated depreciation account should be restored after reversal');
      equal(accountBalances[1].balance, 0, 'Depreciation expense account should be restored after reversal');
    });

    it('shall require depreciation_reversal_journal_entry_ref when reversing posted depreciation', async function () {
      await setupAssetAccounts();

      const acquisitionTime = new Date(2025, 0, 1, 0, 0, 0, 0).getTime();
      await createFixedAsset(
        'Missing Depreciation Reversal Ref',
        12000000,
        3,
        0,
        acquisitionTime
      );

      const fyBegin = new Date(2025, 0, 1, 0, 0, 0, 0).getTime();
      const fyEnd = new Date(2025, 11, 31, 23, 59, 59, 999).getTime();
      await createFiscalYear(fyBegin, fyEnd, 'FY2025');
      await closeFiscalYear(fyBegin, fyEnd);

      const reversalTime = new Date(2026, 0, 15, 0, 0, 0, 0).getTime();
      await rejects(
        sql`UPDATE fiscal_years SET reversal_time = ${reversalTime} WHERE begin_time = ${fyBegin}`,
        { message: /depreciation_reversal_journal_entry_ref is required when reversing posted depreciation/ }
      );
    });

    it('shall not mutate unrelated later assets when reversing posted depreciation', async function () {
      await setupAssetAccounts();

      const fyBegin = new Date(2025, 0, 1, 0, 0, 0, 0).getTime();
      const fyEnd = new Date(2025, 11, 31, 23, 59, 59, 999).getTime();
      await createFiscalYear(fyBegin, fyEnd, 'FY2025');

      await createFixedAsset(
        'FY2025 Asset',
        12000000,
        3,
        0,
        fyBegin
      );
      await closeFiscalYear(fyBegin, fyEnd);

      const laterAcquisitionTime = new Date(2026, 0, 10, 0, 0, 0, 0).getTime();
      const laterAssetId = await createFixedAsset(
        'FY2026 Asset',
        24000000,
        4,
        0,
        laterAcquisitionTime
      );

      const beforeReversal = (await sql`
        SELECT accumulated_depreciation, update_time
        FROM fixed_assets
        WHERE id = ${laterAssetId}
      `).rows[0];

      const reversalTime = new Date(2026, 0, 15, 0, 0, 0, 0).getTime();
      await reverseFiscalYear(fyBegin, reversalTime);

      const afterReversal = (await sql`
        SELECT accumulated_depreciation, update_time
        FROM fixed_assets
        WHERE id = ${laterAssetId}
      `).rows[0];

      equal(afterReversal.accumulated_depreciation, beforeReversal.accumulated_depreciation);
      equal(afterReversal.update_time, beforeReversal.update_time);
    });
  });

  describe('Asset Modification Protection', function () {
    it('shall prevent manual updates to accumulated depreciation outside fiscal year workflows', async function () {
      await setupAssetAccounts();

      const acquisitionTime = new Date(2025, 0, 1, 0, 0, 0, 0).getTime();
      const assetId = await createFixedAsset(
        'Guarded Asset',
        10000000,
        5,
        1000000,
        acquisitionTime
      );

      await rejects(
        sql`UPDATE fixed_assets SET accumulated_depreciation = 2000000 WHERE id = ${assetId}`,
        { message: /Cannot manually update fixed_assets\.accumulated_depreciation or update_time; use fiscal year close\/reversal workflows/ }
      );
    });

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

      const fyBegin = new Date(2025, 0, 1, 0, 0, 0, 0).getTime();
      const fyEnd = new Date(2025, 11, 31, 23, 59, 59, 999).getTime();
      await createFiscalYear(fyBegin, fyEnd, 'FY2025');
      await closeFiscalYear(fyBegin, fyEnd);

      // Attempt to modify acquisition cost
      await rejects(
        sql`UPDATE fixed_assets SET acquisition_cost = 15000000 WHERE id = ${assetId}`,
        { message: /Cannot modify fixed asset with posted acquisition history/ }
      );
    });

    it('shall prevent modifying posted fixed asset metadata before depreciation begins', async function () {
      await setupAssetAccounts();
      await createAccount(1600, 'Alternate Fixed Assets', 0);

      const acquisitionTime = new Date(2025, 0, 1, 0, 0, 0, 0).getTime();
      const assetId = await createFixedAsset(
        'Immutable Posted Asset',
        5000000,
        5,
        0,
        acquisitionTime
      );

      await rejects(
        sql`UPDATE fixed_assets SET acquisition_time = ${acquisitionTime + 24 * 60 * 60 * 1000} WHERE id = ${assetId}`,
        { message: /Cannot modify fixed asset with posted acquisition history/ }
      );

      await rejects(
        sql`UPDATE fixed_assets SET asset_account_code = ${1600} WHERE id = ${assetId}`,
        { message: /Cannot modify fixed asset with posted acquisition history/ }
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

      const fyBegin = new Date(2025, 0, 1, 0, 0, 0, 0).getTime();
      const fyEnd = new Date(2025, 11, 31, 23, 59, 59, 999).getTime();
      await createFiscalYear(fyBegin, fyEnd, 'FY2025');
      await closeFiscalYear(fyBegin, fyEnd);

      // Attempt to delete
      await rejects(
        sql`DELETE FROM fixed_assets WHERE id = ${assetId}`,
        { message: /Cannot delete fixed asset with accumulated depreciation/ }
      );
    });

    it('shall prevent deletion of asset with posted acquisition history', async function () {
      await setupAssetAccounts();

      const acquisitionTime = new Date(2025, 0, 1, 0, 0, 0, 0).getTime();
      const assetId = await createFixedAsset(
        'Deletable Asset',
        5000000,
        5,
        0,
        acquisitionTime
      );

      await rejects(
        sql`DELETE FROM fixed_assets WHERE id = ${assetId}`,
        { message: /Cannot delete fixed asset with posted acquisition history/ }
      );

      const result = await sql`SELECT * FROM fixed_assets WHERE id = ${assetId}`;
      equal(result.rows.length, 1);
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

  describe('Cash Flow Classification on Acquisition', function () {
    it('shall classify acquisition payment as investing activity for cash equivalent accounts', async function () {
      await setupAssetAccounts();
      await addTag(1000, 'Cash Flow - Cash Equivalents');

      const acquisitionTime = new Date(2025, 0, 1, 0, 0, 0, 0).getTime();
      const assetId = await createFixedAsset(
        'Office Chair',
        3000000,
        5,
        300000,
        acquisitionTime
      );

      // Check journal entry lines for cash flow classification
      const jeResult = await sql`
        SELECT * FROM journal_entries WHERE fixed_asset_id = ${assetId}
      `;
      const lines = (await sql`
        SELECT * FROM journal_entry_lines WHERE journal_entry_ref = ${jeResult.rows[0].ref} ORDER BY line_number
      `).rows;

      // Credit line (Cash payment) should have investing activity classification
      const cashLine = lines.find(l => l.account_code === 1000);
      equal(cashLine?.cashflow_activity, 2, 'Payment should be classified as Investing activity');
      equal(cashLine?.cashflow_category, 5, 'Payment should be classified as Asset Purchase category');

      // Debit line (Fixed Asset) should NOT have cash flow classification
      const assetLine = lines.find(l => l.account_code === 1500);
      equal(assetLine?.cashflow_activity, null, 'Asset debit should not have cashflow_activity');
      equal(assetLine?.cashflow_category, null, 'Asset debit should not have cashflow_category');
    });

    it('shall not classify acquisition payment when payment account is not cash equivalent', async function () {
      await setupAssetAccounts();
      // Note: 1000 (Cash) is NOT tagged as Cash Flow - Cash Equivalents here

      const acquisitionTime = new Date(2025, 0, 1, 0, 0, 0, 0).getTime();
      const assetId = await createFixedAsset(
        'Office Chair',
        3000000,
        5,
        300000,
        acquisitionTime
      );

      const jeResult = await sql`
        SELECT * FROM journal_entries WHERE fixed_asset_id = ${assetId}
      `;
      const lines = (await sql`
        SELECT * FROM journal_entry_lines WHERE journal_entry_ref = ${jeResult.rows[0].ref} ORDER BY line_number
      `).rows;

      // Cash line should NOT have cash flow classification
      const cashLine = lines.find(l => l.account_code === 1000);
      equal(cashLine?.cashflow_activity, null, 'Non-cash-equivalent payment should not have cashflow_activity');
      equal(cashLine?.cashflow_category, null, 'Non-cash-equivalent payment should not have cashflow_category');
    });
  });

  describe('Account Code Distinctness Validation', function () {
    it('shall reject payment_account_code equal to asset_account_code', async function () {
      await setupAssetAccounts();

      await rejects(
        sql`
          INSERT INTO fixed_assets (
            name, acquisition_time, acquisition_cost, useful_life_years, salvage_value,
            asset_account_code, accumulated_depreciation_account_code,
            depreciation_expense_account_code, payment_account_code,
            journal_entry_ref,
            create_time, update_time
          ) VALUES ('Desk', ${testTime}, 10000000, 5, 1000000, 1500, 1510, 5100, 1500, ${genJeRef()}, ${testTime}, ${testTime})
        `,
        { message: /CHECK/ },
      );
    });

    it('shall reject payment_account_code equal to accumulated_depreciation_account_code', async function () {
      await setupAssetAccounts();

      await rejects(
        sql`
          INSERT INTO fixed_assets (
            name, acquisition_time, acquisition_cost, useful_life_years, salvage_value,
            asset_account_code, accumulated_depreciation_account_code,
            depreciation_expense_account_code, payment_account_code,
            journal_entry_ref,
            create_time, update_time
          ) VALUES ('Desk', ${testTime}, 10000000, 5, 1000000, 1500, 1510, 5100, 1510, ${genJeRef()}, ${testTime}, ${testTime})
        `,
        { message: /CHECK/ },
      );
    });

    it('shall reject payment_account_code equal to depreciation_expense_account_code', async function () {
      await setupAssetAccounts();

      await rejects(
        sql`
          INSERT INTO fixed_assets (
            name, acquisition_time, acquisition_cost, useful_life_years, salvage_value,
            asset_account_code, accumulated_depreciation_account_code,
            depreciation_expense_account_code, payment_account_code,
            journal_entry_ref,
            create_time, update_time
          ) VALUES ('Desk', ${testTime}, 10000000, 5, 1000000, 1500, 1510, 5100, 5100, ${genJeRef()}, ${testTime}, ${testTime})
        `,
        { message: /CHECK/ },
      );
    });
  });
});
