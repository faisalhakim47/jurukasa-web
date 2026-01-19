import { reactive } from '@vue/reactivity';
import { html, nothing } from 'lit-html';

import { defineWebComponent } from '#web/component.js';
import { useDialog } from '#web/hooks/use-dialog.js';
import { useAdoptedStyleSheets } from '#web/hooks/use-adopted-style-sheets.js';
import { useElement } from '#web/hooks/use-element.js';
import { DatabaseContextElement } from '#web/contexts/database-context.js';
import { I18nContextElement } from '#web/contexts/i18n-context.js';
import { useContext } from '#web/hooks/use-context.js';
import { useEffect } from '#web/hooks/use-effect.js';
import { useRender } from '#web/hooks/use-render.js';
import { useTranslator } from '#web/hooks/use-translator.js';
import { webStyleSheets } from '#web/styles.js';
import { assertInstanceOf } from '#web/tools/assertion.js';
import { feedbackDelay } from '#web/tools/timing.js';

import '#web/components/material-symbols.js';

/**
 * @typedef {object} InventoryInfo
 * @property {number} id
 * @property {string} name
 * @property {number} unit_price
 * @property {string} unit_of_measurement
 */

/**
 * Inventory Price Update Dialog Component
 * 
 * @fires inventory-price-updated - Fired when inventory price is successfully updated. Detail: { inventoryId: number }
 */
export class InventoryPriceUpdateDialogElement extends HTMLElement {
  constructor() {
    super();

    const host = this;
    const database = useContext(host, DatabaseContextElement);
    const i18n = useContext(host, I18nContextElement);
    const t = useTranslator(host);

    const errorAlertDialog = reactive({
      element: useElement(host, HTMLDialogElement),
      open: false,
    });

    const dialog = useDialog(host);
    const render = useRender(host);
    useAdoptedStyleSheets(host, webStyleSheets);

    const state = reactive({
      inventory: /** @type {InventoryInfo | null} */ (null),
      isLoading: false,
      error: /** @type {Error | null} */ (null),
    });

    const form = reactive({
      state: /** @type {'idle' | 'submitting' | 'success' | 'error'} */ ('idle'),
      error: /** @type {Error | null} */ (null),
    });

    async function loadInventory() {
      try {
        const inventoryId = parseInt(dialog.context?.dataset.inventoryId, 10);
        if (isNaN(inventoryId)) return;

        state.isLoading = true;
        state.error = null;

        const result = await database.sql`
          SELECT id, name, unit_price, unit_of_measurement
          FROM inventories
          WHERE id = ${inventoryId}
        `;

        if (result.rows.length === 0) {
          state.inventory = null;
        }
        else {
          const row = result.rows[0];
          state.inventory = {
            id: Number(row.id),
            name: String(row.name),
            unit_price: Number(row.unit_price),
            unit_of_measurement: String(row.unit_of_measurement),
          };
        }

        state.isLoading = false;
      }
      catch (error) {
        state.error = error instanceof Error ? error : new Error(String(error));
        state.isLoading = false;
      }
    }

    useEffect(host, function loadOnOpen() {
      const inventoryId = parseInt(dialog.context?.dataset.inventoryId, 10);
      if (dialog.open && !isNaN(inventoryId)) loadInventory();
    });

    /** @param {SubmitEvent} event */
    async function handleSubmit(event) {
      event.preventDefault();
      assertInstanceOf(HTMLFormElement, event.currentTarget);

      if (!state.inventory) return;

      const tx = await database.transaction('write');

      try {
        form.state = 'submitting';
        form.error = null;

        const data = new FormData(event.currentTarget);
        const unitPrice = parseInt(/** @type {string} */(data.get('unitPrice')), 10);

        // Validate inputs
        if (isNaN(unitPrice) || unitPrice < 0) throw new Error(t('inventory', 'invalidUnitPriceError'));

        // Update inventory unit price
        await tx.sql`
          UPDATE inventories
          SET unit_price = ${unitPrice}
          WHERE id = ${state.inventory.id};
        `;

        await tx.commit();

        form.state = 'success';
        await feedbackDelay();

        host.dispatchEvent(new CustomEvent('inventory-price-updated', {
          detail: { inventoryId: state.inventory.id },
          bubbles: true,
          composed: true,
        }));

        dialog.open = false;
      }
      catch (error) {
        await tx.rollback();
        form.state = 'error';
        form.error = error instanceof Error ? error : new Error(String(error));
        await feedbackDelay();
      }
      finally {
        form.state = 'idle';
      }
    }

    useEffect(host, function syncErrorAlertDialogState() {
      const errorDialogElement = errorAlertDialog.element.value;
      if (errorDialogElement instanceof HTMLDialogElement) {
        if (form.error instanceof Error) errorDialogElement.showModal();
        else errorDialogElement.close();
      }
    });

    function handleDismissErrorDialog() { form.error = null; }

    function renderLoadingState() {
      return html`
        <div
          role="status"
          aria-label="${t('inventory', 'loadingInventoryAriaLabel')}"
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
          <p>${t('inventory', 'loadingInventoryMessage')}</p>
        </div>
      `;
    }

    function renderNotFoundState() {
      return html`
        <div
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
          <material-symbols name="inventory_2" size="48"></material-symbols>
          <h3 class="title-large">${t('inventory', 'inventoryNotFoundTitle')}</h3>
          <p style="color: var(--md-sys-color-on-surface-variant);">${t('inventory', 'inventoryNotFoundMessage')}</p>
        </div>
      `;
    }

    function renderUpdateFormContent() {
      if (!state.inventory) return nothing;
      const inventory = state.inventory;
      return html`
        ${form.state !== 'idle' ? html`
          <div role="status" aria-live="polite" aria-busy="true">
            <div role="progressbar" class="linear indeterminate">
              <div class="track"><div class="indicator"></div></div>
            </div>
            <p>${t('inventory', 'updatingPriceMessage')}</p>
          </div>
        ` : nothing}

        <!-- Inventory Name (Read-only) -->
        <div style="background-color: var(--md-sys-color-primary-container); padding: 12px; border-radius: var(--md-sys-shape-corner-small);">
          <p class="label-small" style="margin: 0; color: var(--md-sys-color-on-primary-container);">${t('inventory', 'inventoryFieldLabel')}</p>
          <p class="body-large" style="margin: 0; font-weight: 500; color: var(--md-sys-color-on-primary-container);">${inventory.name}</p>
        </div>

        <!-- Current Price -->
        <div style="margin: 20px 0 12px 0;">
          <p class="label-small" style="margin: 0 0 4px 0; color: var(--md-sys-color-on-surface-variant);">${t('inventory', 'currentUnitPriceLabel')}</p>
          <p class="headline-small" style="margin: 0;">${i18n.displayCurrency(inventory.unit_price)} / <small>${inventory.unit_of_measurement}</small></p>
        </div>

        <!-- New Unit Price -->
        <div class="outlined-text-field">
          <div class="container">
            <label for="unit-price-input">${t('inventory', 'newUnitPriceLabel')}</label>
            <input
              id="unit-price-input"
              name="unitPrice"
              type="number"
              inputmode="numeric"
              min="0"
              placeholder=" "
              required
              value="${inventory.unit_price}"
            />
          </div>
          <div class="supporting-text">${t('inventory', 'unitPriceSupportingText')}</div>
        </div>
      `;
    }

    useEffect(host, function renderDialog() {
      render(html`
        <dialog
          ${dialog.element}
          id="inventory-price-update-dialog"
          aria-labelledby="inventory-price-update-dialog-title"
        >
          <form class="container" @submit=${handleSubmit}>
            <header>
              <h2 id="inventory-price-update-dialog-title">${t('inventory', 'priceUpdateDialogTitle')}</h2>
            </header>

            <div class="content">
              ${state.isLoading ? renderLoadingState() : nothing}
              ${!state.isLoading && !state.inventory ? renderNotFoundState() : nothing}
              ${!state.isLoading && state.inventory ? renderUpdateFormContent() : nothing}
            </div>

            <menu>
              <button
                role="button"
                type="button"
                class="text"
                commandfor="inventory-price-update-dialog"
                command="close"
                ?disabled=${form.state === 'submitting'}
              >${t('inventory', 'cancelButtonLabel')}</button>
              <button
                role="button"
                type="submit"
                ?disabled=${form.state === 'submitting' || !state.inventory}
              >${t('inventory', 'updatePriceButtonLabel')}</button>
            </menu>
          </form>
        </dialog>

        <dialog ${errorAlertDialog.element} role="alertdialog">
          <div class="container">
            <material-symbols name="error"></material-symbols>
            <header>
              <h3>${t('inventory', 'errorDialogTitle')}</h3>
            </header>
            <div class="content">
              <p>${form.error?.message}</p>
            </div>
            <menu>
              <li>
                <button
                  role="button"
                  type="button"
                  class="text"
                  @click=${handleDismissErrorDialog}
                >${t('inventory', 'dismissButtonLabel')}</button>
              </li>
            </menu>
          </div>
        </dialog>
      `);
    });
  }
}

defineWebComponent('inventory-price-update-dialog', InventoryPriceUpdateDialogElement);
