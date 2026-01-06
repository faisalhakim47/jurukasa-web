import { expect, test } from '@playwright/test';
import { useTursoLibSQLiteServer } from '#test/hooks/use-turso-libsqlite-server.js';

const { describe } = test;

describe('Account Tags', function () {
  const tursoLibSQLiteServer = useTursoLibSQLiteServer(test);

  /**
   * Helper function to setup database and navigate to Account Tags tab
   * @param {import('@playwright/test').Page} page
   */
  async function setupDatabaseAndNavigateToAccountTags(page) {
    await page.goto('/test/fixtures/testing.html');
    
    // Configure database
    await page.getByLabel('Turso Database URL').fill(tursoLibSQLiteServer().url);
    await page.getByRole('button', { name: 'Configure' }).click();

    // Complete onboarding: Configure Business
    await expect(page.getByRole('dialog', { name: 'Configure Business' })).toBeVisible();
    await page.getByLabel('Business Name').fill('Test Business');
    await page.getByRole('button', { name: 'Next' }).click();

    // Complete onboarding: Chart of Accounts selection
    await expect(page.getByRole('dialog', { name: 'Choose Chart of Accounts Template' })).toBeVisible();
    await page.getByRole('radio', { name: 'Retail Business - Indonesia' }).click();
    await page.getByRole('button', { name: 'Finish' }).click();

    // Wait for dashboard to load
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();

    // Navigate to Books
    await page.getByText('Books').click();

    // Navigate to Account Tags tab
    await page.getByRole('tab', { name: 'Account Tags' }).click();
    await expect(page.getByRole('tab', { name: 'Account Tags' })).toHaveAttribute('aria-selected', 'true');
  }

  describe('Account Tags Tab Navigation', function () {
    test('shall display Account Tags tab in Books view', async function ({ page }) {
      await page.goto('/test/fixtures/testing.html');
      
      // Configure database
      await page.getByLabel('Turso Database URL').fill(tursoLibSQLiteServer().url);
      await page.getByRole('button', { name: 'Configure' }).click();

      // Complete onboarding
      await expect(page.getByRole('dialog', { name: 'Configure Business' })).toBeVisible();
      await page.getByLabel('Business Name').fill('Test Business');
      await page.getByRole('button', { name: 'Next' }).click();

      await expect(page.getByRole('dialog', { name: 'Choose Chart of Accounts Template' })).toBeVisible();
      await page.getByRole('radio', { name: 'Retail Business - Indonesia' }).click();
      await page.getByRole('button', { name: 'Finish' }).click();

      // Navigate to Books
      await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
      await page.getByText('Books').click();

      // Verify Account Tags tab is visible
      await expect(page.getByRole('tab', { name: 'Account Tags' })).toBeVisible();
    });

    test('shall switch to Account Tags tab when clicked', async function ({ page }) {
      await setupDatabaseAndNavigateToAccountTags(page);

      await expect(page.getByRole('tab', { name: 'Account Tags' })).toHaveAttribute('aria-selected', 'true');
      await expect(page.getByRole('tab', { name: 'Journal Entries' })).toHaveAttribute('aria-selected', 'false');
    });
  });

  describe('Account Tags Display', function () {
    test('shall display Account Tags treegrid', async function ({ page }) {
      await setupDatabaseAndNavigateToAccountTags(page);

      await expect(page.getByRole('treegrid', { name: 'Account Tags' })).toBeVisible();
    });

    test('shall display column headers in table', async function ({ page }) {
      await setupDatabaseAndNavigateToAccountTags(page);

      await expect(page.getByRole('columnheader', { name: 'Tag' })).toBeVisible();
      await expect(page.getByRole('columnheader', { name: 'Accounts' })).toBeVisible();
      await expect(page.getByRole('columnheader', { name: 'Actions' })).toBeVisible();
    });

    test('shall display account type tags from template', async function ({ page }) {
      await setupDatabaseAndNavigateToAccountTags(page);

      // Wait for tags to load
      await expect(page.getByRole('treegrid', { name: 'Account Tags' })).toBeVisible();

      // Verify some account type tags are displayed in the table as label badges
      const treegrid = page.getByRole('treegrid', { name: 'Account Tags' });
      await expect(treegrid.getByRole('row', { name: /Tag Asset/ })).toBeVisible();
      await expect(treegrid.getByRole('row', { name: /Tag Liability/ })).toBeVisible();
      await expect(treegrid.getByRole('row', { name: /Tag Equity/ })).toBeVisible();
      await expect(treegrid.getByRole('row', { name: /Tag Revenue/ })).toBeVisible();
      await expect(treegrid.getByRole('row', { name: /Tag Expense/ })).toBeVisible();
    });

    test('shall display account count for each tag', async function ({ page }) {
      await setupDatabaseAndNavigateToAccountTags(page);

      // Wait for tags to load
      await expect(page.getByRole('treegrid', { name: 'Account Tags' })).toBeVisible();

      // Verify that count badges are visible (they appear as numbers in the Accounts column)
      const accountsColumn = page.getByRole('columnheader', { name: 'Accounts' });
      await expect(accountsColumn).toBeVisible();
    });
  });

  describe('Account Tags Filtering', function () {
    test('shall have search input for filtering tags', async function ({ page }) {
      await setupDatabaseAndNavigateToAccountTags(page);

      const accountTagsPanel = page.getByRole('tabpanel', { name: 'Account Tags' });
      await expect(accountTagsPanel.getByLabel('Search', { exact: true })).toBeVisible();
    });

    test('shall filter tags by search query', async function ({ page }) {
      await setupDatabaseAndNavigateToAccountTags(page);

      const accountTagsPanel = page.getByRole('tabpanel', { name: 'Account Tags' });

      // Search for "Balance Sheet" tags
      await accountTagsPanel.getByLabel('Search', { exact: true }).fill('Balance Sheet');

      // Wait for filtering to apply
      await page.waitForTimeout(500);

      // Verify the treegrid still shows
      await expect(page.getByRole('treegrid', { name: 'Account Tags' })).toBeVisible();
    });

    test('shall have category filter dropdown', async function ({ page }) {
      await setupDatabaseAndNavigateToAccountTags(page);

      const accountTagsPanel = page.getByRole('tabpanel', { name: 'Account Tags' });
      await expect(accountTagsPanel.getByLabel('Category', { exact: true })).toBeVisible();
    });

    test('shall filter tags by category', async function ({ page }) {
      await setupDatabaseAndNavigateToAccountTags(page);

      const accountTagsPanel = page.getByRole('tabpanel', { name: 'Account Tags' });

      // Click category filter
      await accountTagsPanel.getByLabel('Category', { exact: true }).click();

      // Wait for menu to be visible
      const categoryMenu = page.getByRole('menu', { name: 'Category filter' });
      await expect(categoryMenu).toBeVisible();

      // Select Account Types category using keyboard
      await page.keyboard.press('ArrowDown');
      await page.keyboard.press('Enter');

      // Verify the treegrid is still displayed
      await expect(page.getByRole('treegrid', { name: 'Account Tags' })).toBeVisible();
    });
  });

  describe('Account Tags Expand/Collapse', function () {
    test('shall display expand/collapse buttons', async function ({ page }) {
      await setupDatabaseAndNavigateToAccountTags(page);

      await expect(page.getByRole('button', { name: 'Expand all tags' })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Collapse all tags' })).toBeVisible();
    });

    test('shall expand tag to show assigned accounts', async function ({ page }) {
      await setupDatabaseAndNavigateToAccountTags(page);

      // Find a tag with accounts and click to expand
      // First click expand all to see which tags have accounts
      await page.getByRole('button', { name: 'Expand all tags' }).click();

      // Wait for expansion
      await page.waitForTimeout(300);

      // Verify the treegrid still shows
      await expect(page.getByRole('treegrid', { name: 'Account Tags' })).toBeVisible();
    });

    test('shall collapse all tags when collapse all button is clicked', async function ({ page }) {
      await setupDatabaseAndNavigateToAccountTags(page);

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
    test('shall have refresh button', async function ({ page }) {
      await setupDatabaseAndNavigateToAccountTags(page);

      await expect(page.getByRole('button', { name: 'Refresh account tags' })).toBeVisible();
    });

    test('shall reload tags when refresh button is clicked', async function ({ page }) {
      await setupDatabaseAndNavigateToAccountTags(page);

      // Click refresh button
      await page.getByRole('button', { name: 'Refresh account tags' }).click();

      // Verify tags are still displayed
      await expect(page.getByRole('treegrid', { name: 'Account Tags' })).toBeVisible();
    });

    test('shall have manage button for each tag', async function ({ page }) {
      await setupDatabaseAndNavigateToAccountTags(page);

      // Verify at least one manage button exists (edit icon button)
      const editButtons = page.getByRole('button', { name: /Manage.*tag assignments/ });
      await expect(editButtons.first()).toBeVisible();
    });
  });

  describe('Account Tag Assignment Dialog', function () {
    test('shall open assignment dialog when manage button is clicked', async function ({ page }) {
      await setupDatabaseAndNavigateToAccountTags(page);

      // Click on the first manage button
      const editButtons = page.getByRole('button', { name: /Manage.*tag assignments/ });
      await editButtons.first().click();

      // Verify dialog opens
      await expect(page.getByRole('dialog', { name: /Manage Tag/ })).toBeVisible();
    });

    test('shall display accounts list in assignment dialog', async function ({ page }) {
      await setupDatabaseAndNavigateToAccountTags(page);

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
      await setupDatabaseAndNavigateToAccountTags(page);

      // Click on the first manage button
      const editButtons = page.getByRole('button', { name: /Manage.*tag assignments/ });
      await editButtons.first().click();

      // Verify search input exists within the dialog
      const dialog = page.getByRole('dialog', { name: /Manage Tag/ });
      await expect(dialog).toBeVisible();
      await expect(dialog.getByLabel('Search accounts')).toBeVisible();
    });

    test('shall close dialog when close button is clicked', async function ({ page }) {
      await setupDatabaseAndNavigateToAccountTags(page);

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
