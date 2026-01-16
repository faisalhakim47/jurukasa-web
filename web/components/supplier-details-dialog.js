import { reactive } from '@vue/reactivity';
import { html, nothing } from 'lit-html';

import { defineWebComponent } from '#web/component.js';
import { useDialog } from '#web/hooks/use-dialog.js';
import { useAdoptedStyleSheets } from '#web/hooks/use-adopted-style-sheets.js';
import { DatabaseContextElement } from '#web/contexts/database-context.js';
import { readValue } from '#web/directives/read-value.js';
import { useAttribute } from '#web/hooks/use-attribute.js';
import { useContext } from '#web/hooks/use-context.js';
import { useEffect } from '#web/hooks/use-effect.js';
import { useRender } from '#web/hooks/use-render.js';
import { useTranslator } from '#web/hooks/use-translator.js';
import { webStyleSheets } from '#web/styles.js';
import { assertInstanceOf } from '#web/tools/assertion.js';

import '#web/components/material-symbols.js';

/**
 * @typedef {object} SupplierDetail
 * @property {number} id
 * @property {string} name
 * @property {string | null} phone_number
 */

/**
 * @typedef {object} SupplierInventoryRow
 * @property {number} inventory_id
 * @property {string} inventory_name
 * @property {number} quantity_conversion
 * @property {string | null} supplier_name
 */

/**
 * @typedef {object} InventoryOption
 * @property {number} id
 * @property {string} name
 * @property {string | null} unit_of_measurement
 */

/**
 * Supplier Details Dialog Component
 * 
 * @fires supplier-updated - Fired when supplier is updated
 */
export class SupplierDetailsDialogElement extends HTMLElement {
  constructor() {
    super();

    const host = this;
    const database = useContext(host, DatabaseContextElement);
    const t = useTranslator(host);

    const errorAlertDialog = useDialog(host);
    const deleteConfirmDialog = useDialog(host);

    const dialog = useDialog(host);
    const render = useRender(host);
    useAdoptedStyleSheets(host, webStyleSheets);

    const state = reactive({
      supplier: /** @type {SupplierDetail | null} */ (null),
      supplierInventories: /** @type {SupplierInventoryRow[]} */ ([]),
      isLoading: false,
      error: /** @type {Error | null} */ (null),
      isEditing: false,
      isSaving: false,

      // Supplier inventory management
      isAddingInventory: false,
      isEditingInventory: /** @type {SupplierInventoryRow | null} */ (null),
      inventorySearchQuery: '',
      availableInventories: /** @type {InventoryOption[]} */ ([]),
      isLoadingInventories: false,
      selectedInventoryId: /** @type {number | null} */ (null),
      selectedInventory: /** @type {InventoryOption | null} */ (null),
      newQuantityConversion: /** @type {number | null} */ (1),
      newSupplierName: '',
      pendingDeleteInventory: /** @type {SupplierInventoryRow | null} */ (null),
    });

    async function loadSupplierDetails() {
      const supplierId = Number(dialog.context?.dataset.supplierId);
      if (isNaN(supplierId) || supplierId <= 0) return;

      try {
        state.isLoading = true;
        state.error = null;

        const result = await database.sql`
          SELECT id, name, phone_number
          FROM suppliers
          WHERE id = ${supplierId}
        `;

        if (result.rows.length === 0) {
          state.supplier = null;
          state.supplierInventories = [];
        }
        else {
          const row = result.rows[0];
          state.supplier = {
            id: Number(row.id),
            name: String(row.name),
            phone_number: row.phone_number ? String(row.phone_number) : null,
          };

          // Load supplier inventories
          const inventoriesResult = await database.sql`
            SELECT
              si.inventory_id,
              i.name as inventory_name,
              si.quantity_conversion,
              si.name as supplier_name
            FROM supplier_inventories si
            JOIN inventories i ON i.id = si.inventory_id
            WHERE si.supplier_id = ${supplierId}
            ORDER BY i.name ASC
          `;

          state.supplierInventories = inventoriesResult.rows.map(function rowToSupplierInventory(row) {
            return /** @type {SupplierInventoryRow} */ ({
              inventory_id: Number(row.inventory_id),
              inventory_name: String(row.inventory_name),
              quantity_conversion: Number(row.quantity_conversion),
              supplier_name: row.supplier_name ? String(row.supplier_name) : null,
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

        state.availableInventories = result.rows.map(function rowToInventory(row) {
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
      if (dialog.open && dialog.context?.dataset.supplierId) {
        loadSupplierDetails();
      }
    });

    /** @param {Event} event */
    function handleInventorySearchInput(event) {
      assertInstanceOf(HTMLInputElement, event.target);
      state.inventorySearchQuery = event.target.value;
      loadAvailableInventories();
    }

    function startAddingInventory() {
      state.isAddingInventory = true;
      state.isEditingInventory = null;
      state.selectedInventoryId = null;
      state.selectedInventory = null;
      state.newQuantityConversion = 1;
      state.newSupplierName = '';
      state.inventorySearchQuery = '';
      loadAvailableInventories();
    }

    function cancelAddingInventory() {
      state.isAddingInventory = false;
      state.isEditingInventory = null;
      state.selectedInventoryId = null;
      state.selectedInventory = null;
      state.newQuantityConversion = 1;
      state.newSupplierName = '';
      state.inventorySearchQuery = '';
    }

    /** @param {number} inventoryId */
    function selectInventory(inventoryId) {
      state.selectedInventoryId = inventoryId;
      state.selectedInventory = state.availableInventories.find((inv) => inv.id === inventoryId) || null;
    }

    /** @param {Event} event */
    function handleQuantityConversionInput(event) {
      assertInstanceOf(HTMLInputElement, event.target);
      state.newQuantityConversion = parseInt(event.target.value, 10) || null;
    }

    /** @param {Event} event */
    function handleSupplierNameInput(event) {
      assertInstanceOf(HTMLInputElement, event.target);
      state.newSupplierName = event.target.value;
    }

    async function addSupplierInventory() {
      if (!state.supplier || !state.selectedInventory || !state.newQuantityConversion) return;

      const tx = await database.transaction('write');

      try {
        state.isSaving = true;

        const supplierId = state.supplier.id;
        const inventoryId = state.selectedInventory.id;
        const quantityConversion = state.newQuantityConversion;
        const supplierName = state.newSupplierName.trim() || null;

        // Check if this exact combination already exists
        const existingCheck = await tx.sql`
          SELECT 1 FROM supplier_inventories
          WHERE supplier_id = ${supplierId}
            AND inventory_id = ${inventoryId}
            AND quantity_conversion = ${quantityConversion}
          LIMIT 1;
        `;

        if (existingCheck.rows.length > 0) {
          throw new Error(t('supplier', 'inventoryMappingExistsError'));
        }

        await tx.sql`
          INSERT INTO supplier_inventories (supplier_id, inventory_id, quantity_conversion, name)
          VALUES (${supplierId}, ${inventoryId}, ${quantityConversion}, ${supplierName});
        `;

        await tx.commit();

        cancelAddingInventory();
        await loadSupplierDetails();

        host.dispatchEvent(new CustomEvent('supplier-updated', {
          detail: { supplierId: state.supplier.id },
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

    /** @param {SupplierInventoryRow} si */
    function startEditingInventory(si) {
      state.isEditingInventory = si;
      state.isAddingInventory = false;
      state.newQuantityConversion = si.quantity_conversion;
      state.newSupplierName = si.supplier_name || '';
    }

    async function updateSupplierInventory() {
      if (!state.supplier || !state.isEditingInventory || !state.newQuantityConversion) return;

      const tx = await database.transaction('write');

      try {
        state.isSaving = true;

        const supplierId = state.supplier.id;
        const inventoryId = state.isEditingInventory.inventory_id;
        const oldQuantityConversion = state.isEditingInventory.quantity_conversion;
        const newQuantityConversion = state.newQuantityConversion;
        const supplierName = state.newSupplierName.trim() || null;

        // If quantity_conversion is changing, we need to delete and re-insert (part of PK)
        if (oldQuantityConversion !== newQuantityConversion) {
          // Check if new combination already exists
          const existingCheck = await tx.sql`
            SELECT 1 FROM supplier_inventories
            WHERE supplier_id = ${supplierId}
              AND inventory_id = ${inventoryId}
              AND quantity_conversion = ${newQuantityConversion}
            LIMIT 1;
          `;

          if (existingCheck.rows.length > 0) {
            throw new Error('This inventory mapping with the same quantity conversion already exists for this supplier.');
          }

          await tx.sql`
            DELETE FROM supplier_inventories
            WHERE supplier_id = ${supplierId}
              AND inventory_id = ${inventoryId}
              AND quantity_conversion = ${oldQuantityConversion};
          `;

          await tx.sql`
            INSERT INTO supplier_inventories (supplier_id, inventory_id, quantity_conversion, name)
            VALUES (${supplierId}, ${inventoryId}, ${newQuantityConversion}, ${supplierName});
          `;
        }
        else {
          // Just update the supplier name
          await tx.sql`
            UPDATE supplier_inventories
            SET name = ${supplierName}
            WHERE supplier_id = ${supplierId}
              AND inventory_id = ${inventoryId}
              AND quantity_conversion = ${oldQuantityConversion};
          `;
        }

        await tx.commit();

        cancelAddingInventory();
        await loadSupplierDetails();

        host.dispatchEvent(new CustomEvent('supplier-updated', {
          detail: { supplierId: state.supplier.id },
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

    /** @param {SupplierInventoryRow} si */
    function confirmDeleteSupplierInventory(si) {
      state.pendingDeleteInventory = si;
    }

    function cancelDeleteSupplierInventory() {
      state.pendingDeleteInventory = null;
    }

    async function deleteSupplierInventory() {
      if (!state.supplier || !state.pendingDeleteInventory) return;

      const tx = await database.transaction('write');

      try {
        state.isSaving = true;

        const supplierId = state.supplier.id;
        const inventoryId = state.pendingDeleteInventory.inventory_id;
        const quantityConversion = state.pendingDeleteInventory.quantity_conversion;

        await tx.sql`
          DELETE FROM supplier_inventories
          WHERE supplier_id = ${supplierId}
            AND inventory_id = ${inventoryId}
            AND quantity_conversion = ${quantityConversion};
        `;

        await tx.commit();

        state.pendingDeleteInventory = null;
        await loadSupplierDetails();

        host.dispatchEvent(new CustomEvent('supplier-updated', {
          detail: { supplierId: state.supplier.id },
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

    useEffect(host, function syncDeleteConfirmDialogState() {
      if (state.pendingDeleteInventory !== null) deleteConfirmDialog.open = true;
      else deleteConfirmDialog.open = false;
    });

    /** @param {Event} event */
    function handleStartEditingInventory(event) {
      const target = /** @type {HTMLElement} */ (event.currentTarget);
      const inventoryId = Number(target.dataset.inventoryId);
      const quantityConversion = Number(target.dataset.quantityConversion);
      
      const si = state.supplierInventories.find(
        (item) => item.inventory_id === inventoryId && item.quantity_conversion === quantityConversion
      );
      
      if (si) {
        startEditingInventory(si);
      }
    }

    /** @param {Event} event */
    function handleConfirmDeleteSupplierInventory(event) {
      const target = /** @type {HTMLElement} */ (event.currentTarget);
      const inventoryId = Number(target.dataset.inventoryId);
      const quantityConversion = Number(target.dataset.quantityConversion);

      const si = state.supplierInventories.find(
        (item) => item.inventory_id === inventoryId && item.quantity_conversion === quantityConversion
      );

      if (si) {
        confirmDeleteSupplierInventory(si);
      }
    }

    /** @param {Event} event */
    function handleInventorySelect(event) {
      const target = /** @type {HTMLElement} */ (event.currentTarget);
      const inventoryId = Number(target.dataset.inventoryId);
      selectInventory(inventoryId);
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

      if (!state.supplier) return;

      const tx = await database.transaction('write');

      try {
        state.isSaving = true;
        state.error = null;

        const data = new FormData(event.currentTarget);
        const name = /** @type {string} */ (data.get('name'))?.trim();
        const phoneNumber = /** @type {string} */ (data.get('phoneNumber'))?.trim() || null;

        // Validate inputs
        if (!name) throw new Error(t('supplier', 'supplierNameRequiredError'));

        // Check for duplicate name (excluding current supplier)
        const duplicateCheck = await tx.sql`
          SELECT 1 FROM suppliers WHERE name = ${name} AND id != ${state.supplier.id} LIMIT 1;
        `;
        if (duplicateCheck.rows.length > 0) {
          throw new Error(t('supplier', 'supplierNameExistsError'));
        }

        // Update supplier
        await tx.sql`
          UPDATE suppliers
          SET name = ${name}, phone_number = ${phoneNumber}
          WHERE id = ${state.supplier.id};
        `;

        await tx.commit();

        state.isEditing = false;
        await loadSupplierDetails();

        host.dispatchEvent(new CustomEvent('supplier-updated', {
          detail: { supplierId: state.supplier.id },
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
          aria-label="${t('supplier', 'loadingSupplierDetailsAriaLabel')}"
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
          <p>${t('supplier', 'loadingSupplierDetailsMessage')}</p>
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
          <material-symbols name="local_shipping" size="48"></material-symbols>
          <h3 class="title-large">${t('supplier', 'supplierNotFoundTitle')}</h3>
          <p style="color: var(--md-sys-color-on-surface-variant);">${t('supplier', 'supplierNotFoundMessage')}</p>
        </div>
      `;
    }

    function renderViewMode() {
      if (!state.supplier) return nothing;
      const supplier = state.supplier;

      return html`
        <div style="display: flex; flex-direction: column; gap: 24px; padding: 16px 0;">
          <!-- Basic Info -->
          <section>
            <h3 class="title-medium" style="margin-bottom: 16px;">${t('supplier', 'basicInformationSectionTitle')}</h3>
            <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px;">
              <div>
                <p class="label-small" style="color: var(--md-sys-color-on-surface-variant);">${t('supplier', 'nameFieldLabel')}</p>
                <p class="body-large">${supplier.name}</p>
              </div>
              <div>
                <p class="label-small" style="color: var(--md-sys-color-on-surface-variant);">${t('supplier', 'phoneNumberFieldLabel')}</p>
                <p class="body-large">${supplier.phone_number || t('supplier', 'noSupplierNamePlaceholder')}</p>
              </div>
            </div>
          </section>

          <!-- Supplier Inventories -->
          <section>
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
              <h3 class="title-medium" style="margin: 0;">${t('supplier', 'linkedInventoriesSectionTitle')}</h3>
              ${!state.isAddingInventory && !state.isEditingInventory ? html`
                <button role="button" class="text" @click=${startAddingInventory}>
                  <material-symbols name="add"></material-symbols>
                  ${t('supplier', 'addMappingButtonLabel')}
                </button>
              ` : nothing}
            </div>

            ${renderAddInventoryForm()}
            ${renderEditInventoryForm()}

            ${state.supplierInventories.length > 0 ? html`
              <table aria-label="${t('supplier', 'linkedInventoriesSectionTitle')}" style="--md-sys-density: -3;">
                <thead>
                  <tr>
                    <th scope="col">${t('supplier', 'tableHeaderInventory')}</th>
                    <th scope="col">${t('supplier', 'tableHeaderSupplierName')}</th>
                    <th scope="col" class="numeric" style="width: 100px;">${t('supplier', 'tableHeaderConversion')}</th>
                    <th scope="col" style="width: 80px;"></th>
                  </tr>
                </thead>
                <tbody>
                  ${state.supplierInventories.map((si) => html`
                    <tr>
                      <td>${si.inventory_name}</td>
                      <td style="color: var(--md-sys-color-on-surface-variant);">${si.supplier_name || t('supplier', 'noSupplierNamePlaceholder')}</td>
                      <td class="numeric">${t('supplier', 'conversionUnitLabel', si.quantity_conversion)}</td>
                      <td class="center">
                        <button
                          role="button"
                          class="text"
                          data-inventory-id="${si.inventory_id}"
                          data-quantity-conversion="${si.quantity_conversion}"
                          @click=${handleStartEditingInventory}
                          aria-label="${t('supplier', 'editMappingAriaLabel', si.inventory_name)}"
                          ?disabled=${state.isAddingInventory || state.isEditingInventory !== null}
                        >
                          <material-symbols name="edit" size="20"></material-symbols>
                        </button>
                        <button
                          role="button"
                          class="text"
                          data-inventory-id="${si.inventory_id}"
                          data-quantity-conversion="${si.quantity_conversion}"
                          @click=${handleConfirmDeleteSupplierInventory}
                          aria-label="${t('supplier', 'removeMappingAriaLabel', si.inventory_name)}"
                          ?disabled=${state.isAddingInventory || state.isEditingInventory !== null}
                        >
                          <material-symbols name="delete" size="20"></material-symbols>
                        </button>
                      </td>
                    </tr>
                  `)}
                </tbody>
              </table>
            ` : html`
              <p style="color: var(--md-sys-color-on-surface-variant);">
                ${t('supplier', 'noInventoriesLinkedMessage')}
              </p>
            `}
          </section>
        </div>
      `;
    }

    function renderAddInventoryForm() {
      if (!state.isAddingInventory) return nothing;

      return html`
        <div style="background-color: var(--md-sys-color-surface-container-high); padding: 16px; border-radius: var(--md-sys-shape-corner-medium); margin-bottom: 16px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
            <h4 class="title-small" style="margin: 0;">${t('supplier', 'addInventoryMappingTitle')}</h4>
            <button role="button" class="text" @click=${cancelAddingInventory} aria-label="${t('supplier', 'cancelButtonAriaLabel')}">
              <material-symbols name="close"></material-symbols>
            </button>
          </div>

          ${!state.selectedInventory ? html`
            <!-- Inventory Search -->
            <div class="outlined-text-field" style="margin-bottom: 12px;">
              <div class="container">
                <material-symbols name="search" class="leading-icon" aria-hidden="true"></material-symbols>
                <label for="inventory-search-input">${t('supplier', 'searchInventoryLabel')}</label>
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
                  ${t('supplier', 'loadingInventoriesMessage')}
                </div>
              ` : state.availableInventories.length === 0 ? html`
                <div style="padding: 16px; text-align: center; color: var(--md-sys-color-on-surface-variant);">
                  ${t('supplier', 'noInventoriesFoundMessage')}
                </div>
              ` : html`
                <ul role="listbox" aria-label="${t('supplier', 'availableInventoriesAriaLabel')}" style="list-style: none; padding: 0; margin: 0;">
                  ${state.availableInventories.map((inv) => html`
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
                          ${t('supplier', 'inventoryUnitLabel', inv.unit_of_measurement)}
                        </p>
                      ` : nothing}
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
                  <p class="body-medium" style="margin: 0; font-weight: 500;">${state.selectedInventory.name}</p>
                  ${state.selectedInventory.unit_of_measurement ? html`
                    <p class="body-small" style="margin: 4px 0 0 0; color: var(--md-sys-color-on-primary-container);">
                      ${t('supplier', 'inventoryUnitLabel', state.selectedInventory.unit_of_measurement)}
                    </p>
                  ` : nothing}
                </div>
                <button role="button" class="text" @click=${handleClearInventorySelection} aria-label="${t('supplier', 'changeInventoryAriaLabel')}">
                  <material-symbols name="edit"></material-symbols>
                </button>
              </div>
            </div>

            <!-- Conversion and Supplier Name Inputs -->
            <div style="display: grid; grid-template-columns: 1fr 2fr; gap: 12px;">
              <div class="outlined-text-field" style="--md-sys-density: -4;">
                <div class="container">
                  <label for="add-conversion-input">${t('supplier', 'conversionLabel')}</label>
                  <input
                    id="add-conversion-input"
                    type="number"
                    inputmode="numeric"
                    min="1"
                    placeholder=" "
                    .value=${String(state.newQuantityConversion ?? '')}
                    @input=${handleQuantityConversionInput}
                  />
                </div>
                <div class="supporting-text">${t('supplier', 'conversionSupportingText')}</div>
              </div>
              <div class="outlined-text-field" style="--md-sys-density: -4;">
                <div class="container">
                  <label for="add-supplier-name-input">${t('supplier', 'supplierNameOptionalLabel')}</label>
                  <input
                    id="add-supplier-name-input"
                    type="text"
                    placeholder=" "
                    .value=${state.newSupplierName}
                    @input=${handleSupplierNameInput}
                  />
                </div>
                <div class="supporting-text">${t('supplier', 'supplierNameCatalogSupportingText')}</div>
              </div>
            </div>

            <div style="display: flex; justify-content: flex-end; margin-top: 12px;">
              <button
                role="button"
                type="button"
                class="tonal"
                @click=${addSupplierInventory}
                ?disabled=${!state.selectedInventory || !state.newQuantityConversion || state.isSaving}
              >
                <material-symbols name="add"></material-symbols>
                ${t('supplier', 'addMappingSubmitButtonLabel')}
              </button>
            </div>
          `}
        </div>
      `;
    }

    function renderEditInventoryForm() {
      if (!state.isEditingInventory) return nothing;

      return html`
        <div style="background-color: var(--md-sys-color-surface-container-high); padding: 16px; border-radius: var(--md-sys-shape-corner-medium); margin-bottom: 16px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
            <h4 class="title-small" style="margin: 0;">${t('supplier', 'editInventoryMappingTitle')}</h4>
            <button role="button" class="text" @click=${cancelAddingInventory} aria-label="${t('supplier', 'cancelButtonAriaLabel')}">
              <material-symbols name="close"></material-symbols>
            </button>
          </div>

          <!-- Selected Inventory (read-only) -->
          <div style="background-color: var(--md-sys-color-primary-container); padding: 12px; border-radius: var(--md-sys-shape-corner-small); margin-bottom: 16px;">
            <p class="body-medium" style="margin: 0; font-weight: 500;">${state.isEditingInventory.inventory_name}</p>
          </div>

          <!-- Conversion and Supplier Name Inputs -->
          <div style="display: grid; grid-template-columns: 1fr 2fr; gap: 12px;">
            <div class="outlined-text-field" style="--md-sys-density: -4;">
              <div class="container">
                <label for="edit-conversion-input">${t('supplier', 'conversionLabel')}</label>
                <input
                  id="edit-conversion-input"
                  type="number"
                  inputmode="numeric"
                  min="1"
                  placeholder=" "
                  .value=${String(state.newQuantityConversion ?? '')}
                  @input=${handleQuantityConversionInput}
                />
              </div>
              <div class="supporting-text">${t('supplier', 'conversionSupportingText')}</div>
            </div>
            <div class="outlined-text-field" style="--md-sys-density: -4;">
              <div class="container">
                <label for="edit-supplier-name-input">${t('supplier', 'supplierNameOptionalLabel')}</label>
                <input
                  id="edit-supplier-name-input"
                  type="text"
                  placeholder=" "
                  .value=${state.newSupplierName}
                  @input=${handleSupplierNameInput}
                />
              </div>
              <div class="supporting-text">${t('supplier', 'supplierNameCatalogSupportingText')}</div>
            </div>
          </div>

          <div style="display: flex; justify-content: flex-end; margin-top: 12px; gap: 8px;">
            <button role="button" type="button" class="text" @click=${cancelAddingInventory}>${t('supplier', 'cancelButtonLabel')}</button>
            <button
              role="button"
              type="button"
              class="tonal"
              @click=${updateSupplierInventory}
              ?disabled=${!state.newQuantityConversion || state.isSaving}
            >
              <material-symbols name="check"></material-symbols>
              ${t('supplier', 'saveChangesInventoryButtonLabel')}
            </button>
          </div>
        </div>
      `;
    }

    function renderEditMode() {
      if (!state.supplier) return nothing;
      const supplier = state.supplier;

      return html`
        <form @submit=${handleUpdateSubmit} style="display: flex; flex-direction: column; gap: 24px; padding: 16px 0;">
          ${state.isSaving ? html`
            <div role="status" aria-live="polite" aria-busy="true">
              <div role="progressbar" class="linear indeterminate">
                <div class="track"><div class="indicator"></div></div>
              </div>
              <p>${t('supplier', 'savingChangesMessage')}</p>
            </div>
          ` : nothing}

          <!-- Supplier Name -->
          <div class="outlined-text-field">
            <div class="container">
              <label for="edit-name-input">${t('supplier', 'supplierNameLabel')}</label>
              <input
                id="edit-name-input"
                name="name"
                type="text"
                placeholder=" "
                required
                value="${supplier.name}"
              />
            </div>
          </div>

          <!-- Phone Number -->
          <div class="outlined-text-field">
            <div class="container">
              <label for="edit-phone-number-input">${t('supplier', 'phoneNumberLabel')}</label>
              <input
                id="edit-phone-number-input"
                name="phoneNumber"
                type="tel"
                placeholder=" "
                value="${supplier.phone_number || ''}"
              />
            </div>
          </div>

          <div style="display: flex; gap: 12px; justify-content: flex-end;">
            <button role="button" type="button" class="text" @click=${toggleEditMode}>${t('supplier', 'cancelButtonLabel')}</button>
            <button role="button" type="submit" class="tonal">${t('supplier', 'saveChangesButtonLabel')}</button>
          </div>
        </form>
      `;
    }

    useEffect(host, function renderDialog() {
      render(html`
        <dialog
          ${dialog.element}
          id="supplier-details-dialog"
          class="full-screen"
          aria-labelledby="supplier-details-dialog-title"
        >
          <div class="container">
            <header>
              <h2 id="supplier-details-dialog-title">
                ${state.supplier ? state.supplier.name : t('supplier', 'detailsDialogTitle')}
              </h2>
              <button
                role="button"
                type="button"
                class="text"
                commandfor="supplier-details-dialog"
                command="close"
              ><material-symbols name="close"></material-symbols></button>
              ${state.supplier && !state.isEditing ? html`
                <button role="button" type="button" @click=${toggleEditMode}>
                  <material-symbols name="edit"></material-symbols>
                  ${t('supplier', 'editButtonLabel')}
                </button>
              ` : nothing}
            </header>

            <div class="content" style="max-width: 600px; margin: 0 auto;">
              ${state.isLoading ? renderLoadingState() : nothing}
              ${!state.isLoading && !state.supplier ? renderNotFoundState() : nothing}
              ${!state.isLoading && state.supplier && !state.isEditing ? renderViewMode() : nothing}
              ${!state.isLoading && state.supplier && state.isEditing ? renderEditMode() : nothing}
            </div>
          </div>
        </dialog>

        <dialog ${errorAlertDialog.element} role="alertdialog">
          <div class="container">
            <material-symbols name="error"></material-symbols>
            <header>
              <h3>${t('supplier', 'errorDialogTitle')}</h3>
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
                >${t('supplier', 'dismissButtonLabel')}</button>
              </li>
            </menu>
          </div>
        </dialog>

        <dialog ${deleteConfirmDialog.element} role="alertdialog" aria-labelledby="delete-confirm-title">
          <div class="container">
            <material-symbols name="delete"></material-symbols>
            <header>
              <h3 id="delete-confirm-title">${t('supplier', 'removeInventoryMappingTitle')}</h3>
            </header>
            <div class="content">
              <p>${t('supplier', 'removeInventoryMappingMessage', state.pendingDeleteInventory?.inventory_name)}</p>
              <p style="color: var(--md-sys-color-on-surface-variant); font-size: 0.875rem;">
                ${t('supplier', 'removeInventoryMappingNote')}
              </p>
            </div>
            <menu>
              <li>
                <button
                  role="button"
                  type="button"
                  class="text"
                  @click=${cancelDeleteSupplierInventory}
                >${t('supplier', 'cancelButtonLabel')}</button>
              </li>
              <li>
                <button
                  role="button"
                  type="button"
                  class="text"
                  style="color: var(--md-sys-color-error);"
                  @click=${deleteSupplierInventory}
                  ?disabled=${state.isSaving}
                >${t('supplier', 'removeButtonLabel')}</button>
              </li>
            </menu>
          </div>
        </dialog>
      `);
    });
  }
}

defineWebComponent('supplier-details-dialog', SupplierDetailsDialogElement);
