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

/** @import { DatabaseClient, TransactionMode, TransactionClient, SQLFunction } from '#web/database.js' */

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
 *
 * @typedef {object} DatabaseEntry
 * @property {string} id
 * @property {DatabaseProvider} provider
 * @property {string} name
 * @property {string} [url]
 * @property {boolean} isActive
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

    /**
     * Extract a readable name from Turso database URL
     * @param {string} url
     * @returns {string}
     */
    function extractDatabaseNameFromUrl(url) {
      try {
        const urlObj = new URL(url);
        const hostname = urlObj.hostname;
        const parts = hostname.split('.');
        if (parts.length > 0) {
          const dbPart = parts[0];
          return dbPart.split('-')[0] || dbPart;
        }
        return 'Turso Database';
      }
      catch (error) {
        return 'Turso Database';
      }
    }

    /**
     * Get list of configured databases from localStorage
     * @returns {DatabaseEntry[]}
     */
    function getDatabaseList() {
      const currentProvider = localStorage.getItem('databaseProvider');
      const currentTursoUrl = localStorage.getItem('tursoUrl');

      /** @type {DatabaseEntry[]} */
      const databases = [];

      const localDatabaseExists = currentProvider === 'local' || localStorage.getItem('localDatabaseConfigured') === 'true';
      if (localDatabaseExists || currentProvider === 'local') databases
        .push({
          id: 'local',
          provider: 'local',
          name: 'Local Database',
          isActive: currentProvider === 'local',
        });

      const tursoDatabaseListJson = localStorage.getItem('tursoDatabaseList');
      if (tursoDatabaseListJson) {
        try {
          const tursoDatabaseList = JSON.parse(tursoDatabaseListJson);
          for (const tursoDatabase of tursoDatabaseList) databases
            .push({
              id: `turso-${tursoDatabase.url}`,
              provider: 'turso',
              name: tursoDatabase.name || extractDatabaseNameFromUrl(tursoDatabase.url),
              url: tursoDatabase.url,
              isActive: currentProvider === 'turso' && currentTursoUrl === tursoDatabase.url,
            });
        }
        catch (error) {
          console.error('Failed to parse Turso database list', error);
        }
      }
      else if (currentProvider === 'turso' && currentTursoUrl) databases
        .push({
          id: `turso-${currentTursoUrl}`,
          provider: 'turso',
          name: extractDatabaseNameFromUrl(currentTursoUrl),
          url: currentTursoUrl,
          isActive: true,
        });

      return databases;
    }

    this.getDatabaseList = getDatabaseList;

    /**
     * Add or update a Turso database in the list
     * @param {string} url
     * @param {string} [name]
     */
    function addTursoDatabase(url, name) {
      const tursoDatabaseListJson = localStorage.getItem('tursoDatabaseList');
      /** @type {Array<{url: string, name?: string}>} */
      let tursoDatabaseList = [];

      if (tursoDatabaseListJson) {
        try {
          tursoDatabaseList = JSON.parse(tursoDatabaseListJson);
        }
        catch (error) {
          console.error('Failed to parse Turso database list', error);
          tursoDatabaseList = [];
        }
      }

      const existingIndex = tursoDatabaseList.findIndex(function (db) {
        return db.url === url;
      });

      const databaseEntry = { url, name: name || extractDatabaseNameFromUrl(url) };

      if (existingIndex >= 0) {
        tursoDatabaseList[existingIndex] = databaseEntry;
      }
      else {
        tursoDatabaseList.push(databaseEntry);
      }

      localStorage.setItem('tursoDatabaseList', JSON.stringify(tursoDatabaseList));
      localStorage.setItem('databaseProvider', 'turso');
      localStorage.setItem('tursoUrl', url);
    }

    this.addTursoDatabase = addTursoDatabase;

    /**
     * Remove a Turso database from the list
     * @param {string} url
     */
    function removeTursoDatabase(url) {
      const tursoDatabaseListJson = localStorage.getItem('tursoDatabaseList');
      if (!tursoDatabaseListJson) return;

      try {
        /** @type {Array<{url: string, name?: string}>} */
        const tursoDatabaseList = JSON.parse(tursoDatabaseListJson);
        const filteredList = tursoDatabaseList.filter(function (db) {
          return db.url !== url;
        });
        localStorage.setItem('tursoDatabaseList', JSON.stringify(filteredList));
      }
      catch (error) {
        console.error('Failed to parse Turso database list', error);
      }
    }

    this.removeTursoDatabase = removeTursoDatabase;

    /**
     * Set the active database
     * @param {DatabaseEntry} database
     */
    function setActiveDatabase(database) {
      if (database.provider === 'local') {
        localStorage.setItem('databaseProvider', 'local');
        localStorage.setItem('localDatabaseConfigured', 'true');
        localStorage.removeItem('tursoUrl');
      }
      else if (database.provider === 'turso' && database.url) {
        localStorage.setItem('databaseProvider', 'turso');
        localStorage.setItem('tursoUrl', database.url);
      }
    }

    this.setActiveDatabase = setActiveDatabase;

    /**
     * Get the currently active database entry
     * @returns {DatabaseEntry|null}
     */
    function getActiveDatabase() {
      const databases = getDatabaseList();
      return databases.find(function (db) { return db.isActive; }) || null;
    }

    this.getActiveDatabase = getActiveDatabase;

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

      // optionally apply hotfix here
      if (config.provider === 'local') {
        try {
          const serviceWorkerContext = getContextValue(host, ServiceWorkerContextElement);
          await serviceWorkerContext.hotfixSqlite3OpfsAsyncProxy();
        }
        catch (error) {
          // console.debug('service-worker-context', 'connect', error);
        }
      }

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
        /** @type {DatabaseConfig} */
        let databaseConfig;
        if (false) { }
        else if (providerAttr.value === 'local') databaseConfig = { provider: 'local' };
        else if (providerAttr.value === 'turso' && tursoURLAttr.value) databaseConfig = {
          provider: 'turso',
          url: tursoURLAttr.value,
          authToken: tursoAuthTokenAttr.value || undefined,
        };
        else if (router.route.databaseConfig?.provider === 'local') databaseConfig = { provider: 'local' };
        else if (router.route.databaseConfig?.provider === 'turso') databaseConfig = {
          provider: 'turso',
          url: router.route.databaseConfig.url,
          authToken: router.route.databaseConfig.authToken || undefined,
        };
        else connection.state = 'unconfigured';

        if (databaseConfig) {
          /** @todo reorganize this database management */
          if (databaseConfig.provider === 'local') {
            localStorage.setItem('databaseProvider', 'local');
            localStorage.setItem('localDatabaseConfigured', 'true');
          }
          else if (databaseConfig.provider === 'turso') {
            addTursoDatabase(databaseConfig.url);
          }
          else throw new Error('The implement is isolated logic, see above. This case should be impossible.');

          connect(databaseConfig);
        }
      }
    });
  }
}

defineWebComponent('database-context', DatabaseContextElement);

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
