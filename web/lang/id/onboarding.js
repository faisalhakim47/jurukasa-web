/** @import { OnboardingTranslation } from '#web/lang/en/onboarding.js' */

export default /** @type {Partial<OnboardingTranslation>} */ ({
  loadingIndicatorLabel: 'Memuat...',
  loadingTemplatesIndicatorLabel: 'Memuat template...',

  // Welcome screen
  welcomeTitle: 'Selamat Datang di JuruKasa',
  welcomeMessage: 'JuruKasa adalah aplikasi point-of-sale modern yang dirancang untuk bisnis Indonesia dengan fitur akuntansi terintegrasi.',
  featuresTitle: 'Fitur Utama',
  featurePOS: 'Point of Sale - Proses penjualan dengan cepat dan efisien',
  featureInventory: 'Manajemen Persediaan - Pantau stok dan pergerakan barang',
  featureAccounting: 'Akuntansi - Mengikuti standar akuntansi Indonesia',
  featureReports: 'Laporan Keuangan - Buat laporan bisnis yang komprehensif',
  getStartedButton: 'Mulai',
  selectLanguageLabel: 'Pilih Bahasa Anda',
  languageLabel: 'Bahasa',

  // Database setup
  databaseConfigTitle: 'Konfigurasi Database',
  databaseConfigDescription: 'Konfigurasi koneksi database Turso Anda dengan menyediakan URL dan kunci autentikasi.',
  databaseConfigSubmitLabel: 'Hubungkan',
  databaseConnectingLabel: 'Menghubungkan...',
  databaseConnectedLabel: 'Terhubung',
  databaseFailedLabel: 'Gagal',
  tursoDatabaseUrlLabel: 'URL Database Turso',
  tursoDatabaseUrlPlaceholder: 'URL Database Turso',
  tursoDatabaseUrlDescription: 'URL dari instance database Turso Anda, biasanya dimulai dengan "https://".',
  tursoDatabaseKeyLabel: 'Kunci Auth Database Turso',
  tursoDatabaseKeyPlaceholder: 'Kunci Auth Database Turso',
  tursoDatabaseKeyDescription: 'Token autentikasi yang diperlukan untuk mengakses database Turso Anda.',

  // Business configuration
  businessConfigTitle: 'Konfigurasi Usaha',
  businessConfigSubmitLabel: 'Berikutnya',
  businessNameLabel: 'Nama Usaha',
  businessTypeLabel: 'Jenis Usaha',
  businessCurrencyCodeLabel: 'Kode Mata Uang',
  businessCurrencyDecimalsLabel: 'Desimal Mata Uang',
  businessLocaleLabel: 'Lokal',
  businessLanguageLabel: 'Bahasa',
  businessFiscalYearStartMonthLabel: 'Bulan Awal Tahun Fiskal',

  // Chart of accounts setup
  chartOfAccountsSetupTitle: 'Pilih Template Daftar Akun',
  chartOfAccountsSetupSubmitLabel: 'Selesai',

  unknownState: 'Status tidak dikenal: {0}',
});
