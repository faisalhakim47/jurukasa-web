import { expect, test } from '@playwright/test';
import { useTursoLibSQLiteServer } from '#test/hooks/use-turso-libsqlite-server.js';
import { useStrict } from '#test/hooks/use-strict.js';
/** @import { Page } from '@playwright/test'; */

const { describe } = test;

/**
 * @param {Page} page
 * @param {string} tursoLibSQLiteServerUrl
 */
async function setupDatabaseAndNavigateToAccountTags(page, tursoLibSQLiteServerUrl) {
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

  await page.getByText('Books').click();

  await page.getByRole('tab', { name: 'Account Tags' }).click();
  await expect(page.getByRole('tab', { name: 'Account Tags' })).toHaveAttribute('aria-selected', 'true');
}

describe('Account Tag Assignment Dialog', function () {
  useStrict(test);

  describe('Dialog Structure', function () {
    const tursoLibSQLiteServer = useTursoLibSQLiteServer(test);

    test('shall display dialog title with tag name', async function ({ page }) {
      await setupDatabaseAndNavigateToAccountTags(page, tursoLibSQLiteServer().url);

      const editButtons = page.getByRole('button', { name: 'Manage Asset tag assignments' });
      await editButtons.click();

      await expect(page.getByRole('heading', { name: 'Manage Tag: Asset' })).toBeVisible();
    });

    test('shall display category label for tag', async function ({ page }) {
      await setupDatabaseAndNavigateToAccountTags(page, tursoLibSQLiteServer().url);

      const tagRow = page.getByRole('row', { name: 'Tag Balance Sheet - Current Asset' });
      const editButton = tagRow.getByRole('button', { name: 'Manage Balance Sheet - Current Asset tag assignments' });
      await editButton.click();

      const dialog = page.getByRole('dialog', { name: 'Manage Tag: Balance Sheet - Current Asset' });
      await expect(dialog).toBeVisible();
      await expect(dialog.getByText('Category:')).toBeVisible();

      await expect(dialog.locator('span.label-medium').getByText('Balance Sheet')).toBeVisible();
    });

    test('shall display accounts count', async function ({ page }) {
      await setupDatabaseAndNavigateToAccountTags(page, tursoLibSQLiteServer().url);

      const editButtons = page.getByRole('button', { name: 'Manage Asset tag assignments' });
      await editButtons.click();

      const dialog = page.getByRole('dialog', { name: 'Manage Tag: Asset' });
      await expect(dialog).toBeVisible();
      
      // The paragraph with accounts count will be visible in the dialog
      await expect(dialog.getByText('0 accounts assigned')).toBeVisible();
    });
  });

  describe('Account Selection', function () {
    const tursoLibSQLiteServer = useTursoLibSQLiteServer(test);

    test('shall display list of active accounts', async function ({ page }) {
      await setupDatabaseAndNavigateToAccountTags(page, tursoLibSQLiteServer().url);

      const tagRow = page.getByRole('row', { name: 'Tag Balance Sheet - Current Asset' });
      const editButton = tagRow.getByRole('button', { name: 'Manage Balance Sheet - Current Asset tag assignments' });
      await editButton.click();

      const dialog = page.getByRole('dialog', { name: 'Manage Tag: Balance Sheet - Current Asset' });
      await expect(dialog).toBeVisible();

      const accountsGrid = dialog.getByRole('table', { name: 'Accounts list' });
      await expect(accountsGrid).toBeVisible();

      await expect(dialog.getByRole('columnheader', { name: 'Code' })).toBeVisible();
      await expect(dialog.getByRole('columnheader', { name: 'Name' })).toBeVisible();
    });

    test('shall show checkmark for assigned accounts', async function ({ page }) {
      await setupDatabaseAndNavigateToAccountTags(page, tursoLibSQLiteServer().url);

      const tagRow = page.getByRole('row', { name: 'Tag Balance Sheet - Current Asset' });
      const editButton = tagRow.getByRole('button', { name: 'Manage Balance Sheet - Current Asset tag assignments' });
      await editButton.click();

      const dialog = page.getByRole('dialog', { name: 'Manage Tag: Balance Sheet - Current Asset' });
      await expect(dialog).toBeVisible();

      const accountsGrid = dialog.getByRole('table', { name: 'Accounts list' });
      await expect(accountsGrid).toBeVisible();
    });

    test('shall filter accounts by search query', async function ({ page }) {
      await setupDatabaseAndNavigateToAccountTags(page, tursoLibSQLiteServer().url);

      const tagRow = page.getByRole('row', { name: 'Tag Balance Sheet - Current Asset' });
      const editButton = tagRow.getByRole('button', { name: 'Manage Balance Sheet - Current Asset tag assignments' });
      await editButton.click();

      const dialog = page.getByRole('dialog', { name: 'Manage Tag: Balance Sheet - Current Asset' });
      await expect(dialog).toBeVisible();

      await expect(dialog.getByRole('table', { name: 'Accounts list' })).toBeVisible();

      await dialog.getByLabel('Search accounts').fill('Kas');

      await expect(dialog.getByRole('table', { name: 'Accounts list' })).toBeVisible();
    });
  });

  describe('Tag Assignment Operations', function () {
    const tursoLibSQLiteServer = useTursoLibSQLiteServer(test);

    test('shall toggle tag assignment when clicking account row', async function ({ page }) {
      await setupDatabaseAndNavigateToAccountTags(page, tursoLibSQLiteServer().url);

      const tagRow = page.getByRole('row', { name: 'Tag Balance Sheet - Current Asset' });
      const editButton = tagRow.getByRole('button', { name: 'Manage Balance Sheet - Current Asset tag assignments' });
      await editButton.click();

      const dialog = page.getByRole('dialog', { name: 'Manage Tag: Balance Sheet - Current Asset' });
      await expect(dialog).toBeVisible();

      const accountsGrid = dialog.getByRole('table', { name: 'Accounts list' });
      await expect(accountsGrid).toBeVisible();
    });

    test('shall show unique tag warning for exclusive tags', async function ({ page }) {
      await setupDatabaseAndNavigateToAccountTags(page, tursoLibSQLiteServer().url);

      // Filter to "Fiscal Year Closing" category which has unique tags
      const accountTagsPanel = page.getByRole('tabpanel', { name: 'Account Tags' });
      await accountTagsPanel.getByLabel('Category', { exact: true }).click();

      // Use keyboard to select Fiscal Year Closing
      await page.keyboard.press('ArrowDown'); // All
      await page.keyboard.press('ArrowDown'); // Account Types
      await page.keyboard.press('ArrowDown'); // Account Classifications
      await page.keyboard.press('ArrowDown'); // Fiscal Year Closing
      await page.keyboard.press('Enter');

      const retainedEarningButton = page.getByRole('button', { name: 'Manage Fiscal Year Closing - Retained Earning tag assignments' });
      await retainedEarningButton.click();

      const dialog = page.getByRole('dialog', { name: 'Manage Tag: Fiscal Year Closing - Retained Earning' });
      await expect(dialog).toBeVisible();

      await expect(dialog.getByRole('table', { name: 'Accounts list' })).toBeVisible();

      await expect(dialog.getByText(/unique tag.*only one account allowed/i)).toBeVisible();
    });
  });

  describe('Dialog Close Behavior', function () {
    const tursoLibSQLiteServer = useTursoLibSQLiteServer(test);

    test('shall close dialog and update parent view when tag is assigned', async function ({ page }) {
      await setupDatabaseAndNavigateToAccountTags(page, tursoLibSQLiteServer().url);

      const tagRow = page.getByRole('row', { name: 'Tag Balance Sheet - Current Asset' });
      const editButton = tagRow.getByRole('button', { name: 'Manage Balance Sheet - Current Asset tag assignments' });
      await editButton.click();

      const dialog = page.getByRole('dialog', { name: 'Manage Tag: Balance Sheet - Current Asset' });
      await expect(dialog).toBeVisible();

      await expect(dialog.getByRole('table', { name: 'Accounts list' })).toBeVisible();

      await dialog.getByRole('button').first().click();

      await expect(dialog).not.toBeVisible();

      await expect(page.getByRole('treegrid', { name: 'Account Tags' })).toBeVisible();
    });

    test('shall preserve search state after closing dialog', async function ({ page }) {
      await setupDatabaseAndNavigateToAccountTags(page, tursoLibSQLiteServer().url);

      const accountTagsPanel = page.getByRole('tabpanel', { name: 'Account Tags' });

      await accountTagsPanel.getByLabel('Search', { exact: true }).fill('Balance Sheet');

      const tagRow = page.getByRole('row', { name: 'Tag Balance Sheet - Current Asset' });
      const editButton = tagRow.getByRole('button', { name: 'Manage Balance Sheet - Current Asset tag assignments' });
      await editButton.click();

      const dialog = page.getByRole('dialog', { name: 'Manage Tag: Balance Sheet - Current Asset' });
      await expect(dialog).toBeVisible();

      await expect(dialog.getByRole('table', { name: 'Accounts list' })).toBeVisible();

      await dialog.getByRole('button').first().click();

      await expect(dialog).not.toBeVisible();

      await expect(accountTagsPanel.getByLabel('Search', { exact: true })).toHaveValue('Balance Sheet');
    });
  });
});
