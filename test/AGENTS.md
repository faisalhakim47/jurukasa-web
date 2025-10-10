# Test Guidelines for Jurukasa Web

## Test Suite

- Tests are written using [Playwright](https://playwright.dev/)
- Tests are located in the `test/*.spec.ts`
- To run tests, use the command: `npx playwright test $PATH_TO_TEST_FILE`
- Test setup actual CryptoGadai Backend and Expo Web. See `test/setup/setup.ts`

## Writing Tests

- Tests selectors prioritization:
  1. `page.getByRole` selector with `name` option
  2. `page.getByLabel` selector for form fields
  3. `page.getByPlaceholder` placeholder text for form fields
  4. `page.getByText` visible text
  5. `page.getByTitle` for buttons and links
  6. `page.getByAltText` for images and buttons with images
- Task shall navigate by using UI elements only, not by directly changing URL (expect for initial page load and any redirection flow)
- Use `exact: true` option to avoid partial matching when necessary
- Tests shall be independent and can be run in any order
- Use `startCapturePageConsoleDebugAndApiRequests` and `stopCapturePageConsoleDebugAndApiRequests` appropriately to monitor console debug messages and API requests on the page. By using these functions, any `console.debug` and fetch related to `cg-backend` on expo frontend will be forwarded to stdout.
- Use `testSetup.enableAppLogging` and `testSetup.disableAppLogging` to enable/disable CryptoGadai Backend logs when necessary.
- Be mindful when enabling capture and logs as they can clutter the test output
- Use `expect` + `toBeVisible` or `toHaveText` + timeout option instead of `page.waitForTimeout` to wait for rendering changes.
- `page.waitForTimeout` is forbidden, use `expect` + `toBeVisible` or `toHaveText` + timeout option instead.
- Cleanup/comment-out any unused `capturePageHTML`, `startCapturePageConsoleDebugAndApiRequests`, and `stopCapturePageConsoleDebugAndApiRequests` when no longer needed.
