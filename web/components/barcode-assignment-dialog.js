import { html, nothing } from 'lit-html';
import { reactive } from '@vue/reactivity';

import { defineWebComponent } from '#web/component.js';
import { DatabaseContextElement } from '#web/contexts/database-context.js';
import { readValue } from '#web/directives/read-value.js';
import { useAdoptedStyleSheets } from '#web/hooks/use-adopted-style-sheets.js';
import { useContext } from '#web/hooks/use-context.js';
import { useDialog } from '#web/hooks/use-dialog.js';
import { useEffect } from '#web/hooks/use-effect.js';
import { useElement } from '#web/hooks/use-element.js';
import { useExposed } from '#web/hooks/use-exposed.js';
import { useRender } from '#web/hooks/use-render.js';
import { useTranslator } from '#web/hooks/use-translator.js';
import { webStyleSheets } from '#web/styles.js';
import { assertInstanceOf } from '#web/tools/assertion.js';

import '#web/components/material-symbols.js';
import '#web/components/inventory-selector-dialog.js';

/**
 * @typedef {object} InventoryData
 * @property {number} id
 * @property {string} name
 */

/**
 * @typedef {HTMLElementEventMap & { 'barcode-assigned': CustomEvent<{ barcodeCode: string, inventoryId: number }> }} BarcodeAssignmentDialogElementEventMap
 */

/**
 * @template {keyof BarcodeAssignmentDialogElementEventMap} K
 * @typedef {(type: K, listener: (this: BarcodeAssignmentDialogElement, ev: BarcodeAssignmentDialogElementEventMap[K]) => any, options?: boolean | AddEventListenerOptions) => void} BarcodeAssignmentDialogElementAddEventListenerType
 */

/**
 * Barcode Assignment Dialog Component
 * 
 * A dialog for assigning a barcode to an inventory item.
 * 
 * @class
 * @property {BarcodeAssignmentDialogElementAddEventListenerType} addEventListener - Add event listener method
 * 
 * @fires barcode-assigned - Fired when a barcode is successfully assigned. Detail: { barcodeCode: string, inventoryId: number }
 * 
 * @example assuming we use lit-html for rendering
    <button
      type="button"
      commandfor="barcode-assignment-dialog"
      command="--open"
    >Assign Barcode</button>
    <barcode-assignment-dialog
      id="barcode-assignment-dialog"
      @barcode-assigned=${() => console.log('Barcode assigned')}
    ></barcode-assignment-dialog>
 */
export class BarcodeAssignmentDialogElement extends HTMLElement {
  constructor() {
    super();

    const host = this;
    const database = useContext(host, DatabaseContextElement);
    const inventorySelectorDialog = useElement(host, HTMLElement);
    const t = useTranslator(host);

    const dialog = useDialog(host);
    const errorAlertDialogElement = useElement(host, HTMLDialogElement);
    const render = useRender(host);
    useAdoptedStyleSheets(host, webStyleSheets);

    const form = reactive({
      barcodeCode: '',
      selectedInventoryId: /** @type {number | null} */ (null),
      selectedInventoryName: '',
      isSaving: false,
      error: /** @type {Error | null} */ (null),
    });

    this.open = useExposed(host, function readDialogState() {
      return dialog.open;
    });

    useEffect(host, function resetFormOnClose() {
      if (!dialog.open) {
        form.barcodeCode = '';
        form.selectedInventoryId = null;
        form.selectedInventoryName = '';
        form.isSaving = false;
        form.error = null;
      }
    });

    /** @param {Event} event */
    function handleInventorySelect(event) {
      assertInstanceOf(CustomEvent, event);
      const detail = /** @type {{ inventoryId: number, inventoryName: string }} */ (event.detail);
      form.selectedInventoryId = detail.inventoryId;
      form.selectedInventoryName = detail.inventoryName;
    }

    function clearInventory() {
      form.selectedInventoryId = null;
      form.selectedInventoryName = '';
    }

    /** @param {SubmitEvent} event */
    async function handleSubmit(event) {
      event.preventDefault();

      if (!form.barcodeCode.trim() || !form.selectedInventoryId) return;

      const tx = await database.transaction('write');

      try {
        form.isSaving = true;
        form.error = null;

        const barcodeCode = form.barcodeCode.trim();
        const inventoryId = form.selectedInventoryId;

        // Check if barcode already exists
        const existingCheck = await tx.sql`
          SELECT inventory_id FROM inventory_barcodes WHERE code = ${barcodeCode};
        `;

        if (existingCheck.rows.length > 0) {
          const existingInventoryId = Number(existingCheck.rows[0].inventory_id);
          if (existingInventoryId === inventoryId) {
            throw new Error(t('barcode', 'barcodeAlreadyAssignedToThisError'));
          }
          else {
            throw new Error(t('barcode', 'barcodeAlreadyAssignedToAnotherError'));
          }
        }

        await tx.sql`
          INSERT INTO inventory_barcodes (code, inventory_id)
          VALUES (${barcodeCode}, ${inventoryId});
        `;

        await tx.commit();

        host.dispatchEvent(new CustomEvent('barcode-assigned', {
          detail: { barcodeCode, inventoryId },
          bubbles: true,
          composed: true,
        }));

        dialog.open = false;
      }
      catch (error) {
        await tx.rollback();
        form.error = error instanceof Error ? error : new Error(String(error));
      }
      finally {
        form.isSaving = false;
      }
    }

    function handleDismissErrorDialog() {
      form.error = null;
    }

    useEffect(host, function syncErrorAlertDialogState() {
      if (form.error instanceof Error) errorAlertDialogElement.value?.showModal();
      else errorAlertDialogElement.value?.close();
    });

    useEffect(host, function renderDialog() {
      render(html`
        <dialog
          ${dialog.element}
          id="barcode-assignment-dialog"
          aria-labelledby="barcode-assignment-dialog-title"
        >
          <form class="container" @submit=${handleSubmit}>
            <header>
              <hgroup>
                <h2 id="barcode-assignment-dialog-title">${t('barcode', 'assignDialogTitle')}</h2>
              </hgroup>
            </header>

            <div class="content">
              <div class="outlined-text-field" style="--md-sys-density: -4; margin-bottom: 16px;">
                <div class="container">
                  <label for="barcode-input">${t('barcode', 'barcodeLabel')}</label>
                  <input
                    ${readValue(form, 'barcodeCode')}
                    id="barcode-input"
                    type="text"
                    placeholder=" "
                    required
                    autocomplete="off"
                    ?disabled=${form.isSaving}
                  />
                </div>
              </div>

              <div class="outlined-text-field" style="--md-sys-density: -4;">
                <div class="container">
                  <label for="inventory-input">${t('barcode', 'inventoryLabel')}</label>
                  <input
                    id="inventory-input"
                    type="button"
                    readonly
                    required
                    placeholder=" "
                    value="${form.selectedInventoryId ? form.selectedInventoryName : ''}"
                    commandfor="inventory-selector-dialog"
                    command="--open"
                    ?disabled=${form.isSaving}
                  />
                  ${form.selectedInventoryId ? html`
                    <button
                      type="button"
                      class="trailing-icon"
                      @click=${clearInventory}
                      aria-label="${t('barcode', 'clearInventoryAriaLabel')}"
                      ?disabled=${form.isSaving}
                    ><material-symbols name="close"></material-symbols></button>
                  ` : html`
                    <button
                      type="button"
                      class="trailing-icon"
                      commandfor="inventory-selector-dialog"
                      command="--open"
                      aria-label="${t('barcode', 'selectInventoryAriaLabel')}"
                      ?disabled=${form.isSaving}
                    ><material-symbols name="search"></material-symbols></button>
                  `}
                </div>
              </div>
            </div>

            <menu>
              <li>
                <button
                  role="button"
                  type="button"
                  class="text"
                  commandfor="barcode-assignment-dialog"
                  command="close"
                  ?disabled=${form.isSaving}
                >${t('barcode', 'cancelButtonLabel')}</button>
              </li>
              <li>
                <button
                  role="button"
                  type="submit"
                  class="filled"
                  ?disabled=${form.isSaving || !form.barcodeCode.trim() || !form.selectedInventoryId}
                >
                  ${form.isSaving ? html`
                    <div role="progressbar" class="circular indeterminate" style="--md-sys-density: -8; --md-sys-size-factor: 1;">
                      <div class="track"><div class="indicator"></div></div>
                    </div>
                  ` : html`
                    <material-symbols name="check"></material-symbols>
                  `}
                  ${t('barcode', 'assignButtonLabel')}
                </button>
              </li>
            </menu>
          </form>
        </dialog>

        <dialog ${errorAlertDialogElement} id="error-alert-dialog" aria-labelledby="error-alert-dialog-title">
          <div class="container">
            <header>
              <material-symbols name="error" size="24"></material-symbols>
              <hgroup>
                <h2 id="error-alert-dialog-title">${t('barcode', 'errorDialogTitle')}</h2>
              </hgroup>
            </header>
            <section class="content">
              <p>${form.error instanceof Error ? form.error.message : t('barcode', 'errorOccurredMessage', form.error)}</p>
            </section>
            <menu>
              <li>
                <button
                  role="button"
                  type="button"
                  class="text"
                  @click=${handleDismissErrorDialog}
                >${t('barcode', 'dismissButtonLabel')}</button>
              </li>
            </menu>
          </div>
        </dialog>

        <inventory-selector-dialog
          ${inventorySelectorDialog}
          id="inventory-selector-dialog"
          @inventory-select=${handleInventorySelect}
        ></inventory-selector-dialog>
      `);
    });
  }
}

defineWebComponent('barcode-assignment-dialog', BarcodeAssignmentDialogElement);
