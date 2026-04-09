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
  
  // Empty States
  noReportsGeneratedTitle: 'No reports generated',
  noReportsGeneratedMessage: 'Generate a new balance report to view trial balance and balance sheet.',
  noIncomeStatementDataTitle: 'No income statement data',
  noIncomeStatementTransactionsMessage: 'No revenue or expense transactions found for the selected fiscal year.',
  
  // Actions
  generateReportActionLabel: 'Generate Report',
  
  // Report Details
  reportIdFormat: 'Report #%d',
  
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
};

/** @typedef {typeof financialReport} FinancialReportTranslation */

export default financialReport;
