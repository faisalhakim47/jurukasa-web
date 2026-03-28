/** @import { BarcodeTranslation } from '#web/lang/en/barcode.js' */

export default /** @type {Partial<BarcodeTranslation>} */ ({
  // Barcode Assignment Dialog
  assignDialogTitle: 'Tetapkan Barcode',
  barcodeLabel: 'Barcode',
  inventoryLabel: 'Inventaris',
  clearInventoryAriaLabel: 'Hapus inventaris',
  selectInventoryAriaLabel: 'Pilih inventaris',
  cancelButtonLabel: 'Batal',
  assignButtonLabel: 'Tetapkan',
  barcodeAlreadyAssignedToThisError: 'Barcode ini sudah ditetapkan untuk inventaris ini.',
  barcodeAlreadyAssignedToAnotherError: 'Barcode ini sudah ditetapkan untuk inventaris lain.',
  errorDialogTitle: 'Kesalahan',
  errorOccurredMessage: 'Terjadi kesalahan: %s',
  dismissButtonLabel: 'Tutup',

  // Barcodes View
  searchLabel: 'Cari',
  clearSearchAriaLabel: 'Hapus pencarian',
  assignBarcodeButtonLabel: 'Tetapkan Barcode',
  noBarcodeMatchSearchMessage: 'Tidak ada barcode yang cocok dengan pencarian Anda',
  noBarcodesAssignedMessage: 'Belum ada barcode yang ditetapkan',
  tableHeaderBarcode: 'Barcode',
  tableHeaderProductName: 'Nama Produk',
  tableHeaderAction: 'Aksi',
  paginationInfo: '%d-%d dari %d',
  paginationNoResults: 'Tidak ada hasil',
  previousPageAriaLabel: 'Halaman sebelumnya',
  nextPageAriaLabel: 'Halaman selanjutnya',
  confirmUnassignDialogTitle: 'Lepas Tetapan Barcode',
  confirmUnassignMessage: 'Apakah Anda yakin ingin melepas tetapan barcode <strong>%s</strong> dari <strong>%s</strong>?',
  unassignButtonLabel: 'Lepas Tetapan',

  // Inventory Details Dialog - Barcode Section
  barcodesSection: 'Barcode',
  noBarcodesAssignedText: 'Tidak ada barcode yang ditetapkan.',
  addBarcodeLabel: 'Tambah Barcode',
  addButtonLabel: 'Tambah',
  removeBarcodeAriaLabel: 'Hapus barcode %s',
});
