const reconciliation = {
  // Reconciliation View
  reconciliationTitle: 'Rekonsiliasi',
  reconciliationDescription: 'Rekonsiliasi akun Anda dan lakukan penghitungan kas.',
  reconciliationSectionsAriaLabel: 'Bagian rekonsiliasi',
  accountReconciliationTabLabel: 'Rekonsiliasi Akun',
  cashCountTabLabel: 'Penghitungan Kas',

  // Account Reconciliation List
  loadingReconciliationsAriaLabel: 'Memuat rekonsiliasi',
  loadingReconciliationsMessage: 'Memuat rekonsiliasi...',
  unableToLoadReconciliationsTitle: 'Tidak Dapat Memuat Rekonsiliasi',
  noReconciliationsFoundTitle: 'Tidak Ada Rekonsiliasi',
  noReconciliationsFoundMessage: 'Tidak ada sesi rekonsiliasi yang sesuai dengan kriteria pencarian Anda.',
  noReconciliationsFoundEmptyMessage: 'Belum ada sesi rekonsiliasi yang dibuat. Klik tombol di bawah untuk membuat rekonsiliasi pertama Anda.',
  
  // Actions
  createReconciliationButtonLabel: 'Buat Rekonsiliasi',
  refreshReconciliationsAriaLabel: 'Muat ulang daftar rekonsiliasi',
  refreshButtonLabel: 'Muat Ulang',
  retryButtonLabel: 'Coba Lagi',
  
  // Search and filters
  searchLabel: 'Cari',
  statusFilterLabel: 'Status',
  statusFilterAriaLabel: 'Filter berdasarkan status',
  allStatusLabel: 'Semua',
  draftStatusLabel: 'Draft',
  completedStatusLabel: 'Selesai',
  
  // Table headers
  tableHeaderAccount: 'Akun',
  tableHeaderReconciliationTime: 'Tanggal',
  tableHeaderStatementPeriod: 'Periode',
  tableHeaderStatementReference: 'Referensi',
  tableHeaderStatus: 'Status',
  tableHeaderBalanceDifference: 'Selisih',
  tableHeaderActions: 'Aksi',
  
  // Reconciliation status
  statusDraft: 'Draft',
  statusCompleted: 'Selesai',
  
  // Reconciliation details
  reconciliationSessionAriaLabel: 'Sesi rekonsiliasi untuk %d',
  viewReconciliationDetailsTitle: 'Lihat detail rekonsiliasi',
  viewReconciliationDetailsAriaLabel: 'Lihat detail untuk rekonsiliasi %d',
  
  // TODO placeholders
  todoCreateReconciliationMessage: 'TODO: Implementasi dialog buat rekonsiliasi',
  todoViewReconciliationMessage: 'TODO: Implementasi tampilan detail rekonsiliasi',
  todoCashCountMessage: 'TODO: Implementasi fitur penghitungan kas',
  
  // Reconciliation Table
  reconciliationTableAriaLabel: 'Sesi rekonsiliasi',

  // Reconciliation Account Creation Dialog
  createAccountDialogTitle: 'Buat Akun Rekonsiliasi',
  selectAccountTypeLabel: 'Pilih Tipe Akun',
  selectAccountTypeDescription: 'Pilih tipe akun rekonsiliasi yang ingin Anda buat.',
  adjustmentAccountLabel: 'Penyesuaian Rekonsiliasi',
  adjustmentAccountDescription: 'Digunakan untuk mencatat perbedaan yang ditemukan selama rekonsiliasi bank dan akun.',
  cashOverShortAccountLabel: 'Selisih Kas',
  cashOverShortAccountDescription: 'Digunakan khusus untuk mencatat selisih penghitungan kas.',
  uniqueAccountWarning: '(Hanya satu akun yang bisa memiliki tag ini)',
  accountTypeRequiredError: 'Tipe akun wajib diisi.',
  changeAccountTypeAriaLabel: 'Ubah tipe akun',
  accountWillBeTaggedLabel: 'Akun ini akan ditandai sebagai:',
  reconciliationAdjustmentAccountName: 'Penyesuaian Rekonsiliasi',
  cashOverShortAccountName: 'Selisih Kas',
  
  // Missing Accounts Warning
  missingReconciliationAccountsTitle: 'Akun Rekonsiliasi Diperlukan',
  missingReconciliationAccountsMessage: 'Sebelum dapat melakukan rekonsiliasi, Anda perlu membuat akun rekonsiliasi untuk mencatat selisih yang ditemukan.',
  createReconciliationAccountButtonLabel: 'Buat Akun',
  accountCreatedSuccessMessage: 'Akun rekonsiliasi berhasil dibuat.',

  // Cash Count List
  loadingCashCountsAriaLabel: 'Memuat penghitungan kas',
  loadingCashCountsMessage: 'Memuat penghitungan kas...',
  unableToLoadCashCountsTitle: 'Tidak Dapat Memuat Penghitungan Kas',
  noCashCountsFoundTitle: 'Tidak Ada Penghitungan Kas',
  noCashCountsFoundMessage: 'Tidak ada penghitungan kas yang sesuai dengan kriteria pencarian Anda.',
  noCashCountsFoundEmptyMessage: 'Belum ada penghitungan kas yang dicatat. Klik tombol di bawah untuk melakukan penghitungan kas pertama Anda.',
  createCashCountButtonLabel: 'Hitung Kas',
  refreshCashCountsAriaLabel: 'Muat ulang daftar penghitungan kas',
  
  // Cash Count Filters
  accountFilterLabel: 'Akun',
  accountFilterAriaLabel: 'Filter berdasarkan akun',
  allAccountsLabel: 'Semua Akun',
  discrepancyFilterLabel: 'Selisih',
  discrepancyFilterAriaLabel: 'Filter berdasarkan jenis selisih',
  allDiscrepanciesLabel: 'Semua',
  balancedLabel: 'Seimbang',
  overageLabel: 'Kelebihan',
  shortageLabel: 'Kekurangan',
  
  // Cash Count Table Headers
  tableHeaderCountTime: 'Waktu Hitung',
  tableHeaderSystemBalance: 'Saldo Sistem',
  tableHeaderCountedAmount: 'Jumlah Terhitung',
  tableHeaderDiscrepancy: 'Selisih',
  tableHeaderDiscrepancyType: 'Tipe',
  tableHeaderNote: 'Catatan',
  cashCountTableAriaLabel: 'Riwayat penghitungan kas',
  cashCountRowAriaLabel: 'Penghitungan kas untuk %d',
  
  // Cash Count Details
  viewCashCountDetailsTitle: 'Lihat detail penghitungan kas',
  viewCashCountDetailsAriaLabel: 'Lihat detail untuk penghitungan kas %d',
  todoViewCashCountMessage: 'TODO: Implementasi tampilan detail penghitungan kas',
  
  // Missing Cash Accounts Warning
  missingCashAccountsTitle: 'Tidak Ada Akun Kas',
  missingCashAccountsMessage: 'Anda perlu menandai setidaknya satu akun dengan "Cash Flow - Cash Equivalents" untuk melakukan penghitungan kas. Buka Bagan Akun untuk mengatur akun kas Anda.',
  
  // Cash Count Creation Dialog
  createCashCountDialogTitle: 'Catat Penghitungan Kas',
  createCashCountDescription: 'Hitung kas fisik di akun Anda dan catat selisih yang ditemukan.',
  cashAccountLabel: 'Akun Kas',
  selectCashAccountOption: 'Pilih akun kas...',
  selectAccountFirstLabel: 'Pilih Akun Terlebih Dahulu',
  selectAccountFirstMessage: 'Silakan pilih akun kas untuk melihat pemberitahuan rekonsiliasi.',
  systemBalanceLabel: 'Saldo Sistem',
  countedAmountLabel: 'Jumlah Terhitung',
  countTimeLabel: 'Waktu Hitung',
  noteLabel: 'Catatan (Opsional)',
  cashShortageLabel: 'Kekurangan Kas',
  cashOverageLabel: 'Kelebihan Kas',
  discrepancyWillBeRecordedMessage: 'Selisih ini akan otomatis dicatat dalam sistem akuntansi.',
  cashCountBalancedMessage: 'Penghitungan kas seimbang dan akan dicatat tanpa entri jurnal apa pun.',
  
  // Cash Count Creation Errors
  cashCountCreationErrorTitle: 'Tidak Dapat Membuat Penghitungan Kas',
  invalidCountTimeError: 'Waktu hitung tidak valid. Silakan pilih tanggal dan waktu yang valid.',
  draftReconciliationExistsError: 'Tidak dapat melakukan penghitungan kas: ada sesi rekonsiliasi draft untuk akun ini. Silakan selesaikan atau hapus rekonsiliasi draft terlebih dahulu.',
  
  // Reconciliation Details Dialog
  detailsDialogTitle: 'Detail Rekonsiliasi',
  detailsDialogTitleWithId: 'Rekonsiliasi #%d',
  statementPeriodLabel: 'Periode Rekening',
  reconciliationDateLabel: 'Tanggal Rekonsiliasi',
  statusLabel: 'Status',

  // Balances Section
  balancesTitle: 'Saldo',
  internalBalancesSubtitle: 'Catatan Internal',
  statementBalancesSubtitle: 'Catatan Rekening',
  balanceDifferenceLabel: 'Selisih Saldo',

  // Statement Items Section
  statementItemsTitle: 'Item Rekening',
  totalItemsLabel: 'Total Item',
  matchedItemsLabel: 'Cocok',
  unmatchedItemsLabel: 'Tidak Cocok',
  itemDateLabel: 'Tanggal',
  itemDescriptionLabel: 'Deskripsi',
  itemReferenceLabel: 'Referensi',
  itemDebitLabel: 'Debit',
  itemCreditLabel: 'Kredit',
  itemStatusLabel: 'Status',
  itemStatusMatched: 'Dicocokkan',
  itemStatusUnmatched: 'Belum Dicocokkan',

  // Discrepancies Section
  discrepanciesTitle: 'Selisih',
  totalDiscrepanciesLabel: 'Total Selisih',
  discrepancyTypeLabel: 'Tipe',
  discrepancyAmountLabel: 'Jumlah',
  discrepancyResolutionLabel: 'Resolusi',
  discrepancyUnrecordedDebit: 'Debit Tidak Tercatat',
  discrepancyUnrecordedCredit: 'Kredit Tidak Tercatat',
  discrepancyTimingDifference: 'Selisih Waktu',
  discrepancyAmountDifference: 'Selisih Jumlah',
  discrepancyMissingInStatement: 'Tidak Ada di Rekening',
  discrepancyDuplicate: 'Duplikat',
  discrepancyOther: 'Lainnya',
  resolutionPending: 'Tertunda',
  resolutionAdjusted: 'Disesuaikan',
  resolutionAccepted: 'Diterima',
  resolutionWrittenOff: 'Dihapusbukukan',
  resolutionInvestigated: 'Dalam Investigasi',

  // Adjustment Journal Entry
  adjustmentEntryTitle: 'Entri Penyesuaian',
  adjustmentEntryRefLabel: 'Referensi Entri',
  viewAdjustmentEntryLabel: 'Lihat Entri Penyesuaian',

  // Notes Section
  notesTitle: 'Catatan',
  noNoteLabel: 'Tidak ada catatan',

  // Actions
  closeDetailsButtonLabel: 'Tutup',
  completeReconciliationButtonLabel: 'Selesaikan Rekonsiliasi',
  deleteReconciliationButtonLabel: 'Hapus',

  // Completion confirmation
  completeConfirmationTitle: 'Selesaikan Rekonsiliasi',
  completeConfirmationMessage: 'Apakah Anda yakin ingin menyelesaikan rekonsiliasi ini? Item yang tidak cocok akan disesuaikan secara otomatis.',
  completeConfirmationWarning: 'Tindakan ini tidak dapat dibatalkan.',

  // Delete confirmation
  deleteConfirmationTitle: 'Hapus Rekonsiliasi',
  deleteConfirmationMessage: 'Apakah Anda yakin ingin menghapus sesi rekonsiliasi ini? Tindakan ini tidak dapat dibatalkan.',
  deleteWarning: 'Semua item rekening dan pencocokan akan dihapus secara permanen.',

  // Action labels
  confirmActionLabel: 'Konfirmasi',

  // Loading states
  loadingDetailsLabel: 'Memuat detail...',
  completingLabel: 'Menyelesaikan rekonsiliasi...',
  deletingLabel: 'Menghapus rekonsiliasi...',

  // Error states
  loadErrorTitle: 'Tidak Dapat Memuat Detail',
  completionErrorTitle: 'Tidak Dapat Menyelesaikan Rekonsiliasi',
  deletionErrorTitle: 'Tidak Dapat Menghapus Rekonsiliasi',
  reconciliationNotFoundError: 'Sesi rekonsiliasi tidak ditemukan.',

  // Common
  cancelButtonLabel: 'Batal',
  dismissButtonLabel: 'Tutup',
  unknownErrorMessage: 'Terjadi kesalahan yang tidak diketahui.',
};

/** @typedef {typeof reconciliation} ReconciliationTranslation */

export default reconciliation;
