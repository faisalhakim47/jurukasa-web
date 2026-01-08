import { html, nothing } from 'lit-html';
import { reactive } from '@vue/reactivity';

import { defineWebComponent } from '#web/component.js';
import { DatabaseContextElement } from '#web/contexts/database-context.js';
import { useBusyStateUntil } from '#web/contexts/ready-context.js';
import { useAdoptedStyleSheets } from '#web/hooks/use-adopted-style-sheets.js';
import { useContext } from '#web/hooks/use-context.js';
import { useEffect } from '#web/hooks/use-effect.js';
import { useElement } from '#web/hooks/use-element.js';
import { useRender } from '#web/hooks/use-render.js';
import { useTranslator } from '#web/hooks/use-translator.js';
import { webStyleSheets } from '#web/styles.js';
import { assertInstanceOf } from '#web/tools/assertion.js';
import { feedbackDelay } from '#web/tools/timing.js';

import '#web/components/material-symbols.js';

/**
 * @typedef {object} ConfigItem
 * @property {string} key
 * @property {string} value
 * @property {string | null} description
 */

export class AccountingConfigurationViewElement extends HTMLElement {
  constructor() {
    super();

    const host = this;
    const database = useContext(host, DatabaseContextElement);
    const t = useTranslator(host);

    const render = useRender(host);
    useAdoptedStyleSheets(host, webStyleSheets);

    const successDialog = useElement(host, HTMLDialogElement);
    const errorAlertDialog = useElement(host, HTMLDialogElement);

    const state = reactive({
      config: /** @type {ConfigItem[]} */ ([]),
      isLoadingConfig: true,
      configError: /** @type {Error | null} */ (null),
      configFormState: /** @type {'idle' | 'submitting' | 'success' | 'error'} */ ('idle'),
      configFormError: /** @type {Error | null} */ (null),
    });

    useBusyStateUntil(host, function firstLoad() {
      return state.isLoadingConfig === false;
    });

    async function loadConfig() {
      try {
        state.isLoadingConfig = true;
        state.configError = null;

        const result = await database.sql`
          SELECT key, value, description
          FROM config
          WHERE key NOT IN ('Schema Version')
          ORDER BY key ASC
        `;

        state.config = result.rows.map(function (row) {
          return /** @type {ConfigItem} */ ({
            key: String(row.key),
            value: String(row.value),
            description: row.description ? String(row.description) : null,
          });
        });

        state.isLoadingConfig = false;
      }
      catch (error) {
        state.configError = error instanceof Error ? error : new Error(String(error));
        state.isLoadingConfig = false;
      }
    }

    useEffect(host, loadConfig);

    /**
     * Get the input type for a config key
     * @param {string} key
     * @returns {'text' | 'number' | 'select'}
     */
    function getConfigInputType(key) {
      if (key === 'Currency Decimals' || key === 'Fiscal Year Start Month') return 'number';
      if (key === 'Business Type') return 'select';
      return 'text';
    }

    /**
     * Get the options for select config fields
     * @param {string} key
     * @returns {string[]}
     */
    function getConfigSelectOptions(key) {
      if (key === 'Business Type') {
        return ['Small Business', 'Medium Enterprise', 'Corporation', 'Non-Profit'];
      }
      return [];
    }

    /**
     * Get placeholder text for config fields
     * @param {string} key
     * @returns {string}
     */
    function getConfigPlaceholder(key) {
      if (key === 'Business Name') return 'e.g., My Store';
      if (key === 'Currency Code') return 'e.g., IDR, USD';
      if (key === 'Locale') return 'e.g., en-ID, id-ID';
      if (key === 'Fiscal Year Start Month') return '1-12';
      return '';
    }

    /** @param {SubmitEvent} event */
    async function handleConfigFormSubmit(event) {
      event.preventDefault();
      assertInstanceOf(HTMLFormElement, event.currentTarget);

      const tx = await database.transaction('write');

      try {
        state.configFormState = 'submitting';
        state.configFormError = null;

        const data = new FormData(event.currentTarget);
        const updateTime = Date.now();

        for (const [key, value] of data.entries()) {
          const trimmedValue = String(value).trim();
          await tx.sql`
            UPDATE config
            SET value = ${trimmedValue}, update_time = ${updateTime}
            WHERE key = ${key}
          `;
        }

        await tx.commit();

        state.configFormState = 'success';

        if (successDialog.value instanceof HTMLDialogElement) {
          successDialog.value.showModal();
        }

        await feedbackDelay();

        if (successDialog.value instanceof HTMLDialogElement) {
          successDialog.value.close();
        }

        state.configFormState = 'idle';

        // Reload config to reflect changes
        loadConfig();
      }
      catch (error) {
        await tx.rollback();
        state.configFormState = 'error';
        state.configFormError = error instanceof Error ? error : new Error(String(error));
      }
    }

    function handleDismissErrorDialog() {
      state.configFormError = null;
      state.configFormState = 'idle';
    }

    useEffect(host, function syncErrorAlertDialogState() {
      if (errorAlertDialog.value instanceof HTMLDialogElement) {
        if (state.configFormError instanceof Error && state.configFormState !== 'submitting') {
          errorAlertDialog.value.showModal();
        }
        else {
          errorAlertDialog.value.close();
        }
      }
    });

    function renderLoadingIndicator() {
      return html`
        <div
          role="status"
          aria-label="${t('settings', 'loadingAriaLabel')}"
          style="
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            gap: 16px;
            min-height: 200px;
            color: var(--md-sys-color-on-surface-variant);
          "
        >
          <div role="progressbar" class="linear indeterminate" style="width: 200px;">
            <div class="track">
              <div class="indicator"></div>
            </div>
          </div>
          <p>${t('settings', 'loadingMessage')}</p>
        </div>
      `;
    }

    /**
     * @param {Error} error
     * @param {function} retryFn
     */
    function renderErrorNotice(error, retryFn) {
      return html`
        <div
          role="alert"
          style="
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            gap: 16px;
            min-height: 200px;
            text-align: center;
            padding: 24px;
          "
        >
          <material-symbols name="error" size="48"></material-symbols>
          <h2 class="title-large" style="color: var(--md-sys-color-on-surface);">${t('settings', 'unableToLoadDataTitle')}</h2>
          <p style="color: var(--md-sys-color-on-surface-variant);">${error.message}</p>
          <button role="button" class="tonal" @click=${retryFn}>
            <material-symbols name="refresh"></material-symbols>
            ${t('settings', 'retryButtonLabel')}
          </button>
        </div>
      `;
    }

    function renderAccountingConfigPanel() {
      if (state.isLoadingConfig) return renderLoadingIndicator();
      if (state.configError instanceof Error) return renderErrorNotice(state.configError, loadConfig);

      return html`
        <form @submit=${handleConfigFormSubmit} style="display: flex; flex-direction: column; gap: 24px; max-width: 600px;">
          ${state.configFormState === 'submitting' ? html`
            <div role="status" aria-live="polite" aria-busy="true">
              <div role="progressbar" class="linear indeterminate">
                <div class="track"><div class="indicator"></div></div>
              </div>
              <p style="text-align: center; color: var(--md-sys-color-on-surface-variant);">${t('settings', 'savingConfigurationMessage')}</p>
            </div>
          ` : nothing}

          ${state.config.map(function (item) {
        const inputType = getConfigInputType(item.key);
        const inputId = `config-${item.key.toLowerCase().replace(/\s+/g, '-')}-input`;

        if (inputType === 'select') {
          const options = getConfigSelectOptions(item.key);
          return html`
                <div class="outlined-text-field" style="anchor-name: --${inputId}-anchor;">
                  <div class="container">
                    <label for="${inputId}">${item.key}</label>
                    <input
                      id="${inputId}"
                      type="button"
                      value="${item.value || t('settings', 'selectPlaceholder')}"
                      popovertarget="${inputId}-menu"
                      popovertargetaction="show"
                      placeholder=" "
                    />
                    <input type="hidden" name="${item.key}" value="${item.value}" />
                    <label for="${inputId}" class="trailing-icon">
                      <material-symbols name="arrow_drop_down"></material-symbols>
                    </label>
                  </div>
                  ${item.description ? html`<div class="supporting-text">${item.description}</div>` : nothing}
                </div>
                <menu role="menu" popover id="${inputId}-menu" class="dropdown" style="position-anchor: --${inputId}-anchor;">
                  ${options.map(function (option) {
            return html`
                      <li>
                        <button
                          role="menuitem"
                          type="button"
                          @click=${function handleSelectOption(event) {
                assertInstanceOf(HTMLButtonElement, event.currentTarget);
                const form = event.currentTarget.closest('form');
                if (form instanceof HTMLFormElement) {
                  const hiddenInput = form.querySelector(`input[name="${item.key}"]`);
                  const displayInput = form.querySelector(`#${inputId}`);
                  if (hiddenInput instanceof HTMLInputElement) {
                    hiddenInput.value = option;
                  }
                  if (displayInput instanceof HTMLInputElement) {
                    displayInput.value = option;
                  }
                }
              }}
                          popovertarget="${inputId}-menu"
                          popovertargetaction="hide"
                          aria-selected=${option === item.value ? 'true' : 'false'}
                        >
                          ${option === item.value ? html`<material-symbols name="check"></material-symbols>` : ''}
                          ${option}
                        </button>
                      </li>
                    `;
          })}
                </menu>
              `;
        }

        return html`
              <div class="outlined-text-field">
                <div class="container">
                  <label for="${inputId}">${item.key}</label>
                  <input
                    id="${inputId}"
                    name="${item.key}"
                    type="${inputType === 'number' ? 'number' : 'text'}"
                    placeholder=" "
                    value="${item.value}"
                    ${inputType === 'number' && item.key === 'Fiscal Year Start Month' ? html`min="1" max="12"` : nothing}
                    ${inputType === 'number' && item.key === 'Currency Decimals' ? html`min="0" max="4"` : nothing}
                  />
                </div>
                ${item.description ? html`<div class="supporting-text">${item.description}</div>` : nothing}
              </div>
            `;
      })}

          <div style="display: flex; justify-content: flex-end; gap: 12px; padding-top: 16px;">
            <button
              role="button"
              type="button"
              class="text"
              @click=${loadConfig}
              ?disabled=${state.configFormState === 'submitting'}
            >
              <material-symbols name="refresh"></material-symbols>
              ${t('settings', 'resetButtonLabel')}
            </button>
            <button
              role="button"
              type="submit"
              class="filled"
              ?disabled=${state.configFormState === 'submitting'}
            >
              <material-symbols name="save"></material-symbols>
              ${t('settings', 'saveChangesButtonLabel')}
            </button>
          </div>
        </form>
      `;
    }

    useEffect(host, function renderAccountingConfigurationView() {
      render(html`
        <div style="display: flex; flex-direction: column; gap: 12px; box-sizing: border-box; padding: 12px 24px; height: 100%;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px;">
            <h2 class="title-large" style="margin: 0;">${t('settings', 'accountingConfigurationTitle')}</h2>
            <button role="button" class="text" @click=${loadConfig} aria-label="${t('settings', 'refreshConfigurationAriaLabel')}">
              <material-symbols name="refresh"></material-symbols>
              ${t('settings', 'refreshButtonLabel')}
            </button>
          </div>
          ${renderAccountingConfigPanel()}
        </div>

        <dialog ${successDialog} id="success-dialog" aria-labelledby="success-dialog-title">
          <div class="container">
            <material-symbols name="check_circle" style="color: var(--md-sys-color-primary);"></material-symbols>
            <header>
              <h3 id="success-dialog-title">${t('settings', 'settingsSavedTitle')}</h3>
            </header>
            <div class="content">
              <p>${t('settings', 'settingsSavedMessage')}</p>
            </div>
          </div>
        </dialog>

        <dialog ${errorAlertDialog} role="alertdialog">
          <div class="container">
            <material-symbols name="error"></material-symbols>
            <header>
              <h3>${t('settings', 'errorOccurredTitle')}</h3>
            </header>
            <div class="content">
              <p>${state.configFormError?.message}</p>
            </div>
            <menu>
              <li>
                <button
                  role="button"
                  type="button"
                  class="text"
                  @click=${handleDismissErrorDialog}
                >${t('settings', 'dismissButtonLabel')}</button>
              </li>
            </menu>
          </div>
        </dialog>
      `);
    });
  }
}

defineWebComponent('accounting-configuration-view', AccountingConfigurationViewElement);
