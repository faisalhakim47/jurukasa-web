import { expect, test } from '@playwright/test';
import { loadEmptyFixture } from '#test/tools/fixture.js';
import { useTursoLibSQLiteServer } from '#test/hooks/use-turso-libsqlite-server.js';
const { describe } = test;

describe('Database Context', function () {
  const tursoLibSQLiteServer = useTursoLibSQLiteServer(test);

  test('it shall provide connection state as unconfigured when no database URL', async function ({ page }) {
    await loadEmptyFixture(page);

    await page.evaluate(function () {
      document.body.innerHTML = `
        <router-context>
          <database-context>
            <p>Slot content visible</p>
          </database-context>
        </router-context>
      `;
    });

    // Context should render slot content (no guard UI)
    await expect(page.getByText('Slot content visible')).toBeVisible();
  });

  test('it shall provide connected state after successful connection', async function ({ page }) {
    await loadEmptyFixture(page);

    const tursoDatabaseUrl = tursoLibSQLiteServer().url;

    await page.evaluate(function setupContext(dbUrl) {
      localStorage.setItem('tursoDatabaseUrl', dbUrl);
      localStorage.setItem('tursoDatabaseKey', '');
      document.body.innerHTML = `
        <router-context>
          <database-context>
            <p>Database Slot Content</p>
          </database-context>
        </router-context>
      `;
    }, tursoDatabaseUrl);

    // Wait for connection to complete by polling the state
    await expect.poll(async function () {
      return page.evaluate(async function () {
        await customElements.whenDefined('database-context');
        /** @type {import('#web/contexts/database-context.js').DatabaseContextElement} */
        const db = document.querySelector('database-context');
        return db.state;
      });
    }, { timeout: 5000 }).toBe('connected');

    // Slot content should be visible
    await expect(page.getByText('Database Slot Content')).toBeVisible();
  });

  test('it shall expose connect method for programmatic connection', async function ({ page }) {
    await loadEmptyFixture(page);

    const tursoDatabaseUrl = tursoLibSQLiteServer().url;

    await page.evaluate(function () {
      document.body.innerHTML = `
        <router-context>
          <database-context>
            <p>Content</p>
          </database-context>
        </router-context>
      `;
    });

    // Verify initial state is unconfigured
    const initialState = await page.evaluate(async function () {
      await customElements.whenDefined('database-context');
      /** @type {import('#web/contexts/database-context.js').DatabaseContextElement} */
      const db = document.querySelector('database-context');
      // Wait for state to settle
      await new Promise(resolve => setTimeout(resolve, 100));
      return db.state;
    });

    expect(initialState).toBe('unconfigured');

    // Connect programmatically
    const finalState = await page.evaluate(async function connectToDb(dbUrl) {
      /** @type {import('#web/contexts/database-context.js').DatabaseContextElement} */
      const db = document.querySelector('database-context');
      await db.connect(dbUrl, '');
      return db.state;
    }, tursoDatabaseUrl);

    expect(finalState).toBe('connected');
  });

  test('it shall expose sql method for executing queries', async function ({ page }) {
    await loadEmptyFixture(page);

    const tursoDatabaseUrl = tursoLibSQLiteServer().url;

    await page.evaluate(function setupContext(dbUrl) {
      localStorage.setItem('tursoDatabaseUrl', dbUrl);
      localStorage.setItem('tursoDatabaseKey', '');
      document.body.innerHTML = `
        <router-context>
          <database-context>
            <p>Ready</p>
          </database-context>
        </router-context>
      `;
    }, tursoDatabaseUrl);

    // Wait for connection to complete
    await expect.poll(async function () {
      return page.evaluate(async function () {
        await customElements.whenDefined('database-context');
        /** @type {import('#web/contexts/database-context.js').DatabaseContextElement} */
        const db = document.querySelector('database-context');
        return db.state;
      });
    }, { timeout: 5000 }).toBe('connected');

    // Execute a query
    const result = await page.evaluate(async function () {
      /** @type {import('#web/contexts/database-context.js').DatabaseContextElement} */
      const db = document.querySelector('database-context');
      const result = await db.sql`SELECT value FROM config WHERE key = 'Schema Version'`;
      return result.rows[0]?.value;
    });

    expect(result).toBe('005-fixed-assets');
  });
});
