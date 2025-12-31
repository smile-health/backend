import { Page, expect } from "@playwright/test";
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const baseUrl = process.env.WEB_BASE_URL || 'https://smile-platform.badr.co.id';

export class TestHelpers {
  constructor(private page: Page) {}

  /**
   * Wait for page to load completely
   */
  async waitForPageLoad(timeout: number = 3000): Promise<void> { // Reduced default timeout
    try {
      await this.page.waitForLoadState('domcontentloaded', { timeout });
    } catch (error) {
      console.warn(`Page load timeout after ${timeout}ms`);
    }
  }

  async navigateToProtectedRoute(path: string): Promise<void> {
    await this.page.goto(`${baseUrl}${path}`, { 
      waitUntil: 'domcontentloaded', // Faster than networkidle
      timeout: 8000 
    });
  }

  /**
   * Take a screenshot with a custom name
   */
  async takeScreenshot(name: string) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    await this.page.screenshot({
      path: `test-results/screenshots/${name}-${timestamp}.png`,
      fullPage: true,
    });
  }

  /**
   * Check if user is authenticated by looking for common auth indicators
   */
  async verifyAuthenticated() {
    const authIndicators = [
      '[data-testid="user-menu"]',
      '[data-testid="logout-button"]',
      '[data-testid="user-info"]',
      ".user-profile",
      ".user-menu",
      ".logout-button",
      ".user-info",
    ];

    let authenticated = false;
    for (const selector of authIndicators) {
      try {
        await expect(this.page.locator(selector)).toBeVisible({
          timeout: 5000,
        });
        authenticated = true;
        break;
      } catch (error) {
        continue;
      }
    }

    if (!authenticated) {
      // Fallback: check URL doesn't contain login/auth paths
      const currentUrl = this.page.url();
      if (currentUrl.includes("/login") || currentUrl.includes("/auth")) {
        throw new Error(
          "User appears to not be authenticated - on login/auth page"
        );
      }
    }
  }

  /**
   * Navigate to a protected route and verify access
   */
  async navigateToProtectedRoute(path: string) {
    await this.page.goto(`${baseUrl}${path}`);
    await this.waitForPageLoad();

    // Verify we're not redirected to login
    const currentUrl = this.page.url();
    if (currentUrl.includes("/login") || currentUrl.includes("/auth")) {
      throw new Error(
        `Access denied to protected route: ${path} - redirected to authentication`
      );
    }

    // Check for common error indicators
    const pageContent = await this.page.textContent("body");
    if (
      pageContent?.includes("403") ||
      pageContent?.includes("Forbidden") ||
      pageContent?.includes("401") ||
      pageContent?.includes("Unauthorized")
    ) {
      throw new Error(
        `Access denied to protected route: ${path} - authorization error`
      );
    }
  }

  /**
   * Fill form field by various selector strategies
   */
  async fillField(fieldName: string, value: string) {
    const selectors = [
      `[data-testid="${fieldName}"]`,
      `input[name="${fieldName}"]`,
      `[name="${fieldName}"]`,
      `#${fieldName}`,
      `.${fieldName}`,
      `[placeholder*="${fieldName}" i]`,
      `[aria-label*="${fieldName}" i]`,
    ];

    for (const selector of selectors) {
      try {
        await this.page.fill(selector, value, { timeout: 2000 });
        return;
      } catch (error) {
        continue;
      }
    }

    throw new Error(`Could not find field: ${fieldName}`);
  }

  /**
   * Click button by various selector strategies
   */
  async clickButton(buttonName: string) {
    const selectors = [
      `[data-testid="${buttonName}"]`,
      `button:has-text("${buttonName}")`,
      `[aria-label="${buttonName}"]`,
      `.${buttonName}`,
      `#${buttonName}`,
      `input[value="${buttonName}"]`,
      `[title="${buttonName}"]`,
    ];

    for (const selector of selectors) {
      try {
        await this.page.click(selector, { timeout: 2000 });
        return;
      } catch (error) {
        continue;
      }
    }

    throw new Error(`Could not find button: ${buttonName}`);
  }

  /**
   * Wait for element to be visible with flexible selector strategies
   */
  async waitForElement(elementName: string, timeout: number = 10000) {
    const selectors = [
      `[data-testid="${elementName}"]`,
      `#${elementName}`,
      `.${elementName}`,
      `[aria-label="${elementName}"]`,
      `[title="${elementName}"]`,
    ];

    for (const selector of selectors) {
      try {
        await this.page.waitForSelector(selector, { timeout: timeout });
        return this.page.locator(selector);
      } catch (error) {
        continue;
      }
    }

    throw new Error(`Could not find element: ${elementName}`);
  }

  /**
   * Check if element exists without throwing error
   */
  async elementExists(elementName: string): Promise<boolean> {
    try {
      await this.waitForElement(elementName, 1000);
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get page title and verify it contains expected text
   */
  async verifyPageTitle(expectedTitle: string) {
    const title = await this.page.title();
    expect(title.toLowerCase()).toContain(expectedTitle.toLowerCase());
  }

  /**
   * Verify page URL contains expected path
   */
  async verifyPageUrl(expectedPath: string) {
    const currentUrl = this.page.url();
    expect(currentUrl).toContain(expectedPath);
  }

  /**
   * Wait for API response and verify status
   */
  async waitForApiResponse(urlPattern: string, expectedStatus: number = 200) {
    const response = await this.page.waitForResponse(
      (response) =>
        response.url().includes(urlPattern) &&
        response.status() === expectedStatus
    );
    return response;
  }

  /**
   * Scroll element into view
   */
  async scrollToElement(elementName: string) {
    const element = await this.waitForElement(elementName);
    await element.scrollIntoViewIfNeeded();
  }

  /**
   * Get text content of element
   */
  async getElementText(elementName: string): Promise<string> {
    const element = await this.waitForElement(elementName);
    const text = await element.textContent();
    return text || "";
  }

  /**
   * Verify element contains expected text
   */
  async verifyElementText(elementName: string, expectedText: string) {
    const element = await this.waitForElement(elementName);
    await expect(element).toContainText(expectedText);
  }

  /**
   * Handle common loading states
   */
  async waitForLoadingToComplete() {
    // Wait for common loading indicators to disappear
    const loadingSelectors = [
      ".loading",
      ".spinner",
      '[data-testid="loading"]',
      '[data-testid="spinner"]',
      ".loader",
    ];

    for (const selector of loadingSelectors) {
      try {
        await this.page.waitForSelector(selector, {
          state: "hidden",
          timeout: 2000,
        });
      } catch (error) {
        // Loading indicator might not exist, continue
        continue;
      }
    }

    // Also wait for network to be idle
    await this.waitForPageLoad();
  }
}
