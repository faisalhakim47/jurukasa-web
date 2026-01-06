import { html, nothing } from 'lit-html';
import { reactive } from '@vue/reactivity';

import { defineWebComponent } from '#web/component.js';
import { SupplierCreationDialogElement } from '#web/components/supplier-creation-dialog.js';
import { SupplierDetailsDialogElement } from '#web/components/supplier-details-dialog.js';
import { DatabaseContextElement } from '#web/contexts/database-context.js';
import { useBusyStateUntil } from '#web/contexts/ready-context.js';
import { readValue } from '#web/directives/read-value.js';
import { useAdoptedStyleSheets } from '#web/hooks/use-adopted-style-sheets.js';
import { useContext } from '#web/hooks/use-context.js';
import { useEffect } from '#web/hooks/use-effect.js';
import { useElement } from '#web/hooks/use-element.js';
import { useRender } from '#web/hooks/use-render.js';
import { webStyleSheets } from '#web/styles.js';
import { assertInstanceOf } from '#web/tools/assertion.js';

import '#web/components/material-symbols.js';
import '#web/components/supplier-creation-dialog.js';
import '#web/components/supplier-details-dialog.js';

/**
 * @typedef {object} SupplierRow
 * @property {number} id
 * @property {string} name
 * @property {string | null} phone_number
 * @property {number} inventory_count
 * @property {number} purchase_count
 */

export class SuppliersViewElement extends HTMLElement {
  constructor() {
    super();

    const host = this;
    const database = useContext(host, DatabaseContextElement);

    const supplierCreationDialog = useElement(host, SupplierCreationDialogElement);
    const supplierDetailsDialog = useElement(host, SupplierDetailsDialogElement);
    const render = useRender(host);
    useAdoptedStyleSheets(host, webStyleSheets);

    const pageSize = 20;

    const state = reactive({
      suppliers: /** @type {SupplierRow[]} */ ([]),
      isLoading: true,
      error: /** @type {Error | null} */ (null),
      searchQuery: '',
      currentPage: 1,
      totalCount: 0,
      selectedSupplierId: /** @type {number | null} */ (null),
    });

    useBusyStateUntil(host, function firstLoad() {
      return state.isLoading === false;
    });

    function getTotalPages() {
      return Math.max(1, Math.ceil(state.totalCount / pageSize));
    }

    async function loadSuppliers() {
      try {
        state.isLoading = true;
        state.error = null;

        const searchQueryValue = state.searchQuery.trim() || null;
        const searchPattern = searchQueryValue ? `%${searchQueryValue}%` : null;
        const offset = (state.currentPage - 1) * pageSize;

        const countResult = await database.sql`
          SELECT COUNT(*) as count
          FROM suppliers s
          WHERE (${searchPattern} IS NULL OR s.name LIKE ${searchPattern} OR s.phone_number LIKE ${searchPattern})
        `;
        state.totalCount = Number(countResult.rows[0].count);

        const result = await database.sql`
          SELECT
            s.id,
            s.name,
            s.phone_number,
            (SELECT COUNT(DISTINCT si.inventory_id) FROM supplier_inventories si WHERE si.supplier_id = s.id) as inventory_count,
            (SELECT COUNT(*) FROM purchases p WHERE p.supplier_id = s.id) as purchase_count
          FROM suppliers s
          WHERE (${searchPattern} IS NULL OR s.name LIKE ${searchPattern} OR s.phone_number LIKE ${searchPattern})
          ORDER BY s.name ASC
          LIMIT ${pageSize} OFFSET ${offset}
        `;

        state.suppliers = result.rows.map(function (row) {
          return /** @type {SupplierRow} */ ({
            id: Number(row.id),
            name: String(row.name),
            phone_number: row.phone_number ? String(row.phone_number) : null,
            inventory_count: Number(row.inventory_count),
            purchase_count: Number(row.purchase_count),
          });
        });

        state.isLoading = false;
      }
      catch (error) {
        state.error = error instanceof Error ? error : new Error(String(error));
        state.isLoading = false;
      }
    }

    function goToPage(/** @type {number} */ page) {
      const totalPages = getTotalPages();
      if (page < 1 || page > totalPages) return;
      state.currentPage = page;
      loadSuppliers();
    }

    function handleFirstPage() {
      goToPage(1);
    }

    function handlePreviousPage() {
      goToPage(state.currentPage - 1);
    }

    function handleNextPage() {
      goToPage(state.currentPage + 1);
    }

    function handleLastPage() {
      goToPage(getTotalPages());
    }

    /** @param {Event} event */
    function handleSearchInput(event) {
      assertInstanceOf(HTMLInputElement, event.target);
      state.searchQuery = event.target.value;
      state.currentPage = 1;
      loadSuppliers();
    }

    /** @param {Event} event */
    function handleSupplierRowInteraction(event) {
      assertInstanceOf(HTMLTableRowElement, event.currentTarget);

      const supplierId = parseInt(event.currentTarget.dataset.supplierId, 10);
      if (isNaN(supplierId)) return;

      const isOpeningAction = (event instanceof MouseEvent && event.type === 'click')
        || (event instanceof KeyboardEvent && ['Enter', ' '].includes(event.key));

      if (isOpeningAction) {
        state.selectedSupplierId = supplierId;
        supplierDetailsDialog.value?.dispatchEvent(new CommandEvent('command', {
          command: '--open',
          bubbles: true,
          cancelable: true,
        }));
        event.preventDefault();
      }
    }

    useEffect(host, loadSuppliers);

    function renderLoadingIndicator() {
      return html`
        <div
          role="status"
          aria-label="Loading suppliers"
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
          <p>Loading suppliers...</p>
        </div>
      `;
    }

    /**
     * @param {Error} error
     */
    function renderErrorNotice(error) {
      return html`
        <div
          role="alert"
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
          <material-symbols name="error" size="48"></material-symbols>
          <h2 class="title-large" style="color: var(--md-sys-color-on-surface);">Unable to load suppliers</h2>
          <p style="color: var(--md-sys-color-on-surface-variant);">${error.message}</p>
          <button role="button" class="tonal" @click=${loadSuppliers}>
            <material-symbols name="refresh"></material-symbols>
            Retry
          </button>
        </div>
      `;
    }

    function renderFilterControls() {
      return html`
        <div style="display: flex; flex-direction: row; gap: 12px; align-items: center; flex-wrap: wrap;">
          <!-- Search Field -->
          <div class="outlined-text-field" style="--md-sys-density: -4; width: 250px; min-width: 160px;">
            <div class="container">
              <material-symbols name="search" class="leading-icon" aria-hidden="true"></material-symbols>
              <label for="supplier-search-input">Search</label>
              <input
                ${readValue(state, 'searchQuery')}
                id="supplier-search-input"
                type="text"
                placeholder=" "
                autocomplete="off"
                @input=${handleSearchInput}
              />
            </div>
          </div>
        </div>
      `;
    }

    function renderEmptyState() {
      return html`
        <div
          style="
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            gap: 16px;
            min-height: 300px;
            text-align: center;
            padding: 48px;
          "
        >
          <material-symbols name="local_shipping" size="64"></material-symbols>
          <h2 class="title-large" style="color: var(--md-sys-color-on-surface);">No suppliers found</h2>
          <p style="max-width: 400px; color: var(--md-sys-color-on-surface-variant);">
            ${state.searchQuery
          ? 'Try adjusting your search.'
          : 'Start by adding your first supplier to manage your inventory sources.'}
          </p>
          ${!state.searchQuery ? html`
            <button
              role="button"
              type="button"
              class="tonal"
              commandfor="supplier-creation-dialog"
              command="--open"
            >
              <material-symbols name="add"></material-symbols>
              Add Supplier
            </button>
          ` : nothing}
        </div>
      `;
    }

    /**
     * @param {SupplierRow} supplier
     */
    function renderSupplierRow(supplier) {
      return html`
        <tr
          tabindex="0"
          aria-label="Supplier ${supplier.name}"
          data-supplier-id="${supplier.id}"
          @click=${handleSupplierRowInteraction}
          @keydown=${handleSupplierRowInteraction}
          style="cursor: pointer;"
        >
          <td style="max-width: 300px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
            <span style="font-weight: 500;">${supplier.name}</span>
          </td>
          <td style="color: var(--md-sys-color-on-surface-variant);">
            ${supplier.phone_number || '—'}
          </td>
          <td class="numeric">
            <span
              class="label-small"
              style="
                display: inline-flex;
                align-items: center;
                justify-content: center;
                min-width: 24px;
                height: 24px;
                padding: 0 8px;
                border-radius: var(--md-sys-shape-corner-full);
                background-color: ${supplier.inventory_count > 0 ? 'var(--md-sys-color-primary-container)' : 'var(--md-sys-color-surface-container-high)'};
                color: ${supplier.inventory_count > 0 ? 'var(--md-sys-color-on-primary-container)' : 'var(--md-sys-color-on-surface-variant)'};
              "
            >${supplier.inventory_count}</span>
          </td>
          <td class="numeric">
            <span
              class="label-small"
              style="
                display: inline-flex;
                align-items: center;
                justify-content: center;
                min-width: 24px;
                height: 24px;
                padding: 0 8px;
                border-radius: var(--md-sys-shape-corner-full);
                background-color: ${supplier.purchase_count > 0 ? 'var(--md-sys-color-secondary-container)' : 'var(--md-sys-color-surface-container-high)'};
                color: ${supplier.purchase_count > 0 ? 'var(--md-sys-color-on-secondary-container)' : 'var(--md-sys-color-on-surface-variant)'};
              "
            >${supplier.purchase_count}</span>
          </td>
        </tr>
      `;
    }

    function renderPaginationControls() {
      const totalPages = getTotalPages();
      if (totalPages <= 1) return nothing;

      const startItem = (state.currentPage - 1) * pageSize + 1;
      const endItem = Math.min(state.currentPage * pageSize, state.totalCount);

      return html`
        <nav
          role="navigation"
          aria-label="Pagination"
          style="
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 12px 16px;
            border-top: 1px solid var(--md-sys-color-outline-variant);
          "
        >
          <span class="body-small" style="color: var(--md-sys-color-on-surface-variant);">
            Showing ${startItem}–${endItem} of ${state.totalCount}
          </span>
          <div style="display: flex; gap: 8px; align-items: center;">
            <button
              role="button"
              class="text"
              @click=${handleFirstPage}
              ?disabled=${state.currentPage === 1}
              aria-label="First page"
            >
              <material-symbols name="first_page"></material-symbols>
            </button>
            <button
              role="button"
              class="text"
              @click=${handlePreviousPage}
              ?disabled=${state.currentPage === 1}
              aria-label="Previous page"
            >
              <material-symbols name="chevron_left"></material-symbols>
            </button>
            <span class="body-medium" style="min-width: 80px; text-align: center;">
              Page ${state.currentPage} of ${totalPages}
            </span>
            <button
              role="button"
              class="text"
              @click=${handleNextPage}
              ?disabled=${state.currentPage === totalPages}
              aria-label="Next page"
            >
              <material-symbols name="chevron_right"></material-symbols>
            </button>
            <button
              role="button"
              class="text"
              @click=${handleLastPage}
              ?disabled=${state.currentPage === totalPages}
              aria-label="Last page"
            >
              <material-symbols name="last_page"></material-symbols>
            </button>
          </div>
        </nav>
      `;
    }

    function renderSuppliersTable() {
      if (state.suppliers.length === 0) return renderEmptyState();

      return html`
        <div>
          <table aria-label="Suppliers list" style="--md-sys-density: -3;">
            <thead>
              <tr>
                <th scope="col">Name</th>
                <th scope="col" style="width: 180px;">Phone Number</th>
                <th scope="col" class="numeric" style="width: 100px;">Items</th>
                <th scope="col" class="numeric" style="width: 100px;">Purchases</th>
              </tr>
            </thead>
            <tbody>
              ${state.suppliers.map(renderSupplierRow)}
            </tbody>
          </table>
          ${renderPaginationControls()}
        </div>
      `;
    }

    useEffect(host, function renderSuppliersView() {
      render(html`
        <div style="display: flex; flex-direction: column; gap: 12px; box-sizing: border-box; padding: 12px 24px; height: 100%; overflow-y: scroll;">
          <div style="display: flex; flex-direction: row; gap: 12px; align-items: center; justify-content: space-between;">
            ${renderFilterControls()}
            <div>
              <button role="button" class="text" @click=${loadSuppliers} aria-label="Refresh suppliers">
                <material-symbols name="refresh"></material-symbols>
                Refresh
              </button>
              <button role="button" type="button" class="tonal" commandfor="supplier-creation-dialog" command="--open">
                <material-symbols name="add"></material-symbols>
                Add Supplier
              </button>
            </div>
          </div>

          ${state.isLoading ? renderLoadingIndicator() : nothing}
          ${state.error instanceof Error ? renderErrorNotice(state.error) : nothing}
          ${state.isLoading === false && state.error === null ? renderSuppliersTable() : nothing}
        </div>

        <supplier-creation-dialog
          ${supplierCreationDialog}
          id="supplier-creation-dialog"
          @supplier-created=${loadSuppliers}
        ></supplier-creation-dialog>

        <supplier-details-dialog
          ${supplierDetailsDialog}
          id="supplier-details-dialog"
          supplier-id=${state.selectedSupplierId}
          @supplier-updated=${loadSuppliers}
        ></supplier-details-dialog>
      `);
    });
  }
}

defineWebComponent('suppliers-view', SuppliersViewElement);
