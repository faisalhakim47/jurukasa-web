import { useConsoleOutput } from '#test/playwright/hooks/use-console-output.js';
import { useStrict } from '#test/playwright/hooks/use-strict.js';
import { jurukasaTest } from '#test/playwright/test-setup.js';
import { loadEmptyFixture } from '#test/playwright/tools/fixture.js';
import { expect } from 'playwright/test';

const test = jurukasaTest;
const { describe } = test;

async function loadWorker1Client() {
  const { createSqlite3Worker1Client } = await import('#web/thirdparties/sqlite3-worker1-client.js');
  const client = createSqlite3Worker1Client();
  await client.ready;
  const opened = await client.open({ filename: 'database.sqlite', vfs: 'opfs' });
  await client.exec(opened.dbId, {
    sql: `CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT)`,
    bind: [],
  });
  await client.exec(opened.dbId, {
    sql: `INSERT INTO users (name) VALUES ('Alice'), (?), ('Jhon'), (?)`,
    bind: ['Bob', 'Stella'],
  });
  const users = await client.exec(opened.dbId, {
    sql: `SELECT * FROM users`,
    bind: [],
    rowMode: 'object',
  });
  return users;
}

describe('SQLite3 Worker1 Client', function () {
  useConsoleOutput(test);
  useStrict(test);

  test('it shall load worker1', async function ({ page }) {
    await loadEmptyFixture(page);
    const result = await page.evaluate(loadWorker1Client);
    expect(result.resultRows.length).toBe(4);
  });
});
