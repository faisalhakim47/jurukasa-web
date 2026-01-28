import { html, nothing } from 'lit-html';
import { repeat } from 'lit-html/directives/repeat.js';
import { reactive } from '@vue/reactivity';

import { useEffect } from '#web/hooks/use-effect.js';
import { useRender } from '#web/hooks/use-render.js';
import { defineWebComponent } from '#web/component.js';
import { useContext } from '#web/hooks/use-context.js';
import { ServiceWorkerContextElement } from '#web/contexts/service-worker-context.js';
import { useConnectedCallback } from '#web/hooks/use-lifecycle.js';
import { useBusyStateResolver } from '#web/contexts/ready-context.js';
import { useAdoptedStyleSheets } from '#web/hooks/use-adopted-style-sheets.js';
import { useTranslator } from '#web/hooks/use-translator.js';
import { webStyleSheets } from '#web/styles.js';

import '#web/components/material-symbols.js';

/**
 * @typedef {object} AppVersion
 * @property {string} name
 * @property {string} value
 */

export class VersionManagerViewElement extends HTMLElement {
  constructor() {
    super();

    const host = this;
    const sw = useContext(host, ServiceWorkerContextElement);
    const t = useTranslator(host);
    const render = useRender(host);
    useAdoptedStyleSheets(host, webStyleSheets);

    const resolveReady = useBusyStateResolver(host);

    const state = reactive({
      isLoading: /** @type {boolean} */(true),
      appVersions: /** @type {AppVersion[]} */([]),
      errors: /** @type {Array<Error>} */([]),
    });

    async function loadAppVersions() {
      try {
        state.isLoading = true;
        const response = await sw.sendMessage({ command: 'get-app-versions' });
        if (response && typeof response === 'object' && 'appVersions' in response) {
          state.appVersions = /** @type {AppVersion[]} */(response.appVersions);
        }
        else {
          state.errors.push(new Error('Invalid response format from service worker'));
        }
      }
      catch (error) {
        console.error('version-manager-view', 'loadAppVersions', 'error', error);
        state.errors.push(error instanceof Error ? error : new Error(String(error)));
      }
      finally {
        state.isLoading = false;
        resolveReady();
      }
    }

    useConnectedCallback(host, loadAppVersions);

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
          <material-symbols name="storage" size="48" style="color: var(--md-sys-color-on-surface-variant);"></material-symbols>
          <h3 style="margin-top: 16px; color: var(--md-sys-color-on-surface);">
            ${t('settings', 'noAppVersionsTitle')}
          </h3>
          <p style="margin-top: 8px; color: var(--md-sys-color-on-surface-variant); max-width: 400px; margin-inline: auto;">
            ${t('settings', 'noAppVersionsMessage')}
          </p>
        </div>
      `;
    }

    /**
     * @param {AppVersion} version
     */
    function renderVersionRow(version) {
      return html`
        <tr>
          <td style="text-align: left; font-family: monospace;">${version.name}</td>
          <td style="text-align: left; word-break: break-all;">${version.value}</td>
        </tr>
      `;
    }

    function renderVersionList() {
      return html`
        <table style="width: 100%; border-collapse: collapse;">
          <thead>
            <tr>
              <th style="text-align: left;">${t('settings', 'versionNameColumnHeader')}</th>
              <th style="text-align: left;">${t('settings', 'versionValueColumnHeader')}</th>
            </tr>
          </thead>
          <tbody>
            ${repeat(state.appVersions, (version) => version.name, renderVersionRow)}
          </tbody>
        </table>
      `;
    }

    function renderErrorBanner() {
      if (state.errors.length === 0) return nothing;
      return html`
        <div
          role="alert"
          style="
            margin: 16px 24px;
            padding: 16px;
            background-color: var(--md-sys-color-error-container);
            color: var(--md-sys-color-on-error-container);
            border-radius: var(--md-sys-shape-corner-small);
          "
        >
          <div style="display: flex; align-items: center; gap: 8px;">
            <material-symbols name="error" size="20"></material-symbols>
            <span>${t('settings', 'unableToLoadDataTitle')}</span>
          </div>
        </div>
      `;
    }

    useEffect(host, function renderVersionManagerView() {
      render(html`
        <div style="padding: 24px;">
          <header style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 24px;">
            <h2 style="margin: 0;">${t('settings', 'versionManagerTitle')}</h2>
            <button
              role="button"
              type="button"
              class="text"
              aria-label="${t('settings', 'refreshVersionsAriaLabel')}"
              @click=${loadAppVersions}
              ?disabled=${state.isLoading}
            >
              <material-symbols name="refresh" size="24"></material-symbols>
              ${t('settings', 'refreshButtonLabel')}
            </button>
          </header>
          ${renderErrorBanner()}
          ${state.isLoading ? renderLoadingIndicator() : state.appVersions.length === 0 ? renderEmptyState() : renderVersionList()}
        </div>
      `);
    });
  }
}

defineWebComponent('version-manager-view', VersionManagerViewElement);
