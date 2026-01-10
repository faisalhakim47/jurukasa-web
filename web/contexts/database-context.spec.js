import { expect, test } from '@playwright/test';
import { loadEmptyFixture } from '#test/tools/fixture.js';
import { useTursoLibSQLiteServer } from '#test/hooks/use-turso-libsqlite-server.js';
import { useConsoleOutput } from '#test/hooks/use-console-output.js';
import { useStrict } from '#test/hooks/use-strict.js';

/** @import { DatabaseContextElement } from '#web/contexts/database-context.js' */

const { describe } = test;

describe('Database Context', function () {
  // useConsoleOutput(test);
  useStrict(test);

  describe('Connection State', function () {
    test('it shall provide connection state as unconfigured when no database configuration', async function ({ page }) {
      await loadEmptyFixture(page);

      await page.evaluate(function () {
        document.body.innerHTML = `
          <ready-context>
            <router-context>
              <database-context>
                <p>Slot content visible</p>
              </database-context>
            </router-context>
          </ready-context>
        `;
      });

      // Context should render slot content (no guard UI)
      await expect(page.getByText('Slot content visible')).toBeVisible();
    });
  });

  describe('Turso SQLite Provider', function () {
    const tursoLibSQLiteServer = useTursoLibSQLiteServer(test);

    test('it shall provide connected state after successful Turso connection', async function ({ page }) {
      await loadEmptyFixture(page);

      const tursoDatabaseUrl = tursoLibSQLiteServer().url;

      await page.evaluate(function setupContext(dbUrl) {
        document.body.innerHTML = `
          <ready-context>
            <router-context>
              <database-context provider="turso" turso-url="${dbUrl}">
                <p>Database Slot Content</p>
              </database-context>
            </router-context>
          </ready-context>
        `;
      }, tursoDatabaseUrl);

      // Wait for connection to complete by polling the state
      await expect.poll(async function () {
        return page.evaluate(async function () {
          await customElements.whenDefined('database-context');
          /** @type {DatabaseContextElement} */
          const db = document.querySelector('database-context');
          return db.state;
        });
      }, { timeout: 5000 }).toBe('connected');

      // Slot content should be visible
      await expect(page.getByText('Database Slot Content')).toBeVisible();
    });

    test('it shall expose connect method for programmatic Turso connection', async function ({ page }) {
      await loadEmptyFixture(page);

      await page.evaluate(function () {
        document.body.innerHTML = `
          <ready-context>
            <router-context>
              <database-context>
                <p>Content</p>
              </database-context>
            </router-context>
          </ready-context>
        `;
      });

      // Verify initial state is unconfigured
      const initialState = await page.evaluate(async function () {
        /** @type {DatabaseContextElement} */
        const db = document.querySelector('database-context');
        return db.state;
      });

      expect(initialState).toBe('unconfigured');

      // Connect programmatically using new API
      const finalState = await page.evaluate(async function connectToDatabase(tursoDatabaseUrl) {
        /** @type {DatabaseContextElement} */
        const db = document.querySelector('database-context');
        await db.connect({ provider: 'turso', url: tursoDatabaseUrl, authToken: '' });
        return { state: db.state, provider: db.provider };
      }, tursoLibSQLiteServer().url);

      expect(finalState.state).toBe('connected');
      expect(finalState.provider).toBe('turso');
    });

    test('it shall expose sql method for executing queries on Turso', async function ({ page }) {
      await loadEmptyFixture(page);

      const tursoDatabaseUrl = tursoLibSQLiteServer().url;

      await page.evaluate(function setupContext(dbUrl) {
        document.body.innerHTML = `
          <ready-context>
            <router-context>
              <database-context provider="turso" turso-url="${dbUrl}">
                <p>Ready</p>
              </database-context>
            </router-context>
          </ready-context>
        `;
      }, tursoDatabaseUrl);

      // Wait for connection to complete
      await expect.poll(async function () {
        return page.evaluate(async function () {
          await customElements.whenDefined('database-context');
          /** @type {DatabaseContextElement} */
          const db = document.querySelector('database-context');
          return db.state;
        });
      }, { timeout: 5000 }).toBe('connected');

      // Execute a query
      const result = await page.evaluate(async function () {
        /** @type {DatabaseContextElement} */
        const db = document.querySelector('database-context');
        const result = await db.sql`SELECT value FROM config WHERE key = 'Schema Version'`;
        return result.rows[0]?.value;
      });

      expect(result).toBe('005-fixed-assets');
    });

    test('it shall expose provider property after connection', async function ({ page }) {
      await loadEmptyFixture(page);

      await page.evaluate(function (tursoDatabaseUrl) {
        document.body.innerHTML = `
          <ready-context>
            <router-context>
              <database-context provider="turso" turso-url=${tursoDatabaseUrl}>
                <p>Content</p>
              </database-context>
            </router-context>
          </ready-context>
        `;
      }, tursoLibSQLiteServer().url);

      // Connect and verify provider is exposed
      const result = await page.evaluate(async function connectToDatabase(dbUrl) {
        await customElements.whenDefined('database-context');
        /** @type {DatabaseContextElement} */
        const db = document.querySelector('database-context');
        await new Promise((resolve) => setTimeout(resolve, 100));

        const providerBeforeConnect = db.provider;
        await db.connect({ provider: 'turso', url: dbUrl, authToken: '' });
        const providerAfterConnect = db.provider;

        return { before: providerBeforeConnect, after: providerAfterConnect };
      }, tursoLibSQLiteServer().url);

      expect(result.before).toBe(undefined);
      expect(result.after).toBe('turso');
    });
  });
});
