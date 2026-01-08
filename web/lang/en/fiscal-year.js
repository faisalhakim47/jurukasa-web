const fiscalYear = {
  // View - List
  viewTitle: 'Fiscal Years',
  loadingLabel: 'Loading fiscal years...',
  loadErrorTitle: 'Unable to load fiscal years',
  retryActionLabel: 'Retry',
  refreshActionLabel: 'Refresh',
  emptyStateTitle: 'No fiscal years defined',
  emptyStateMessage: 'Create your first fiscal year to organize your accounting periods and enable income statement reporting.',
  createActionLabel: 'Create Fiscal Year',
  newFiscalYearActionLabel: 'New Fiscal Year',
  
  // Table columns
  nameColumn: 'Name',
  beginDateColumn: 'Begin Date',
  endDateColumn: 'End Date',
  statusColumn: 'Status',
  closedOnColumn: 'Closed On',
  closingEntryColumn: 'Closing Entry',
  
  // Status labels
  statusOpen: 'Open',
  statusClosed: 'Closed',
  statusReversed: 'Reversed',
  
  // Fiscal year row display
  fiscalYearDefaultName: 'FY %d',
  reverseActionLabel: 'Reverse',
  
  // Creation Dialog
  creationTitle: 'Create Fiscal Year',
  creationSubmitLabel: 'Create',
  creationLoadingLabel: 'Creating fiscal year...',
  creationSuccessLabel: 'Fiscal year created!',
  closeDialogLabel: 'Close dialog',
  loadingFormLabel: 'Loading form...',
  
  nameLabel: 'Name (Optional)',
  nameHelperText: 'e.g., "FY 2025" or "Fiscal Year 2025"',
  beginDateLabel: 'Begin Date',
  beginDateHelperText: 'First day of the fiscal year',
  endDateLabel: 'End Date',
  endDateHelperText: 'Last day of the fiscal year (30-400 days from begin date)',
  
  // Validation errors
  minDurationError: 'Fiscal year must be at least 30 days',
  maxDurationError: 'Fiscal year cannot exceed 400 days',
  overlapError: 'Fiscal year periods cannot overlap with existing fiscal years',
  validationError: 'Error validating date range',
  
  // Closing Dialog
  closingDetailsTitle: 'Fiscal Year Details',
  closingDefaultTitle: 'Fiscal Year',
  closingSubmitLabel: 'Close Fiscal Year',
  closingLoadingLabel: 'Closing...',
  closingSuccessLabel: 'Closed!',
  loadingDetailsLabel: 'Loading fiscal year details...',
  errorTitle: 'Error',
  loadingFiscalYearLabel: 'Loading fiscal year details',
  
  // Sections
  periodSectionTitle: 'Period',
  financialSummarySectionTitle: 'Financial Summary',
  closingRequirementsSectionTitle: 'Closing Requirements',
  closingDetailsSectionTitle: 'Closing Details',
  reversalDetailsSectionTitle: 'Reversal Details',
  
  // Period info
  periodBeginDateLabel: 'Begin Date',
  periodEndDateLabel: 'End Date',
  
  // Financial summary
  totalRevenueLabel: 'Total Revenue',
  totalExpensesLabel: 'Total Expenses',
  netIncomeLabel: 'Net Income',
  
  // Closing requirements
  unpostedEntriesWarningTitle: 'Unposted Entries',
  unpostedEntriesWarningMessage: 'There are %d unposted journal entries within this fiscal year period. All entries must be posted before closing.',
  readyToCloseTitle: 'Ready to Close',
  readyToCloseMessage: 'All journal entries within this fiscal year are posted. You can proceed with closing.',
  
  // Closing details
  closedOnLabel: 'Closed On',
  closingEntryLabel: 'Closing Entry',
  
  // Closing info notice
  closingInfoTitle: 'About Closing',
  closingInfoMessage: 'Closing a fiscal year will:',
  closingInfoPoint1: 'Create closing journal entries to zero out revenue and expense accounts',
  closingInfoPoint2: 'Transfer net income to retained earnings',
  closingInfoPoint3: 'Lock the fiscal year from further modifications',
  closingInfoWarning: 'This action can be reversed if needed, but should be done carefully.',
  
  // Closing Confirmation Dialog
  confirmClosingTitle: 'Close Fiscal Year?',
  confirmClosingMessage: 'This action will:',
  confirmClosingPoint1: 'Create closing journal entries to zero out all revenue and expense accounts',
  confirmClosingPoint2: 'Transfer the net income/loss to retained earnings',
  confirmClosingPoint3: 'Lock this fiscal year from further modifications',
  confirmClosingWarning: 'You can reverse this action later if needed, but closing should be done carefully.',
  confirmClosingActionLabel: 'Close Fiscal Year',
  cancelLabel: 'Cancel',
  
  // Reversal Dialog
  reversalTitle: 'Reverse Fiscal Year',
  reversalSubmitLabel: 'Reverse Fiscal Year',
  reversalLoadingLabel: 'Reversing...',
  reversalSuccessLabel: 'Reversed!',
  loadFiscalYearErrorTitle: 'Unable to load fiscal year',
  noFiscalYearSelected: 'No fiscal year selected',
  
  // Reversal details
  reversedOnLabel: 'Reversed On',
  reversalEntryLabel: 'Reversal Entry',
  
  // Reversal warning
  reversalWarningTitle: 'About Reversal',
  reversalWarningMessage: 'Reversing a fiscal year will:',
  reversalWarningPoint1: 'Create a reversal journal entry that undoes the closing entries',
  reversalWarningPoint2: 'Reopen the accounts that were closed',
  reversalWarningPoint3: 'Allow you to create a new fiscal year for the same period',
  reversalWarningNote: 'This should only be done if the fiscal year was closed incorrectly.',
  
  // Cannot reverse notice
  cannotReverseMessage: 'This fiscal year cannot be reversed because there are newer fiscal years that depend on it. You must reverse any subsequent fiscal years first.',
  
  // Reversal Confirmation Dialog
  confirmReversalTitle: 'Reverse Fiscal Year?',
  confirmReversalMessage: 'This action will:',
  confirmReversalPoint1: 'Create a reversal journal entry to undo all closing entries',
  confirmReversalPoint2: 'Restore account balances to their pre-closing state',
  confirmReversalPoint3: 'Mark this fiscal year as reversed',
  confirmReversalWarning: 'Only proceed if you need to correct an incorrectly closed fiscal year.',
  confirmReversalActionLabel: 'Reverse Fiscal Year',
  
  // Common
  dismissLabel: 'Dismiss',
  fiscalYearNotFound: 'Fiscal year not found',
};

/** @typedef {typeof fiscalYear} FiscalYearTranslation */

export default fiscalYear;
