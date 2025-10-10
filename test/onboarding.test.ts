import test, { expect } from 'playwright/test';
import { setup, TestSetup } from './setup/setup.ts';

const { describe, beforeAll, afterAll } = test;

describe('Onboarding', function () {
  let testSetup: TestSetup;

  beforeAll(async function () {
    testSetup = await setup();
  });

  afterAll(async function () {
    await testSetup?.teardown();
  });

  test('should display onboarding screens', async function ({ page }) {
    await page.goto(testSetup.appUrl);

    await expect(page.getByText('Welcome to Jurukasa')).toBeVisible();
  });

});
