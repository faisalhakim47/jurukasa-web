import { reactive } from '@vue/reactivity';
import { html, nothing } from 'lit-html';

import { defineWebComponent } from '#web/component.js';
import { useDialog } from '#web/hooks/use-dialog.js';
import { useAdoptedStyleSheets } from '#web/hooks/use-adopted-style-sheets.js';
import { DatabaseContextElement } from '#web/contexts/database-context.js';
import { I18nContextElement } from '#web/contexts/i18n-context.js';
import { useAttribute } from '#web/hooks/use-attribute.js';
import { useContext } from '#web/hooks/use-context.js';
import { useEffect } from '#web/hooks/use-effect.js';
import { useRender } from '#web/hooks/use-render.js';
import { useElement } from '#web/hooks/use-element.js';
import { webStyleSheets } from '#web/styles.js';
import { assertInstanceOf } from '#web/tools/assertion.js';
import { sleep } from '#web/tools/timing.js';

import '#web/components/material-symbols.js';

/**
 * @typedef {object} InventoryDetail
 * @property {number} id
 * @property {string} name
 * @property {number} unit_price
 * @property {string | null} unit_of_measurement
 * @property {number} account_code
 * @property {string} account_name
 * @property {number} cost
 * @property {number} stock
 * @property {number} num_of_sales
 */

/**
 * @typedef {object} BarcodeRow
 * @property {string} code
 * @property {number} inventory_id
 */

/**
 * Inventory Details Dialog Component
 * 
 * @fires inventory-updated - Fired when inventory is updated
 */
export class InventoryDetailsDialogElement extends HTMLElement {
  constructor() {
    super();

    const host = this;
    const database = useContext(host, DatabaseContextElement);
    const i18n = useContext(host, I18nContextElement);

    const errorAlertDialog = useDialog(host);

    const dialog = useDialog(host);
    const render = useRender(host);
    useAdoptedStyleSheets(host, webStyleSheets);

    const state = reactive({
      inventory: /** @type {InventoryDetail | null} */ (null),
      barcodes: /** @type {BarcodeRow[]} */ ([]),
      isLoading: false,
      error: /** @type {Error | null} */ (null),
      isEditing: false,
      isSaving: false,
      newBarcode: '',
    });

    async function loadInventoryDetails() {
      try {
        const inventoryId = parseInt(dialog.context?.dataset.inventoryId, 10);
        if (isNaN(inventoryId)) return;

        state.isLoading = true;
        state.error = null;

        const result = await database.sql`
          SELECT
            i.id,
            i.name,
            i.unit_price,
            i.unit_of_measurement,
            i.account_code,
            a.name as account_name,
            i.cost,
            i.stock,
            i.num_of_sales
          FROM inventories i
          JOIN accounts a ON a.account_code = i.account_code
          WHERE i.id = ${inventoryId}
        `;

        if (result.rows.length === 0) {
          state.inventory = null;
          state.barcodes = [];
        }
        else {
          const row = result.rows[0];
          state.inventory = {
            id: Number(row.id),
            name: String(row.name),
            unit_price: Number(row.unit_price),
            unit_of_measurement: row.unit_of_measurement ? String(row.unit_of_measurement) : null,
            account_code: Number(row.account_code),
            account_name: String(row.account_name),
            cost: Number(row.cost),
            stock: Number(row.stock),
            num_of_sales: Number(row.num_of_sales),
          };

          // Load barcodes
          const barcodesResult = await database.sql`
            SELECT code, inventory_id
            FROM inventory_barcodes
            WHERE inventory_id = ${inventoryId}
            ORDER BY code ASC
          `;

          state.barcodes = barcodesResult.rows.map(function (row) {
            return /** @type {BarcodeRow} */ ({
              code: String(row.code),
              inventory_id: Number(row.inventory_id),
            });
          });
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
      if (dialog.open && !isNaN(inventoryId)) loadInventoryDetails();
    });

    /** @param {SubmitEvent} event */
    async function handleUpdateSubmit(event) {
      event.preventDefault();
      assertInstanceOf(HTMLFormElement, event.currentTarget);

      if (!state.inventory) return;

      const tx = await database.transaction('write');

      try {
        state.isSaving = true;
        state.error = null;

        const data = new FormData(event.currentTarget);
        const name = /** @type {string} */ (data.get('name'))?.trim();
        const unitPrice = parseInt(/** @type {string} */(data.get('unitPrice')), 10);
        const unitOfMeasurement = /** @type {string} */ (data.get('unitOfMeasurement'))?.trim() || null;

        // Validate inputs
        if (!name) throw new Error('Inventory name is required.');
        if (isNaN(unitPrice) || unitPrice < 0) throw new Error('Invalid unit price.');

        // Check for duplicate name (excluding current inventory)
        const duplicateCheck = await tx.sql`
          SELECT 1 FROM inventories WHERE name = ${name} AND id != ${state.inventory.id} LIMIT 1;
        `;
        if (duplicateCheck.rows.length > 0) {
          throw new Error('Inventory name already exists.');
        }

        // Update inventory
        await tx.sql`
          UPDATE inventories
          SET name = ${name}, unit_price = ${unitPrice}, unit_of_measurement = ${unitOfMeasurement}
          WHERE id = ${state.inventory.id};
        `;

        await tx.commit();

        state.isEditing = false;
        await loadInventoryDetails();

        host.dispatchEvent(new CustomEvent('inventory-updated', {
          detail: { inventoryId: state.inventory.id },
          bubbles: true,
          composed: true,
        }));
      }
      catch (error) {
        await tx.rollback();
        state.error = error instanceof Error ? error : new Error(String(error));
      }
      finally {
        state.isSaving = false;
      }
    }

    /** @param {Event} event */
    function handleNewBarcodeInput(event) {
      assertInstanceOf(HTMLInputElement, event.target);
      state.newBarcode = event.target.value;
    }

    async function addBarcode() {
      if (!state.inventory || !state.newBarcode.trim()) return;

      const tx = await database.transaction('write');

      try {
        const barcodeCode = state.newBarcode.trim();

        // Check if barcode already exists
        const existingCheck = await tx.sql`
          SELECT inventory_id FROM inventory_barcodes WHERE code = ${barcodeCode};
        `;

        if (existingCheck.rows.length > 0) {
          const existingInventoryId = Number(existingCheck.rows[0].inventory_id);
          if (existingInventoryId === state.inventory.id) {
            throw new Error('This barcode is already assigned to this inventory.');
          }
          else {
            throw new Error('This barcode is already assigned to another inventory.');
          }
        }

        await tx.sql`
          INSERT INTO inventory_barcodes (code, inventory_id)
          VALUES (${barcodeCode}, ${state.inventory.id});
        `;

        await tx.commit();

        state.newBarcode = '';
        await loadInventoryDetails();
      }
      catch (error) {
        await tx.rollback();
        state.error = error instanceof Error ? error : new Error(String(error));
      }
    }

    /** @param {string} barcodeCode */
    async function removeBarcode(barcodeCode) {
      if (!state.inventory) return;

      const tx = await database.transaction('write');

      try {
        await tx.sql`
          DELETE FROM inventory_barcodes
          WHERE code = ${barcodeCode} AND inventory_id = ${state.inventory.id};
        `;

        await tx.commit();
        await loadInventoryDetails();
      }
      catch (error) {
        await tx.rollback();
        state.error = error instanceof Error ? error : new Error(String(error));
      }
    }

    /** @param {Event} event */
    function handleRemoveBarcode(event) {
      const target = /** @type {HTMLElement} */ (event.currentTarget);
      const barcodeCode = String(target.dataset.barcodeCode);
      removeBarcode(barcodeCode);
    }

    function handleDismissErrorDialog() { state.error = null; }

    function toggleEditMode() {
      state.isEditing = !state.isEditing;
    }

    useEffect(host, function syncErrorAlertDialogState() {
      if (state.error instanceof Error) errorAlertDialog.open = true;
      else errorAlertDialog.open = false;
    });

    function renderLoadingState() {
      return html`
        <div
          role="status"
          aria-label="Loading inventory details"
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
          <p>Loading inventory details...</p>
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
          <h3 class="title-large">Inventory Not Found</h3>
          <p style="color: var(--md-sys-color-on-surface-variant);">The requested inventory could not be found.</p>
        </div>
      `;
    }

    function renderViewMode() {
      if (!state.inventory) return nothing;
      const inv = state.inventory;
      const avgCost = inv.stock > 0 ? Math.round(inv.cost / inv.stock) : 0;

      return html`
        <div style="display: flex; flex-direction: column; gap: 24px; padding: 16px 0;">
          <!-- Basic Info -->
          <section>
            <h3 class="title-medium" style="margin-bottom: 16px;">Basic Information</h3>
            <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px;">
              <div>
                <p class="label-small" style="color: var(--md-sys-color-on-surface-variant);">Name</p>
                <p class="body-large">${inv.name}</p>
              </div>
              <div>
                <p class="label-small" style="color: var(--md-sys-color-on-surface-variant);">Unit Price</p>
                <p class="body-large">${i18n.displayCurrency(inv.unit_price)}</p>
              </div>
              <div>
                <p class="label-small" style="color: var(--md-sys-color-on-surface-variant);">Unit of Measurement</p>
                <p class="body-large">${inv.unit_of_measurement || '—'}</p>
              </div>
              <div>
                <p class="label-small" style="color: var(--md-sys-color-on-surface-variant);">Inventory Account</p>
                <p class="body-large">${inv.account_code} - ${inv.account_name}</p>
              </div>
            </div>
          </section>

          <!-- Stock Info -->
          <section>
            <h3 class="title-medium" style="margin-bottom: 16px;">Stock Information</h3>
            <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px;">
              <div>
                <p class="label-small" style="color: var(--md-sys-color-on-surface-variant);">Current Stock</p>
                <p class="body-large" style="color: ${inv.stock < 0 ? 'var(--md-sys-color-error)' : 'inherit'};">${inv.stock}</p>
              </div>
              <div>
                <p class="label-small" style="color: var(--md-sys-color-on-surface-variant);">Total Cost</p>
                <p class="body-large">${i18n.displayCurrency(inv.cost)}</p>
              </div>
              <div>
                <p class="label-small" style="color: var(--md-sys-color-on-surface-variant);">Average Cost per Unit</p>
                <p class="body-large">${inv.stock > 0 ? i18n.displayCurrency(avgCost) : '—'}</p>
              </div>
              <div>
                <p class="label-small" style="color: var(--md-sys-color-on-surface-variant);">Total Sales</p>
                <p class="body-large">${inv.num_of_sales}</p>
              </div>
            </div>
          </section>

          <!-- Barcodes -->
          <section>
            <h3 class="title-medium" style="margin-bottom: 16px;">Barcodes</h3>
            ${state.barcodes.length > 0 ? html`
              <div style="display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 16px;">
                ${state.barcodes.map((barcode) => html`
                  <span
                    style="
                      display: inline-flex;
                      align-items: center;
                      gap: 4px;
                      padding: 4px 8px;
                      border-radius: var(--md-sys-shape-corner-small);
                      background-color: var(--md-sys-color-surface-container-high);
                    "
                  >
                    <span class="label-medium">${barcode.code}</span>
                    <button
                      role="button"
                      class="text"
                      style="padding: 0; min-width: auto;"
                      data-barcode-code="${barcode.code}"
                      @click=${handleRemoveBarcode}
                      aria-label="Remove barcode ${barcode.code}"
                    >
                      <material-symbols name="close" size="16"></material-symbols>
                    </button>
                  </span>
                `)}
              </div>
            ` : html`
              <p style="color: var(--md-sys-color-on-surface-variant); margin-bottom: 16px;">No barcodes assigned.</p>
            `}
            <div style="display: flex; gap: 8px; align-items: flex-end;">
              <div class="outlined-text-field" style="flex: 1;">
                <div class="container">
                  <label for="new-barcode-input">Add Barcode</label>
                  <input
                    id="new-barcode-input"
                    type="text"
                    placeholder=" "
                    .value=${state.newBarcode}
                    @input=${handleNewBarcodeInput}
                  />
                </div>
              </div>
              <button
                role="button"
                class="tonal"
                @click=${addBarcode}
                ?disabled=${!state.newBarcode.trim()}
              >
                <material-symbols name="add"></material-symbols>
                Add
              </button>
            </div>
          </section>
        </div>
      `;
    }

    function renderEditMode() {
      if (!state.inventory) return nothing;
      const inv = state.inventory;

      return html`
        <form @submit=${handleUpdateSubmit} style="display: flex; flex-direction: column; gap: 24px; padding: 16px 0;">
          ${state.isSaving ? html`
            <div role="status" aria-live="polite" aria-busy="true">
              <div role="progressbar" class="linear indeterminate">
                <div class="track"><div class="indicator"></div></div>
              </div>
              <p>Saving changes...</p>
            </div>
          ` : nothing}

          <!-- Inventory Name -->
          <div class="outlined-text-field">
            <div class="container">
              <label for="edit-name-input">Inventory Name</label>
              <input
                id="edit-name-input"
                name="name"
                type="text"
                placeholder=" "
                required
                value="${inv.name}"
              />
            </div>
          </div>

          <!-- Unit Price -->
          <div class="outlined-text-field">
            <div class="container">
              <label for="edit-unit-price-input">Unit Price</label>
              <input
                id="edit-unit-price-input"
                name="unitPrice"
                type="number"
                inputmode="numeric"
                min="0"
                placeholder=" "
                required
                value="${inv.unit_price}"
              />
            </div>
          </div>

          <!-- Unit of Measurement -->
          <div class="outlined-text-field">
            <div class="container">
              <label for="edit-unit-of-measurement-input">Unit of Measurement</label>
              <input
                id="edit-unit-of-measurement-input"
                name="unitOfMeasurement"
                type="text"
                placeholder=" "
                value="${inv.unit_of_measurement || ''}"
              />
            </div>
          </div>

          <div style="display: flex; gap: 12px; justify-content: flex-end;">
            <button role="button" type="button" class="text" @click=${toggleEditMode}>Cancel</button>
            <button role="button" type="submit" class="tonal">Save Changes</button>
          </div>
        </form>
      `;
    }

    useEffect(host, function renderDialog() {
      render(html`
        <dialog
          ${dialog.element}
          id="inventory-details-dialog"
          class="full-screen"
          aria-labelledby="inventory-details-dialog-title"
        >
          <div class="container">
            <header>
              <h2 id="inventory-details-dialog-title">
                ${state.inventory ? state.inventory.name : 'Inventory Details'}
              </h2>
              <button
                role="button"
                type="button"
                class="text"
                commandfor="inventory-details-dialog"
                command="close"
              ><material-symbols name="close"></material-symbols></button>
              ${state.inventory && !state.isEditing ? html`
                <button role="button" type="button" @click=${toggleEditMode}>
                  <material-symbols name="edit"></material-symbols>
                  Edit
                </button>
              ` : nothing}
            </header>

            <div class="content" style="max-width: 600px; margin: 0 auto;">
              ${state.isLoading ? renderLoadingState() : nothing}
              ${!state.isLoading && !state.inventory ? renderNotFoundState() : nothing}
              ${!state.isLoading && state.inventory && !state.isEditing ? renderViewMode() : nothing}
              ${!state.isLoading && state.inventory && state.isEditing ? renderEditMode() : nothing}
            </div>
          </div>
        </dialog>

        <dialog ${errorAlertDialog.element} role="alertdialog">
          <div class="container">
            <material-symbols name="error"></material-symbols>
            <header>
              <h3>Error</h3>
            </header>
            <div class="content">
              <p>${state.error?.message}</p>
            </div>
            <menu>
              <li>
                <button
                  role="button"
                  type="button"
                  class="text"
                  @click=${handleDismissErrorDialog}
                >Dismiss</button>
              </li>
            </menu>
          </div>
        </dialog>
      `);
    });
  }
}

defineWebComponent('inventory-details-dialog', InventoryDetailsDialogElement);
