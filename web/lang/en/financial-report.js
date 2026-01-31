const financialReport = {
  // Report Type
  reportTypeTrialBalance: 'Trial Balance',
  reportTypeBalanceSheet: 'Balance Sheet',
  reportTypeIncomeStatement: 'Income Statement',
  
  // Loading and Error
  loadingReportsLabel: 'Loading reports...',
  unableToLoadReportsTitle: 'Unable to load reports',
  retryActionLabel: 'Retry',
  refreshActionLabel: 'Refresh',
  
  // Selectors
  reportTypeLabel: 'Report Type',
  reportDateLabel: 'Report Date',
  fiscalYearLabel: 'Fiscal Year',
  reportTypeMenuLabel: 'Report type menu',
  reportDateMenuLabel: 'Report date menu',
  fiscalYearMenuLabel: 'Fiscal year menu',
  selectReportLabel: 'Select Report',
  selectFiscalYearLabel: 'Select Fiscal Year',
  
  // Empty States
  noReportsAvailable: 'No reports available',
  noFiscalYearsDefined: 'No fiscal years defined',
  noReportsGeneratedTitle: 'No reports generated',
  noReportsGeneratedMessage: 'Generate a new balance report to view trial balance and balance sheet.',
  noIncomeStatementDataTitle: 'No income statement data',
  noIncomeStatementFiscalYearMessage: 'Create a fiscal year to generate income statements.',
  noIncomeStatementTransactionsMessage: 'No revenue or expense transactions found for the selected fiscal year.',
  
  // Actions
  generateReportActionLabel: 'Generate Report',
  generatingReportLabel: 'Generating...',
  
  // Report Details
  reportIdFormat: 'Report #%d',
  reportDetailsWithDate: '%s • %s',
  fiscalYearDefaultName: 'Fiscal Year',
  fiscalYearDateRange: '%s – %s',
  fiscalYearStatusOpen: 'Open',
  fiscalYearStatusClosed: 'Closed',
  
  // Trial Balance
  trialBalanceTableLabel: 'Trial Balance',
  codeColumnHeader: 'Code',
  accountNameColumnHeader: 'Account Name',
  normalColumnHeader: 'Normal',
  debitColumnHeader: 'Debit',
  creditColumnHeader: 'Credit',
  normalBalanceDebit: 'Dr',
  normalBalanceCredit: 'Cr',
  totalRowLabel: 'Total',
  noAmountLabel: '—',
  
  // Balance Sheet
  balanceSheetTableLabel: 'Balance Sheet',
  amountColumnHeader: 'Amount',
  classificationAssets: 'Assets',
  classificationLiabilities: 'Liabilities',
  classificationEquity: 'Equity',
  categoryCurrentAssets: 'Current Assets',
  categoryNonCurrentAssets: 'Non-Current Assets',
  categoryCurrentLiabilities: 'Current Liabilities',
  categoryNonCurrentLiabilities: 'Non-Current Liabilities',
  categoryEquity: 'Equity',
  totalCategoryFormat: 'Total %s',
  totalClassificationFormat: 'Total %s',
  liabilitiesEquityTotalLabel: 'Liabilities + Equity',
  balanceSheetBalancedMessage: 'Assets = Liabilities + Equity',
  balanceSheetOutOfBalanceMessage: 'Balance Sheet is out of balance by %c',
  
  // Income Statement
  incomeStatementTableLabel: 'Income Statement',
  classificationRevenue: 'Revenue',
  classificationCostOfGoodsSold: 'Cost of Goods Sold',
  classificationExpenses: 'Expenses',
  grossProfitLabel: 'Gross Profit',
  netIncomeLabel: 'Net Income',
  
  // Ad hoc report name
  adHocReportNameFormat: 'Report %s',

  // Balance Report Creation Dialog
  generateReportDialogTitle: 'Generate Balance Report',
  reportNameLabel: 'Report Name',
  reportNameHelperText: 'Optional name to identify this report',
  reportDateTimeLabel: 'Report Date & Time',
  reportDateTimeHelperText: 'The date and time to snapshot the account balances',
  loadingFormLabel: 'Loading form...',
  generationProgressLabel: 'Generating report...',
  invalidDateTimeError: 'Invalid date and time specified',
  errorTitle: 'Error',
  dismissLabel: 'Dismiss',
  closeDialogLabel: 'Close dialog',

  // Fiscal Year Details
  balanceReportsBeforeClosingTitle: 'Balance Reports Before Closing',
  balanceReportsAfterClosingTitle: 'Balance Reports After Closing',
  closingEntryDetailsTitle: 'Closing Entry Details',
  noBalanceReportsBeforeClosing: 'No balance reports generated before closing',
  noBalanceReportsAfterClosing: 'No balance reports generated after closing',
  loadingDetailsLabel: 'Loading details...',
};

/** @typedef {typeof financialReport} FinancialReportTranslation */

export default financialReport;
