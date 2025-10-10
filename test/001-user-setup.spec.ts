import { test, expect } from 'playwright/test';
import { setup, TestSetup } from './setup/setup.ts';
import { capturePageHTMLOnError } from './setup/playwright.ts';

const { describe, beforeAll, afterAll } = test;

describe('User Setup', function () {
  let testSetup: TestSetup;

  beforeAll(async function () {
    testSetup = await setup();
  });

  afterAll(async function () {
    await testSetup?.teardown();
  });

  test('welcome', capturePageHTMLOnError(async function ({ page }) {
    await page.goto(testSetup.appUrl);
    await expect(page.getByRole('heading', { name: 'Welcome' })).toBeVisible();
    await expect(page.getByText('information about the app')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Get Started' })).toBeVisible();
  }));

  test('setup form', capturePageHTMLOnError(async function ({ page }) {
    await page.goto(testSetup.appUrl);
    await page.getByRole('button', { name: 'Get Started' }).click();
    await expect(page.getByLabel('Turso Database URL')).toBeVisible();
    await expect(page.getByLabel('Turso Database Auth Token')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Submit' })).toBeVisible();
    // Test validation failure
    await page.getByLabel('Turso Database URL').fill('');
    await page.getByLabel('Turso Database Auth Token').fill('');
    await page.getByRole('button', { name: 'Submit' }).click();
    await expect(page.getByText('error message')).toBeVisible();
    // Test validation success
    await page.getByLabel('Turso Database URL').fill('libsql://test.db');
    await page.getByLabel('Turso Database Auth Token').fill('test-token');
    await page.getByRole('button', { name: 'Submit' }).click();
    await expect(page.getByText('success message')).toBeVisible();
  }));

});
