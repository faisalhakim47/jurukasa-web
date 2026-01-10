import { reactive } from '@vue/reactivity';

import { defineWebComponent } from '#web/component.js';
import { useBusyStateUntil } from '#web/contexts/ready-context.js';
import { RouterContextElement } from '#web/contexts/router-context.js';
import { useExposed } from '#web/hooks/use-exposed.js';
import { provideContext, useContext } from '#web/hooks/use-context.js';
import { useEffect } from '#web/hooks/use-effect.js';
import { useAttribute } from '#web/hooks/use-attribute.js';

/** @import { Client } from '@libsql/client' */

/**
 * @typedef {'local'|'turso'} DatabaseProvider
 * @typedef {'init'|'unconfigured'|'connecting'|'connected'} DatabaseConnectionState
 * 
 * @typedef {object} LocalDatabaseConfig
 * @property {'local'} provider
 * 
 * @typedef {object} TursoDatabaseConfig
 * @property {'turso'} provider
 * @property {string} url
 * @property {string} [authToken]
 * 
 * @typedef {LocalDatabaseConfig|TursoDatabaseConfig} DatabaseConfig
 */

/**
 * Database context preload config with following priorities:
 * 1. Element attributes
 * 2. Router context route config
 * 3. localStorage
 * 4. Default to 'unconfigured' state
 */
export class DatabaseContextElement extends HTMLElement {
  static get observedAttributes() {
    return [
      'provider',
      'turso-url',
      'turso-auth-token',
    ];
  }

  constructor() {
    super();

    provideContext(this);

    const host = this;
    const router = useContext(host, RouterContextElement);

    const connection = reactive({
      state: /** @type {DatabaseConnectionState} */ ('init'),
      error: /** @type {Error} */ (undefined),
      provider: /** @type {DatabaseProvider|undefined} */ (undefined),
      client: /** @type {DatabaseClient|undefined} */ (undefined),
    });

    this.isReady = useExposed(host, function getConnectionReady() {
      return connection.state === 'unconfigured'
        || connection.state === 'connected';
    });

    this.provider = useExposed(host, function getConnectionProvider() {
      return connection.provider;
    });

    this.state = useExposed(host, function getConnectionState() {
      return connection.state;
    });

    this.error = useExposed(host, function getConnectionError() {
      return connection.error;
    });

    /** @type {PromiseWithResolvers<DatabaseClient>} */
    let { promise: promisedClient, resolve: resolveClient } = Promise.withResolvers();
    let isPromisedClientResolved = false;
    useEffect(host, function monitorClientAvailability() {
      if (connection.client) {
        if (isPromisedClientResolved) promisedClient = Promise.resolve(connection.client);
        else {
          isPromisedClientResolved = true;
          resolveClient(connection.client);
        }
      }
    });

    /** @type {function(TransactionMode):Promise<TransactionClient>} */
    this.transaction = async function transaction(mode) {
      const client = await promisedClient;
      return client.transaction(mode);
    };

    /** @type {SQLFunction} */
    this.sql = async function sql(query, ...params) {
      const client = await promisedClient;
      return client.sql(query, ...params);
    };

    /** @param {DatabaseConfig} config */
    async function connect(config) {
      connection.state = 'connecting';
      connection.error = undefined;
      await initiateDatabase(config)
        .then(function connected(client) {
          connection.state = 'connected';
          connection.provider = config.provider;
          connection.client = client;
        })
        .catch(function failedToConnect(error) {
          connection.state = 'unconfigured';
          connection.error = error;
        });
    };

    this.connect = connect;

    useBusyStateUntil(host, function evaluteReadiness() {
      return connection.state === 'unconfigured'
        || connection.state === 'connected';
    });

    const providerAttr = useAttribute(host, 'provider');
    const tursoURLAttr = useAttribute(host, 'turso-url');
    const tursoAuthTokenAttr = useAttribute(host, 'turso-auth-token');

    useEffect(host, function evaluateExistingState() {
      if (connection.state === 'init' && router.route) {
        if (providerAttr.value === 'local') connect({ provider: 'local' });
        else if (providerAttr.value === 'turso') connect({
          provider: 'turso',
          url: tursoURLAttr.value || '',
          authToken: tursoAuthTokenAttr.value || undefined,
        });
        else if (router.route.databaseConfig) connect(router.route.databaseConfig);
        else connection.state = 'unconfigured';
      }
    });
  }
}

defineWebComponent('database-context', DatabaseContextElement);

export class DatabaseError extends Error { }
export class FailedToConnectDatabaseError extends DatabaseError { }

/** @param {DatabaseConfig} config */
async function initiateDatabase(config) {
  try {
    const client = await createDatabaseClient(config);
    if (typeof client.executeMultiple === 'function') await client.executeMultiple(`
      -- Commented out pragmas are not supported in Turso
      -- PRAGMA journal_mode = WAL;
      -- PRAGMA synchronous = FULL;
      PRAGMA foreign_keys = ON;
      -- PRAGMA temp_store = MEMORY;
      -- PRAGMA cache_size = -32000;
      -- PRAGMA mmap_size = 67108864;
    `);
    else {
      // Commented out pragmas are not supported in Turso
      // await client.sql`PRAGMA journal_mode = WAL;`;
      // await client.sql`PRAGMA synchronous = FULL;`;
      await client.sql`PRAGMA foreign_keys = ON;`;
      // await client.sql`PRAGMA temp_store = MEMORY;`;
      // await client.sql`PRAGMA cache_size = -32000;`;
      // await client.sql`PRAGMA mmap_size = 67108864;`;
    } 
    await autoMigrate(client);
    return client;
  }
  catch (error) {
    console.warn('Database connection failed', error);
    throw new FailedToConnectDatabaseError('Failed to connect to the database', { cause: error });
  }
}

/**
 * @param {DatabaseConfig} config
 * @returns {Promise<DatabaseClient>}
 */
async function createDatabaseClient(config) {
  if (config.provider === 'local') return createLocalClient();
  else if (config.provider === 'turso') return createTursoClient(config.url, config.authToken ?? '');
  else throw new DatabaseError(`Unknown database provider: ${/** @type {any} */ (config).provider}`);
}

/**
 * @param {DatabaseClient} client
 */
async function autoMigrate(client) {
  const schemaVersion = await getSchemaVersion(client);
  if (schemaVersion === '005-fixed-assets') return; // Already latest schema
  else if (schemaVersion === '004-revenue-tracking') {
    await migrate(client, '/web/schemas/005-fixed-assets.sql');
  }
  else if (schemaVersion === '003-chart-of-accounts') {
    await migrate(client, '/web/schemas/004-revenue-tracking.sql');
    await migrate(client, '/web/schemas/005-fixed-assets.sql');
  }
  else if (schemaVersion === '002-pos') {
    await migrate(client, '/web/schemas/003-chart-of-accounts.sql');
    await migrate(client, '/web/schemas/004-revenue-tracking.sql');
    await migrate(client, '/web/schemas/005-fixed-assets.sql');
  }
  else if (schemaVersion === '001-accounting') {
    await migrate(client, '/web/schemas/002-pos.sql');
    await migrate(client, '/web/schemas/003-chart-of-accounts.sql');
    await migrate(client, '/web/schemas/004-revenue-tracking.sql');
    await migrate(client, '/web/schemas/005-fixed-assets.sql');
  }
  else if (schemaVersion === undefined) {
    await migrate(client, '/web/schemas/001-accounting.sql');
    await migrate(client, '/web/schemas/002-pos.sql');
    await migrate(client, '/web/schemas/003-chart-of-accounts.sql');
    await migrate(client, '/web/schemas/004-revenue-tracking.sql');
    await migrate(client, '/web/schemas/005-fixed-assets.sql');
  }
}

/**
 * @param {DatabaseClient} client
 * @param {string} path
 */
async function migrate(client, path) {
  const migrationSQLResponse = await fetch(path);
  const migrationSQLText = await migrationSQLResponse.text();
  const tx = await client.transaction('write');
  try {
    if (typeof tx.executeMultiple === 'function') await tx.executeMultiple(migrationSQLText);
    else {
      const statements = cleanupMigrationSQLText(migrationSQLText);
      for (const statement of statements) await tx.sql(
        /**
         * @type {any} I don't like it, but a bit of "any" work-around is fine in this case.
         *  We can't expose `execute` interface for risk to be used outside database internal.
         *  I consider this database context as internal implementation detail, so the reason why the "any" cast necessary is very clear.
         */
        ([statement]),
      );
    }
    await tx.commit();
  }
  catch (error) {
    console.error('Migration failed, rolling back transaction.', error);
    await tx.rollback();
    throw error;
  }
}

/**
 * @param {string} queries
 * @returns {Array<string>}
 */
function cleanupMigrationSQLText(queries) {
  return queries
    .split('-- EOS')
    .map(function (statement) {
      return statement
        .trim()
        .split('\n')
        .map(function (line) {
          return line.split('-- ')[0]; // Remove inline comments
        })
        .filter(function (line) { return line.length > 0; })
        .join('\n')
        .trim();
    })
    .filter(function (statement) { return statement.length > 0; });
}

/**
 * @param {DatabaseClient} client
 */
async function getSchemaVersion(client) {
  try {
    const result = await client.sql`SELECT value FROM config WHERE key = 'Schema Version'`;
    if (result.rows.length === 0) return undefined;
    return /** @type {string} */ (result.rows[0].value);
  }
  catch (error) {
    if (error instanceof Error && error.message.includes('no such table: config')) return undefined;
    else throw error;
  }
}

/**
 * @typedef {object} SQLResult
 * @property {Array<{[column: string]: unknown}>} rows
 * @property {number} rowsAffected
 * @property {number} lastInsertRowid
 */

/**
 * Execute a SQLite query using tagged function template literals
 * Warning! The query implementor is responsible making sure proper use of template interpolations:
 * - The interpolated values shall be a SQL value in the query parameters.
 * - The interpolated values shall NOT be a SQL identifier or SQL keyword.
 * 
 * @typedef {function(TemplateStringsArray, ...unknown): Promise<SQLResult>} SQLFunction
 */

/**
 * @typedef {object} TransactionClient
 * @property {SQLFunction} sql
 * @property {function(string): Promise<void>} [executeMultiple] this is optional interface for provider that supports it
 * @property {function(): Promise<void>} commit
 * @property {function(): Promise<void>} rollback
 */

/**
 * @typedef {'read'|'write'} TransactionMode
 */

/**
 * @typedef {object} DatabaseClient
 * @property {function():Promise<void>} connect
 * @property {SQLFunction} sql
 * @property {function(string): Promise<void>} [executeMultiple] this is optional interface for provider that supports it
 * @property {function(TransactionMode): Promise<TransactionClient>} transaction
 */

/** @returns {Promise<DatabaseClient>} */
export async function createLocalClient() {
  const { createClient } = await import('@libsql/client-wasm');
  const client = createClient({ url: 'file:jurukasa.db' });
  return createTursoBasedClient(client);
}

/**
 * @param {string} url
 * @param {string} authToken
 * @returns {Promise<DatabaseClient>}
 */
export async function createTursoClient(url, authToken) {
  const { createClient } = await import('@libsql/client/web');
  const client = createClient({ url, authToken });
  return createTursoBasedClient(client);
}

/**
 * @param {Client} client
 * @returns {Promise<DatabaseClient>}
 */
export async function createTursoBasedClient(client) {
  return {
    async connect() { await client.execute('SELECT 1'); },
    async executeMultiple(queries) { await client.executeMultiple(queries); },
    async sql(query, ...params) {
      assertTemplateStringsArray(query);
      const result = await client.execute({ sql: query.join('?'), args: paramsCorrection(params) });
      return {
        rows: result.rows,
        rowsAffected: result.rowsAffected,
        lastInsertRowid: Number(result.lastInsertRowid),
      };
    },
    async transaction(mode) {
      const tx = await client.transaction(mode);
      return {
        async executeMultiple(queries) { await tx.executeMultiple(queries); },
        async sql(query, ...params) {
          assertTemplateStringsArray(query);
          const result = await tx.execute({ sql: query.join('?'), args: paramsCorrection(params) });
          return {
            rows: result.rows,
            rowsAffected: result.rowsAffected,
            lastInsertRowid: Number(result.lastInsertRowid),
          };
        },
        async commit() { await tx.commit(); },
        async rollback() { await tx.rollback(); },
      };
    },
  };
}

/**
 * @param {unknown} query
 * @returns {asserts query is TemplateStringsArray}
 */
function assertTemplateStringsArray(query) {
  if (!Array.isArray(query)) throw new TypeError('Expected TemplateStringsArray as the first argument.');
}

/**
 * preprocess sql query parameters
 * @param {Array<unknown>} params
 */
function paramsCorrection(params) {
  return params.map(function correction(param) {
    if (param === null || param === undefined) return null;
    else if (typeof param === 'number' || typeof param === 'string' || typeof param === 'boolean') return param;
    else return JSON.stringify(param);
  });
}
