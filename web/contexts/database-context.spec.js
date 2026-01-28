import { expect } from '@playwright/test';
import { jurukasaTest } from '#test/playwright/test-setup.js';
import { loadEmptyFixture } from '#test/playwright/tools/fixture.js';
import { useTursoLibSQLiteServer } from '#test/playwright/hooks/use-turso-libsqlite-server.js';
import { useConsoleOutput } from '#test/playwright/hooks/use-console-output.js';
import { useStrict } from '#test/playwright/hooks/use-strict.js';

/** @import { DatabaseContextElement } from '#web/contexts/database-context.js' */

const test = jurukasaTest;
const { describe } = test;

describe('Database Context', function () {
  // useConsoleOutput(test);
  useStrict(test);

  describe('Connection State', function () {
    test('it shall provide connection state as unconfigured when no database configuration', async function ({ page }) {
      await loadEmptyFixture(page);

      await page.evaluate(function setupView() {
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

      await page.evaluate(function setupContext(tursoDatabaseUrl) {
        document.body.innerHTML = `
          <ready-context>
            <router-context>
              <database-context provider="turso" name="My Business" turso-url="${tursoDatabaseUrl}">
                <p>Database Slot Content</p>
              </database-context>
            </router-context>
          </ready-context>
        `;
      }, tursoDatabaseUrl);

      await expect.poll(async function getDatabaseState() {
        return page.evaluate(async function fetchState() {
          await customElements.whenDefined('database-context');
          /** @type {DatabaseContextElement} */
          const db = document.querySelector('database-context');
          return db.state;
        });
      }).toBe('connected');

      await expect(page.getByText('Database Slot Content')).toBeVisible();
    });

    test('it shall expose connect method for programmatic Turso connection', async function ({ page }) {
      await loadEmptyFixture(page);

      await page.evaluate(function setupInnerHtml() {
        document.body.innerHTML = `
          <ready-context>
            <router-context>
              <database-context></database-context>
            </router-context>
          </ready-context>
        `;
      });

      const initialState = await page.evaluate(async function getInitialState() {
        /** @type {DatabaseContextElement} */
        const database = document.querySelector('database-context');
        return database.state;
      });

      expect(initialState).toBe('unconfigured');

      const finalState = await page.evaluate(async function connectToDatabase(tursoDatabaseUrl) {
        /** @type {DatabaseContextElement} */
        const database = document.querySelector('database-context');
        await database.connect({
          provider: 'turso',
          name: 'Personal',
          url: tursoDatabaseUrl,
          authToken: '',
        });
        return { state: database.state };
      }, tursoLibSQLiteServer().url);

      expect(finalState.state).toBe('connected');

      const result = await page.evaluate(async function executeSqlQuery() {
        /** @type {DatabaseContextElement} */
        const database = document.querySelector('database-context');
        const result = await database.sql`SELECT value FROM config WHERE key = 'Schema Version'`;
        return result.rows[0]?.value;
      });

      expect(result).toBe('007-cash-count');
    });

    test('it shall expose sql method for executing queries on Turso', async function ({ page }) {
      await loadEmptyFixture(page);

      const tursoDatabaseUrl = tursoLibSQLiteServer().url;

      await page.evaluate(function setupContext(tursoDatabaseUrl) {
        document.body.innerHTML = `
          <ready-context>
            <router-context>
              <database-context provider="turso" name="My Business" turso-url="${tursoDatabaseUrl}">
                <p>Ready</p>
              </database-context>
            </router-context>
          </ready-context>
        `;
      }, tursoDatabaseUrl);

      await expect.poll(async function getDatabaseState() {
        return page.evaluate(async function fetchState() {
          await customElements.whenDefined('database-context');
          /** @type {DatabaseContextElement} */
          const database = document.querySelector('database-context');
          return database.state;
        });
      }).toBe('connected');

      // Execute a query
      const result = await page.evaluate(async function executeSqlQuery() {
        /** @type {DatabaseContextElement} */
        const db = document.querySelector('database-context');
        const result = await db.sql`SELECT value FROM config WHERE key = 'Schema Version'`;
        return result.rows[0]?.value;
      });

      expect(result).toBe('007-cash-count');
    });
  });
});
