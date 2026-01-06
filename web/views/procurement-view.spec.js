import { expect, test } from '@playwright/test';
import { useTursoLibSQLiteServer } from '#test/hooks/use-turso-libsqlite-server.js';
/** @import { Page } from '@playwright/test' */
const { describe } = test; 

/**
 * Helper function to setup database and navigate to procurement page
 * @param {Page} page
 * @param {string} tursoLibSQLiteServerUrl
 */
async function setupDatabaseAndNavigate(page, tursoLibSQLiteServerUrl) {
  await page.goto('/test/fixtures/testing.html');
  
  // Configure database
  await page.getByLabel('Turso Database URL').fill(tursoLibSQLiteServerUrl);
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

  // Navigate to Procurement
  await page.getByText('Procure').click();

  // Wait for Purchases tab to be active
  await expect(page.getByRole('tab', { name: 'Purchases' })).toHaveAttribute('aria-selected', 'true');
}

describe('Procurement', function () {

  describe('Procurement Navigation', function () {
    const tursoLibSQLiteServer = useTursoLibSQLiteServer(test);

    test('shall display Procurement heading when navigating to procurement', async function ({ page }) {
      await setupDatabaseAndNavigate(page, tursoLibSQLiteServer().url);
 
      await expect(page.getByRole('heading', { name: 'Procurement' })).toBeVisible();
    });
 
    test('shall show Purchases tab as selected by default', async function ({ page }) {
      await setupDatabaseAndNavigate(page, tursoLibSQLiteServer().url);
 
      await expect(page.getByRole('tab', { name: 'Purchases' })).toHaveAttribute('aria-selected', 'true');
    });
  });
 
  describe('Purchases List', function () {
    const tursoLibSQLiteServer = useTursoLibSQLiteServer(test);

    test('shall display empty state when no purchases exist', async function ({ page }) {
      await setupDatabaseAndNavigate(page, tursoLibSQLiteServer().url);
 
      await expect(page.getByRole('heading', { name: 'No purchases found' })).toBeVisible();
      await expect(page.getByText('Start by recording your first purchase to track inventory costs.')).toBeVisible();
    });
 
    test('shall display New Purchase button in empty state', async function ({ page }) {
      await setupDatabaseAndNavigate(page, tursoLibSQLiteServer().url);

      const purchasesPanel = page.getByRole('tabpanel', { name: 'Purchases' });
      // one in header, one in empty state
      await expect(purchasesPanel.getByRole('button', { name: 'New Purchase' })).toHaveCount(2);
    });

    test('shall have status filter', async function ({ page }) {
      await setupDatabaseAndNavigate(page, tursoLibSQLiteServer().url);

      const purchasesPanel = page.getByRole('tabpanel', { name: 'Purchases' });
      await expect(purchasesPanel.getByLabel('Status')).toBeVisible();
    });

    test('shall have refresh button', async function ({ page }) {
      await setupDatabaseAndNavigate(page, tursoLibSQLiteServer().url);

      const purchasesPanel = page.getByRole('tabpanel', { name: 'Purchases' });
      await expect(purchasesPanel.getByRole('button', { name: 'Refresh purchases' })).toBeVisible();
    });
  });
 
  describe('Purchase Creation View', function () {
    const tursoLibSQLiteServer = useTursoLibSQLiteServer(test);

    test('shall navigate to purchase creation view when clicking New Purchase button', async function ({ page }) {
      await setupDatabaseAndNavigate(page, tursoLibSQLiteServer().url);

      // Click on empty state button
      const purchasesPanel = page.getByRole('tabpanel', { name: 'Purchases' });
      await purchasesPanel.getByRole('button', { name: 'New Purchase' }).filter({ hasText: 'New Purchase' }).first().click();

      // Should display new purchase heading
      await expect(page.getByRole('heading', { name: 'New Purchase' })).toBeVisible();
    });

    test('shall display purchase date field in creation view', async function ({ page }) {
      await setupDatabaseAndNavigate(page, tursoLibSQLiteServer().url);

      const purchasesPanel = page.getByRole('tabpanel', { name: 'Purchases' });
      await purchasesPanel.getByRole('button', { name: 'New Purchase' }).filter({ hasText: 'New Purchase' }).first().click();

      await expect(page.getByLabel('Purchase Date')).toBeVisible();
    });

    test('shall display supplier selector button in creation view', async function ({ page }) {
      await setupDatabaseAndNavigate(page, tursoLibSQLiteServer().url);

      const purchasesPanel = page.getByRole('tabpanel', { name: 'Purchases' });
      await purchasesPanel.getByRole('button', { name: 'New Purchase' }).filter({ hasText: 'New Purchase' }).first().click();

      await expect(page.getByRole('button', { name: 'Select Supplier' })).toBeVisible();
    });

    test('shall navigate back to purchases list when clicking Cancel button', async function ({ page }) {
      await setupDatabaseAndNavigate(page, tursoLibSQLiteServer().url);

      const purchasesPanel = page.getByRole('tabpanel', { name: 'Purchases' });
      await purchasesPanel.getByRole('button', { name: 'New Purchase' }).filter({ hasText: 'New Purchase' }).first().click();

      await page.getByRole('button', { name: 'Cancel' }).click();

      await expect(page.getByRole('heading', { name: 'No purchases found' })).toBeVisible();
    });
  });
 });
