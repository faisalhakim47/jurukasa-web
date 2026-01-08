/** @import { DashboardTranslation } from '#web/lang/en/dashboard.js' */

export default /** @type {Partial<DashboardTranslation>} */ ({
  // Page Header
  dashboardTitle: 'Dasbor',
  dashboardDescription: 'Selamat datang di JuruKasa',

  // Loading State
  loadingDashboardAriaLabel: 'Memuat dasbor',
  loadingDashboardMessage: 'Memuat dasbor...',

  // Error State
  unableToLoadDashboardTitle: 'Tidak dapat memuat dasbor',
  retryButtonLabel: 'Coba Lagi',

  // Fiscal Year Card
  fiscalYearTitle: 'Tahun Fiskal',
  noActiveFiscalYearMessage: 'Tidak ada tahun fiskal aktif',
  setupFiscalYearMessage: 'Atur tahun fiskal untuk mulai melacak periode akuntansi Anda.',
  fiscalYearProgressAriaLabel: 'Progres tahun fiskal',
  fiscalYearCompletedText: '%d%% tahun fiskal selesai',

  // Financial Metrics
  financialMetricsAriaLabel: 'Metrik keuangan',
  netRevenueLabel: 'Pendapatan Bersih',
  cashBalanceLabel: 'Saldo Kas',
  bankBalanceLabel: 'Saldo Bank',
  accountsPayableLabel: 'Hutang Usaha',

  // Stock Alerts
  stockAlertsTitle: 'Peringatan Stok',
  lowStockItemsSubtitle: 'Barang stok rendah',
  allItemsWellStockedMessage: 'Semua barang memiliki stok yang cukup',
  itemsRunningLowSubtitle: '%d barang stok menipis',
  lowStockItemsAriaLabel: 'Barang stok rendah',
  remainingStockText: '%d tersisa',
  viewAllStockButtonLabel: 'Lihat semua stok',

  // Recent Sales
  recentSalesTitle: 'Penjualan Terbaru',
  latestTransactionsSubtitle: 'Transaksi terbaru',
  noSalesRecordedMessage: 'Belum ada penjualan tercatat',
  newSaleButtonLabel: 'Penjualan Baru',
  recentSalesAriaLabel: 'Penjualan terbaru',
  saleNamePrefix: 'Penjualan #%d',
  viewAllSalesButtonLabel: 'Lihat semua penjualan',
});
