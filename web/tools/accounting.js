/**
 * @typedef {'Manual'|'Purchase'|'Sale'|'Stock Taking'|'Fixed Asset'|'Reconciliation'|'Fiscal Year Closing'|'Fiscal Year Reversal'|'Fiscal Year Depreciation'|'Fiscal Year Depreciation Reversal'} JournalEntryOwnerType
 */

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
  const result = await client.sql`
    SELECT id, activity, label
    FROM cashflow_categories
    ORDER BY activity ASC, id ASC
  `;

  return result.rows.map(function mapCashflowCategory(row) {
    return /** @type {CashflowCategory} */ ({
      id: Number(row.id),
      activity: Number(row.activity),
      label: String(row.label),
    });
  });
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
 * @param {string} ownerType
 * @param {function(string, string, ...unknown[]): string} t
 * @returns {string}
 */
export function getJournalEntryOwnerLabel(ownerType, t) {
  if (ownerType === 'Manual') return t('journalEntry', 'ownerManualLabel');
  if (ownerType === 'Purchase') return t('journalEntry', 'ownerPurchaseLabel');
  if (ownerType === 'Sale') return t('journalEntry', 'ownerSaleLabel');
  if (ownerType === 'Stock Taking') return t('journalEntry', 'ownerStockTakingLabel');
  if (ownerType === 'Fixed Asset') return t('journalEntry', 'ownerFixedAssetLabel');
  if (ownerType === 'Reconciliation') return t('journalEntry', 'ownerReconciliationLabel');
  if (ownerType === 'Fiscal Year Closing') return t('journalEntry', 'ownerFiscalYearClosingLabel');
  if (ownerType === 'Fiscal Year Reversal') return t('journalEntry', 'ownerFiscalYearReversalLabel');
  if (ownerType === 'Fiscal Year Depreciation') return t('journalEntry', 'ownerFiscalYearDepreciationLabel');
  if (ownerType === 'Fiscal Year Depreciation Reversal') return t('journalEntry', 'ownerFiscalYearDepreciationReversalLabel');
  return ownerType;
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
 * @param {function(string, string, ...unknown[]): string} t
 * @returns {Error}
 */
export function normalizeJournalEntryError(error, t) {
  const normalizedError = normalizeError(error);
  const message = normalizedError.message;

  if (message.includes('Cash equivalent account requires cashflow_activity and cashflow_category')) {
    return new Error(t('journalEntry', 'cashflowRequiredError'));
  }
  if (message.includes('Non-cash account must not have cashflow_activity or cashflow_category')) {
    return new Error(t('journalEntry', 'cashflowForbiddenError'));
  }
  if (message.includes('Cannot delete posted journal entry')) {
    return new Error(t('journalEntry', 'postedDeleteForbiddenError'));
  }
  if (message.includes('Cannot modify posted journal entry')) {
    return new Error(t('journalEntry', 'postedUpdateForbiddenError'));
  }
  if (message.includes('Cannot unpost or change post_time of a posted journal entry')) {
    return new Error(t('journalEntry', 'postedUpdateForbiddenError'));
  }
  if (message.includes('Cannot insert lines into posted journal entry') || message.includes('Cannot modify lines of posted journal entry')) {
    return new Error(t('journalEntry', 'postedLineMutationForbiddenError'));
  }

  return normalizedError;
}

/**
 * @param {unknown} error
 * @param {function(string, string, ...unknown[]): string} t
 * @returns {Error}
 */
export function normalizeFiscalYearError(error, t) {
  const normalizedError = normalizeError(error);
  const message = normalizedError.message;

  if (message.includes('closing_journal_entry_ref is required')) {
    return new Error(t('fiscalYear', 'closingJournalEntryRefRequiredError'));
  }
  if (message.includes('reversal_journal_entry_ref is required')) {
    return new Error(t('fiscalYear', 'reversalJournalEntryRefRequiredError'));
  }
  if (message.includes('depreciation_journal_entry_ref is required')) {
    return new Error(t('fiscalYear', 'depreciationJournalEntryRefRequiredError'));
  }
  if (message.includes('depreciation_reversal_journal_entry_ref is required')) {
    return new Error(t('fiscalYear', 'depreciationReversalJournalEntryRefRequiredError'));
  }

  return normalizedError;
}

/**
 * @param {unknown} error
 * @param {function(string, string, ...unknown[]): string} t
 * @returns {Error}
 */
export function normalizePurchaseError(error, t) {
  const normalizedError = normalizeError(error);
  const message = normalizedError.message;

  if (message.includes('Cannot post purchase without journal_entry_ref')) {
    return new Error(t('purchase', 'postRequiresJournalEntryRefError'));
  }
  if (message.includes('Cannot unpost or change post_time of a posted purchase') || message.includes('Cannot modify purchase_time or journal_entry_ref of a posted purchase')) {
    return new Error(t('purchase', 'postedMutationForbiddenError'));
  }

  return normalizedError;
}

/**
 * @param {unknown} error
 * @param {function(string, string, ...unknown[]): string} t
 * @returns {Error}
 */
export function normalizeSaleError(error, t) {
  const normalizedError = normalizeError(error);
  const message = normalizedError.message;

  if (message.includes('Cannot post sale without journal_entry_ref')) {
    return new Error(t('sale', 'postRequiresJournalEntryRefError'));
  }
  if (message.includes('Cannot post sale: payment total must equal invoice amount')) {
    return new Error(t('sale', 'paymentTotalMismatchError'));
  }
  if (message.includes('Cannot post sale: discount amount exceeds gross amount')) {
    return new Error(t('sale', 'discountExceedsGrossError'));
  }
  if (message.includes('Cannot unpost or change post_time of a posted sale') || message.includes('Cannot modify sale_time or journal_entry_ref of a posted sale')) {
    return new Error(t('sale', 'postedMutationForbiddenError'));
  }

  return normalizedError;
}

/**
 * @param {unknown} error
 * @param {function(string, string, ...unknown[]): string} t
 * @returns {Error}
 */
export function normalizeStockTakingError(error, t) {
  const normalizedError = normalizeError(error);
  const message = normalizedError.message;

  if (message.includes('Stock taking journal_entry_ref is required when cost adjustment exists')) {
    return new Error(t('stock', 'journalEntryRefRequiredError'));
  }
  if (message.includes('Cannot record stock taking in a closed fiscal year')) {
    return new Error(t('stock', 'closedFiscalYearError'));
  }
  if (message.includes('Account with tag "POS - Inventory Gain" not found for stock taking adjustment')) {
    return new Error(t('stock', 'inventoryGainAccountRequiredError'));
  }
  if (message.includes('Account with tag "POS - Inventory Shrinkage" not found for stock taking adjustment')) {
    return new Error(t('stock', 'inventoryShrinkageAccountRequiredError'));
  }

  return normalizedError;
}

/**
 * @param {unknown} error
 * @param {function(string, string, ...unknown[]): string} t
 * @returns {Error}
 */
export function normalizeFixedAssetError(error, t) {
  const normalizedError = normalizeError(error);
  const message = normalizedError.message;

  if (message.includes('journal_entry_ref is required when creating a fixed asset')) {
    return new Error(t('fixedAsset', 'journalEntryRefRequiredError'));
  }
  if (message.includes('Cannot modify fixed asset with posted acquisition history')) {
    return new Error(t('fixedAsset', 'postedHistoryImmutableError'));
  }
  if (message.includes('Cannot delete fixed asset with posted acquisition history')) {
    return new Error(t('fixedAsset', 'postedHistoryDeleteForbiddenError'));
  }
  if (message.includes('Cannot delete fixed asset with accumulated depreciation')) {
    return new Error(t('fixedAsset', 'cannotDeleteWithDepreciation'));
  }

  return normalizedError;
}

/**
 * @param {unknown} error
 * @param {function(string, string, ...unknown[]): string} t
 * @returns {Error}
 */
export function normalizeReconciliationError(error, t) {
  const normalizedError = normalizeError(error);
  const message = normalizedError.message;

  if (message.includes('Checkpoint time must be positive')) {
    return new Error(t('reconciliation', 'invalidCheckpointTimeError'));
  }
  if (message.includes('Reconciliation can only be performed on posting accounts')) {
    return new Error(t('reconciliation', 'postingAccountRequiredError'));
  }
  if (message.includes('Physical cash count can only be performed on cash/bank accounts')) {
    return new Error(t('reconciliation', 'physicalCashOnlyError'));
  }
  if (message.includes('No account tagged Reconciliation - Cash Over/Short found')) {
    return new Error(t('reconciliation', 'cashOverShortAccountRequiredError'));
  }
  if (message.includes('No account tagged Reconciliation - Adjustment found')) {
    return new Error(t('reconciliation', 'reconciliationAdjustmentAccountRequiredError'));
  }
  if (message.includes('adjustment_journal_entry_ref is required when reconciliation discrepancy exists')) {
    return new Error(t('reconciliation', 'adjustmentJournalEntryRefRequiredError'));
  }
  if (message.includes('Reconciliation checkpoints are immutable once recorded')) {
    return new Error(t('reconciliation', 'checkpointImmutableError'));
  }
  if (message.includes('Reconciliation checkpoints cannot be deleted once recorded')) {
    return new Error(t('reconciliation', 'checkpointDeleteForbiddenError'));
  }

  return normalizedError;
}