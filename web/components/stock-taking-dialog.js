import { reactive } from '@vue/reactivity';
import { html, nothing } from 'lit-html';

import { defineWebComponent } from '#web/component.js';
import { useDialog } from '#web/hooks/use-dialog.js';
import { useAdoptedStyleSheets } from '#web/hooks/use-adopted-style-sheets.js';
import { DatabaseContextElement } from '#web/contexts/database-context.js';
import { I18nContextElement } from '#web/contexts/i18n-context.js';
import { useAttribute } from '#web/hooks/use-attribute.js';
import { useContext } from '#web/hooks/use-context.js';
import { useEffect } from '#web/hooks/use-effect.js';
import { useRender } from '#web/hooks/use-render.js';
import { webStyleSheets } from '#web/styles.js';
import { assertInstanceOf } from '#web/tools/assertion.js';
import { feedbackDelay } from '#web/tools/timing.js';

import '#web/components/material-symbols.js';

/**
 * @typedef {object} InventoryData
 * @property {number} id
 * @property {string} name
 * @property {number} stock
 * @property {number} cost
 * @property {string | null} unit_of_measurement
 */

/**
 * Stock Taking Dialog Component
 * 
 * @fires stock-taking-created - Fired when a stock taking is successfully created. Detail: { stockTakingId: number }
 */
export class StockTakingDialogElement extends HTMLElement {
  static get observedAttributes() {
    return ['inventory-id'];
  }

  constructor() {
    super();

    const host = this;
    const database = useContext(host, DatabaseContextElement);
    const i18n = useContext(host, I18nContextElement);

    const inventoryIdAttr = useAttribute(host, 'inventory-id');
    const errorAlertDialog = useDialog(host);

    const dialog = useDialog(host);
    const render = useRender(host);
    useAdoptedStyleSheets(host, webStyleSheets);

    const state = reactive({
      inventory: /** @type {InventoryData | null} */ (null),
      isLoadingInventory: false,
      actualStock: /** @type {number | null} */ (null),
    });

    const form = reactive({
      state: /** @type {'idle' | 'submitting' | 'success' | 'error'} */ ('idle'),
      error: /** @type {Error | null} */ (null),
    });

    async function loadInventory() {
      const inventoryId = inventoryIdAttr.value ? Number(inventoryIdAttr.value) : null;
      if (inventoryId === null || isNaN(inventoryId)) {
        state.inventory = null;
        state.actualStock = null;
        return;
      }

      try {
        state.isLoadingInventory = true;

        const result = await database.sql`
          SELECT id, name, stock, cost, unit_of_measurement
          FROM inventories
          WHERE id = ${inventoryId}
        `;

        if (result.rows.length === 0) {
          state.inventory = null;
          state.actualStock = null;
          state.isLoadingInventory = false;
          return;
        }

        const row = result.rows[0];
        state.inventory = /** @type {InventoryData} */ ({
          id: Number(row.id),
          name: String(row.name),
          stock: Number(row.stock),
          cost: Number(row.cost),
          unit_of_measurement: row.unit_of_measurement ? String(row.unit_of_measurement) : null,
        });
        state.actualStock = state.inventory.stock;
        state.isLoadingInventory = false;
      }
      catch (error) {
        state.isLoadingInventory = false;
        console.error('Failed to load inventory:', error);
      }
    }

    useEffect(host, function loadOnOpen() {
      if (dialog.open) {
        loadInventory();
      }
    });

    /** @param {Event} event */
    function handleActualStockInput(event) {
      assertInstanceOf(HTMLInputElement, event.target);
      state.actualStock = parseInt(event.target.value, 10);
    }

    function calculateActualCost() {
      if (!state.inventory || state.actualStock === null) return 0;
      const expectedStock = state.inventory.stock;
      const expectedCost = state.inventory.cost;

      if (expectedStock <= 0) {
        // If no expected stock, cost is 0 for any actual stock
        return 0;
      }

      // Calculate average cost per unit from expected values
      const avgCostPerUnit = expectedCost / expectedStock;
      return Math.round(avgCostPerUnit * state.actualStock);
    }

    function calculateVariance() {
      if (!state.inventory || state.actualStock === null) return { stock: 0, cost: 0 };
      return {
        stock: state.actualStock - state.inventory.stock,
        cost: calculateActualCost() - state.inventory.cost,
      };
    }

    /** @param {SubmitEvent} event */
    async function handleSubmit(event) {
      event.preventDefault();
      assertInstanceOf(HTMLFormElement, event.currentTarget);

      if (!state.inventory || state.actualStock === null) {
        form.error = new Error('Please enter actual stock.');
        return;
      }

      const tx = await database.transaction('write');

      try {
        form.state = 'submitting';
        form.error = null;

        const expectedStock = state.inventory.stock;
        const expectedCost = state.inventory.cost;
        const actualStock = state.actualStock;
        const actualCost = calculateActualCost();
        const auditTime = Date.now();

        // Insert stock taking record (triggers will handle journal entry and inventory update)
        const result = await tx.sql`
          INSERT INTO stock_takings (inventory_id, audit_time, expected_stock, actual_stock, expected_cost, actual_cost)
          VALUES (${state.inventory.id}, ${auditTime}, ${expectedStock}, ${actualStock}, ${expectedCost}, ${actualCost})
          RETURNING id;
        `;

        const stockTakingId = Number(result.rows[0].id);

        await tx.commit();

        form.state = 'success';
        await feedbackDelay();

        host.dispatchEvent(new CustomEvent('stock-taking-created', {
          detail: { stockTakingId },
          bubbles: true,
          composed: true,
        }));

        dialog.open = false;
        // Reset form
        state.actualStock = null;
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

    function renderLoadingIndicator() {
      return html`
        <div
          role="status"
          aria-label="Loading inventory"
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
          <p>Loading inventory...</p>
        </div>
      `;
    }

    function renderNoInventoryState() {
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
            padding: 48px;
          "
        >
          <material-symbols name="inventory_2" size="64"></material-symbols>
          <h2 class="title-large" style="color: var(--md-sys-color-on-surface);">No inventory selected</h2>
          <p style="max-width: 400px; color: var(--md-sys-color-on-surface-variant);">
            Please select an inventory item from the list to perform stock taking.
          </p>
        </div>
      `;
    }

    function renderStockTakingForm() {
      if (!state.inventory) return renderNoInventoryState();

      const variance = calculateVariance();
      const actualCost = calculateActualCost();

      return html`
        <div style="display: flex; flex-direction: column; gap: 24px; padding: 16px 0px; max-width: 600px; margin: 0 auto;">
          <!-- Selected Inventory Info -->
          <div style="background-color: var(--md-sys-color-surface-container); padding: 16px; border-radius: var(--md-sys-shape-corner-medium);">
            <h3 class="title-medium" style="margin: 0 0 12px 0;">${state.inventory.name}</h3>
            ${state.inventory.unit_of_measurement ? html`
              <p class="body-small" style="color: var(--md-sys-color-on-surface-variant); margin: 0 0 12px 0;">
                Unit: ${state.inventory.unit_of_measurement}
              </p>
            ` : nothing}
            <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px;">
              <div>
                <p class="label-small" style="color: var(--md-sys-color-on-surface-variant); margin: 0;">Current Stock</p>
                <p class="body-large" style="margin: 0;">${state.inventory.stock}</p>
              </div>
              <div>
                <p class="label-small" style="color: var(--md-sys-color-on-surface-variant); margin: 0;">Current Cost</p>
                <p class="body-large" style="margin: 0;">${i18n.displayCurrency(state.inventory.cost)}</p>
              </div>
            </div>
          </div>

          <!-- Actual Stock Input -->
          <div class="outlined-text-field">
            <div class="container">
              <label for="actual-stock-input">Actual Stock Count</label>
              <input
                id="actual-stock-input"
                name="actualStock"
                type="number"
                inputmode="numeric"
                placeholder=" "
                required
                .value=${String(state.actualStock ?? '')}
                @input=${handleActualStockInput}
              />
            </div>
            <div class="supporting-text">Enter the physically counted stock quantity</div>
          </div>

          <!-- Variance Preview -->
          ${state.actualStock !== null ? html`
            <div style="background-color: var(--md-sys-color-surface-container-high); padding: 16px; border-radius: var(--md-sys-shape-corner-medium);">
              <h4 class="title-small" style="margin: 0 0 12px 0;">Adjustment Preview</h4>
              <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px;">
                <div>
                  <p class="label-small" style="color: var(--md-sys-color-on-surface-variant); margin: 0;">Stock Variance</p>
                  <p
                    class="body-large"
                    style="
                      margin: 0;
                      color: ${variance.stock > 0 ? '#1B5E20' : variance.stock < 0 ? 'var(--md-sys-color-error)' : 'inherit'};
                    "
                  >
                    ${variance.stock > 0 ? '+' : ''}${variance.stock}
                  </p>
                </div>
                <div>
                  <p class="label-small" style="color: var(--md-sys-color-on-surface-variant); margin: 0;">Cost Adjustment</p>
                  <p
                    class="body-large"
                    style="
                      margin: 0;
                      color: ${variance.cost > 0 ? '#1B5E20' : variance.cost < 0 ? 'var(--md-sys-color-error)' : 'inherit'};
                    "
                  >
                    ${variance.cost > 0 ? '+' : ''}${i18n.displayCurrency(variance.cost)}
                  </p>
                </div>
                <div>
                  <p class="label-small" style="color: var(--md-sys-color-on-surface-variant); margin: 0;">New Stock</p>
                  <p class="body-large" style="margin: 0;">${state.actualStock}</p>
                </div>
                <div>
                  <p class="label-small" style="color: var(--md-sys-color-on-surface-variant); margin: 0;">New Cost</p>
                  <p class="body-large" style="margin: 0;">${i18n.displayCurrency(actualCost)}</p>
                </div>
              </div>
              ${variance.cost !== 0 ? html`
                <p class="body-small" style="margin: 12px 0 0 0; color: var(--md-sys-color-on-surface-variant);">
                  ${variance.cost > 0 
                    ? 'A journal entry will be created to record the inventory gain.'
                    : 'A journal entry will be created to record the inventory shrinkage.'}
                </p>
              ` : nothing}
            </div>
          ` : nothing}
        </div>
      `;
    }

    useEffect(host, function renderDialog() {
      render(html`
        <dialog
          ${dialog.element}
          id="stock-taking-dialog"
          class="full-screen"
          aria-labelledby="stock-taking-dialog-title"
        >
          <form class="container" @submit=${handleSubmit}>
            <header>
              <h2 id="stock-taking-dialog-title">Stock Taking</h2>
              <button
                role="button"
                type="button"
                class="text"
                commandfor="stock-taking-dialog"
                command="close"
              ><material-symbols name="close"></material-symbols></button>
              <button
                role="button"
                type="submit"
                name="action"
                ?disabled=${!state.inventory || state.actualStock === null}
              >Record Stock Taking</button>
            </header>

            <div class="content">
              ${form.state !== 'idle' ? html`
                <div role="status" aria-live="polite" aria-busy="true">
                  <div role="progressbar" class="linear indeterminate">
                    <div class="track"><div class="indicator"></div></div>
                  </div>
                  <p>Recording stock taking...</p>
                </div>
              ` : nothing}

              ${state.isLoadingInventory ? renderLoadingIndicator() : renderStockTakingForm()}
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

defineWebComponent('stock-taking-dialog', StockTakingDialogElement);
