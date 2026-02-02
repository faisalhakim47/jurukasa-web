# End-to-End Spec Refactor [DONE]

## Naming and Description
- describe function title shall contains name of feature.
- test function title shall contains a single business action flow.
- expect assertion function shall have message informing expected behaviour.

## Efficient Testing

- E2E test is expensive. Try to reduce any duplicate test cases whenever possible.
- Implement flow-based test case. For example: instead of asserting element visibility test in one case, implement assertion in a flow instead.
- Each test case shall include correctness assertion of bussiness data, not only to check visual element correctness. Do check visual correctness in the flow it self, see example bellow.

```js
/** Instead Of: */
describe('Some Feature', function () {
  test('shall display some submit button', async function ({ page }) {
    // do pre-condition setup
    // do action
    // do post-condition assertion for submit button visibility
  });
  test('shall do submit button', async function ({ page }) {
    // do pre-condition setup
    // do action, click submit button
    // do post-condition assertion about action
  });
});

/** Do: */
describe('Some Feature', function () {
  test('an activity flow', async function ({ page }) {
    // do pre-condition setup
    // do action
    await expect(page.getByRole('button', { name: 'Submit' }), 'it shall display certain button').toBeVisible();
    // do post-condition assertion for submit button visibility
  });
});
```

## Simple Structure Testing

- Implement single-level description test:
```js
/** Instead Of: */
describe('Some Feature', function () {
  useStrict(test);
  useConsoleOutput(test);
  describe('Some Categorization', function () {
    const tursoLibSQLiteServer = useTursoLibSQLiteServer(test);
    test('a test case', async function ({ page }) {
      // do pre-condition setup
      // do action
      // do post-condition assertion
    });
  });
});

/** Do: */
describe('Some Feature', function () {
  useStrict(test);
  useConsoleOutput(test);
  const tursoLibSQLiteServer = useTursoLibSQLiteServer(test);
  test('an activity flow', async function ({ page }) {
    // do pre-condition setup
    // do action
    // do post-condition assertion
  });
});
```

## Quirk

- Implement any view setup outside of test. Defining view setup function inside of test can cause typing error.
```js
/** Instead Of: */
describe('Some Feature', function () {
  test('an activity flow', async function ({ page }) {
    await loadEmptyFixture(page),
    await page.evaluate(function setupView() {
      document.body.innerHTML = `<h1>Hello World</h1>`;
    });
    // do action
    // do post-condition assertion
  });
});

/** Do: */
function setupView() {
  document.body.innerHTML = `<h1>Hello World</h1>`;
}
describe('Some Feature', function () {
  test('an activity flow', async function ({ page }) {
    await loadEmptyFixture(page),
    await page.evaluate(setupView);
    // do action
    // do post-condition assertion
  });
});
```
