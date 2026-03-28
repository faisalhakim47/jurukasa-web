const supplier = {
  // Supplier Creation Dialog
  createDialogTitle: 'Add Supplier',
  supplierNameLabel: 'Supplier Name',
  supplierNameSupportingText: 'Unique name for this supplier',
  supplierNameExistsError: 'Supplier name already exists.',
  supplierNameValidationError: 'Error validating supplier name.',
  supplierNameRequiredError: 'Supplier name is required.',
  phoneNumberLabel: 'Phone Number (Optional)',
  phoneNumberSupportingText: 'Supplier contact number',
  creatingSupplierProgressIndicatorLabel: 'Creating supplier',
  createSupplierButtonLabel: 'Add Supplier',
  cancelButtonLabel: 'Cancel',
  errorDialogTitle: 'Error',
  dismissButtonLabel: 'Dismiss',

  // Supplier Details Dialog
  detailsDialogTitle: 'Supplier Details',
  loadingSupplierDetailsAriaLabel: 'Loading supplier details',
  loadingSupplierDetailsMessage: 'Loading supplier details...',
  supplierNotFoundTitle: 'Supplier Not Found',
  supplierNotFoundMessage: 'The requested supplier could not be found.',
  editButtonLabel: 'Edit',
  saveChangesButtonLabel: 'Save Changes',
  savingChangesMessage: 'Saving changes...',
  savingChangesProgressIndicatorLabel: 'Saving changes',

  // Supplier Details - Basic Information
  basicInformationSectionTitle: 'Basic Information',
  nameFieldLabel: 'Name',
  phoneNumberFieldLabel: 'Phone Number',

  // Supplier Details - Statistics

  // Supplier Details - Linked Inventories
  linkedInventoriesSectionTitle: 'Linked Inventories',
  addMappingButtonLabel: 'Link Inventory',
  noInventoriesLinkedMessage: 'No inventories linked to this supplier yet. Link an inventory to save an optional supplier-facing label for receipts and autocomplete.',
  tableHeaderInventory: 'Inventory',
  tableHeaderSupplierName: 'Supplier Label',
  editMappingAriaLabel: 'Edit inventory link for %s',
  removeMappingAriaLabel: 'Remove inventory link for %s',
  noSupplierNamePlaceholder: '—',

  // Supplier Details - Add Inventory Mapping
  addInventoryMappingTitle: 'Link Inventory',
  cancelButtonAriaLabel: 'Cancel',
  searchInventoryLabel: 'Search Inventory',
  loadingInventoriesMessage: 'Loading...',
  noInventoriesFoundMessage: 'No inventories found.',
  availableInventoriesAriaLabel: 'Available inventories',
  inventoryUnitLabel: 'Unit: %s',
  changeInventoryAriaLabel: 'Change inventory',
  supplierNameOptionalLabel: 'Supplier Label (Optional)',
  supplierNameCatalogSupportingText: 'Name as shown on supplier receipts or catalog entries',
  addMappingSubmitButtonLabel: 'Link Inventory',

  // Supplier Details - Edit Inventory Mapping
  editInventoryMappingTitle: 'Edit Inventory Link',
  saveChangesInventoryButtonLabel: 'Save Changes',
  inventoryMappingExistsError: 'This inventory is already linked to this supplier.',

  // Supplier Details - Delete Inventory Mapping Confirmation
  removeInventoryMappingTitle: 'Remove Inventory Link',
  removeInventoryMappingMessage: 'Are you sure you want to remove the inventory link for %s?',
  removeInventoryMappingNote: 'This will not delete the inventory itself, only the saved supplier label for this link.',
  removeButtonLabel: 'Remove',

  // Supplier Selector Dialog
  selectDialogTitle: 'Select Supplier',
  searchSuppliersLabel: 'Search suppliers',
  loadingSuppliersAriaLabel: 'Loading suppliers',
  loadingSuppliersMessage: 'Loading suppliers...',
  unableToLoadSuppliersTitle: 'Unable to load suppliers',
  noSuppliersMatchSearchMessage: 'No suppliers match your search',
  noSuppliersAvailableMessage: 'No suppliers available',
  availableSuppliersAriaLabel: 'Available suppliers',

  // Suppliers View
  searchLabel: 'Search',
  refreshAriaLabel: 'Refresh suppliers',
  refreshButtonLabel: 'Refresh',
  addSupplierButtonLabel: 'Add Supplier',
  loadingSuppliersViewAriaLabel: 'Loading suppliers',
  loadingSuppliersViewMessage: 'Loading suppliers...',
  unableToLoadSuppliersViewTitle: 'Unable to load suppliers',
  retryButtonLabel: 'Retry',
  noSuppliersFoundTitle: 'No suppliers found',
  adjustSearchMessage: 'Try adjusting your search.',
  addFirstSupplierMessage: 'Start by adding your first supplier to manage purchases.',
  suppliersListAriaLabel: 'Suppliers list',
  supplierRowAriaLabel: 'Supplier %s',
  tableHeaderName: 'Name',
  tableHeaderPhone: 'Phone',
  tableHeaderInventories: 'Items',
  tableHeaderPurchases: 'Purchases',
  paginationAriaLabel: 'Pagination',
  showingItemsInfo: 'Showing %d–%d of %d',
  firstPageAriaLabel: 'First page',
  previousPageAriaLabel: 'Previous page',
  nextPageAriaLabel: 'Next page',
  lastPageAriaLabel: 'Last page',
  pageInfo: 'Page %d of %d',

  // Supplier Delete Confirmation
};

/** @typedef {typeof supplier} SupplierTranslation */

export default supplier;
