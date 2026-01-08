import { test, expect } from '@playwright/test';
import { useTursoLibSQLiteServer } from '#test/hooks/use-turso-libsqlite-server.js';
import { loadEmptyFixture } from '#test/tools/fixture.js';

/** @import { DatabaseContextElement } from '#web/contexts/database-context.js' */

const { describe } = test;

describe('Stock Taking Creation View', function () {
  const tursoLibSQLiteServer = useTursoLibSQLiteServer(test);

  /**
   * Helper function to setup test data
   * @param {import('@playwright/test').Page} page
   */
  async function setupTestData(page) {
    await page.evaluate(async function () {
      /** @type {DatabaseContextElement} */
      const database = document.querySelector('database-context');

      // Create accounts
      await database.sql`
        INSERT INTO accounts (account_code, name, normal_balance, create_time, update_time)
        VALUES
          (11110, 'Inventory Account', 0, 0, 0),
          (41110, 'Inventory Gain', 1, 0, 0),
          (51110, 'Inventory Shrinkage', 0, 0, 0)
      `;

      await database.sql`
        INSERT INTO account_tags (account_code, tag)
        VALUES
          (11110, 'POS - Inventory'),
          (41110, 'POS - Inventory Gain'),
          (51110, 'POS - Inventory Shrinkage')
      `;

      // Create inventories (with zero cost and stock to avoid balance constraint)
      await database.sql`
        INSERT INTO inventories (id, name, unit_price, unit_of_measurement, account_code)
        VALUES
          (1, 'Product A', 10000, 'piece', 11110),
          (2, 'Product B', 20000, 'piece', 11110),
          (3, 'Product C', 15000, 'unit', 11110)
      `;
    });
  }

  test('it shall display page header and description', async function ({ page }) {
    await loadEmptyFixture(page);

    await page.evaluate(async function (tursoDatabaseUrl) {
      localStorage.setItem('tursoDatabaseUrl', tursoDatabaseUrl);
      localStorage.setItem('tursoDatabaseKey', '');

      document.body.innerHTML = `
        <ready-context>
          <router-context>
            <database-context>
              <device-context>
                <i18n-context>
                  <stock-taking-creation-view></stock-taking-creation-view>
                </i18n-context>
              </device-context>
            </database-context>
          </router-context>
        </ready-context>
      `;
    }, tursoLibSQLiteServer().url);

    await setupTestData(page);

    // Verify page header is visible
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    
    // Verify info message is displayed
    await expect(page.getByText(/stock taking/i)).toBeVisible();
  });

  test('it shall display empty state when no inventories exist', async function ({ page }) {
    await loadEmptyFixture(page);

    await page.evaluate(async function (tursoDatabaseUrl) {
      localStorage.setItem('tursoDatabaseUrl', tursoDatabaseUrl);
      localStorage.setItem('tursoDatabaseKey', '');

      document.body.innerHTML = `
        <ready-context>
          <router-context>
            <database-context>
              <device-context>
                <i18n-context>
                  <stock-taking-creation-view></stock-taking-creation-view>
                </i18n-context>
              </device-context>
            </database-context>
          </router-context>
        </ready-context>
      `;
    }, tursoLibSQLiteServer().url);

    // Don't setup test data, leave database empty
    await page.evaluate(async function () {
      /** @type {DatabaseContextElement} */
      const database = document.querySelector('database-context');

      // Create accounts only
      await database.sql`
        INSERT INTO accounts (account_code, name, normal_balance, create_time, update_time)
        VALUES (11110, 'Inventory Account', 0, 0, 0)
      `;

      await database.sql`
        INSERT INTO account_tags (account_code, tag)
        VALUES (11110, 'POS - Inventory')
      `;
    });

    // Verify empty state is displayed
    await expect(page.getByText(/no inventories found/i)).toBeVisible();
  });

  test('it shall display inventories list', async function ({ page }) {
    await loadEmptyFixture(page);

    await page.evaluate(async function (tursoDatabaseUrl) {
      localStorage.setItem('tursoDatabaseUrl', tursoDatabaseUrl);
      localStorage.setItem('tursoDatabaseKey', '');

      document.body.innerHTML = `
        <ready-context>
          <router-context>
            <database-context>
              <device-context>
                <i18n-context>
                  <stock-taking-creation-view></stock-taking-creation-view>
                </i18n-context>
              </device-context>
            </database-context>
          </router-context>
        </ready-context>
      `;
    }, tursoLibSQLiteServer().url);

    await setupTestData(page);

    // Verify inventories table is visible
    await expect(page.getByRole('table')).toBeVisible();
    
    // Verify product names are displayed
    await expect(page.getByText('Product A')).toBeVisible();
    await expect(page.getByText('Product B')).toBeVisible();
    await expect(page.getByText('Product C')).toBeVisible();
  });

  test('it shall display stock quantities for each inventory', async function ({ page }) {
    await loadEmptyFixture(page);

    await page.evaluate(async function (tursoDatabaseUrl) {
      localStorage.setItem('tursoDatabaseUrl', tursoDatabaseUrl);
      localStorage.setItem('tursoDatabaseKey', '');

      document.body.innerHTML = `
        <ready-context>
          <router-context>
            <database-context>
              <device-context>
                <i18n-context>
                  <stock-taking-creation-view></stock-taking-creation-view>
                </i18n-context>
              </device-context>
            </database-context>
          </router-context>
        </ready-context>
      `;
    }, tursoLibSQLiteServer().url);

    await setupTestData(page);

    const inventoriesTable = page.getByRole('table');
    
    // Verify stock quantities are displayed
    await expect(inventoriesTable.getByText('100')).toBeVisible();
    await expect(inventoriesTable.getByText('50')).toBeVisible();
    await expect(inventoriesTable.getByText('75')).toBeVisible();
  });

  test('it shall display audit button for each inventory', async function ({ page }) {
    await loadEmptyFixture(page);

    await page.evaluate(async function (tursoDatabaseUrl) {
      localStorage.setItem('tursoDatabaseUrl', tursoDatabaseUrl);
      localStorage.setItem('tursoDatabaseKey', '');

      document.body.innerHTML = `
        <ready-context>
          <router-context>
            <database-context>
              <device-context>
                <i18n-context>
                  <stock-taking-creation-view></stock-taking-creation-view>
                </i18n-context>
              </device-context>
            </database-context>
          </router-context>
        </ready-context>
      `;
    }, tursoLibSQLiteServer().url);

    await setupTestData(page);

    // Verify audit buttons are visible
    const auditButtons = page.getByRole('button', { name: /audit/i });
    await expect(auditButtons.first()).toBeVisible();
    
    // Should have 3 audit buttons (one for each product)
    await expect(auditButtons).toHaveCount(3);
  });

  test('it shall display audit status for inventories never audited', async function ({ page }) {
    await loadEmptyFixture(page);

    await page.evaluate(async function (tursoDatabaseUrl) {
      localStorage.setItem('tursoDatabaseUrl', tursoDatabaseUrl);
      localStorage.setItem('tursoDatabaseKey', '');

      document.body.innerHTML = `
        <ready-context>
          <router-context>
            <database-context>
              <device-context>
                <i18n-context>
                  <stock-taking-creation-view></stock-taking-creation-view>
                </i18n-context>
              </device-context>
            </database-context>
          </router-context>
        </ready-context>
      `;
    }, tursoLibSQLiteServer().url);

    await setupTestData(page);

    // Verify "Never" audit status is displayed for items without latest_stock_taking_time
    await expect(page.getByText(/never/i).first()).toBeVisible();
  });

  test('it shall display audit status for recently audited inventories', async function ({ page }) {
    await loadEmptyFixture(page);

    await page.evaluate(async function (tursoDatabaseUrl) {
      localStorage.setItem('tursoDatabaseUrl', tursoDatabaseUrl);
      localStorage.setItem('tursoDatabaseKey', '');

      document.body.innerHTML = `
        <ready-context>
          <router-context>
            <database-context></database-context>
          </router-context>
        </ready-context>
      `;

      /** @type {DatabaseContextElement} */
      const database = document.querySelector('database-context');

      // Create accounts
      await database.sql`
        INSERT INTO accounts (account_code, name, normal_balance, create_time, update_time)
        VALUES (11110, 'Inventory Account', 0, 0, 0)
      `;

      await database.sql`
        INSERT INTO account_tags (account_code, tag)
        VALUES (11110, 'POS - Inventory')
      `;

      // Create inventory with recent audit (within 7 days)
      const recentTime = Date.now() - (3 * 24 * 60 * 60 * 1000); // 3 days ago
      await database.sql`
        INSERT INTO inventories (id, name, unit_price, unit_of_measurement, account_code, latest_stock_taking_time)
        VALUES (1, 'Product A', 10000, 'piece', 11110, ${recentTime})
      `;

      document.body.innerHTML = `
        <ready-context>
          <router-context>
            <database-context>
              <device-context>
                <i18n-context>
                  <stock-taking-creation-view></stock-taking-creation-view>
                </i18n-context>
              </device-context>
            </database-context>
          </router-context>
        </ready-context>
      `;
    }, tursoLibSQLiteServer().url);

    // Verify "Recent" audit status is displayed
    await expect(page.getByText(/recent/i)).toBeVisible();
  });

  test('it shall display audit status for overdue inventories', async function ({ page }) {
    await loadEmptyFixture(page);

    await page.evaluate(async function (tursoDatabaseUrl) {
      localStorage.setItem('tursoDatabaseUrl', tursoDatabaseUrl);
      localStorage.setItem('tursoDatabaseKey', '');

      document.body.innerHTML = `
        <ready-context>
          <router-context>
            <database-context></database-context>
          </router-context>
        </ready-context>
      `;

      /** @type {DatabaseContextElement} */
      const database = document.querySelector('database-context');

      // Create accounts
      await database.sql`
        INSERT INTO accounts (account_code, name, normal_balance, create_time, update_time)
        VALUES (11110, 'Inventory Account', 0, 0, 0)
      `;

      await database.sql`
        INSERT INTO account_tags (account_code, tag)
        VALUES (11110, 'POS - Inventory')
      `;

      // Create inventory with overdue audit (over 30 days)
      const overdueTime = Date.now() - (40 * 24 * 60 * 60 * 1000); // 40 days ago
      await database.sql`
        INSERT INTO inventories (id, name, unit_price, unit_of_measurement, account_code, latest_stock_taking_time)
        VALUES (1, 'Product A', 10000, 'piece', 11110, ${overdueTime})
      `;

      document.body.innerHTML = `
        <ready-context>
          <router-context>
            <database-context>
              <device-context>
                <i18n-context>
                  <stock-taking-creation-view></stock-taking-creation-view>
                </i18n-context>
              </device-context>
            </database-context>
          </router-context>
        </ready-context>
      `;
    }, tursoLibSQLiteServer().url);

    // Verify "Overdue" audit status is displayed
    await expect(page.getByText(/overdue/i)).toBeVisible();
  });

  test('it shall filter inventories by search query', async function ({ page }) {
    await loadEmptyFixture(page);

    await page.evaluate(async function (tursoDatabaseUrl) {
      localStorage.setItem('tursoDatabaseUrl', tursoDatabaseUrl);
      localStorage.setItem('tursoDatabaseKey', '');

      document.body.innerHTML = `
        <ready-context>
          <router-context>
            <database-context>
              <device-context>
                <i18n-context>
                  <stock-taking-creation-view></stock-taking-creation-view>
                </i18n-context>
              </device-context>
            </database-context>
          </router-context>
        </ready-context>
      `;
    }, tursoLibSQLiteServer().url);

    await setupTestData(page);

    // Verify all products are initially visible
    await expect(page.getByText('Product A')).toBeVisible();
    await expect(page.getByText('Product B')).toBeVisible();
    await expect(page.getByText('Product C')).toBeVisible();
    
    // Enter search query
    await page.getByLabel(/search/i).fill('Product A');

    // Verify only Product A is visible
    await expect(page.getByText('Product A')).toBeVisible();
    await expect(page.getByText('Product B')).not.toBeVisible();
    await expect(page.getByText('Product C')).not.toBeVisible();
  });

  test('it shall display pagination controls when inventories exceed page size', async function ({ page }) {
    await loadEmptyFixture(page);

    await page.evaluate(async function (tursoDatabaseUrl) {
      localStorage.setItem('tursoDatabaseUrl', tursoDatabaseUrl);
      localStorage.setItem('tursoDatabaseKey', '');

      document.body.innerHTML = `
        <ready-context>
          <router-context>
            <database-context></database-context>
          </router-context>
        </ready-context>
      `;

      /** @type {DatabaseContextElement} */
      const database = document.querySelector('database-context');

      // Create accounts
      await database.sql`
        INSERT INTO accounts (account_code, name, normal_balance, create_time, update_time)
        VALUES (11110, 'Inventory Account', 0, 0, 0)
      `;

      await database.sql`
        INSERT INTO account_tags (account_code, tag)
        VALUES (11110, 'POS - Inventory')
      `;

      // Create 25 test inventories (page size is 20)
      for (let i = 1; i <= 25; i++) {
        await database.sql`
          INSERT INTO inventories (id, name, unit_price, unit_of_measurement, account_code)
          VALUES (${i}, ${'Product ' + i}, 10000, 'piece', 11110)
        `;
      }

      document.body.innerHTML = `
        <ready-context>
          <router-context>
            <database-context>
              <device-context>
                <i18n-context>
                  <stock-taking-creation-view></stock-taking-creation-view>
                </i18n-context>
              </device-context>
            </database-context>
          </router-context>
        </ready-context>
      `;
    }, tursoLibSQLiteServer().url);

    // Wait for table to load
    await expect(page.getByRole('table')).toBeVisible();

    // Verify pagination controls are visible
    await expect(page.getByRole('navigation', { name: 'Pagination' })).toBeVisible();
    await expect(page.getByText('Showing 1–20 of 25')).toBeVisible();
    
    // Verify first page products are visible
    await expect(page.getByText('Product 1')).toBeVisible();
    await expect(page.getByText('Product 20')).toBeVisible();
    
    // Product 21 should not be visible on first page
    await expect(page.getByText('Product 21')).not.toBeVisible();

    // Navigate to next page
    await page.getByRole('button', { name: /next page/i }).click();

    // Verify second page content
    await expect(page.getByText('Showing 21–25 of 25')).toBeVisible();
    await expect(page.getByText('Product 21')).toBeVisible();
    await expect(page.getByText('Product 25')).toBeVisible();
    
    // Product 1 should not be visible on second page
    await expect(page.getByText('Product 1')).not.toBeVisible();
  });

  test('it shall allow navigating to first page', async function ({ page }) {
    await loadEmptyFixture(page);

    await page.evaluate(async function (tursoDatabaseUrl) {
      localStorage.setItem('tursoDatabaseUrl', tursoDatabaseUrl);
      localStorage.setItem('tursoDatabaseKey', '');

      document.body.innerHTML = `
        <ready-context>
          <router-context>
            <database-context></database-context>
          </router-context>
        </ready-context>
      `;

      /** @type {DatabaseContextElement} */
      const database = document.querySelector('database-context');

      // Create accounts
      await database.sql`
        INSERT INTO accounts (account_code, name, normal_balance, create_time, update_time)
        VALUES (11110, 'Inventory Account', 0, 0, 0)
      `;

      await database.sql`
        INSERT INTO account_tags (account_code, tag)
        VALUES (11110, 'POS - Inventory')
      `;

      // Create 25 test inventories
      for (let i = 1; i <= 25; i++) {
        await database.sql`
          INSERT INTO inventories (id, name, unit_price, unit_of_measurement, account_code)
          VALUES (${i}, ${'Product ' + i}, 10000, 'piece', 11110)
        `;
      }

      document.body.innerHTML = `
        <ready-context>
          <router-context>
            <database-context>
              <device-context>
                <i18n-context>
                  <stock-taking-creation-view></stock-taking-creation-view>
                </i18n-context>
              </device-context>
            </database-context>
          </router-context>
        </ready-context>
      `;
    }, tursoLibSQLiteServer().url);

    // Wait for table to load
    await expect(page.getByRole('table')).toBeVisible();

    // Navigate to next page
    await page.getByRole('button', { name: /next page/i }).click();
    await expect(page.getByText('Showing 21–25 of 25')).toBeVisible();

    // Navigate back to first page
    await page.getByRole('button', { name: /first page/i }).click();

    // Verify first page content
    await expect(page.getByText('Showing 1–20 of 25')).toBeVisible();
    await expect(page.getByText('Product 1')).toBeVisible();
  });

  test('it shall refresh inventories list when refresh button is clicked', async function ({ page }) {
    await loadEmptyFixture(page);

    await page.evaluate(async function (tursoDatabaseUrl) {
      localStorage.setItem('tursoDatabaseUrl', tursoDatabaseUrl);
      localStorage.setItem('tursoDatabaseKey', '');

      document.body.innerHTML = `
        <ready-context>
          <router-context>
            <database-context>
              <device-context>
                <i18n-context>
                  <stock-taking-creation-view></stock-taking-creation-view>
                </i18n-context>
              </device-context>
            </database-context>
          </router-context>
        </ready-context>
      `;
    }, tursoLibSQLiteServer().url);

    await setupTestData(page);

    // Wait for initial load
    await expect(page.getByRole('table')).toBeVisible();
    await expect(page.getByText('Product A')).toBeVisible();

    // Add a new inventory via database
    await page.evaluate(async function () {
      /** @type {DatabaseContextElement} */
      const database = document.querySelector('database-context');
      
      await database.sql`
        INSERT INTO inventories (id, name, unit_price, unit_of_measurement, account_code)
        VALUES (4, 'Product D', 25000, 'piece', 11110)
      `;
    });

    // Click refresh button
    await page.getByRole('button', { name: /refresh/i }).click();

    // Verify new inventory appears
    await expect(page.getByText('Product D')).toBeVisible();
  });

  test('it shall display cost information for each inventory', async function ({ page }) {
    await loadEmptyFixture(page);

    await page.evaluate(async function (tursoDatabaseUrl) {
      localStorage.setItem('tursoDatabaseUrl', tursoDatabaseUrl);
      localStorage.setItem('tursoDatabaseKey', '');

      document.body.innerHTML = `
        <ready-context>
          <router-context>
            <database-context>
              <device-context>
                <i18n-context>
                  <stock-taking-creation-view></stock-taking-creation-view>
                </i18n-context>
              </device-context>
            </database-context>
          </router-context>
        </ready-context>
      `;
    }, tursoLibSQLiteServer().url);

    await setupTestData(page);

    const inventoriesTable = page.getByRole('table');
    
    // Verify cost values are displayed (in IDR format)
    await expect(inventoriesTable.getByText(/5,000/)).toBeVisible();
    await expect(inventoriesTable.getByText(/10,000/)).toBeVisible();
  });

  test('it shall display last audit date when available', async function ({ page }) {
    await loadEmptyFixture(page);

    await page.evaluate(async function (tursoDatabaseUrl) {
      localStorage.setItem('tursoDatabaseUrl', tursoDatabaseUrl);
      localStorage.setItem('tursoDatabaseKey', '');

      document.body.innerHTML = `
        <ready-context>
          <router-context>
            <database-context></database-context>
          </router-context>
        </ready-context>
      `;

      /** @type {DatabaseContextElement} */
      const database = document.querySelector('database-context');

      // Create accounts
      await database.sql`
        INSERT INTO accounts (account_code, name, normal_balance, create_time, update_time)
        VALUES (11110, 'Inventory Account', 0, 0, 0)
      `;

      await database.sql`
        INSERT INTO account_tags (account_code, tag)
        VALUES (11110, 'POS - Inventory')
      `;

      // Create inventory with specific audit timestamp (Jan 1, 2025)
      const timestamp = new Date('2025-01-01T10:00:00Z').getTime();
      await database.sql`
        INSERT INTO inventories (id, name, unit_price, unit_of_measurement, account_code, latest_stock_taking_time)
        VALUES (1, 'Product A', 10000, 'piece', 11110, ${timestamp})
      `;

      document.body.innerHTML = `
        <ready-context>
          <router-context>
            <database-context>
              <device-context>
                <i18n-context>
                  <stock-taking-creation-view></stock-taking-creation-view>
                </i18n-context>
              </device-context>
            </database-context>
          </router-context>
        </ready-context>
      `;
    }, tursoLibSQLiteServer().url);

    // Wait for table to load
    await expect(page.getByRole('table')).toBeVisible();
    
    // Verify date is formatted (the exact format depends on i18n configuration)
    const dateCell = page.getByText(/2025|Jan|01/i);
    await expect(dateCell).toBeVisible();
  });
});
