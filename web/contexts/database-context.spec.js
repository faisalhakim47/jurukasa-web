import { expect } from '@playwright/test';
import { jurukasaTest } from '#test/playwright/test-setup.js';
import { loadEmptyFixture } from '#test/playwright/tools/fixture.js';
import { useTursoLibSQLiteServer } from '#test/playwright/hooks/use-turso-libsqlite-server.js';
import { useConsoleOutput } from '#test/playwright/hooks/use-console-output.js';
import { useStrict } from '#test/playwright/hooks/use-strict.js';

/** @import { DatabaseContextElement } from '#web/contexts/database-context.js' */

const test = jurukasaTest;
const { describe } = test;

async function setupUnconfiguredView() {
  document.body.innerHTML = `
    <ready-context>
      <router-context>
        <database-context>
          <p>Slot content visible</p>
        </database-context>
      </router-context>
    </ready-context>
  `;
}

async function setupTursoView(tursoDatabaseUrl) {
  document.body.innerHTML = `
    <ready-context>
      <router-context>
        <database-context provider="turso" name="My Business" turso-url="${tursoDatabaseUrl}">
          <p>Database Slot Content</p>
        </database-context>
      </router-context>
    </ready-context>
  `;
}

async function getDatabaseState() {
  await customElements.whenDefined('database-context');
  /** @type {DatabaseContextElement} */
  const db = document.querySelector('database-context');
  return db.state;
}

async function setupConnectView() {
  document.body.innerHTML = `
    <ready-context>
      <router-context>
        <database-context></database-context>
      </router-context>
    </ready-context>
  `;
}

async function getInitialState() {
  /** @type {DatabaseContextElement} */
  const database = document.querySelector('database-context');
  return database.state;
}

async function connectToDatabase(tursoDatabaseUrl) {
  /** @type {DatabaseContextElement} */
  const database = document.querySelector('database-context');
  await database.connect({
    provider: 'turso',
    name: 'Personal',
    url: tursoDatabaseUrl,
    authToken: '',
  });
  return { state: database.state };
}

async function executeSqlQuery() {
  /** @type {DatabaseContextElement} */
  const database = document.querySelector('database-context');
  const result = await database.sql`SELECT value FROM config WHERE key = 'Schema Version'`;
  return result.rows[0]?.value;
}

describe('Database Context', function () {
  useConsoleOutput(test);
  useStrict(test);
  const tursoLibSQLiteServer = useTursoLibSQLiteServer(test);

  test('it shall provide unconfigured state when no database configuration', async function ({ page }) {
    await loadEmptyFixture(page);

    await page.evaluate(setupUnconfiguredView);

    await expect(page.getByText('Slot content visible'), 'it shall render slot content when unconfigured').toBeVisible();
  });

  test('it shall provide connected state after successful Turso connection', async function ({ page }) {
    await loadEmptyFixture(page);

    const tursoDatabaseUrl = tursoLibSQLiteServer().url;

    await page.evaluate(setupTursoView, tursoDatabaseUrl);

    await expect.poll(async function pollDatabaseState() {
      return page.evaluate(getDatabaseState);
    }, 'it shall reach connected state').toBe('connected');

    await expect(page.getByText('Database Slot Content'), 'it shall render slot content when connected').toBeVisible();
  });

  test('it shall expose connect method for programmatic Turso connection', async function ({ page }) {
    await loadEmptyFixture(page);

    await page.evaluate(setupConnectView);

    const initialState = await page.evaluate(getInitialState);

    expect(initialState, 'it shall start in unconfigured state').toBe('unconfigured');

    const finalState = await page.evaluate(connectToDatabase, tursoLibSQLiteServer().url);

    expect(finalState.state, 'it shall transition to connected state after connect').toBe('connected');

    const result = await page.evaluate(executeSqlQuery);

    expect(result, 'it shall execute SQL queries and return schema version').toBe('007-cash-count');
  });

  test('it shall expose sql method for executing queries on Turso', async function ({ page }) {
    await loadEmptyFixture(page);

    const tursoDatabaseUrl = tursoLibSQLiteServer().url;

    await page.evaluate(setupTursoView, tursoDatabaseUrl);

    await expect.poll(async function pollDatabaseState() {
      return page.evaluate(getDatabaseState);
    }, 'it shall reach connected state').toBe('connected');

    const result = await page.evaluate(executeSqlQuery);

    expect(result, 'it shall execute SQL query and return correct schema version').toBe('007-cash-count');
  });
});
