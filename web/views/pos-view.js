import { html, nothing } from 'lit-html';
import { repeat } from 'lit-html/directives/repeat.js';
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
import { useTranslator } from '#web/hooks/use-translator.js';
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
    const t = useTranslator(host);

    const render = useRender(host);
    useAdoptedStyleSheets(host, webStyleSheets);

    const errorAlertDialog = useDialog(host);
    const successDialog = useDialog(host);

    const state = reactive({
      // Inventory selector
      inventories: /** @type {InventoryItem[]} */ ([]),
      isLoadingInventories: false,
      inventorySearchQuery: '',

      // Barcode scanning
      barcodeBuffer: '',
      barcodeStartTime: 0,
      barcodeDetected: false,

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

      // Auto apply cash payment toggle
      autoApplyCashPayment: false,
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

        state.inventories = result.rows.map(function rowToInventory(row) {
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

    /**
     * Load inventory by barcode and add to sale
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
          const inventory = /** @type {InventoryItem} */ ({
            id: Number(row.id),
            name: String(row.name),
            unit_price: Number(row.unit_price),
            unit_of_measurement: row.unit_of_measurement ? String(row.unit_of_measurement) : null,
            stock: Number(row.stock),
          });
          addInventoryToSale(inventory);
        }
      }
      catch (error) {
        console.error('Failed to load inventory by barcode:', error);
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

        state.discounts = result.rows.map(function rowToDiscount(row) {
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

        state.paymentMethods = result.rows.map(function rowToPaymentMethod(row) {
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
      const existingIndex = state.lines.findIndex(function findLineIdex(line) {
        return line.inventoryId === inventory.id;
      });

      if (existingIndex >= 0) {
        state.lines[existingIndex].quantity += 1;
        state.lines[existingIndex].price = state.lines[existingIndex].quantity * inventory.unit_price;
      }
      else state.lines.push({
        inventoryId: inventory.id,
        inventoryName: inventory.name,
        unitOfMeasurement: inventory.unit_of_measurement,
        unitPrice: inventory.unit_price,
        quantity: 1,
        price: inventory.unit_price,
      });

      autoApplyDiscounts();
      autoApplyCashPayment();
    }

    /** @param {number} index */
    function incrementLineQuantity(index) {
      const line = state.lines[index];
      line.quantity += 1;
      line.price = line.quantity * line.unitPrice;
      autoApplyDiscounts();
      autoApplyCashPayment();
    }

    /** @param {number} index */
    function decrementLineQuantity(index) {
      const line = state.lines[index];
      if (line.quantity > 1) {
        line.quantity -= 1;
        line.price = line.quantity * line.unitPrice;
        autoApplyDiscounts();
        autoApplyCashPayment();
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
      state.appliedDiscounts = state.appliedDiscounts.filter(function (appliedDiscount) {
        const discount = state.discounts.find(function (discount) {
          return discount.id === appliedDiscount.discountId;
        });
        return !discount || discount.inventoryId !== removedLine.inventoryId;
      });

      autoApplyDiscounts();
      autoApplyCashPayment();
    }

    function autoApplyDiscounts() {
      if (!state.autoApplyDiscounts) return;

      // Remove existing auto-applied discounts and re-calculate
      state.appliedDiscounts = [];

      for (const discount of state.discounts) {
        if (discount.inventoryId !== null) {
          // Inventory-specific discount
          const line = state.lines.find(function findLine(line) {
            return line.inventoryId === discount.inventoryId;
          });
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

    // Special identifier for auto-applied cash payment
    const AUTO_CASH_PAYMENT_ID = -1;

    function autoApplyCashPayment() {
      if (!state.autoApplyCashPayment) return;

      // Find cash payment method (the one with zero fees)
      const cashMethod = state.paymentMethods.find(function (method) {
        return method.minFee === 0 && method.maxFee === 0 && method.relFee === 0;
      });

      if (!cashMethod) return;

      // Remove existing auto-applied cash payment
      state.payments = state.payments.filter(function (payment) {
        return payment.paymentMethodId !== AUTO_CASH_PAYMENT_ID;
      });

      // Calculate remaining balance (excluding auto cash)
      const remaining = getRemainingBalance();

      // Only add if there's a positive amount to pay
      if (remaining > 0) {
        const fee = calculatePaymentFee(remaining, cashMethod);
        state.payments.push({
          paymentMethodId: AUTO_CASH_PAYMENT_ID,
          paymentMethodName: cashMethod.name,
          amount: remaining,
          paymentFee: fee,
        });
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

      const isDiscountAlreadyApplied = state.appliedDiscounts.some(function checkApplied(appliedDiscount) {
        return appliedDiscount.discountId === discountId;
      });
      if (isDiscountAlreadyApplied) {
        cancelAddingDiscount();
        return;
      }

      const totalQuantity = state.lines.reduce(function sum(sumOfQuantity, line) {
        return sumOfQuantity + line.quantity;
      }, 0);
      const discountMultiplier = Math.floor(totalQuantity / discount.multipleOfQuantity);

      if (discountMultiplier > 0) state.appliedDiscounts.push({
        discountId: discount.id,
        discountName: discount.name,
        amount: discountMultiplier * discount.amount,
      });

      autoApplyCashPayment();
      cancelAddingDiscount();
    }

    /** @param {number} index */
    function removeDiscount(index) {
      state.appliedDiscounts.splice(index, 1);
      autoApplyCashPayment();
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

      autoApplyCashPayment();
      cancelAddingPayment();
    }

    /** @param {number} index */
    function removePayment(index) {
      const payment = state.payments[index];
      // Prevent removing auto-applied cash payment
      if (payment.paymentMethodId === AUTO_CASH_PAYMENT_ID) return;

      state.payments.splice(index, 1);
      autoApplyCashPayment();
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
      state.autoApplyCashPayment = false;
    }

    /** @param {SubmitEvent} event */
    async function handleSubmit(event) {
      event.preventDefault();
      const tx = await database.transaction('write');
      try {
        form.state = 'submitting';
        form.error = null;

        if (state.lines.length === 0) throw new Error(t('pos', 'atLeastOneItemErrorMessage'));

        const remaining = getRemainingBalance();
        if (remaining > 0) throw new Error(t('pos', 'paymentIncompleteErrorMessage', i18n.displayCurrency(remaining)));

        const saleTime = new Date(state.saleTime).getTime();
        const customerName = state.customerName.trim() || null;

        const saleResult = await tx.sql`
          INSERT INTO sales (customer_name, sale_time)
          VALUES (${customerName}, ${saleTime})
          RETURNING id;
        `;

        const saleId = Number(saleResult.rows[0].id);

        for (let index = 0; index < state.lines.length; index++) {
          const line = state.lines[index];
          await tx.sql`
            INSERT INTO sale_lines (sale_id, line_number, inventory_id, quantity, price, cost)
            VALUES (${saleId}, ${index + 1}, ${line.inventoryId}, ${line.quantity}, ${line.price}, 0);
          `;
        }

        for (let index = 0; index < state.appliedDiscounts.length; index++) {
          const discount = state.appliedDiscounts[index];
          await tx.sql`
            INSERT INTO sale_discounts (sale_id, line_number, discount_id, amount)
            VALUES (${saleId}, ${index + 1}, ${discount.discountId}, ${discount.amount});
          `;
        }

        for (let index = 0; index < state.payments.length; index++) {
          const payment = state.payments[index];
          await tx.sql`
            INSERT INTO sale_payments (sale_id, line_number, payment_method_id, amount, payment_fee)
            VALUES (${saleId}, ${index + 1}, ${payment.paymentMethodId}, ${payment.amount}, ${payment.paymentFee});
          `;
        }

        const postTime = Date.now();
        await tx.sql`UPDATE sales SET post_time = ${postTime} WHERE id = ${saleId};`;

        await tx.commit();

        form.state = 'success';
        form.lastSaleId = saleId;

        successDialog.open = true;
        await feedbackDelay();
        clearSale();
        loadInventories();

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
      errorAlertDialog.open = form.error instanceof Error && form.state !== 'submitting';
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
      if (state.barcodeBuffer === '') state.barcodeStartTime = currentTime;

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

          state.inventorySearchQuery = state.inventorySearchQuery.replace(state.barcodeBuffer, '');
          state.barcodeBuffer = '';

          loadInventoryByBarcode(barcode);
        }
        // Normal search behavior - just reset buffer
        else state.barcodeBuffer = '';
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

    /** @param {Event} event */
    function handleAutoApplyCashPaymentToggle(event) {
      assertInstanceOf(HTMLInputElement, event.target);
      state.autoApplyCashPayment = event.target.checked;
      if (state.autoApplyCashPayment) {
        autoApplyCashPayment();
      }
      else {
        // Remove auto-applied cash payment when toggle is off
        state.payments = state.payments.filter(function (payment) {
          return payment.paymentMethodId !== AUTO_CASH_PAYMENT_ID;
        });
      }
    }

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
            <h3 class="title-medium" style="margin: 0 0 12px 0;">${t('pos', 'productsTitle')}</h3>
            <div class="outlined-text-field" style="--md-sys-density: -4;">
              <div class="container">
                <material-symbols name="search" class="leading-icon" aria-hidden="true"></material-symbols>
                <label for="inventory-search-input">${t('pos', 'searchLabel')}</label>
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
                <div role="progressbar" class="linear indeterminate" style="width: 100px;" aria-label="${t('pos', 'loadingIndicatorAriaLabel')}">
                  <div class="track"><div class="indicator"></div></div>
                </div>
              </div>
            ` : state.inventories.length === 0 ? html`
              <div style="text-align: center; padding: 24px; color: var(--md-sys-color-on-surface-variant);">
                <material-symbols name="inventory_2" size="48"></material-symbols>
                <p>${t('pos', 'noProductsFoundMessage')}</p>
              </div>
            ` : html`
              <div role="list">
                ${repeat(state.inventories, (inventory) => inventory.id, (inventory) => {
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
                          ${t('pos', 'stockLabel')}: ${inventory.stock}${inventory.unit_of_measurement ? ` ${inventory.unit_of_measurement}` : ''}
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
              <label for="sale-time-input">${t('pos', 'saleTimeLabel')}</label>
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
              <label for="customer-name-input">${t('pos', 'customerNameLabel')}</label>
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
            <h3 class="title-small" style="margin: 0;">${t('pos', 'itemsSectionTitle')}</h3>
            ${state.lines.length > 0 ? html`
              <span class="label-medium" style="color: var(--md-sys-color-on-surface-variant);">
                ${state.lines.length === 1 ? t('pos', 'itemsCountLabel', state.lines.length) : t('pos', 'itemsCountLabelPlural', state.lines.length)}
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
              <p style="margin: 8px 0 0 0;">${t('pos', 'noItemsAddedTitle')}</p>
              <p class="body-small">${t('pos', 'noItemsAddedMessage')}</p>
            </div>
          ` : html`
            <table role="table" aria-label="${t('pos', 'itemsTableAriaLabel')}" style="--md-sys-density: -4; width: 100%;">
              <thead>
                <tr>
                  <th scope="col">${t('pos', 'tableHeaderProduct')}</th>
                  <th scope="col" class="numeric" style="width: 100px;">${t('pos', 'tableHeaderUnitPrice')}</th>
                  <th scope="col" class="center" style="width: 120px;">${t('pos', 'tableHeaderQuantity')}</th>
                  <th scope="col" class="numeric" style="width: 100px;">${t('pos', 'tableHeaderTotal')}</th>
                  <th scope="col" style="width: 48px;"></th>
                </tr>
              </thead>
              <tbody>
                ${repeat(state.lines, (line) => line.inventoryId, (line, index) => html`
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
                          aria-label="${t('pos', 'decreaseQuantityAriaLabel')}"
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
                          aria-label="${t('pos', 'increaseQuantityAriaLabel')}"
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
                        aria-label="${t('pos', 'removeItemAriaLabel')}"
                      >
                        <material-symbols name="delete" size="20"></material-symbols>
                      </button>
                    </td>
                  </tr>
                `)}
              </tbody>
              <tfoot>
                <tr style="font-weight: 500;">
                  <td colspan="3">${t('pos', 'subtotalLabel')}</td>
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
            <h3 class="title-small" style="margin: 0;">${t('pos', 'discountsSectionTitle')}</h3>
            <div style="display: flex; align-items: center; gap: 16px;">
              <label for="auto-apply-discounts-checkbox" style="display: flex; align-items: center; gap: 4px; cursor: pointer;">
                <input
                  id="auto-apply-discounts-checkbox"
                  name="auto-apply-discounts"
                  type="checkbox"
                  .checked=${state.autoApplyDiscounts}
                  @change=${handleAutoApplyDiscountsToggle}
                />
                <span class="label-small">${t('pos', 'autoApplyDiscountsLabel')}</span>
              </label>
              ${!state.addingDiscount && generalDiscounts.length > 0 ? html`
                <button role="button" type="button" class="text" @click=${startAddingDiscount}>
                  <material-symbols name="add" size="20"></material-symbols>
                  ${t('pos', 'addDiscountButtonLabel')}
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
                <span class="label-medium">${t('pos', 'selectDiscountLabel')}</span>
                <button role="button" type="button" class="text" @click=${cancelAddingDiscount}>
                  <material-symbols name="close" size="20"></material-symbols>
                </button>
              </div>
              <div style="display: flex; flex-wrap: wrap; gap: 8px;">
                ${repeat(generalDiscounts, (discount) => discount.id, (discount) => {
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
              <p class="body-small" style="margin: 0;">${t('pos', 'noDiscountsAppliedMessage')}</p>
            </div>
          ` : html`
            <table role="table" aria-label="${t('pos', 'discountsTableAriaLabel')}" style="--md-sys-density: -4; width: 100%;">
              <thead>
                <tr>
                  <th scope="col">${t('pos', 'tableHeaderDiscount')}</th>
                  <th scope="col" class="numeric" style="width: 120px;">${t('pos', 'tableHeaderAmount')}</th>
                  <th scope="col" style="width: 48px;"></th>
                </tr>
              </thead>
              <tbody>
                ${repeat(state.appliedDiscounts, (discount) => discount.discountId, (discount, index) => html`
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
                        aria-label="${t('pos', 'removeDiscountAriaLabel')}"
                        style="color: var(--md-sys-color-error);"
                      >
                        <material-symbols name="close" size="20"></material-symbols>
                      </button>
                    </td>
                  </tr>
                `)}
              </tbody>
              <tfoot>
                <tr style="font-weight: 500;">
                  <td>${t('pos', 'totalDiscountLabel')}</td>
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
            <h3 class="title-small" style="margin: 0;">${t('pos', 'paymentsSectionTitle')}</h3>
            <div style="display: flex; align-items: center; gap: 16px;">
              <label for="auto-apply-cash-payment-checkbox" style="display: flex; align-items: center; gap: 4px; cursor: pointer;">
                <input
                  id="auto-apply-cash-payment-checkbox"
                  name="auto-apply-cash-payment"
                  type="checkbox"
                  .checked=${state.autoApplyCashPayment}
                  @change=${handleAutoApplyCashPaymentToggle}
                />
                <span class="label-small">${t('pos', 'autoApplyCashPaymentLabel')}</span>
              </label>
              ${!state.addingPayment && !state.autoApplyCashPayment && state.paymentMethods.length > 0 && getRemainingBalance() > 0 ? html`
                <button role="button" type="button" class="text extra-small" style="--md-sys-density: -4;" @click=${startAddingPayment}>
                  <material-symbols name="add" size="20"></material-symbols>
                  ${t('pos', 'addPaymentButtonLabel')}
                </button>
              ` : nothing}
            </div>
          </div>
          ${state.addingPayment ? html`
            <div style="
              background-color: var(--md-sys-color-surface-container-high);
              padding: 12px;
              border-radius: var(--md-sys-shape-corner-medium);
              margin-bottom: 8px;
            ">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                <span class="label-medium">${t('pos', 'addPaymentTitle')}</span>
                <button role="button" type="button" class="text" @click=${cancelAddingPayment}>
                  <material-symbols name="close" size="20"></material-symbols>
                </button>
              </div>
              <div style="margin-bottom: 12px;">
                <span class="label-small" style="color: var(--md-sys-color-on-surface-variant); display: block; margin-bottom: 8px;">
                  ${t('pos', 'paymentMethodLabel')}
                </span>
                <div style="display: flex; flex-wrap: wrap; gap: 8px;">
                  ${repeat(state.paymentMethods, (method) => method.id, (method) => {
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
                      <label for="payment-amount-input">${t('pos', 'amountLabel')}</label>
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
                    ${t('pos', 'addButtonLabel')}
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
              <p class="body-small" style="margin: 0;">${t('pos', 'noPaymentsAddedMessage')}</p>
            </div>
          ` : html`
            <table role="table" aria-label="${t('pos', 'paymentsTableAriaLabel')}" style="--md-sys-density: -4; width: 100%;">
              <thead>
                <tr>
                  <th scope="col">${t('pos', 'tableHeaderMethod')}</th>
                  <th scope="col" class="numeric" style="width: 100px;">${t('pos', 'tableHeaderAmount')}</th>
                  <th scope="col" class="numeric" style="width: 80px;">${t('pos', 'tableHeaderFee')}</th>
                  <th scope="col" style="width: 48px;"></th>
                </tr>
              </thead>
              <tbody>
                ${repeat(state.payments, (payment) => payment.paymentMethodId, (payment, index) => {
                  const isAutoCash = payment.paymentMethodId === AUTO_CASH_PAYMENT_ID;
                  return html`
                    <tr>
                      <td>
                        ${payment.paymentMethodName}
                        ${isAutoCash ? html`<span class="label-small" style="color: var(--md-sys-color-primary);">${t('pos', 'autoPaymentIndicator')}</span>` : nothing}
                      </td>
                      <td class="numeric">${i18n.displayCurrency(payment.amount)}</td>
                      <td class="numeric" style="color: var(--md-sys-color-error);">
                        ${payment.paymentFee > 0 ? `-${i18n.displayCurrency(payment.paymentFee)}` : '—'}
                      </td>
                      <td class="center">
                        ${!isAutoCash ? html`
                          <button
                            role="button"
                            type="button"
                            class="text"
                            data-index="${index}"
                            @click=${handleRemovePayment}
                            aria-label="${t('pos', 'removePaymentAriaLabel')}"
                            style="color: var(--md-sys-color-error);"
                          >
                            <material-symbols name="close" size="20"></material-symbols>
                          </button>
                        ` : nothing}
                      </td>
                    </tr>
                  `;
                })}
              </tbody>
              <tfoot>
                <tr style="font-weight: 500;">
                  <td>${t('pos', 'totalPaidLabel')}</td>
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
            <span class="title-medium" style="font-weight: 700;">${t('pos', 'totalLabel')}</span>
            <span class="title-medium" style="font-weight: 700; color: var(--md-sys-color-primary);">
              ${i18n.displayCurrency(invoiceAmount)}
            </span>
          </div>
          ${state.payments.length > 0 ? html`
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <span class="body-small">${t('pos', 'paidLabel')}</span>
              <span class="body-small">${i18n.displayCurrency(getTotalPaid())}</span>
            </div>
            ${!isFullyPaid ? html`
              <div style="display: flex; justify-content: space-between; align-items: center;">
                <span class="body-small" style="color: var(--md-sys-color-error);">${t('pos', 'remainingLabel')}</span>
                <span class="body-small" style="color: var(--md-sys-color-error);">
                  ${i18n.displayCurrency(remaining)}
                </span>
              </div>
            ` : nothing}
            ${change > 0 ? html`
              <div style="display: flex; justify-content: space-between; align-items: center;">
                <span class="label-large" style="color: var(--md-sys-color-tertiary);">${t('pos', 'changeLabel')}</span>
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
            ${t('pos', 'clearButtonLabel')}
          </button>
          <button
            role="button"
            type="submit"
            class="filled"
            ?disabled=${!canSubmit || form.state === 'submitting'}
          >
            ${form.state === 'submitting' ? html`
              <material-symbols name="progress_activity"></material-symbols>
              ${t('pos', 'processingButtonLabel')}
            ` : html`
              <material-symbols name="point_of_sale"></material-symbols>
              ${t('pos', 'completeSaleButtonLabel')}
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
                ${t('pos', 'posTitle')}
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
              <h3>${t('pos', 'errorTitle')}</h3>
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
                >${t('pos', 'dismissButtonLabel')}</button>
              </li>
            </menu>
          </div>
        </dialog>

        <dialog ${successDialog.element} role="alertdialog">
          <div class="container">
            <material-symbols name="check_circle" style="color: var(--md-sys-color-primary);"></material-symbols>
            <header>
              <h3>${t('pos', 'saleCompleteTitle')}</h3>
            </header>
            <div class="content">
              <p>${t('pos', 'saleCompleteMessage', form.lastSaleId)}</p>
            </div>
          </div>
        </dialog>
      `);
    });
  }
}

defineWebComponent('pos-view', POSViewElement);
