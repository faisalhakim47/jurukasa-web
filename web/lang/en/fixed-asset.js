const fixedAsset = {
  // Creation Dialog
  creationTitle: 'Add Fixed Asset',
  addAssetActionLabel: 'Add Asset',
  closeActionLabel: 'Close',
  creatingAssetLabel: 'Creating fixed asset...',
  creatingAssetProgressIndicatorLabel: 'Creating fixed asset',

  // Basic Information Section
  basicInfoSectionTitle: 'Basic Information',
  assetNameLabel: 'Asset Name',
  assetNameSupportingText: 'A descriptive name for this fixed asset',
  descriptionLabel: 'Description (Optional)',
  descriptionSupportingText: 'Additional details about the asset',

  // Financial Information Section
  financialInfoSectionTitle: 'Financial Information',
  acquisitionDateLabel: 'Acquisition Date',
  acquisitionDateSupportingText: 'Date when the asset was acquired',
  acquisitionCostLabel: 'Acquisition Cost',
  acquisitionCostSupportingText: 'Total cost of acquiring the asset (in lowest denomination)',
  usefulLifeLabel: 'Useful Life (Years)',
  usefulLifeSupportingText: 'Expected useful life of the asset in years',
  salvageValueLabel: 'Salvage Value',
  salvageValueSupportingText: 'Estimated value at end of useful life (default: 0)',

  // Account Assignment Section
  accountAssignmentSectionTitle: 'Account Assignment',
  fixedAssetAccountLabel: 'Fixed Asset Account',
  fixedAssetAccountSupportingText: 'Asset account (e.g., Equipment, Vehicles)',
  accumulatedDepreciationAccountLabel: 'Accumulated Depreciation Account',
  accumulatedDepreciationAccountSupportingText: 'Contra asset account for accumulated depreciation',
  depreciationExpenseAccountLabel: 'Depreciation Expense Account',
  depreciationExpenseAccountSupportingText: 'Expense account for recording depreciation',
  paymentAccountLabel: 'Payment Account',
  paymentAccountSupportingText: 'Cash or bank account used for payment',
  clearAccountLabel: 'Clear account selection',
  openAccountSelectorLabel: 'Open account selector',

  // Details Dialog
  detailsTitle: 'Fixed Asset Details',
  editActionLabel: 'Edit',
  saveChangesActionLabel: 'Save Changes',
  cancelActionLabel: 'Cancel',
  savingChangesLabel: 'Saving changes...',
  savingChangesProgressIndicatorLabel: 'Saving changes',
  loadingDetailsLabel: 'Loading asset details...',
  assetNotFoundTitle: 'Fixed Asset Not Found',
  assetNotFoundMessage: 'The requested fixed asset could not be found.',

  // View Mode - Basic Information
  nameLabel: 'Name',
  statusLabel: 'Status',
  statusActive: 'Active',
  statusFullyDepreciated: 'Fully Depreciated',
  descriptionInfoLabel: 'Description',

  // View Mode - Financial Information
  acquisitionDateInfoLabel: 'Acquisition Date',
  acquisitionCostInfoLabel: 'Acquisition Cost',
  usefulLifeInfoLabel: 'Useful Life',
  usefulLifeYearsFormat: '%d years',
  salvageValueInfoLabel: 'Salvage Value',
  annualDepreciationLabel: 'Annual Depreciation',
  depreciableAmountLabel: 'Depreciable Amount',

  // View Mode - Depreciation Progress
  depreciationProgressSectionTitle: 'Depreciation Progress',
  accumulatedDepreciationLabel: 'Accumulated Depreciation',
  bookValueLabel: 'Book Value',

  // View Mode - Account Assignment
  assetAccountLabel: 'Asset Account',
  accumulatedDepreciationAccountInfoLabel: 'Accumulated Depreciation Account',
  depreciationExpenseAccountInfoLabel: 'Depreciation Expense Account',
  paymentAccountInfoLabel: 'Payment Account',

  // View Mode - Depreciation History
  depreciationHistorySectionTitle: 'Depreciation History',
  dateColumnInfo: 'Date',
  noteColumnInfo: 'Note',
  amountColumnInfo: 'Amount',
  noNoteLabel: '—',

  // Danger Zone
  dangerZoneSectionTitle: 'Danger Zone',
  dangerZoneWarning: 'Deleting this asset will also remove its acquisition journal entry.',
  deleteAssetActionLabel: 'Delete Asset',

  // Edit Mode
  editInfoMessage: 'Financial details cannot be modified because this asset has accumulated depreciation.',

  // Delete Confirmation
  confirmDeleteTitle: 'Delete Fixed Asset?',
  confirmDeleteMessage: 'Are you sure you want to delete "%s"? This action cannot be undone.',
  deleteConfirmActionLabel: 'Delete',
  deletingLabel: 'Deleting...',

  // Error Dialog
  errorDialogTitle: 'Error',
  dismissLabel: 'Dismiss',

  // Validation Errors
  assetNameRequired: 'Asset name is required.',
  acquisitionDateRequired: 'Acquisition date is required.',
  acquisitionCostPositive: 'Acquisition cost must be positive.',
  usefulLifePositive: 'Useful life must be positive.',
  salvageValueNegative: 'Salvage value cannot be negative.',
  salvageValueTooHigh: 'Salvage value must be less than acquisition cost.',
  assetAccountRequired: 'Please select a fixed asset account.',
  accumulatedDepreciationAccountRequired: 'Please select an accumulated depreciation account.',
  depreciationExpenseAccountRequired: 'Please select a depreciation expense account.',
  paymentAccountRequired: 'Please select a payment account.',
  accountsMustBeDifferent: 'Asset, accumulated depreciation, and expense accounts must be different.',
  invalidAcquisitionDate: 'Invalid acquisition date.',
  cannotDeleteWithDepreciation: 'Cannot delete fixed asset with accumulated depreciation.',

  // View
  searchLabel: 'Search',
  statusFilterLabel: 'Status',
  filterAll: 'All',
  filterActive: 'Active',
  filterFullyDepreciated: 'Fully Depreciated',
  refreshActionLabel: 'Refresh',
  addFixedAssetActionLabel: 'Add Fixed Asset',

  // Loading & Empty States
  loadingAssetsLabel: 'Loading fixed assets...',
  loadErrorTitle: 'Unable to load fixed assets',
  retryActionLabel: 'Retry',
  emptyStateTitle: 'No fixed assets found',
  emptyStateMessageFiltered: 'Try adjusting your search or filters.',
  emptyStateMessage: 'Start by recording your first fixed asset to track depreciation.',

  // Table Columns
  nameColumnInfo: 'Name',
  acquisitionDateColumnInfo: 'Acquisition Date',
  acquisitionCostColumnInfo: 'Acquisition Cost',
  usefulLifeColumnInfo: 'Useful Life',
  accumulatedDepreciationColumnInfo: 'Accum. Depr.',
  bookValueColumnInfo: 'Book Value',
  statusColumnInfo: 'Status',
  progressColumnInfo: 'Progress',

  // Pagination
  paginationShowing: 'Showing %d–%d of %d',
  paginationPage: 'Page %d of %d',
  paginationFirst: 'First page',
  paginationPrevious: 'Previous page',
  paginationNext: 'Next page',
  paginationLast: 'Last page',
};

/** @typedef {typeof fixedAsset} FixedAssetTranslation */

export default fixedAsset;
