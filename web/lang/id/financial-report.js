/** @import { FinancialReportTranslation } from '#web/lang/en/financial-report.js' */

export default /** @type {Partial<FinancialReportTranslation>} */ ({
  // Report Type
  reportTypeTrialBalance: 'Neraca Saldo',
  reportTypeBalanceSheet: 'Neraca',
  reportTypeIncomeStatement: 'Laba Rugi',
  
  // Loading and Error
  loadingReportsLabel: 'Memuat laporan...',
  unableToLoadReportsTitle: 'Gagal memuat laporan',
  retryActionLabel: 'Coba Lagi',
  refreshActionLabel: 'Segarkan',
  
  // Selectors
  reportTypeLabel: 'Jenis Laporan',
  reportDateLabel: 'Tanggal Laporan',
  fiscalYearLabel: 'Tahun Fiskal',
  reportTypeMenuLabel: 'Menu jenis laporan',
  reportDateMenuLabel: 'Menu tanggal laporan',
  fiscalYearMenuLabel: 'Menu tahun fiskal',
  selectReportLabel: 'Pilih Laporan',
  selectFiscalYearLabel: 'Pilih Tahun Fiskal',
  
  // Empty States
  noReportsAvailable: 'Tidak ada laporan tersedia',
  noFiscalYearsDefined: 'Belum ada tahun fiskal',
  noReportsGeneratedTitle: 'Belum ada laporan dibuat',
  noReportsGeneratedMessage: 'Buat laporan neraca baru untuk melihat neraca saldo dan neraca.',
  noIncomeStatementDataTitle: 'Tidak ada data laba rugi',
  noIncomeStatementFiscalYearMessage: 'Buat tahun fiskal untuk menghasilkan laporan laba rugi.',
  noIncomeStatementTransactionsMessage: 'Tidak ditemukan transaksi pendapatan atau beban untuk tahun fiskal yang dipilih.',
  
  // Actions
  generateReportActionLabel: 'Buat Laporan',
  generatingReportLabel: 'Sedang membuat...',
  
  // Report Details
  reportIdFormat: 'Laporan #%d',
  reportDetailsWithDate: '%s • %s',
  fiscalYearDefaultName: 'Tahun Fiskal',
  fiscalYearDateRange: '%s – %s',
  fiscalYearStatusOpen: 'Terbuka',
  fiscalYearStatusClosed: 'Ditutup',
  
  // Trial Balance
  trialBalanceTableLabel: 'Neraca Saldo',
  codeColumnHeader: 'Kode',
  accountNameColumnHeader: 'Nama Akun',
  normalColumnHeader: 'Normal',
  debitColumnHeader: 'Debit',
  creditColumnHeader: 'Kredit',
  normalBalanceDebit: 'Dr',
  normalBalanceCredit: 'Kr',
  totalRowLabel: 'Total',
  noAmountLabel: '—',
  
  // Balance Sheet
  balanceSheetTableLabel: 'Neraca',
  amountColumnHeader: 'Jumlah',
  classificationAssets: 'Aset',
  classificationLiabilities: 'Liabilitas',
  classificationEquity: 'Ekuitas',
  categoryCurrentAssets: 'Aset Lancar',
  categoryNonCurrentAssets: 'Aset Tidak Lancar',
  categoryCurrentLiabilities: 'Liabilitas Jangka Pendek',
  categoryNonCurrentLiabilities: 'Liabilitas Jangka Panjang',
  categoryEquity: 'Ekuitas',
  totalCategoryFormat: 'Total %s',
  totalClassificationFormat: 'Total %s',
  liabilitiesEquityTotalLabel: 'Liabilitas + Ekuitas',
  balanceSheetBalancedMessage: 'Aset = Liabilitas + Ekuitas',
  balanceSheetOutOfBalanceMessage: 'Neraca tidak seimbang sebesar %c',
  
  // Income Statement
  incomeStatementTableLabel: 'Laba Rugi',
  classificationRevenue: 'Pendapatan',
  classificationCostOfGoodsSold: 'Harga Pokok Penjualan',
  classificationExpenses: 'Beban',
  grossProfitLabel: 'Laba Kotor',
  netIncomeLabel: 'Laba Bersih',
  
  // Ad hoc report name
  adHocReportNameFormat: 'Laporan %s',
});
