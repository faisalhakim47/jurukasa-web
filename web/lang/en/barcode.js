const barcode = {
  // Barcode Assignment Dialog
  assignDialogTitle: 'Assign Barcode',
  barcodeLabel: 'Barcode',
  inventoryLabel: 'Inventory',
  clearInventoryAriaLabel: 'Clear inventory',
  selectInventoryAriaLabel: 'Select inventory',
  cancelButtonLabel: 'Cancel',
  assignButtonLabel: 'Assign',
  barcodeAlreadyAssignedToThisError: 'This barcode is already assigned to this inventory.',
  barcodeAlreadyAssignedToAnotherError: 'This barcode is already assigned to another inventory.',
  assigningBarcodeMessage: 'Assigning barcode...',
  errorDialogTitle: 'Error',
  errorOccurredMessage: 'An error occurred: %s',
  dismissButtonLabel: 'Dismiss',

  // Barcodes View
  barcodesViewTitle: 'Barcodes',
  searchLabel: 'Search',
  clearSearchAriaLabel: 'Clear search',
  assignBarcodeButtonLabel: 'Assign Barcode',
  loadingBarcodesMessage: 'Loading barcodes...',
  loadingBarcodesAriaLabel: 'Loading barcodes',
  noBarcodeMatchSearchMessage: 'No barcodes match your search',
  noBarcodesAssignedMessage: 'No barcodes assigned yet',
  tableHeaderBarcode: 'Barcode',
  tableHeaderProductName: 'Product Name',
  tableHeaderAction: 'Action',
  unassignBarcodeAriaLabel: 'Unassign barcode %s',
  paginationInfo: '%d-%d of %d',
  paginationNoResults: 'No results',
  previousPageAriaLabel: 'Previous page',
  nextPageAriaLabel: 'Next page',
  confirmUnassignDialogTitle: 'Unassign Barcode',
  confirmUnassignMessage: 'Are you sure you want to unassign barcode <strong>%s</strong> from <strong>%s</strong>?',
  unassignButtonLabel: 'Unassign',
  unassigningBarcodeMessage: 'Unassigning barcode...',

  // Inventory Details Dialog - Barcode Section
  barcodesSection: 'Barcodes',
  noBarcodesAssignedText: 'No barcodes assigned.',
  addBarcodeLabel: 'Add Barcode',
  addButtonLabel: 'Add',
  removeBarcodeAriaLabel: 'Remove barcode %s',
};

/** @typedef {typeof barcode} BarcodeTranslation */

export default barcode;
