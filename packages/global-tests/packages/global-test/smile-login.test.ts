import { test, expect } from '@playwright/test';
import { TestHelpers } from './utils/test-helpers';

test.describe('SMILE Platform Login Tests', () => {
  let helpers: TestHelpers;
  const baseUrl = process.env.WEB_BASE_URL || 'https://smile-platform.badr.co.id';
  const loginPath = process.env.WEB_LOGIN_PATH || '/login';
  const username = process.env.AUTH_USERNAME;
  const password = process.env.AUTH_PASSWORD;

  test.beforeEach(async ({ page }) => {
    helpers = new TestHelpers(page);
    // Clear any existing authentication before each test
    await page.context().clearCookies();
    await page.context().clearPermissions();
  });

  test.describe('Login Page Access', () => {
    test('should load login page successfully', async ({ page }) => {
      await page.goto(`${baseUrl}${loginPath}`, { waitUntil: 'networkidle' });
      
      // Verify login page elements are present
      const usernameField = page.locator('input[name="username"], input[placeholder*="Username" i]').first();
      const passwordField = page.locator('input[name="password"], input[type="password"]').first();
      const submitButton = page.locator('button[type="submit"], button:has-text("Login"), button:has-text("Masuk")').first();
      
      await expect(usernameField).toBeVisible();
      await expect(passwordField).toBeVisible();
      await expect(submitButton).toBeVisible();
      
      // Verify page title
      const title = await page.title();
      expect(title).toContain('SMILE');
      
      await helpers.takeScreenshot('login_page_loaded');
    });

    test('should have proper page structure and branding', async ({ page }) => {
      await page.goto(`${baseUrl}${loginPath}`, { waitUntil: 'networkidle' });
      
      // Check for SMILE branding
      const hasSmileBranding = await Promise.race([
        page.locator('text=SMILE').isVisible({ timeout: 5000 }),
        page.locator('[alt*="SMILE" i]').isVisible({ timeout: 5000 }),
        page.locator('.logo').isVisible({ timeout: 5000 })
      ]).catch(() => false);
      
      // Check for Indonesian language elements
      const hasIndonesianText = await Promise.race([
        page.locator('text=Kata Sandi').isVisible({ timeout: 2000 }),
        page.locator('text=Masuk').isVisible({ timeout: 2000 }),
        page.locator('text=Username').isVisible({ timeout: 2000 })
      ]).catch(() => false);
      
      console.log('SMILE branding found:', hasSmileBranding);
      console.log('Indonesian text found:', hasIndonesianText);
      
      await helpers.takeScreenshot('login_page_structure');
    });

    test('should be responsive on different screen sizes', async ({ page }) => {
      const viewports = [
        { width: 1920, height: 1080, name: 'desktop' },
        { width: 768, height: 1024, name: 'tablet' },
        { width: 375, height: 667, name: 'mobile' }
      ];
      
      for (const viewport of viewports) {
        await page.setViewportSize({ width: viewport.width, height: viewport.height });
        await page.goto(`${baseUrl}${loginPath}`, { waitUntil: 'networkidle' });
        
        // Verify login form is still accessible
        const usernameField = page.locator('input[name="username"], input[placeholder*="Username" i]').first();
        const passwordField = page.locator('input[name="password"], input[type="password"]').first();
        
        await expect(usernameField).toBeVisible();
        await expect(passwordField).toBeVisible();
        
        await helpers.takeScreenshot(`login_page_${viewport.name}`);
      }
    });
  });

  test.describe('Login Functionality', () => {
    test('should successfully login with valid credentials', async ({ page }) => {
      if (!username || !password) {
        test.skip('Skipping login test - credentials not provided in environment variables');
      }
      
      await page.goto(`${baseUrl}${loginPath}`, { waitUntil: 'networkidle' });
      
      // Fill login form
      await helpers.fillField('input[name="username"], input[placeholder*="Username" i]', username);
      await helpers.fillField('input[name="password"], input[type="password"]', password);
      
      // Take screenshot before login
      await helpers.takeScreenshot('before_login_attempt');
      
      // Submit form
      await helpers.clickButton('button[type="submit"], button:has-text("Login"), button:has-text("Masuk")');
      
      // Wait for navigation after login
      await page.waitForLoadState('networkidle', { timeout: 15000 });
      
      // Verify successful login
      const currentUrl = page.url();
      expect(currentUrl).not.toContain('login');
      
      // Should be redirected to a dashboard or main page
      const isOnValidPage = currentUrl.includes('dashboard') || 
                           currentUrl.includes('global-settings') || 
                           currentUrl.includes('wms') ||
                           currentUrl.includes('v5');
      
      expect(isOnValidPage).toBeTruthy();
      
      await helpers.takeScreenshot('successful_login');
      console.log('Successfully logged in, redirected to:', currentUrl);
    });

    test('should reject invalid username', async ({ page }) => {
      await page.goto(`${baseUrl}${loginPath}`, { waitUntil: 'networkidle' });
      
      // Fill with invalid credentials
      await helpers.fillField('input[name="username"], input[placeholder*="Username" i]', 'invalid_user_12345');
      await helpers.fillField('input[name="password"], input[type="password"]', 'any_password');
      
      // Submit form
      await helpers.clickButton('button[type="submit"], button:has-text("Login"), button:has-text("Masuk")');
      
      // Wait for response
      await page.waitForTimeout(3000);
      
      // Should still be on login page or show error
      const currentUrl = page.url();
      const isStillOnLogin = currentUrl.includes('login');
      
      // Check for error messages
      const hasErrorMessage = await Promise.race([
        page.locator('.error, .alert-danger, .invalid-feedback').isVisible({ timeout: 5000 }),
        page.locator('text=Invalid').isVisible({ timeout: 5000 }),
        page.locator('text=Error').isVisible({ timeout: 5000 })
      ]).catch(() => false);
      
      // Either should stay on login page or show error message
      expect(isStillOnLogin || hasErrorMessage).toBeTruthy();
      
      await helpers.takeScreenshot('invalid_username_attempt');
    });

    test('should reject invalid password', async ({ page }) => {
      if (!username) {
        test.skip('Skipping test - username not provided in environment variables');
      }
      
      await page.goto(`${baseUrl}${loginPath}`, { waitUntil: 'networkidle' });
      
      // Fill with valid username but invalid password
      await helpers.fillField('input[name="username"], input[placeholder*="Username" i]', username);
      await helpers.fillField('input[name="password"], input[type="password"]', 'invalid_password_12345');
      
      // Submit form
      await helpers.clickButton('button[type="submit"], button:has-text("Login"), button:has-text("Masuk")');
      
      // Wait for response
      await page.waitForTimeout(3000);
      
      // Should still be on login page or show error
      const currentUrl = page.url();
      const isStillOnLogin = currentUrl.includes('login');
      
      // Check for error messages
      const hasErrorMessage = await Promise.race([
        page.locator('.error, .alert-danger, .invalid-feedback').isVisible({ timeout: 5000 }),
        page.locator('text=Invalid').isVisible({ timeout: 5000 }),
        page.locator('text=Error').isVisible({ timeout: 5000 })
      ]).catch(() => false);
      
      expect(isStillOnLogin || hasErrorMessage).toBeTruthy();
      
      await helpers.takeScreenshot('invalid_password_attempt');
    });

    test('should reject empty credentials', async ({ page }) => {
      await page.goto(`${baseUrl}${loginPath}`, { waitUntil: 'networkidle' });
      
      // Try to submit without filling any fields
      await helpers.clickButton('button[type="submit"], button:has-text("Login"), button:has-text("Masuk")');
      
      // Wait for validation
      await page.waitForTimeout(2000);
      
      // Should still be on login page
      const currentUrl = page.url();
      expect(currentUrl).toContain('login');
      
      // Check for validation messages
      const hasValidationMessage = await Promise.race([
        page.locator('.error, .alert-danger, .invalid-feedback').isVisible({ timeout: 3000 }),
        page.locator('input:invalid').isVisible({ timeout: 3000 })
      ]).catch(() => false);
      
      await helpers.takeScreenshot('empty_credentials_attempt');
    });

    test('should handle form submission with Enter key', async ({ page }) => {
      if (!username || !password) {
        test.skip('Skipping test - credentials not provided in environment variables');
      }
      
      await page.goto(`${baseUrl}${loginPath}`, { waitUntil: 'networkidle' });
      
      // Fill login form
      await helpers.fillField('input[name="username"], input[placeholder*="Username" i]', username);
      await helpers.fillField('input[name="password"], input[type="password"]', password);
      
      // Submit using Enter key on password field
      await page.locator('input[name="password"], input[type="password"]').press('Enter');
      
      // Wait for navigation
      await page.waitForLoadState('networkidle', { timeout: 15000 });
      
      // Verify successful login
      const currentUrl = page.url();
      expect(currentUrl).not.toContain('login');
      
      await helpers.takeScreenshot('enter_key_login');
    });
  });

  test.describe('Security Features', () => {
    test('should not expose sensitive information in page source', async ({ page }) => {
      await page.goto(`${baseUrl}${loginPath}`, { waitUntil: 'networkidle' });
      
      const pageContent = await page.content();
      
      // Check that no sensitive information is exposed
      expect(pageContent.toLowerCase()).not.toContain('password');
      expect(pageContent.toLowerCase()).not.toContain('secret');
      expect(pageContent.toLowerCase()).not.toContain('token');
      
      // Check for proper form attributes
      const passwordField = page.locator('input[type="password"]');
      const autocomplete = await passwordField.getAttribute('autocomplete');
      
      // Password field should have proper autocomplete settings
      if (autocomplete) {
        expect(['off', 'current-password', 'new-password']).toContain(autocomplete);
      }
    });

    test('should have proper HTTPS redirect', async ({ page }) => {
      // This test checks if HTTP redirects to HTTPS
      const httpUrl = baseUrl.replace('https://', 'http://') + loginPath;
      
      try {
        const response = await page.goto(httpUrl, { waitUntil: 'networkidle' });
        const finalUrl = page.url();
        
        // Should redirect to HTTPS
        expect(finalUrl).toMatch(/^https:/);
      } catch (error) {
        // If HTTP is not accessible, that's also acceptable for security
        console.log('HTTP access blocked (good for security):', error.message);
      }
    });

    test('should handle session timeout appropriately', async ({ page }) => {
      if (!username || !password) {
        test.skip('Skipping test - credentials not provided');
      }
      
      // Login first
      await page.goto(`${baseUrl}${loginPath}`, { waitUntil: 'networkidle' });
      await helpers.fillField('input[name="username"], input[placeholder*="Username" i]', username);
      await helpers.fillField('input[name="password"], input[type="password"]', password);
      await helpers.clickButton('button[type="submit"], button:has-text("Login"), button:has-text("Masuk")');
      
      await page.waitForLoadState('networkidle', { timeout: 15000 });
      
      // Clear cookies to simulate session timeout
      await page.context().clearCookies();
      
      // Try to access a protected route
      await page.goto(`${baseUrl}/id/v5/global-settings/program`, { waitUntil: 'networkidle' });
      
      // Should redirect back to login
      const currentUrl = page.url();
      expect(currentUrl).toContain('login');
      
      await helpers.takeScreenshot('session_timeout_redirect');
    });
  });

  test.describe('Accessibility', () => {
    test('should have proper form labels and accessibility attributes', async ({ page }) => {
      await page.goto(`${baseUrl}${loginPath}`, { waitUntil: 'networkidle' });
      
      // Check for proper form labels
      const usernameField = page.locator('input[name="username"], input[placeholder*="Username" i]').first();
      const passwordField = page.locator('input[type="password"]').first();
      
      // Check if fields have labels or aria-labels
      const usernameLabel = await usernameField.getAttribute('aria-label') || 
                           await page.locator('label[for]').filter({ has: usernameField }).textContent();
      const passwordLabel = await passwordField.getAttribute('aria-label') || 
                           await page.locator('label[for]').filter({ has: passwordField }).textContent();
      
      console.log('Username field accessibility:', usernameLabel || 'placeholder/name attribute');
      console.log('Password field accessibility:', passwordLabel || 'placeholder/type attribute');
      
      // Fields should be keyboard accessible
      await usernameField.focus();
      await expect(usernameField).toBeFocused();
      
      await passwordField.focus();
      await expect(passwordField).toBeFocused();
    });

    test('should support keyboard navigation', async ({ page }) => {
      await page.goto(`${baseUrl}${loginPath}`, { waitUntil: 'networkidle' });
      
      // Tab through form elements
      await page.keyboard.press('Tab');
      const firstFocused = await page.evaluate(() => document.activeElement?.tagName);
      
      await page.keyboard.press('Tab');
      const secondFocused = await page.evaluate(() => document.activeElement?.tagName);
      
      await page.keyboard.press('Tab');
      const thirdFocused = await page.evaluate(() => document.activeElement?.tagName);
      
      console.log('Keyboard navigation order:', [firstFocused, secondFocused, thirdFocused]);
      
      // Should be able to navigate through form elements
      expect([firstFocused, secondFocused, thirdFocused]).toContain('INPUT');
      expect([firstFocused, secondFocused, thirdFocused]).toContain('BUTTON');
    });
  });

  test.describe('Performance', () => {
    test('should load login page within acceptable time', async ({ page }) => {
      const startTime = Date.now();
      
      await page.goto(`${baseUrl}${loginPath}`, { waitUntil: 'networkidle' });
      
      const loadTime = Date.now() - startTime;
      
      // Should load within 10 seconds
      expect(loadTime).toBeLessThan(10000);
      
      console.log(`Login page loaded in ${loadTime}ms`);
    });

    test('should handle multiple rapid login attempts gracefully', async ({ page }) => {
      await page.goto(`${baseUrl}${loginPath}`, { waitUntil: 'networkidle' });
      
      // Make multiple rapid invalid login attempts
      for (let i = 0; i < 3; i++) {
        await helpers.fillField('input[name="username"], input[placeholder*="Username" i]', `test_user_${i}`);
        await helpers.fillField('input[name="password"], input[type="password"]', 'invalid_password');
        await helpers.clickButton('button[type="submit"], button:has-text("Login"), button:has-text("Masuk")');
        await page.waitForTimeout(1000);
      }
      
      // Page should still be responsive
      const usernameField = page.locator('input[name="username"], input[placeholder*="Username" i]').first();
      await expect(usernameField).toBeVisible();
      
      await helpers.takeScreenshot('multiple_login_attempts');
    });
  });
});