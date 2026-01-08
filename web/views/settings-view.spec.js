import { expect, test } from '@playwright/test';
import { useTursoLibSQLiteServer } from '#test/hooks/use-turso-libsqlite-server.js';
import { useConsoleOutput } from '#test/hooks/use-console-output.js';
const { describe } = test;

describe('Settings View', function () {
  // useConsoleOutput(test);

  /**
   * @param {import('@playwright/test').Page} page
   * @param {string} tursoLibSQLiteServerUrl
   */
  async function setupDatabaseAndNavigateToSettings(page, tursoLibSQLiteServerUrl) {
    await page.goto('/test/fixtures/testing.html');

    await page.getByLabel('Turso Database URL').fill(tursoLibSQLiteServerUrl);
    await page.getByRole('button', { name: 'Configure' }).click();

    await expect(page.getByRole('dialog', { name: 'Configure Business' })).toBeVisible();
    await page.getByLabel('Business Name').fill('Test Business');
    await page.getByRole('button', { name: 'Next' }).click();

    await expect(page.getByRole('dialog', { name: 'Choose Chart of Accounts Template' })).toBeVisible();
    await page.getByRole('radio', { name: 'Retail Business - Indonesia' }).click();
    await page.getByRole('button', { name: 'Finish' }).click();

    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();

    await page.getByRole('navigation', { name: 'Main Navigation' }).getByRole('link', { name: 'Settings' }).first().click();

    await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();
  }

  describe('Settings Navigation', function () {
    const tursoLibSQLiteServer = useTursoLibSQLiteServer(test);

    test('shall display Settings link in navigation', async function ({ page }) {
      await page.goto('/test/fixtures/testing.html');

      await page.getByLabel('Turso Database URL').fill(tursoLibSQLiteServer().url);
      await page.getByRole('button', { name: 'Configure' }).click();

      await expect(page.getByRole('dialog', { name: 'Configure Business' })).toBeVisible();
      await page.getByLabel('Business Name').fill('Test Business');
      await page.getByRole('button', { name: 'Next' }).click();

      await expect(page.getByRole('dialog', { name: 'Choose Chart of Accounts Template' })).toBeVisible();
      await page.getByRole('radio', { name: 'Retail Business - Indonesia' }).click();
      await page.getByRole('button', { name: 'Finish' }).click();

      await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();

      await expect(page.getByRole('navigation', { name: 'Main Navigation' }).getByRole('link', { name: 'Settings' }).first()).toBeVisible();
    });

    test('shall navigate to Settings when clicking Settings link', async function ({ page }) {
      await setupDatabaseAndNavigateToSettings(page, tursoLibSQLiteServer().url);

      await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();
    });
  });

  describe('Settings Page Display', function () {
    const tursoLibSQLiteServer = useTursoLibSQLiteServer(test);

    test('shall display page header', async function ({ page }) {
      await setupDatabaseAndNavigateToSettings(page, tursoLibSQLiteServer().url);

      await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();
      await expect(page.getByText('Configure accounting and POS settings.')).toBeVisible();
    });

    test('shall display Accounting Config tab', async function ({ page }) {
      await setupDatabaseAndNavigateToSettings(page, tursoLibSQLiteServer().url);

      await expect(page.getByRole('tab', { name: 'Accounting Config' })).toBeVisible();
    });

    test('shall display Payment Methods tab', async function ({ page }) {
      await setupDatabaseAndNavigateToSettings(page, tursoLibSQLiteServer().url);

      await expect(page.getByRole('tab', { name: 'Payment Methods' })).toBeVisible();
    });

    test('shall redirect to Accounting Config by default', async function ({ page }) {
      await setupDatabaseAndNavigateToSettings(page, tursoLibSQLiteServer().url);

      const accountingPanel = page.getByRole('tabpanel', { name: 'Accounting Config' });
      await expect(accountingPanel).toHaveAttribute('aria-hidden', 'false');
    });
  });

  describe('Accounting Configuration Tab', function () {
    const tursoLibSQLiteServer = useTursoLibSQLiteServer(test);

    test('shall display Accounting Configuration title', async function ({ page }) {
      await setupDatabaseAndNavigateToSettings(page, tursoLibSQLiteServer().url);

      await expect(page.getByRole('heading', { name: 'Accounting Configuration' })).toBeVisible();
    });

    test('shall display configuration form', async function ({ page }) {
      await setupDatabaseAndNavigateToSettings(page, tursoLibSQLiteServer().url);

      const accountingPanel = page.getByRole('tabpanel', { name: 'Accounting Config' });

      await expect(accountingPanel.getByLabel('Business Name')).toBeVisible();
      await expect(accountingPanel.getByLabel('Currency Code')).toBeVisible();
      await expect(accountingPanel.getByLabel('Currency Decimals')).toBeVisible();
      await expect(accountingPanel.getByLabel('Locale')).toBeVisible();
    });

    test('shall display Business Name with populated value', async function ({ page }) {
      await setupDatabaseAndNavigateToSettings(page, tursoLibSQLiteServer().url);

      const businessNameInput = page.getByLabel('Business Name');
      await expect(businessNameInput).toHaveValue('Test Business');
    });

    test('shall display Currency Code with populated value', async function ({ page }) {
      await setupDatabaseAndNavigateToSettings(page, tursoLibSQLiteServer().url);

      const currencyCodeInput = page.getByLabel('Currency Code');
      await expect(currencyCodeInput).toHaveValue('IDR');
    });

    test('shall display Currency Decimals with populated value', async function ({ page }) {
      await setupDatabaseAndNavigateToSettings(page, tursoLibSQLiteServer().url);

      const currencyDecimalsInput = page.getByLabel('Currency Decimals');
      await expect(currencyDecimalsInput).toHaveValue('0');
    });

    test('shall display Locale with populated value', async function ({ page }) {
      await setupDatabaseAndNavigateToSettings(page, tursoLibSQLiteServer().url);

      const localeInput = page.getByLabel('Locale');
      await expect(localeInput).toHaveValue('en-ID');
    });

    test('shall display Save Changes button', async function ({ page }) {
      await setupDatabaseAndNavigateToSettings(page, tursoLibSQLiteServer().url);

      await expect(page.getByRole('button', { name: 'Save Changes' })).toBeVisible();
    });

    test('shall display Reset button', async function ({ page }) {
      await setupDatabaseAndNavigateToSettings(page, tursoLibSQLiteServer().url);

      const accountingPanel = page.getByRole('tabpanel', { name: 'Accounting Config' });
      await expect(accountingPanel.getByRole('button', { name: 'Reset' })).toBeVisible();
    });

    test('shall display Refresh button', async function ({ page }) {
      await setupDatabaseAndNavigateToSettings(page, tursoLibSQLiteServer().url);

      const accountingPanel = page.getByRole('tabpanel', { name: 'Accounting Config' });
      await expect(accountingPanel.getByRole('button', { name: 'Refresh' })).toBeVisible();
    });
  });

  describe('Accounting Configuration Form Submission', function () {
    const tursoLibSQLiteServer = useTursoLibSQLiteServer(test);

    test('shall update Business Name successfully', async function ({ page }) {
      await setupDatabaseAndNavigateToSettings(page, tursoLibSQLiteServer().url);

      const businessNameInput = page.getByLabel('Business Name');
      await businessNameInput.clear();
      await businessNameInput.fill('Updated Business Name');

      await page.getByRole('button', { name: 'Save Changes' }).click();

      await expect(page.getByRole('dialog', { name: 'Settings Saved' })).toBeVisible();
    });

    test('shall persist Business Name change after save', async function ({ page }) {
      await setupDatabaseAndNavigateToSettings(page, tursoLibSQLiteServer().url);

      const businessNameInput = page.getByLabel('Business Name');
      await businessNameInput.clear();
      await businessNameInput.fill('Updated Business Name');

      await page.getByRole('button', { name: 'Save Changes' }).click();

      await expect(page.getByRole('dialog', { name: 'Settings Saved' })).toBeVisible();

      const accountingPanel = page.getByRole('tabpanel', { name: 'Accounting Config' });
      await accountingPanel.getByRole('button', { name: 'Refresh' }).click();

      await expect(page.getByLabel('Business Name')).toHaveValue('Updated Business Name');
    });

    test('shall update Locale successfully', async function ({ page }) {
      await setupDatabaseAndNavigateToSettings(page, tursoLibSQLiteServer().url);

      const localeInput = page.getByLabel('Locale');
      await localeInput.clear();
      await localeInput.fill('en-US');

      await page.getByRole('button', { name: 'Save Changes' }).click();

      await expect(page.getByRole('dialog', { name: 'Settings Saved' })).toBeVisible();
    });

    test('shall reset form when clicking Reset button', async function ({ page }) {
      await setupDatabaseAndNavigateToSettings(page, tursoLibSQLiteServer().url);

      const businessNameInput = page.getByLabel('Business Name');
      await businessNameInput.clear();
      await businessNameInput.fill('Temporary Name');

      const accountingPanel = page.getByRole('tabpanel', { name: 'Accounting Config' });
      await accountingPanel.getByRole('button', { name: 'Reset' }).click();

      await expect(page.getByLabel('Business Name')).toHaveValue('Test Business');
    });
  });

  describe('Payment Methods Tab', function () {
    const tursoLibSQLiteServer = useTursoLibSQLiteServer(test);

    test('shall switch to Payment Methods tab when clicked', async function ({ page }) {
      await setupDatabaseAndNavigateToSettings(page, tursoLibSQLiteServer().url);

      await page.getByRole('tab', { name: 'Payment Methods' }).click();

      const paymentsPanel = page.getByRole('tabpanel', { name: 'Payment Methods' });
      await expect(paymentsPanel).toHaveAttribute('aria-hidden', 'false');
    });

    test('shall display Payment Methods title', async function ({ page }) {
      await setupDatabaseAndNavigateToSettings(page, tursoLibSQLiteServer().url);

      await page.getByRole('tab', { name: 'Payment Methods' }).click();

      await expect(page.getByRole('heading', { name: 'Payment Methods', exact: true })).toBeVisible();
    });

    test('shall display empty state when no payment methods exist', async function ({ page }) {
      await setupDatabaseAndNavigateToSettings(page, tursoLibSQLiteServer().url);

      await page.getByRole('tab', { name: 'Payment Methods' }).click();

      await expect(page.getByRole('heading', { name: 'No payment methods configured' })).toBeVisible();
      await expect(page.getByText('Add payment methods to enable different payment options in the POS system.')).toBeVisible();
    });

    test('shall display Add Payment Method button in empty state', async function ({ page }) {
      await setupDatabaseAndNavigateToSettings(page, tursoLibSQLiteServer().url);

      await page.getByRole('tab', { name: 'Payment Methods' }).click();

      const paymentsPanel = page.getByRole('tabpanel', { name: 'Payment Methods' });
      await expect(paymentsPanel.getByRole('button', { name: 'Add Payment Method' }).first()).toBeVisible();
    });

    test('shall display Refresh button', async function ({ page }) {
      await setupDatabaseAndNavigateToSettings(page, tursoLibSQLiteServer().url);

      await page.getByRole('tab', { name: 'Payment Methods' }).click();

      const paymentsPanel = page.getByRole('tabpanel', { name: 'Payment Methods' });
      await expect(paymentsPanel.getByRole('button', { name: 'Refresh' })).toBeVisible();
    });
  });

  describe('Payment Method Creation', function () {
    const tursoLibSQLiteServer = useTursoLibSQLiteServer(test);

    test('shall open payment method creation dialog', async function ({ page }) {
      await setupDatabaseAndNavigateToSettings(page, tursoLibSQLiteServer().url);

      await page.getByRole('tab', { name: 'Payment Methods' }).click();

      const paymentsPanel = page.getByRole('tabpanel', { name: 'Payment Methods' });
      await paymentsPanel.getByRole('button', { name: 'Add Payment Method' }).first().click();

      await expect(page.getByRole('dialog', { name: 'Create Payment Method' })).toBeVisible();
    });

    test('shall display payment method creation form fields', async function ({ page }) {
      await setupDatabaseAndNavigateToSettings(page, tursoLibSQLiteServer().url);

      await page.getByRole('tab', { name: 'Payment Methods' }).click();

      const paymentsPanel = page.getByRole('tabpanel', { name: 'Payment Methods' });
      await paymentsPanel.getByRole('button', { name: 'Add Payment Method' }).first().click();

      const dialog = page.getByRole('dialog', { name: 'Create Payment Method' });
      await expect(dialog.getByLabel('Payment Method Name')).toBeVisible();
      await expect(dialog.getByRole('button', { name: 'Select Account' })).toBeVisible();
      await expect(dialog.getByRole('button', { name: 'Create' })).toBeVisible();
    });

    test('shall create payment method successfully', async function ({ page }) {
      await setupDatabaseAndNavigateToSettings(page, tursoLibSQLiteServer().url);

      await page.getByRole('tab', { name: 'Payment Methods' }).click();

      const paymentsPanel = page.getByRole('tabpanel', { name: 'Payment Methods' });
      await paymentsPanel.getByRole('button', { name: 'Add Payment Method' }).first().click();

      const dialog = page.getByRole('dialog', { name: 'Create Payment Method' });
      await dialog.getByLabel('Payment Method Name').fill('Cash');

      await dialog.getByRole('button', { name: 'Select Account' }).click();
      const accountSelectorDialog = page.getByRole('dialog', { name: 'Select Account' });
      await expect(accountSelectorDialog).toBeVisible();

      await accountSelectorDialog.getByRole('menuitemradio', { name: 'Kas 11110' }).click();

      await expect(dialog.getByText('11110 - Kas')).toBeVisible();

      await dialog.getByRole('button', { name: 'Create' }).click();

      await expect(dialog).not.toBeVisible();

      await expect(page.getByRole('table', { name: 'Payment methods list' })).toBeVisible();
    });

    test('shall display payment method in list after creation', async function ({ page }) {
      await setupDatabaseAndNavigateToSettings(page, tursoLibSQLiteServer().url);

      await page.getByRole('tab', { name: 'Payment Methods' }).click();

      const paymentsPanel = page.getByRole('tabpanel', { name: 'Payment Methods' });
      await paymentsPanel.getByRole('button', { name: 'Add Payment Method' }).first().click();

      const dialog = page.getByRole('dialog', { name: 'Create Payment Method' });
      await dialog.getByLabel('Payment Method Name').fill('Cash');
      await dialog.getByRole('button', { name: 'Select Account' }).click();
      
      const accountSelectorDialog = page.getByRole('dialog', { name: 'Select Account' });
      await accountSelectorDialog.getByRole('menuitemradio', { name: 'Kas 11110' }).click();

      await dialog.getByRole('button', { name: 'Create' }).click();

      await expect(dialog).not.toBeVisible();

      const table = page.getByRole('table', { name: 'Payment methods list' });
      await expect(table.getByRole('columnheader', { name: 'Name' })).toBeVisible();
      await expect(table.getByRole('columnheader', { name: 'Account' })).toBeVisible();
      await expect(table.getByRole('columnheader', { name: 'Fee' })).toBeVisible();
      await expect(table.getByText('Cash')).toBeVisible();
    });
  });

  describe('Payment Method Details', function () {
    const tursoLibSQLiteServer = useTursoLibSQLiteServer(test);

    async function createPaymentMethod(page, name) {
      await page.getByRole('tab', { name: 'Payment Methods' }).click();

      const paymentsPanel = page.getByRole('tabpanel', { name: 'Payment Methods' });
      await paymentsPanel.getByRole('button', { name: 'Add Payment Method' }).first().click();

      const dialog = page.getByRole('dialog', { name: 'Create Payment Method' });
      await dialog.getByLabel('Payment Method Name').fill(name);
      await dialog.getByRole('button', { name: 'Select Account' }).click();
      
      const accountSelectorDialog = page.getByRole('dialog', { name: 'Select Account' });
      await accountSelectorDialog.getByRole('menuitemradio', { name: 'Kas 11110' }).click();

      await dialog.getByRole('button', { name: 'Create' }).click();

      await expect(dialog).not.toBeVisible();
    }

    // TODO: Refactor the settings view before re-enabling these tests

    // test('shall display payment method details', async function ({ page }) {
    //   await setupDatabaseAndNavigateToSettings(page, tursoLibSQLiteServer().url);

    //   await createPaymentMethod(page, 'Cash');

    //   await page.getByRole('button', { name: 'Payment method Cash' }).click();

    //   const detailsDialog = page.getByRole('dialog', { name: 'Payment Method Details' });
    //   await expect(detailsDialog.getByText('Cash')).toBeVisible();
    //   await expect(detailsDialog.getByText('1101 Cash')).toBeVisible();
    // });

    // test('shall display Update button in details dialog', async function ({ page }) {
    //   await setupDatabaseAndNavigateToSettings(page, tursoLibSQLiteServer().url);

    //   await createPaymentMethod(page, 'Cash');

    //   await page.getByRole('button', { name: 'Payment method Cash' }).click();

    //   const detailsDialog = page.getByRole('dialog', { name: 'Payment Method Details' });
    //   await expect(detailsDialog.getByRole('button', { name: 'Update' })).toBeVisible();
    // });

    // test('shall display Delete button in details dialog', async function ({ page }) {
    //   await setupDatabaseAndNavigateToSettings(page, tursoLibSQLiteServer().url);

    //   await createPaymentMethod(page, 'Cash');

    //   await page.getByRole('button', { name: 'Payment method Cash' }).click();

    //   const detailsDialog = page.getByRole('dialog', { name: 'Payment Method Details' });
    //   await expect(detailsDialog.getByRole('button', { name: 'Delete' })).toBeVisible();
    // });
  });

  describe('Settings Tab Navigation', function () {
    const tursoLibSQLiteServer = useTursoLibSQLiteServer(test);

    test('shall maintain tab state when switching between tabs', async function ({ page }) {
      await setupDatabaseAndNavigateToSettings(page, tursoLibSQLiteServer().url);

      await expect(page.getByRole('tabpanel', { name: 'Accounting Config' })).toBeVisible();

      await page.getByRole('tab', { name: 'Payment Methods' }).click();

      await expect(page.getByRole('tabpanel', { name: 'Payment Methods' })).toBeVisible();
      await expect(page.getByRole('tabpanel', { name: 'Accounting Config' })).not.toBeVisible();

      await page.getByRole('tab', { name: 'Accounting Config' }).click();

      await expect(page.getByRole('tabpanel', { name: 'Accounting Config' })).toBeVisible();
      await expect(page.getByRole('tabpanel', { name: 'Payment Methods' })).not.toBeVisible();
    });
  });
});
