import { expect } from '@playwright/test';
import { jurukasaTest } from '#test/playwright/test-setup.js';
import { useTursoLibSQLiteServer } from '#test/playwright/hooks/use-turso-libsqlite-server.js';
import { useStrict } from '#test/playwright/hooks/use-strict.js';
import { loadEmptyFixture } from '#test/playwright/tools/fixture.js';
import { setupDatabase } from '#test/playwright/tools/database.js';
import { useConsoleOutput } from '#test/playwright/hooks/use-console-output.js';

const test = jurukasaTest;
const { describe } = test;

/** @param {string} tursoDatabaseUrl */
async function setupView(tursoDatabaseUrl) {
  document.body.innerHTML = `
    <ready-context>
      <font-context>
        <time-context>
          <router-context>
            <database-context provider="turso" name="My Business" turso-url=${tursoDatabaseUrl}>
              <device-context>
                <i18n-context>
                  <main-view></main-view>
                </i18n-context>
              </device-context>
            </database-context>
          </router-context>
        </time-context>
      </font-context>
    </ready-context>
  `;
}

describe('Account Tags', function () {
  useConsoleOutput(test);
  useStrict(test);
  const tursoLibSQLiteServer = useTursoLibSQLiteServer(test);

  test('navigate to Account Tags tab and view treegrid with account type tags', async function ({ page }) {
    await Promise.all([
      loadEmptyFixture(page),
      setupDatabase(tursoLibSQLiteServer()),
    ]);
    await page.evaluate(setupView, tursoLibSQLiteServer().url);

    await page.getByRole('link', { name: 'Books' }).click();

    await expect(page.getByRole('tab', { name: 'Account Tags' }), 'it shall display Account Tags tab in Books view').toBeVisible();

    await page.getByRole('tab', { name: 'Account Tags' }).click();

    await expect(page.getByRole('tab', { name: 'Account Tags' }), 'it shall select Account Tags tab when clicked').toHaveAttribute('aria-selected', 'true');
    await expect(page.getByRole('tab', { name: 'Journal Entries' }), 'it shall deselect Journal Entries tab when Account Tags is selected').toHaveAttribute('aria-selected', 'false');

    await expect(page.getByRole('treegrid', { name: 'Account Tags' }), 'it shall display Account Tags treegrid').toBeVisible();

    await expect(page.getByRole('columnheader', { name: 'Tag' }), 'it shall display Tag column header').toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Accounts' }), 'it shall display Accounts column header').toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Actions' }), 'it shall display Actions column header').toBeVisible();

    const treegrid = page.getByRole('treegrid', { name: 'Account Tags' });
    await expect(treegrid.getByRole('row', { name: 'Tag Asset' }), 'it shall display Asset tag from template').toBeVisible();
    await expect(treegrid.getByRole('row', { name: 'Tag Liability' }), 'it shall display Liability tag from template').toBeVisible();
    await expect(treegrid.getByRole('row', { name: 'Tag Equity' }), 'it shall display Equity tag from template').toBeVisible();
    await expect(treegrid.getByRole('row', { name: 'Tag Revenue' }), 'it shall display Revenue tag from template').toBeVisible();
    await expect(treegrid.getByRole('row', { name: 'Tag Expense' }), 'it shall display Expense tag from template').toBeVisible();

    const accountsColumn = page.getByRole('columnheader', { name: 'Accounts' });
    await expect(accountsColumn, 'it shall display account count column').toBeVisible();
  });

  test('filter account tags by search query flow', async function ({ page }) {
    await Promise.all([
      loadEmptyFixture(page),
      setupDatabase(tursoLibSQLiteServer()),
    ]);
    await page.evaluate(setupView, tursoLibSQLiteServer().url);

    await page.getByRole('link', { name: 'Books' }).click();
    await page.getByRole('tab', { name: 'Account Tags' }).click();

    const accountTagsPanel = page.getByRole('tabpanel', { name: 'Account Tags' });
    await expect(accountTagsPanel.getByLabel('Search', { exact: true }), 'it shall have search input for filtering tags').toBeVisible();

    await accountTagsPanel.getByLabel('Search', { exact: true }).fill('Balance Sheet');

    await expect(page.getByRole('treegrid', { name: 'Account Tags' }), 'it shall display treegrid after search filter').toBeVisible();
  });

  test('filter account tags by category flow', async function ({ page }) {
    await Promise.all([
      loadEmptyFixture(page),
      setupDatabase(tursoLibSQLiteServer()),
    ]);
    await page.evaluate(setupView, tursoLibSQLiteServer().url);

    await page.getByRole('link', { name: 'Books' }).click();
    await page.getByRole('tab', { name: 'Account Tags' }).click();

    const accountTagsPanel = page.getByRole('tabpanel', { name: 'Account Tags' });
    await expect(accountTagsPanel.getByLabel('Category', { exact: true }), 'it shall have category filter dropdown').toBeVisible();

    await accountTagsPanel.getByLabel('Category', { exact: true }).click();

    const categoryMenu = page.getByRole('menu', { name: 'Category filter' });
    await expect(categoryMenu, 'it shall open category filter menu when clicked').toBeVisible();

    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');

    await expect(page.getByRole('treegrid', { name: 'Account Tags' }), 'it shall display treegrid after category filter').toBeVisible();
  });

  test('expand and collapse account tags flow', async function ({ page }) {
    await Promise.all([
      loadEmptyFixture(page),
      setupDatabase(tursoLibSQLiteServer()),
    ]);
    await page.evaluate(setupView, tursoLibSQLiteServer().url);

    await page.getByRole('link', { name: 'Books' }).click();
    await page.getByRole('tab', { name: 'Account Tags' }).click();

    await expect(page.getByRole('button', { name: 'Expand all tags' }), 'it shall display expand all button').toBeVisible();
    await expect(page.getByRole('button', { name: 'Collapse all tags' }), 'it shall display collapse all button').toBeVisible();

    await page.getByRole('button', { name: 'Expand all tags' }).click();

    await expect(page.getByRole('treegrid', { name: 'Account Tags' }), 'it shall display treegrid after expanding all tags').toBeVisible();

    await page.getByRole('button', { name: 'Collapse all tags' }).click();

    await expect(page.getByRole('treegrid', { name: 'Account Tags' }), 'it shall display treegrid after collapsing all tags').toBeVisible();
  });

  test('refresh account tags flow', async function ({ page }) {
    await Promise.all([
      loadEmptyFixture(page),
      setupDatabase(tursoLibSQLiteServer()),
    ]);
    await page.evaluate(setupView, tursoLibSQLiteServer().url);

    await page.getByRole('link', { name: 'Books' }).click();
    await page.getByRole('tab', { name: 'Account Tags' }).click();

    await expect(page.getByRole('button', { name: 'Refresh account tags' }), 'it shall have refresh button').toBeVisible();

    await page.getByRole('button', { name: 'Refresh account tags' }).click();

    await expect(page.getByRole('treegrid', { name: 'Account Tags' }), 'it shall reload tags when refresh button is clicked').toBeVisible();
  });

  test('manage button visibility and tag assignment dialog flow', async function ({ page }) {
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
    await expect(manageButton, 'it shall have manage button for each tag').toBeVisible();

    const accountTagsTreegrid = page.getByRole('treegrid', { name: 'Account Tags' });
    const specificManageButton = accountTagsTreegrid.getByRole('button', { name: 'Manage Balance Sheet - Current Asset tag assignments' });
    await specificManageButton.click();

    const dialog = page.getByRole('dialog');
    await expect(dialog, 'it shall open assignment dialog when manage button is clicked').toBeVisible();

    const accountsGrid = dialog.getByRole('table', { name: 'Accounts list' });
    await expect(accountsGrid, 'it shall display accounts list in assignment dialog').toBeVisible();

    await expect(dialog.getByLabel('Search accounts'), 'it shall have search input in assignment dialog').toBeVisible();

    await dialog.getByRole('button').first().click();

    await expect(dialog, 'it shall close dialog when close button is clicked').not.toBeVisible();
  });
});
