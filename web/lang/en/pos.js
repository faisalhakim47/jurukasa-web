const pos = {
  // POS View Header
  posTitle: 'Point of Sale',
  
  // Sale Header
  saleTimeLabel: 'Sale Time',
  customerNameLabel: 'Customer Name',
  
  // Inventory Selector
  productsTitle: 'Products',
  searchLabel: 'Search',
  noProductsFoundMessage: 'No products found',
  loadingIndicatorAriaLabel: 'Loading products',
  stockLabel: 'Stock',
  
  // Items Section
  itemsSectionTitle: 'Items',
  itemsCountLabel: '%d item',
  itemsCountLabelPlural: '%d items',
  noItemsAddedTitle: 'No items added yet',
  noItemsAddedMessage: 'Select products from the right panel',
  itemsTableAriaLabel: 'Sale items',
  tableHeaderProduct: 'Product',
  tableHeaderUnitPrice: 'Unit Price',
  tableHeaderQuantity: 'Quantity',
  tableHeaderTotal: 'Total',
  subtotalLabel: 'Subtotal',
  decreaseQuantityAriaLabel: 'Decrease quantity',
  increaseQuantityAriaLabel: 'Increase quantity',
  removeItemAriaLabel: 'Remove item',
  
  // Discounts Section
  discountsSectionTitle: 'Discounts',
  autoApplyDiscountsLabel: 'Auto apply discounts',
  addDiscountButtonLabel: 'Add Discount',
  selectDiscountLabel: 'Select Discount',
  noDiscountsAppliedMessage: 'No discounts applied',
  discountsTableAriaLabel: 'Discounts',
  tableHeaderDiscount: 'Discount',
  tableHeaderAmount: 'Amount',
  totalDiscountLabel: 'Total Discount',
  removeDiscountAriaLabel: 'Remove discount',
  
  // Payments Section
  paymentsSectionTitle: 'Payments',
  autoApplyCashPaymentLabel: 'Auto-apply Cash Payment',
  addPaymentButtonLabel: 'Add Payment',
  addPaymentTitle: 'Add Payment',
  paymentMethodLabel: 'Payment Method',
  amountLabel: 'Amount',
  addButtonLabel: 'Add',
  noPaymentsAddedMessage: 'No payments added',
  paymentsTableAriaLabel: 'Payments',
  tableHeaderMethod: 'Method',
  tableHeaderFee: 'Fee',
  totalPaidLabel: 'Total Paid',
  removePaymentAriaLabel: 'Remove payment',
  autoPaymentIndicator: '(Auto)',
  
  // Total Summary
  totalLabel: 'Total',
  paidLabel: 'Paid',
  remainingLabel: 'Remaining',
  changeLabel: 'Change',
  
  // Action Buttons
  clearButtonLabel: 'Clear',
  completeSaleButtonLabel: 'Complete Sale',
  processingButtonLabel: 'Processing...',
  
  // Success Dialog
  saleCompleteTitle: 'Sale Complete',
  saleCompleteMessage: 'Sale #%d has been recorded successfully.',
  
  // Error Dialog
  errorTitle: 'Error',
  dismissButtonLabel: 'Dismiss',
  atLeastOneItemErrorMessage: 'Please add at least one item to the sale.',
  paymentIncompleteErrorMessage: 'Payment is incomplete. Remaining balance: %c',
};

/** @typedef {typeof pos} PosTranslation */

export default pos;
