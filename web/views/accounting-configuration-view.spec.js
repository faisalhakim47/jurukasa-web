import { expect, test } from '@playwright/test';
import { useTursoLibSQLiteServer } from '#test/hooks/use-turso-libsqlite-server.js';
const { describe } = test;

describe('Accounting Configuration View', function () {
  /**
   * @param {import('@playwright/test').Page} page
   * @param {string} tursoLibSQLiteServerUrl
   */
  async function setupDatabaseAndNavigateToAccountingConfig(page, tursoLibSQLiteServerUrl) {
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

    // Navigate to Settings then Accounting Config
    await page.getByRole('navigation', { name: 'Main Navigation' }).getByRole('link', { name: 'Settings' }).first().click();
    await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();
  }

  describe('Page Display', function () {
    const tursoLibSQLiteServer = useTursoLibSQLiteServer(test);

    test('shall display page title', async function ({ page }) {
      await setupDatabaseAndNavigateToAccountingConfig(page, tursoLibSQLiteServer().url);

      await expect(page.getByRole('heading', { name: 'Accounting Configuration' })).toBeVisible();
    });

    test('shall display refresh button', async function ({ page }) {
      await setupDatabaseAndNavigateToAccountingConfig(page, tursoLibSQLiteServer().url);

      await expect(page.getByRole('button', { name: 'Refresh' }).first()).toBeVisible();
    });
  });

  describe('Configuration Form', function () {
    const tursoLibSQLiteServer = useTursoLibSQLiteServer(test);

    test('shall display Business Name field with initial value', async function ({ page }) {
      await setupDatabaseAndNavigateToAccountingConfig(page, tursoLibSQLiteServer().url);

      const businessNameInput = page.getByLabel('Business Name');
      await expect(businessNameInput).toBeVisible();
      await expect(businessNameInput).toHaveValue('Test Business');
    });

    test('shall display Currency Code field with initial value', async function ({ page }) {
      await setupDatabaseAndNavigateToAccountingConfig(page, tursoLibSQLiteServer().url);

      const currencyCodeInput = page.getByLabel('Currency Code');
      await expect(currencyCodeInput).toBeVisible();
      await expect(currencyCodeInput).toHaveValue('IDR');
    });

    test('shall display Currency Decimals field with initial value', async function ({ page }) {
      await setupDatabaseAndNavigateToAccountingConfig(page, tursoLibSQLiteServer().url);

      const currencyDecimalsInput = page.getByLabel('Currency Decimals');
      await expect(currencyDecimalsInput).toBeVisible();
      await expect(currencyDecimalsInput).toHaveValue('0');
    });

    test('shall display Locale field with initial value', async function ({ page }) {
      await setupDatabaseAndNavigateToAccountingConfig(page, tursoLibSQLiteServer().url);

      const localeInput = page.getByLabel('Locale');
      await expect(localeInput).toBeVisible();
      await expect(localeInput).toHaveValue('en-ID');
    });

    test('shall display Save Changes button', async function ({ page }) {
      await setupDatabaseAndNavigateToAccountingConfig(page, tursoLibSQLiteServer().url);

      await expect(page.getByRole('button', { name: 'Save Changes' })).toBeVisible();
    });

    test('shall display Reset button', async function ({ page }) {
      await setupDatabaseAndNavigateToAccountingConfig(page, tursoLibSQLiteServer().url);

      await expect(page.getByRole('button', { name: 'Reset' })).toBeVisible();
    });
  });

  describe('Form Interactions', function () {
    const tursoLibSQLiteServer = useTursoLibSQLiteServer(test);

    test('shall allow editing Business Name field', async function ({ page }) {
      await setupDatabaseAndNavigateToAccountingConfig(page, tursoLibSQLiteServer().url);

      const businessNameInput = page.getByLabel('Business Name');
      await businessNameInput.clear();
      await businessNameInput.fill('Updated Business Name');

      await expect(businessNameInput).toHaveValue('Updated Business Name');
    });

    test('shall allow editing Currency Code field', async function ({ page }) {
      await setupDatabaseAndNavigateToAccountingConfig(page, tursoLibSQLiteServer().url);

      const currencyCodeInput = page.getByLabel('Currency Code');
      await currencyCodeInput.clear();
      await currencyCodeInput.fill('USD');

      await expect(currencyCodeInput).toHaveValue('USD');
    });

    test('shall allow editing Locale field', async function ({ page }) {
      await setupDatabaseAndNavigateToAccountingConfig(page, tursoLibSQLiteServer().url);

      const localeInput = page.getByLabel('Locale');
      await localeInput.clear();
      await localeInput.fill('en-US');

      await expect(localeInput).toHaveValue('en-US');
    });

    test('shall reset form when clicking Reset button', async function ({ page }) {
      await setupDatabaseAndNavigateToAccountingConfig(page, tursoLibSQLiteServer().url);

      const businessNameInput = page.getByLabel('Business Name');
      await businessNameInput.clear();
      await businessNameInput.fill('Temporary Name');

      await page.getByRole('button', { name: 'Reset' }).click();

      await expect(page.getByLabel('Business Name')).toHaveValue('Test Business');
    });
  });

  describe('Form Submission', function () {
    const tursoLibSQLiteServer = useTursoLibSQLiteServer(test);

    test('shall save configuration changes successfully', async function ({ page }) {
      await setupDatabaseAndNavigateToAccountingConfig(page, tursoLibSQLiteServer().url);

      const businessNameInput = page.getByLabel('Business Name');
      await businessNameInput.clear();
      await businessNameInput.fill('My New Business');

      await page.getByRole('button', { name: 'Save Changes' }).click();

      await expect(page.getByRole('dialog', { name: 'Settings Saved' })).toBeVisible();
    });

    test('shall persist changes after save and refresh', async function ({ page }) {
      await setupDatabaseAndNavigateToAccountingConfig(page, tursoLibSQLiteServer().url);

      const businessNameInput = page.getByLabel('Business Name');
      await businessNameInput.clear();
      await businessNameInput.fill('Persistent Business Name');

      await page.getByRole('button', { name: 'Save Changes' }).click();

      await expect(page.getByRole('dialog', { name: 'Settings Saved' })).toBeVisible();

      // Wait for dialog to close
      await expect(page.getByRole('dialog', { name: 'Settings Saved' })).not.toBeVisible();

      // Refresh the data
      await page.getByRole('button', { name: 'Refresh' }).first().click();

      await expect(page.getByLabel('Business Name')).toHaveValue('Persistent Business Name');
    });

    test('shall update multiple fields at once', async function ({ page }) {
      await setupDatabaseAndNavigateToAccountingConfig(page, tursoLibSQLiteServer().url);

      await page.getByLabel('Business Name').clear();
      await page.getByLabel('Business Name').fill('Multi Field Test');

      await page.getByLabel('Locale').clear();
      await page.getByLabel('Locale').fill('id-ID');

      await page.getByRole('button', { name: 'Save Changes' }).click();

      await expect(page.getByRole('dialog', { name: 'Settings Saved' })).toBeVisible();
    });
  });

  describe('Loading State', function () {
    const tursoLibSQLiteServer = useTursoLibSQLiteServer(test);

    test('shall eventually load configuration data', async function ({ page }) {
      await setupDatabaseAndNavigateToAccountingConfig(page, tursoLibSQLiteServer().url);

      // Configuration should be loaded and form visible
      await expect(page.getByLabel('Business Name')).toBeVisible();
      await expect(page.getByLabel('Currency Code')).toBeVisible();
    });
  });

  describe('Success Feedback', function () {
    const tursoLibSQLiteServer = useTursoLibSQLiteServer(test);

    test('shall show success dialog after saving', async function ({ page }) {
      await setupDatabaseAndNavigateToAccountingConfig(page, tursoLibSQLiteServer().url);

      await page.getByLabel('Business Name').clear();
      await page.getByLabel('Business Name').fill('Success Test');

      await page.getByRole('button', { name: 'Save Changes' }).click();

      const dialog = page.getByRole('dialog', { name: 'Settings Saved' });
      await expect(dialog).toBeVisible();
      await expect(dialog.getByText('Configuration has been updated successfully.')).toBeVisible();
    });

    test('shall auto-close success dialog', async function ({ page }) {
      await setupDatabaseAndNavigateToAccountingConfig(page, tursoLibSQLiteServer().url);

      await page.getByLabel('Business Name').clear();
      await page.getByLabel('Business Name').fill('Auto Close Test');

      await page.getByRole('button', { name: 'Save Changes' }).click();

      await expect(page.getByRole('dialog', { name: 'Settings Saved' })).toBeVisible();

      // Dialog should auto-close after a delay
      await expect(page.getByRole('dialog', { name: 'Settings Saved' })).not.toBeVisible({ timeout: 3000 });
    });
  });
});
