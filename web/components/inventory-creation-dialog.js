import { reactive } from '@vue/reactivity';
import { html, nothing } from 'lit-html';

import { defineWebComponent } from '#web/component.js';
import { useDialog } from '#web/hooks/use-dialog.js';
import { useAdoptedStyleSheets } from '#web/hooks/use-adopted-style-sheets.js';
import { DatabaseContextElement } from '#web/contexts/database-context.js';
import { useContext } from '#web/hooks/use-context.js';
import { useEffect } from '#web/hooks/use-effect.js';
import { useRender } from '#web/hooks/use-render.js';
import { useTranslator } from '#web/hooks/use-translator.js';
import { webStyleSheets } from '#web/styles.js';
import { assertInstanceOf } from '#web/tools/assertion.js';
import { feedbackDelay } from '#web/tools/timing.js';

import '#web/components/material-symbols.js';
import '#web/components/account-selector-dialog.js';
import { useElement } from '#web/hooks/use-element.js';

/**
 * Inventory Creation Dialog Component
 * 
 * @fires inventory-created - Fired when an inventory is successfully created. Detail: { inventoryId: number }
 */
export class InventoryCreationDialogElement extends HTMLElement {
  constructor() {
    super();

    const host = this;
    const database = useContext(host, DatabaseContextElement);
    const t = useTranslator(host);

    const dialog = useDialog(host);
    const errorAlertDialog = useElement(host, HTMLDialogElement);
    const render = useRender(host);
    useAdoptedStyleSheets(host, webStyleSheets);

    const form = reactive({
      state: /** @type {'idle' | 'submitting' | 'success' | 'error'} */ ('idle'),
      error: /** @type {Error | null} */ (null),
      accountCode: /** @type {number | null} */ (null),
      accountName: /** @type {string | null} */ (null),
    });

    /** @param {FocusEvent} event */
    async function validateInventoryName(event) {
      assertInstanceOf(HTMLInputElement, event.currentTarget);
      const input = event.currentTarget;
      const name = input.value.trim();
      input.setCustomValidity('');
      if (name) {
        try {
          const result = await database.sql`
            SELECT 1 FROM inventories WHERE name = ${name} LIMIT 1;
          `;
          if (result.rows.length > 0) input.setCustomValidity(t('inventory', 'inventoryNameExistsError'));
        }
        catch (error) {
          input.setCustomValidity(t('inventory', 'inventoryNameValidationError'));
        }
      }
    }

    /** @param {CustomEvent} event */
    function handleAccountSelect(event) {
      const detail = event.detail;
      form.accountCode = detail.accountCode;
      form.accountName = detail.accountName;
    }

    function clearAccount() {
      form.accountCode = null;
      form.accountName = null;
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
        const unitPrice = parseInt(/** @type {string} */(data.get('unitPrice')), 10);
        const unitOfMeasurement = /** @type {string} */ (data.get('unitOfMeasurement'))?.trim() || null;

        // Validate inputs
        if (!name) throw new Error(t('inventory', 'inventoryNameRequiredError'));
        if (isNaN(unitPrice) || unitPrice < 0) throw new Error(t('inventory', 'invalidUnitPriceError'));
        if (!form.accountCode) throw new Error(t('inventory', 'selectInventoryAccountError'));

        // Verify account has POS - Inventory tag
        const accountCheck = await tx.sql`
          SELECT 1 FROM account_tags
          WHERE account_code = ${form.accountCode}
            AND tag = 'POS - Inventory'
          LIMIT 1;
        `;
        if (accountCheck.rows.length === 0) {
          throw new Error(t('inventory', 'accountNotTaggedError'));
        }

        // Insert inventory
        const result = await tx.sql`
          INSERT INTO inventories (name, unit_price, unit_of_measurement, account_code)
          VALUES (${name}, ${unitPrice}, ${unitOfMeasurement}, ${form.accountCode})
          RETURNING id;
        `;

        const inventoryId = Number(result.rows[0].id);

        await tx.commit();

        form.state = 'success';
        await feedbackDelay();

        host.dispatchEvent(new CustomEvent('inventory-created', {
          detail: { inventoryId },
          bubbles: true,
          composed: true,
        }));

        dialog.open = false;
        // Reset form
        event.currentTarget.reset();
        clearAccount();
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
      if (form.error instanceof Error) errorAlertDialog.value?.showModal();
      else errorAlertDialog.value?.close();
    });

    function handleDismissErrorDialog() { form.error = null; }

    useEffect(host, function renderDialog() {
      render(html`
        <dialog
          ${dialog.element}
          id="inventory-creation-dialog"
          class="full-screen"
          aria-labelledby="inventory-creation-dialog-title"
        >
          <form class="container" @submit=${handleSubmit}>
            <header>
              <h2 id="inventory-creation-dialog-title">${t('inventory', 'createDialogTitle')}</h2>
              <button
                role="button"
                type="button"
                class="text"
                commandfor="inventory-creation-dialog"
                command="close"
              ><material-symbols name="close"></material-symbols></button>
              <button role="button" type="submit" name="action">${t('inventory', 'createDialogSubmitLabel')}</button>
            </header>

            <div class="content">
              ${form.state !== 'idle' ? html`
                <div role="status" aria-live="polite" aria-busy="true">
                  <div role="progressbar" class="linear indeterminate">
                    <div class="track"><div class="indicator"></div></div>
                  </div>
                  <p>${t('inventory', 'creatingInventoryMessage')}</p>
                </div>
              ` : nothing}

              <div style="display: flex; flex-direction: column; gap: 24px; padding: 16px 0px; max-width: 600px; margin: 0 auto;">

                <!-- Inventory Name -->
                <div class="outlined-text-field">
                  <div class="container">
                    <label for="inventory-name-input">${t('inventory', 'inventoryNameLabel')}</label>
                    <input
                      id="inventory-name-input"
                      name="name"
                      type="text"
                      placeholder=" "
                      required
                      @blur=${validateInventoryName}
                    />
                  </div>
                  <div class="supporting-text">${t('inventory', 'inventoryNameSupportingText')}</div>
                </div>

                <!-- Unit Price -->
                <div class="outlined-text-field">
                  <div class="container">
                    <label for="unit-price-input">${t('inventory', 'unitPriceLabel')}</label>
                    <input
                      id="unit-price-input"
                      name="unitPrice"
                      type="number"
                      inputmode="numeric"
                      min="0"
                      placeholder=" "
                      required
                    />
                  </div>
                  <div class="supporting-text">${t('inventory', 'unitPriceSupportingText')}</div>
                </div>

                <!-- Unit of Measurement -->
                <div class="outlined-text-field">
                  <div class="container">
                    <label for="unit-of-measurement-input">${t('inventory', 'unitOfMeasurementLabel')}</label>
                    <input
                      id="unit-of-measurement-input"
                      name="unitOfMeasurement"
                      type="text"
                      placeholder=" "
                    />
                  </div>
                  <div class="supporting-text">${t('inventory', 'unitOfMeasurementSupportingText')}</div>
                </div>

                <!-- Inventory Account -->
                <div class="outlined-text-field">
                  <div class="container">
                    <label for="account-input">${t('inventory', 'inventoryAccountLabel')}</label>
                    <input
                      id="account-input"
                      type="button"
                      readonly
                      required
                      placeholder=" "
                      value="${form.accountCode ? `${form.accountCode} - ${form.accountName}` : ''}"
                      commandfor="account-selector-dialog"
                      command="--open"
                    />
                    ${form.accountCode ? html`
                      <button
                        type="button"
                        class="trailing-icon"
                        @click=${clearAccount}
                        aria-label="${t('inventory', 'clearAccountAriaLabel')}"
                      ><material-symbols name="close"></material-symbols></button>
                    ` : html`
                      <button
                        type="button"
                        class="trailing-icon"
                        commandfor="account-selector-dialog"
                        command="--open"
                        aria-label="${t('inventory', 'selectAccountAriaLabel')}"
                      ><material-symbols name="search"></material-symbols></button>
                    `}
                  </div>
                  <div class="supporting-text">${t('inventory', 'inventoryAccountSupportingText')}</div>
                </div>

              </div>
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
              <p>${form.error?.message}</p>
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

        <account-selector-dialog
          id="account-selector-dialog"
          filter-tag="POS - Inventory"
          @account-select=${handleAccountSelect}
        ></account-selector-dialog>
      `);
    });
  }
}

defineWebComponent('inventory-creation-dialog', InventoryCreationDialogElement);
