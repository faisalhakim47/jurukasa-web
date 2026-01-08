const dashboard = {
  // Page Header
  dashboardTitle: 'Dashboard',
  dashboardDescription: 'Welcome to JuruKasa',

  // Loading State
  loadingDashboardAriaLabel: 'Loading dashboard',
  loadingDashboardMessage: 'Loading dashboard...',

  // Error State
  unableToLoadDashboardTitle: 'Unable to load dashboard',
  retryButtonLabel: 'Retry',

  // Fiscal Year Card
  fiscalYearTitle: 'Fiscal Year',
  noActiveFiscalYearMessage: 'No active fiscal year',
  setupFiscalYearMessage: 'Set up a fiscal year to start tracking your accounting period.',
  fiscalYearProgressAriaLabel: 'Fiscal year progress',
  fiscalYearCompletedText: '%d%% of fiscal year completed',

  // Financial Metrics
  financialMetricsAriaLabel: 'Financial metrics',
  netRevenueLabel: 'Net Revenue',
  cashBalanceLabel: 'Cash Balance',
  bankBalanceLabel: 'Bank Balance',
  accountsPayableLabel: 'Accounts Payable',

  // Stock Alerts
  stockAlertsTitle: 'Stock Alerts',
  lowStockItemsSubtitle: 'Low stock items',
  allItemsWellStockedMessage: 'All items are well stocked',
  itemsRunningLowSubtitle: '%d item(s) running low',
  lowStockItemsAriaLabel: 'Low stock items',
  remainingStockText: '%d remaining',
  viewAllStockButtonLabel: 'View all stock',

  // Recent Sales
  recentSalesTitle: 'Recent Sales',
  latestTransactionsSubtitle: 'Latest transactions',
  noSalesRecordedMessage: 'No sales recorded yet',
  newSaleButtonLabel: 'New Sale',
  recentSalesAriaLabel: 'Recent sales',
  saleNamePrefix: 'Sale #%d',
  viewAllSalesButtonLabel: 'View all sales',
};

/** @typedef {typeof dashboard} DashboardTranslation */

export default dashboard;
