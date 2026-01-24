import { beforeEach } from 'node:test';
import { useLibSQLiteClient } from '#test/nodejs/hooks/use-libsqlite-client.js';

export function useAccountingDatabase() {
  const getClient = useLibSQLiteClient();

  beforeEach(async function beforeUsingAccountingDatabase() {
    const client = await getClient().promise;

    // Setup chart of accounts
    await client.execute(`INSERT INTO chart_of_accounts_templates (name) VALUES ('Retail Business - Indonesia')`);

    // Create a fixed fiscal year for predictable testing
    const beginTime = new Date(2025, 0, 1, 0, 0, 0, 0).getTime(); // 1 Jan 2025
    const endTime = new Date(2026, 0, 1, 0, 0, 0, 0).getTime(); // 1 Jan 2026
    await client.execute(`INSERT INTO fiscal_years (begin_time, end_time, name) VALUES (${beginTime}, ${endTime}, 'FY2026')`);
  });

  return getClient;
}
