import { html, nothing } from 'lit-html';
import { reactive } from '@vue/reactivity';

import { defineWebComponent } from '#web/component.js';
import { DatabaseContextElement } from '#web/contexts/database-context.js';
import { I18nContextElement } from '#web/contexts/i18n-context.js';
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

/**
 * @typedef {object} InventoryItem
 * @property {number} id
 * @property {string} name
 * @property {number} unit_price
 * @property {string | null} unit_of_measurement
 * @property {number} stock
 */

/**
 * @typedef {object} SaleLine
 * @property {number} inventoryId
 * @property {string} inventoryName
 * @property {string | null} unitOfMeasurement
 * @property {number} unitPrice
 * @property {number} quantity
 * @property {number} price
 */

/**
 * @typedef {object} DiscountItem
 * @property {number} id
 * @property {string} name
 * @property {number | null} inventoryId
 * @property {number} multipleOfQuantity
 * @property {number} amount
 */

/**
 * @typedef {object} AppliedDiscount
 * @property {number} discountId
 * @property {string} discountName
 * @property {number} amount
 */

/**
 * @typedef {object} PaymentMethod
 * @property {number} id
 * @property {string} name
 * @property {number} minFee
 * @property {number} maxFee
 * @property {number} relFee
 */

/**
 * @typedef {object} SalePayment
 * @property {number} paymentMethodId
 * @property {string} paymentMethodName
 * @property {number} amount
 * @property {number} paymentFee
 */

/**
 * POS Cashier View Component
 * 
 * Two-column layout:
 * - Left (flex: 1): Invoice builder with sale time, customer name, items, discounts, payments
 * - Right (320px fixed): Inventory selector for quick item selection
 */
export class POSViewElement extends HTMLElement {
  constructor() {
    super();

    const host = this;
    const database = useContext(host, DatabaseContextElement);
    const i18n = useContext(host, I18nContextElement);

    const render = useRender(host);
    useAdoptedStyleSheets(host, webStyleSheets);

    const errorAlertDialog = useDialog(host);
    const successDialog = useDialog(host);

    const state = reactive({
      // Inventory selector
      inventories: /** @type {InventoryItem[]} */ ([]),
      isLoadingInventories: false,
      inventorySearchQuery: '',

      // Discounts
      discounts: /** @type {DiscountItem[]} */ ([]),
      isLoadingDiscounts: false,

      // Payment methods
      paymentMethods: /** @type {PaymentMethod[]} */ ([]),
      isLoadingPaymentMethods: false,

      // Sale data
      customerName: '',
      saleTime: new Date().toISOString().slice(0, 16), // datetime-local format
      lines: /** @type {SaleLine[]} */ ([]),
      appliedDiscounts: /** @type {AppliedDiscount[]} */ ([]),
      payments: /** @type {SalePayment[]} */ ([]),

      // Payment entry
      addingPayment: false,
      selectedPaymentMethodId: /** @type {number | null} */ (null),
      paymentAmount: /** @type {number | null} */ (null),

      // Discount entry
      addingDiscount: false,
      selectedDiscountId: /** @type {number | null} */ (null),

      // Auto apply discount toggle
      autoApplyDiscounts: true,
    });

    const form = reactive({
      state: /** @type {'idle' | 'submitting' | 'success' | 'error'} */ ('idle'),
      error: /** @type {Error | null} */ (null),
      lastSaleId: /** @type {number | null} */ (null),
    });

    useBusyStateUntil(host, function firstLoad() {
      return !state.isLoadingInventories && !state.isLoadingPaymentMethods;
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
          ORDER BY num_of_sales DESC, name ASC
          LIMIT 100
        `;

        state.inventories = result.rows.map(function (row) {
          return /** @type {InventoryItem} */ ({
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

    async function loadDiscounts() {
      try {
        state.isLoadingDiscounts = true;

        const result = await database.sql`
          SELECT id, name, inventory_id, multiple_of_quantity, amount
          FROM discounts
          ORDER BY name ASC
        `;

        state.discounts = result.rows.map(function (row) {
          return /** @type {DiscountItem} */ ({
            id: Number(row.id),
            name: String(row.name),
            inventoryId: row.inventory_id !== null ? Number(row.inventory_id) : null,
            multipleOfQuantity: Number(row.multiple_of_quantity),
            amount: Number(row.amount),
          });
        });

        state.isLoadingDiscounts = false;
      }
      catch (error) {
        state.isLoadingDiscounts = false;
        console.error('Failed to load discounts:', error);
      }
    }

    async function loadPaymentMethods() {
      try {
        state.isLoadingPaymentMethods = true;

        const result = await database.sql`
          SELECT id, name, min_fee, max_fee, rel_fee
          FROM payment_methods
          ORDER BY name ASC
        `;

        state.paymentMethods = result.rows.map(function (row) {
          return /** @type {PaymentMethod} */ ({
            id: Number(row.id),
            name: String(row.name),
            minFee: Number(row.min_fee),
            maxFee: Number(row.max_fee),
            relFee: Number(row.rel_fee),
          });
        });

        state.isLoadingPaymentMethods = false;
      }
      catch (error) {
        state.isLoadingPaymentMethods = false;
        console.error('Failed to load payment methods:', error);
      }
    }

    function getGrossAmount() {
      return state.lines.reduce((sum, line) => sum + line.price, 0);
    }

    function getTotalDiscount() {
      return state.appliedDiscounts.reduce((sum, d) => sum + d.amount, 0);
    }

    function getTotalFees() {
      return state.payments.reduce((sum, p) => sum + p.paymentFee, 0);
    }

    function getInvoiceAmount() {
      return getGrossAmount() - getTotalDiscount();
    }

    function getTotalPaid() {
      return state.payments.reduce((sum, p) => sum + p.amount, 0);
    }

    function getRemainingBalance() {
      return getInvoiceAmount() - getTotalPaid();
    }

    /** @param {InventoryItem} inventory */
    function addInventoryToSale(inventory) {
      const existingIndex = state.lines.findIndex((line) => line.inventoryId === inventory.id);

      if (existingIndex >= 0) {
        // Increment quantity
        state.lines[existingIndex].quantity += 1;
        state.lines[existingIndex].price = state.lines[existingIndex].quantity * inventory.unit_price;
      }
      else {
        // Add new line
        state.lines.push({
          inventoryId: inventory.id,
          inventoryName: inventory.name,
          unitOfMeasurement: inventory.unit_of_measurement,
          unitPrice: inventory.unit_price,
          quantity: 1,
          price: inventory.unit_price,
        });
      }

      // Auto-apply inventory-specific discounts
      autoApplyDiscounts();
    }

    /** @param {number} index */
    function incrementLineQuantity(index) {
      const line = state.lines[index];
      line.quantity += 1;
      line.price = line.quantity * line.unitPrice;
      autoApplyDiscounts();
    }

    /** @param {number} index */
    function decrementLineQuantity(index) {
      const line = state.lines[index];
      if (line.quantity > 1) {
        line.quantity -= 1;
        line.price = line.quantity * line.unitPrice;
        autoApplyDiscounts();
      }
      else {
        removeLine(index);
      }
    }

    /** @param {number} index */
    function removeLine(index) {
      const removedLine = state.lines[index];
      state.lines.splice(index, 1);

      // Remove associated inventory-specific discounts
      state.appliedDiscounts = state.appliedDiscounts.filter(function (d) {
        const discount = state.discounts.find((disc) => disc.id === d.discountId);
        return !discount || discount.inventoryId !== removedLine.inventoryId;
      });

      autoApplyDiscounts();
    }

    function autoApplyDiscounts() {
      if (!state.autoApplyDiscounts) return;

      // Remove existing auto-applied discounts and re-calculate
      state.appliedDiscounts = [];

      for (const discount of state.discounts) {
        if (discount.inventoryId !== null) {
          // Inventory-specific discount
          const line = state.lines.find((l) => l.inventoryId === discount.inventoryId);
          if (line) {
            const multiplier = Math.floor(line.quantity / discount.multipleOfQuantity);
            if (multiplier > 0) {
              state.appliedDiscounts.push({
                discountId: discount.id,
                discountName: discount.name,
                amount: multiplier * discount.amount,
              });
            }
          }
        }
      }
    }

    function startAddingDiscount() {
      state.addingDiscount = true;
      state.selectedDiscountId = null;
    }

    function cancelAddingDiscount() {
      state.addingDiscount = false;
      state.selectedDiscountId = null;
    }

    /** @param {number} discountId */
    function applyGeneralDiscount(discountId) {
      const discount = state.discounts.find((d) => d.id === discountId);
      if (!discount || discount.inventoryId !== null) return;

      // Check if already applied
      if (state.appliedDiscounts.some((d) => d.discountId === discountId)) {
        cancelAddingDiscount();
        return;
      }

      // Calculate total quantity for general discounts
      const totalQuantity = state.lines.reduce((sum, l) => sum + l.quantity, 0);
      const multiplier = Math.floor(totalQuantity / discount.multipleOfQuantity);

      if (multiplier > 0) {
        state.appliedDiscounts.push({
          discountId: discount.id,
          discountName: discount.name,
          amount: multiplier * discount.amount,
        });
      }

      cancelAddingDiscount();
    }

    /** @param {number} index */
    function removeDiscount(index) {
      state.appliedDiscounts.splice(index, 1);
    }

    function startAddingPayment() {
      state.addingPayment = true;
      state.selectedPaymentMethodId = null;
      state.paymentAmount = getRemainingBalance();
    }

    function cancelAddingPayment() {
      state.addingPayment = false;
      state.selectedPaymentMethodId = null;
      state.paymentAmount = null;
    }

    /**
     * @param {number} amount
     * @param {PaymentMethod} method
     */
    function calculatePaymentFee(amount, method) {
      // relFee is percentage * 10000 (0 - 1000000 represents 0% - 100%)
      const relativeFee = Math.round((amount * method.relFee) / 1000000);
      let fee = relativeFee;

      if (fee < method.minFee) fee = method.minFee;
      if (method.maxFee > 0 && fee > method.maxFee) fee = method.maxFee;

      return fee;
    }

    function addPayment() {
      if (state.selectedPaymentMethodId === null || state.paymentAmount === null || state.paymentAmount <= 0) {
        return;
      }

      const method = state.paymentMethods.find((m) => m.id === state.selectedPaymentMethodId);
      if (!method) return;

      const fee = calculatePaymentFee(state.paymentAmount, method);

      state.payments.push({
        paymentMethodId: method.id,
        paymentMethodName: method.name,
        amount: state.paymentAmount,
        paymentFee: fee,
      });

      cancelAddingPayment();
    }

    /** @param {number} index */
    function removePayment(index) {
      state.payments.splice(index, 1);
    }

    function clearSale() {
      state.customerName = '';
      state.saleTime = new Date().toISOString().slice(0, 16);
      state.lines = [];
      state.appliedDiscounts = [];
      state.payments = [];
      state.addingPayment = false;
      state.addingDiscount = false;
      state.selectedPaymentMethodId = null;
      state.paymentAmount = null;
      state.selectedDiscountId = null;
    }

    /** @param {SubmitEvent} event */
    async function handleSubmit(event) {
      event.preventDefault();

      if (state.lines.length === 0) {
        form.error = new Error('Please add at least one item to the sale.');
        return;
      }

      const remaining = getRemainingBalance();
      if (remaining > 0) {
        form.error = new Error(`Payment is incomplete. Remaining balance: ${i18n.displayCurrency(remaining)}`);
        return;
      }

      const tx = await database.transaction('write');

      try {
        form.state = 'submitting';
        form.error = null;

        const saleTime = new Date(state.saleTime).getTime();
        const customerName = state.customerName.trim() || null;

        // Insert sale
        const saleResult = await tx.sql`
          INSERT INTO sales (customer_name, sale_time)
          VALUES (${customerName}, ${saleTime})
          RETURNING id;
        `;

        const saleId = Number(saleResult.rows[0].id);

        // Insert sale lines
        for (let i = 0; i < state.lines.length; i++) {
          const line = state.lines[i];
          await tx.sql`
            INSERT INTO sale_lines (sale_id, line_number, inventory_id, quantity, price, cost)
            VALUES (${saleId}, ${i + 1}, ${line.inventoryId}, ${line.quantity}, ${line.price}, 0);
          `;
        }

        // Insert sale discounts
        for (let i = 0; i < state.appliedDiscounts.length; i++) {
          const discount = state.appliedDiscounts[i];
          await tx.sql`
            INSERT INTO sale_discounts (sale_id, line_number, discount_id, amount)
            VALUES (${saleId}, ${i + 1}, ${discount.discountId}, ${discount.amount});
          `;
        }

        // Insert sale payments
        for (let i = 0; i < state.payments.length; i++) {
          const payment = state.payments[i];
          await tx.sql`
            INSERT INTO sale_payments (sale_id, line_number, payment_method_id, amount, payment_fee)
            VALUES (${saleId}, ${i + 1}, ${payment.paymentMethodId}, ${payment.amount}, ${payment.paymentFee});
          `;
        }

        // Post the sale
        const postTime = Date.now();
        await tx.sql`
          UPDATE sales SET post_time = ${postTime} WHERE id = ${saleId};
        `;

        await tx.commit();

        form.state = 'success';
        form.lastSaleId = saleId;

        // Show success dialog
        successDialog.open = true;

        await feedbackDelay();
        clearSale();
        loadInventories(); // Refresh inventory stock

        await feedbackDelay();
        successDialog.open = false;
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
      state.inventorySearchQuery = event.target.value;
      loadInventories();
    }

    /** @param {Event} event */
    function handlePaymentMethodSelect(event) {
      assertInstanceOf(HTMLButtonElement, event.currentTarget);
      const methodId = Number(event.currentTarget.dataset.methodId);
      state.selectedPaymentMethodId = methodId;
    }

    /** @param {Event} event */
    function handlePaymentAmountInput(event) {
      assertInstanceOf(HTMLInputElement, event.target);
      state.paymentAmount = parseInt(event.target.value, 10) || null;
    }

    /** @param {Event} event */
    function handleAddInventoryToSale(event) {
      const target = /** @type {HTMLElement} */ (event.currentTarget);
      const inventoryId = Number(target.dataset.inventoryId);
      const inventory = state.inventories.find(function (inventory) {
        return inventory.id === inventoryId;
      });
      if (inventory) addInventoryToSale(inventory);
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

    /** @param {Event} event */
    function handleApplyGeneralDiscount(event) {
      const target = /** @type {HTMLElement} */ (event.currentTarget);
      const discountId = Number(target.dataset.discountId);
      applyGeneralDiscount(discountId);
    }

    /** @param {Event} event */
    function handleRemoveDiscount(event) {
      const target = /** @type {HTMLElement} */ (event.currentTarget);
      const index = Number(target.dataset.index);
      removeDiscount(index);
    }

    /** @param {Event} event */
    function handleRemovePayment(event) {
      const target = /** @type {HTMLElement} */ (event.currentTarget);
      const index = Number(target.dataset.index);
      removePayment(index);
    }

    /** @param {Event} event */
    function handleAutoApplyDiscountsToggle(event) {
      assertInstanceOf(HTMLInputElement, event.target);
      state.autoApplyDiscounts = event.target.checked;
      if (state.autoApplyDiscounts) {
        autoApplyDiscounts();
      }
      else {
        // Clear auto-applied discounts when toggle is off
        state.appliedDiscounts = state.appliedDiscounts.filter(function (d) {
          const discount = state.discounts.find((disc) => disc.id === d.discountId);
          return !discount || discount.inventoryId === null;
        });
      }
    }

    // Initial load
    useEffect(host, loadInventories);
    useEffect(host, loadDiscounts);
    useEffect(host, loadPaymentMethods);

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
                  const isLowStock = inventory.stock > 0 && inventory.stock <= 10;
                  const isOutOfStock = inventory.stock <= 0;
                  const stockColor = isOutOfStock ? 'var(--md-sys-color-error)' : isLowStock ? '#E65100' : 'var(--md-sys-color-on-surface-variant)';

                  return html`
                    <div
                      role="listitem"
                      class="divider-inset"
                      tabindex="0"
                      data-inventory-id="${inventory.id}"
                      @click=${handleAddInventoryToSale}
                    >
                      <div class="content">
                        <span class="headline">${inventory.name}</span>
                        <span class="supporting-text" style="color: ${stockColor};">
                          Stock: ${inventory.stock}${inventory.unit_of_measurement ? ` ${inventory.unit_of_measurement}` : ''}
                        </span>
                      </div>
                      <div class="trailing text">
                        <span style="color: var(--md-sys-color-primary); font-weight: 500;">
                          ${i18n.displayCurrency(inventory.unit_price)}
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

    function renderSaleHeader() {
      return html`
        <div style="display: flex; gap: 16px; flex-wrap: wrap; margin-bottom: 16px;">
          <div class="outlined-text-field" style="--md-sys-density: -4; width: 300px;">
            <div class="container">
              <material-symbols name="schedule" class="leading-icon" aria-hidden="true"></material-symbols>
              <label for="sale-time-input">Sale Time</label>
              <input
                id="sale-time-input"
                type="datetime-local"
                placeholder=" "
                .value=${state.saleTime}
                @input=${(e) => { state.saleTime = e.target.value; }}
              />
            </div>
          </div>
          <div class="outlined-text-field" style="--md-sys-density: -4; flex: 1; min-width: 200px;">
            <div class="container">
              <material-symbols name="person" class="leading-icon" aria-hidden="true"></material-symbols>
              <label for="customer-name-input">Customer Name</label>
              <input
                ${readValue(state, 'customerName')}
                id="customer-name-input"
                type="text"
                placeholder=" "
                autocomplete="off"
              />
            </div>
          </div>
        </div>
      `;
    }

    function renderOrdersTable() {
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
              <material-symbols name="shopping_basket" size="48"></material-symbols>
              <p style="margin: 8px 0 0 0;">No items added yet</p>
              <p class="body-small">Select products from the right panel</p>
            </div>
          ` : html`
            <table role="table" aria-label="Sale items" style="--md-sys-density: -4; width: 100%;">
              <thead>
                <tr>
                  <th scope="col">Product</th>
                  <th scope="col" class="numeric" style="width: 100px;">Unit Price</th>
                  <th scope="col" class="center" style="width: 120px;">Quantity</th>
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
                      <td class="numeric">${i18n.displayCurrency(line.unitPrice)}</td>
                      <td class="center">
                        <div style="display: inline-flex; align-items: center; gap: 4px;">
                          <button
                            role="button"
                            type="button"
                            class="text extra-small"
                            style="--md-sys-density: -4;"
                            data-index="${index}"
                            @click=${handleDecrementLineQuantity}
                            aria-label="Decrease quantity"
                          >
                            <material-symbols name="remove" size="20"></material-symbols>
                          </button>
                          <span style="min-width: 24px; text-align: center;">${line.quantity}</span>
                          <button
                            role="button"
                            type="button"
                            class="text extra-small"
                            style="--md-sys-density: -4;"
                            data-index="${index}"
                            @click=${handleIncrementLineQuantity}
                            aria-label="Increase quantity"
                          >
                            <material-symbols name="add" size="20"></material-symbols>
                          </button>
                        </div>
                      </td>
                      <td class="numeric">${i18n.displayCurrency(line.price)}</td>
                      <td class="center">
                        <button
                          role="button"
                          type="button"
                          class="text extra-small"
                          style="--md-sys-density: -4; color: var(--md-sys-color-error);"
                          data-index="${index}"
                          @click=${handleRemoveLine}
                          aria-label="Remove item"
                        >
                          <material-symbols name="delete" size="20"></material-symbols>
                        </button>
                      </td>
                    </tr>
                  `;
                })}
              </tbody>
              <tfoot>
                <tr style="font-weight: 500;">
                  <td colspan="3">Subtotal</td>
                  <td class="numeric">${i18n.displayCurrency(getGrossAmount())}</td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          `}
        </section>
      `;
    }

    function renderDiscountsTable() {
      const generalDiscounts = state.discounts.filter((d) => d.inventoryId === null);

      return html`
        <section style="margin-bottom: 16px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
            <h3 class="title-small" style="margin: 0;">Discounts</h3>
            <div style="display: flex; align-items: center; gap: 16px;">
              <label for="auto-apply-discounts-checkbox" style="display: flex; align-items: center; gap: 4px; cursor: pointer;">
                <input
                  id="auto-apply-discounts-checkbox"
                  name="auto-apply-discounts"
                  type="checkbox"
                  .checked=${state.autoApplyDiscounts}
                  @change=${handleAutoApplyDiscountsToggle}
                />
                <span class="label-small">Auto apply discounts</span>
              </label>
              ${!state.addingDiscount && generalDiscounts.length > 0 ? html`
                <button role="button" type="button" class="text" @click=${startAddingDiscount}>
                  <material-symbols name="add" size="20"></material-symbols>
                  Add Discount
                </button>
              ` : nothing}
            </div>
          </div>
          ${state.addingDiscount ? html`
            <div style="
              background-color: var(--md-sys-color-surface-container-high);
              padding: 12px;
              border-radius: var(--md-sys-shape-corner-medium);
              margin-bottom: 8px;
            ">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                <span class="label-medium">Select Discount</span>
                <button role="button" type="button" class="text" @click=${cancelAddingDiscount}>
                  <material-symbols name="close" size="20"></material-symbols>
                </button>
              </div>
              <div style="display: flex; flex-wrap: wrap; gap: 8px;">
                ${generalDiscounts.map(function (discount) {
                  const isApplied = state.appliedDiscounts.some((d) => d.discountId === discount.id);
                  return html`
                    <button
                      role="button"
                      type="button"
                      class="${isApplied ? 'tonal' : 'outlined'}"
                      data-discount-id="${discount.id}"
                      @click=${handleApplyGeneralDiscount}
                      ?disabled=${isApplied}
                    >
                      ${discount.name}
                    </button>
                  `;
                })}
              </div>
            </div>
          ` : nothing}
          ${state.appliedDiscounts.length === 0 ? html`
            <div style="
              padding: 16px;
              text-align: center;
              background-color: var(--md-sys-color-surface-container);
              border-radius: var(--md-sys-shape-corner-medium);
              color: var(--md-sys-color-on-surface-variant);
            ">
              <p class="body-small" style="margin: 0;">No discounts applied</p>
            </div>
          ` : html`
            <table role="table" aria-label="Discounts" style="--md-sys-density: -4; width: 100%;">
              <thead>
                <tr>
                  <th scope="col">Discount</th>
                  <th scope="col" class="numeric" style="width: 120px;">Amount</th>
                  <th scope="col" style="width: 48px;"></th>
                </tr>
              </thead>
              <tbody>
                ${state.appliedDiscounts.map(function (discount, index) {
                  return html`
                    <tr>
                      <td>${discount.discountName}</td>
                      <td class="numeric" style="color: var(--md-sys-color-tertiary);">
                        -${i18n.displayCurrency(discount.amount)}
                      </td>
                      <td class="center">
                        <button
                          role="button"
                          type="button"
                          class="text"
                          data-index="${index}"
                          @click=${handleRemoveDiscount}
                          aria-label="Remove discount"
                          style="color: var(--md-sys-color-error);"
                        >
                          <material-symbols name="close" size="20"></material-symbols>
                        </button>
                      </td>
                    </tr>
                  `;
                })}
              </tbody>
              <tfoot>
                <tr style="font-weight: 500;">
                  <td>Total Discount</td>
                  <td class="numeric" style="color: var(--md-sys-color-tertiary);">
                    -${i18n.displayCurrency(getTotalDiscount())}
                  </td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          `}
        </section>
      `;
    }

    function renderPaymentsTable() {
      return html`
        <section style="margin-bottom: 16px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
            <h3 class="title-small" style="margin: 0;">Payments</h3>
            ${!state.addingPayment && state.paymentMethods.length > 0 && getRemainingBalance() > 0 ? html`
              <button role="button" type="button" class="text extra-small" style="--md-sys-density: -4;" @click=${startAddingPayment}>
                <material-symbols name="add" size="20"></material-symbols>
                Add Payment
              </button>
            ` : nothing}
          </div>
          ${state.addingPayment ? html`
            <div style="
              background-color: var(--md-sys-color-surface-container-high);
              padding: 12px;
              border-radius: var(--md-sys-shape-corner-medium);
              margin-bottom: 8px;
            ">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                <span class="label-medium">Add Payment</span>
                <button role="button" type="button" class="text" @click=${cancelAddingPayment}>
                  <material-symbols name="close" size="20"></material-symbols>
                </button>
              </div>
              <div style="margin-bottom: 12px;">
                <span class="label-small" style="color: var(--md-sys-color-on-surface-variant); display: block; margin-bottom: 8px;">
                  Payment Method
                </span>
                <div style="display: flex; flex-wrap: wrap; gap: 8px;">
                  ${state.paymentMethods.map(function (method) {
                    const isSelected = state.selectedPaymentMethodId === method.id;
                    return html`
                      <button
                        role="button"
                        type="button"
                        class="${isSelected ? 'tonal' : 'outlined'}"
                        data-method-id="${method.id}"
                        @click=${handlePaymentMethodSelect}
                      >
                        ${method.name}
                      </button>
                    `;
                  })}
                </div>
              </div>
              ${state.selectedPaymentMethodId !== null ? html`
                <div style="display: flex; gap: 12px; align-items: flex-end;">
                  <div class="outlined-text-field" style="--md-sys-density: -4; flex: 1;">
                    <div class="container">
                      <label for="payment-amount-input">Amount</label>
                      <input
                        id="payment-amount-input"
                        type="number"
                        inputmode="numeric"
                        min="1"
                        placeholder=" "
                        .value=${String(state.paymentAmount ?? '')}
                        @input=${handlePaymentAmountInput}
                      />
                    </div>
                  </div>
                  <button
                    role="button"
                    type="button"
                    class="tonal"
                    @click=${addPayment}
                    ?disabled=${!state.paymentAmount || state.paymentAmount <= 0}
                  >
                    <material-symbols name="check" size="20"></material-symbols>
                    Add
                  </button>
                </div>
              ` : nothing}
            </div>
          ` : nothing}
          ${state.payments.length === 0 ? html`
            <div style="
              padding: 16px;
              text-align: center;
              background-color: var(--md-sys-color-surface-container);
              border-radius: var(--md-sys-shape-corner-medium);
              color: var(--md-sys-color-on-surface-variant);
            ">
              <p class="body-small" style="margin: 0;">No payments added</p>
            </div>
          ` : html`
            <table role="table" aria-label="Payments" style="--md-sys-density: -4; width: 100%;">
              <thead>
                <tr>
                  <th scope="col">Method</th>
                  <th scope="col" class="numeric" style="width: 100px;">Amount</th>
                  <th scope="col" class="numeric" style="width: 80px;">Fee</th>
                  <th scope="col" style="width: 48px;"></th>
                </tr>
              </thead>
              <tbody>
                ${state.payments.map(function (payment, index) {
                  return html`
                    <tr>
                      <td>${payment.paymentMethodName}</td>
                      <td class="numeric">${i18n.displayCurrency(payment.amount)}</td>
                      <td class="numeric" style="color: var(--md-sys-color-error);">
                        ${payment.paymentFee > 0 ? `-${i18n.displayCurrency(payment.paymentFee)}` : '—'}
                      </td>
                      <td class="center">
                        <button
                          role="button"
                          type="button"
                          class="text"
                          data-index="${index}"
                          @click=${handleRemovePayment}
                          aria-label="Remove payment"
                          style="color: var(--md-sys-color-error);"
                        >
                          <material-symbols name="close" size="20"></material-symbols>
                        </button>
                      </td>
                    </tr>
                  `;
                })}
              </tbody>
              <tfoot>
                <tr style="font-weight: 500;">
                  <td>Total Paid</td>
                  <td class="numeric">${i18n.displayCurrency(getTotalPaid())}</td>
                  <td class="numeric" style="color: var(--md-sys-color-error);">
                    ${getTotalFees() > 0 ? `-${i18n.displayCurrency(getTotalFees())}` : '—'}
                  </td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          `}
        </section>
      `;
    }

    function renderTotalSummary() {
      const invoiceAmount = getInvoiceAmount();
      const remaining = getRemainingBalance();
      const isFullyPaid = remaining <= 0;
      const change = remaining < 0 ? Math.abs(remaining) : 0;

      return html`
        <div style="display: flex; flex-direction: column; gap: 4px; margin-bottom: 12px;">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <span class="title-medium" style="font-weight: 700;">Total</span>
            <span class="title-medium" style="font-weight: 700; color: var(--md-sys-color-primary);">
              ${i18n.displayCurrency(invoiceAmount)}
            </span>
          </div>
          ${state.payments.length > 0 ? html`
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <span class="body-small">Paid</span>
              <span class="body-small">${i18n.displayCurrency(getTotalPaid())}</span>
            </div>
            ${!isFullyPaid ? html`
              <div style="display: flex; justify-content: space-between; align-items: center;">
                <span class="body-small" style="color: var(--md-sys-color-error);">Remaining</span>
                <span class="body-small" style="color: var(--md-sys-color-error);">
                  ${i18n.displayCurrency(remaining)}
                </span>
              </div>
            ` : nothing}
            ${change > 0 ? html`
              <div style="display: flex; justify-content: space-between; align-items: center;">
                <span class="label-large" style="color: var(--md-sys-color-tertiary);">Change</span>
                <span class="label-large" style="color: var(--md-sys-color-tertiary);">
                  ${i18n.displayCurrency(change)}
                </span>
              </div>
            ` : nothing}
          ` : nothing}
        </div>
      `;
    }

    function renderActionButtons() {
      const remaining = getRemainingBalance();
      const canSubmit = state.lines.length > 0 && remaining <= 0;

      return html`
        <div style="display: flex; gap: 12px; justify-content: flex-end;">
          <button
            role="button"
            type="button"
            class="text"
            @click=${clearSale}
            ?disabled=${state.lines.length === 0 && state.payments.length === 0}
          >
            <material-symbols name="delete_sweep"></material-symbols>
            Clear
          </button>
          <button
            role="button"
            type="submit"
            class="filled"
            ?disabled=${!canSubmit || form.state === 'submitting'}
          >
            ${form.state === 'submitting' ? html`
              <material-symbols name="progress_activity"></material-symbols>
              Processing...
            ` : html`
              <material-symbols name="point_of_sale"></material-symbols>
              Complete Sale
            `}
          </button>
        </div>
      `;
    }

    function renderInvoiceBuilder() {
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
                <material-symbols name="point_of_sale" size="32"></material-symbols>
                POS Cashier
              </h1>
            </hgroup>
          </header>

          <form @submit=${handleSubmit} style="display: flex; flex-direction: column; flex: 1; overflow: hidden;">
            <div style="flex: 1; overflow-y: auto; padding: 16px 24px;">
              ${renderSaleHeader()}
              ${renderOrdersTable()}
              ${renderDiscountsTable()}
              ${renderPaymentsTable()}
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

    useEffect(host, function renderPOSView() {
      render(html`
        <div style="display: flex; flex-direction: row; height: 100%; width: 100%; overflow: hidden;">
          ${renderInvoiceBuilder()}
          ${renderInventorySelector()}
        </div>

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
              <h3>Sale Complete</h3>
            </header>
            <div class="content">
              <p>Sale #${form.lastSaleId} has been recorded successfully.</p>
            </div>
          </div>
        </dialog>
      `);
    });
  }
}

defineWebComponent('pos-view', POSViewElement);
