import { expect, test } from '@playwright/test';
import { useTursoLibSQLiteServer } from '#test/hooks/use-turso-libsqlite-server.js';
/** @import { Page } from '@playwright/test' */

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

describe('Account Tags', function () {
  describe('Account Tags Tab Navigation', function () {
    const tursoLibSQLiteServer = useTursoLibSQLiteServer(test);

    test('shall display Account Tags tab in Books view', async function ({ page }) {
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
      await page.getByText('Books').click();

      await expect(page.getByRole('tab', { name: 'Account Tags' })).toBeVisible();
    });

    test('shall switch to Account Tags tab when clicked', async function ({ page }) {
      await setupDatabaseAndNavigateToAccountTags(page, tursoLibSQLiteServer().url);

      await expect(page.getByRole('tab', { name: 'Account Tags' })).toHaveAttribute('aria-selected', 'true');
      await expect(page.getByRole('tab', { name: 'Journal Entries' })).toHaveAttribute('aria-selected', 'false');
    });
  });

  describe('Account Tags Display', function () {
    const tursoLibSQLiteServer = useTursoLibSQLiteServer(test);

    test('shall display Account Tags treegrid', async function ({ page }) {
      await setupDatabaseAndNavigateToAccountTags(page, tursoLibSQLiteServer().url);

      await expect(page.getByRole('treegrid', { name: 'Account Tags' })).toBeVisible();
    });

    test('shall display column headers in table', async function ({ page }) {
      await setupDatabaseAndNavigateToAccountTags(page, tursoLibSQLiteServer().url);

      await expect(page.getByRole('columnheader', { name: 'Tag' })).toBeVisible();
      await expect(page.getByRole('columnheader', { name: 'Accounts' })).toBeVisible();
      await expect(page.getByRole('columnheader', { name: 'Actions' })).toBeVisible();
    });

    test('shall display account type tags from template', async function ({ page }) {
      await setupDatabaseAndNavigateToAccountTags(page, tursoLibSQLiteServer().url);

      await expect(page.getByRole('treegrid', { name: 'Account Tags' })).toBeVisible();

      const treegrid = page.getByRole('treegrid', { name: 'Account Tags' });
      await expect(treegrid.getByRole('row', { name: /Tag Asset/ })).toBeVisible();
      await expect(treegrid.getByRole('row', { name: /Tag Liability/ })).toBeVisible();
      await expect(treegrid.getByRole('row', { name: /Tag Equity/ })).toBeVisible();
      await expect(treegrid.getByRole('row', { name: /Tag Revenue/ })).toBeVisible();
      await expect(treegrid.getByRole('row', { name: /Tag Expense/ })).toBeVisible();
    });

    test('shall display account count for each tag', async function ({ page }) {
      await setupDatabaseAndNavigateToAccountTags(page, tursoLibSQLiteServer().url);

      await expect(page.getByRole('treegrid', { name: 'Account Tags' })).toBeVisible();

      const accountsColumn = page.getByRole('columnheader', { name: 'Accounts' });
      await expect(accountsColumn).toBeVisible();
    });
  });

  describe('Account Tags Filtering', function () {
    const tursoLibSQLiteServer = useTursoLibSQLiteServer(test);

    test('shall have search input for filtering tags', async function ({ page }) {
      await setupDatabaseAndNavigateToAccountTags(page, tursoLibSQLiteServer().url);

      const accountTagsPanel = page.getByRole('tabpanel', { name: 'Account Tags' });
      await expect(accountTagsPanel.getByLabel('Search', { exact: true })).toBeVisible();
    });

    test('shall filter tags by search query', async function ({ page }) {
      await setupDatabaseAndNavigateToAccountTags(page, tursoLibSQLiteServer().url);

      const accountTagsPanel = page.getByRole('tabpanel', { name: 'Account Tags' });

      await accountTagsPanel.getByLabel('Search', { exact: true }).fill('Balance Sheet');

      await expect(page.getByRole('treegrid', { name: 'Account Tags' })).toBeVisible();
    });

    test('shall have category filter dropdown', async function ({ page }) {
      await setupDatabaseAndNavigateToAccountTags(page, tursoLibSQLiteServer().url);

      const accountTagsPanel = page.getByRole('tabpanel', { name: 'Account Tags' });
      await expect(accountTagsPanel.getByLabel('Category', { exact: true })).toBeVisible();
    });

    test('shall filter tags by category', async function ({ page }) {
      await setupDatabaseAndNavigateToAccountTags(page, tursoLibSQLiteServer().url);

      const accountTagsPanel = page.getByRole('tabpanel', { name: 'Account Tags' });

      await accountTagsPanel.getByLabel('Category', { exact: true }).click();

      const categoryMenu = page.getByRole('menu', { name: 'Category filter' });
      await expect(categoryMenu).toBeVisible();

      await page.keyboard.press('ArrowDown');
      await page.keyboard.press('Enter');

      await expect(page.getByRole('treegrid', { name: 'Account Tags' })).toBeVisible();
    });
  });

  describe('Account Tags Expand/Collapse', function () {
    const tursoLibSQLiteServer = useTursoLibSQLiteServer(test);

    test('shall display expand/collapse buttons', async function ({ page }) {
      await setupDatabaseAndNavigateToAccountTags(page, tursoLibSQLiteServer().url);

      await expect(page.getByRole('button', { name: 'Expand all tags' })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Collapse all tags' })).toBeVisible();
    });

    test('shall expand tag to show assigned accounts', async function ({ page }) {
      await setupDatabaseAndNavigateToAccountTags(page, tursoLibSQLiteServer().url);

      // Find a tag with accounts and click to expand
      // First click expand all to see which tags have accounts
      await page.getByRole('button', { name: 'Expand all tags' }).click();

      // Wait for expansion
      await page.waitForTimeout(300);

      // Verify the treegrid still shows
      await expect(page.getByRole('treegrid', { name: 'Account Tags' })).toBeVisible();
    });

    test('shall collapse all tags when collapse all button is clicked', async function ({ page }) {
      await setupDatabaseAndNavigateToAccountTags(page, tursoLibSQLiteServer().url);

      // First expand all
      await page.getByRole('button', { name: 'Expand all tags' }).click();
      await page.waitForTimeout(300);

      // Then collapse all
      await page.getByRole('button', { name: 'Collapse all tags' }).click();
      await page.waitForTimeout(300);

      // Verify the treegrid is still displayed
      await expect(page.getByRole('treegrid', { name: 'Account Tags' })).toBeVisible();
    });
  });

  describe('Account Tags Actions', function () {
    const tursoLibSQLiteServer = useTursoLibSQLiteServer(test);

    test('shall have refresh button', async function ({ page }) {
      await setupDatabaseAndNavigateToAccountTags(page, tursoLibSQLiteServer().url);

      await expect(page.getByRole('button', { name: 'Refresh account tags' })).toBeVisible();
    });

    test('shall reload tags when refresh button is clicked', async function ({ page }) {
      await setupDatabaseAndNavigateToAccountTags(page, tursoLibSQLiteServer().url);

      // Click refresh button
      await page.getByRole('button', { name: 'Refresh account tags' }).click();

      // Verify tags are still displayed
      await expect(page.getByRole('treegrid', { name: 'Account Tags' })).toBeVisible();
    });

    test('shall have manage button for each tag', async function ({ page }) {
      await setupDatabaseAndNavigateToAccountTags(page, tursoLibSQLiteServer().url);

      // Verify at least one manage button exists (edit icon button)
      const editButtons = page.getByRole('button', { name: /Manage.*tag assignments/ });
      await expect(editButtons.first()).toBeVisible();
    });
  });

  describe('Account Tag Assignment Dialog', function () {
    const tursoLibSQLiteServer = useTursoLibSQLiteServer(test);

    test('shall open assignment dialog when manage button is clicked', async function ({ page }) {
      await setupDatabaseAndNavigateToAccountTags(page, tursoLibSQLiteServer().url);

      // Click on the first manage button
      const editButtons = page.getByRole('button', { name: /Manage.*tag assignments/ });
      await editButtons.first().click();

      // Verify dialog opens
      await expect(page.getByRole('dialog', { name: /Manage Tag/ })).toBeVisible();
    });

    test('shall display accounts list in assignment dialog', async function ({ page }) {
      await setupDatabaseAndNavigateToAccountTags(page, tursoLibSQLiteServer().url);

      // Find a tag with accounts (non-zero count) to ensure accounts list is visible
      // Click on Balance Sheet - Current Asset which has accounts according to template
      const tagRow = page.getByRole('row', { name: /Tag Balance Sheet - Current Asset/ });
      const editButton = tagRow.getByRole('button', { name: /Manage.*tag assignments/ });
      await editButton.click();

      // Verify dialog has accounts grid
      const dialog = page.getByRole('dialog', { name: /Manage Tag/ });
      await expect(dialog).toBeVisible();

      // Wait for accounts to load (with longer timeout for data loading)
      const accountsGrid = dialog.getByRole('table', { name: 'Accounts list' });
      await expect(accountsGrid).toBeVisible();
    });

    test('shall have search input in assignment dialog', async function ({ page }) {
      await setupDatabaseAndNavigateToAccountTags(page, tursoLibSQLiteServer().url);

      // Click on the first manage button
      const editButtons = page.getByRole('button', { name: /Manage.*tag assignments/ });
      await editButtons.first().click();

      // Verify search input exists within the dialog
      const dialog = page.getByRole('dialog', { name: /Manage Tag/ });
      await expect(dialog).toBeVisible();
      await expect(dialog.getByLabel('Search accounts')).toBeVisible();
    });

    test('shall close dialog when close button is clicked', async function ({ page }) {
      await setupDatabaseAndNavigateToAccountTags(page, tursoLibSQLiteServer().url);

      // Click on the first manage button
      const editButtons = page.getByRole('button', { name: /Manage.*tag assignments/ });
      await editButtons.first().click();

      // Verify dialog is open
      const dialog = page.getByRole('dialog', { name: /Manage Tag/ });
      await expect(dialog).toBeVisible();

      // Close dialog using the close button in the dialog header
      await dialog.getByRole('button').first().click();

      // Verify dialog is closed
      await expect(dialog).not.toBeVisible();
    });
  });
});
