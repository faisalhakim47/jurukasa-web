/** @import { SettingsTranslation } from '#web/lang/en/settings.js' */

export default /** @type {Partial<SettingsTranslation>} */ ({
  // Page Header
  settingsTitle: 'Pengaturan',
  settingsDescription: 'Konfigurasi akuntansi dan pengaturan POS.',
  settingsSectionsAriaLabel: 'Bagian pengaturan',

  // Tab Labels
  accountingConfigTabLabel: 'Konfigurasi Akuntansi',
  paymentMethodsTabLabel: 'Metode Pembayaran',
  versionsTabLabel: 'Versi Applikasi',

  // Loading State
  loadingAriaLabel: 'Memuat',
  loadingMessage: 'Memuat...',

  // Error State
  unableToLoadDataTitle: 'Tidak dapat memuat data',
  retryButtonLabel: 'Coba Lagi',

  // Config Form
  savingConfigurationMessage: 'Menyimpan konfigurasi...',
  selectPlaceholder: 'Pilih...',
  resetButtonLabel: 'Atur Ulang',
  saveChangesButtonLabel: 'Simpan Perubahan',

  // Payment Methods Empty State
  noPaymentMethodsTitle: 'Belum ada metode pembayaran',
  noPaymentMethodsMessage: 'Tambahkan metode pembayaran untuk mengaktifkan opsi pembayaran yang berbeda di sistem POS. Setiap metode pembayaran terhubung ke akun untuk pencatatan akuntansi yang tepat.',
  addPaymentMethodButtonLabel: 'Tambah Metode Pembayaran',

  // Payment Methods Table
  nameColumnHeader: 'Nama',
  accountColumnHeader: 'Akun',
  feeColumnHeader: 'Biaya',
  noFeeLabel: 'Tanpa biaya',

  // Section Headers
  accountingConfigurationTitle: 'Konfigurasi Akuntansi',
  refreshConfigurationAriaLabel: 'Segarkan konfigurasi',
  refreshButtonLabel: 'Segarkan',
  paymentMethodsTitle: 'Metode Pembayaran',
  refreshPaymentMethodsAriaLabel: 'Segarkan metode pembayaran',

  // Not Found Dialog
  pageNotFoundTitle: 'Halaman Tidak Ditemukan',
  pageNotFoundMessage: 'Halaman pengaturan yang Anda cari tidak ada.',
  goToAccountingConfigButtonLabel: 'Ke Konfigurasi Akuntansi',

  // Success Dialog
  settingsSavedTitle: 'Pengaturan Tersimpan',
  settingsSavedMessage: 'Konfigurasi telah berhasil diperbarui.',

  // Error Dialog
  errorOccurredTitle: 'Terjadi Kesalahan',
  dismissButtonLabel: 'Tutup',

  // Database Management Tab
  databaseTabLabel: 'Basis Data',
  databaseManagementTitle: 'Manajemen Basis Data',
  refreshDatabasesAriaLabel: 'Segarkan daftar basis data',
  newDatabaseButtonLabel: 'Basis Data Baru',

  // Database List Table
  providerColumnHeader: 'Penyedia',
  databaseNameColumnHeader: 'Nama',
  actionsColumnHeader: 'Tindakan',

  // Provider Labels
  localProviderLabel: 'Lokal',
  tursoProviderLabel: 'Turso',

  // Database Actions
  databaseInfoButtonLabel: 'Info',
  databaseUseButtonLabel: 'Gunakan',
  databaseExportButtonLabel: 'Ekspor',

  // Database Empty State
  noDatabasesTitle: 'Belum ada basis data',
  noDatabasesMessage: 'Tambahkan basis data untuk menyimpan data bisnis Anda. Anda dapat menggunakan basis data browser lokal atau terhubung ke basis data cloud.',

  // Database Info Dialog
  databaseInfoDialogTitle: 'Informasi Basis Data',
  databaseInfoProviderLabel: 'Penyedia',
  databaseInfoNameLabel: 'Nama',
  databaseInfoUrlLabel: 'URL',
  databaseInfoStatusLabel: 'Status',
  databaseInfoActiveStatus: 'Aktif',
  databaseInfoInactiveStatus: 'Tidak Aktif',
  databaseInfoCloseButtonLabel: 'Tutup',

  // Database Switch Confirmation
  switchDatabaseDialogTitle: 'Ganti Basis Data',
  switchDatabaseMessage: 'Apakah Anda yakin ingin beralih ke basis data ini? Aplikasi akan dimuat ulang.',
  switchDatabaseConfirmButtonLabel: 'Ganti',
  switchDatabaseCancelButtonLabel: 'Batal',

  // Database Export
  exportingDatabaseMessage: 'Mengekspor basis data...',
  exportDatabaseSuccessMessage: 'Basis data berhasil diekspor.',
  exportDatabaseErrorMessage: 'Gagal mengekspor basis data.',

  // Database Setup Navigation
  databaseSetupTitle: 'Pengaturan Basis Data',
  databaseSetupBackButtonLabel: 'Batal',
  databaseSetupDescription: 'Konfigurasi basis data baru untuk data bisnis Anda.',

  // Version Manager
  versionManagerTitle: 'Manajer Versi',
  refreshVersionsAriaLabel: 'Segarkan daftar versi',
  noAppVersionsTitle: 'Tidak ada versi aplikasi',
  noAppVersionsMessage: 'Tidak ada versi aplikasi yang tersimpan dalam konfigurasi service worker.',
  versionPrefixColumnHeader: 'Prefiks',
  versionValueColumnHeader: 'Versi',
  versionSourcesColumnHeader: 'Sumber',
  versionActionsColumnHeader: 'Tindakan',
  versionManagerTableAriaLabel: 'Daftar versi aplikasi',
  versionUseButtonLabel: 'Gunakan',
  versionUseButtonAriaLabel: 'Gunakan versi %s',
  versionCurrentLabel: 'Saat Ini',

  // Version Switch Dialog
  versionSwitchDialogTitle: 'Ganti Versi',
  versionSwitchDialogMessage: 'Apakah Anda yakin ingin beralih ke versi %s? Aplikasi akan dimuat ulang setelah versi baru diunduh.',
  versionSwitchDialogConfirmButtonLabel: 'Ganti',
  versionSwitchDialogCancelButtonLabel: 'Batal',
  versionSwitchDialogLoadingMessage: 'Mengunduh dan mengaktifkan versi...',
  versionSwitchDialogLoadingNote: 'Aplikasi akan otomatis dimuat ulang saat siap.',
  versionLocalSourceLabel: 'Lokal',
  versionNpmSourceLabel: 'NPM',
});
