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
 * @typedef {object} InventoryOption
 * @property {number} id
 * @property {string} name
 * @property {string | null} unit_of_measurement
 */

/**
 * Discount Creation Dialog Component
 * 
 * @fires discount-created - Fired when a discount is successfully created. Detail: { discountId: number }
 */
export class DiscountCreationDialogElement extends HTMLElement {
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
      discountType: /** @type {'global' | 'inventory'} */ ('global'),
      inventorySearchQuery: '',
      availableInventories: /** @type {InventoryOption[]} */ ([]),
      isLoadingInventories: false,
      selectedInventoryId: /** @type {number | null} */ (null),
      selectedInventory: /** @type {InventoryOption | null} */ (null),
    });

    const form = reactive({
      state: /** @type {'idle' | 'submitting' | 'success' | 'error'} */ ('idle'),
      error: /** @type {Error | null} */ (null),
    });

    async function loadAvailableInventories() {
      try {
        state.isLoadingInventories = true;

        const searchPattern = state.inventorySearchQuery.trim() ? `%${state.inventorySearchQuery.trim()}%` : null;

        const result = await database.sql`
          SELECT id, name, unit_of_measurement
          FROM inventories
          WHERE ${searchPattern} IS NULL OR name LIKE ${searchPattern}
          ORDER BY name ASC
          LIMIT 50
        `;

        state.availableInventories = result.rows.map(function (row) {
          return /** @type {InventoryOption} */ ({
            id: Number(row.id),
            name: String(row.name),
            unit_of_measurement: row.unit_of_measurement ? String(row.unit_of_measurement) : null,
          });
        });

        state.isLoadingInventories = false;
      }
      catch (error) {
        state.isLoadingInventories = false;
        console.error('Failed to load inventories:', error);
      }
    }

    useEffect(host, function loadInventoriesOnOpen() {
      if (dialog.open) {
        loadAvailableInventories();
      }
    });

    /** @param {Event} event */
    function handleDiscountTypeChange(event) {
      assertInstanceOf(HTMLInputElement, event.target);
      state.discountType = /** @type {'global' | 'inventory'} */ (event.target.value);
      if (state.discountType === 'global') {
        state.selectedInventory = null;
        state.selectedInventoryId = null;
      }
    }

    /** @param {Event} event */
    function handleInventorySearchInput(event) {
      assertInstanceOf(HTMLInputElement, event.target);
      state.inventorySearchQuery = event.target.value;
      loadAvailableInventories();
    }

    /** @param {Event} event */
    function handleInventorySelect(event) {
      const target = /** @type {HTMLElement} */ (event.currentTarget);
      const inventoryId = Number(target.dataset.inventoryId);
      state.selectedInventoryId = inventoryId;
      state.selectedInventory = state.availableInventories.find((inv) => inv.id === inventoryId) || null;
    }

    /** @param {KeyboardEvent} event */
    function handleInventoryKeydown(event) {
      if (['Enter', ' '].includes(event.key)) {
        event.preventDefault();
        handleInventorySelect(event);
      }
    }

    function handleClearInventorySelection() {
      state.selectedInventory = null;
      state.selectedInventoryId = null;
    }

    /** @param {FocusEvent} event */
    async function validateDiscountName(event) {
      assertInstanceOf(HTMLInputElement, event.currentTarget);
      const input = event.currentTarget;
      const name = input.value.trim();
      input.setCustomValidity('');
      if (name) {
        try {
          const result = await database.sql`
            SELECT 1 FROM discounts WHERE name = ${name} LIMIT 1;
          `;
          if (result.rows.length > 0) input.setCustomValidity('Discount name already exists.');
        }
        catch (error) {
          input.setCustomValidity('Error validating discount name.');
        }
      }
    }

    /** @param {SubmitEvent} event */
    async function handleSubmit(event) {
      event.preventDefault();
      assertInstanceOf(HTMLFormElement, event.currentTarget);

      const tx = await database.transaction('write');

      try {
        form.state = 'submitting';
        form.error = null;

        const data = new FormData(event.currentTarget);
        const name = /** @type {string} */ (data.get('name'))?.trim();
        const multipleOfQuantity = parseInt(/** @type {string} */ (data.get('multipleOfQuantity')) || '1', 10);
        const amount = parseInt(/** @type {string} */ (data.get('amount')) || '0', 10);
        const inventoryId = state.discountType === 'inventory' ? state.selectedInventoryId : null;

        // Validate inputs
        if (!name) throw new Error('Discount name is required.');
        if (multipleOfQuantity < 1) throw new Error('Multiple of quantity must be at least 1.');
        if (amount <= 0) throw new Error('Discount amount must be greater than 0.');
        if (state.discountType === 'inventory' && !inventoryId) {
          throw new Error('Please select an inventory for inventory-specific discount.');
        }

        // Insert discount
        const result = await tx.sql`
          INSERT INTO discounts (name, inventory_id, multiple_of_quantity, amount)
          VALUES (${name}, ${inventoryId}, ${multipleOfQuantity}, ${amount})
          RETURNING id;
        `;

        const discountId = Number(result.rows[0].id);

        await tx.commit();

        form.state = 'success';
        await feedbackDelay();

        host.dispatchEvent(new CustomEvent('discount-created', {
          detail: { discountId },
          bubbles: true,
          composed: true,
        }));

        dialog.open = false;
        // Reset form and state
        event.currentTarget.reset();
        state.discountType = 'global';
        state.selectedInventory = null;
        state.selectedInventoryId = null;
        state.inventorySearchQuery = '';
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

    function renderInventorySelector() {
      if (state.discountType !== 'inventory') return nothing;

      return html`
        <div style="display: flex; flex-direction: column; gap: 12px; margin-top: 16px; padding: 16px; background-color: var(--md-sys-color-surface-container); border-radius: var(--md-sys-shape-corner-medium);">
          <label class="label-medium" style="color: var(--md-sys-color-on-surface-variant);">Select Inventory</label>
          
          ${!state.selectedInventory ? html`
            <!-- Inventory Search -->
            <div class="outlined-text-field" style="--md-sys-density: -4;">
              <div class="container">
                <material-symbols name="search" class="leading-icon" aria-hidden="true"></material-symbols>
                <label for="inventory-search-input">Search Inventory</label>
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

            <!-- Inventory List -->
            <div style="max-height: 200px; overflow-y: auto; border: 1px solid var(--md-sys-color-outline-variant); border-radius: var(--md-sys-shape-corner-medium);">
              ${state.isLoadingInventories ? html`
                <div style="padding: 16px; text-align: center; color: var(--md-sys-color-on-surface-variant);">
                  Loading...
                </div>
              ` : state.availableInventories.length === 0 ? html`
                <div style="padding: 16px; text-align: center; color: var(--md-sys-color-on-surface-variant);">
                  No inventories found.
                </div>
              ` : html`
                <ul role="listbox" aria-label="Available inventories" style="list-style: none; padding: 0; margin: 0;">
                  ${state.availableInventories.map(function (inv) {
                    return html`
                      <li
                        role="option"
                        tabindex="0"
                        aria-selected="false"
                        data-inventory-id="${inv.id}"
                        @click=${handleInventorySelect}
                        @keydown=${handleInventoryKeydown}
                        style="
                          padding: 12px 16px;
                          cursor: pointer;
                          border-bottom: 1px solid var(--md-sys-color-outline-variant);
                        "
                      >
                        <p style="margin: 0; font-weight: 500;">${inv.name}</p>
                        ${inv.unit_of_measurement ? html`
                          <p style="margin: 0; font-size: 0.875rem; color: var(--md-sys-color-on-surface-variant);">
                            Unit: ${inv.unit_of_measurement}
                          </p>
                        ` : nothing}
                      </li>
                    `;
                  })}
                </ul>
              `}
            </div>
          ` : html`
            <!-- Selected Inventory -->
            <div style="display: flex; align-items: center; gap: 12px; padding: 12px; background-color: var(--md-sys-color-primary-container); border-radius: var(--md-sys-shape-corner-medium);">
              <material-symbols name="inventory_2" style="color: var(--md-sys-color-on-primary-container);"></material-symbols>
              <div style="flex: 1;">
                <p class="body-medium" style="margin: 0; font-weight: 500; color: var(--md-sys-color-on-primary-container);">${state.selectedInventory.name}</p>
                ${state.selectedInventory.unit_of_measurement ? html`
                  <p class="body-small" style="margin: 4px 0 0 0; color: var(--md-sys-color-on-primary-container);">
                    Unit: ${state.selectedInventory.unit_of_measurement}
                  </p>
                ` : nothing}
              </div>
              <button
                role="button"
                type="button"
                class="text"
                @click=${handleClearInventorySelection}
                aria-label="Change inventory"
              >
                <material-symbols name="edit"></material-symbols>
              </button>
            </div>
          `}
        </div>
      `;
    }

    useEffect(host, function renderDialog() {
      render(html`
        <dialog
          ${dialog.element}
          id="discount-creation-dialog"
          class="full-screen"
          aria-labelledby="discount-creation-dialog-title"
        >
          <form class="container" @submit=${handleSubmit}>
            <header>
              <h2 id="discount-creation-dialog-title">Create Discount</h2>
              <button
                role="button"
                type="button"
                class="text"
                commandfor="discount-creation-dialog"
                command="close"
              ><material-symbols name="close"></material-symbols></button>
              <button role="button" type="submit" name="action">Create</button>
            </header>

            <div class="content">
              ${form.state !== 'idle' ? html`
                <div role="status" aria-live="polite" aria-busy="true">
                  <div role="progressbar" class="linear indeterminate">
                    <div class="track"><div class="indicator"></div></div>
                  </div>
                  <p>Creating discount...</p>
                </div>
              ` : nothing}

              <div style="display: flex; flex-direction: column; gap: 24px; padding: 16px 0px; max-width: 600px; margin: 0 auto;">

                <!-- Discount Name -->
                <div class="outlined-text-field">
                  <div class="container">
                    <label for="discount-name-input">Discount Name</label>
                    <input
                      id="discount-name-input"
                      name="name"
                      type="text"
                      placeholder=" "
                      required
                      autocomplete="off"
                      @blur=${validateDiscountName}
                    />
                  </div>
                  <div class="supporting-text">A unique name for this discount (e.g., "Buy 3 Get 500 Off")</div>
                </div>

                <!-- Discount Type -->
                <fieldset style="border: 1px solid var(--md-sys-color-outline-variant); border-radius: var(--md-sys-shape-corner-medium); padding: 16px; margin: 0;">
                  <legend class="label-medium" style="padding: 0 8px; color: var(--md-sys-color-on-surface-variant);">Discount Type</legend>
                  <div style="display: flex; flex-direction: column; gap: 12px;">
                    <label style="display: flex; align-items: center; gap: 12px; cursor: pointer;">
                      <input
                        type="radio"
                        name="discountType"
                        value="global"
                        ?checked=${state.discountType === 'global'}
                        @change=${handleDiscountTypeChange}
                      />
                      <div>
                        <span class="body-medium" style="font-weight: 500;">Global Discount</span>
                        <p class="body-small" style="margin: 4px 0 0 0; color: var(--md-sys-color-on-surface-variant);">
                          Can be applied to any sale regardless of items
                        </p>
                      </div>
                    </label>
                    <label style="display: flex; align-items: center; gap: 12px; cursor: pointer;">
                      <input
                        type="radio"
                        name="discountType"
                        value="inventory"
                        ?checked=${state.discountType === 'inventory'}
                        @change=${handleDiscountTypeChange}
                      />
                      <div>
                        <span class="body-medium" style="font-weight: 500;">Inventory-specific Discount</span>
                        <p class="body-small" style="margin: 4px 0 0 0; color: var(--md-sys-color-on-surface-variant);">
                          Only applies when the specific inventory is in the sale
                        </p>
                      </div>
                    </label>
                  </div>
                  ${renderInventorySelector()}
                </fieldset>

                <!-- Quantity Multiplier -->
                <div class="outlined-text-field">
                  <div class="container">
                    <label for="multiple-of-quantity-input">Every N Items</label>
                    <input
                      id="multiple-of-quantity-input"
                      name="multipleOfQuantity"
                      type="number"
                      inputmode="numeric"
                      min="1"
                      placeholder=" "
                      value="1"
                      required
                    />
                  </div>
                  <div class="supporting-text">
                    Discount applies for every N items purchased.
                    E.g., "3" means discount applies per 3 items (buy 7 = 2× discount)
                  </div>
                </div>

                <!-- Discount Amount -->
                <div class="outlined-text-field">
                  <div class="container">
                    <label for="discount-amount-input">Discount Amount</label>
                    <input
                      id="discount-amount-input"
                      name="amount"
                      type="number"
                      inputmode="numeric"
                      min="1"
                      placeholder=" "
                      required
                    />
                  </div>
                  <div class="supporting-text">
                    Amount to discount per quantity multiplier.
                    E.g., If "Every N Items" is 3 and amount is 500, buying 7 items gives 1000 off
                  </div>
                </div>

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

defineWebComponent('discount-creation-dialog', DiscountCreationDialogElement);
