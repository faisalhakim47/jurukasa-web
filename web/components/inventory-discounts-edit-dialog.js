import { reactive } from '@vue/reactivity';
import { html, nothing } from 'lit-html';

import { defineWebComponent } from '#web/component.js';
import { useDialog } from '#web/hooks/use-dialog.js';
import { useAdoptedStyleSheets } from '#web/hooks/use-adopted-style-sheets.js';
import { DatabaseContextElement } from '#web/contexts/database-context.js';
import { I18nContextElement } from '#web/contexts/i18n-context.js';
import { useContext } from '#web/hooks/use-context.js';
import { useTranslator } from '#web/hooks/use-translator.js';
import { useEffect } from '#web/hooks/use-effect.js';
import { useRender } from '#web/hooks/use-render.js';
import { webStyleSheets } from '#web/styles.js';
import { assertInstanceOf } from '#web/tools/assertion.js';
import { feedbackDelay } from '#web/tools/timing.js';

import '#web/components/material-symbols.js';
import { readValue } from '#web/directives/read-value.js';
import { useElement } from '#web/hooks/use-element.js';

/**
 * @typedef {object} InventoryInfo
 * @property {number} id
 * @property {string} name
 * @property {number} unit_price
 */

/**
 * @typedef {object} DiscountRow
 * @property {number | null} id - null for new discounts
 * @property {number} multiple_of_quantity
 * @property {number} amount
 */

/**
 * Inventory Discounts Edit Dialog Component
 * 
 * A tabular form dialog for editing inventory-specific discounts.
 * When submitted, replaces all existing discounts for the inventory with the new ones.
 * 
 * @fires inventory-discounts-updated - Fired when discounts are successfully updated. Detail: { inventoryId: number }
 */
export class InventoryDiscountsEditDialogElement extends HTMLElement {
  constructor() {
    super();

    const host = this;
    const database = useContext(host, DatabaseContextElement);
    const i18n = useContext(host, I18nContextElement);
    const t = useTranslator(host);

    const dialog = useDialog(host);
    const errorAlertDialog = useElement(host, HTMLDialogElement);
    const render = useRender(host);
    useAdoptedStyleSheets(host, webStyleSheets);

    const state = reactive({
      inventory: /** @type {InventoryInfo | null} */ (null),
      discounts: /** @type {DiscountRow[]} */ ([]),
      discountsLoading: false,
      discountsError: /** @type {Error | null} */ (null),
      formState: /** @type {'idle' | 'submitting' | 'success' | 'error'} */ ('idle'),
      formError: /** @type {Error | null} */ (null),
    });

    async function loadInventoryAndDiscounts() {
      try {
        const inventoryId = parseInt(dialog.context?.dataset.inventoryId, 10);
        if (isNaN(inventoryId)) return;

        state.discountsLoading = true;
        state.discountsError = null;

        const inventoryResult = await database.sql`
          SELECT id, name, unit_price
          FROM inventories
          WHERE id = ${inventoryId}
        `;

        if (inventoryResult.rows.length === 0) {
          state.inventory = null;
          state.discounts = [];
          state.discountsLoading = false;
          return;
        }

        const invRow = inventoryResult.rows[0];
        state.inventory = {
          id: Number(invRow.id),
          name: String(invRow.name),
          unit_price: Number(invRow.unit_price),
        };

        const discountsResult = await database.sql`
          SELECT id, multiple_of_quantity, amount
          FROM discounts
          WHERE inventory_id = ${inventoryId}
          ORDER BY multiple_of_quantity ASC
        `;

        state.discounts = discountsResult.rows.map(function rowToDiscount(row) {
          return /** @type {DiscountRow} */ ({
            id: Number(row.id),
            multiple_of_quantity: Number(row.multiple_of_quantity),
            amount: Number(row.amount),
          });
        });

        state.discountsLoading = false;
      }
      catch (error) {
        state.discountsError = error instanceof Error ? error : new Error(String(error));
        state.discountsLoading = false;
      }
    }

    useEffect(host, function loadOnOpen() {
      const inventoryId = parseInt(dialog.context?.dataset.inventoryId, 10);
      if (dialog.open && !isNaN(inventoryId)) {
        loadInventoryAndDiscounts();
      }
    });

    function handleAddRow() {
      state.discounts = [...state.discounts, {
        id: null,
        multiple_of_quantity: 1,
        amount: 0,
      }];
    }

    /** @param {Event} event */
    function handleRemoveRow(event) {
      assertInstanceOf(HTMLElement, event.currentTarget);
      const index = parseInt(event.currentTarget.dataset.index, 10);
      if (isNaN(index)) return;
      state.discounts = state.discounts.filter(function (_, i) {
        return i !== index;
      });
    }

    /** @param {Event} event */
    function handleQuantityChange(event) {
      assertInstanceOf(HTMLInputElement, event.currentTarget);
      const index = parseInt(event.currentTarget.dataset.index, 10);
      if (isNaN(index)) return;
      const value = parseInt(event.currentTarget.value, 10);
      if (isNaN(value) || value < 1) return;
      state.discounts = state.discounts.map(function (discount, i) {
        if (i !== index) return discount;
        return { ...discount, multiple_of_quantity: value };
      });
    }

    /** @param {Event} event */
    function handleAmountChange(event) {
      assertInstanceOf(HTMLInputElement, event.currentTarget);
      const index = parseInt(event.currentTarget.dataset.index, 10);
      if (isNaN(index)) return;
      const value = parseInt(event.currentTarget.value, 10);
      if (isNaN(value)) return;
      state.discounts = state.discounts.map(function calculateDiscountAmount(discount, index) {
        if (index !== index) return discount;
        return { ...discount, amount: value };
      });
    }

    /**
     * Calculate total price when discount is applied
     * Formula: Multiple of Quantity * Unit Price - Discount Amount
     * @param {DiscountRow} discount
     */
    function calculateDiscountedTotal(discount) {
      if (!state.inventory) return 0;
      const grossPrice = discount.multiple_of_quantity * state.inventory.unit_price;
      return Math.max(0, grossPrice - discount.amount);
    }

    /** @param {SubmitEvent} event */
    async function handleSubmit(event) {
      event.preventDefault();

      /** @todo use FormData instead of state variable to handle form data */
      assertInstanceOf(HTMLFormElement, event.currentTarget);
      const form = event.currentTarget;
      const data = new FormData(form);

      if (!state.inventory) return;

      const tx = await database.transaction('write');

      try {
        state.formState = 'submitting';
        state.formError = null;

        const inventoryId = state.inventory.id;
        const inventoryName = state.inventory.name;

        for (let i = 0; i < state.discounts.length; i++) {
          const discount = state.discounts[i];
          if (discount.multiple_of_quantity < 1) {
            throw new Error(t('inventory', 'discountValidationErrorPrefix', i + 1) + ' ' + t('inventory', 'multipleOfQuantityMinError'));
          }
          if (discount.amount <= 0) {
            throw new Error(t('inventory', 'discountValidationErrorPrefix', i + 1) + ' ' + t('inventory', 'discountAmountPositiveError'));
          }
        }

        // Check for duplicate multiple_of_quantity values
        const quantities = state.discounts.map(function (d) { return d.multiple_of_quantity; });
        const uniqueQuantities = new Set(quantities);
        if (quantities.length !== uniqueQuantities.size) {
          throw new Error(t('inventory', 'uniqueQuantityError'));
        }

        // Delete all existing discounts for this inventory
        await tx.sql`
          DELETE FROM discounts
          WHERE inventory_id = ${inventoryId}
        `;

        // Insert new discounts
        for (let i = 0; i < state.discounts.length; i++) {
          const discount = state.discounts[i];
          const discountName = `${inventoryName} - Buy ${discount.multiple_of_quantity} Discount`;
          await tx.sql`
            INSERT INTO discounts (name, inventory_id, multiple_of_quantity, amount)
            VALUES (${discountName}, ${inventoryId}, ${discount.multiple_of_quantity}, ${discount.amount})
          `;
        }

        await tx.commit();

        state.formState = 'success';
        await feedbackDelay();

        host.dispatchEvent(new CustomEvent('inventory-discounts-updated', {
          detail: { inventoryId },
          bubbles: true,
          composed: true,
        }));

        dialog.open = false;
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
      if (state.formError instanceof Error) errorAlertDialog.value?.showModal();
      else errorAlertDialog.value?.close();
    });

    function handleDismissErrorDialog() { state.formError = null; }

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

    /**
     * @param {DiscountRow} discount
     * @param {number} index
     */
    function renderDiscountRow(discount, index) {
      const discountedTotal = calculateDiscountedTotal(discount);
      return html`
        <tr>
          <td style="padding: 8px;">
            <input
              type="number"
              inputmode="numeric"
              min="1"
              required
              data-index="${index}"
              ${readValue(discount, 'multiple_of_quantity')}
              @input=${handleQuantityChange}
              style="
                width: 100%;
                padding: 8px 12px;
                border: 1px solid var(--md-sys-color-outline);
                border-radius: var(--md-sys-shape-corner-extra-small);
                background-color: var(--md-sys-color-surface);
                color: var(--md-sys-color-on-surface);
                font-size: 14px;
                box-sizing: border-box;
              "
              aria-label="${t('inventory', 'everyNItemsInputAriaLabel', index + 1)}"
            />
          </td>
          <td style="padding: 8px;">
            <input
              type="number"
              inputmode="numeric"
              min="1"
              required
              data-index="${index}"
              ${readValue(discount, 'amount')}
              @input=${handleAmountChange}
              style="
                width: 100%;
                padding: 8px 12px;
                border: 1px solid var(--md-sys-color-outline);
                border-radius: var(--md-sys-shape-corner-extra-small);
                background-color: var(--md-sys-color-surface);
                color: var(--md-sys-color-on-surface);
                font-size: 14px;
                box-sizing: border-box;
              "
              aria-label="${t('inventory', 'discountAmountInputAriaLabel', index + 1)}"
            />
          </td>
          <td class="numeric" style="padding: 8px; white-space: nowrap;">
            ${i18n.displayCurrency(discountedTotal)}
          </td>
          <td style="padding: 8px; text-align: center;">
            <button
              role="button"
              type="button"
              class="text"
              data-index="${index}"
              @click=${handleRemoveRow}
              aria-label="${t('inventory', 'removeDiscountAriaLabel', index + 1)}"
              style="padding: 4px;"
            >
              <material-symbols name="delete" size="20"></material-symbols>
            </button>
          </td>
        </tr>
      `;
    }

    function renderFormContent() {
      if (!state.inventory) return nothing;
      const inventory = state.inventory;

      return html`
        ${state.formState !== 'idle' ? html`
          <div role="status" aria-live="polite" aria-busy="true">
            <div role="progressbar" class="linear indeterminate">
              <div class="track"><div class="indicator"></div></div>
            </div>
            <p>${t('inventory', 'savingDiscountsMessage')}</p>
          </div>
        ` : nothing}

        <!-- Inventory Info -->
        <div style="background-color: var(--md-sys-color-primary-container); padding: 12px; border-radius: var(--md-sys-shape-corner-small); margin-bottom: 16px;">
          <p class="label-small" style="margin: 0; color: var(--md-sys-color-on-primary-container);">${t('inventory', 'inventoryFieldLabel')}</p>
          <p class="body-large" style="margin: 0; font-weight: 500; color: var(--md-sys-color-on-primary-container);">${inventory.name}</p>
          <p class="body-small" style="margin: 4px 0 0 0; color: var(--md-sys-color-on-primary-container);">
            ${t('inventory', 'unitPriceFieldLabel')}: ${i18n.displayCurrency(inventory.unit_price)}
          </p>
        </div>

        <!-- Discount Description -->
        <div style="background-color: var(--md-sys-color-surface-container); padding: 12px; border-radius: var(--md-sys-shape-corner-small); margin-bottom: 16px;">
          <p class="body-small" style="margin: 0; color: var(--md-sys-color-on-surface-variant);">
            ${t('inventory', 'discountDescriptionText')}
          </p>
        </div>

        <!-- Discounts Table -->
        <div style="overflow-x: auto;">
          <table aria-label="${t('inventory', 'discountsTableAriaLabel')}" style="--md-sys-density: -2; width: 100%;">
            <thead>
              <tr>
                <th scope="col" style="width: 140px;">${t('inventory', 'everyNItemsColumnLabel')}</th>
                <th scope="col" style="width: 140px;">${t('inventory', 'discountAmountColumnLabel')}</th>
                <th scope="col" class="numeric" style="width: 140px;">${t('inventory', 'totalPriceColumnLabel')}</th>
                <th scope="col" style="width: 60px;"></th>
              </tr>
            </thead>
            <tbody>
              ${state.discounts.length === 0 ? html`
                <tr>
                  <td colspan="4" style="text-align: center; padding: 24px; color: var(--md-sys-color-on-surface-variant);">
                    ${t('inventory', 'noDiscountsConfiguredMessage')}
                  </td>
                </tr>
              ` : state.discounts.map(renderDiscountRow)}
            </tbody>
          </table>
        </div>

        <!-- Add Discount Button -->
        <div style="margin-top: 16px;">
          <button
            role="button"
            type="button"
            class="tonal"
            @click=${handleAddRow}
          >
            <material-symbols name="add"></material-symbols>
            ${t('inventory', 'addDiscountButtonLabel')}
          </button>
        </div>
      `;
    }

    useEffect(host, function renderDialog() {
      render(html`
        <dialog
          ${dialog.element}
          id="inventory-discounts-edit-dialog"
          class="full-screen"
          aria-labelledby="inventory-discounts-edit-dialog-title"
        >
          <form class="container" @submit=${handleSubmit}>
            <header>
              <h2 id="inventory-discounts-edit-dialog-title">${t('inventory', 'discountsEditDialogTitle')}</h2>
              <button
                role="button"
                type="button"
                class="text"
                commandfor="inventory-discounts-edit-dialog"
                command="close"
              ><material-symbols name="close"></material-symbols></button>
              <button
                role="button"
                type="submit"
                name="action"
                ?disabled=${state.formState === 'submitting' || !state.inventory}
              >${t('inventory', 'saveButtonLabel')}</button>
            </header>

            <div class="content" style="max-width: 600px; margin: 0 auto; padding: 16px;">
              ${state.discountsLoading ? renderLoadingState() : nothing}
              ${!state.discountsLoading && !state.inventory ? renderNotFoundState() : nothing}
              ${!state.discountsLoading && state.inventory ? renderFormContent() : nothing}
            </div>
          </form>
        </dialog>

        <dialog ${errorAlertDialog} role="alertdialog">
          <div class="container">
            <material-symbols name="error"></material-symbols>
            <header>
              <h3>${t('inventory', 'errorDialogTitle')}</h3>
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
                >${t('inventory', 'dismissButtonLabel')}</button>
              </li>
            </menu>
          </div>
        </dialog>
      `);
    });
  }
}

defineWebComponent('inventory-discounts-edit-dialog', InventoryDiscountsEditDialogElement);
