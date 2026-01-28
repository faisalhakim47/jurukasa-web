import { reactive } from '@vue/reactivity';

import { defineWebComponent } from '#web/component.js';
import { useBusyStateUntil } from '#web/contexts/ready-context.js';
import { RouterContextElement } from '#web/contexts/router-context.js';
import { useExposed } from '#web/hooks/use-exposed.js';
import { provideContext, useContext } from '#web/hooks/use-context.js';
import { useEffect } from '#web/hooks/use-effect.js';
import { useAttribute } from '#web/hooks/use-attribute.js';
import { createTursoDatabaseClient } from '#web/databases/turso.js';
import { createLocalDatabaseClient } from '#web/databases/local.js';
import { getContextValue } from '#web/context.js';
import { ServiceWorkerContextElement } from '#web/contexts/service-worker-context.js';
import { useConnectedCallback } from '#web/hooks/use-lifecycle.js';

/** @import { DatabaseClient, TransactionMode, TransactionClient, SQLFunction } from '#web/database.js' */

/**
 * @typedef {'init'|'unconfigured'|'connecting'|'connected'} ConnectionState
 */

/**
 * @typedef {object} LocalDatabaseConfig
 * @property {'local'} provider
 * @property {string} name
 */

/**
 * @typedef {object} TursoDatabaseConfig
 * @property {'turso'} provider
 * @property {string} name
 * @property {string} url
 * @property {string} [authToken]
 */

/**
 * @typedef {LocalDatabaseConfig|TursoDatabaseConfig} DatabaseConfig
 */

export class DatabaseError extends Error { }
export class FailedToConnectDatabaseError extends DatabaseError { }

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
      'name',
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
      state: /** @type {ConnectionState} */ ('init'),
      error: /** @type {Error} */ (undefined),
      client: /** @type {DatabaseClient|undefined} */ (undefined),
      databases: /** @type {DatabaseConfig[]} */ ([]),
    });

    useConnectedCallback(host, function loadDatabases() {
      connection.databases = getDatabases();
    });

    useBusyStateUntil(host, function evaluteReadiness() {
      return connection.state === 'unconfigured'
        || connection.state === 'connected';
    });

    this.isReady = useExposed(host, function getConnectionReady() {
      return connection.state === 'unconfigured'
        || connection.state === 'connected';
    });

    this.state = useExposed(host, function getConnectionState() {
      return connection.state;
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

    /**
     * @param {DatabaseConfig} config
     */
    async function connect(config) {
      // console.debug('database-context', 'connect', JSON.stringify(config));

      connection.state = 'connecting';
      connection.client = undefined;
      connection.error = undefined;

      // optionally apply sqlite3 opfs hotfix here
      if (config.provider === 'local') {
        try {
          const serviceWorkerContext = getContextValue(host, ServiceWorkerContextElement);
          await serviceWorkerContext.hotfixSqlite3OpfsAsyncProxy();
        }
        catch (error) {
          // console.debug('service-worker-context', 'connect', error);
        }
      }

      try {
        addDatabase(config);
        const client = await initiateDatabase(config);
        connection.state = 'connected';
        connection.client = client;
      }
      catch (error) {
        removeDatabaseByName(config.name);
        connection.state = 'unconfigured';
        connection.error = error;
      }
    }
    this.connect = connect;

    /** @type {function(TransactionMode):Promise<TransactionClient>} */
    async function transaction(mode) {
      const client = await promisedClient;
      return client.transaction(mode);
    }
    this.transaction = transaction;

    /** @type {SQLFunction} */
    async function sql(query, ...params) {
      const client = await promisedClient;
      return client.sql(query, ...params);
    }
    this.sql = sql;

    const providerAttr = useAttribute(host, 'provider');
    const nameAttr = useAttribute(host, 'name');
    const tursoUrlAttr = useAttribute(host, 'turso-url');
    const tursoAuthTokenAttr = useAttribute(host, 'turso-auth-token');

    useEffect(host, function evaluateExistingState() {
      // console.debug('database-context', 'evaluateExistingState', connection.state, JSON.stringify(router.route));
      if (connection.state === 'init' && router.route) {
        let config = /** @type {DatabaseConfig} */ (undefined);

        if (false) { }
        else if (providerAttr.value === 'local') config = {
          provider: 'local',
          name: nameAttr.value,
        };
        else if (providerAttr.value === 'turso' && tursoUrlAttr.value) config = {
          provider: 'turso',
          name: nameAttr.value,
          url: tursoUrlAttr.value,
          authToken: tursoAuthTokenAttr.value || undefined,
        };
        else if (router.route.database?.provider) config = router.route.database;
        else connection.state = 'unconfigured';

        // console.debug('database-context', 'evaluateExistingState', connection.state, router.route?.pathname, router.route?.database?.provider);

        if (config) connect(config);
      }
    });

    this.getDatabases = getDatabases;
  }
}

defineWebComponent('database-context', DatabaseContextElement);

/** @returns {Array<DatabaseConfig>} */
function getDatabases() {
  const databases = JSON.parse(localStorage.getItem('databases') || '[]');
  return databases;
}

/**
 * @param {DatabaseConfig} newDatabase
 */
function addDatabase(newDatabase) {
  const databases = getDatabases();
  const existingDatabase = databases.find(function byName(existingDatabase) {
    return existingDatabase.name === newDatabase.name;
  });
  if (existingDatabase) throw new Error('Database name already in use');
  databases.push(newDatabase);
  localStorage.setItem('databases', JSON.stringify(databases));
}

/** @param {string} name */
function removeDatabaseByName(name) {
  const databases = getDatabases();
  const index = databases.findIndex(function byName(existingDatabase) {
    return existingDatabase.name === name;
  });
  if (index === -1) return;
  databases.splice(index, 1);
  localStorage.setItem('databases', JSON.stringify(databases));
}

/** @param {DatabaseConfig} config */
async function initiateDatabase(config) {
  try {
    const client = await createDatabaseClient(config);
    await client.connect();
    await autoMigrate(client);
    return client;
  }
  catch (error) {
    // console.debug('Error during database initiation', error);
    throw new FailedToConnectDatabaseError('Failed to connect to the database', { cause: error });
  }
}

/**
 * @param {DatabaseConfig} config
 * @returns {Promise<DatabaseClient>}
 */
async function createDatabaseClient(config) {
  if (config.provider === 'local') return createLocalDatabaseClient();
  else if (config.provider === 'turso') return createTursoDatabaseClient(config);
  else throw new DatabaseError(`Unknown database provider: ${/** @type {any} */ (config).provider}`);
}

/**
 * @param {DatabaseClient} client
 */
async function autoMigrate(client) {
  const schemaVersion = await getSchemaVersion(client);
  if (schemaVersion === '007-cash-count') return; // Already latest schema
  else if (schemaVersion === '006-account-reconciliation') {
    await migrate(client, '/web/schemas/007-cash-count.sql');
  }
  else if (schemaVersion === '005-fixed-assets') {
    await migrate(client, '/web/schemas/006-account-reconciliation.sql');
    await migrate(client, '/web/schemas/007-cash-count.sql');
  }
  else if (schemaVersion === '004-revenue-tracking') {
    await migrate(client, '/web/schemas/005-fixed-assets.sql');
    await migrate(client, '/web/schemas/006-account-reconciliation.sql');
    await migrate(client, '/web/schemas/007-cash-count.sql');
  }
  else if (schemaVersion === '003-chart-of-accounts') {
    await migrate(client, '/web/schemas/004-revenue-tracking.sql');
    await migrate(client, '/web/schemas/005-fixed-assets.sql');
    await migrate(client, '/web/schemas/006-account-reconciliation.sql');
    await migrate(client, '/web/schemas/007-cash-count.sql');
  }
  else if (schemaVersion === '002-pos') {
    await migrate(client, '/web/schemas/003-chart-of-accounts.sql');
    await migrate(client, '/web/schemas/004-revenue-tracking.sql');
    await migrate(client, '/web/schemas/005-fixed-assets.sql');
    await migrate(client, '/web/schemas/006-account-reconciliation.sql');
    await migrate(client, '/web/schemas/007-cash-count.sql');
  }
  else if (schemaVersion === '001-accounting') {
    await migrate(client, '/web/schemas/002-pos.sql');
    await migrate(client, '/web/schemas/003-chart-of-accounts.sql');
    await migrate(client, '/web/schemas/004-revenue-tracking.sql');
    await migrate(client, '/web/schemas/005-fixed-assets.sql');
    await migrate(client, '/web/schemas/006-account-reconciliation.sql');
    await migrate(client, '/web/schemas/007-cash-count.sql');
  }
  else if (schemaVersion === undefined) {
    await migrate(client, '/web/schemas/001-accounting.sql');
    await migrate(client, '/web/schemas/002-pos.sql');
    await migrate(client, '/web/schemas/003-chart-of-accounts.sql');
    await migrate(client, '/web/schemas/004-revenue-tracking.sql');
    await migrate(client, '/web/schemas/005-fixed-assets.sql');
    await migrate(client, '/web/schemas/006-account-reconciliation.sql');
    await migrate(client, '/web/schemas/007-cash-count.sql');
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
    else {
      console.error('Failed to get schema version', error);
      throw error;
    }
  }
}
