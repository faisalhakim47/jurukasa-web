const settings = {
  // Page Header
  settingsTitle: 'Settings',
  settingsDescription: 'Configure accounting and POS settings.',
  settingsSectionsAriaLabel: 'Settings sections',

  // Tab Labels
  accountingConfigTabLabel: 'Accounting Config',
  paymentMethodsTabLabel: 'Payment Methods',

  // Loading State
  loadingAriaLabel: 'Loading',
  loadingMessage: 'Loading...',

  // Error State
  unableToLoadDataTitle: 'Unable to load data',
  retryButtonLabel: 'Retry',

  // Config Form
  savingConfigurationMessage: 'Saving configuration...',
  selectPlaceholder: 'Select...',
  resetButtonLabel: 'Reset',
  saveChangesButtonLabel: 'Save Changes',

  // Payment Methods Empty State
  noPaymentMethodsTitle: 'No payment methods configured',
  noPaymentMethodsMessage: 'Add payment methods to enable different payment options in the POS system. Each payment method is linked to an account for proper accounting.',
  addPaymentMethodButtonLabel: 'Add Payment Method',

  // Payment Methods Table
  nameColumnHeader: 'Name',
  accountColumnHeader: 'Account',
  feeColumnHeader: 'Fee',
  noFeeLabel: 'No fee',

  // Section Headers
  accountingConfigurationTitle: 'Accounting Configuration',
  refreshConfigurationAriaLabel: 'Refresh configuration',
  refreshButtonLabel: 'Refresh',
  paymentMethodsTitle: 'Payment Methods',
  refreshPaymentMethodsAriaLabel: 'Refresh payment methods',

  // Not Found Dialog
  pageNotFoundTitle: 'Page Not Found',
  pageNotFoundMessage: 'The settings page you are looking for does not exist.',
  goToAccountingConfigButtonLabel: 'Go to Accounting Config',

  // Success Dialog
  settingsSavedTitle: 'Settings Saved',
  settingsSavedMessage: 'Configuration has been updated successfully.',

  // Error Dialog
  errorOccurredTitle: 'Error Occurred',
  dismissButtonLabel: 'Dismiss',

  // Database Management Tab
  databaseTabLabel: 'Database',
  databaseManagementTitle: 'Database Management',
  refreshDatabasesAriaLabel: 'Refresh database list',
  newDatabaseButtonLabel: 'New Database',

  // Database List Table
  providerColumnHeader: 'Provider',
  databaseNameColumnHeader: 'Name',
  actionsColumnHeader: 'Actions',

  // Provider Labels
  localProviderLabel: 'Local',
  tursoProviderLabel: 'Turso',

  // Database Actions
  databaseInfoButtonLabel: 'Info',
  databaseUseButtonLabel: 'Use',
  databaseExportButtonLabel: 'Export',

  // Database Empty State
  noDatabasesTitle: 'No databases configured',
  noDatabasesMessage: 'Add a database to store your business data. You can use a local browser database or connect to a cloud database.',

  // Database Info Dialog
  databaseInfoDialogTitle: 'Database Information',
  databaseInfoProviderLabel: 'Provider',
  databaseInfoNameLabel: 'Name',
  databaseInfoUrlLabel: 'URL',
  databaseInfoStatusLabel: 'Status',
  databaseInfoActiveStatus: 'Active',
  databaseInfoInactiveStatus: 'Inactive',
  databaseInfoCloseButtonLabel: 'Close',

  // Database Switch Confirmation
  switchDatabaseDialogTitle: 'Switch Database',
  switchDatabaseMessage: 'Are you sure you want to switch to this database? The application will reload.',
  switchDatabaseConfirmButtonLabel: 'Switch',
  switchDatabaseCancelButtonLabel: 'Cancel',

  // Database Export
  exportingDatabaseMessage: 'Exporting database...',
  exportDatabaseSuccessMessage: 'Database exported successfully.',
  exportDatabaseErrorMessage: 'Failed to export database.',

  // Database Setup Navigation
  databaseSetupTitle: 'Database Setup',
  databaseSetupBackButtonLabel: 'Cancel',
  databaseSetupDescription: 'Configure a new database for your business data.',
};

/** @typedef {typeof settings} SettingsTranslation */

export default settings;
