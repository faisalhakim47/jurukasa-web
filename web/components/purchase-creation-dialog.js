import { reactive } from '@vue/reactivity';
import { html, nothing } from 'lit-html';

import { defineWebComponent } from '#web/component.js';
import { useDialog } from '#web/hooks/use-dialog.js';
import { useAdoptedStyleSheets } from '#web/hooks/use-adopted-style-sheets.js';
import { DatabaseContextElement } from '#web/contexts/database-context.js';
import { I18nContextElement } from '#web/contexts/i18n-context.js';
import { readValue } from '#web/directives/read-value.js';
import { useContext } from '#web/hooks/use-context.js';
import { useEffect } from '#web/hooks/use-effect.js';
import { useRender } from '#web/hooks/use-render.js';
import { webStyleSheets } from '#web/styles.js';
import { assertInstanceOf } from '#web/tools/assertion.js';
import { feedbackDelay } from '#web/tools/timing.js';

import '#web/components/material-symbols.js';

/**
 * @typedef {object} SupplierOption
 * @property {number} id
 * @property {string} name
 * @property {string | null} phone_number
 */

/**
 * @typedef {object} InventoryOption
 * @property {number} id
 * @property {string} name
 * @property {number} unit_price
 * @property {string | null} unit_of_measurement
 * @property {number} stock
 */

/**
 * @typedef {object} PurchaseLine
 * @property {number} inventoryId
 * @property {string} inventoryName
 * @property {string | null} unitOfMeasurement
 * @property {number} supplierQuantity
 * @property {number} quantity
 * @property {number} price
 */

/**
 * Purchase Creation Dialog Component
 * 
 * @fires purchase-created - Fired when a purchase is successfully created. Detail: { purchaseId: number }
 */
export class PurchaseCreationDialogElement extends HTMLElement {
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
      // Supplier selection
      suppliers: /** @type {SupplierOption[]} */ ([]),
      isLoadingSuppliers: false,
      supplierSearchQuery: '',
      selectedSupplierId: /** @type {number | null} */ (null),
      selectedSupplier: /** @type {SupplierOption | null} */ (null),

      // Inventory selection for adding lines
      inventories: /** @type {InventoryOption[]} */ ([]),
      isLoadingInventories: false,
      inventorySearchQuery: '',

      // Purchase lines
      lines: /** @type {PurchaseLine[]} */ ([]),

      // Line entry form
      addingLine: false,
      lineInventoryId: /** @type {number | null} */ (null),
      lineInventory: /** @type {InventoryOption | null} */ (null),
      lineSupplierQuantity: /** @type {number | null} */ (null),
      lineQuantity: /** @type {number | null} */ (null),
      linePrice: /** @type {number | null} */ (null),

      // Purchase date
      purchaseDate: new Date().toISOString().split('T')[0],
    });

    const form = reactive({
      state: /** @type {'idle' | 'submitting' | 'success' | 'error'} */ ('idle'),
      error: /** @type {Error | null} */ (null),
    });

    async function loadSuppliers() {
      try {
        state.isLoadingSuppliers = true;

        const searchPattern = state.supplierSearchQuery.trim() ? `%${state.supplierSearchQuery.trim()}%` : null;

        const result = await database.sql`
          SELECT id, name, phone_number
          FROM suppliers
          WHERE ${searchPattern} IS NULL OR name LIKE ${searchPattern}
          ORDER BY name ASC
          LIMIT 50
        `;

        state.suppliers = result.rows.map(function (row) {
          return /** @type {SupplierOption} */ ({
            id: Number(row.id),
            name: String(row.name),
            phone_number: row.phone_number ? String(row.phone_number) : null,
          });
        });

        state.isLoadingSuppliers = false;
      }
      catch (error) {
        state.isLoadingSuppliers = false;
        console.error('Failed to load suppliers:', error);
      }
    }

    async function loadInventories() {
      try {
        state.isLoadingInventories = true;

        const searchPattern = state.inventorySearchQuery.trim() ? `%${state.inventorySearchQuery.trim()}%` : null;

        const result = await database.sql`
          SELECT id, name, unit_price, unit_of_measurement, stock
          FROM inventories
          WHERE ${searchPattern} IS NULL OR name LIKE ${searchPattern}
          ORDER BY name ASC
          LIMIT 50
        `;

        state.inventories = result.rows.map(function (row) {
          return /** @type {InventoryOption} */ ({
            id: Number(row.id),
            name: String(row.name),
            unit_price: Number(row.unit_price),
            unit_of_measurement: row.unit_of_measurement ? String(row.unit_of_measurement) : null,
            stock: Number(row.stock),
          });
        });

        state.isLoadingInventories = false;
      }
      catch (error) {
        state.isLoadingInventories = false;
        console.error('Failed to load inventories:', error);
      }
    }

    useEffect(host, function loadOnOpen() {
      if (dialog.open) {
        loadSuppliers();
        loadInventories();
      }
    });

    /** @param {Event} event */
    function handleSupplierSearchInput(event) {
      assertInstanceOf(HTMLInputElement, event.target);
      state.supplierSearchQuery = event.target.value;
      loadSuppliers();
    }

    /** @param {Event} event */
    function handleInventorySearchInput(event) {
      assertInstanceOf(HTMLInputElement, event.target);
      state.inventorySearchQuery = event.target.value;
      loadInventories();
    }

    /** @param {number} supplierId */
    function selectSupplier(supplierId) {
      state.selectedSupplierId = supplierId;
      state.selectedSupplier = state.suppliers.find((s) => s.id === supplierId) || null;
    }

    function clearSupplier() {
      state.selectedSupplierId = null;
      state.selectedSupplier = null;
      state.lines = [];
    }

    function startAddingLine() {
      state.addingLine = true;
      state.lineInventoryId = null;
      state.lineInventory = null;
      state.lineSupplierQuantity = 1;
      state.lineQuantity = 1;
      state.linePrice = null;
    }

    function cancelAddingLine() {
      state.addingLine = false;
      state.lineInventoryId = null;
      state.lineInventory = null;
      state.lineSupplierQuantity = null;
      state.lineQuantity = null;
      state.linePrice = null;
    }

    /** @param {number} inventoryId */
    function selectLineInventory(inventoryId) {
      state.lineInventoryId = inventoryId;
      state.lineInventory = state.inventories.find((inv) => inv.id === inventoryId) || null;
      state.lineSupplierQuantity = 1;
      state.lineQuantity = 1;
      state.linePrice = null;
    }

    /** @param {Event} event */
    function handleLineSupplierQuantityInput(event) {
      assertInstanceOf(HTMLInputElement, event.target);
      state.lineSupplierQuantity = parseInt(event.target.value, 10) || null;
    }

    /** @param {Event} event */
    function handleLineQuantityInput(event) {
      assertInstanceOf(HTMLInputElement, event.target);
      state.lineQuantity = parseInt(event.target.value, 10) || null;
    }

    /** @param {Event} event */
    function handleLinePriceInput(event) {
      assertInstanceOf(HTMLInputElement, event.target);
      state.linePrice = parseInt(event.target.value, 10) || null;
    }

    function addLine() {
      if (!state.lineInventory || !state.lineSupplierQuantity || !state.lineQuantity || state.linePrice === null) {
        return;
      }

      // Check if this inventory already exists in lines
      const existingLineIndex = state.lines.findIndex((line) => line.inventoryId === state.lineInventory.id);
      if (existingLineIndex >= 0) {
        // Update existing line
        state.lines[existingLineIndex].supplierQuantity += state.lineSupplierQuantity;
        state.lines[existingLineIndex].quantity += state.lineQuantity;
        state.lines[existingLineIndex].price += state.linePrice;
      }
      else {
        // Add new line
        state.lines.push({
          inventoryId: state.lineInventory.id,
          inventoryName: state.lineInventory.name,
          unitOfMeasurement: state.lineInventory.unit_of_measurement,
          supplierQuantity: state.lineSupplierQuantity,
          quantity: state.lineQuantity,
          price: state.linePrice,
        });
      }

      cancelAddingLine();
    }

    /** @param {number} index */
    function removeLine(index) {
      state.lines.splice(index, 1);
    }

    function getTotalAmount() {
      return state.lines.reduce((sum, line) => sum + line.price, 0);
    }

    /** @param {Event} event */
    function handlePurchaseDateInput(event) {
      assertInstanceOf(HTMLInputElement, event.target);
      state.purchaseDate = event.target.value;
    }

    /** @param {Event} event */
    function handleSupplierSelect(event) {
      const target = /** @type {HTMLElement} */ (event.currentTarget);
      const supplierId = Number(target.dataset.supplierId);
      selectSupplier(supplierId);
    }

    /** @param {KeyboardEvent} event */
    function handleSupplierKeydown(event) {
      if (['Enter', ' '].includes(event.key)) {
        event.preventDefault();
        handleSupplierSelect(event);
      }
    }

    /** @param {Event} event */
    function handleLineInventorySelect(event) {
      const target = /** @type {HTMLElement} */ (event.currentTarget);
      const inventoryId = Number(target.dataset.inventoryId);
      selectLineInventory(inventoryId);
    }

    /** @param {KeyboardEvent} event */
    function handleLineInventoryKeydown(event) {
      if (['Enter', ' '].includes(event.key)) {
        event.preventDefault();
        handleLineInventorySelect(event);
      }
    }

    function handleClearLineInventory() {
      state.lineInventory = null;
      state.lineInventoryId = null;
    }

    /** @param {Event} event */
    function handleRemoveLine(event) {
      const target = /** @type {HTMLElement} */ (event.currentTarget);
      const index = Number(target.dataset.index);
      removeLine(index);
    }

    /** @param {SubmitEvent} event */
    async function handleSubmit(event) {
      event.preventDefault();
      assertInstanceOf(HTMLFormElement, event.currentTarget);

      if (!state.selectedSupplier) {
        form.error = new Error('Please select a supplier.');
        return;
      }

      if (state.lines.length === 0) {
        form.error = new Error('Please add at least one purchase line.');
        return;
      }

      const tx = await database.transaction('write');

      try {
        form.state = 'submitting';
        form.error = null;

        const purchaseTime = new Date(state.purchaseDate).getTime();

        // Insert purchase
        const purchaseResult = await tx.sql`
          INSERT INTO purchases (supplier_id, purchase_time)
          VALUES (${state.selectedSupplier.id}, ${purchaseTime})
          RETURNING id;
        `;

        const purchaseId = Number(purchaseResult.rows[0].id);

        // Insert purchase lines
        for (let i = 0; i < state.lines.length; i++) {
          const line = state.lines[i];
          await tx.sql`
            INSERT INTO purchase_lines (purchase_id, line_number, inventory_id, supplier_quantity, quantity, price)
            VALUES (${purchaseId}, ${i + 1}, ${line.inventoryId}, ${line.supplierQuantity}, ${line.quantity}, ${line.price});
          `;
        }

        await tx.commit();

        form.state = 'success';
        await feedbackDelay();

        host.dispatchEvent(new CustomEvent('purchase-created', {
          detail: { purchaseId },
          bubbles: true,
          composed: true,
        }));

        dialog.open = false;
        // Reset form
        clearSupplier();
        state.purchaseDate = new Date().toISOString().split('T')[0];
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
      if (form.error instanceof Error) errorAlertDialog.open = true;
      else errorAlertDialog.open = false;
    });

    function handleDismissErrorDialog() { form.error = null; }

    function renderSupplierSelector() {
      if (state.selectedSupplier) {
        return html`
          <div style="background-color: var(--md-sys-color-surface-container); padding: 16px; border-radius: var(--md-sys-shape-corner-medium);">
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <div>
                <p class="label-small" style="color: var(--md-sys-color-on-surface-variant); margin: 0;">Supplier</p>
                <p class="title-medium" style="margin: 4px 0 0 0;">${state.selectedSupplier.name}</p>
                ${state.selectedSupplier.phone_number ? html`
                  <p class="body-small" style="color: var(--md-sys-color-on-surface-variant); margin: 4px 0 0 0;">
                    ${state.selectedSupplier.phone_number}
                  </p>
                ` : nothing}
              </div>
              <button role="button" class="text" @click=${clearSupplier} aria-label="Change supplier">
                <material-symbols name="edit"></material-symbols>
              </button>
            </div>
          </div>
        `;
      }

      return html`
        <div style="display: flex; flex-direction: column; gap: 16px;">
          <!-- Search Field -->
          <div class="outlined-text-field">
            <div class="container">
              <material-symbols name="search" class="leading-icon" aria-hidden="true"></material-symbols>
              <label for="supplier-search-input">Search Supplier</label>
              <input
                ${readValue(state, 'supplierSearchQuery')}
                id="supplier-search-input"
                type="text"
                placeholder=" "
                autocomplete="off"
                @input=${handleSupplierSearchInput}
              />
            </div>
          </div>

          <!-- Supplier List -->
          <div style="max-height: 200px; overflow-y: auto; border: 1px solid var(--md-sys-color-outline-variant); border-radius: var(--md-sys-shape-corner-medium);">
            ${state.isLoadingSuppliers ? html`
              <div style="padding: 16px; text-align: center; color: var(--md-sys-color-on-surface-variant);">
                Loading...
              </div>
            ` : state.suppliers.length === 0 ? html`
              <div style="padding: 16px; text-align: center; color: var(--md-sys-color-on-surface-variant);">
                No suppliers found.
              </div>
            ` : html`
              <ul role="listbox" style="list-style: none; padding: 0; margin: 0;">
                ${state.suppliers.map((supplier) => html`
                  <li
                    role="option"
                    tabindex="0"
                    aria-selected="false"
                    data-supplier-id="${supplier.id}"
                    @click=${handleSupplierSelect}
                    @keydown=${handleSupplierKeydown}
                    style="
                      padding: 12px 16px;
                      cursor: pointer;
                      display: flex;
                      justify-content: space-between;
                      align-items: center;
                      border-bottom: 1px solid var(--md-sys-color-outline-variant);
                    "
                  >
                    <div>
                      <p style="margin: 0; font-weight: 500;">${supplier.name}</p>
                      ${supplier.phone_number ? html`
                        <p style="margin: 0; font-size: 0.875rem; color: var(--md-sys-color-on-surface-variant);">
                          ${supplier.phone_number}
                        </p>
                      ` : nothing}
                    </div>
                  </li>
                `)}
              </ul>
            `}
          </div>
        </div>
      `;
    }

    function renderAddLineForm() {
      if (!state.addingLine) return nothing;

      return html`
        <div style="background-color: var(--md-sys-color-surface-container-high); padding: 16px; border-radius: var(--md-sys-shape-corner-medium); margin-bottom: 16px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
            <h4 class="title-small" style="margin: 0;">Add Item</h4>
            <button role="button" class="text" @click=${cancelAddingLine} aria-label="Cancel">
              <material-symbols name="close"></material-symbols>
            </button>
          </div>

          ${!state.lineInventory ? html`
            <!-- Inventory Search -->
            <div class="outlined-text-field" style="margin-bottom: 12px;">
              <div class="container">
                <material-symbols name="search" class="leading-icon" aria-hidden="true"></material-symbols>
                <label for="line-inventory-search-input">Search Inventory</label>
                <input
                  ${readValue(state, 'inventorySearchQuery')}
                  id="line-inventory-search-input"
                  type="text"
                  placeholder=" "
                  autocomplete="off"
                  @input=${handleInventorySearchInput}
                />
              </div>
            </div>

            <!-- Inventory List -->
            <div style="max-height: 200px; overflow-y: auto; border: 1px solid var(--md-sys-color-outline-variant); border-radius: var(--md-sys-shape-corner-medium);">
              ${state.isLoadingInventories ? html`
                <div style="padding: 16px; text-align: center; color: var(--md-sys-color-on-surface-variant);">
                  Loading...
                </div>
              ` : state.inventories.length === 0 ? html`
                <div style="padding: 16px; text-align: center; color: var(--md-sys-color-on-surface-variant);">
                  No inventories found.
                </div>
              ` : html`
                <ul role="listbox" style="list-style: none; padding: 0; margin: 0;">
                  ${state.inventories.map((inv) => html`
                    <li
                      role="option"
                      tabindex="0"
                      aria-selected="false"
                      data-inventory-id="${inv.id}"
                      @click=${handleLineInventorySelect}
                      @keydown=${handleLineInventoryKeydown}
                      style="
                        padding: 12px 16px;
                        cursor: pointer;
                        border-bottom: 1px solid var(--md-sys-color-outline-variant);
                      "
                    >
                      <p style="margin: 0; font-weight: 500;">${inv.name}</p>
                      <p style="margin: 0; font-size: 0.875rem; color: var(--md-sys-color-on-surface-variant);">
                        Stock: ${inv.stock}${inv.unit_of_measurement ? ` ${inv.unit_of_measurement}` : ''} | Unit Price: ${i18n.displayCurrency(inv.unit_price)}
                      </p>
                    </li>
                  `)}
                </ul>
              `}
            </div>
          ` : html`
            <!-- Selected Inventory -->
            <div style="background-color: var(--md-sys-color-primary-container); padding: 12px; border-radius: var(--md-sys-shape-corner-small); margin-bottom: 16px;">
              <div style="display: flex; justify-content: space-between; align-items: center;">
                <div>
                  <p class="body-medium" style="margin: 0; font-weight: 500;">${state.lineInventory.name}</p>
                  <p class="body-small" style="margin: 4px 0 0 0; color: var(--md-sys-color-on-primary-container);">
                    Current Stock: ${state.lineInventory.stock}${state.lineInventory.unit_of_measurement ? ` ${state.lineInventory.unit_of_measurement}` : ''}
                  </p>
                </div>
                <button role="button" class="text" @click=${handleClearLineInventory} aria-label="Change inventory">
                  <material-symbols name="edit"></material-symbols>
                </button>
              </div>
            </div>

            <!-- Quantity and Price Inputs -->
            <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px;">
              <div class="outlined-text-field" style="--md-sys-density: -4;">
                <div class="container">
                  <label for="line-supplier-qty-input">Supplier Qty</label>
                  <input
                    id="line-supplier-qty-input"
                    type="number"
                    inputmode="numeric"
                    min="1"
                    placeholder=" "
                    .value=${String(state.lineSupplierQuantity ?? '')}
                    @input=${handleLineSupplierQuantityInput}
                  />
                </div>
              </div>
              <div class="outlined-text-field" style="--md-sys-density: -4;">
                <div class="container">
                  <label for="line-qty-input">Internal Qty</label>
                  <input
                    id="line-qty-input"
                    type="number"
                    inputmode="numeric"
                    min="1"
                    placeholder=" "
                    .value=${String(state.lineQuantity ?? '')}
                    @input=${handleLineQuantityInput}
                  />
                </div>
              </div>
              <div class="outlined-text-field" style="--md-sys-density: -4;">
                <div class="container">
                  <label for="line-price-input">Total Price</label>
                  <input
                    id="line-price-input"
                    type="number"
                    inputmode="numeric"
                    min="0"
                    placeholder=" "
                    .value=${String(state.linePrice ?? '')}
                    @input=${handleLinePriceInput}
                  />
                </div>
              </div>
            </div>

            <div style="display: flex; justify-content: flex-end; margin-top: 12px;">
              <button
                role="button"
                type="button"
                class="tonal"
                @click=${addLine}
                ?disabled=${!state.lineInventory || !state.lineSupplierQuantity || !state.lineQuantity || state.linePrice === null}
              >
                <material-symbols name="add"></material-symbols>
                Add Item
              </button>
            </div>
          `}
        </div>
      `;
    }

    function renderPurchaseLines() {
      if (!state.selectedSupplier) return nothing;

      return html`
        <div style="margin-top: 24px; padding-top: 24px; border-top: 1px solid var(--md-sys-color-outline-variant);">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
            <h3 class="title-medium" style="margin: 0;">Purchase Items</h3>
            ${!state.addingLine ? html`
              <button role="button" class="text" @click=${startAddingLine}>
                <material-symbols name="add"></material-symbols>
                Add Item
              </button>
            ` : nothing}
          </div>

          ${renderAddLineForm()}

          ${state.lines.length === 0 ? html`
            <div style="padding: 24px; text-align: center; color: var(--md-sys-color-on-surface-variant); background-color: var(--md-sys-color-surface-container); border-radius: var(--md-sys-shape-corner-medium);">
              <material-symbols name="shopping_cart" size="48"></material-symbols>
              <p style="margin: 8px 0 0 0;">No items added yet.</p>
              <p class="body-small" style="margin: 4px 0 0 0;">Click "Add Item" to add purchase items.</p>
            </div>
          ` : html`
            <table role="table" aria-label="Purchase lines" style="--md-sys-density: -4; width: 100%;">
              <thead>
                <tr>
                  <th scope="col">Item</th>
                  <th scope="col" class="numeric" style="width: 80px;">Supp. Qty</th>
                  <th scope="col" class="numeric" style="width: 80px;">Int. Qty</th>
                  <th scope="col" class="numeric" style="width: 120px;">Price</th>
                  <th scope="col" style="width: 48px;"></th>
                </tr>
              </thead>
              <tbody>
                ${state.lines.map((line, index) => html`
                  <tr>
                    <td>
                      <span style="font-weight: 500;">${line.inventoryName}</span>
                      ${line.unitOfMeasurement ? html`
                        <span style="color: var(--md-sys-color-on-surface-variant); font-size: 0.875rem;"> / ${line.unitOfMeasurement}</span>
                      ` : nothing}
                    </td>
                    <td class="numeric">${line.supplierQuantity}</td>
                    <td class="numeric">${line.quantity}</td>
                    <td class="numeric">${i18n.displayCurrency(line.price)}</td>
                    <td class="center">
                      <button role="button" class="text" data-index="${index}" @click=${handleRemoveLine} aria-label="Remove item">
                        <material-symbols name="delete" size="20"></material-symbols>
                      </button>
                    </td>
                  </tr>
                `)}
              </tbody>
              <tfoot>
                <tr style="font-weight: bold; background-color: var(--md-sys-color-surface-container-low);">
                  <td colspan="3">Total</td>
                  <td class="numeric">${i18n.displayCurrency(getTotalAmount())}</td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          `}
        </div>
      `;
    }

    useEffect(host, function renderDialog() {
      render(html`
        <dialog
          ${dialog.element}
          id="purchase-creation-dialog"
          class="full-screen"
          aria-labelledby="purchase-creation-dialog-title"
        >
          <form class="container" @submit=${handleSubmit}>
            <header>
              <h2 id="purchase-creation-dialog-title">New Purchase</h2>
              <button
                role="button"
                type="button"
                class="text"
                commandfor="purchase-creation-dialog"
                command="close"
              ><material-symbols name="close"></material-symbols></button>
              <button
                role="button"
                type="submit"
                name="action"
                ?disabled=${!state.selectedSupplier || state.lines.length === 0}
              >Save as Draft</button>
            </header>

            <div class="content">
              ${form.state !== 'idle' ? html`
                <div role="status" aria-live="polite" aria-busy="true">
                  <div role="progressbar" class="linear indeterminate">
                    <div class="track"><div class="indicator"></div></div>
                  </div>
                  <p>Creating purchase...</p>
                </div>
              ` : nothing}

              <div style="display: flex; flex-direction: column; gap: 16px; padding: 16px 0px; max-width: 800px; margin: 0 auto;">
                <!-- Purchase Date -->
                <div class="outlined-text-field" style="max-width: 200px;">
                  <div class="container">
                    <label for="purchase-date-input">Purchase Date</label>
                    <input
                      id="purchase-date-input"
                      name="purchaseDate"
                      type="date"
                      placeholder=" "
                      required
                      .value=${state.purchaseDate}
                      @input=${handlePurchaseDateInput}
                    />
                  </div>
                </div>

                <h3 class="title-medium" style="margin: 8px 0 0 0;">Supplier</h3>
                ${renderSupplierSelector()}

                ${renderPurchaseLines()}
              </div>
            </div>
          </form>
        </dialog>

        <dialog ${errorAlertDialog.element} role="alertdialog">
          <div class="container">
            <material-symbols name="error"></material-symbols>
            <header>
              <h3>Error</h3>
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
                >Dismiss</button>
              </li>
            </menu>
          </div>
        </dialog>
      `);
    });
  }
}

defineWebComponent('purchase-creation-dialog', PurchaseCreationDialogElement);
