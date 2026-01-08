import { reactive } from '@vue/reactivity';
import { html, nothing } from 'lit-html';

import { defineWebComponent } from '#web/component.js';
import { useDialog } from '#web/hooks/use-dialog.js';
import { useAdoptedStyleSheets } from '#web/hooks/use-adopted-style-sheets.js';
import { DatabaseContextElement } from '#web/contexts/database-context.js';
import { I18nContextElement } from '#web/contexts/i18n-context.js';
import { readValue } from '#web/directives/read-value.js';
import { useContext } from '#web/hooks/use-context.js';
import { useTranslator } from '#web/hooks/use-translator.js';
import { useEffect } from '#web/hooks/use-effect.js';
import { useRender } from '#web/hooks/use-render.js';
import { webStyleSheets } from '#web/styles.js';
import { assertInstanceOf } from '#web/tools/assertion.js';
import { feedbackDelay } from '#web/tools/timing.js';

import '#web/components/material-symbols.js';

/**
 * @typedef {object} DiscountDetail
 * @property {number} id
 * @property {string} name
 * @property {number | null} inventory_id
 * @property {string | null} inventory_name
 * @property {string | null} inventory_unit
 * @property {number} multiple_of_quantity
 * @property {number} amount
 */

/**
 * @typedef {object} InventoryOption
 * @property {number} id
 * @property {string} name
 * @property {string | null} unit_of_measurement
 */

/**
 * Discount Details Dialog Component
 * 
 * @fires discount-updated - Fired when discount is updated
 * @fires discount-deleted - Fired when discount is deleted
 */
export class DiscountDetailsDialogElement extends HTMLElement {
  constructor() {
    super();

    const host = this;
    const database = useContext(host, DatabaseContextElement);
    const i18n = useContext(host, I18nContextElement);
    const t = useTranslator(host);

    const errorAlertDialog = useDialog(host);
    const deleteConfirmDialog = useDialog(host);

    const dialog = useDialog(host);
    const render = useRender(host);
    useAdoptedStyleSheets(host, webStyleSheets);

    const state = reactive({
      discount: /** @type {DiscountDetail | null} */ (null),
      isLoading: false,
      error: /** @type {Error | null} */ (null),
      isEditing: false,
      isSaving: false,
      isDeleting: false,

      // Edit mode state
      editDiscountType: /** @type {'global' | 'inventory'} */ ('global'),
      inventorySearchQuery: '',
      availableInventories: /** @type {InventoryOption[]} */ ([]),
      isLoadingInventories: false,
      selectedInventoryId: /** @type {number | null} */ (null),
      selectedInventory: /** @type {InventoryOption | null} */ (null),
    });

    async function loadDiscountDetails() {
      const discountId = parseInt(dialog.context?.dataset.discountId, 10);
      if (isNaN(discountId) || discountId <= 0) return;

      try {
        state.isLoading = true;
        state.error = null;

        const result = await database.sql`
          SELECT
            d.id,
            d.name,
            d.inventory_id,
            i.name as inventory_name,
            i.unit_of_measurement as inventory_unit,
            d.multiple_of_quantity,
            d.amount
          FROM discounts d
          LEFT JOIN inventories i ON i.id = d.inventory_id
          WHERE d.id = ${discountId}
        `;

        if (result.rows.length === 0) {
          state.discount = null;
        }
        else {
          const row = result.rows[0];
          state.discount = {
            id: Number(row.id),
            name: String(row.name),
            inventory_id: row.inventory_id ? Number(row.inventory_id) : null,
            inventory_name: row.inventory_name ? String(row.inventory_name) : null,
            inventory_unit: row.inventory_unit ? String(row.inventory_unit) : null,
            multiple_of_quantity: Number(row.multiple_of_quantity),
            amount: Number(row.amount),
          };
        }

        state.isLoading = false;
      }
      catch (error) {
        state.error = error instanceof Error ? error : new Error(String(error));
        state.isLoading = false;
      }
    }

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

    useEffect(host, function loadOnOpen() {
      const discountId = parseInt(dialog.context?.dataset.discountId, 10);
      if (dialog.open && !isNaN(discountId)) {
        state.isEditing = false;
        loadDiscountDetails();
      }
    });

    function toggleEditMode() {
      if (!state.discount) return;

      if (!state.isEditing) {
        // Entering edit mode - initialize edit state from discount
        state.editDiscountType = state.discount.inventory_id ? 'inventory' : 'global';
        state.selectedInventoryId = state.discount.inventory_id;
        if (state.discount.inventory_id) {
          state.selectedInventory = {
            id: state.discount.inventory_id,
            name: state.discount.inventory_name || '',
            unit_of_measurement: state.discount.inventory_unit,
          };
        }
        else {
          state.selectedInventory = null;
        }
        state.inventorySearchQuery = '';
        loadAvailableInventories();
      }

      state.isEditing = !state.isEditing;
    }

    /** @param {Event} event */
    function handleDiscountTypeChange(event) {
      assertInstanceOf(HTMLInputElement, event.target);
      state.editDiscountType = /** @type {'global' | 'inventory'} */ (event.target.value);
      if (state.editDiscountType === 'global') {
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

    /** @param {SubmitEvent} event */
    async function handleUpdateSubmit(event) {
      event.preventDefault();
      assertInstanceOf(HTMLFormElement, event.currentTarget);

      if (!state.discount) return;

      const tx = await database.transaction('write');

      try {
        state.isSaving = true;
        state.error = null;

        const data = new FormData(event.currentTarget);
        const name = /** @type {string} */ (data.get('name'))?.trim();
        const multipleOfQuantity = parseInt(/** @type {string} */(data.get('multipleOfQuantity')) || '1', 10);
        const amount = parseInt(/** @type {string} */(data.get('amount')) || '0', 10);
        const inventoryId = state.editDiscountType === 'inventory' ? state.selectedInventoryId : null;

        if (!name) throw new Error(t('discount', 'discountNameRequiredError'));
        if (multipleOfQuantity < 1) throw new Error(t('discount', 'multipleOfQuantityMinError'));
        if (amount <= 0) throw new Error(t('discount', 'discountAmountPositiveError'));
        if (state.editDiscountType === 'inventory' && !inventoryId) {
          throw new Error(t('discount', 'selectInventoryError'));
        }

        const duplicateCheck = await tx.sql`
          SELECT 1 FROM discounts WHERE name = ${name} AND id != ${state.discount.id} LIMIT 1;
        `;
        if (duplicateCheck.rows.length > 0) {
          throw new Error(t('discount', 'discountNameExistsError'));
        }

        await tx.sql`
          UPDATE discounts
          SET name = ${name},
              inventory_id = ${inventoryId},
              multiple_of_quantity = ${multipleOfQuantity},
              amount = ${amount}
          WHERE id = ${state.discount.id};
        `;

        await tx.commit();

        state.isEditing = false;
        await loadDiscountDetails();

        host.dispatchEvent(new CustomEvent('discount-updated', {
          detail: { discountId: state.discount.id },
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

    function handleDeleteConfirm() {
      deleteConfirmDialog.open = true;
    }

    function handleDeleteCancel() {
      deleteConfirmDialog.open = false;
    }

    async function handleDelete() {
      if (!state.discount) return;

      const tx = await database.transaction('write');

      try {
        state.isDeleting = true;
        state.error = null;

        // Check if discount is used in any sales
        const usageCheck = await tx.sql`
          SELECT 1 FROM sale_discounts WHERE discount_id = ${state.discount.id} LIMIT 1;
        `;

        if (usageCheck.rows.length > 0) {
          throw new Error(t('discount', 'cannotDeleteUsedDiscountError'));
        }

        await tx.sql`
          DELETE FROM discounts WHERE id = ${state.discount.id};
        `;

        await tx.commit();

        await feedbackDelay();

        host.dispatchEvent(new CustomEvent('discount-deleted', {
          detail: { discountId: state.discount.id },
          bubbles: true,
          composed: true,
        }));

        deleteConfirmDialog.open = false;
        dialog.open = false;
      }
      catch (error) {
        await tx.rollback();
        state.error = error instanceof Error ? error : new Error(String(error));
        deleteConfirmDialog.open = false;
      }
      finally {
        state.isDeleting = false;
      }
    }

    function handleDismissErrorDialog() { state.error = null; }

    useEffect(host, function syncErrorAlertDialogState() {
      if (state.error instanceof Error) errorAlertDialog.open = true;
      else errorAlertDialog.open = false;
    });

    function renderLoadingState() {
      return html`
        <div
          role="status"
          aria-label="${t('discount', 'loadingDiscountDetailsAriaLabel')}"
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
          <p>${t('discount', 'loadingDiscountDetailsMessage')}</p>
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
          <material-symbols name="percent" size="48"></material-symbols>
          <h3 class="title-large">${t('discount', 'discountNotFoundTitle')}</h3>
          <p style="color: var(--md-sys-color-on-surface-variant);">${t('discount', 'discountNotFoundMessage')}</p>
        </div>
      `;
    }

    function renderViewMode() {
      if (!state.discount) return nothing;
      const discount = state.discount;

      const isGlobal = discount.inventory_id === null;
      const typeLabel = isGlobal ? t('discount', 'globalTypeLabel') : t('discount', 'inventorySpecificTypeLabel');

      return html`
        <div style="display: flex; flex-direction: column; gap: 24px; padding: 16px 0;">
          <!-- Basic Info -->
          <section>
            <h3 class="title-medium" style="margin-bottom: 16px;">${t('discount', 'discountInformationSectionTitle')}</h3>
            <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px;">
              <div>
                <p class="label-small" style="color: var(--md-sys-color-on-surface-variant);">${t('discount', 'nameFieldLabel')}</p>
                <p class="body-large">${discount.name}</p>
              </div>
              <div>
                <p class="label-small" style="color: var(--md-sys-color-on-surface-variant);">${t('discount', 'typeFieldLabel')}</p>
                <p class="body-large">
                  <span
                    class="label-small"
                    style="
                      display: inline-flex;
                      padding: 4px 8px;
                      border-radius: var(--md-sys-shape-corner-small);
                      background-color: ${isGlobal ? 'var(--md-sys-color-tertiary-container)' : 'var(--md-sys-color-secondary-container)'};
                      color: ${isGlobal ? 'var(--md-sys-color-on-tertiary-container)' : 'var(--md-sys-color-on-secondary-container)'};
                    "
                  >${typeLabel}</span>
                </p>
              </div>
              ${discount.inventory_id !== null ? html`
                <div style="grid-column: span 2;">
                  <p class="label-small" style="color: var(--md-sys-color-on-surface-variant);">${t('discount', 'inventoryFieldLabel')}</p>
                  <p class="body-large" style="display: flex; align-items: center; gap: 8px;">
                    <material-symbols name="inventory_2" size="20"></material-symbols>
                    ${discount.inventory_name}
                    ${discount.inventory_unit ? html`
                      <span style="color: var(--md-sys-color-on-surface-variant);">(${discount.inventory_unit})</span>
                    ` : nothing}
                  </p>
                </div>
              ` : nothing}
            </div>
          </section>

          <!-- Discount Rules -->
          <section>
            <h3 class="title-medium" style="margin-bottom: 16px;">${t('discount', 'discountRulesSectionTitle')}</h3>
            <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px;">
              <div>
                <p class="label-small" style="color: var(--md-sys-color-on-surface-variant);">${t('discount', 'everyNItemsFieldLabel')}</p>
                <p class="body-large" role="status" aria-label="${t('discount', 'everyNItemsFieldLabel')} value">${t('discount', 'everyNItemsValue', discount.multiple_of_quantity)}</p>
              </div>
              <div>
                <p class="label-small" style="color: var(--md-sys-color-on-surface-variant);">${t('discount', 'discountAmountFieldLabel')}</p>
                <p class="body-large" style="color: var(--md-sys-color-primary); font-weight: 500;" role="status" aria-label="Discount Amount value">
                  ${i18n.displayCurrency(discount.amount)}
                </p>
              </div>
            </div>

            <!-- Discount Example -->
            <div style="margin-top: 16px; padding: 16px; background-color: var(--md-sys-color-surface-container); border-radius: var(--md-sys-shape-corner-medium);">
              <p class="label-medium" style="color: var(--md-sys-color-on-surface-variant); margin-bottom: 8px;">${t('discount', 'howItWorksLabel')}</p>
              <p class="body-medium">
                ${t('discount', 'howItWorksDescription', discount.multiple_of_quantity, discount.inventory_name || t('discount', 'howItWorksItemLabel'), discount.amount)}
              </p>
              <p class="body-small" style="color: var(--md-sys-color-on-surface-variant); margin-top: 8px;">
                ${t('discount', 'exampleLabel', discount.multiple_of_quantity * 2 + 1, Math.floor((discount.multiple_of_quantity * 2 + 1) / discount.multiple_of_quantity), discount.amount, Math.floor((discount.multiple_of_quantity * 2 + 1) / discount.multiple_of_quantity) * discount.amount)}
              </p>
            </div>
          </section>

          <!-- Delete Section -->
          <section style="border-top: 1px solid var(--md-sys-color-outline-variant); padding-top: 24px;">
            <h3 class="title-medium" style="margin-bottom: 16px; color: var(--md-sys-color-error);">${t('discount', 'dangerZoneSectionTitle')}</h3>
            <div style="display: flex; align-items: center; justify-content: space-between; padding: 16px; background-color: var(--md-sys-color-error-container); border-radius: var(--md-sys-shape-corner-medium);">
              <div>
                <p class="body-medium" style="font-weight: 500; color: var(--md-sys-color-on-error-container);">${t('discount', 'deleteDiscountTitle')}</p>
                <p class="body-small" style="color: var(--md-sys-color-on-error-container);">
                  ${t('discount', 'deleteDiscountDescription')}
                </p>
              </div>
              <button
                role="button"
                type="button"
                class="outlined"
                style="color: var(--md-sys-color-error); border-color: var(--md-sys-color-error);"
                @click=${handleDeleteConfirm}
              >
                <material-symbols name="delete"></material-symbols>
                ${t('discount', 'deleteButtonLabel')}
              </button>
            </div>
          </section>
        </div>
      `;
    }

    function renderEditMode() {
      if (!state.discount) return nothing;
      const discount = state.discount;

      return html`
        <form @submit=${handleUpdateSubmit} style="display: flex; flex-direction: column; gap: 24px; padding: 16px 0;">
          ${state.isSaving ? html`
            <div role="status" aria-live="polite" aria-busy="true">
              <div role="progressbar" class="linear indeterminate">
                <div class="track"><div class="indicator"></div></div>
              </div>
              <p>${t('discount', 'savingChangesMessage')}</p>
            </div>
          ` : nothing}

          <!-- Discount Name -->
          <div class="outlined-text-field">
            <div class="container">
              <label for="edit-name-input">${t('discount', 'discountNameLabel')}</label>
              <input
                id="edit-name-input"
                name="name"
                type="text"
                placeholder=" "
                required
                value="${discount.name}"
              />
            </div>
          </div>

          <!-- Discount Type -->
          <fieldset style="border: 1px solid var(--md-sys-color-outline-variant); border-radius: var(--md-sys-shape-corner-medium); padding: 16px; margin: 0;">
            <legend class="label-medium" style="padding: 0 8px; color: var(--md-sys-color-on-surface-variant);">${t('discount', 'discountTypeLegend')}</legend>
            <div style="display: flex; flex-direction: column; gap: 12px;">
              <label style="display: flex; align-items: center; gap: 12px; cursor: pointer;">
                <input
                  type="radio"
                  name="discountType"
                  value="global"
                  ?checked=${state.editDiscountType === 'global'}
                  @change=${handleDiscountTypeChange}
                />
                <div>
                  <span class="body-medium" style="font-weight: 500;">${t('discount', 'globalDiscountLabel')}</span>
                  <p class="body-small" style="margin: 4px 0 0 0; color: var(--md-sys-color-on-surface-variant);">
                    ${t('discount', 'globalDiscountDescription')}
                  </p>
                </div>
              </label>
              <label style="display: flex; align-items: center; gap: 12px; cursor: pointer;">
                <input
                  type="radio"
                  name="discountType"
                  value="inventory"
                  ?checked=${state.editDiscountType === 'inventory'}
                  @change=${handleDiscountTypeChange}
                />
                <div>
                  <span class="body-medium" style="font-weight: 500;">${t('discount', 'inventorySpecificDiscountLabel')}</span>
                  <p class="body-small" style="margin: 4px 0 0 0; color: var(--md-sys-color-on-surface-variant);">
                    ${t('discount', 'inventorySpecificDiscountDescription')}
                  </p>
                </div>
              </label>
            </div>

            ${state.editDiscountType === 'inventory' ? html`
              <div style="display: flex; flex-direction: column; gap: 12px; margin-top: 16px; padding: 16px; background-color: var(--md-sys-color-surface-container); border-radius: var(--md-sys-shape-corner-medium);">
                <label class="label-medium" style="color: var(--md-sys-color-on-surface-variant);">${t('discount', 'selectInventoryLabel')}</label>
                
                ${!state.selectedInventory ? html`
                  <!-- Inventory Search -->
                  <div class="outlined-text-field" style="--md-sys-density: -4;">
                    <div class="container">
                      <material-symbols name="search" class="leading-icon" aria-hidden="true"></material-symbols>
                      <label for="edit-inventory-search-input">${t('discount', 'searchInventoryLabel')}</label>
                      <input
                        ${readValue(state, 'inventorySearchQuery')}
                        id="edit-inventory-search-input"
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
                        ${t('discount', 'loadingInventoriesMessage')}
                      </div>
                    ` : state.availableInventories.length === 0 ? html`
                      <div style="padding: 16px; text-align: center; color: var(--md-sys-color-on-surface-variant);">
                        ${t('discount', 'noInventoriesFoundMessage')}
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
                                  ${t('discount', 'unitLabel')}: ${inv.unit_of_measurement}
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
                          ${t('discount', 'unitLabel')}: ${state.selectedInventory.unit_of_measurement}
                        </p>
                      ` : nothing}
                    </div>
                    <button
                      role="button"
                      type="button"
                      class="text"
                      @click=${handleClearInventorySelection}
                      aria-label="${t('discount', 'changeInventoryAriaLabel')}"
                    >
                      <material-symbols name="edit"></material-symbols>
                    </button>
                  </div>
                `}
              </div>
            ` : nothing}
          </fieldset>

          <!-- Quantity Multiplier -->
          <div class="outlined-text-field">
            <div class="container">
              <label for="edit-multiple-of-quantity-input">${t('discount', 'everyNItemsLabel')}</label>
              <input
                id="edit-multiple-of-quantity-input"
                name="multipleOfQuantity"
                type="number"
                inputmode="numeric"
                min="1"
                placeholder=" "
                value="${discount.multiple_of_quantity}"
                required
              />
            </div>
            <div class="supporting-text">${t('discount', 'everyNItemsSupportingText')}</div>
          </div>

          <!-- Discount Amount -->
          <div class="outlined-text-field">
            <div class="container">
              <label for="edit-amount-input">${t('discount', 'discountAmountLabel')}</label>
              <input
                id="edit-amount-input"
                name="amount"
                type="number"
                inputmode="numeric"
                min="1"
                placeholder=" "
                value="${discount.amount}"
                required
              />
            </div>
          </div>

          <div style="display: flex; gap: 12px; justify-content: flex-end;">
            <button role="button" type="button" class="text" @click=${toggleEditMode}>${t('discount', 'cancelButtonLabel')}</button>
            <button role="button" type="submit" class="tonal" ?disabled=${state.isSaving}>${t('discount', 'saveChangesButtonLabel')}</button>
          </div>
        </form>
      `;
    }

    useEffect(host, function renderDialog() {
      render(html`
        <dialog
          ${dialog.element}
          id="discount-details-dialog"
          class="full-screen"
          aria-labelledby="discount-details-dialog-title"
        >
          <div class="container">
            <header>
              <h2 id="discount-details-dialog-title">
                ${state.discount ? state.discount.name : t('discount', 'detailsDialogTitle')}
              </h2>
              <button
                role="button"
                type="button"
                class="text"
                commandfor="discount-details-dialog"
                command="close"
              ><material-symbols name="close"></material-symbols></button>
              ${state.discount && !state.isEditing ? html`
                <button role="button" type="button" @click=${toggleEditMode}>
                  <material-symbols name="edit"></material-symbols>
                  ${t('discount', 'editButtonLabel')}
                </button>
              ` : nothing}
            </header>

            <div class="content" style="max-width: 600px; margin: 0 auto;">
              ${state.isLoading ? renderLoadingState() : nothing}
              ${!state.isLoading && !state.discount ? renderNotFoundState() : nothing}
              ${!state.isLoading && state.discount && !state.isEditing ? renderViewMode() : nothing}
              ${!state.isLoading && state.discount && state.isEditing ? renderEditMode() : nothing}
            </div>
          </div>
        </dialog>

        <dialog ${errorAlertDialog.element} role="alertdialog">
          <div class="container">
            <material-symbols name="error"></material-symbols>
            <header>
              <h3>${t('discount', 'errorDialogTitle')}</h3>
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
                >${t('discount', 'dismissButtonLabel')}</button>
              </li>
            </menu>
          </div>
        </dialog>

        <dialog ${deleteConfirmDialog.element} role="alertdialog" aria-labelledby="delete-confirm-title">
          <div class="container">
            <material-symbols name="delete"></material-symbols>
            <header>
              <h3 id="delete-confirm-title">${t('discount', 'deleteConfirmDialogTitle')}</h3>
            </header>
            <div class="content">
              <p>${t('discount', 'deleteConfirmMessage', state.discount?.name || '')}</p>
              <p style="color: var(--md-sys-color-on-surface-variant); font-size: 0.875rem;">
                ${t('discount', 'deleteConfirmWarning')}
              </p>
            </div>
            <menu>
              <li>
                <button
                  role="button"
                  type="button"
                  class="text"
                  @click=${handleDeleteCancel}
                >${t('discount', 'deleteConfirmCancelButton')}</button>
              </li>
              <li>
                <button
                  role="button"
                  type="button"
                  class="text"
                  style="color: var(--md-sys-color-error);"
                  @click=${handleDelete}
                  ?disabled=${state.isDeleting}
                >${t('discount', 'deleteConfirmDeleteButton')}</button>
              </li>
            </menu>
          </div>
        </dialog>
      `);
    });
  }
}

defineWebComponent('discount-details-dialog', DiscountDetailsDialogElement);
