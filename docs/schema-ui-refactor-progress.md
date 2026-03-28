# Schema UI Refactor Progress

## First Refactor Progress Report

### Shared database and workflow helpers

- Added [web/tools/accounting.js](/home/faisalhakim47/Projects/faisalhakim47/jurukasa-web/main/web/tools/accounting.js) as the shared entry point for:
	- explicit journal entry ref allocation
	- journal-entry ownership label derivation from workflow FK columns
	- cash-flow activity/category helpers
	- schema-aware error normalization for journal-entry and fiscal-year trigger failures
- Updated runtime auto-migration in [web/contexts/database-context.js](/home/faisalhakim47/Projects/faisalhakim47/jurukasa-web/main/web/contexts/database-context.js) to stop referencing removed `007-cash-count.sql` and treat `006-account-reconciliation` as the current latest schema.
- Updated Playwright database bootstrap in [test/playwright/tools/database.js](/home/faisalhakim47/Projects/faisalhakim47/jurukasa-web/main/test/playwright/tools/database.js) to remove the deleted `007-cash-count.sql` dependency.

### Manual journal entry workflows

- Refactored [web/components/journal-entry-creation-dialog.js](/home/faisalhakim47/Projects/faisalhakim47/jurukasa-web/main/web/components/journal-entry-creation-dialog.js) to:
	- allocate `journal_entries.ref` explicitly inside the write transaction
	- insert manual journal headers without removed `source_type` and `created_by` columns
	- write line `note`, `cashflow_activity`, and `cashflow_category`
	- load and render allowed cash-flow categories in the UI
	- enforce cash-equivalent classification rules before submission
	- translate common trigger failures into stable user-facing errors
- Refactored [web/components/journal-entry-details-dialog.js](/home/faisalhakim47/Projects/faisalhakim47/jurukasa-web/main/web/components/journal-entry-details-dialog.js) to:
	- derive workflow ownership labels from current FK relationships instead of removed provenance columns
	- display line `note` and cash-flow classification instead of removed `description` and `reference`
	- allocate reversal journal refs explicitly and clone cash-flow metadata during reversal
- Rebuilt [web/views/journal-entries-view.js](/home/faisalhakim47/Projects/faisalhakim47/jurukasa-web/main/web/views/journal-entries-view.js) around status filtering plus workflow ownership labels instead of the removed `source_type` model.
- Added journal-entry translation coverage for new workflow labels, line note/cash-flow fields, and schema-trigger error messages in:
	- [web/lang/en/journal-entry.js](/home/faisalhakim47/Projects/faisalhakim47/jurukasa-web/main/web/lang/en/journal-entry.js)
	- [web/lang/id/journal-entry.js](/home/faisalhakim47/Projects/faisalhakim47/jurukasa-web/main/web/lang/id/journal-entry.js)

### Fiscal year close and reversal dialogs

- Refactored [web/components/fiscal-year-closing-dialog.js](/home/faisalhakim47/Projects/faisalhakim47/jurukasa-web/main/web/components/fiscal-year-closing-dialog.js) to allocate and persist:
	- `closing_journal_entry_ref`
	- `depreciation_journal_entry_ref`
	in the same write transaction as the `post_time` update.
- Refactored [web/components/fiscal-year-reversal-dialog.js](/home/faisalhakim47/Projects/faisalhakim47/jurukasa-web/main/web/components/fiscal-year-reversal-dialog.js) to allocate and persist:
	- `reversal_journal_entry_ref`
	- `depreciation_reversal_journal_entry_ref`
	in the same write transaction as the `reversal_time` update.
- Extended fiscal-year UI copy for generated-entry refs and required-ref trigger failures in:
	- [web/lang/en/fiscal-year.js](/home/faisalhakim47/Projects/faisalhakim47/jurukasa-web/main/web/lang/en/fiscal-year.js)
	- [web/lang/id/fiscal-year.js](/home/faisalhakim47/Projects/faisalhakim47/jurukasa-web/main/web/lang/id/fiscal-year.js)

### Focused test alignment and validation

- Updated [web/views/journal-entries-view.spec.js](/home/faisalhakim47/Projects/faisalhakim47/jurukasa-web/main/web/views/journal-entries-view.spec.js) to:
	- seed explicit journal entry refs
	- create journal lines before posting
	- stop relying on removed `source_type` columns
	- assert workflow labels instead of source-type badges
- Updated [web/views/fiscal-years-view.spec.js](/home/faisalhakim47/Projects/faisalhakim47/jurukasa-web/main/web/views/fiscal-years-view.spec.js) to:
	- seed explicit journal entry refs
	- respect posted-entry immutability when creating fixtures
	- respect fiscal-year reversal preconditions
	- target the current dialog text structure precisely
- Focused validation completed successfully:
	- `npx playwright test web/views/journal-entries-view.spec.js --reporter=line`
	- `npx playwright test web/views/fiscal-years-view.spec.js --reporter=line`

## Still not started in this pass

- Purchase posting ref allocation
- Sale posting ref allocation
- Stock-taking explicit ref wiring
- Fixed-asset creation/details refactor to current ownership links
- Reconciliation and cash-count consolidation around `reconciliation_checkpoints`
- Broader fixture audit across remaining read-only and reporting views

## Second Refactor Progress Report

### POS posting and stock-taking workflows

- Refactored [web/components/purchase-details-dialog.js](/home/faisalhakim47/Projects/faisalhakim47/jurukasa-web/main/web/components/purchase-details-dialog.js) to:
	- allocate `purchases.journal_entry_ref` inside the posting transaction before setting `post_time`
	- map required journal-ref and posted-mutation trigger failures to stable user-facing errors
- Refactored [web/components/sale-details-dialog.js](/home/faisalhakim47/Projects/faisalhakim47/jurukasa-web/main/web/components/sale-details-dialog.js) to:
	- allocate `sales.journal_entry_ref` inside the posting transaction before setting `post_time`
	- normalize payment-total, discount-bound, and posted-mutation trigger failures for the dialog UI
- Refactored [web/components/stock-taking-dialog.js](/home/faisalhakim47/Projects/faisalhakim47/jurukasa-web/main/web/components/stock-taking-dialog.js) to:
	- allocate `stock_takings.journal_entry_ref` only when a cost adjustment will actually create a journal entry
	- use `TimeContextElement` instead of `Date.now()` for deterministic workflow timing
	- surface schema-trigger failures for missing adjustment refs, closed fiscal years, and missing gain/shrinkage accounts

### Fixed asset creation and details

- Refactored [web/components/fixed-asset-creation-dialog.js](/home/faisalhakim47/Projects/faisalhakim47/jurukasa-web/main/web/components/fixed-asset-creation-dialog.js) to:
	- allocate `fixed_assets.journal_entry_ref` explicitly before insert
	- write `fixed_assets.note` instead of removed `description`
	- normalize required-ref and posted-history trigger failures into stable UI errors
- Refactored [web/components/fixed-asset-details-dialog.js](/home/faisalhakim47/Projects/faisalhakim47/jurukasa-web/main/web/components/fixed-asset-details-dialog.js) to:
	- load `note`, `journal_entry_ref`, and acquisition posting state from the current schema
	- remove removed `source_reference` and journal-line `reference` assumptions from delete/history queries
	- disable stale edit/delete affordances once the acquisition journal has posted
	- update name/note editing to use the current fixed-asset mutation contract
- Updated [web/views/fixed-assets-view.js](/home/faisalhakim47/Projects/faisalhakim47/jurukasa-web/main/web/views/fixed-assets-view.js) to read `fixed_assets.note` instead of removed `description`

### Translation and shared error coverage

- Extended [web/tools/accounting.js](/home/faisalhakim47/Projects/faisalhakim47/jurukasa-web/main/web/tools/accounting.js) with reusable schema-aware error normalization for:
	- purchase posting
	- sale posting
	- stock-taking adjustment creation
	- fixed-asset creation/details
- Updated translation coverage for the new note terminology and workflow errors in:
	- [web/lang/en/fixed-asset.js](/home/faisalhakim47/Projects/faisalhakim47/jurukasa-web/main/web/lang/en/fixed-asset.js)
	- [web/lang/id/fixed-asset.js](/home/faisalhakim47/Projects/faisalhakim47/jurukasa-web/main/web/lang/id/fixed-asset.js)
	- [web/lang/en/purchase.js](/home/faisalhakim47/Projects/faisalhakim47/jurukasa-web/main/web/lang/en/purchase.js)
	- [web/lang/id/purchase.js](/home/faisalhakim47/Projects/faisalhakim47/jurukasa-web/main/web/lang/id/purchase.js)
	- [web/lang/en/sale.js](/home/faisalhakim47/Projects/faisalhakim47/jurukasa-web/main/web/lang/en/sale.js)
	- [web/lang/id/sale.js](/home/faisalhakim47/Projects/faisalhakim47/jurukasa-web/main/web/lang/id/sale.js)
	- [web/lang/en/stock.js](/home/faisalhakim47/Projects/faisalhakim47/jurukasa-web/main/web/lang/en/stock.js)
	- [web/lang/id/stock.js](/home/faisalhakim47/Projects/faisalhakim47/jurukasa-web/main/web/lang/id/stock.js)

### Focused test alignment and validation

- Updated [web/views/stock-takings-view.spec.js](/home/faisalhakim47/Projects/faisalhakim47/jurukasa-web/main/web/views/stock-takings-view.spec.js) to:
	- seed inventory accounts and balances explicitly so inserted fixtures satisfy current inventory-balance invariants
	- provide `journal_entry_ref` only for discrepancy stock takings that now require it
	- keep seeded `expected_stock` and `expected_cost` aligned with the live inventory state enforced by the stock-taking triggers
- Updated [web/views/fixed-assets-view.spec.js](/home/faisalhakim47/Projects/faisalhakim47/jurukasa-web/main/web/views/fixed-assets-view.spec.js) to assert the renamed fixed-asset note field label
- Focused validation completed successfully:
	- `npx playwright test web/views/stock-takings-view.spec.js web/views/fixed-assets-view.spec.js --reporter=line`

## Third Refactor Progress Report

### Reconciliation checkpoint UI redesign

- Rebuilt [web/components/account-reconciliation-creation-dialog.js](/home/faisalhakim47/Projects/faisalhakim47/jurukasa-web/main/web/components/account-reconciliation-creation-dialog.js) around `reconciliation_checkpoints` to:
	- capture one `STATEMENT` checkpoint instead of writing removed reconciliation session tables
	- preview factual `book_balance` as of the selected checkpoint time
	- allocate `adjustment_journal_entry_ref` inside the same write transaction only when a discrepancy exists
	- use schema-aware reconciliation trigger error normalization instead of surfacing raw SQLite messages
- Rebuilt [web/components/cash-count-creation-dialog.js](/home/faisalhakim47/Projects/faisalhakim47/jurukasa-web/main/web/components/cash-count-creation-dialog.js) around `PHYSICAL` checkpoints to:
	- stop writing removed `cash_counts`
	- preview the checkpoint-time book balance instead of relying on current account state only
	- allocate adjustment refs explicitly for shortage and overage flows
	- emit created checkpoint IDs so the surrounding views can refresh against `reconciliation_history`
- Rebuilt [web/components/account-reconciliation-details-dialog.js](/home/faisalhakim47/Projects/faisalhakim47/jurukasa-web/main/web/components/account-reconciliation-details-dialog.js) as an immutable checkpoint details surface that:
	- reads from `reconciliation_history`
	- shows checkpoint metadata, book/external balances, discrepancy, note, and linked adjustment journal ref
	- removes obsolete complete/delete/session-item/discrepancy workflows that no longer exist in the schema

### Unified statement and cash-count history views

- Rebuilt [web/views/account-reconciliation-list-view.js](/home/faisalhakim47/Projects/faisalhakim47/jurukasa-web/main/web/views/account-reconciliation-list-view.js) to query `reconciliation_history` filtered to `STATEMENT` rows and render:
	- checkpoint time
	- book balance
	- external balance
	- discrepancy type
	- linked adjustment entry ref
- Rebuilt [web/views/cash-count-list-view.js](/home/faisalhakim47/Projects/faisalhakim47/jurukasa-web/main/web/views/cash-count-list-view.js) to query the same `reconciliation_history` view filtered to `PHYSICAL` rows and:
	- retire the removed `cash_count_history` dependency
	- support account and discrepancy filters over checkpoint history
	- open the shared checkpoint details dialog instead of the old TODO placeholder

### Shared helpers and translation alignment

- Extended [web/tools/accounting.js](/home/faisalhakim47/Projects/faisalhakim47/jurukasa-web/main/web/tools/accounting.js) with reusable checkpoint helpers for:
	- factual reconciliation book-balance calculation at a checkpoint time
	- reconciliation trigger error normalization for missing tags, missing adjustment refs, non-posting-account selection, and immutable checkpoint failures
- Replaced the reconciliation copy in:
	- [web/lang/en/reconciliation.js](/home/faisalhakim47/Projects/faisalhakim47/jurukasa-web/main/web/lang/en/reconciliation.js)
	- [web/lang/id/reconciliation.js](/home/faisalhakim47/Projects/faisalhakim47/jurukasa-web/main/web/lang/id/reconciliation.js)
	to match the checkpoint-based UI model, new preview states, immutable details surface, and schema-trigger error messages.

### Focused spec rewrite progress

- Rewrote the following focused Playwright specs to stop seeding removed reconciliation tables and to exercise the checkpoint model instead:
	- [web/components/account-reconciliation-creation-dialog.spec.js](/home/faisalhakim47/Projects/faisalhakim47/jurukasa-web/main/web/components/account-reconciliation-creation-dialog.spec.js)
	- [web/components/cash-count-creation-dialog.spec.js](/home/faisalhakim47/Projects/faisalhakim47/jurukasa-web/main/web/components/cash-count-creation-dialog.spec.js)
	- [web/components/account-reconciliation-details-dialog.spec.js](/home/faisalhakim47/Projects/faisalhakim47/jurukasa-web/main/web/components/account-reconciliation-details-dialog.spec.js)
	- [web/views/account-reconciliation-list-view.spec.js](/home/faisalhakim47/Projects/faisalhakim47/jurukasa-web/main/web/views/account-reconciliation-list-view.spec.js)
	- [web/views/reconciliation-view.spec.js](/home/faisalhakim47/Projects/faisalhakim47/jurukasa-web/main/web/views/reconciliation-view.spec.js)
- Focused validation status:
	- static diagnostics for the rewritten implementation files completed cleanly via `get_errors`
	- focused Playwright reruns were started, but this pass stopped before the rewritten reconciliation spec batch was fully stabilized end-to-end
	- the remaining work in this area is test-shape stabilization rather than the core checkpoint UI wiring itself

## Fourth Refactor Progress Report

### Reporting fixture alignment sweep

- Updated [web/views/trial-balance-view.spec.js](/home/faisalhakim47/Projects/faisalhakim47/jurukasa-web/main/web/views/trial-balance-view.spec.js) to:
	- stop seeding removed `journal_entries.source_type` and `journal_entries.created_by`
	- write `journal_entry_lines.note` instead of removed `description`
	- use a small deterministic helper for inserting posted journal-entry fixtures under the current header contract
- Updated [web/views/financial-reports-view.spec.js](/home/faisalhakim47/Projects/faisalhakim47/jurukasa-web/main/web/views/financial-reports-view.spec.js) to:
	- replace `RETURNING ref` fixture seeding with explicit journal entry refs
	- insert posted journal headers directly instead of relying on the removed auto-generated ref behavior
	- add valid cash-flow classification for seeded cash-equivalent lines so report fixtures satisfy the tightened journal-line triggers

### Focused validation status

- Focused Playwright validation completed successfully:
	- `npx playwright test web/views/trial-balance-view.spec.js web/views/financial-reports-view.spec.js --reporter=line`

### Reconciliation stabilization follow-up

- Updated [web/components/account-reconciliation-creation-dialog.js](/home/faisalhakim47/Projects/faisalhakim47/jurukasa-web/main/web/components/account-reconciliation-creation-dialog.js) to:
	- listen for the current `account-selector-dialog` event contract (`account-select`) so selected accounts actually flow into checkpoint state
	- stop pre-writing `book_balance` and rely on the schema trigger to populate the factual checkpoint balance
	- reserve `adjustment_journal_entry_ref` inline in the checkpoint insert statement instead of issuing a separate write-transaction round trip before insert
	- simplify submission to one atomic checkpoint insert so Turso-backed discrepancy submissions no longer stall on explicit transaction commit
- Updated [web/components/cash-count-creation-dialog.js](/home/faisalhakim47/Projects/faisalhakim47/jurukasa-web/main/web/components/cash-count-creation-dialog.js) to mirror the same checkpoint insert contract:
	- omit `book_balance` on insert
	- reserve the potential adjustment ref inline inside the insert SQL
	- avoid the failing explicit commit path on discrepancy cash counts while keeping the write atomic at the statement level
- Stabilized the rewritten reconciliation specs to match the current UI and schema invariants in:
	- [web/components/account-reconciliation-creation-dialog.spec.js](/home/faisalhakim47/Projects/faisalhakim47/jurukasa-web/main/web/components/account-reconciliation-creation-dialog.spec.js)
	- [web/components/account-reconciliation-details-dialog.spec.js](/home/faisalhakim47/Projects/faisalhakim47/jurukasa-web/main/web/components/account-reconciliation-details-dialog.spec.js)
	- [web/views/account-reconciliation-list-view.spec.js](/home/faisalhakim47/Projects/faisalhakim47/jurukasa-web/main/web/views/account-reconciliation-list-view.spec.js)
	by tightening ambiguous text assertions and fixing posted-entry fixture ordering.

### Focused reconciliation validation

- Focused Playwright validation completed successfully:
	- `npx playwright test web/components/account-reconciliation-creation-dialog.spec.js web/components/cash-count-creation-dialog.spec.js web/components/account-reconciliation-details-dialog.spec.js web/views/account-reconciliation-list-view.spec.js web/views/reconciliation-view.spec.js --reporter=line`
- Follow-up grep checks over `web/**/*.spec.js` no longer find the exact old-schema UI-spec patterns for:
	- removed `source_type` / `created_by` journal-entry seeds
	- removed `journal_entry_lines.description` seeds
	- `RETURNING ref`-based journal-entry fixture allocation
	- removed reconciliation persistence tables (`reconciliation_sessions`, `cash_counts`, `cash_count_history`)

## Fifth Refactor Progress Report

### Validation sweep over remaining UI surfaces

- Ran a broader repo validation sweep over `web/` and Playwright specs to look for remaining UI references to removed schema contracts, including:
	- removed journal provenance columns (`source_type`, `created_by`, `source_reference`)
	- removed reconciliation persistence tables (`reconciliation_sessions`, `cash_counts`, `cash_count_history`)
	- removed journal-line fields (`description`, `reference`)
	- stale `RETURNING ref` fixture patterns outside schema-layer tests
- Validation result from the code sweep:
	- the current UI implementation no longer contains direct references to those removed schema contracts in app code
	- the remaining issues found in this pass were runtime/spec-alignment gaps rather than new old-schema reads/writes in production UI modules

### Reconciliation account preparation fix

- Updated [web/components/reconciliation-account-creation-dialog.js](/home/faisalhakim47/Projects/faisalhakim47/jurukasa-web/main/web/components/reconciliation-account-creation-dialog.js) to align with the current reconciliation tag uniqueness rules:
	- treat `Reconciliation - Adjustment` as a unique schema-owned tag, not only `Reconciliation - Cash Over/Short`
	- clear any existing tagged account before assigning either reconciliation tag to a replacement account
	- show the unique-tag warning for both reconciliation account types in the dialog UI
- This fixed the failing runtime path where creating a replacement adjustment account raised `UNIQUE constraint failed: account_tags.tag`.

### POS and stock-taking spec alignment follow-up

- Updated the standalone view setups in:
	- [web/views/purchases-view.spec.js](/home/faisalhakim47/Projects/faisalhakim47/jurukasa-web/main/web/views/purchases-view.spec.js)
	- [web/views/sales-view.spec.js](/home/faisalhakim47/Projects/faisalhakim47/jurukasa-web/main/web/views/sales-view.spec.js)
	- [web/views/stock-taking-creation-view.spec.js](/home/faisalhakim47/Projects/faisalhakim47/jurukasa-web/main/web/views/stock-taking-creation-view.spec.js)
	to provide `time-context` around views whose child dialogs now consume `TimeContextElement` during connection.
- Reworked stale posted-record fixtures in purchase and sale list specs to respect current immutability and posting triggers:
	- add draft lines before setting `journal_entry_ref` + `post_time` on posted purchases
	- add draft sale lines and matching `sale_payments` before setting `journal_entry_ref` + `post_time` on posted sales
	- stop creating posted purchase/sale rows by inserting headers with `post_time` first and backfilling detail rows afterward
- Rebuilt the stock-taking cost fixture to derive inventory `cost` and `stock` through a posted purchase workflow instead of forbidden manual updates to `inventories.cost` / `inventories.stock`.

### Focused validation status

- Static diagnostics completed cleanly for the updated reconciliation dialog and spec files via `get_errors`.
- Focused Playwright validation completed successfully for the reconciliation/accounting surfaces:
	- `npx playwright test web/views/journal-entries-view.spec.js web/views/fiscal-years-view.spec.js web/views/stock-takings-view.spec.js web/views/fixed-assets-view.spec.js web/views/account-reconciliation-list-view.spec.js web/views/reconciliation-view.spec.js web/components/reconciliation-account-creation-dialog.spec.js --reporter=line`
- Focused Playwright validation completed successfully for the POS surfaces after fixture realignment:
	- `npx playwright test web/views/purchase-creation-view.spec.js web/views/purchases-view.spec.js web/views/sale-view.spec.js web/views/sales-view.spec.js web/views/stock-taking-creation-view.spec.js web/views/stock-takings-view.spec.js web/views/procurement-view.spec.js web/views/pos-view.spec.js --reporter=line`