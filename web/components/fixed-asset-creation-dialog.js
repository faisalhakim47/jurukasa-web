import { reactive } from '@vue/reactivity';
import { html, nothing } from 'lit-html';

import { defineWebComponent } from '#web/component.js';
import { useDialog } from '#web/hooks/use-dialog.js';
import { useAdoptedStyleSheets } from '#web/hooks/use-adopted-style-sheets.js';
import { DatabaseContextElement } from '#web/contexts/database-context.js';
import { I18nContextElement } from '#web/contexts/i18n-context.js';
import { TimeContextElement } from '#web/contexts/time-context.js';
import { useContext } from '#web/hooks/use-context.js';
import { useEffect } from '#web/hooks/use-effect.js';
import { useRender } from '#web/hooks/use-render.js';
import { useTranslator } from '#web/hooks/use-translator.js';
import { webStyleSheets } from '#web/styles.js';
import { assertInstanceOf } from '#web/tools/assertion.js';
import { feedbackDelay } from '#web/tools/timing.js';

import '#web/components/material-symbols.js';
import '#web/components/account-selector-dialog.js';

/**
 * Fixed Asset Creation Dialog Component
 * 
 * @fires fixed-asset-created - Fired when a fixed asset is successfully created. Detail: { assetId: number }
 */
export class FixedAssetCreationDialogElement extends HTMLElement {
  constructor() {
    super();

    const host = this;
    const database = useContext(host, DatabaseContextElement);
    const i18n = useContext(host, I18nContextElement);
    const time = useContext(host, TimeContextElement);

    const t = useTranslator(host);
    const errorAlertDialog = useDialog(host);
    const dialog = useDialog(host);
    const render = useRender(host);
    useAdoptedStyleSheets(host, webStyleSheets);

    const form = reactive({
      state: /** @type {'idle' | 'submitting' | 'success' | 'error'} */ ('idle'),
      error: /** @type {Error | null} */ (null),
      // Account selections
      assetAccountCode: /** @type {number | null} */ (null),
      assetAccountName: /** @type {string | null} */ (null),
      accumulatedDepreciationAccountCode: /** @type {number | null} */ (null),
      accumulatedDepreciationAccountName: /** @type {string | null} */ (null),
      depreciationExpenseAccountCode: /** @type {number | null} */ (null),
      depreciationExpenseAccountName: /** @type {string | null} */ (null),
      paymentAccountCode: /** @type {number | null} */ (null),
      paymentAccountName: /** @type {string | null} */ (null),
      // Currently selecting which account
      selectingAccount: /** @type {'asset' | 'accumulated' | 'expense' | 'payment' | null} */ (null),
    });

    /** @param {CustomEvent} event */
    function handleAccountSelect(event) {
      const detail = event.detail;
      if (form.selectingAccount === 'asset') {
        form.assetAccountCode = detail.accountCode;
        form.assetAccountName = detail.accountName;
      }
      else if (form.selectingAccount === 'accumulated') {
        form.accumulatedDepreciationAccountCode = detail.accountCode;
        form.accumulatedDepreciationAccountName = detail.accountName;
      }
      else if (form.selectingAccount === 'expense') {
        form.depreciationExpenseAccountCode = detail.accountCode;
        form.depreciationExpenseAccountName = detail.accountName;
      }
      else if (form.selectingAccount === 'payment') {
        form.paymentAccountCode = detail.accountCode;
        form.paymentAccountName = detail.accountName;
      }
      form.selectingAccount = null;
    }

    function handleSelectAssetAccount() {
      form.selectingAccount = 'asset';
    }

    function handleSelectAccumulatedAccount() {
      form.selectingAccount = 'accumulated';
    }

    function handleSelectExpenseAccount() {
      form.selectingAccount = 'expense';
    }

    function handleSelectPaymentAccount() {
      form.selectingAccount = 'payment';
    }

    function clearAssetAccount() {
      form.assetAccountCode = null;
      form.assetAccountName = null;
    }

    function clearAccumulatedAccount() {
      form.accumulatedDepreciationAccountCode = null;
      form.accumulatedDepreciationAccountName = null;
    }

    function clearExpenseAccount() {
      form.depreciationExpenseAccountCode = null;
      form.depreciationExpenseAccountName = null;
    }

    function clearPaymentAccount() {
      form.paymentAccountCode = null;
      form.paymentAccountName = null;
    }

    function resetForm() {
      form.assetAccountCode = null;
      form.assetAccountName = null;
      form.accumulatedDepreciationAccountCode = null;
      form.accumulatedDepreciationAccountName = null;
      form.depreciationExpenseAccountCode = null;
      form.depreciationExpenseAccountName = null;
      form.paymentAccountCode = null;
      form.paymentAccountName = null;
      form.selectingAccount = null;
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
        const description = /** @type {string} */ (data.get('description'))?.trim() || null;
        const acquisitionDateStr = /** @type {string} */ (data.get('acquisitionDate'));
        const acquisitionCost = parseInt(/** @type {string} */ (data.get('acquisitionCost')), 10);
        const usefulLifeYears = parseInt(/** @type {string} */ (data.get('usefulLifeYears')), 10);
        const salvageValue = parseInt(/** @type {string} */ (data.get('salvageValue')) || '0', 10);

        // Validate inputs
        if (!name) throw new Error(t('fixedAsset', 'assetNameRequired'));
        if (!acquisitionDateStr) throw new Error(t('fixedAsset', 'acquisitionDateRequired'));
        if (isNaN(acquisitionCost) || acquisitionCost <= 0) throw new Error(t('fixedAsset', 'acquisitionCostPositive'));
        if (isNaN(usefulLifeYears) || usefulLifeYears <= 0) throw new Error(t('fixedAsset', 'usefulLifePositive'));
        if (isNaN(salvageValue) || salvageValue < 0) throw new Error(t('fixedAsset', 'salvageValueNegative'));
        if (salvageValue >= acquisitionCost) throw new Error(t('fixedAsset', 'salvageValueTooHigh'));

        // Validate account selections
        if (!form.assetAccountCode) throw new Error(t('fixedAsset', 'assetAccountRequired'));
        if (!form.accumulatedDepreciationAccountCode) throw new Error(t('fixedAsset', 'accumulatedDepreciationAccountRequired'));
        if (!form.depreciationExpenseAccountCode) throw new Error(t('fixedAsset', 'depreciationExpenseAccountRequired'));
        if (!form.paymentAccountCode) throw new Error(t('fixedAsset', 'paymentAccountRequired'));

        // Validate accounts are different
        const accountCodes = [
          form.assetAccountCode,
          form.accumulatedDepreciationAccountCode,
          form.depreciationExpenseAccountCode,
        ];
        if (new Set(accountCodes).size !== accountCodes.length) {
          throw new Error(t('fixedAsset', 'accountsMustBeDifferent'));
        }

        // Parse acquisition date
        const acquisitionDate = new Date(acquisitionDateStr);
        acquisitionDate.setHours(0, 0, 0, 0);
        const acquisitionTime = acquisitionDate.getTime();

        if (acquisitionTime <= 0) throw new Error(t('fixedAsset', 'invalidAcquisitionDate'));

        const currentTime = time.currentDate().getTime();

        // Insert fixed asset
        const result = await tx.sql`
          INSERT INTO fixed_assets (
            name,
            description,
            acquisition_time,
            acquisition_cost,
            useful_life_years,
            salvage_value,
            asset_account_code,
            accumulated_depreciation_account_code,
            depreciation_expense_account_code,
            payment_account_code,
            create_time,
            update_time
          ) VALUES (
            ${name},
            ${description},
            ${acquisitionTime},
            ${acquisitionCost},
            ${usefulLifeYears},
            ${salvageValue},
            ${form.assetAccountCode},
            ${form.accumulatedDepreciationAccountCode},
            ${form.depreciationExpenseAccountCode},
            ${form.paymentAccountCode},
            ${currentTime},
            ${currentTime}
          )
          RETURNING id;
        `;

        const assetId = Number(result.rows[0].id);

        await tx.commit();

        form.state = 'success';
        await feedbackDelay();

        host.dispatchEvent(new CustomEvent('fixed-asset-created', {
          detail: { assetId },
          bubbles: true,
          composed: true,
        }));

        dialog.open = false;
        // Reset form
        event.currentTarget.reset();
        resetForm();
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

    /**
     * @param {string} label
     * @param {string} inputId
     * @param {number | null} accountCode
     * @param {string | null} accountName
     * @param {function():void} onSelect
     * @param {function():void} onClear
     * @param {string} supportingText
     */
    function renderAccountSelector(label, inputId, accountCode, accountName, onSelect, onClear, supportingText) {
      return html`
        <div class="outlined-text-field">
          <div class="container">
            <label for="${inputId}">${label}</label>
            <input
              id="${inputId}"
              type="button"
              readonly
              required
              placeholder=" "
              value="${accountCode ? `${accountCode} - ${accountName}` : ''}"
              @click=${onSelect}
              commandfor="fixed-asset-account-selector-dialog"
              command="--open"
            />
            ${accountCode ? html`
              <button
                type="button"
                class="trailing-icon"
                @click=${onClear}
                aria-label="${t('fixedAsset', 'clearAccountLabel')}"
              ><material-symbols name="close"></material-symbols></button>
            ` : html`
              <button
                type="button"
                class="trailing-icon"
                @click=${onSelect}
                commandfor="fixed-asset-account-selector-dialog"
                command="--open"
                aria-label="${t('fixedAsset', 'openAccountSelectorLabel')}"
              ><material-symbols name="search"></material-symbols></button>
            `}
          </div>
          <div class="supporting-text">${supportingText}</div>
        </div>
      `;
    }

    useEffect(host, function renderDialog() {
      const todayStr = new Date().toISOString().split('T')[0];

      render(html`
        <dialog
          ${dialog.element}
          id="fixed-asset-creation-dialog"
          class="full-screen"
          aria-labelledby="fixed-asset-creation-dialog-title"
        >
          <form class="container" @submit=${handleSubmit}>
            <header>
              <h2 id="fixed-asset-creation-dialog-title">${t('fixedAsset', 'creationTitle')}</h2>
              <button
                role="button"
                type="button"
                class="text"
                commandfor="fixed-asset-creation-dialog"
                command="close"
                aria-label="${t('fixedAsset', 'closeActionLabel')}"
              ><material-symbols name="close"></material-symbols></button>
              <button role="button" type="submit" name="action">${t('fixedAsset', 'addAssetActionLabel')}</button>
            </header>

            <div class="content">
              ${form.state !== 'idle' ? html`
                <div role="status" aria-live="polite" aria-busy="true">
                  <div role="progressbar" class="linear indeterminate">
                    <div class="track"><div class="indicator"></div></div>
                  </div>
                  <p>${t('fixedAsset', 'creatingAssetLabel')}</p>
                </div>
              ` : nothing}

              <div style="display: flex; flex-direction: column; gap: 24px; padding: 16px 0px; max-width: 600px; margin: 0 auto;">

                <!-- Basic Information Section -->
                <section>
                  <h3 class="title-medium" style="margin-bottom: 16px;">${t('fixedAsset', 'basicInfoSectionTitle')}</h3>
                  
                  <!-- Asset Name -->
                  <div class="outlined-text-field" style="margin-bottom: 16px;">
                    <div class="container">
                      <label for="fixed-asset-name-input">${t('fixedAsset', 'assetNameLabel')}</label>
                      <input
                        id="fixed-asset-name-input"
                        name="name"
                        type="text"
                        placeholder=" "
                        required
                      />
                    </div>
                    <div class="supporting-text">${t('fixedAsset', 'assetNameSupportingText')}</div>
                  </div>

                  <!-- Description -->
                  <div class="outlined-text-field" style="margin-bottom: 16px;">
                    <div class="container">
                      <label for="fixed-asset-description-input">${t('fixedAsset', 'descriptionLabel')}</label>
                      <textarea
                        id="fixed-asset-description-input"
                        name="description"
                        placeholder=" "
                        rows="2"
                      ></textarea>
                    </div>
                    <div class="supporting-text">${t('fixedAsset', 'descriptionSupportingText')}</div>
                  </div>
                </section>

                <!-- Financial Information Section -->
                <section>
                  <h3 class="title-medium" style="margin-bottom: 16px;">${t('fixedAsset', 'financialInfoSectionTitle')}</h3>
                  
                  <!-- Acquisition Date -->
                  <div class="outlined-text-field" style="margin-bottom: 16px;">
                    <div class="container">
                      <label for="acquisition-date-input">${t('fixedAsset', 'acquisitionDateLabel')}</label>
                      <input
                        id="acquisition-date-input"
                        name="acquisitionDate"
                        type="date"
                        placeholder=" "
                        required
                        max="${todayStr}"
                      />
                    </div>
                    <div class="supporting-text">${t('fixedAsset', 'acquisitionDateSupportingText')}</div>
                  </div>

                  <!-- Acquisition Cost -->
                  <div class="outlined-text-field" style="margin-bottom: 16px;">
                    <div class="container">
                      <label for="acquisition-cost-input">${t('fixedAsset', 'acquisitionCostLabel')}</label>
                      <input
                        id="acquisition-cost-input"
                        name="acquisitionCost"
                        type="number"
                        inputmode="numeric"
                        min="1"
                        placeholder=" "
                        required
                      />
                    </div>
                    <div class="supporting-text">${t('fixedAsset', 'acquisitionCostSupportingText')}</div>
                  </div>

                  <!-- Useful Life Years -->
                  <div class="outlined-text-field" style="margin-bottom: 16px;">
                    <div class="container">
                      <label for="useful-life-input">${t('fixedAsset', 'usefulLifeLabel')}</label>
                      <input
                        id="useful-life-input"
                        name="usefulLifeYears"
                        type="number"
                        inputmode="numeric"
                        min="1"
                        placeholder=" "
                        required
                      />
                    </div>
                    <div class="supporting-text">${t('fixedAsset', 'usefulLifeSupportingText')}</div>
                  </div>

                  <!-- Salvage Value -->
                  <div class="outlined-text-field" style="margin-bottom: 16px;">
                    <div class="container">
                      <label for="salvage-value-input">${t('fixedAsset', 'salvageValueLabel')}</label>
                      <input
                        id="salvage-value-input"
                        name="salvageValue"
                        type="number"
                        inputmode="numeric"
                        min="0"
                        value="0"
                        placeholder=" "
                      />
                    </div>
                    <div class="supporting-text">${t('fixedAsset', 'salvageValueSupportingText')}</div>
                  </div>
                </section>

                <!-- Account Assignment Section -->
                <section>
                  <h3 class="title-medium" style="margin-bottom: 16px;">${t('fixedAsset', 'accountAssignmentSectionTitle')}</h3>
                  
                  ${renderAccountSelector(
                    t('fixedAsset', 'fixedAssetAccountLabel'),
                    'asset-account-input',
                    form.assetAccountCode,
                    form.assetAccountName,
                    handleSelectAssetAccount,
                    clearAssetAccount,
                    t('fixedAsset', 'fixedAssetAccountSupportingText')
                  )}

                  ${renderAccountSelector(
                    t('fixedAsset', 'accumulatedDepreciationAccountLabel'),
                    'accumulated-depreciation-input',
                    form.accumulatedDepreciationAccountCode,
                    form.accumulatedDepreciationAccountName,
                    handleSelectAccumulatedAccount,
                    clearAccumulatedAccount,
                    t('fixedAsset', 'accumulatedDepreciationAccountSupportingText')
                  )}

                  ${renderAccountSelector(
                    t('fixedAsset', 'depreciationExpenseAccountLabel'),
                    'depreciation-expense-input',
                    form.depreciationExpenseAccountCode,
                    form.depreciationExpenseAccountName,
                    handleSelectExpenseAccount,
                    clearExpenseAccount,
                    t('fixedAsset', 'depreciationExpenseAccountSupportingText')
                  )}

                  ${renderAccountSelector(
                    t('fixedAsset', 'paymentAccountLabel'),
                    'payment-account-input',
                    form.paymentAccountCode,
                    form.paymentAccountName,
                    handleSelectPaymentAccount,
                    clearPaymentAccount,
                    t('fixedAsset', 'paymentAccountSupportingText')
                  )}
                </section>

              </div>
            </div>
          </form>
        </dialog>

        <dialog ${errorAlertDialog.element} role="alertdialog">
          <div class="container">
            <material-symbols name="error"></material-symbols>
            <header>
              <h3>${t('fixedAsset', 'errorDialogTitle')}</h3>
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
                >${t('fixedAsset', 'dismissLabel')}</button>
              </li>
            </menu>
          </div>
        </dialog>

        <account-selector-dialog
          id="fixed-asset-account-selector-dialog"
          @account-select=${handleAccountSelect}
        ></account-selector-dialog>
      `);
    });
  }
}

defineWebComponent('fixed-asset-creation-dialog', FixedAssetCreationDialogElement);
