const onboarding = {
  loadingIndicatorLabel: 'Loading...',
  loadingTemplatesIndicatorLabel: 'Loading templates...',

  // Welcome screen
  welcomeTitle: 'Welcome to JuruKasa',
  welcomeMessage: 'JuruKasa is a modern point-of-sale application designed for Indonesian businesses with built-in accounting features.',
  featuresTitle: 'Key Features',
  featurePOS: 'Point of Sale - Process sales quickly and efficiently',
  featureInventory: 'Inventory Management - Track stock levels and movements',
  featureAccounting: 'Accounting - Follow Indonesian accounting standards',
  featureReports: 'Financial Reports - Generate comprehensive business reports',
  getStartedButton: 'Get Started',
  selectLanguageLabel: 'Select Your Language',
  languageLabel: 'Language',

  // Database setup
  databaseConfigTitle: 'Configure Database',
  databaseConfigDescription: 'Choose where to store your business data. Select a database provider that best fits your needs.',
  databaseConfigSubmitLabel: 'Connect',
  databaseConnectingLabel: 'Connecting...',
  databaseConnectedLabel: 'Connected',
  databaseFailedLabel: 'Failed',
  databaseProviderLabel: 'Database Provider',

  // Local SQLite provider
  localDatabaseLabel: 'Local Database',
  localDatabaseDescription: 'Store data in browser storage. Recommended for single-device use.',

  // Turso provider
  tursoDatabaseLabel: 'Turso SQLite',
  tursoDatabaseDescription: 'Store data on Turso cloud database. Accessible from multiple devices.',
  tursoUrlLabel: 'Database URL',
  tursoUrlPlaceholder: 'https://your-database.turso.io',
  tursoUrlDescription: 'The URL of your Turso database instance.',
  tursoAuthTokenLabel: 'Auth Token',
  tursoAuthTokenPlaceholder: 'Your Turso auth token',
  tursoAuthTokenDescription: 'The authentication token for your Turso database.',

  // Business configuration
  businessConfigTitle: 'Configure Business',
  businessConfigSubmitLabel: 'Next',
  businessNameLabel: 'Business Name',
  businessTypeLabel: 'Business Type',
  businessCurrencyCodeLabel: 'Currency Code',
  businessCurrencyDecimalsLabel: 'Currency Decimals',
  businessLocaleLabel: 'Locale',
  businessLanguageLabel: 'Language',
  businessFiscalYearStartMonthLabel: 'Fiscal Year Start Month',

  // Chart of accounts setup
  chartOfAccountsSetupTitle: 'Choose Chart of Accounts Template',
  chartOfAccountsSetupSubmitLabel: 'Finish',

  unknownState: 'Unknown state: {0}',
};

/** @typedef {typeof onboarding} OnboardingTranslation */

export default onboarding;
