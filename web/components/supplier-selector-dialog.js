import { html, nothing } from 'lit-html';
import { repeat } from 'lit-html/directives/repeat.js';
import { reactive } from '@vue/reactivity';

import { defineWebComponent } from '#web/component.js';
import { DatabaseContextElement } from '#web/contexts/database-context.js';
import { readValue } from '#web/directives/read-value.js';
import { useAdoptedStyleSheets } from '#web/hooks/use-adopted-style-sheets.js';
import { useContext } from '#web/hooks/use-context.js';
import { useDialog } from '#web/hooks/use-dialog.js';
import { useEffect } from '#web/hooks/use-effect.js';
import { useElement } from '#web/hooks/use-element.js';
import { useExposed } from '#web/hooks/use-exposed.js';
import { useRender } from '#web/hooks/use-render.js';
import { webStyleSheets } from '#web/styles.js';

import '#web/components/material-symbols.js';

/**
 * @typedef {object} SupplierRow
 * @property {number} id
 * @property {string} name
 * @property {string | null} phone_number
 */

/**
 * Supplier Selector Dialog Component
 * 
 * A dialog for searching and selecting suppliers.
 * 
 * @fires supplier-select - Fired when a supplier is selected. Detail: { supplierId: number, supplierName: string, phoneNumber: string | null }
 * 
 * @example assuming we use lit-html for rendering
    <button
      type="button"
      commandfor="supplier-selector-dialog"
      command="--open"
    >Select Supplier</button>
    <supplier-selector-dialog
      id="supplier-selector-dialog"
      @supplier-select=${() => console.log('Selected:', event.detail.supplierId, event.detail.supplierName)}
    ></supplier-selector-dialog>
 */
export class SupplierSelectorDialogElement extends HTMLElement {
  constructor() {
    super();

    const host = this;
    const database = useContext(host, DatabaseContextElement);
    const searchInputElement = useElement(host, HTMLInputElement);

    const dialog = useDialog(host);
    const render = useRender(host);
    useAdoptedStyleSheets(host, webStyleSheets);

    const state = reactive({
      /** @type {SupplierRow[]} */
      suppliers: [],
      searchQuery: '',
      isLoading: false,
      /** @type {Error | null} */
      error: null,
    });

    this.open = useExposed(host, function readDialogState() {
      return dialog.open;
    });

    useEffect(host, async function loadSuppliers() {
      if (!dialog.open) {
        // Reset state when dialog closes
        state.searchQuery = '';
        return;
      }

      const query = state.searchQuery.trim();

      try {
        state.isLoading = true;
        state.error = null;

        const searchPattern = query ? `%${query}%` : null;

        const result = await database.sql`
          SELECT id, name, phone_number
          FROM suppliers
          WHERE ${searchPattern} IS NULL OR name LIKE ${searchPattern}
          ORDER BY name ASC
          LIMIT 50
        `;

        state.suppliers = result.rows.map(function (row) {
          return /** @type {SupplierRow} */ ({
            id: Number(row.id),
            name: String(row.name),
            phone_number: row.phone_number ? String(row.phone_number) : null,
          });
        });
      }
      catch (error) {
        console.error('Failed to load suppliers:', error);
        state.error = error instanceof Error ? error : new Error(String(error));
      }
      finally {
        state.isLoading = false;
      }
    });

    /** @param {Event} event */
    function handleSupplierSelect(event) {
      const validEvent = (event instanceof MouseEvent && event.type === 'click')
        || (event instanceof KeyboardEvent && (['Enter', ' '].includes(event.key)));
      if (!validEvent) return;

      const listItem = event.currentTarget;
      if (!(listItem instanceof HTMLElement)) return;

      const supplierId = Number(listItem.dataset.value);
      const supplierName = String(listItem.dataset.name);
      const phoneNumber = listItem.dataset.phone ? String(listItem.dataset.phone) : null;

      host.dispatchEvent(new CustomEvent('supplier-select', {
        detail: { supplierId, supplierName, phoneNumber },
        bubbles: true,
        composed: true,
      }));

      dialog.open = false;
    }

    function renderLoadingIndicator() {
      return html`
        <section class="loading-state" role="status" aria-live="polite" aria-label="Loading suppliers">
          <div role="progressbar" class="linear indeterminate">
            <div class="track">
              <div class="indicator"></div>
            </div>
          </div>
          <p>Loading suppliers...</p>
        </section>
      `;
    }

    function renderErrorNotice() {
      return html`
        <section role="alert" aria-live="assertive">
          <material-symbols name="error" size="48"></material-symbols>
          <h3>Unable to load suppliers</h3>
          <p>${state.error.message}</p>
        </section>
      `;
    }

    function renderSupplierList() {
      if (state.suppliers.length === 0) return html`
        <section aria-live="polite" style="display: flex; flex-direction: column; align-items: center; gap: 16px;">
          <material-symbols name="local_shipping" size="48"></material-symbols>
          <p>${state.searchQuery ? 'No suppliers match your search' : 'No suppliers available'}</p>
        </section>
      `;
      else return html`
        <menu role="list" aria-label="Available suppliers" style="max-height: 320px; overflow-y: auto;">
          ${repeat(state.suppliers, supplier => supplier.id, supplier => html`
            <li
              role="menuitemradio"
              aria-checked="false"
              class="divider-inset"
              tabindex="0"
              data-value=${supplier.id}
              data-name=${supplier.name}
              data-phone=${supplier.phone_number || ''}
              @click=${handleSupplierSelect}
              @keydown=${handleSupplierSelect}
            >
              <div class="content">
                <div class="headline">${supplier.name}</div>
                ${supplier.phone_number ? html`
                  <div class="supporting-text">${supplier.phone_number}</div>
                ` : nothing}
              </div>
            </li>
          `)}
        </menu>
      `;
    }

    useEffect(host, function renderDialog() {
      render(html`
        <dialog
          ${dialog.element}
          id="supplier-selector-dialog"
          aria-labelledby="supplier-selector-dialog-title"
        >
          <form class="container" style="max-width: min(320px, 90vw);">
            <header>
              <h2 id="supplier-selector-dialog-title">Select Supplier</h2>
            </header>

            <div class="content">
              <div class="outlined-text-field" style="--md-sys-density: -4;">
                <div class="container">
                  <material-symbols name="search" class="leading-icon" aria-hidden="true"></material-symbols>
                  <label for="supplier-search">Search suppliers</label>
                  <input
                    ${searchInputElement}
                    ${readValue(state, 'searchQuery')}
                    id="supplier-search"
                    type="text"
                    placeholder=" "
                    autocomplete="off"
                  />
                </div>
              </div>
              ${state.isLoading ? renderLoadingIndicator() : nothing}
              ${state.error instanceof Error ? renderErrorNotice() : nothing}
              ${!state.isLoading ? renderSupplierList() : nothing}
            </div>

            <menu>
              <li>
                <button
                  role="button"
                  type="button"
                  class="text"
                  commandfor="supplier-selector-dialog"
                  command="close"
                  style="--sys-md-density: -4;"
                >Cancel</button>
              </li>
            </menu>
          </form>
        </dialog>
      `);
    });
  }
}

defineWebComponent('supplier-selector-dialog', SupplierSelectorDialogElement);
