import { test as setup, expect } from '@playwright/test';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const authFile = 'packages/global-test/.auth/user.json';

setup('authenticate', async ({ page }) => {
  const baseUrl = process.env.WEB_BASE_URL || 'https://smile-platform.badr.co.id';
  const loginPath = process.env.WEB_LOGIN_PATH || '/login';
  const username = process.env.AUTH_USERNAME;
  const password = process.env.AUTH_PASSWORD;

  if (!username || !password) {
    throw new Error('Missing required environment variables: AUTH_USERNAME, AUTH_PASSWORD');
  }

  console.log(`Authenticating user: ${username}`);
  console.log(`Login URL: ${baseUrl}${loginPath}`);

  // Navigate to login page
  await page.goto(`${baseUrl}${loginPath}`);

  // Wait for login form to be visible
  await page.waitForLoadState('networkidle');

  // SMILE platform specific selectors based on the login page structure
  const usernameSelectors = [
    'input[name="username"]',
    'input[placeholder*="Username" i]',
    '[data-testid="username"]',
    'input[type="text"]',
    '#username',
    '.username-input'
  ];

  const passwordSelectors = [
    'input[name="password"]',
    'input[placeholder*="Kata Sandi" i]',
    'input[placeholder*="Password" i]',
    '[data-testid="password"]',
    'input[type="password"]',
    '#password',
    '.password-input'
  ];

  const submitSelectors = [
    'button[type="submit"]',
    'input[type="submit"]',
    'button:has-text("Login")',
    'button:has-text("Masuk")',
    '[data-testid="login-button"]',
    '.login-button',
    '#login-button',
    'form button'
  ];

  // Try to find and fill username field
  let usernameField = null;
  for (const selector of usernameSelectors) {
    try {
      usernameField = await page.locator(selector).first();
      if (await usernameField.isVisible({ timeout: 2000 })) {
        await usernameField.clear();
        await usernameField.fill(username);
        console.log(`Username filled using selector: ${selector}`);
        break;
      }
    } catch (error) {
      continue;
    }
  }

  if (!usernameField) {
    throw new Error('Could not find username field with any of the attempted selectors');
  }

  // Try to find and fill password field
  let passwordField = null;
  for (const selector of passwordSelectors) {
    try {
      passwordField = await page.locator(selector).first();
      if (await passwordField.isVisible({ timeout: 2000 })) {
        await passwordField.clear();
        await passwordField.fill(password);
        console.log(`Password filled using selector: ${selector}`);
        break;
      }
    } catch (error) {
      continue;
    }
  }

  if (!passwordField) {
    throw new Error('Could not find password field with any of the attempted selectors');
  }

  // Try to find and click submit button
  let submitButton = null;
  for (const selector of submitSelectors) {
    try {
      submitButton = await page.locator(selector).first();
      if (await submitButton.isVisible({ timeout: 2000 })) {
        await submitButton.click();
        console.log(`Submit button clicked using selector: ${selector}`);
        break;
      }
    } catch (error) {
      continue;
    }
  }

  if (!submitButton) {
    // Try submitting the form by pressing Enter on password field
    await passwordField.press('Enter');
    console.log('Submitted form using Enter key on password field');
  }

  // Wait for authentication to complete
  // SMILE platform specific success indicators
  // Optimized success indicators with shorter timeouts
  const successIndicators = [
    // Most reliable indicator first
    () => page.waitForFunction(() => {
      const url = window.location.href;
      return !url.includes('login') && url.includes('v5');
    }, { timeout: 5000 }),
    // Backup indicators with shorter timeouts
    () => page.waitForURL('**/id/v5/**', { timeout: 3000 }),
    () => page.waitForURL('**/program**', { timeout: 3000 }),
    () => page.waitForSelector('button:has-text("AA Arya Abbas")', { timeout: 3000 })
  ];

  let loginSuccessful = false;
  for (const indicator of successIndicators) {
    try {
      await indicator();
      loginSuccessful = true;
      console.log('Login successful - detected by success indicator');
      break;
    } catch (error) {
      continue;
    }
  }

  if (!loginSuccessful) {
    // Final check: ensure we're not still on login page and wait a bit longer
    await page.waitForTimeout(5000);
    const currentUrl = page.url();
    
    // Check for any error messages on the page
    const errorSelectors = [
      '.error-message',
      '.alert-danger',
      '[data-testid="error"]',
      '.login-error'
    ];
    
    for (const errorSelector of errorSelectors) {
      try {
        const errorElement = await page.locator(errorSelector).first();
        if (await errorElement.isVisible({ timeout: 1000 })) {
          const errorText = await errorElement.textContent();
          throw new Error(`Login failed with error: ${errorText}`);
        }
      } catch (error) {
        // Continue if no error element found
      }
    }
    
    if (currentUrl.includes('login')) {
      throw new Error(`Authentication failed - still on login page: ${currentUrl}`);
    }
    console.log('Login appears successful - no longer on login page');
  }

  // Save signed-in state to 'user.json'
  await page.context().storageState({ path: authFile });
  console.log(`Authentication state saved to: ${authFile}`);
});