/** @import { FiscalYearTranslation } from '#web/lang/en/fiscal-year.js' */

export default /** @type {Partial<FiscalYearTranslation>} */ ({
  // View - List
  viewTitle: 'Tahun Fiskal',
  loadingLabel: 'Memuat tahun fiskal...',
  loadErrorTitle: 'Gagal memuat tahun fiskal',
  retryActionLabel: 'Coba Lagi',
  refreshActionLabel: 'Segarkan',
  emptyStateTitle: 'Belum ada tahun fiskal',
  emptyStateMessage: 'Buat tahun fiskal pertama Anda untuk mengatur periode akuntansi dan mengaktifkan laporan laba rugi.',
  createActionLabel: 'Buat Tahun Fiskal',
  newFiscalYearActionLabel: 'Tahun Fiskal Baru',
  
  // Table columns
  nameColumn: 'Nama',
  beginDateColumn: 'Tanggal Mulai',
  endDateColumn: 'Tanggal Akhir',
  statusColumn: 'Status',
  closedOnColumn: 'Ditutup Pada',
  closingEntryColumn: 'Jurnal Penutup',
  
  // Status labels
  statusOpen: 'Terbuka',
  statusClosed: 'Ditutup',
  statusReversed: 'Dibalik',
  
  // Fiscal year row display
  fiscalYearDefaultName: 'TF %d',
  reverseActionLabel: 'Balik',
  
  // Creation Dialog
  creationTitle: 'Buat Tahun Fiskal',
  creationSubmitLabel: 'Buat',
  creationLoadingLabel: 'Sedang membuat tahun fiskal...',
  creationSuccessLabel: 'Tahun fiskal berhasil dibuat!',
  closeDialogLabel: 'Tutup dialog',
  loadingFormLabel: 'Memuat formulir...',
  
  nameLabel: 'Nama (Opsional)',
  nameHelperText: 'contoh: "TF 2025" atau "Tahun Fiskal 2025"',
  beginDateLabel: 'Tanggal Mulai',
  beginDateHelperText: 'Hari pertama tahun fiskal',
  endDateLabel: 'Tanggal Akhir',
  endDateHelperText: 'Hari terakhir tahun fiskal (30-400 hari dari tanggal mulai)',
  
  // Validation errors
  minDurationError: 'Tahun fiskal harus minimal 30 hari',
  maxDurationError: 'Tahun fiskal tidak boleh melebihi 400 hari',
  overlapError: 'Periode tahun fiskal tidak boleh tumpang tindih dengan tahun fiskal yang sudah ada',
  validationError: 'Gagal memvalidasi rentang tanggal',
  
  // Closing Dialog
  closingDetailsTitle: 'Rincian Tahun Fiskal',
  closingDefaultTitle: 'Tahun Fiskal',
  closingSubmitLabel: 'Tutup Tahun Fiskal',
  closingLoadingLabel: 'Menutup...',
  closingSuccessLabel: 'Berhasil ditutup!',
  loadingDetailsLabel: 'Memuat rincian tahun fiskal...',
  errorTitle: 'Galat',
  loadingFiscalYearLabel: 'Memuat rincian tahun fiskal',
  
  // Sections
  periodSectionTitle: 'Periode',
  financialSummarySectionTitle: 'Ringkasan Keuangan',
  closingRequirementsSectionTitle: 'Persyaratan Penutupan',
  closingDetailsSectionTitle: 'Rincian Penutupan',
  reversalDetailsSectionTitle: 'Rincian Pembalikan',
  
  // Period info
  periodBeginDateLabel: 'Tanggal Mulai',
  periodEndDateLabel: 'Tanggal Akhir',
  
  // Financial summary
  totalRevenueLabel: 'Total Pendapatan',
  totalExpensesLabel: 'Total Beban',
  netIncomeLabel: 'Laba Bersih',
  
  // Closing requirements
  unpostedEntriesWarningTitle: 'Jurnal Belum Diposting',
  unpostedEntriesWarningMessage: 'Terdapat %d jurnal yang belum diposting dalam periode tahun fiskal ini. Semua jurnal harus diposting sebelum ditutup.',
  readyToCloseTitle: 'Siap Ditutup',
  readyToCloseMessage: 'Semua jurnal dalam periode tahun fiskal ini telah diposting. Anda dapat melanjutkan penutupan.',
  
  // Closing details
  closedOnLabel: 'Ditutup Pada',
  closingEntryLabel: 'Jurnal Penutup',
  
  // Closing info notice
  closingInfoTitle: 'Tentang Penutupan',
  closingInfoMessage: 'Menutup tahun fiskal akan:',
  closingInfoPoint1: 'Membuat jurnal penutup untuk mengosongkan akun pendapatan dan beban',
  closingInfoPoint2: 'Mentransfer laba bersih ke laba ditahan',
  closingInfoPoint3: 'Mengunci tahun fiskal dari modifikasi lebih lanjut',
  closingInfoWarning: 'Tindakan ini dapat dibalik jika diperlukan, tetapi harus dilakukan dengan hati-hati.',
  
  // Closing Confirmation Dialog
  confirmClosingTitle: 'Tutup Tahun Fiskal?',
  confirmClosingMessage: 'Tindakan ini akan:',
  confirmClosingPoint1: 'Membuat jurnal penutup untuk mengosongkan semua akun pendapatan dan beban',
  confirmClosingPoint2: 'Mentransfer laba/rugi bersih ke laba ditahan',
  confirmClosingPoint3: 'Mengunci tahun fiskal ini dari modifikasi lebih lanjut',
  confirmClosingWarning: 'Anda dapat membalik tindakan ini nanti jika diperlukan, tetapi penutupan harus dilakukan dengan hati-hati.',
  confirmClosingActionLabel: 'Tutup Tahun Fiskal',
  cancelLabel: 'Batal',
  
  // Reversal Dialog
  reversalTitle: 'Balik Tahun Fiskal',
  reversalSubmitLabel: 'Balik Tahun Fiskal',
  reversalLoadingLabel: 'Membalik...',
  reversalSuccessLabel: 'Berhasil dibalik!',
  loadFiscalYearErrorTitle: 'Gagal memuat tahun fiskal',
  noFiscalYearSelected: 'Tidak ada tahun fiskal yang dipilih',
  
  // Reversal details
  reversedOnLabel: 'Dibalik Pada',
  reversalEntryLabel: 'Jurnal Pembalikan',
  
  // Reversal warning
  reversalWarningTitle: 'Tentang Pembalikan',
  reversalWarningMessage: 'Membalik tahun fiskal akan:',
  reversalWarningPoint1: 'Membuat jurnal pembalikan yang membatalkan jurnal penutup',
  reversalWarningPoint2: 'Membuka kembali akun-akun yang telah ditutup',
  reversalWarningPoint3: 'Mengizinkan Anda untuk membuat tahun fiskal baru untuk periode yang sama',
  reversalWarningNote: 'Ini hanya boleh dilakukan jika tahun fiskal ditutup secara tidak benar.',
  
  // Cannot reverse notice
  cannotReverseMessage: 'Tahun fiskal ini tidak dapat dibalik karena ada tahun fiskal yang lebih baru yang bergantung padanya. Anda harus membalik tahun fiskal berikutnya terlebih dahulu.',
  
  // Reversal Confirmation Dialog
  confirmReversalTitle: 'Balik Tahun Fiskal?',
  confirmReversalMessage: 'Tindakan ini akan:',
  confirmReversalPoint1: 'Membuat jurnal pembalikan untuk membatalkan semua jurnal penutup',
  confirmReversalPoint2: 'Mengembalikan saldo akun ke keadaan sebelum penutupan',
  confirmReversalPoint3: 'Menandai tahun fiskal ini sebagai dibalik',
  confirmReversalWarning: 'Hanya lanjutkan jika Anda perlu memperbaiki tahun fiskal yang ditutup secara tidak benar.',
  confirmReversalActionLabel: 'Balik Tahun Fiskal',
  
  // Common
  dismissLabel: 'Tutup',
  fiscalYearNotFound: 'Tahun fiskal tidak ditemukan',
});
