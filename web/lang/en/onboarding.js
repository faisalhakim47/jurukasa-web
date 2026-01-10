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
  databaseConfigDescription: 'Configure your Turso database connection by providing the database URL and authentication key.',
  databaseConfigSubmitLabel: 'Connect',
  databaseConnectingLabel: 'Connecting...',
  databaseConnectedLabel: 'Connected',
  databaseFailedLabel: 'Failed',
  tursoDatabaseUrlLabel: 'Turso Database URL',
  tursoDatabaseUrlPlaceholder: 'Turso Database URL',
  tursoDatabaseUrlDescription: 'The URL of your Turso database instance, typically starting with "https://".',
  tursoDatabaseKeyLabel: 'Turso Database Auth Key',
  tursoDatabaseKeyPlaceholder: 'Turso Database Auth Key',
  tursoDatabaseKeyDescription: 'The authentication token required to access your Turso database.',

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
