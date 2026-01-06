# Testing Guidelines

## Test Suite

- JuruKasa uses playwright as the main end-to-end (E2E) test implementations.

## Test Structure

- Test act as application specification

## Test Setup

- The web application uses web component context protocol. The setup shall be provided to each context appropriately
- The setup shall be provided in `/test/fixtures/*.html` that will be accessible in test server
- The test server are basic static web server
- We provide `useTursoLibSQLiteServer` hook to provide clean database server for each test. The utility will spawn new Turso LibSQLite server before each test and destroy it after each test.

## Test Principles

- Test assertion shall be deterministic. It is forbidden to use branching logic (if/else/switch) in tests
- All conditions shall be known on test setup. Test server data are isolated entirely per test
- Tests shall be independent and can be run in any order

## Selector Prioritization

1. `page.getByRole` selector with `name` option (preferred)
2. `page.getByLabel` selector for form fields
3. `page.getByText` visible text
4. `page.getByTitle` for buttons and links
5. `page.getByAltText` for images and buttons with images

The `page.locator` selector is forbidden. We are in control of our entire codebase, so we must ensure proper accessibility attributes are set.
The `page.waitForURL` is forbidden. Use UI elements to verify navigation instead.

## Test Case Assertion

- Assertion must use UI element to verify application state
- It is forbidden to check URL for assertions
- It is forbidden to use `page.evaluate` to check application state

## Test Debugging

- Use `useConsoleOutput` hook to capture browser console into test's stdout
- Playwright test suite always provide "Error Context" for each failed test case, read the "Error Context" to gather failed application structure
