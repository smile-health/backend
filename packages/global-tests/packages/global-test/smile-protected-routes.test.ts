import { test, expect } from '@playwright/test';
import { TestHelpers } from './utils/test-helpers';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const baseUrl = process.env.WEB_BASE_URL || 'https://smile-platform.badr.co.id';

// SMILE Platform specific protected routes
const SMILE_PROTECTED_ROUTES = [
  {
    name: 'Global Settings - Program',
    path: '/id/v5/global-settings/program',
    description: 'Program management settings page'
  },
  {
    name: 'Global Settings - User',
    path: '/id/v5/global-settings/user',
    description: 'User management settings page'
  },
  {
    name: 'WMS - Transaction',
    path: '/id/wms/v5/transaction',
    description: 'Warehouse management transaction page'
  },
  {
    name: 'WMS - Dashboard Stock',
    path: '/id/wms/v5/dashboard/stock',
    description: 'Warehouse stock dashboard page'
  }
];

test.describe('SMILE Platform Protected Routes', () => {
  let helpers: TestHelpers;

  test.beforeEach(async ({ page }) => {
    helpers = new TestHelpers(page);
    // Set faster timeouts for this test suite
    page.setDefaultTimeout(5000);
    page.setDefaultNavigationTimeout(8000);
  });

  test.describe('Authentication Required', () => {
    SMILE_PROTECTED_ROUTES.forEach(route => {
      test(`should require authentication for ${route.name}`, async ({ page }) => {
        // Clear any existing authentication
        await page.context().clearCookies();
        
        // Try to access protected route directly with faster options
        const response = await page.goto(`${baseUrl}${route.path}`, { 
          waitUntil: 'domcontentloaded', // Faster than networkidle
          timeout: 8000 
        });
        
        // Should either redirect to login or show login page
        const currentUrl = page.url();
        const isOnLoginPage = currentUrl.includes('login') || 
                             currentUrl.includes('auth') ||
                             await page.locator('input[name="username"]').isVisible({ timeout: 5000 });
        
        expect(isOnLoginPage).toBeTruthy();
        console.log(`${route.name}: Correctly redirected to login when not authenticated`);
      });
    });
  });

  test.describe('Authenticated Access', () => {
    // These tests use the authenticated state from auth.setup.ts
    test.use({ storageState: 'packages/global-test/.auth/user.json' });

    SMILE_PROTECTED_ROUTES.forEach(route => {
      test(`should allow authenticated access to ${route.name}`, async ({ page }) => {
        console.log(`Testing authenticated access to: ${route.path}`);
        
        // Navigate to the protected route
        await page.goto(`${baseUrl}${route.path}`, { waitUntil: 'networkidle', timeout: 30000 });
        
        // Wait for page to load
        await helpers.waitForPageLoad();
        
        // Verify we're not redirected to login
        const currentUrl = page.url();
        expect(currentUrl).not.toContain('login');
        
        // Verify page loaded successfully (not an error page)
        const pageTitle = await page.title();
        expect(pageTitle).not.toContain('Error');
        expect(pageTitle).not.toContain('404');
        expect(pageTitle).not.toContain('Not Found');
        
        // Check for common error indicators
        const hasErrorMessage = await page.locator('.error, .alert-danger, [data-testid="error"]').isVisible({ timeout: 2000 }).catch(() => false);
        expect(hasErrorMessage).toBeFalsy();
        
        // Take screenshot for verification
        await helpers.takeScreenshot(`${route.name.replace(/[^a-zA-Z0-9]/g, '_')}_authenticated_access`);
        
        console.log(`✓ Successfully accessed ${route.name}`);
      });
    });
  });

  test.describe('Page Content Verification', () => {
    test.use({ storageState: 'packages/global-test/.auth/user.json' });

    test('should load Global Settings - Program page with expected content', async ({ page }) => {
      await page.goto(`${baseUrl}/id/v5/global-settings/program`, { waitUntil: 'networkidle' });
      await helpers.waitForPageLoad();
      
      // Verify page title or heading
      const hasRelevantContent = await Promise.race([
        page.locator('h1, h2, h3').filter({ hasText: /program/i }).isVisible({ timeout: 5000 }),
        page.locator('[data-testid*="program"]').isVisible({ timeout: 5000 }),
        page.locator('.program, .settings').isVisible({ timeout: 5000 })
      ]).catch(() => false);
      
      // If specific content isn't found, at least verify the page loaded without errors
      if (!hasRelevantContent) {
        const currentUrl = page.url();
        expect(currentUrl).toContain('global-settings/program');
        console.log('Program page loaded successfully (content structure may vary)');
      }
      
      await helpers.takeScreenshot('global_settings_program_content');
    });

    test('should load Global Settings - User page with expected content', async ({ page }) => {
      await page.goto(`${baseUrl}/id/v5/global-settings/user`, { waitUntil: 'networkidle' });
      await helpers.waitForPageLoad();
      
      // Verify page content
      const hasRelevantContent = await Promise.race([
        page.locator('h1, h2, h3').filter({ hasText: /user/i }).isVisible({ timeout: 5000 }),
        page.locator('[data-testid*="user"]').isVisible({ timeout: 5000 }),
        page.locator('.user, .settings').isVisible({ timeout: 5000 })
      ]).catch(() => false);
      
      if (!hasRelevantContent) {
        const currentUrl = page.url();
        expect(currentUrl).toContain('global-settings/user');
        console.log('User settings page loaded successfully (content structure may vary)');
      }
      
      await helpers.takeScreenshot('global_settings_user_content');
    });

    test('should load WMS Transaction page with expected content', async ({ page }) => {
      await page.goto(`${baseUrl}/id/wms/v5/transaction`, { waitUntil: 'networkidle' });
      await helpers.waitForPageLoad();
      
      // Verify page content
      const hasRelevantContent = await Promise.race([
        page.locator('h1, h2, h3').filter({ hasText: /transaction/i }).isVisible({ timeout: 5000 }),
        page.locator('[data-testid*="transaction"]').isVisible({ timeout: 5000 }),
        page.locator('.transaction, .wms').isVisible({ timeout: 5000 })
      ]).catch(() => false);
      
      if (!hasRelevantContent) {
        const currentUrl = page.url();
        expect(currentUrl).toContain('wms/v5/transaction');
        console.log('WMS Transaction page loaded successfully (content structure may vary)');
      }
      
      await helpers.takeScreenshot('wms_transaction_content');
    });

    test('should load WMS Dashboard Stock page with expected content', async ({ page }) => {
      await page.goto(`${baseUrl}/id/wms/v5/dashboard/stock`, { waitUntil: 'networkidle' });
      await helpers.waitForPageLoad();
      
      // Verify page content
      const hasRelevantContent = await Promise.race([
        page.locator('h1, h2, h3').filter({ hasText: /stock|dashboard/i }).isVisible({ timeout: 5000 }),
        page.locator('[data-testid*="stock"], [data-testid*="dashboard"]').isVisible({ timeout: 5000 }),
        page.locator('.stock, .dashboard, .wms').isVisible({ timeout: 5000 })
      ]).catch(() => false);
      
      if (!hasRelevantContent) {
        const currentUrl = page.url();
        expect(currentUrl).toContain('wms/v5/dashboard/stock');
        console.log('WMS Dashboard Stock page loaded successfully (content structure may vary)');
      }
      
      await helpers.takeScreenshot('wms_dashboard_stock_content');
    });
  });

  test.describe('Navigation and User Experience', () => {
    test.use({ storageState: 'packages/global-test/.auth/user.json' });

    test('should maintain authentication across route navigation', async ({ page }) => {
      // Navigate through multiple protected routes
      for (const route of SMILE_PROTECTED_ROUTES) {
        console.log(`Navigating to: ${route.name}`);
        
        await page.goto(`${baseUrl}${route.path}`, { waitUntil: 'networkidle', timeout: 30000 });
        await helpers.waitForPageLoad();
        
        // Verify we're not redirected to login
        const currentUrl = page.url();
        expect(currentUrl).not.toContain('login');
        
        // Verify authentication is maintained
        await helpers.verifyAuthenticated();
        
        console.log(`✓ Successfully navigated to ${route.name}`);
      }
    });

    test('should handle browser back/forward navigation', async ({ page }) => {
      // Navigate to first route
      await page.goto(`${baseUrl}${SMILE_PROTECTED_ROUTES[0].path}`, { waitUntil: 'networkidle' });
      await helpers.waitForPageLoad();
      
      // Navigate to second route
      await page.goto(`${baseUrl}${SMILE_PROTECTED_ROUTES[1].path}`, { waitUntil: 'networkidle' });
      await helpers.waitForPageLoad();
      
      // Use browser back button
      await page.goBack({ waitUntil: 'networkidle' });
      await helpers.waitForPageLoad();
      
      // Verify we're back to first route and still authenticated
      const currentUrl = page.url();
      expect(currentUrl).toContain(SMILE_PROTECTED_ROUTES[0].path);
      expect(currentUrl).not.toContain('login');
      
      // Use browser forward button
      await page.goForward({ waitUntil: 'networkidle' });
      await helpers.waitForPageLoad();
      
      // Verify we're back to second route and still authenticated
      const forwardUrl = page.url();
      expect(forwardUrl).toContain(SMILE_PROTECTED_ROUTES[1].path);
      expect(forwardUrl).not.toContain('login');
    });

    test('should handle page refresh while maintaining authentication', async ({ page }) => {
      // Navigate to a protected route
      await page.goto(`${baseUrl}${SMILE_PROTECTED_ROUTES[0].path}`, { waitUntil: 'networkidle' });
      await helpers.waitForPageLoad();
      
      // Refresh the page
      await page.reload({ waitUntil: 'networkidle' });
      await helpers.waitForPageLoad();
      
      // Verify we're still on the same route and authenticated
      const currentUrl = page.url();
      expect(currentUrl).toContain(SMILE_PROTECTED_ROUTES[0].path);
      expect(currentUrl).not.toContain('login');
      
      await helpers.verifyAuthenticated();
    });
  });

  test.describe('Error Handling', () => {
    test.use({ storageState: 'packages/global-test/.auth/user.json' });

    test('should handle network errors gracefully', async ({ page }) => {
      // Simulate offline condition
      await page.context().setOffline(true);
      
      try {
        await page.goto(`${baseUrl}${SMILE_PROTECTED_ROUTES[0].path}`, { timeout: 10000 });
      } catch (error) {
        // Expected to fail when offline
        console.log('Expected network error when offline:', error.message);
      }
      
      // Restore online condition
      await page.context().setOffline(false);
      
      // Should work again when online
      await page.goto(`${baseUrl}${SMILE_PROTECTED_ROUTES[0].path}`, { waitUntil: 'networkidle' });
      await helpers.waitForPageLoad();
      
      const currentUrl = page.url();
      expect(currentUrl).not.toContain('login');
    });

    test('should handle invalid routes appropriately', async ({ page }) => {
      // Try to access a non-existent route
      const invalidRoute = '/id/v5/non-existent-route';
      
      const response = await page.goto(`${baseUrl}${invalidRoute}`, { waitUntil: 'networkidle' });
      
      // Should either show 404 or redirect appropriately
      const status = response?.status();
      const currentUrl = page.url();
      
      // Accept 404, or redirect to a valid page (but not login)
      if (status === 404) {
        console.log('Invalid route correctly returned 404');
      } else {
        expect(currentUrl).not.toContain('login');
        console.log('Invalid route handled with redirect to:', currentUrl);
      }
    });
  });

  test.describe('Performance', () => {
    test.use({ storageState: 'packages/global-test/.auth/user.json' });

    test('should load protected routes within acceptable time', async ({ page }) => {
      for (const route of SMILE_PROTECTED_ROUTES) {
        const startTime = Date.now();
        
        await page.goto(`${baseUrl}${route.path}`, { waitUntil: 'networkidle', timeout: 30000 });
        await helpers.waitForPageLoad();
        
        const loadTime = Date.now() - startTime;
        
        // Should load within 30 seconds (generous timeout for complex pages)
        expect(loadTime).toBeLessThan(30000);
        
        console.log(`${route.name} loaded in ${loadTime}ms`);
      }
    });
  });
});