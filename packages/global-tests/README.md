# Global Tests for SMILE Platform

This package contains both API and Web UI tests for the SMILE Platform microservices.

## Overview

- **API Tests**: Located in `test/api/` - Uses Mocha, Chai, and chai-http
- **Web UI Tests**: Located in `packages/global-test/` - Uses Playwright

## Setup

### Prerequisites

1. Node.js (v16 or higher)
2. npm or yarn
3. Running SMILE Platform services

### Installation

```bash
# Install dependencies
npm install

# Install Playwright browsers
npx playwright install
```

### Environment Configuration

1. Copy the example environment file:
   ```bash
   cp .env.example .env
   ```

2. Update the `.env` file with your configuration:
   ```env
   # API Tests
   AUTH_BASE_URL=http://localhost:8080
   API_BASE_URL=http://localhost:8080
   AUTH_USERNAME=your_username
   AUTH_PASSWORD=your_password

   # SMILE Platform Web UI Tests
   WEB_BASE_URL=https://smile-platform.badr.co.id
   WEB_LOGIN_PATH=/login
   ```

## Running Tests

### API Tests

```bash
# Run all API tests
npm run test

# Run API tests with coverage
npm run test:coverage
```

### Web UI Tests

```bash
# Run all UI tests (headless)
npm run test:ui

# Run UI tests with visible browser
npm run test:ui:headed

# Debug UI tests (step-by-step)
npm run test:ui:debug

# View test report
npm run test:ui:report
```

### Run All Tests

```bash
# Run both API and UI tests
npm run test:all
```

## Test Structure

### API Tests

The API tests use Chai and Chai-HTTP to test backend endpoints:

- `test/api/base.test.js` - Base authentication and setup
- `test/api/login.test.js` - Login endpoint comprehensive tests
- `test/api/protected-endpoints.test.js` - SMILE platform protected API endpoints tests
- Authentication is handled automatically using the configured credentials

### Web UI Test Structure

#### Authentication Setup

The web UI tests use Playwright's authentication setup pattern:

1. **`auth.setup.ts`**: Handles login and saves authentication state
2. **Authentication state**: Saved to `packages/global-test/.auth/user.json`
3. **Test isolation**: Each test starts with authenticated state

### Test Files

#### General Tests
- **`dashboard.test.ts`**: Tests dashboard functionality and navigation
- **`protected-routes.test.ts`**: Tests access to protected routes and authentication

#### SMILE Platform Specific Tests
- **`smile-login.test.ts`**: SMILE platform login functionality tests
- **`smile-protected-routes.test.ts`**: SMILE platform protected endpoints tests
  - Global Settings: `/id/v5/global-settings/program`, `/id/v5/global-settings/user`
  - WMS Routes: `/id/wms/v5/transaction`, `/id/wms/v5/dashboard/stock`

### Test Helpers

- **`utils/test-helpers.ts`**: Reusable functions for common test operations

## Configuration

### Playwright Configuration

The `playwright.config.ts` file configures:

- **Test directory**: `packages/global-test/`
- **Base URL**: From `WEB_BASE_URL` environment variable
- **Browsers**: Chrome, Firefox, Safari
- **Authentication**: Shared state across tests
- **Screenshots**: On failure
- **Videos**: On failure

### Customizing for Your Application

#### 1. Update Login Selectors

Edit `packages/global-test/auth.setup.ts` to match your login form:

```typescript
// Update these selectors to match your login form
const usernameSelectors = [
  '[data-testid="username"]',
  'input[name="username"]',
  // Add your specific selectors
];
```

#### 2. Update Success Indicators

Modify the authentication success detection:

```typescript
// Update these to match your post-login indicators
const successIndicators = [
  () => page.waitForURL('**/dashboard', { timeout: 10000 }),
  () => page.waitForSelector('[data-testid="user-menu"]', { timeout: 10000 }),
  // Add your specific indicators
];
```

#### 3. Update Protected Routes

Edit `packages/global-test/protected-routes.test.ts`:

```typescript
const protectedRoutes = [
  { path: '/dashboard', name: 'Dashboard' },
  { path: '/your-route', name: 'Your Route' },
  // Add your actual protected routes
];
```

## Best Practices

### 1. Use Data Test IDs

Add `data-testid` attributes to your HTML elements for reliable selection:

```html
<button data-testid="login-button">Login</button>
<div data-testid="user-menu">User Menu</div>
```

### 2. Environment-Specific Configuration

Use different `.env` files for different environments:

```bash
# Development
cp .env.example .env.dev

# Staging
cp .env.example .env.staging

# Production
cp .env.example .env.prod
```

### 3. Test Organization

Organize tests by feature or page:

```
packages/global-test/
├── auth.setup.ts
├── dashboard.test.ts
├── user-management.test.ts
├── reports.test.ts
└── utils/
    └── test-helpers.ts
```

### 4. Debugging

For debugging failed tests:

```bash
# Run specific test file
npx playwright test dashboard.test.ts

# Run with debug mode
npx playwright test --debug

# Run with headed browser
npx playwright test --headed
```

## Troubleshooting

### Common Issues

#### 1. Authentication Fails

- Check your credentials in `.env`
- Verify the login URL and selectors
- Check browser console for errors

#### 2. Tests Timeout

- Increase timeout in `playwright.config.ts`
- Check if services are running
- Verify network connectivity

#### 3. Element Not Found

- Update selectors in test files
- Add `data-testid` attributes to your HTML
- Use browser dev tools to inspect elements

#### 4. Protected Routes Fail

- Verify authentication is working
- Check route permissions
- Update route paths in test files

### Debug Commands

```bash
# Show Playwright version
npx playwright --version

# Show installed browsers
npx playwright install --dry-run

# Generate test code
npx playwright codegen localhost:3000

# Show test results
npx playwright show-report
```

## CI/CD Integration

### GitHub Actions Example

```yaml
name: Tests
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Install Playwright
        run: npx playwright install --with-deps
      
      - name: Run API tests
        run: npm run test
      
      - name: Run UI tests
        run: npm run test:ui
        env:
          WEB_BASE_URL: http://localhost:3000
          AUTH_USERNAME: ${{ secrets.TEST_USERNAME }}
          AUTH_PASSWORD: ${{ secrets.TEST_PASSWORD }}
```

## Contributing

1. Follow existing test patterns
2. Add appropriate error handling
3. Use descriptive test names
4. Update documentation for new features
5. Ensure tests are reliable and not flaky

## Support

For issues or questions:

1. Check the troubleshooting section
2. Review Playwright documentation: https://playwright.dev/
3. Check existing test patterns in this repository
4. Contact the development team