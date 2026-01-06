import { html, nothing } from 'lit-html';
import { reactive } from '@vue/reactivity';

import { defineWebComponent } from '#web/component.js';
import { DatabaseContextElement } from '#web/contexts/database-context.js';
import { useBusyStateUntil } from '#web/contexts/ready-context.js';
import { readValue } from '#web/directives/read-value.js';
import { useAdoptedStyleSheets } from '#web/hooks/use-adopted-style-sheets.js';
import { useContext } from '#web/hooks/use-context.js';
import { useDialog } from '#web/hooks/use-dialog.js';
import { useEffect } from '#web/hooks/use-effect.js';
import { useRender } from '#web/hooks/use-render.js';
import { webStyleSheets } from '#web/styles.js';
import { assertInstanceOf } from '#web/tools/assertion.js';

import '#web/components/material-symbols.js';
import '#web/components/barcode-assignment-dialog.js';

/**
 * @typedef {object} BarcodeRow
 * @property {string} code
 * @property {number} inventory_id
 * @property {string} inventory_name
 */

export class BarcodesViewElement extends HTMLElement {
  constructor() {
    super();

    const host = this;
    const database = useContext(host, DatabaseContextElement);

    const confirmDeleteDialog = useDialog(host);
    const errorAlertDialog = useDialog(host);
    const render = useRender(host);
    useAdoptedStyleSheets(host, webStyleSheets);

    const pageSize = 20;

    const state = reactive({
      barcodes: /** @type {BarcodeRow[]} */ ([]),
      isLoading: true,
      error: /** @type {Error | null} */ (null),
      searchQuery: '',
      currentPage: 1,
      totalCount: 0,
      selectedBarcodeCode: /** @type {string | null} */ (null),
      selectedInventoryName: /** @type {string | null} */ (null),
      isDeleting: false,
    });

    useBusyStateUntil(host, function firstLoad() {
      return state.isLoading === false;
    });

    function getTotalPages() {
      return Math.max(1, Math.ceil(state.totalCount / pageSize));
    }

    async function loadBarcodes() {
      try {
        state.isLoading = true;
        state.error = null;

        const searchQueryValue = state.searchQuery.trim() || null;
        const searchPattern = searchQueryValue ? `%${searchQueryValue}%` : null;
        const offset = (state.currentPage - 1) * pageSize;

        const countResult = await database.sql`
          SELECT COUNT(*) as count
          FROM inventory_barcodes ib
          JOIN inventories i ON i.id = ib.inventory_id
          WHERE (${searchPattern} IS NULL OR ib.code LIKE ${searchPattern} OR i.name LIKE ${searchPattern})
        `;
        state.totalCount = Number(countResult.rows[0].count);

        const result = await database.sql`
          SELECT
            ib.code,
            ib.inventory_id,
            i.name as inventory_name
          FROM inventory_barcodes ib
          JOIN inventories i ON i.id = ib.inventory_id
          WHERE (${searchPattern} IS NULL OR ib.code LIKE ${searchPattern} OR i.name LIKE ${searchPattern})
          ORDER BY ib.code ASC
          LIMIT ${pageSize} OFFSET ${offset}
        `;

        state.barcodes = result.rows.map(function (row) {
          return /** @type {BarcodeRow} */ ({
            code: String(row.code),
            inventory_id: Number(row.inventory_id),
            inventory_name: String(row.inventory_name),
          });
        });
      }
      catch (error) {
        console.error('Failed to load barcodes:', error);
        state.error = error instanceof Error ? error : new Error(String(error));
      }
      finally {
        state.isLoading = false;
      }
    }

    useEffect(host, loadBarcodes);

    /** @param {Event} event */
    function handleSearchInteraction(event) {
      if (event.currentTarget instanceof HTMLInputElement) {
        state.searchQuery = event.currentTarget.value;
        state.currentPage = 1;
      }
      else if (event.currentTarget instanceof HTMLButtonElement) {
        // the event.currentTarget.form.reset function is inconsistent across browsers.
        // this manually resets the form inputs to their default values instead.
        for (const element of event.currentTarget.form.elements) {
          if (element instanceof HTMLInputElement) {
            element.value = element.defaultValue;
            element.dispatchEvent(new Event('input', { bubbles: true }));
          }
        }
      }
      else if (event.currentTarget instanceof HTMLFormElement) {
        event.preventDefault();
      }
      else console.warn('Unhandled search interaction event from', event.currentTarget);
      loadBarcodes();
    }

    function handlePreviousPage() {
      if (state.currentPage > 1) {
        state.currentPage--;
        loadBarcodes();
      }
    }

    function handleNextPage() {
      if (state.currentPage < getTotalPages()) {
        state.currentPage++;
        loadBarcodes();
      }
    }

    /** @param {Event} event */
    function handleUnassignBarcode(event) {
      const target = /** @type {HTMLElement} */ (event.currentTarget);
      const barcodeCode = String(target.dataset.barcodeCode);
      const inventoryName = String(target.dataset.inventoryName);

      state.selectedBarcodeCode = barcodeCode;
      state.selectedInventoryName = inventoryName;
      confirmDeleteDialog.open = true;
    }

    async function confirmUnassignBarcode() {
      if (!state.selectedBarcodeCode) return;

      const tx = await database.transaction('write');

      try {
        state.isDeleting = true;
        state.error = null;

        await tx.sql`
          DELETE FROM inventory_barcodes
          WHERE code = ${state.selectedBarcodeCode}
        `;

        await tx.commit();

        confirmDeleteDialog.open = false;
        state.selectedBarcodeCode = null;
        state.selectedInventoryName = null;
        loadBarcodes();
      }
      catch (error) {
        await tx.rollback();
        state.error = error instanceof Error ? error : new Error(String(error));
        confirmDeleteDialog.open = false;
      }
      finally {
        state.isDeleting = false;
      }
    }

    function handleCancelUnassign() {
      state.selectedBarcodeCode = null;
      state.selectedInventoryName = null;
      confirmDeleteDialog.open = false;
    }

    function handleDismissErrorDialog() {
      state.error = null;
    }

    useEffect(host, function syncErrorAlertDialogState() {
      if (state.error instanceof Error) errorAlertDialog.open = true;
      else errorAlertDialog.open = false;
    });

    function renderEmptyState() {
      return html`
        <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 16px; padding: 48px 24px; color: var(--md-sys-color-on-surface-variant);">
          <material-symbols name="barcode" size="48"></material-symbols>
          <p style="text-align: center; margin: 0;">
            ${state.searchQuery ? 'No barcodes match your search' : 'No barcodes assigned yet'}
          </p>
          ${!state.searchQuery ? html`
            <button
              role="button"
              class="filled"
              commandfor="barcode-assignment-dialog"
              command="--open"
            >
              <material-symbols name="add"></material-symbols>
              Assign Barcode
            </button>
          ` : nothing}
        </div>
      `;
    }

    /**
     * @param {BarcodeRow} barcode
     */
    function renderBarcodeRow(barcode) {
      return html`
        <tr>
          <td>${barcode.code}</td>
          <td>${barcode.inventory_name}</td>
          <td class="center">
            <button
              role="button"
              class="text icon"
              aria-label="Unassign barcode ${barcode.code}"
              data-barcode-code="${barcode.code}"
              data-inventory-name="${barcode.inventory_name}"
              @click=${handleUnassignBarcode}
            >
              <material-symbols name="link_off"></material-symbols>
            </button>
          </td>
        </tr>
      `;
    }

    function renderPaginationControls() {
      const totalPages = getTotalPages();
      const startIndex = (state.currentPage - 1) * pageSize + 1;
      const endIndex = Math.min(state.currentPage * pageSize, state.totalCount);

      return html`
        <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px 0;">
          <span class="body-medium" style="color: var(--md-sys-color-on-surface-variant);">
            ${state.totalCount > 0 ? `${startIndex}-${endIndex} of ${state.totalCount}` : 'No results'}
          </span>
          <div style="display: flex; gap: 8px;">
            <button
              role="button"
              class="text icon"
              @click=${handlePreviousPage}
              ?disabled=${state.currentPage === 1 || state.isLoading}
              aria-label="Previous page"
            >
              <material-symbols name="chevron_left"></material-symbols>
            </button>
            <button
              role="button"
              class="text icon"
              @click=${handleNextPage}
              ?disabled=${state.currentPage >= totalPages || state.isLoading}
              aria-label="Next page"
            >
              <material-symbols name="chevron_right"></material-symbols>
            </button>
          </div>
        </div>
      `;
    }

    function renderBarcodesTable() {
      if (state.barcodes.length === 0) return renderEmptyState();

      return html`
        <div>
          <table aria-label="Barcodes list" style="--md-sys-density: -3;">
            <thead>
              <tr>
                <th scope="col">Barcode</th>
                <th scope="col">Product Name</th>
                <th scope="col" class="center" style="width: 100px;">Action</th>
              </tr>
            </thead>
            <tbody>
              ${state.barcodes.map(renderBarcodeRow)}
            </tbody>
          </table>
          ${renderPaginationControls()}
        </div>
      `;
    }

    function renderLoadingIndicator() {
      return html`
        <div style="display: flex; justify-content: center; align-items: center; padding: 48px;">
          <div role="progressbar" class="linear indeterminate" style="width: 200px;">
            <div class="track"><div class="indicator"></div></div>
          </div>
        </div>
      `;
    }

    function renderSearchBar() {
      return html`
        <form class="outlined-text-field" style="--md-sys-density: -4; min-width: 240px;" @submit=${handleSearchInteraction}>
          <div class="container">
            <material-symbols name="search" class="leading-icon" aria-hidden="true"></material-symbols>
            <label for="barcode-search-input">Search</label>
            <input
              id="barcode-search-input"
              type="text"
              placeholder=" "
              value=""
              @input=${handleSearchInteraction}
              ${readValue(state, 'searchQuery')}
            />
            ${state.searchQuery ? html`
              <button
                type="reset"
                class="trailing-icon"
                aria-label="Clear search"
                @click=${handleSearchInteraction}
              ><material-symbols name="close"></material-symbols></button>
            ` : nothing}
          </div>
        </form>
      `;
    }

    useEffect(host, function renderBarcodesView() {
      render(html`
        <div style="display: flex; flex-direction: column; gap: 12px; box-sizing: border-box; padding: 12px 24px; height: 100%; overflow-y: scroll;">
          <div style="display: flex; flex-direction: row; gap: 12px; align-items: center; justify-content: space-between;">
            ${renderSearchBar()}
            <button
              role="button"
              class="filled"
              commandfor="barcode-assignment-dialog"
              command="--open"
            >
              <material-symbols name="add"></material-symbols>
              Assign Barcode
            </button>
          </div>

          ${state.isLoading ? renderLoadingIndicator() : renderBarcodesTable()}
        </div>

        <barcode-assignment-dialog
          id="barcode-assignment-dialog"
          @barcode-assigned=${loadBarcodes}
        ></barcode-assignment-dialog>

        <dialog ${confirmDeleteDialog.element} id="confirm-delete-dialog" aria-labelledby="confirm-delete-dialog-title">
          <div class="container">
            <header>
              <material-symbols name="warning" size="24"></material-symbols>
              <h2 id="confirm-delete-dialog-title">Unassign Barcode</h2>
            </header>
            <section class="content">
              <p>Are you sure you want to unassign barcode <strong>${state.selectedBarcodeCode}</strong> from <strong>${state.selectedInventoryName}</strong>?</p>
            </section>
            <menu>
              <li>
                <button
                  role="button"
                  type="button"
                  class="text"
                  @click=${handleCancelUnassign}
                  ?disabled=${state.isDeleting}
                >Cancel</button>
              </li>
              <li>
                <button
                  role="button"
                  type="button"
                  class="filled"
                  @click=${confirmUnassignBarcode}
                  ?disabled=${state.isDeleting}
                >
                  ${state.isDeleting ? html`
                    <div role="progressbar" class="circular indeterminate" style="--md-sys-density: -8; --md-sys-size-factor: 1;">
                      <div class="track"><div class="indicator"></div></div>
                    </div>
                  ` : html`
                    <material-symbols name="link_off"></material-symbols>
                  `}
                  Unassign
                </button>
              </li>
            </menu>
          </div>
        </dialog>

        <dialog ${errorAlertDialog.element} id="error-alert-dialog" aria-labelledby="error-alert-dialog-title">
          <div class="container">
            <header>
              <material-symbols name="error" size="24"></material-symbols>
              <h2 id="error-alert-dialog-title">Error</h2>
            </header>
            <section class="content">
              <p>${state.error instanceof Error ? state.error.message : 'An error occurred'}</p>
            </section>
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

defineWebComponent('barcodes-view', BarcodesViewElement);
