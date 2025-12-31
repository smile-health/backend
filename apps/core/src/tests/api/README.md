# API Testing with Mocha and Chai

This directory contains automated tests for the platform API endpoints using Mocha as the test runner and Chai for assertions.

## Structure

```
tests/api/
├── auth/             # Authentication-related tests
├── utils/            # Shared test utilities
└── README.md         # This file
```

## Prerequisites

- Node.js (v14+)
- npm or bun package manager

## Setup

1. Install dependencies:

   ```bash
   bun install
   # or
   npm install
   ```

2. Configure test environment variables:
   Create a `.env.test` file in the project root with the following:
   ```
   API_BASE_URL=http://localhost:3000
   TEST_USERNAME=testuser
   TEST_PASSWORD=password
   ```

## Running Tests

Run all API tests:

```bash
bun test src/tests/api
# or
npm run test:api
```

Run specific test suites:

```bash
bun test src/tests/api/auth
```

## Test Guidelines

1. **Structure**:

   - Group tests logically using `describe` blocks
   - Use clear, descriptive test names with `it` that read like sentences

2. **Authentication**:

   - Use the `authenticate()` utility for tests requiring an authenticated user
   - For performance, use a single token across tests where possible

3. **Assertions**:

   - Use Chai's BDD style assertions (`expect`)
   - Assert both response status and content structure
   - Use utility functions in `test-utils.ts` for common assertions

4. **Data Management**:

   - Clean up created data after tests
   - Use unique identifiers for test data to prevent collisions

5. **Environment**:
   - Never run tests against production environments
   - Use environment variables for configuration
