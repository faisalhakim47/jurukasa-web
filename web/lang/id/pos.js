/** @import { PosTranslation } from '#web/lang/en/pos.js' */

export default /** @type {Partial<PosTranslation>} */ ({
  // POS View Header
  posTitle: 'Kasir',
  
  // Sale Header
  saleTimeLabel: 'Waktu Penjualan',
  customerNameLabel: 'Nama Pelanggan',
  
  // Inventory Selector
  productsTitle: 'Produk',
  searchLabel: 'Cari',
  noProductsFoundMessage: 'Tidak ada produk ditemukan',
  loadingIndicatorAriaLabel: 'Memuat produk',
  stockLabel: 'Stok',
  
  // Items Section
  itemsSectionTitle: 'Item',
  itemsCountLabel: '%d item',
  itemsCountLabelPlural: '%d item',
  noItemsAddedTitle: 'Belum ada item yang ditambahkan',
  noItemsAddedMessage: 'Pilih produk dari panel kanan',
  itemsTableAriaLabel: 'Item penjualan',
  tableHeaderProduct: 'Produk',
  tableHeaderUnitPrice: 'Harga Satuan',
  tableHeaderQuantity: 'Kuantitas',
  tableHeaderTotal: 'Total',
  subtotalLabel: 'Subtotal',
  decreaseQuantityAriaLabel: 'Kurangi kuantitas',
  increaseQuantityAriaLabel: 'Tambah kuantitas',
  removeItemAriaLabel: 'Hapus item',
  
  // Discounts Section
  discountsSectionTitle: 'Diskon',
  autoApplyDiscountsLabel: 'Terapkan diskon otomatis',
  addDiscountButtonLabel: 'Tambah Diskon',
  selectDiscountLabel: 'Pilih Diskon',
  noDiscountsAppliedMessage: 'Tidak ada diskon yang diterapkan',
  discountsTableAriaLabel: 'Diskon',
  tableHeaderDiscount: 'Diskon',
  tableHeaderAmount: 'Jumlah',
  totalDiscountLabel: 'Total Diskon',
  removeDiscountAriaLabel: 'Hapus diskon',
  
  // Payments Section
  paymentsSectionTitle: 'Pembayaran',
  autoApplyCashPaymentLabel: 'Terapkan Pembayaran Tunai Otomatis',
  addPaymentButtonLabel: 'Tambah Pembayaran',
  addPaymentTitle: 'Tambah Pembayaran',
  paymentMethodLabel: 'Metode Pembayaran',
  amountLabel: 'Jumlah',
  addButtonLabel: 'Tambah',
  noPaymentsAddedMessage: 'Tidak ada pembayaran yang ditambahkan',
  paymentsTableAriaLabel: 'Pembayaran',
  tableHeaderMethod: 'Metode',
  tableHeaderFee: 'Biaya',
  totalPaidLabel: 'Total Dibayar',
  removePaymentAriaLabel: 'Hapus pembayaran',
  autoPaymentIndicator: '(Otomatis)',
  
  // Total Summary
  totalLabel: 'Total',
  paidLabel: 'Dibayar',
  remainingLabel: 'Sisa',
  changeLabel: 'Kembalian',
  
  // Action Buttons
  clearButtonLabel: 'Bersihkan',
  completeSaleButtonLabel: 'Selesaikan Penjualan',
  processingButtonLabel: 'Memproses...',
  
  // Success Dialog
  saleCompleteTitle: 'Penjualan Selesai',
  saleCompleteMessage: 'Penjualan #%d telah berhasil dicatat.',
  
  // Error Dialog
  errorTitle: 'Kesalahan',
  dismissButtonLabel: 'Tutup',
  atLeastOneItemErrorMessage: 'Harap tambahkan setidaknya satu item ke penjualan.',
  paymentIncompleteErrorMessage: 'Pembayaran belum lengkap. Sisa saldo: %c',
});
