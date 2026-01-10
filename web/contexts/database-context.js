import { createClient } from '@libsql/client/web';
import { reactive } from '@vue/reactivity';
import { html } from 'lit-html';

import { defineWebComponent } from '#web/component.js';
import { useBusyStateUntil } from '#web/contexts/ready-context.js';
import { RouterContextElement } from '#web/contexts/router-context.js';
import { useExposed } from '#web/hooks/use-exposed.js';
import { provideContext, useContext } from '#web/hooks/use-context.js';
import { useEffect } from '#web/hooks/use-effect.js';
import { useRender } from '#web/hooks/use-render.js';

/** @import { Client, TransactionMode } from '@libsql/client/web' */
/** @typedef {'init'|'unconfigured'|'connecting'|'connected'} DatabaseConnectionState */

export class DatabaseContextElement extends HTMLElement {
  constructor() {
    super();

    provideContext(this);

    const host = this;
    const router = useContext(host, RouterContextElement);

    const connection = reactive({
      state: /** @type {'init'|'unconfigured'|'connecting'|'connected'} */ ('init'),
      error: /** @type {Error} */ (undefined),
    });

    this.isReady = useExposed(host, function readConnectionReady() {
      return connection.state === 'unconfigured'
        || connection.state === 'connected';
    });

    this.state = useExposed(host, function readConnectionState() {
      return connection.state;
    });

    this.error = useExposed(host, function readConnectionError() {
      return connection.error;
    });

    useBusyStateUntil(host, function evaluteReadiness() {
      return connection.state === 'unconfigured'
        || connection.state === 'connected';
    });

    let isClientResolved = false;
    /** @type {PromiseWithResolvers<Client>} */
    const { promise: clientPromise, resolve: resolveClientInternal } = Promise.withResolvers();

    /** @param {Client} client */
    function resolveClient(client) {
      isClientResolved = true;
      resolveClientInternal(client);
    }

    /**
     * Connect to the database
     * @param {string} url turso database url
     * @param {string} authToken turso database auth key
     */
    async function connect(url, authToken) {
      if (isClientResolved) throw new DatabaseError('Database is already connected.');
      try {
        connection.state = 'connecting';
        connection.error = undefined;
        const client = url === ':memory:'
          ? createClient({ url: 'file::memory:?cache=shared' })
          : createClient({ url, authToken });
        await client.executeMultiple(`
          -- Commented out pragmas are not supported in Turso
          -- PRAGMA journal_mode = WAL;
          -- PRAGMA synchronous = FULL;
          PRAGMA foreign_keys = ON;
          -- PRAGMA temp_store = MEMORY;
          -- PRAGMA cache_size = -32000;
          -- PRAGMA mmap_size = 67108864;
        `);
        await autoMigrate(client);
        connection.state = 'connected';
        resolveClient(client);
      }
      catch (error) {
        connection.state = 'unconfigured';
        connection.error = new FailedToConnectDatabaseError('Failed to connect to the database', { cause: error });
        throw connection.error;
      }
    };

    this.connect = connect;

    /**
     * @param {Client} client
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
     * @param {Client} client
     * @param {string} path
     */
    async function migrate(client, path) {
      const migrationSQLResponse = await fetch(path);
      const migrationSQLText = await migrationSQLResponse.text();
      const tx = await client.transaction('write');
      try {
        tx.executeMultiple(migrationSQLText);
        await tx.commit();
      }
      catch (error) {
        console.error('Migration failed, rolling back transaction.', error);
        await tx.rollback();
        throw error;
      }
    }

    /**
     * @param {Client} client
     */
    async function getSchemaVersion(client) {
      try {
        const result = await client.execute('SELECT value FROM config WHERE key = ?', ['Schema Version']);
        if (result.rows.length === 0) return undefined;
        return /** @type {string} */ (result.rows[0].value);
      }
      catch (error) {
        if (error instanceof Error && error.message.includes('no such table: config')) return undefined;
        else throw error;
      }
    }

    useEffect(host, function evaluateExistingState() {
      if (connection.state === 'init' && router.route) {
        const { tursoDatabaseUrl, tursoDatabaseKey } = router.route;
        if (tursoDatabaseUrl) {
          connect(tursoDatabaseUrl, tursoDatabaseKey)
            .then(function connected() { connection.state = 'connected'; })
            .catch(function failedToConnect(error) {
              connection.state = 'unconfigured';
              connection.error = error;
            });
        }
        else {
          connection.state = 'unconfigured';
        }
      }
    });

    /**
     * @param {TransactionMode} mode
     */
    this.transaction = async function transaction(mode) {
      const client = await clientPromise;
      const tx = await client.transaction(mode);
      return {
        /**
         * @param {TemplateStringsArray} query
         * @param {Array<unknown>} params
         */
        async sql(query, ...params) {
          if (!Array.isArray(query)) throw new TypeError('Expected TemplateStringsArray as the first argument.');
          return tx.execute({
            sql: query.join('?'),
            args: params.map(function (param) {
              if (param === null || param === undefined) return null;
              else if (typeof param === 'number' || typeof param === 'string' || typeof param === 'boolean') return param;
              else return JSON.stringify(param);
            }),
          });
        },
        async commit() { await tx.commit(); },
        async rollback() { await tx.rollback(); },
      };
    };

    /**
     * Execute a SQLite query using tagged function template literals
     * Warning! The query implementor is responsible making sure proper use of template interpolations:
     * - The interpolated values shall be a SQL value in the query parameters.
     * - The interpolated values shall NOT be a SQL identifier or SQL keyword.
     * 
     * @param {TemplateStringsArray} query
     * @param {Array<unknown>} params
     */
    this.sql = async function sql(query, ...params) {
      if (!Array.isArray(query)) throw new TypeError('Expected TemplateStringsArray as the first argument.');
      const client = await clientPromise;
      return client.execute({
        sql: query.join('?'),
        args: params.map(function (param) {
          if (param === null || param === undefined) return null;
          else if (typeof param === 'number' || typeof param === 'string' || typeof param === 'boolean') return param;
          else return JSON.stringify(param);
        }),
      });
    };
  }
}

defineWebComponent('database-context', DatabaseContextElement);

export class DatabaseError extends Error { }
export class FailedToConnectDatabaseError extends DatabaseError { }
