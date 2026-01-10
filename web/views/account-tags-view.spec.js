import { expect, test } from '@playwright/test';
import { useTursoLibSQLiteServer } from '#test/hooks/use-turso-libsqlite-server.js';
import { useStrict } from '#test/hooks/use-strict.js';
import { loadEmptyFixture } from '#test/tools/fixture.js';
import { setupDatabase } from '#test/tools/database.js';

const { describe } = test;

/** @param {string} tursoDatabaseUrl */
async function setupView(tursoDatabaseUrl) {
  document.body.innerHTML = `
    <ready-context>
      <router-context>
        <database-context provider="turso" turso-url=${tursoDatabaseUrl}>
          <device-context>
            <i18n-context>
              <onboarding-context>
                <main-view></main-view>
              </onboarding-context>
            </i18n-context>
          </device-context>
        </database-context>
      </router-context>
    </ready-context>
  `;
}

describe('Account Tags', function () {
  useStrict(test);

  describe('Account Tags Tab Navigation', function () {
    const tursoLibSQLiteServer = useTursoLibSQLiteServer(test);

    test('shall display Account Tags tab in Books view', async function ({ page }) {
      await Promise.all([
        loadEmptyFixture(page),
        setupDatabase(tursoLibSQLiteServer()),
      ]);
      await page.evaluate(setupView, tursoLibSQLiteServer().url);

      await page.getByRole('link', { name: 'Books' }).click();

      await expect(page.getByRole('tab', { name: 'Account Tags' })).toBeVisible();
    });

    test('shall switch to Account Tags tab when clicked', async function ({ page }) {
      await Promise.all([
        loadEmptyFixture(page),
        setupDatabase(tursoLibSQLiteServer()),
      ]);
      await page.evaluate(setupView, tursoLibSQLiteServer().url);

      await page.getByRole('link', { name: 'Books' }).click();
      await page.getByRole('tab', { name: 'Account Tags' }).click();

      await expect(page.getByRole('tab', { name: 'Account Tags' })).toHaveAttribute('aria-selected', 'true');
      await expect(page.getByRole('tab', { name: 'Journal Entries' })).toHaveAttribute('aria-selected', 'false');
    });
  });

  describe('Account Tags Display', function () {
    const tursoLibSQLiteServer = useTursoLibSQLiteServer(test);

    test('shall display Account Tags treegrid', async function ({ page }) {
      await Promise.all([
        loadEmptyFixture(page),
        setupDatabase(tursoLibSQLiteServer()),
      ]);
      await page.evaluate(setupView, tursoLibSQLiteServer().url);

      await page.getByRole('link', { name: 'Books' }).click();
      await page.getByRole('tab', { name: 'Account Tags' }).click();

      await expect(page.getByRole('treegrid', { name: 'Account Tags' })).toBeVisible();
    });

    test('shall display column headers in table', async function ({ page }) {
      await Promise.all([
        loadEmptyFixture(page),
        setupDatabase(tursoLibSQLiteServer()),
      ]);
      await page.evaluate(setupView, tursoLibSQLiteServer().url);

      await page.getByRole('link', { name: 'Books' }).click();
      await page.getByRole('tab', { name: 'Account Tags' }).click();

      await expect(page.getByRole('columnheader', { name: 'Tag' })).toBeVisible();
      await expect(page.getByRole('columnheader', { name: 'Accounts' })).toBeVisible();
      await expect(page.getByRole('columnheader', { name: 'Actions' })).toBeVisible();
    });

    test('shall display account type tags from template', async function ({ page }) {
      await Promise.all([
        loadEmptyFixture(page),
        setupDatabase(tursoLibSQLiteServer()),
      ]);
      await page.evaluate(setupView, tursoLibSQLiteServer().url);

      await page.getByRole('link', { name: 'Books' }).click();
      await page.getByRole('tab', { name: 'Account Tags' }).click();

      await expect(page.getByRole('treegrid', { name: 'Account Tags' })).toBeVisible();

      const treegrid = page.getByRole('treegrid', { name: 'Account Tags' });
      await expect(treegrid.getByRole('row', { name: 'Tag Asset' })).toBeVisible();
      await expect(treegrid.getByRole('row', { name: 'Tag Liability' })).toBeVisible();
      await expect(treegrid.getByRole('row', { name: 'Tag Equity' })).toBeVisible();
      await expect(treegrid.getByRole('row', { name: 'Tag Revenue' })).toBeVisible();
      await expect(treegrid.getByRole('row', { name: 'Tag Expense' })).toBeVisible();
    });

    test('shall display account count for each tag', async function ({ page }) {
      await Promise.all([
        loadEmptyFixture(page),
        setupDatabase(tursoLibSQLiteServer()),
      ]);
      await page.evaluate(setupView, tursoLibSQLiteServer().url);

      await page.getByRole('link', { name: 'Books' }).click();
      await page.getByRole('tab', { name: 'Account Tags' }).click();

      await expect(page.getByRole('treegrid', { name: 'Account Tags' })).toBeVisible();

      const accountsColumn = page.getByRole('columnheader', { name: 'Accounts' });
      await expect(accountsColumn).toBeVisible();
    });
  });

  describe('Account Tags Filtering', function () {
    const tursoLibSQLiteServer = useTursoLibSQLiteServer(test);

    test('shall have search input for filtering tags', async function ({ page }) {
      await Promise.all([
        loadEmptyFixture(page),
        setupDatabase(tursoLibSQLiteServer()),
      ]);
      await page.evaluate(setupView, tursoLibSQLiteServer().url);

      await page.getByRole('link', { name: 'Books' }).click();
      await page.getByRole('tab', { name: 'Account Tags' }).click();

      const accountTagsPanel = page.getByRole('tabpanel', { name: 'Account Tags' });
      await expect(accountTagsPanel.getByLabel('Search', { exact: true })).toBeVisible();
    });

    test('shall filter tags by search query', async function ({ page }) {
      await Promise.all([
        loadEmptyFixture(page),
        setupDatabase(tursoLibSQLiteServer()),
      ]);
      await page.evaluate(setupView, tursoLibSQLiteServer().url);

      await page.getByRole('link', { name: 'Books' }).click();
      await page.getByRole('tab', { name: 'Account Tags' }).click();

      const accountTagsPanel = page.getByRole('tabpanel', { name: 'Account Tags' });

      await accountTagsPanel.getByLabel('Search', { exact: true }).fill('Balance Sheet');

      await expect(page.getByRole('treegrid', { name: 'Account Tags' })).toBeVisible();
    });

    test('shall have category filter dropdown', async function ({ page }) {
      await Promise.all([
        loadEmptyFixture(page),
        setupDatabase(tursoLibSQLiteServer()),
      ]);
      await page.evaluate(setupView, tursoLibSQLiteServer().url);

      await page.getByRole('link', { name: 'Books' }).click();
      await page.getByRole('tab', { name: 'Account Tags' }).click();

      const accountTagsPanel = page.getByRole('tabpanel', { name: 'Account Tags' });
      await expect(accountTagsPanel.getByLabel('Category', { exact: true })).toBeVisible();
    });

    test('shall filter tags by category', async function ({ page }) {
      await Promise.all([
        loadEmptyFixture(page),
        setupDatabase(tursoLibSQLiteServer()),
      ]);
      await page.evaluate(setupView, tursoLibSQLiteServer().url);

      await page.getByRole('link', { name: 'Books' }).click();
      await page.getByRole('tab', { name: 'Account Tags' }).click();

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
      await Promise.all([
        loadEmptyFixture(page),
        setupDatabase(tursoLibSQLiteServer()),
      ]);
      await page.evaluate(setupView, tursoLibSQLiteServer().url);

      await page.getByRole('link', { name: 'Books' }).click();
      await page.getByRole('tab', { name: 'Account Tags' }).click();

      await expect(page.getByRole('button', { name: 'Expand all tags' })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Collapse all tags' })).toBeVisible();
    });

    test('shall expand tag to show assigned accounts', async function ({ page }) {
      await Promise.all([
        loadEmptyFixture(page),
        setupDatabase(tursoLibSQLiteServer()),
      ]);
      await page.evaluate(setupView, tursoLibSQLiteServer().url);

      await page.getByRole('link', { name: 'Books' }).click();
      await page.getByRole('tab', { name: 'Account Tags' }).click();

      await page.getByRole('button', { name: 'Expand all tags' }).click();

      await expect(page.getByRole('treegrid', { name: 'Account Tags' })).toBeVisible();
    });

    test('shall collapse all tags when collapse all button is clicked', async function ({ page }) {
      await Promise.all([
        loadEmptyFixture(page),
        setupDatabase(tursoLibSQLiteServer()),
      ]);
      await page.evaluate(setupView, tursoLibSQLiteServer().url);

      await page.getByRole('link', { name: 'Books' }).click();
      await page.getByRole('tab', { name: 'Account Tags' }).click();

      await page.getByRole('button', { name: 'Expand all tags' }).click();

      await page.getByRole('button', { name: 'Collapse all tags' }).click();

      await expect(page.getByRole('treegrid', { name: 'Account Tags' })).toBeVisible();
    });
  });

  describe('Account Tags Actions', function () {
    const tursoLibSQLiteServer = useTursoLibSQLiteServer(test);

    test('shall have refresh button', async function ({ page }) {
      await Promise.all([
        loadEmptyFixture(page),
        setupDatabase(tursoLibSQLiteServer()),
      ]);
      await page.evaluate(setupView, tursoLibSQLiteServer().url);

      await page.getByRole('link', { name: 'Books' }).click();
      await page.getByRole('tab', { name: 'Account Tags' }).click();

      await expect(page.getByRole('button', { name: 'Refresh account tags' })).toBeVisible();
    });

    test('shall reload tags when refresh button is clicked', async function ({ page }) {
      await Promise.all([
        loadEmptyFixture(page),
        setupDatabase(tursoLibSQLiteServer()),
      ]);
      await page.evaluate(setupView, tursoLibSQLiteServer().url);

      await page.getByRole('link', { name: 'Books' }).click();
      await page.getByRole('tab', { name: 'Account Tags' }).click();

      await page.getByRole('button', { name: 'Refresh account tags' }).click();

      await expect(page.getByRole('treegrid', { name: 'Account Tags' })).toBeVisible();
    });

    test('shall have manage button for each tag', async function ({ page }) {
      await Promise.all([
        loadEmptyFixture(page),
        setupDatabase(tursoLibSQLiteServer()),
      ]);
      await page.evaluate(setupView, tursoLibSQLiteServer().url);

      await page.getByRole('link', { name: 'Books' }).click();
      await page.getByRole('tab', { name: 'Account Tags' }).click();

      const treegrid = page.getByRole('treegrid', { name: 'Account Tags' });
      const tagRow = treegrid.getByRole('row').nth(1);
      const manageButton = tagRow.getByRole('button').first();
      await expect(manageButton).toBeVisible();
    });
  });

  describe('Account Tag Assignment Dialog', function () {
    const tursoLibSQLiteServer = useTursoLibSQLiteServer(test);

    test('shall open assignment dialog when manage button is clicked', async function ({ page }) {
      await Promise.all([
        loadEmptyFixture(page),
        setupDatabase(tursoLibSQLiteServer()),
      ]);
      await page.evaluate(setupView, tursoLibSQLiteServer().url);

      await page.getByRole('link', { name: 'Books' }).click();
      await page.getByRole('tab', { name: 'Account Tags' }).click();

      const treegrid = page.getByRole('treegrid', { name: 'Account Tags' });
      const tagRow = treegrid.getByRole('row').nth(1);
      const manageButton = tagRow.getByRole('button').first();
      await manageButton.click();

      const dialog = page.getByRole('dialog');
      await expect(dialog).toBeVisible();
    });

    test('shall display accounts list in assignment dialog', async function ({ page }) {
      await Promise.all([
        loadEmptyFixture(page),
        setupDatabase(tursoLibSQLiteServer()),
      ]);
      await page.evaluate(setupView, tursoLibSQLiteServer().url);

      await page.getByRole('link', { name: 'Books' }).click();
      await page.getByRole('tab', { name: 'Account Tags' }).click();

      const treegrid = page.getByRole('treegrid', { name: 'Account Tags' });
      const tagRow = treegrid.getByRole('row').nth(1);
      const editButton = tagRow.getByRole('button').first();
      await editButton.click();

      const dialog = page.getByRole('dialog');
      await expect(dialog).toBeVisible();

      const accountsGrid = dialog.getByRole('table', { name: 'Accounts list' });
      await expect(accountsGrid).toBeVisible();
    });

    test('shall have search input in assignment dialog', async function ({ page }) {
      await Promise.all([
        loadEmptyFixture(page),
        setupDatabase(tursoLibSQLiteServer()),
      ]);
      await page.evaluate(setupView, tursoLibSQLiteServer().url);

      await page.getByRole('link', { name: 'Books' }).click();
      await page.getByRole('tab', { name: 'Account Tags' }).click();

      const treegrid = page.getByRole('treegrid', { name: 'Account Tags' });
      const tagRow = treegrid.getByRole('row').nth(1);
      const manageButton = tagRow.getByRole('button').first();
      await manageButton.click();

      const dialog = page.getByRole('dialog');
      await expect(dialog).toBeVisible();
      await expect(dialog.getByLabel('Search accounts')).toBeVisible();
    });

    test('shall close dialog when close button is clicked', async function ({ page }) {
      await Promise.all([
        loadEmptyFixture(page),
        setupDatabase(tursoLibSQLiteServer()),
      ]);
      await page.evaluate(setupView, tursoLibSQLiteServer().url);

      await page.getByRole('link', { name: 'Books' }).click();
      await page.getByRole('tab', { name: 'Account Tags' }).click();

      const treegrid = page.getByRole('treegrid', { name: 'Account Tags' });
      const tagRow = treegrid.getByRole('row').nth(1);
      const manageButton = tagRow.getByRole('button').first();
      await manageButton.click();

      const dialog = page.getByRole('dialog');
      await expect(dialog).toBeVisible();

      await dialog.getByRole('button').first().click();

      await expect(dialog).not.toBeVisible();
    });
  });
});
