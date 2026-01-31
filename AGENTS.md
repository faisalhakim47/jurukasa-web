# JuruKasa Web Application

JuruKasa is point-of-sales (POS) web application with following features:
- Implement Indonesian accounting standard.
- Native web modern development architecture using latest web standard.
- Single-user application with local database storage, act like desktop application.
- Offline-first.

## Project Structure

- `index.html` the entrypoint of single page application.
- `web/` the implementation of web application.
- `web/schemas/` database schema definitions (the source of truth, the core business logics are implemented as SQLite triggers).
- `web/components/` reusable web components.
- `web/lang/` translation.
- `web/contexts/` application contexts following subset of context protocol by w3c's Web Components Community Group.
- `web/styles/` Material 3 Expressive CSS implementation.
- `web/views/` manages app routing and pages.
- `test/` playwright end-to-end test setup.

## Compatibility Target

- Chromium-based browser above 140 (as of December 2025)

## UI/UX Design Requirements

- App implement latest Material 3 Expressive by Google as of December 2025.
- The Material 3 Expressive design system is implemented in plain modern CSS
- App implement adaptive design principles (instead of responsive design) to achive multi-size screen support.
- App separate desktop and mobile layout into different web component view.
- App design targeting 2 device sizes:
  1. Small desktop screen 720p (1280x720)
  2. Regular mobile screen size Samsung Galaxy S8 (360x740)

## Code Writing Guidelines

### CSS Code Style

- The CSS is written in semantically meaningful way, using HTML5 elements and attributes.
- The general term to describe our naming methodology is "Semantic CSS".
- The CSS is relly heavily on structural elements. For example `nav>router-link>material-symbols` instead of `.main-nav-icon`.
- Use any accessibility attributes to indicate roles, UI states, properties, etc.
- Use very minimum classes, only for variant modifiers. Select semantical HTML tags first.
- Selector priority:
  1. Semantic HTML5 elements like `<button>`, `<ul>`, `<nav>`, etc.
  2. Accessibility attributes like `[role="tablist"]`, `[aria-selected="true"]`, etc.
  3. Modifier classes like `.outlined`, `.elevated`, etc.
- Use terms and naming based on official Material 3 Expressive specification.

### JavaScript Code Style

- Prioritize function definition using `function` keyword over arrow function (except for HTML templating, the code formatter will mess-up the formatting when using full function in a template string).
- Avoid using `this` keyword. `this` keyword only be used on specific case namely exposing context state in context provider component, that's it. Outside of that case, the use of `this` keyword is prohibited.
- `Function.prototype.bind()` usage is forbidden.
- Use modern Invoker Commands Web API (usually via command and commandfor attributes) to interact with dialog/tooltip components instead of imperative method calls. Our test environment uses latest chrome version that guarantees Invoker Commands Web API support. Read more about Invoker Commands API documentation at `docs/invoker-commands-api.md`.

### Web Component Writing Guidelines

- The web component code structure is heavily inspired by Vue Composable/React Hooks.
- The class constructor act as setup function in Vue. Unlike React Hook component, our web component constructor follows Vue's two-step component initialization: state setup + subsequent rendering.
- Unlike setup function in Vue, the web component uses constructor so that it cannot return a state object to expose its interface. Instead, the web component exposes its interface by assigning properties/methods to `this` object inside the constructor like in good-old `exports` object in CommonJS modules.
- The `web/contexts/` inspired by React Context but following w3c's Web Components Community Group context protocol specification.
- The `web/hooks/` inspired by Vue Composable structure.
- On form handling we should NOT follow React or Vue style. Instead, we shall use native HTML form submission the way it is intended to be used in HTML standard:.
  - Use `<form>` element with proper submit event handler.
  - Use `<input>`, `<select>`, `<textarea>` elements with proper `name` attributes.
  - Use `<button type="submit">` element to submit the form.
  - Use `FormData` API to read form data in the form submit event handler.
  - Use `checkValidity`, `setCustomValidity`, and `reportValidity` methods to handle form validation.
  - Prevent default form submission behavior using `event.preventDefault()` in the form submission event handler.
  - Process the form data in the form submission event handler.
  - On update, prefill the form fields using the `value` attribute as initial value, no data binding.
  - Use one-way data flow: a component supply initial value by value attribute (not value property), then the input element will manage the actual value state itself. When component need to read the current value, use readValue directive.
  - All form state shall be managed by the DOM elements itself instead of using component state.
- Event handling shall use standard DOM event handling mechanism using `addEventListener` and `dispatchEvent` methods.
- Use `@event-name` event attachment mechanism via `lit-html` to attach event listeners in the template rendering function.
- Use reusable named function as event listener instead of inline anonymous function to avoid unnecessary re-attachment of event listeners on each re-rendering. With this constraints, the event listener cannot receive additional parameters except the event object itself. If additional data is needed, use `data-` attributes on the target element to store the data.
- Remember, implement predefined named functions as event listeners instead of inline functions.
- Use `useEffect` + `useRender` hooks pattern to handle HTML rendering.
- The `useEffect` callback on rendering phase must be synchronous, not asynchronous.
- Custom dialog is implemented by wrapping native `<dialog>` dialog element and integrating it using `useDialog` hook.
- To open the custom dialog, we use `command` + `commandfor` (Invoker Web API) pattern instead of imparative method call.
- To supply params to a custom dialog, we use `dataset`/`data-` attributes on the invoker element. The custom dialog will read the data from `dialog.context?.dataset` property.

### SQLite Migration Writing Guidelines

IMPORTANT NOTE! The database schemas is the source of truth regarding business logic in entire application. All core business logics are implemented in SQLite triggers.

- Each schema migration is designed to be executed once atomicly (no idempotency).
- Schema naming convention:
  - Use lowercase with hyphens for file names (e.g., `001-accounting.sql`).
  - Use snake_case for table and column names (e.g., `account_id`).
  - Use plural nouns for table names (e.g., `accounts`).
  - Use `_time` suffix for timestamp columns (e.g., `create_time`).
- Timestamp columns shall be `INTEGER` type to store Unix epoch time in milliseconds. Remember, in milliseconds, not seconds.
- Run schema tests using command: `node --test ./web/schemas/*.test.js`.

### SQLite Query Writing Guidelines

- SQLite query must be static. We use tagged template function `database.sql` to write the SQL query. This function will parse interpolated values as query parameters. This is strictly designed this way to enforce this rule. Static query is important to allow query caching and to prevent SQL injection attack. Here is the example of correct query writing:

```js
const accountCode = 11110;
const minBalance = null; // Example for conditional where clause
const accountResult = await database.sql`
  SELECT name
  FROM accounts
  WHERE account_code = ${accountCode}
    AND (${minBalance} IS NULL OR balance >= ${minBalance})
`;
```

## Translation Guidelines

- App has many lang packs.
- Each lang pack includes `web/lang/{LANG_CODE}.js` entrypoint file and `web/lang/{LANG_CODE}/` directory containing actual translation text.
- Translation use token-based structure to ensure consistency and ease of updates across different languages.
- The token structure is strictly 2 levels nesting represented as type `{ [baseKey: string]: { [textKey: string]: string } }`. `baseKey` represents a section/feature of the application, `textKey` represents token of a specific text string within that section/feature.
- The `baseKey` shall be camelCase of max two words that represents the section/feature of the application. For example: `common`, `literal`, `dashboard`, `onboarding`, `precurement`, etc.
- The `textKey` shall be camelCase of descriptive representing the usage/purpose of the text combined with UI role/landmark indicating where the text string is being used. For example: `businessConfigFormTitle`, `businessNameLabel`, `businessConfigSubmitLabel`.
- The `en` lang is the primary/default language that also used as reference for other lang pack. When adding new text strings, always add to the `en` lang pack before propagating to other languages. When other languages are missing, the system will fallback to `en` for those missing text strings.

### Translation Usage

- App implement the translation as `useTranslator` hook. For convention, please define the translate function as `t` variable, like `const t = useTranslator(host);`.
- translate function signature is `(baseKey: string, textKey: string, ...args: unknown[]) => string`.
- translate function use `printf`-like placeholder syntax for dynamic text interpolation. Here are supported placeholders:
  - `%s` for string (also support Error object)
  - `%d` for integer
  - `%.Nf` for localized decimal, with N decimal places
  - `%c` for localized currency
  - `$D` for localized date
  - `$T` for localized time

### Literal Translation

- Literal translation is special case where the text strings are not grouped into baseKey/textKey structure, but rather simple text strings that are used as-is throughout the application.
- Literal translation files are located in `web/lang/{LANG_CODE}/literal/index.js`.
- The use case of literal translation is to accommodate "external" text strings that are not part of the main application UI, such as accounting database names, country names, etc.
- We implement `useLiteral` helper hook to easily access the literal translation. For convention, define the literal variable as `l`, like `const l = useLiteral(host);`. The usage is simply `l('Hello %s', 'world')`.
- The literal translation also supports `printf`-like placeholder syntax for dynamic text interpolation, same as the translate function.

## Testing

We have two test setups:
- All `.test.js` suffixed test files are intended to be run in Node.js environment.
- All `.spec.js` suffixed test files are intended to be run in Playwright runner environment.

### Node.js Test Setup

- Test suite uses the `node:test` Node.js internal module.
- Run all tests by command `node --test **/*.test.js` (slow).
- Run a test by command `node --test $TEST_FILE_RELATIVE_PATH` (fast).

### Node.js Test Writing Guidelines

- Test files is located alongside its implementation file with `.test.js` suffix.
- Test pre-conditions setup must be explicit and deterministic. No external randomness allowed.
- Test assertion must be deterministic. Branching logic (if/else/switch/try-catch) is forbidden.
- All date/time values must be absolute and deterministic (e.g., `new Date('2025-12-24T06:05:00.000Z')`).

### Playwright Test Setup

- Test files is located alongside its implementation file with `.spec.js` suffix.
- Run all tests by command `CONSOLE_OUTPUT=0 npx playwright test` (slow).
- Run a test by command `CONSOLE_OUTPUT=0 npx playwright test $SPEC_FILE_RELATIVE_PATH` (fast).
- The `CONSOLE_OUTPUT` flag to enable/disable piping from browser's console output into the test's stdout. Set to '1' to enable.
- When debugging, read Accessibility Tree file to see the latest state of accessible HTML.

### Playwright Test Writing Guidelines

- Each web component should have test file alongside it with `.spec.js` suffix.
- Test pre-conditions setup must be explicit and deterministic. No external randomness allowed.
- `Date.now()` alike are forbidden to setup test pre-conditions. All time must be absolute like `new Date('2025-12-24T06:05:00.000Z')` including the time zone for correctness.
- Take advantage of context protocols mechanism as dependency injection.
- Assertion must use UI element to verify application state.
- Test assertion must be deterministic. Branching logic (if/else/switch/try-catch) is forbidden.
- It is mostly forbidden to use `page.evaluate` to check application state. The exception for the rule is when the post-conditions test ouput non-UI element such as event dispatching, the concrete example is when a custom dialog component finish an action and resulting in event dispatching, we can check the event by using `page.evaluate`.
- Take advantage of existing test setup utilities:
  - `test/tools/fixture.js` provide necessary initial emty UI.
  - `test/hooks/` provide useful and mandatory hooks.
- Each test suite must use `useStrict` to apply strict rule on test implementations.
- Use `useConsoleOutput` hook for log-based debugging. It will print all console output from browser.
- Use `useTursoLibSQLiteServer` to spawn clean Turso SQLite database server each test case.
- Selector usage prioritization:
  1. `page.getByRole` selector with `name` option (preferred)
  2. `page.getByLabel` selector for form fields
  3. `page.getByText` visible text
  4. `page.getByTitle` for buttons and links
  5. `page.getByAltText` for images and buttons with images
- `page.locator` selector is forbidden. We are in control of our entire codebase, so we must ensure proper accessibility attributes are set.
- `page.waitForURL` is forbidden. Use UI elements to verify navigation instead.
