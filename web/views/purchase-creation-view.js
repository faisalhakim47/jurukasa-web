import { html, nothing } from 'lit-html';
import { reactive } from '@vue/reactivity';

import { defineWebComponent } from '#web/component.js';
import { DatabaseContextElement } from '#web/contexts/database-context.js';
import { I18nContextElement } from '#web/contexts/i18n-context.js';
import { RouterContextElement } from '#web/contexts/router-context.js';
import { useBusyStateUntil } from '#web/contexts/ready-context.js';
import { readValue } from '#web/directives/read-value.js';
import { useAdoptedStyleSheets } from '#web/hooks/use-adopted-style-sheets.js';
import { useContext } from '#web/hooks/use-context.js';
import { useDialog } from '#web/hooks/use-dialog.js';
import { useEffect } from '#web/hooks/use-effect.js';
import { useRender } from '#web/hooks/use-render.js';
import { webStyleSheets } from '#web/styles.js';
import { assertInstanceOf } from '#web/tools/assertion.js';
import { feedbackDelay } from '#web/tools/timing.js';

import '#web/components/material-symbols.js';
import '#web/components/supplier-selector-dialog.js';

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
 * Purchase Creation View Component
 * 
 * Two-column layout:
 * - Left (flex: 1): Purchase builder with purchase date, supplier, and items
 * - Right (320px fixed): Inventory selector for quick item selection
 */
export class PurchaseCreationViewElement extends HTMLElement {
  constructor() {
    super();

    const host = this;
    const database = useContext(host, DatabaseContextElement);
    const i18n = useContext(host, I18nContextElement);
    const router = useContext(host, RouterContextElement);

    const render = useRender(host);
    useAdoptedStyleSheets(host, webStyleSheets);

    const errorAlertDialog = useDialog(host);
    const successDialog = useDialog(host);

    const state = reactive({
      // Inventory selector
      inventories: /** @type {InventoryOption[]} */ ([]),
      isLoadingInventories: false,
      inventorySearchQuery: '',

      // Barcode scanning
      barcodeBuffer: '',
      barcodeStartTime: 0,
      barcodeDetected: false,

      // Purchase data
      selectedSupplierId: /** @type {number | null} */ (null),
      selectedSupplierName: /** @type {string | null} */ (null),
      selectedSupplierPhone: /** @type {string | null} */ (null),
      purchaseDate: new Date().toISOString().split('T')[0],
      lines: /** @type {PurchaseLine[]} */ ([]),
    });

    const form = reactive({
      state: /** @type {'idle' | 'submitting' | 'success' | 'error'} */ ('idle'),
      error: /** @type {Error | null} */ (null),
      lastPurchaseId: /** @type {number | null} */ (null),
    });

    useBusyStateUntil(host, function firstLoad() {
      return !state.isLoadingInventories;
    });

    async function loadInventories() {
      try {
        state.isLoadingInventories = true;
        const searchPattern = state.inventorySearchQuery.trim()
          ? `%${state.inventorySearchQuery.trim()}%`
          : null;

        const result = await database.sql`
          SELECT id, name, unit_price, unit_of_measurement, stock
          FROM inventories
          WHERE ${searchPattern} IS NULL OR name LIKE ${searchPattern}
          ORDER BY name ASC
          LIMIT 100
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

    /**
     * Load inventory by barcode and add to purchase
     * @param {string} barcode
     */
    async function loadInventoryByBarcode(barcode) {
      try {
        const result = await database.sql`
          SELECT i.id, i.name, i.unit_price, i.unit_of_measurement, i.stock
          FROM inventories i
          JOIN inventory_barcodes b ON b.inventory_id = i.id
          WHERE b.code = ${barcode}
          LIMIT 1
        `;

        if (result.rows.length > 0) {
          const row = result.rows[0];
          const inventory = /** @type {InventoryOption} */ ({
            id: Number(row.id),
            name: String(row.name),
            unit_price: Number(row.unit_price),
            unit_of_measurement: row.unit_of_measurement ? String(row.unit_of_measurement) : null,
            stock: Number(row.stock),
          });
          addInventoryToPurchase(inventory);
        }
      }
      catch (error) {
        console.error('Failed to load inventory by barcode:', error);
      }
    }

    function getTotalAmount() {
      return state.lines.reduce((sum, line) => sum + line.price, 0);
    }

    /** @param {CustomEvent} event */
    function handleSupplierSelect(event) {
      const { supplierId, supplierName, phoneNumber } = event.detail;
      state.selectedSupplierId = supplierId;
      state.selectedSupplierName = supplierName;
      state.selectedSupplierPhone = phoneNumber;
    }

    function clearSupplier() {
      state.selectedSupplierId = null;
      state.selectedSupplierName = null;
      state.selectedSupplierPhone = null;
      state.lines = [];
    }

    /** @param {InventoryOption} inventory */
    function addInventoryToPurchase(inventory) {
      if (!state.selectedSupplierId) return;

      const existingIndex = state.lines.findIndex((line) => line.inventoryId === inventory.id);

      if (existingIndex >= 0) {
        // Update existing line
        state.lines[existingIndex].supplierQuantity += 1;
        state.lines[existingIndex].quantity += 1;
        state.lines[existingIndex].price += inventory.unit_price;
      }
      else {
        // Add new line
        state.lines.push({
          inventoryId: inventory.id,
          inventoryName: inventory.name,
          unitOfMeasurement: inventory.unit_of_measurement,
          supplierQuantity: 1,
          quantity: 1,
          price: inventory.unit_price,
        });
      }
    }

    /** @param {number} index */
    function incrementLineQuantity(index) {
      const line = state.lines[index];
      const inventory = state.inventories.find((inv) => inv.id === line.inventoryId);
      if (!inventory) return;

      line.supplierQuantity += 1;
      line.quantity += 1;
      line.price += inventory.unit_price;
    }

    /** @param {number} index */
    function decrementLineQuantity(index) {
      const line = state.lines[index];
      const inventory = state.inventories.find((inv) => inv.id === line.inventoryId);
      if (!inventory) return;

      if (line.quantity > 1) {
        line.supplierQuantity -= 1;
        line.quantity -= 1;
        line.price -= inventory.unit_price;
      }
      else {
        removeLine(index);
      }
    }

    /** @param {number} index */
    function removeLine(index) {
      state.lines.splice(index, 1);
    }

    function clearPurchase() {
      state.purchaseDate = new Date().toISOString().split('T')[0];
      clearSupplier();
    }

    /** @param {SubmitEvent} event */
    async function handleSubmit(event) {
      event.preventDefault();

      if (!state.selectedSupplierId) {
        form.error = new Error('Please select a supplier.');
        return;
      }

      if (state.lines.length === 0) {
        form.error = new Error('Please add at least one item to the purchase.');
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
          VALUES (${state.selectedSupplierId}, ${purchaseTime})
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
        form.lastPurchaseId = purchaseId;

        successDialog.open = true;

        await feedbackDelay();
        clearPurchase();

        await feedbackDelay();
        successDialog.open = false;

        router.navigate({ pathname: '/procurement/purchases', replace: false });
        form.state = 'idle';
      }
      catch (error) {
        await tx.rollback();
        form.state = 'error';
        form.error = error instanceof Error ? error : new Error(String(error));
      }
    }

    useEffect(host, function syncErrorAlertDialogState() {
      if (form.error instanceof Error && form.state !== 'submitting') {
        errorAlertDialog.open = true;
      }
      else {
        errorAlertDialog.open = false;
      }
    });

    function handleDismissErrorDialog() {
      form.error = null;
      form.state = 'idle';
    }

    /** @param {Event} event */
    function handleInventorySearchInput(event) {
      assertInstanceOf(HTMLInputElement, event.target);
      const currentTime = Date.now();
      const input = event.target.value;

      // Track timing for barcode detection
      if (state.barcodeBuffer === '') {
        state.barcodeStartTime = currentTime;
      }

      state.barcodeBuffer = input;
      state.inventorySearchQuery = input;

      // Regular search if not in rapid input mode
      loadInventories();
    }

    /** @param {KeyboardEvent} event */
    function handleInventorySearchKeyDown(event) {
      if (event.key === 'Enter') {
        event.preventDefault();

        const currentTime = Date.now();
        const elapsedTime = currentTime - state.barcodeStartTime;
        const inputLength = state.barcodeBuffer.length;

        // Barcode detection: >5 chars in <1000ms
        if (inputLength > 5 && elapsedTime < 1000) {
          state.barcodeDetected = true;
          const barcode = state.barcodeBuffer.trim();

          // Clear search field after barcode detected
          state.inventorySearchQuery = '';
          state.barcodeBuffer = '';

          // Load and add inventory by barcode
          loadInventoryByBarcode(barcode);
        }
        else {
          // Normal search behavior - just reset buffer
          state.barcodeBuffer = '';
        }
      }
    }

    /** @param {Event} event */
    function handleInventorySearchFocus(event) {
      // Reset barcode detection state on focus
      state.barcodeBuffer = '';
      state.barcodeStartTime = 0;
      state.barcodeDetected = false;
    }

    /** @param {Event} event */
    function handleAddInventoryToPurchase(event) {
      const target = /** @type {HTMLElement} */ (event.currentTarget);
      const inventoryId = Number(target.dataset.inventoryId);
      const inventory = state.inventories.find(function (inventory) {
        return inventory.id === inventoryId;
      });
      if (inventory) addInventoryToPurchase(inventory);
    }

    /** @param {Event} event */
    function handleDecrementLineQuantity(event) {
      const target = /** @type {HTMLElement} */ (event.currentTarget);
      const index = Number(target.dataset.index);
      decrementLineQuantity(index);
    }

    /** @param {Event} event */
    function handleIncrementLineQuantity(event) {
      const target = /** @type {HTMLElement} */ (event.currentTarget);
      const index = Number(target.dataset.index);
      incrementLineQuantity(index);
    }

    /** @param {Event} event */
    function handleRemoveLine(event) {
      const target = /** @type {HTMLElement} */ (event.currentTarget);
      const index = Number(target.dataset.index);
      removeLine(index);
    }

    useEffect(host, loadInventories);

    function renderInventorySelector() {
      return html`
        <aside style="
          width: 320px;
          flex-shrink: 0;
          display: flex;
          flex-direction: column;
          border-left: 1px solid var(--md-sys-color-outline-variant);
          background-color: var(--md-sys-color-surface);
        ">
          <header style="padding: 16px; border-bottom: 1px solid var(--md-sys-color-outline-variant);">
            <h3 class="title-medium" style="margin: 0 0 12px 0;">Products</h3>
            <div class="outlined-text-field" style="--md-sys-density: -4;">
              <div class="container">
                <material-symbols name="search" class="leading-icon" aria-hidden="true"></material-symbols>
                <label for="inventory-search-input">Search</label>
                <input
                  ${readValue(state, 'inventorySearchQuery')}
                  id="inventory-search-input"
                  type="text"
                  placeholder=" "
                  autocomplete="off"
                  @input=${handleInventorySearchInput}
                  @keydown=${handleInventorySearchKeyDown}
                  @focus=${handleInventorySearchFocus}
                />
              </div>
            </div>
          </header>
          <div style="flex: 1; overflow-y: auto;">
            ${state.isLoadingInventories ? html`
              <div style="display: flex; justify-content: center; padding: 24px;">
                <div role="progressbar" class="linear indeterminate" style="width: 100px;">
                  <div class="track"><div class="indicator"></div></div>
                </div>
              </div>
            ` : state.inventories.length === 0 ? html`
              <div style="text-align: center; padding: 24px; color: var(--md-sys-color-on-surface-variant);">
                <material-symbols name="inventory_2" size="48"></material-symbols>
                <p>No products found</p>
              </div>
            ` : html`
              <div role="list">
                ${state.inventories.map(function (inventory) {
        return html`
                    <div
                      role="listitem"
                      class="divider-inset"
                      tabindex="0"
                      data-inventory-id="${inventory.id}"
                      @click=${handleAddInventoryToPurchase}
                    >
                      <div class="content">
                        <span class="headline">${inventory.name}</span>
                        <span class="supporting-text">
                          Stock: ${inventory.stock}${inventory.unit_of_measurement ? ` ${inventory.unit_of_measurement}` : ''} | ${i18n.displayCurrency(inventory.unit_price)}
                        </span>
                      </div>
                    </div>
                  `;
      })}
              </div>
            `}
          </div>
        </aside>
      `;
    }

    function renderPurchaseHeader() {
      return html`
        <div style="display: flex; gap: 16px; flex-wrap: wrap; margin-bottom: 16px;">
          <div class="outlined-text-field" style="--md-sys-density: -4; width: 200px;">
            <div class="container">
              <material-symbols name="schedule" class="leading-icon" aria-hidden="true"></material-symbols>
              <label for="purchase-date-input">Purchase Date</label>
              <input
                id="purchase-date-input"
                type="date"
                placeholder=" "
                .value=${state.purchaseDate}
                @input=${(e) => { state.purchaseDate = e.target.value; }}
              />
            </div>
          </div>
          ${state.selectedSupplierId ? html`
            <label style="
              flex: 1;
              min-width: 200px;
              background-color: var(--md-sys-color-surface-container);
              border-radius: var(--md-sys-shape-corner-small);
              display: flex;
              justify-content: space-between;
              align-items: center;
              padding-inline: 12px;
            ">
              <div style="display: flex; gap: 4px; line-height: var(--md-sys-typescale-body-large-line-height);">
                <span style="color: var(--md-sys-color-on-surface-variant);">Selected supplier: </span>
                <span style="font-weight: 500;">${state.selectedSupplierName}</span>
                ${state.selectedSupplierPhone ? html`<span style="color: var(--md-sys-color-on-surface-variant);">(${state.selectedSupplierPhone})</span>` : nothing}
              </div>
              <button
                role="button"
                type="button"
                class="text"
                aria-label="Change supplier"
                commandfor="supplier-selector-dialog"
                command="--open"
              >
                <material-symbols name="edit"></material-symbols>
              </button>
            </label>
          ` : html`
            <button
              role="button"
              type="button"
              class="outlined"
              style="flex: 1; min-width: 200px;"
              commandfor="supplier-selector-dialog"
              command="--open"
            >
              <material-symbols name="local_shipping"></material-symbols>
              Select Supplier
            </button>
          `}
        </div>
      `;
    }

    function renderPurchaseItemsTable() {
      return html`
        <section style="margin-bottom: 16px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
            <h3 class="title-small" style="margin: 0;">Items</h3>
            ${state.lines.length > 0 ? html`
              <span class="label-medium" style="color: var(--md-sys-color-on-surface-variant);">
                ${state.lines.length} item${state.lines.length !== 1 ? 's' : ''}
              </span>
            ` : nothing}
          </div>
          ${state.lines.length === 0 ? html`
            <div style="
              padding: 32px;
              text-align: center;
              background-color: var(--md-sys-color-surface-container);
              border-radius: var(--md-sys-shape-corner-medium);
              color: var(--md-sys-color-on-surface-variant);
            ">
              ${!state.selectedSupplierId ? html`
                <material-symbols name="local_shipping" size="48"></material-symbols>
                <p style="margin: 8px 0 0 0;">No supplier selected</p>
                <p class="body-small">Select a supplier to start adding items</p>
              ` : html`
                <material-symbols name="shopping_cart" size="48"></material-symbols>
                <p style="margin: 8px 0 0 0;">No items added yet</p>
                <p class="body-small">Select products from the right panel</p>
              `}
            </div>
          ` : html`
            <table role="table" aria-label="Purchase items" style="--md-sys-density: -4; width: 100%;">
              <thead>
                <tr>
                  <th scope="col">Product</th>
                  <th scope="col" class="numeric" style="width: 80px;">Supp. Qty</th>
                  <th scope="col" class="numeric" style="width: 80px;">Int. Qty</th>
                  <th scope="col" class="numeric" style="width: 100px;">Total</th>
                  <th scope="col" style="width: 48px;"></th>
                </tr>
              </thead>
              <tbody>
                ${state.lines.map(function (line, index) {
        return html`
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
                        <div style="display: inline-flex; align-items: center; gap: 4px;">
                          <button
                            role="button"
                            type="button"
                            class="text"
                            data-index="${index}"
                            @click=${handleDecrementLineQuantity}
                            aria-label="Decrease quantity"
                            style="min-width: 32px; min-height: 32px; padding: 0;"
                          >
                            <material-symbols name="remove" size="20"></material-symbols>
                          </button>
                          <button
                            role="button"
                            type="button"
                            class="text"
                            data-index="${index}"
                            @click=${handleIncrementLineQuantity}
                            aria-label="Increase quantity"
                            style="min-width: 32px; min-height: 32px; padding: 0;"
                          >
                            <material-symbols name="add" size="20"></material-symbols>
                          </button>
                          <button
                            role="button"
                            type="button"
                            class="text"
                            data-index="${index}"
                            @click=${handleRemoveLine}
                            aria-label="Remove item"
                            style="color: var(--md-sys-color-error); min-width: 32px; min-height: 32px; padding: 0;"
                          >
                            <material-symbols name="delete" size="20"></material-symbols>
                          </button>
                        </div>
                      </td>
                    </tr>
                  `;
      })}
              </tbody>
              <tfoot>
                <tr style="font-weight: 500;">
                  <td colspan="3">Total</td>
                  <td class="numeric">${i18n.displayCurrency(getTotalAmount())}</td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          `}
        </section>
      `;
    }

    function renderTotalSummary() {
      return html`
        <div style="display: flex; flex-direction: column; gap: 4px; margin-bottom: 12px;">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <span class="title-medium" style="font-weight: 700;">Total</span>
            <span class="title-medium" style="font-weight: 700; color: var(--md-sys-color-primary);">
              ${i18n.displayCurrency(getTotalAmount())}
            </span>
          </div>
        </div>
      `;
    }

    function renderActionButtons() {
      const canSubmit = state.selectedSupplierId !== null && state.lines.length > 0;

      return html`
        <div style="display: flex; gap: 12px; justify-content: flex-end;">
          <button
            role="button"
            type="button"
            class="text"
            @click=${clearPurchase}
            ?disabled=${state.lines.length === 0}
          >
            <material-symbols name="delete_sweep"></material-symbols>
            Clear
          </button>
          <button
            role="button"
            type="button"
            class="text"
            @click=${() => router.navigate({ pathname: '/procurement/purchases', replace: false })}
          >
            <material-symbols name="cancel"></material-symbols>
            Cancel
          </button>
          <button
            role="button"
            type="submit"
            class="filled"
            ?disabled=${!canSubmit || form.state === 'submitting'}
          >
            ${form.state === 'submitting' ? html`
              <material-symbols name="progress_activity"></material-symbols>
              Saving...
            ` : html`
              <material-symbols name="save"></material-symbols>
              Save Purchase
            `}
          </button>
        </div>
      `;
    }

    function renderPurchaseBuilder() {
      return html`
        <div style="
          flex: 1;
          display: flex;
          flex-direction: column;
          overflow: hidden;
        ">
          <header class="app-bar" style="padding: 16px 24px; border-bottom: 1px solid var(--md-sys-color-outline-variant);">
            <hgroup>
              <h1 style="display: flex; align-items: center; gap: 8px;">
                <material-symbols name="add_shopping_cart" size="32"></material-symbols>
                New Purchase
              </h1>
            </hgroup>
          </header>

          <form @submit=${handleSubmit} style="display: flex; flex-direction: column; flex: 1; overflow: hidden;">
            <div style="flex: 1; overflow-y: auto; padding: 16px 24px;">
              ${renderPurchaseHeader()}
              ${renderPurchaseItemsTable()}
            </div>

            <div style="
              padding: 16px 24px;
              background-color: var(--md-sys-color-surface);
              border-top: 1px solid var(--md-sys-color-outline-variant);
              box-shadow: 0 -2px 4px rgba(0,0,0,0.05);
              z-index: 1;
            ">
              ${renderTotalSummary()}
              ${renderActionButtons()}
            </div>
          </form>
        </div>
      `;
    }

    useEffect(host, function renderPurchaseCreationView() {
      render(html`
        <div style="display: flex; flex-direction: row; height: 100%; width: 100%; overflow: hidden;">
          ${renderPurchaseBuilder()}
          ${renderInventorySelector()}
        </div>

        <supplier-selector-dialog
          id="supplier-selector-dialog"
          @supplier-select=${handleSupplierSelect}
        ></supplier-selector-dialog>

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

        <dialog ${successDialog.element} role="alertdialog">
          <div class="container">
            <material-symbols name="check_circle" style="color: var(--md-sys-color-primary);"></material-symbols>
            <header>
              <h3>Purchase Saved</h3>
            </header>
            <div class="content">
              <p>Purchase #${form.lastPurchaseId} has been saved successfully.</p>
            </div>
          </div>
        </dialog>
      `);
    });
  }
}

defineWebComponent('purchase-creation-view', PurchaseCreationViewElement);
