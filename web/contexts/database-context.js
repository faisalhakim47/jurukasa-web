import { createClient } from '@libsql/client/web';
import { reactive } from '@vue/reactivity';
import { html } from 'lit-html';

import { defineWebComponent } from '#web/component.js';
import { useAdoptedStyleSheets } from '#web/hooks/use-adopted-style-sheets.js';
import { useBusyStateUntil } from '#web/contexts/ready-context.js';
import { RouterContextElement } from '#web/contexts/router-context.js';
import { useExposed } from '#web/hooks/use-exposed.js';
import { provideContext, useContext } from '#web/hooks/use-context.js';
import { useEffect } from '#web/hooks/use-effect.js';
import { useRender } from '#web/hooks/use-render.js';
import { webStyleSheets } from '#web/styles.js';
import { feedbackDelay } from '#web/tools/timing.js';

/** @import { Client, TransactionMode } from '@libsql/client/web' */
/** @typedef {'init'|'unconfigured'|'connecting'|'connected'} DatabaseConnectionState */

export class DatabaseContextElement extends HTMLElement {
  constructor() {
    super();

    provideContext(this);

    const host = this;
    const router = useContext(host, RouterContextElement);
    const render = useRender(host);
    useAdoptedStyleSheets(host, webStyleSheets);

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

    useBusyStateUntil(host, function evaluteReadiness() {
      return connection.state === 'unconfigured'
        || connection.state === 'connected';
    });

    const form = reactive({
      state: /** @type {'ready'|'submitting'|'failure'|'success'} */ ('ready'),
      errorMessage: /** @type {string} */ (undefined),
    });

    let isClientResolved = false;
    /** @type {PromiseWithResolvers<Client>} */
    const { promise: clientPromise, resolve: resolveClientInternal } = Promise.withResolvers();

    /** @param {Client} client */
    function resolveClient(client) {
      isClientResolved = true;
      resolveClientInternal(client);
    };

    /**
     * @param {string} url turso database url
     * @param {string} authToken turso database auth key
     */
    const connect = async function (url, authToken) {
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
        connection.error = new FailedToConnectDatabaseError('Failed to connect to the database', { cause: error });
        throw connection.error;
      }
    };

    /**
     * @param {Client} client
     */
    const autoMigrate = async function (client) {
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
    };

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
    };

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
    };

    /** @param {SubmitEvent} event */
    async function submitDatabaseConfig(event) {
      try {
        event.preventDefault();
        form.state = 'submitting';
        const formEl = /** @type {HTMLFormElement} */ (event.target);
        const tursoDatabaseUrl = formEl.elements['turso-database-url'].value;
        const tursoDatabaseKey = formEl.elements['turso-database-key'].value;
        await connect(tursoDatabaseUrl, tursoDatabaseKey);
        form.state = 'success';
        await feedbackDelay();
        router.navigate({
          pathname: router.route.pathname,
          tursoDatabaseKey,
          tursoDatabaseUrl,
          replace: true,
        });
      }
      catch (error) {
        form.state = 'failure';
        form.errorMessage = error.message;
        await feedbackDelay();
        form.state = 'ready';
      }
    };

    /** @param {SubmitEvent} event */
    function resetDatabaseConfig(event) {
      event.preventDefault();
      router.navigate({
        pathname: router.route.pathname,
        tursoDatabaseKey: undefined,
        tursoDatabaseUrl: undefined,
        replace: true,
      });
      connection.state = 'unconfigured';
      connection.error = undefined;
    };

    useEffect(host, function evaluateExistingState() {
      if (connection.state === 'init' && router.route) {
        const { tursoDatabaseUrl, tursoDatabaseKey } = router.route;
        if (tursoDatabaseUrl) {
          connect(tursoDatabaseUrl, tursoDatabaseKey)
            .then(function connected() { connection.state = 'connected'; })
            .catch(function failedToConect(error) {
              connection.state = 'unconfigured';
              connection.error = error;
            });
        }
        else {
          connection.state = 'unconfigured';
        }
      }
    });

    useEffect(host, function renderDatabaseGuard() {
      if (connection.state === 'init') render(html`
        <p>Initializing database...</p>
      `);
      else if (connection.state === 'unconfigured' || connection.state === 'connecting') {
        const formState = form.state;
        const formDisabled = formState !== 'ready';
        const submitButtonText = formState === 'ready' ? 'Configure'
          : formState === 'submitting' ? 'Connecting...'
            : formState === 'success' ? 'Connected'
              : formState === 'failure' ? 'Failed'
                : 'Configure';
        render(html`
          <dialog
            class="full-screen"
            aria-labelledby="configure-database-title"
            aria-describedby="configure-database-description"
            open
          >
            <form method="dialog" class="container" ?disabled=${formDisabled} @submit=${submitDatabaseConfig}>

              <header>
                <h3 id="configure-database-title">Configure Database</h3>
                <button role="button" type="submit">${submitButtonText}</button>
              </header>

              <div class="content">
                <p>Configure your Turso database connection by providing the database URL and authentication key.</p>

                <div class="outlined-text-field">
                  <div class="container">
                    <label for="turso-database-url">Turso Database URL</label>
                    <input
                      id="turso-database-url"
                      name="turso-database-url"
                      type="text"
                      autocomplete="off"
                      required
                      ?disabled=${formDisabled}
                      placeholder="Turso Database URL"
                      aria-describedby="turso-database-url-description"
                    />
                  </div>
                  <p id="turso-database-url-description" class="supporting-text">The URL of your Turso database instance, typically starting with "https://".</p>
                </div>
                <div class="outlined-text-field">
                  <div class="container">
                    <label for="turso-database-key">Turso Database Auth Key</label>
                    <input
                      id="turso-database-key"
                      name="turso-database-key"
                      type="password"
                      autocomplete="off"
                      ?disabled=${formDisabled}
                      placeholder="Turso Database Auth Key"
                      aria-describedby="turso-database-key-description"
                    />
                  </div>
                  <p class="supporting-text" id="turso-database-key-description">The authentication token required to access your Turso database.</p>
                </div>
              </div>

            </form>
          </dialog>
        `);
      }
      else if (connection.state === 'connected') render(html`
        <slot></slot>
      `);
      else if (connection.error instanceof Error) render(html`
        <form @submit=${resetDatabaseConfig}>
          <p class="error">Database connection error: ${connection.error.message}</p>
          <button role="button" type="submit">Reset Database Configuration</button>
        </form>
      `);
      else render(html`
        <form @submit=${resetDatabaseConfig}>
          <p class="error">Unknown database connection state...</p>
          <button role="button" type="submit">Reset Database Configuration</button>
        </form>
      `);
    });

    /**
     * @param {TransactionMode} mode
     */
    this.transaction = async function (mode) {
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
