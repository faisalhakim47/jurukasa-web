# Web Application

## Application Overview

Many part of the applications uses web component incuding:
- `web/components/` contains reusable web components
- `web/contexts/` contains application contexts
- `web/views/` contains application routing mechanism

## Web Component Writing Guidelines

- The web component code structure is heavily inspired by Vue Composable/React Hooks.
- The class constructor act as setup function in Vue. Unlike React Hook component, our web component constructor follows Vue's two-step component initialization: state setup + subsequent rendering.
- Unlike setup function in Vue, the web component uses constructor so that it cannot return a state object to expose its interface. Instead, the web component exposes its interface by assigning properties/methods to `this` object inside the constructor like in good-old `exports` object in CommonJS modules.
- The `web/contexts/` inspired by React Context but following w3c's Web Components Community Group context protocol specification.
- The `web/hooks/` inspired by Vue Composable structure.
- On form handling we should NOT follow React or Vue style. Instead, we shall use native HTML form submission the way it is intended to be used in HTML standard:
  - Use `<form>` element with proper submit event handler
  - Use `<input>`, `<select>`, `<textarea>` elements with proper `name` attributes
  - Use `<button type="submit">` element to submit the form
  - Use `FormData` API to read form data in the form submit event handler
  - Use `checkValidity`, `setCustomValidity`, and `reportValidity` methods to handle form validation
  - Prevent default form submission behavior using `event.preventDefault()` in the form submission event handler
  - Process the form data in the form submission event handler
  - On update, prefill the form fields using the `value` attribute as initial value, no data binding
  - Use one-way data flow: a component supply initial value by value attribute (not value property), then the input element will manage the actual value state itself. When component need to read the current value, use readValue directive.
  - All form state shall be managed by the DOM elements itself instead of using component state
- Event handling shall use standard DOM event handling mechanism using `addEventListener` and `dispatchEvent` methods.
- Use `@event-name` event attachment mechanism via `lit-html` to attach event listeners in the template rendering function.
- Use reusable named function as event listener instead of inline anonymous function to avoid unnecessary re-attachment of event listeners on each re-rendering. With this constraints, the event listener cannot receive additional parameters except the event object itself. If additional data is needed, use `data-` attributes on the target element to store the data.
- Remember, implement predefined named functions as event listeners instead of inline functions.
- Use `useEffect` + `useRender` hooks pattern to handle HTML rendering.
- The `useEffect` callback on rendering phase must be synchronous, not asynchronous.
- Custom dialog is implemented by wrapping native `<dialog>` dialog element and integrating it using `useDialog` hook.
- To open the custom dialog, we use `command` + `commandfor` (Invoker Web API) pattern instead of imparative method call.
- To supply params to a custom dialog, we use `dataset`/`data-` attributes on the invoker element. The custom dialog will read the data from `dialog.context?.dataset` property.

## Web Component Testing

- Each web component is recommended to have its own test file located in the same folder as the component file.
- The test file should be named as `<component-name>.spec.js`.
- The test environment uses end-to-end playwright testing framework.
- Please read `test/AGENTS.md` file for more complete about the testing guidelines.

## Routing

- The app routing using pragmatic conditional rendering based on context state in each `web/views/`

## Design Principles

- The app use adaptive design principles to achive multi-size screen support
- The app separates desktop and mobile layout into different wseb components
- The app design targeting 2 device sizes:
  1. Small desktop screen 720p (1280x720)
  2. Regular mobile screen size Samsung Galaxy S8 (360x740)

## SQLite Query Writing Guidelines

- SQLite query shall be static. We use tagged template function `database.sql` to write the SQL query. This function will parse interpolated values as query parameters. This is strictly designed this way to enforce this rule. Static query is important to allow query caching and to prevent SQL injection attack. Here is the example of correct query writing:

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
