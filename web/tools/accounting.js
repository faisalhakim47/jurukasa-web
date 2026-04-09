/**
 * @typedef {'Manual'|'Purchase'|'Sale'|'Stock Taking'|'Fixed Asset'|'Reconciliation'|'Fiscal Year Closing'|'Fiscal Year Reversal'|'Fiscal Year Depreciation'|'Fiscal Year Depreciation Reversal'} JournalEntryOwnerType
 */

import { assertNonNullable } from '#web/tools/assertion.js';

/**
 * @typedef {object} CashflowCategory
 * @property {number} id
 * @property {number} activity
 * @property {string} label
 */

/**
 * @param {{ sql: Function }} client
 * @returns {Promise<number>}
 */
export async function allocateJournalEntryRef(client) {
  const result = await client.sql`
    SELECT COALESCE(MAX(ref), 0) + 1 AS ref
    FROM journal_entries
  `;
  return Number(result.rows[0].ref);
}

/**
 * @param {{ sql: Function }} client
 * @returns {Promise<CashflowCategory[]>}
 */
export async function loadCashflowCategories(client) {
  /** @type {unknown} */
  const result = await client.sql`
    SELECT id, activity, label
    FROM cashflow_categories
    ORDER BY activity ASC, id ASC
  `;
  assertNonNullable(result);
  if ('rows' in result && Array.isArray(result.rows)) {
    return result.rows.map(function mapCashflowCategory(row) {
      return /** @type {CashflowCategory} */ ({
        id: Number(row.id),
        activity: Number(row.activity),
        label: String(row.label),
      });
    });
  }
  else throw new Error('Invalid result format');
}

/**
 * @param {{ sql: Function }} client
 * @param {number} accountCode
 * @param {number} checkpointTime
 * @returns {Promise<number>}
 */
export async function calculateReconciliationBookBalance(client, accountCode, checkpointTime) {
  const result = await client.sql`
    SELECT COALESCE(SUM(
      CASE a.normal_balance
        WHEN 0 THEN jel.debit - jel.credit
        WHEN 1 THEN jel.credit - jel.debit
      END
    ), 0) AS balance
    FROM accounts a
    JOIN journal_entry_lines jel ON jel.account_code = a.account_code
    JOIN journal_entries je ON je.ref = jel.journal_entry_ref
    WHERE a.account_code = ${accountCode}
      AND je.post_time IS NOT NULL
      AND je.entry_time <= ${checkpointTime}
      AND je.post_time <= ${checkpointTime}
  `;
  return Number(result.rows[0]?.balance ?? 0);
}

/**
 * @param {Record<string, unknown>} row
 * @returns {JournalEntryOwnerType}
 */
export function getJournalEntryOwnerType(row) {
  const isFiscalYearClosing = Number(row.is_fiscal_year_closing) === 1;
  const isFiscalYearReversal = Number(row.is_fiscal_year_reversal) === 1;
  const isFiscalYearDepreciation = Number(row.is_fiscal_year_depreciation) === 1;
  const isFiscalYearDepreciationReversal = Number(row.is_fiscal_year_depreciation_reversal) === 1;

  if (row.purchase_id !== null && row.purchase_id !== undefined) return 'Purchase';
  if (row.sale_id !== null && row.sale_id !== undefined) return 'Sale';
  if (row.stock_taking_id !== null && row.stock_taking_id !== undefined) return 'Stock Taking';
  if (row.fixed_asset_id !== null && row.fixed_asset_id !== undefined) return 'Fixed Asset';
  if (row.reconciliation_id !== null && row.reconciliation_id !== undefined) return 'Reconciliation';
  if (isFiscalYearClosing) return 'Fiscal Year Closing';
  if (isFiscalYearReversal) return 'Fiscal Year Reversal';
  if (isFiscalYearDepreciation) return 'Fiscal Year Depreciation';
  if (isFiscalYearDepreciationReversal) return 'Fiscal Year Depreciation Reversal';
  return 'Manual';
}

/**
 * @param {JournalEntryOwnerType | string} ownerType
 * @param {function(string, ...unknown[]): string} l
 * @returns {string}
 */
export function getJournalEntryOwnerLabel(ownerType, l) {
  const localizedLabel = l(ownerType);

  if (localizedLabel === ownerType) return localizedLabel;
  if (localizedLabel.startsWith('[literal.') && localizedLabel.endsWith(']')) return ownerType;

  return localizedLabel;
}

/**
 * @param {number} activity
 * @param {function(string, string, ...unknown[]): string} t
 * @returns {string}
 */
export function getCashflowActivityLabel(activity, t) {
  if (activity === 1) return t('journalEntry', 'cashflowActivityOperatingLabel');
  if (activity === 2) return t('journalEntry', 'cashflowActivityInvestingLabel');
  if (activity === 3) return t('journalEntry', 'cashflowActivityFinancingLabel');
  return String(activity);
}

/**
 * @param {unknown} error
 * @returns {Error}
 */
export function normalizeError(error) {
  return error instanceof Error ? error : new Error(String(error));
}

/**
 * @param {unknown} error
 * @param {function(string, ...unknown[]): string} l
 * @returns {Error}
 */
export function normalizeLiteralError(error, l) {
  const normalizedError = normalizeError(error);
  const localizedMessage = l(normalizedError.message);

  if (localizedMessage === normalizedError.message) return normalizedError;
  if (localizedMessage.startsWith('[literal.') && localizedMessage.endsWith(']')) {
    return normalizedError;
  }

  return new Error(localizedMessage, { cause: normalizedError });
}

/**
 * @param {unknown} error
 * @param {function(string, ...unknown[]): string} l
 * @returns {Error}
 */
export function normalizeJournalEntryError(error, l) {
  return normalizeLiteralError(error, l);
}

/**
 * @param {unknown} error
 * @param {function(string, ...unknown[]): string} l
 * @returns {Error}
 */
export function normalizeFiscalYearError(error, l) {
  return normalizeLiteralError(error, l);
}

/**
 * @param {unknown} error
 * @param {function(string, ...unknown[]): string} l
 * @returns {Error}
 */
export function normalizePurchaseError(error, l) {
  return normalizeLiteralError(error, l);
}

/**
 * @param {unknown} error
 * @param {function(string, ...unknown[]): string} l
 * @returns {Error}
 */
export function normalizeSaleError(error, l) {
  return normalizeLiteralError(error, l);
}

/**
 * @param {unknown} error
 * @param {function(string, ...unknown[]): string} l
 * @returns {Error}
 */
export function normalizeStockTakingError(error, l) {
  return normalizeLiteralError(error, l);
}

/**
 * @param {unknown} error
 * @param {function(string, ...unknown[]): string} l
 * @returns {Error}
 */
export function normalizeFixedAssetError(error, l) {
  return normalizeLiteralError(error, l);
}

/**
 * @param {unknown} error
 * @param {function(string, ...unknown[]): string} l
 * @returns {Error}
 */
export function normalizeReconciliationError(error, l) {
  return normalizeLiteralError(error, l);
}