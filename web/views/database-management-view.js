import { computed, reactive } from '@vue/reactivity';
import { html, nothing } from 'lit-html';
import { repeat } from 'lit-html/directives/repeat.js';

import { defineWebComponent } from '#web/component.js';
import { DatabaseContextElement } from '#web/contexts/database-context.js';
import { RouterContextElement } from '#web/contexts/router-context.js';
import { useAdoptedStyleSheets } from '#web/hooks/use-adopted-style-sheets.js';
import { useContext } from '#web/hooks/use-context.js';
import { useDialog } from '#web/hooks/use-dialog.js';
import { useEffect } from '#web/hooks/use-effect.js';
import { useElement } from '#web/hooks/use-element.js';
import { useMounted } from '#web/hooks/use-mounted.js';
import { useRender } from '#web/hooks/use-render.js';
import { useLiteral, useTranslator } from '#web/hooks/use-translator.js';
import { webStyleSheets } from '#web/styles.js';
import { assertInstanceOf } from '#web/tools/assertion.js';

import '#web/components/material-symbols.js';

/** @import { DatabaseConfig } from '#web/contexts/database-context.js' */

/**
 * @typedef {object} DatabaseModel
 * @property {boolean} isActive
 */

/** @typedef {DatabaseConfig & DatabaseModel} DatabaseViewModel */

/**
 * Database Management View displays a list of configured databases
 * and provides actions to manage them (info, use, export).
 */
export class DatabaseManagementViewElement extends HTMLElement {
  constructor() {
    super();

    const host = this;
    const database = useContext(host, DatabaseContextElement);
    const router = useContext(host, RouterContextElement);
    const l = useLiteral(host);
    const t = useTranslator(host);

    const render = useRender(host);
    useAdoptedStyleSheets(host, webStyleSheets);

    const state = reactive({
      isLoading: /** @type {boolean} */ (true),
      databases: /** @type {DatabaseViewModel[]} */ ([]),
      selectedDatabase: /** @type {DatabaseViewModel|null} */ (null),
      errors: /** @type {Array<Error>} */ ([]),
    });

    const infoDialog = useElement(host, HTMLDialogElement);
    const switchDialog = useElement(host, HTMLDialogElement);
    const errorDialog = useElement(host, HTMLDialogElement);

    const displayedError = computed(function firstError() {
      return state.errors.at(0);
    });

    useEffect(host, function displayStackedErrors() {
      if (state.errors.length > 0) errorDialog.value?.showModal();
    });

    function loadDatabaseList() {
      try {
        state.isLoading = true;
        state.databases = database.getDatabases().map(function toViewModel(database) {
          return {
            ...database,
            isActive: database.name === state.selectedDatabase?.name,
          };
        });
      }
      catch (error) {
        state.errors.push(error);
      }
      finally {
        state.isLoading = false;
      }
    }

    useMounted(host, loadDatabaseList);

    function handleNewDatabaseClick() {
      const previousRouteState = structuredClone(router.route);

      router.navigate({
        pathname: '/database-setup',
        database: undefined,
        replace: false,
      });

      sessionStorage.setItem('previousRouteState', JSON.stringify(previousRouteState));
    }

    /** @param {Event} event */
    function handleInfoClick(event) {
      assertInstanceOf(HTMLButtonElement, event.currentTarget);
      const databaseName = event.currentTarget.dataset.databaseName;
      const selectedDatabase = state.databases.find(function byName(database) {
        return database.name === databaseName;
      });
      if (selectedDatabase) {
        state.selectedDatabase = selectedDatabase;
        assertInstanceOf(HTMLDialogElement, infoDialog.value);
        infoDialog.value.dispatchEvent(new CommandEvent('command', { command: 'show-modal' }));
      }
    }

    /** @param {Event} event */
    function handleUseClick(event) {
      assertInstanceOf(HTMLButtonElement, event.currentTarget);
      const databaseName = event.currentTarget.dataset.databaseName;
      const selectedDatabase = state.databases.find(function byName(database) {
        return database.name === databaseName;
      });
      if (selectedDatabase && !selectedDatabase.isActive) {
        state.selectedDatabase = selectedDatabase;
        assertInstanceOf(HTMLDialogElement, infoDialog.value);
        switchDialog.value.dispatchEvent(new CommandEvent('command', { command: 'show-modal' }));
      }
    }

    function handleSwitchConfirm() {
      if (state.selectedDatabase?.provider) {
        router.navigate({
          pathname: '/dashboard',
          search: router.route.search,
          database: state.selectedDatabase,
          replace: true,
        });
      }
    }

    function handleSwitchCancel() {
      assertInstanceOf(HTMLDialogElement, switchDialog.value);
      switchDialog.value.dispatchEvent(new CommandEvent('command', { command: 'close' }));
      state.selectedDatabase = null;
    }

    /** @param {Event} event */
    async function handleExportClick(event) {
      assertInstanceOf(HTMLButtonElement, event.currentTarget);
      const databaseName = event.currentTarget.dataset.databaseName;
      const selectedDatabase = state.databases.find(function byName(database) {
        return database.name === databaseName;
      });

      try {
        if (selectedDatabase?.provider === 'local') {
          const root = await navigator.storage.getDirectory();
          const files = [];
          for await (const [name, handle] of root.entries()) {
            if (name.includes('jurukasa') && handle.kind === 'file') {
              const file = await handle.getFile();
              files.push({ name, file });
            }
          }
          if (files.length > 0) {
            const { name, file } = files[0];
            const blob = new Blob([await file.arrayBuffer()], { type: 'application/octet-stream' });
            const url = URL.createObjectURL(blob);
            const anchor = document.createElement('a');
            anchor.href = url;
            anchor.download = `jurukasa-${name}-${new Date().toISOString().split('T')[0]}.sqlite`;
            anchor.click();
            URL.revokeObjectURL(url);
          }
          else state.errors.push(new Error('No database file found for export'));
        }
        else state.errors.push(new Error('Unsupported database provider for export'));
      }
      catch (error) {
        state.errors.push(new Error('Failed to export database', { cause: error }));
      }
    }

    function renderLoadingIndicator() {
      return html`
        <div
          aria-label="${t('settings', 'loadingAriaLabel')}"
          role="presentation"
          style="display: flex; align-items: center; justify-content: center; padding: 48px;"
        >
          <progress></progress>
        </div>
      `;
    }

    function renderEmptyState() {
      return html`
        <div style="text-align: center; padding: 48px 24px;">
          <material-symbols name="database" size="48" style="color: var(--md-sys-color-on-surface-variant);"></material-symbols>
          <h3 style="margin-top: 16px; color: var(--md-sys-color-on-surface);">
            ${t('settings', 'noDatabasesTitle')}
          </h3>
          <p style="margin-top: 8px; color: var(--md-sys-color-on-surface-variant); max-width: 400px; margin-inline: auto;">
            ${t('settings', 'noDatabasesMessage')}
          </p>
          <button
            role="button"
            type="button"
            class="filled"
            @click=${handleNewDatabaseClick}
            style="margin-top: 24px;"
          >${t('settings', 'newDatabaseButtonLabel')}</button>
        </div>
      `;
    }

    /**
     * @param {DatabaseViewModel} database
     */
    function renderDatabaseRow(database) {
      const providerLabel = database.provider === 'local'
        ? t('settings', 'localProviderLabel')
        : t('settings', 'tursoProviderLabel');

      return html`
        <tr>
          <td style="text-align: left;">${providerLabel}</td>
          <td style="text-align: left;">
            ${database.name}
            ${database.isActive ? html`
              <span
                style="
                  margin-left: 8px;
                  padding: 2px 8px;
                  background-color: var(--md-sys-color-primary-container);
                  color: var(--md-sys-color-on-primary-container);
                  border-radius: var(--md-sys-shape-corner-small);
                  font-size: 0.75rem;
                "
              >${t('settings', 'databaseInfoActiveStatus')}</span>
            ` : nothing}
          </td>
          <td style="text-align: center;">
            <button
              role="button"
              type="button"
              class="text"
              style="--md-sys-density: -4;"
              commandfor="database-info-dialog"
              command="show-modal"
              @click=${handleInfoClick}
              data-database-name="${database.name}"
            >
              <material-symbols name="info" size="20"></material-symbols>
              ${t('settings', 'databaseInfoButtonLabel')}
            </button>
            ${!database.isActive ? html`
              <button
                role="button"
                type="button"
                class="text"
                style="--md-sys-density: -4;"
                commandfor="database-use-dialog"
                command="show-modal"
                @click=${handleUseClick}
                data-database-name="${database.name}"
              >
                <material-symbols name="swap_horiz" size="20"></material-symbols>
                ${t('settings', 'databaseUseButtonLabel')}
              </button>
            ` : nothing}
            ${database.provider === 'local' && database.isActive ? html`
              <button
                role="button"
                type="button"
                class="text"
                style="--md-sys-density: -4;"
                @click=${handleExportClick}
                data-database-name="${database.name}"
              >
                <material-symbols name="download" size="20"></material-symbols>
                ${t('settings', 'databaseExportButtonLabel')}
              </button>
            ` : nothing}
          </td>
        </tr>
      `;
    }

    function renderDatabaseList() {
      return html`
        <table style="width: 100%; border-collapse: collapse;">
          <thead>
            <tr>
              <th style="text-align: left;">${t('settings', 'providerColumnHeader')}</th>
              <th style="text-align: left;">${t('settings', 'databaseNameColumnHeader')}</th>
              <th style="text-align: center;">${t('settings', 'actionsColumnHeader')}</th>
            </tr>
          </thead>
          <tbody>
            ${repeat(state.databases, (database) => database.name, renderDatabaseRow)}
          </tbody>
        </table>
      `;
    }

    function renderInfoDialog() {
      if (state.selectedDatabase?.provider) {
        const providerLabel = state.selectedDatabase.provider === 'local'
          ? t('settings', 'localProviderLabel')
          : t('settings', 'tursoProviderLabel');
        return html`
          <dialog ${infoDialog} id="database-info-dialog" aria-labelledby="database-info-title">
            <div class="container">
              <header>
                <hgroup>
                  <h2 id="database-info-title">${t('settings', 'databaseInfoDialogTitle')}</h2>
                </hgroup>
              </header>
              <section class="content">
                <dl style="margin: 0;">
                  <dt style="font-weight: 500; margin-top: 16px;">${t('settings', 'databaseInfoProviderLabel')}</dt>
                  <dd style="margin: 4px 0 0 0; color: var(--md-sys-color-on-surface-variant);">${providerLabel}</dd>
                  <dt style="font-weight: 500; margin-top: 16px;">${t('settings', 'databaseInfoNameLabel')}</dt>
                  <dd style="margin: 4px 0 0 0; color: var(--md-sys-color-on-surface-variant);">${state.selectedDatabase?.name}</dd>
                  ${'url' in state.selectedDatabase ? html`
                    <dt style="font-weight: 500; margin-top: 16px;">${t('settings', 'databaseInfoUrlLabel')}</dt>
                    <dd style="margin: 4px 0 0 0; color: var(--md-sys-color-on-surface-variant); word-break: break-all;">${state.selectedDatabase.url}</dd>
                  ` : nothing}
                  <dt style="font-weight: 500; margin-top: 16px;">${t('settings', 'databaseInfoStatusLabel')}</dt>
                  <dd style="margin: 4px 0 0 0; color: var(--md-sys-color-on-surface-variant);">
                    ${state.selectedDatabase.isActive ? t('settings', 'databaseInfoActiveStatus') : t('settings', 'databaseInfoInactiveStatus')}
                  </dd>
                </dl>
              </section>
              <menu>
                <button
                  role="button"
                  type="button"
                  class="text"
                  commandfor="database-info-dialog"
                  command="close"
                >${t('settings', 'databaseInfoCloseButtonLabel')}</button>
              </menu>
            </div>
          </dialog>
        `;
      }
      else return nothing;
    }

    function renderSwitchDialog() {
      return html`
        <dialog ${switchDialog} id="switch-database-dialog" aria-labelledby="switch-database-title" @close=${handleSwitchCancel}>
          <form method="dialog" class="container" @submit=${handleSwitchConfirm}>
            <header>
              <hgroup>
                <h2 id="switch-database-title">${t('settings', 'switchDatabaseDialogTitle')}</h2>
              </hgroup>
            </header>
            <section class="content">
              <p>${t('settings', 'switchDatabaseMessage')}</p>
            </section>
            <menu>
              <button
                role="button"
                type="button"
                class="text"
                commandfor="switch-database-dialog"
                command="close"
              >${t('settings', 'switchDatabaseCancelButtonLabel')}</button>
              <button
                role="button"
                type="submit"
                class="filled"
              >${t('settings', 'switchDatabaseConfirmButtonLabel')}</button>
            </menu>
          </form>
        </dialog>
      `;
    }

    useEffect(host, function renderDatabaseManagementView() {
      render(html`
        <div style="padding: 24px;">
          <header style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 24px;">
            <h2 style="margin: 0;">${t('settings', 'databaseManagementTitle')}</h2>
            <div style="display: flex; gap: 8px;">
              <button
                role="button"
                type="button"
                class="text"
                aria-label="${t('settings', 'refreshDatabasesAriaLabel')}"
                @click=${loadDatabaseList}
              >
                <material-symbols name="refresh" size="24"></material-symbols>
                ${t('settings', 'refreshButtonLabel')}
              </button>
              <button
                role="button"
                type="button"
                class="filled"
                @click=${handleNewDatabaseClick}
              >${t('settings', 'newDatabaseButtonLabel')}</button>
            </div>
          </header>
          ${state.isLoading ? renderLoadingIndicator() : state.databases.length === 0 ? renderEmptyState() : renderDatabaseList()}
        </div>
        ${renderInfoDialog()}
        ${renderSwitchDialog()}
        <dialog role="alertdialog" ${errorDialog} id="error-dialog" aria-labelledby="error-dialog-title">
          <div class="container">
            <header>
              <hgroup>
                <h2 id="error-dialog-title">${t('common', 'errorDialogTitle')}</h2>
              </hgroup>
            </header>
            <section class="content">
              <p>${displayedError.value instanceof Error ? l(displayedError.value.message) : t('common', 'errorDialogUnknownError', displayedError.value)}</p>
            </section>
            <menu>
              <button
                role="button"
                type="button"
                class="filled"
                commandfor="error-dialog"
                command="close"
              >${t('common', 'errorDialogDismissButtonLabel')}</button>
            </menu>
          </div>
        </dialog>
      `);
    });
  }
}

defineWebComponent('database-management-view', DatabaseManagementViewElement);
