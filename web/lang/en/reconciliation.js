const reconciliation = {
  // Reconciliation View
  reconciliationTitle: 'Reconciliation',
  reconciliationDescription: 'Reconcile your accounts and perform cash counts.',
  reconciliationSectionsAriaLabel: 'Reconciliation sections',
  accountReconciliationTabLabel: 'Account Reconciliation',
  cashCountTabLabel: 'Cash Count',

  // Account Reconciliation List
  loadingReconciliationsAriaLabel: 'Loading reconciliations',
  loadingReconciliationsMessage: 'Loading reconciliations...',
  unableToLoadReconciliationsTitle: 'Unable to Load Reconciliations',
  noReconciliationsFoundTitle: 'No Reconciliations Found',
  noReconciliationsFoundMessage: 'No reconciliation sessions match your search criteria.',
  noReconciliationsFoundEmptyMessage: 'No reconciliation sessions have been created yet. Click the button below to create your first reconciliation.',

  // Actions
  createReconciliationButtonLabel: 'Create Reconciliation',
  refreshReconciliationsAriaLabel: 'Refresh reconciliations list',
  refreshButtonLabel: 'Refresh',
  retryButtonLabel: 'Retry',

  // Search and filters
  searchLabel: 'Search',
  statusFilterLabel: 'Status',
  statusFilterAriaLabel: 'Filter by status',
  allStatusLabel: 'All',
  draftStatusLabel: 'Draft',
  completedStatusLabel: 'Completed',

  // Table headers
  tableHeaderAccount: 'Account',
  tableHeaderReconciliationTime: 'Date',
  tableHeaderStatementPeriod: 'Period',
  tableHeaderStatementReference: 'Reference',
  tableHeaderStatus: 'Status',
  tableHeaderBalanceDifference: 'Difference',
  tableHeaderActions: 'Actions',

  // Reconciliation status
  statusDraft: 'Draft',
  statusCompleted: 'Completed',

  // Reconciliation details
  reconciliationSessionAriaLabel: 'Reconciliation session for %d',
  viewReconciliationDetailsTitle: 'View reconciliation details',
  viewReconciliationDetailsAriaLabel: 'View details for reconciliation %d',

  // TODO placeholders
  todoCreateReconciliationMessage: 'TODO: Implement create reconciliation dialog',
  todoViewReconciliationMessage: 'TODO: Implement view reconciliation details',
  todoCashCountMessage: 'TODO: Implement cash count feature',

  // Reconciliation Table
  reconciliationTableAriaLabel: 'Reconciliation sessions',

  // Reconciliation Account Creation Dialog
  createAccountDialogTitle: 'Create Reconciliation Account',
  selectAccountTypeLabel: 'Select Account Type',
  selectAccountTypeDescription: 'Choose the type of reconciliation account you want to create.',
  adjustmentAccountLabel: 'Reconciliation Adjustment',
  adjustmentAccountDescription: 'Used to record discrepancies found during bank and account reconciliations.',
  cashOverShortAccountLabel: 'Cash Over/Short',
  cashOverShortAccountDescription: 'Used specifically for recording cash count discrepancies.',
  uniqueAccountWarning: '(Only one account can have this tag)',
  accountTypeRequiredError: 'Account type is required.',
  changeAccountTypeAriaLabel: 'Change account type',
  accountWillBeTaggedLabel: 'This account will be tagged as:',
  reconciliationAdjustmentAccountName: 'Reconciliation Adjustment',
  cashOverShortAccountName: 'Cash Over/Short',

  // Missing Accounts Warning
  missingReconciliationAccountsTitle: 'Reconciliation Accounts Required',
  missingReconciliationAccountsMessage: 'Before you can perform reconciliations, you need to create reconciliation accounts to record any discrepancies found.',
  createReconciliationAccountButtonLabel: 'Create Account',
  accountCreatedSuccessMessage: 'Reconciliation account created successfully.',

  // Cash Count List
  loadingCashCountsAriaLabel: 'Loading cash counts',
  loadingCashCountsMessage: 'Loading cash counts...',
  unableToLoadCashCountsTitle: 'Unable to Load Cash Counts',
  noCashCountsFoundTitle: 'No Cash Counts Found',
  noCashCountsFoundMessage: 'No cash counts match your search criteria.',
  noCashCountsFoundEmptyMessage: 'No cash counts have been recorded yet. Click the button below to perform your first cash count.',
  createCashCountButtonLabel: 'Count Cash',
  refreshCashCountsAriaLabel: 'Refresh cash counts list',

  // Cash Count Filters
  accountFilterLabel: 'Account',
  accountFilterAriaLabel: 'Filter by account',
  allAccountsLabel: 'All Accounts',
  discrepancyFilterLabel: 'Discrepancy',
  discrepancyFilterAriaLabel: 'Filter by discrepancy type',
  allDiscrepanciesLabel: 'All',
  balancedLabel: 'Balanced',
  overageLabel: 'Overage',
  shortageLabel: 'Shortage',

  // Cash Count Table Headers
  tableHeaderCountTime: 'Count Time',
  tableHeaderSystemBalance: 'System Balance',
  tableHeaderCountedAmount: 'Counted Amount',
  tableHeaderDiscrepancy: 'Discrepancy',
  tableHeaderDiscrepancyType: 'Type',
  tableHeaderNote: 'Note',
  cashCountTableAriaLabel: 'Cash count history',
  cashCountRowAriaLabel: 'Cash count for %d',

  // Cash Count Details
  viewCashCountDetailsTitle: 'View cash count details',
  viewCashCountDetailsAriaLabel: 'View details for cash count %d',
  todoViewCashCountMessage: 'TODO: Implement view cash count details',

  // Missing Cash Accounts Warning
  missingCashAccountsTitle: 'No Cash Accounts Found',
  missingCashAccountsMessage: 'You need to tag at least one account with "Cash Flow - Cash Equivalents" to perform cash counts. Go to Chart of Accounts to set up your cash accounts.',

  // Cash Count Creation Dialog
  createCashCountDialogTitle: 'Record Cash Count',
  createCashCountDescription: 'Count the physical cash in your account and record any discrepancies.',
  cashAccountLabel: 'Cash Account',
  selectCashAccountOption: 'Select a cash account...',
  selectAccountFirstLabel: 'Select Account First',
  selectAccountFirstMessage: 'Please select a cash account to view the reconciliation notice.',
  systemBalanceLabel: 'System Balance',
  countedAmountLabel: 'Counted Amount',
  countTimeLabel: 'Count Time',
  noteLabel: 'Note (Optional)',
  cashShortageLabel: 'Cash Shortage',
  cashOverageLabel: 'Cash Overage',
  discrepancyWillBeRecordedMessage: 'This discrepancy will be automatically recorded in the accounting system.',
  cashCountBalancedMessage: 'The cash count is balanced and will be recorded without any journal entry.',

  // Cash Count Creation Errors
  cashCountCreationErrorTitle: 'Unable to Create Cash Count',
  invalidCountTimeError: 'Invalid count time. Please select a valid date and time.',
  draftReconciliationExistsError: 'Cannot perform cash count: a draft reconciliation session exists for this account. Please complete or delete the draft reconciliation first.',

  // Common
  cancelButtonLabel: 'Cancel',
  dismissButtonLabel: 'Dismiss',
  unknownErrorMessage: 'An unknown error occurred.',

  // Account Reconciliation Creation Dialog
  createReconciliationTitle: 'Create Reconciliation',
  closeButtonLabel: 'Close',
  createButtonLabel: 'Create',

  accountSectionTitle: 'Account',
  accountLabel: 'Account',
  selectAccountButtonLabel: 'Select Account',

  periodSectionTitle: 'Statement Period',
  beginDateLabel: 'Statement Begin Date',
  endDateLabel: 'Statement End Date',
  periodInvalidError: 'Statement begin date must be before end date.',

  internalRecordTitle: 'Internal Records',
  internalOpeningBalanceLabel: 'Opening Balance (Internal)',
  internalClosingBalanceLabel: 'Closing Balance (Internal)',

  statementRecordTitle: 'Statement Records',
  statementOpeningBalanceLabel: 'Opening Balance (Statement)',
  statementClosingBalanceLabel: 'Closing Balance (Statement)',

  detailsSectionTitle: 'Details',
  statementReferenceLabel: 'Statement Reference',

  errorTitle: 'Error',
  accountRequiredError: 'Account is required.',
  beginDateRequiredError: 'Statement begin date is required.',
  endDateRequiredError: 'Statement end date is required.',

  // Reconciliation Details Dialog
  detailsDialogTitle: 'Reconciliation Details',
  detailsDialogTitleWithId: 'Reconciliation #%d',
  statementPeriodLabel: 'Statement Period',
  reconciliationDateLabel: 'Reconciliation Date',
  statusLabel: 'Status',

  // Balances Section
  balancesTitle: 'Balances',
  internalBalancesSubtitle: 'Internal Records',
  statementBalancesSubtitle: 'Statement Records',
  balanceDifferenceLabel: 'Balance Difference',

  // Statement Items Section
  statementItemsTitle: 'Statement Items',
  totalItemsLabel: 'Total Items',
  matchedItemsLabel: 'Matched',
  unmatchedItemsLabel: 'Unmatched',
  itemDateLabel: 'Date',
  itemDescriptionLabel: 'Description',
  itemReferenceLabel: 'Reference',
  itemDebitLabel: 'Debit',
  itemCreditLabel: 'Credit',
  itemStatusLabel: 'Status',
  itemStatusMatched: 'Matched',
  itemStatusUnmatched: 'Unmatched',

  // Discrepancies Section
  discrepanciesTitle: 'Discrepancies',
  totalDiscrepanciesLabel: 'Total Discrepancies',
  discrepancyTypeLabel: 'Type',
  discrepancyAmountLabel: 'Amount',
  discrepancyResolutionLabel: 'Resolution',
  discrepancyUnrecordedDebit: 'Unrecorded Debit',
  discrepancyUnrecordedCredit: 'Unrecorded Credit',
  discrepancyTimingDifference: 'Timing Difference',
  discrepancyAmountDifference: 'Amount Difference',
  discrepancyMissingInStatement: 'Missing in Statement',
  discrepancyDuplicate: 'Duplicate',
  discrepancyOther: 'Other',
  resolutionPending: 'Pending',
  resolutionAdjusted: 'Adjusted',
  resolutionAccepted: 'Accepted',
  resolutionWrittenOff: 'Written Off',
  resolutionInvestigated: 'Investigated',

  // Adjustment Journal Entry
  adjustmentEntryTitle: 'Adjustment Entry',
  adjustmentEntryRefLabel: 'Entry Reference',
  viewAdjustmentEntryLabel: 'View Adjustment Entry',

  // Notes Section
  notesTitle: 'Notes',
  noNoteLabel: 'No notes',

  // Actions
  closeDetailsButtonLabel: 'Close',
  completeReconciliationButtonLabel: 'Complete Reconciliation',
  deleteReconciliationButtonLabel: 'Delete',

  // Completion confirmation
  completeConfirmationTitle: 'Complete Reconciliation',
  completeConfirmationMessage: 'Are you sure you want to complete this reconciliation? Any unmatched items will be automatically adjusted.',
  completeConfirmationWarning: 'This action cannot be undone.',

  // Delete confirmation
  deleteConfirmationTitle: 'Delete Reconciliation',
  deleteConfirmationMessage: 'Are you sure you want to delete this reconciliation session? This action cannot be undone.',
  deleteWarning: 'All statement items and matches will be permanently removed.',

  // Action labels
  confirmActionLabel: 'Confirm',

  // Loading states
  loadingDetailsLabel: 'Loading details...',
  completingLabel: 'Completing reconciliation...',
  deletingLabel: 'Deleting reconciliation...',

  // Error states
  loadErrorTitle: 'Unable to Load Details',
  completionErrorTitle: 'Unable to Complete Reconciliation',
  deletionErrorTitle: 'Unable to Delete Reconciliation',
  reconciliationNotFoundError: 'Reconciliation session not found.',

  // Common labels
  toLabel: 'to',
  referenceLabel: 'Reference',
  openingBalanceLabel: 'Opening Balance',
  closingBalanceLabel: 'Closing Balance',
  cancelActionLabel: 'Cancel',
  processingLabel: 'Processing...',
};

/** @typedef {typeof reconciliation} ReconciliationTranslation */

export default reconciliation;
