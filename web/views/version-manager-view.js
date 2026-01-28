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
import { useElement } from '#web/hooks/use-element.js';
import { assertInstanceOf } from '#web/tools/assertion.js';

import '#web/components/material-symbols.js';

/** @import { AppVersion } from '../../sw.js' */


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
      selectedAppVersion: /** @type {AppVersion|null} */(null),
      isSwitching: /** @type {boolean} */(false),
      errors: /** @type {Array<Error>} */([]),
    });

    const switchDialog = useElement(host, HTMLDialogElement);

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

    /** @param {Event} event */
    function handleUseAppVersion(event) {
      assertInstanceOf(HTMLButtonElement, event.currentTarget);
      const appVersion = event.currentTarget.dataset.appVersion;
      const selectedAppVersion = state.appVersions.find(function byValue(version) {
        return version.version === appVersion;
      });
      if (selectedAppVersion) {
        state.selectedAppVersion = selectedAppVersion;
        assertInstanceOf(HTMLDialogElement, switchDialog.value);
        switchDialog.value.showModal();
      }
    }

    function handleSwitchCancel() {
      assertInstanceOf(HTMLDialogElement, switchDialog.value);
      switchDialog.value.close();
      state.selectedAppVersion = null;
      state.isSwitching = false;
    }

    /** @param {SubmitEvent} event */
    async function handleSwitchConfirm(event) {
      event.preventDefault();

      if (!state.selectedAppVersion) return;

      const version = state.selectedAppVersion;
      const appPrefix = version.prefix;
      const appIndex = 'index.html';

      try {
        state.isSwitching = true;

        // Send message to service worker to set active appPrefix
        const response = await sw.sendMessage({
          command: 'set-active-appPrefix',
          appPrefix,
          appIndex,
          sources: version.sources,
        }, 60 * 1000); // 60 second timeout for downloading npm packages

        if (response === true) {
          // Success - reload the application
          window.location.reload();
        }
        else {
          throw new Error('Failed to switch version: unexpected response from service worker');
        }
      }
      catch (error) {
        console.error('version-manager-view', 'handleSwitchConfirm', 'error', error);
        state.errors.push(error instanceof Error ? error : new Error(String(error)));
        state.isSwitching = false;
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
     * @param {AppVersion} app
     */
    function renderVersionRow(app) {
      const isLocal = app.sources.includes('local');
      const isNpm = app.sources.includes('npm');

      // console.debug('version-manager-view', 'renderVersionRow', JSON.stringify(app));

      return html`
        <tr>
          <td style="font-family: var(--md-sys-typescale-font-mono, monospace);">${app.prefix === '' ? html`<em>default</em>` : app.prefix}</td>
          <td style="word-break: break-all;">${app.version}</td>
          <td>
            <div class="chip-group compact">
              ${isLocal ? html`
                <span class="chip small filled">
                  ${t('settings', 'versionLocalSourceLabel')}
                </span>
              ` : nothing}
              ${isNpm ? html`
                <span class="chip small primary">
                  ${t('settings', 'versionNpmSourceLabel')}
                </span>
              ` : nothing}
            </div>
          </td>
          <td style="text-align: center;">
            ${isLocal ? html`
              <span
                style="
                  padding: 2px 8px;
                  background-color: var(--md-sys-color-primary-container);
                  color: var(--md-sys-color-on-primary-container);
                  border-radius: var(--md-sys-shape-corner-small);
                  font-size: 0.75rem;
                "
              >${t('settings', 'versionCurrentLabel')}</span>
            ` : html`
              <button
                role="button"
                type="button"
                class="text"
                style="--md-sys-density: -4;"
                @click=${handleUseAppVersion}
                data-app-version="${app.version}"
                aria-label="${t('settings', 'versionUseButtonAriaLabel', app.version)}"
              >
                <material-symbols name="swap_horiz" size="20"></material-symbols>
                ${t('settings', 'versionUseButtonLabel')}
              </button>
            `}
          </td>
        </tr>
      `;
    }

    function renderVersionList() {
      return html`
        <div class="container">
          <table aria-label=${t('settings', 'versionManagerTableAriaLabel')}>
            <thead>
              <tr>
                <th scope="col">${t('settings', 'versionPrefixColumnHeader')}</th>
                <th scope="col">${t('settings', 'versionValueColumnHeader')}</th>
                <th scope="col">${t('settings', 'versionSourcesColumnHeader')}</th>
                <th scope="col" style="text-align: center;">${t('settings', 'versionActionsColumnHeader')}</th>
              </tr>
            </thead>
            <tbody>
              ${repeat(state.appVersions, (app) => app.version, renderVersionRow)}
            </tbody>
          </table>
        </div>
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

    function renderSwitchDialog() {
      const versionValue = state.selectedAppVersion?.version ?? '';

      return html`
        <dialog
          ${switchDialog}
          id="version-switch-dialog"
          aria-labelledby="version-switch-dialog-title"
          @close=${handleSwitchCancel}
        >
          <form method="dialog" class="container" @submit=${handleSwitchConfirm}>
            <header>
              <hgroup>
                <h2 id="version-switch-dialog-title">${t('settings', 'versionSwitchDialogTitle')}</h2>
              </hgroup>
            </header>
            <section class="content">
              ${state.isSwitching ? html`
                <div role="status" aria-live="polite" aria-busy="true">
                  <div role="progressbar" class="linear indeterminate">
                    <div class="track"><div class="indicator"></div></div>
                  </div>
                  <p style="margin-top: 16px;">${t('settings', 'versionSwitchDialogLoadingMessage')}</p>
                  <p style="margin-top: 8px; color: var(--md-sys-color-on-surface-variant); font-size: 0.875rem;">
                    ${t('settings', 'versionSwitchDialogLoadingNote')}
                  </p>
                </div>
              ` : html`
                <p>${t('settings', 'versionSwitchDialogMessage', versionValue)}</p>
              `}
            </section>
            <menu>
              <button
                role="button"
                type="button"
                class="text"
                @click=${handleSwitchCancel}
                ?disabled=${state.isSwitching}
              >${t('settings', 'versionSwitchDialogCancelButtonLabel')}</button>
              <button
                role="button"
                type="submit"
                class="filled"
                ?disabled=${state.isSwitching}
              >${t('settings', 'versionSwitchDialogConfirmButtonLabel')}</button>
            </menu>
          </form>
        </dialog>
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
        ${renderSwitchDialog()}
      `);
    });
  }
}

defineWebComponent('version-manager-view', VersionManagerViewElement);
