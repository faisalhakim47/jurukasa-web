import { reactive } from '@vue/reactivity';
import { html, nothing } from 'lit-html';

import { defineWebComponent } from '#web/component.js';
import { useDialog } from '#web/hooks/use-dialog.js';
import { useAdoptedStyleSheets } from '#web/hooks/use-adopted-style-sheets.js';
import { DatabaseContextElement } from '#web/contexts/database-context.js';
import { I18nContextElement } from '#web/contexts/i18n-context.js';
import { useContext } from '#web/hooks/use-context.js';
import { useEffect } from '#web/hooks/use-effect.js';
import { useRender } from '#web/hooks/use-render.js';
import { useElement } from '#web/hooks/use-element.js';
import { useTranslator } from '#web/hooks/use-translator.js';
import { webStyleSheets } from '#web/styles.js';
import { assertInstanceOf } from '#web/tools/assertion.js';
import { feedbackDelay } from '#web/tools/timing.js';

import '#web/components/material-symbols.js';

/**
 * Supplier Creation Dialog Component
 * 
 * @fires supplier-created - Fired when a supplier is successfully created. Detail: { supplierId: number }
 */
export class SupplierCreationDialogElement extends HTMLElement {
  constructor() {
    super();

    const host = this;
    const database = useContext(host, DatabaseContextElement);
    const i18n = useContext(host, I18nContextElement);
    const t = useTranslator(host);

    const errorAlertDialog = useElement(host, HTMLDialogElement);

    const dialog = useDialog(host);
    const render = useRender(host);
    useAdoptedStyleSheets(host, webStyleSheets);

    const state = reactive({
      formState: /** @type {'idle' | 'submitting' | 'success' | 'error'} */ ('idle'),
      formError: /** @type {Error | null} */ (null),
    });

    /** @param {FocusEvent} event */
    async function validateSupplierName(event) {
      assertInstanceOf(HTMLInputElement, event.currentTarget);
      const input = event.currentTarget;
      const name = input.value.trim();
      input.setCustomValidity('');
      if (name) {
        try {
          const result = await database.sql`
            SELECT 1 FROM suppliers WHERE name = ${name} LIMIT 1;
          `;
          if (result.rows.length > 0) input.setCustomValidity(t('supplier', 'supplierNameExistsError'));
        }
        catch (error) {
          input.setCustomValidity(t('supplier', 'supplierNameValidationError'));
        }
      }
    }

    /** @param {SubmitEvent} event */
    async function handleSubmit(event) {
      event.preventDefault();
      assertInstanceOf(HTMLFormElement, event.currentTarget);
      const form = event.currentTarget;

      const tx = await database.transaction('write');

      try {
        state.formState = 'submitting';
        state.formError = null;

        const data = new FormData(form);
        const name = /** @type {string} */ (data.get('name'))?.trim();
        const phoneNumber = /** @type {string} */ (data.get('phoneNumber'))?.trim() || null;

        // Validate inputs
        if (!name) throw new Error(t('supplier', 'supplierNameRequiredError'));

        // Insert supplier
        const result = await tx.sql`
          INSERT INTO suppliers (name, phone_number)
          VALUES (${name}, ${phoneNumber})
          RETURNING id;
        `;

        const supplierId = Number(result.rows[0].id);

        await tx.commit();

        state.formState = 'success';
        await feedbackDelay();

        host.dispatchEvent(new CustomEvent('supplier-created', {
          detail: { supplierId },
          bubbles: true,
          composed: true,
        }));

        dialog.open = false;
        form.reset();
      }
      catch (error) {
        await tx.rollback();
        state.formState = 'error';
        state.formError = error instanceof Error ? error : new Error(String(error));
        await feedbackDelay();
      }
      finally {
        state.formState = 'idle';
      }
    }

    useEffect(host, function syncErrorAlertDialogState() {
      if (errorAlertDialog.value instanceof HTMLDialogElement) {
        if (state.formError instanceof Error) errorAlertDialog.value.showModal();
        else errorAlertDialog.value.close();
      }
    });

    function handleDismissErrorDialog() { state.formError = null; }

    useEffect(host, function renderDialog() {
      render(html`
        <dialog
          ${dialog.element}
          id="supplier-creation-dialog"
          class="full-screen"
          aria-labelledby="supplier-creation-dialog-title"
        >
          <form class="container" @submit=${handleSubmit}>
            <header>
              <h2 id="supplier-creation-dialog-title">${t('supplier', 'createDialogTitle')}</h2>
              <button
                role="button"
                type="button"
                class="text"
                commandfor="supplier-creation-dialog"
                command="close"
              ><material-symbols name="close"></material-symbols></button>
              <button role="button" type="submit" name="action">${t('supplier', 'createSupplierButtonLabel')}</button>
            </header>

            <div class="content">
              ${state.formState !== 'idle' ? html`
                <div role="status" aria-live="polite" aria-busy="true">
                  <div role="progressbar" class="linear indeterminate">
                    <div class="track"><div class="indicator"></div></div>
                  </div>
                  <p>${t('supplier', 'creatingSupplierMessage')}</p>
                </div>
              ` : nothing}

              <div style="display: flex; flex-direction: column; gap: 24px; padding: 16px 0px; max-width: 600px; margin: 0 auto;">

                <!-- Supplier Name -->
                <div class="outlined-text-field">
                  <div class="container">
                    <label for="supplier-name-input">${t('supplier', 'supplierNameLabel')}</label>
                    <input
                      id="supplier-name-input"
                      name="name"
                      type="text"
                      placeholder=" "
                      required
                      @blur=${validateSupplierName}
                    />
                  </div>
                  <div class="supporting-text">${t('supplier', 'supplierNameSupportingText')}</div>
                </div>

                <!-- Phone Number -->
                <div class="outlined-text-field">
                  <div class="container">
                    <label for="phone-number-input">${t('supplier', 'phoneNumberLabel')}</label>
                    <input
                      id="phone-number-input"
                      name="phoneNumber"
                      type="tel"
                      placeholder=" "
                    />
                  </div>
                  <div class="supporting-text">${t('supplier', 'phoneNumberSupportingText')}</div>
                </div>

              </div>
            </div>
          </form>
        </dialog>

        <dialog ${errorAlertDialog} role="alertdialog">
          <div class="container">
            <material-symbols name="error"></material-symbols>
            <header>
              <h3>${t('supplier', 'errorDialogTitle')}</h3>
            </header>
            <div class="content">
              <p>${state.formError?.message}</p>
            </div>
            <menu>
              <li>
                <button
                  role="button"
                  type="button"
                  class="text"
                  @click=${handleDismissErrorDialog}
                >${t('supplier', 'dismissButtonLabel')}</button>
              </li>
            </menu>
          </div>
        </dialog>
      `);
    });
  }
}

defineWebComponent('supplier-creation-dialog', SupplierCreationDialogElement);
