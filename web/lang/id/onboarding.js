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
  databaseConfigDescription: 'Pilih tempat penyimpanan data bisnis Anda. Pilih penyedia database yang sesuai dengan kebutuhan Anda.',
  databaseConfigSubmitLabel: 'Hubungkan',
  databaseConnectingLabel: 'Menghubungkan...',
  databaseConnectedLabel: 'Terhubung',
  databaseFailedLabel: 'Gagal',
  databaseProviderLabel: 'Penyedia Database',

  // Local SQLite provider
  localDatabaseLabel: 'Database Lokal',
  localDatabaseDescription: 'Simpan data di penyimpanan browser. Direkomendasikan untuk penggunaan perangkat tunggal.',

  // Turso provider
  tursoDatabaseLabel: 'Turso SQLite',
  tursoDatabaseDescription: 'Simpan data di database cloud Turso. Dapat diakses dari beberapa perangkat.',
  tursoUrlLabel: 'URL Database',
  tursoUrlPlaceholder: 'https://database-anda.turso.io',
  tursoUrlDescription: 'URL dari instance database Turso Anda.',
  tursoAuthTokenLabel: 'Token Autentikasi',
  tursoAuthTokenPlaceholder: 'Token autentikasi Turso Anda',
  tursoAuthTokenDescription: 'Token autentikasi untuk database Turso Anda.',

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

  unknownState: 'Status tidak dikenal: %d',
});
