import { html, nothing } from 'lit-html';
import { repeat } from 'lit-html/directives/repeat.js';
import { reactive } from '@vue/reactivity';

import { defineWebComponent } from '#web/component.js';
import { DatabaseContextElement } from '#web/contexts/database-context.js';
import { I18nContextElement } from '#web/contexts/i18n-context.js';
import { readValue } from '#web/directives/read-value.js';
import { useAdoptedStyleSheets } from '#web/hooks/use-adopted-style-sheets.js';
import { useContext } from '#web/hooks/use-context.js';
import { useDialog } from '#web/hooks/use-dialog.js';
import { useEffect } from '#web/hooks/use-effect.js';
import { useElement } from '#web/hooks/use-element.js';
import { useExposed } from '#web/hooks/use-exposed.js';
import { useRender } from '#web/hooks/use-render.js';
import { useTranslator } from '#web/hooks/use-translator.js';
import { webStyleSheets } from '#web/styles.js';

import '#web/components/material-symbols.js';

/**
 * @typedef {object} InventoryRow
 * @property {number} id
 * @property {string} name
 * @property {number} unit_price
 * @property {string | null} unit_of_measurement
 * @property {number} stock
 */

/**
 * @typedef {HTMLElementEventMap & { 'inventory-select': CustomEvent<{ inventoryId: number, inventoryName: string }> }} InventorySelectorDialogElementEventMap
 */

/**
 * @template {keyof InventorySelectorDialogElementEventMap} K
 * @typedef {(type: K, listener: (this: InventorySelectorDialogElement, ev: InventorySelectorDialogElementEventMap[K]) => any, options?: boolean | AddEventListenerOptions) => void} InventorySelectorDialogElementAddEventListenerType
 */

/**
 * Inventory Selector Dialog Component
 * 
 * A dialog for searching and selecting inventories.
 * 
 * @class
 * @property {InventorySelectorDialogElementAddEventListenerType} addEventListener - Add event listener method
 * 
 * @example assuming we use lit-html for rendering
    <button
      type="button"
      commandfor="inventory-selector-dialog"
      command="--open"
    >Select Inventory</button>
    <inventory-selector-dialog
      id="inventory-selector-dialog"
      @inventory-select=${() => console.log('Selected:', event.detail.inventoryId, event.detail.inventoryName)}
    ></inventory-selector-dialog>
 */
export class InventorySelectorDialogElement extends HTMLElement {
  constructor() {
    super();

    const host = this;
    const database = useContext(host, DatabaseContextElement);
    const i18n = useContext(host, I18nContextElement);
    const t = useTranslator(host);
    const searchInputElement = useElement(host, HTMLInputElement);

    const dialog = useDialog(host);
    const render = useRender(host);
    useAdoptedStyleSheets(host, webStyleSheets);

    const state = reactive({
      inventories: /** @type {InventoryRow[]} */ ([]),
      searchQuery: '',
      isLoading: false,
      error: /** @type {Error | null} */ (null),
    });

    this.open = useExposed(host, function readDialogState() {
      return dialog.open;
    });

    useEffect(host, async function loadInventories() {
      if (!dialog.open) {
        // Reset state when dialog closes
        state.searchQuery = '';
        return;
      }

      const query = state.searchQuery.trim();

      try {
        state.isLoading = true;
        state.error = null;

        const result = await database.sql`
          SELECT
            id,
            name,
            unit_price,
            unit_of_measurement,
            stock
          FROM inventories
          WHERE
            ${query} = ''
            OR name LIKE '%' || ${query} || '%'
          ORDER BY name ASC
        `;

        state.inventories = result.rows.map(function (row) {
          return /** @type {InventoryRow} */ ({
            id: Number(row.id),
            name: String(row.name),
            unit_price: Number(row.unit_price),
            unit_of_measurement: row.unit_of_measurement ? String(row.unit_of_measurement) : null,
            stock: Number(row.stock),
          });
        });
      }
      catch (error) {
        console.error('Failed to load inventories:', error);
        state.error = error instanceof Error ? error : new Error(String(error));
      }
      finally {
        state.isLoading = false;
      }
    });

    /** @param {Event} event */
    function handleInventorySelect(event) {
      const validEvent = (event instanceof MouseEvent && event.type === 'click')
        || (event instanceof KeyboardEvent && (['Enter', ' '].includes(event.key)));
      if (!validEvent) return;

      const listItem = event.currentTarget;
      if (!(listItem instanceof HTMLElement)) return;

      const inventoryId = Number(listItem.dataset.value);
      const inventoryName = String(listItem.dataset.name);

      host.dispatchEvent(new CustomEvent('inventory-select', {
        detail: { inventoryId, inventoryName },
        bubbles: true,
        composed: true,
      }));

      dialog.open = false;
    }

    function renderLoadingIndicator() {
      return html`
        <section class="loading-state" role="status" aria-live="polite" aria-label="${t('inventory', 'loadingInventoriesAriaLabel')}">
          <div role="progressbar" class="linear indeterminate">
            <div class="track">
              <div class="indicator"></div>
            </div>
          </div>
          <p>${t('inventory', 'loadingInventoriesMessage')}</p>
        </section>
      `;
    }

    function renderErrorNotice() {
      return html`
        <section role="alert" aria-live="assertive">
          <material-symbols name="error" size="48"></material-symbols>
          <h3>${t('inventory', 'unableToLoadInventoriesTitle')}</h3>
          <p>${state.error.message}</p>
        </section>
      `;
    }

    function renderInventoryList() {
      const filteredInventories = state.inventories;
      if (filteredInventories.length === 0) return html`
        <section aria-live="polite" style="display: flex; flex-direction: column; align-items: center; gap: 16px;">
          <material-symbols name="search_off" size="48"></material-symbols>
          <p>${state.searchQuery ? t('inventory', 'noInventoriesMatchSearchMessage') : t('inventory', 'noInventoriesAvailableMessage')}</p>
        </section>
      `;
      else return html`
        <menu role="menu" aria-label="${t('inventory', 'availableInventoriesAriaLabel')}" style="max-height: 320px; overflow-y: auto;">
          ${repeat(filteredInventories, inventory => inventory.id, inventory => html`
            <li
              role="menuitemradio"
              aria-checked="false"
              class="divider-inset"
              tabindex="0"
              data-value=${inventory.id}
              data-name=${inventory.name}
              @click=${handleInventorySelect}
              @keydown=${handleInventorySelect}
            >
              <div class="content">
                <div class="headline">${inventory.name}</div>
                <div class="supporting-text">
                  ${t('inventory', 'stockLabel')}: ${inventory.stock}${inventory.unit_of_measurement ? ` ${inventory.unit_of_measurement}` : ''}
                </div>
              </div>
              <div class="trailing text">
                ${i18n.displayCurrency(inventory.unit_price)}
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
          id="inventory-selector-dialog"
          aria-labelledby="inventory-selector-dialog-title"
        >
          <form class="container" style="max-width: min(320px, 90vw);">
            <header>
              <h2 id="inventory-selector-dialog-title">${t('inventory', 'selectDialogTitle')}</h2>
            </header>

            <div class="content">
              <div class="outlined-text-field" style="--md-sys-density: -4;">
                <div class="container">
                  <material-symbols name="search" class="leading-icon" aria-hidden="true"></material-symbols>
                  <label for="inventory-search">${t('inventory', 'searchInventoriesLabel')}</label>
                  <input
                    ${searchInputElement}
                    ${readValue(state, 'searchQuery')}
                    id="inventory-search"
                    type="text"
                    placeholder=" "
                    autocomplete="off"
                  />
                </div>
              </div>
              ${state.isLoading ? renderLoadingIndicator() : nothing}
              ${state.error instanceof Error ? renderErrorNotice() : nothing}
              ${!state.isLoading ? renderInventoryList() : nothing}
            </div>

            <menu>
              <li>
                <button
                  role="button"
                  type="button"
                  class="text"
                  commandfor="inventory-selector-dialog"
                  command="close"
                  style="--sys-md-density: -4;"
                >${t('inventory', 'cancelButtonLabel')}</button>
              </li>
            </menu>
          </form>
        </dialog>
      `);
    });
  }
}

defineWebComponent('inventory-selector-dialog', InventorySelectorDialogElement);
