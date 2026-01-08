/** @import { FixedAssetTranslation } from '#web/lang/en/fixed-asset.js' */

export default /** @type {FixedAssetTranslation} */ ({
  // Creation Dialog
  creationTitle: 'Tambah Aset Tetap',
  addAssetActionLabel: 'Tambah Aset',
  closeActionLabel: 'Tutup',
  creatingAssetLabel: 'Sedang membuat aset tetap...',

  // Basic Information Section
  basicInfoSectionTitle: 'Informasi Dasar',
  assetNameLabel: 'Nama Aset',
  assetNameSupportingText: 'Nama deskriptif untuk aset tetap ini',
  descriptionLabel: 'Deskripsi (Opsional)',
  descriptionSupportingText: 'Rincian tambahan tentang aset',

  // Financial Information Section
  financialInfoSectionTitle: 'Informasi Keuangan',
  acquisitionDateLabel: 'Tanggal Perolehan',
  acquisitionDateSupportingText: 'Tanggal saat aset diperoleh',
  acquisitionCostLabel: 'Harga Perolehan',
  acquisitionCostSupportingText: 'Total biaya perolehan aset (dalam denominasi terkecil)',
  usefulLifeLabel: 'Masa Manfaat (Tahun)',
  usefulLifeSupportingText: 'Perkiraan masa manfaat aset dalam tahun',
  salvageValueLabel: 'Nilai Residu',
  salvageValueSupportingText: 'Perkiraan nilai pada akhir masa manfaat (bawaan: 0)',

  // Account Assignment Section
  accountAssignmentSectionTitle: 'Penetapan Akun',
  fixedAssetAccountLabel: 'Akun Aset Tetap',
  fixedAssetAccountSupportingText: 'Akun aset (mis., Peralatan, Kendaraan)',
  accumulatedDepreciationAccountLabel: 'Akun Akumulasi Penyusutan',
  accumulatedDepreciationAccountSupportingText: 'Akun kontra aset untuk akumulasi penyusutan',
  depreciationExpenseAccountLabel: 'Akun Beban Penyusutan',
  depreciationExpenseAccountSupportingText: 'Akun beban untuk mencatat penyusutan',
  paymentAccountLabel: 'Akun Pembayaran',
  paymentAccountSupportingText: 'Akun kas atau bank yang digunakan untuk pembayaran',
  clearAccountLabel: 'Hapus pilihan akun',
  openAccountSelectorLabel: 'Buka pemilih akun',

  // Details Dialog
  detailsTitle: 'Rincian Aset Tetap',
  editActionLabel: 'Ubah',
  saveChangesActionLabel: 'Simpan Perubahan',
  cancelActionLabel: 'Batal',
  savingChangesLabel: 'Menyimpan perubahan...',
  loadingDetailsLabel: 'Memuat rincian aset...',
  assetNotFoundTitle: 'Aset Tetap Tidak Ditemukan',
  assetNotFoundMessage: 'Aset tetap yang diminta tidak dapat ditemukan.',

  // View Mode - Basic Information
  nameLabel: 'Nama',
  statusLabel: 'Status',
  statusActive: 'Aktif',
  statusFullyDepreciated: 'Telah Tersusut Penuh',
  descriptionInfoLabel: 'Deskripsi',

  // View Mode - Financial Information
  acquisitionDateInfoLabel: 'Tanggal Perolehan',
  acquisitionCostInfoLabel: 'Harga Perolehan',
  usefulLifeInfoLabel: 'Masa Manfaat',
  usefulLifeYearsFormat: '%d tahun',
  salvageValueInfoLabel: 'Nilai Residu',
  annualDepreciationLabel: 'Penyusutan Tahunan',
  depreciableAmountLabel: 'Jumlah yang Dapat Disusutkan',

  // View Mode - Depreciation Progress
  depreciationProgressSectionTitle: 'Progres Penyusutan',
  accumulatedDepreciationLabel: 'Akumulasi Penyusutan',
  bookValueLabel: 'Nilai Buku',

  // View Mode - Account Assignment
  assetAccountLabel: 'Akun Aset',
  accumulatedDepreciationAccountInfoLabel: 'Akun Akumulasi Penyusutan',
  depreciationExpenseAccountInfoLabel: 'Akun Beban Penyusutan',
  paymentAccountInfoLabel: 'Akun Pembayaran',

  // View Mode - Depreciation History
  depreciationHistorySectionTitle: 'Riwayat Penyusutan',
  dateColumnInfo: 'Tanggal',
  noteColumnInfo: 'Catatan',
  amountColumnInfo: 'Jumlah',
  noNoteLabel: '—',

  // Danger Zone
  dangerZoneSectionTitle: 'Zona Bahaya',
  dangerZoneWarning: 'Menghapus aset ini juga akan menghapus jurnal perolehannya.',
  deleteAssetActionLabel: 'Hapus Aset',

  // Edit Mode
  editInfoMessage: 'Rincian keuangan tidak dapat diubah karena aset ini telah memiliki akumulasi penyusutan.',

  // Delete Confirmation
  confirmDeleteTitle: 'Hapus Aset Tetap?',
  confirmDeleteMessage: 'Apakah Anda yakin ingin menghapus "%s"? Tindakan ini tidak dapat dibatalkan.',
  deleteConfirmActionLabel: 'Hapus',
  deletingLabel: 'Menghapus...',

  // Error Dialog
  errorDialogTitle: 'Galat',
  dismissLabel: 'Tutup',

  // Validation Errors
  assetNameRequired: 'Nama aset wajib diisi.',
  acquisitionDateRequired: 'Tanggal perolehan wajib diisi.',
  acquisitionCostPositive: 'Harga perolehan harus positif.',
  usefulLifePositive: 'Masa manfaat harus positif.',
  salvageValueNegative: 'Nilai residu tidak boleh negatif.',
  salvageValueTooHigh: 'Nilai residu harus lebih kecil dari harga perolehan.',
  assetAccountRequired: 'Silakan pilih akun aset tetap.',
  accumulatedDepreciationAccountRequired: 'Silakan pilih akun akumulasi penyusutan.',
  depreciationExpenseAccountRequired: 'Silakan pilih akun beban penyusutan.',
  paymentAccountRequired: 'Silakan pilih akun pembayaran.',
  accountsMustBeDifferent: 'Akun aset, akumulasi penyusutan, dan beban harus berbeda.',
  invalidAcquisitionDate: 'Tanggal perolehan tidak valid.',
  cannotDeleteWithDepreciation: 'Tidak dapat menghapus aset tetap yang memiliki akumulasi penyusutan.',

  // View
  searchLabel: 'Cari',
  statusFilterLabel: 'Status',
  filterAll: 'Semua',
  filterActive: 'Aktif',
  filterFullyDepreciated: 'Telah Tersusut Penuh',
  refreshActionLabel: 'Segarkan',
  addFixedAssetActionLabel: 'Tambah Aset Tetap',

  // Loading & Empty States
  loadingAssetsLabel: 'Memuat aset tetap...',
  loadErrorTitle: 'Gagal memuat aset tetap',
  retryActionLabel: 'Coba Lagi',
  emptyStateTitle: 'Tidak ada aset tetap ditemukan',
  emptyStateMessageFiltered: 'Coba sesuaikan pencarian atau filter Anda.',
  emptyStateMessage: 'Mulai dengan mencatat aset tetap pertama Anda untuk melacak penyusutan.',

  // Table Columns
  nameColumnInfo: 'Nama',
  acquisitionDateColumnInfo: 'Tanggal Perolehan',
  acquisitionCostColumnInfo: 'Harga Perolehan',
  usefulLifeColumnInfo: 'Masa Manfaat',
  accumulatedDepreciationColumnInfo: 'Akum. Penyusutan',
  bookValueColumnInfo: 'Nilai Buku',
  statusColumnInfo: 'Status',
  progressColumnInfo: 'Progres',

  // Pagination
  paginationShowing: 'Menampilkan %d–%d dari %d',
  paginationPage: 'Halaman %d dari %d',
  paginationFirst: 'Halaman pertama',
  paginationPrevious: 'Halaman sebelumnya',
  paginationNext: 'Halaman berikutnya',
  paginationLast: 'Halaman terakhir',
});
