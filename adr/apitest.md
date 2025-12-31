# AI API Testing Guidelines for Microservices

## Overview

This document provides guidelines for creating automated API tests for our microservices architecture using Mocha and Chai. These tests should validate the functionality, reliability, and performance of our API endpoints without directly interacting with the database.

## Testing Principles

1. **API-Only Testing**: Tests should interact exclusively with the API endpoints and not access the database directly.
2. **Authentication First**: Every test suite should begin with authentication using the provided credentials.
3. **Independence**: Each test should be self-contained and not depend on the state created by other tests.
4. **Coverage Reporting**: All test runs should generate and output coverage reports.

## Testing Stack

- **Mocha**: Test runner framework
- **Chai**: Assertion library
- **Chai-HTTP**: Plugin for testing HTTP APIs
- **Axios**: HTTP client for API requests
- **NYC (Istanbul)**: Code coverage tool

## Setup

### Installation

Install the required packages:

```bash
npm install --save-dev mocha chai chai-http axios nyc
```

### Project Structure

```
/tests
  /api
    user.test.js
    product.test.js
    ...
  hooks.js         # Common setup for all tests
.nycrc             # NYC coverage configuration
```

### Configuration

Create a `.nycrc` file for coverage configuration:

```json
{
  "all": true,
  "include": ["src/**/*.js"],
  "exclude": ["**/*.spec.js", "**/*.test.js"],
  "reporter": ["html", "text", "lcov"],
  "check-coverage": true,
  "branches": 80,
  "lines": 80,
  "functions": 80,
  "statements": 80
}
```

Add scripts to your `package.json`:

```json
{
  "scripts": {
    "test": "mocha tests/**/*.test.js --timeout 10000",
    "test:coverage": "nyc mocha tests/**/*.test.js --timeout 10000"
  }
}
```

## Test Structure

### 1. Authentication Setup

Always begin your test suite with authentication:

```javascript
const axios = require("axios");
const chai = require("chai");
const expect = chai.expect;

const BASE_URL = "https://api.example.com";

// Credentials for testing
const TEST_CREDENTIALS = {
  username: "test_user@example.com",
  password: "SecurePassword123!",
};

let authToken;
let headers;

// Before all tests in this file
before(async function () {
  try {
    const loginResponse = await axios.post(
      `${BASE_URL}/auth/login`,
      TEST_CREDENTIALS
    );
    authToken = loginResponse.data.token;
    headers = {
      Authorization: `Bearer ${authToken}`,
      "Content-Type": "application/json",
    };
  } catch (error) {
    console.error("Authentication failed:", error.message);
    throw error;
  }
});
```

### 2. Request Headers Setup

After authentication, the headers object is set up with the authentication token:

```javascript
headers = {
  Authorization: `Bearer ${authToken}`,
  "Content-Type": "application/json",
};
```

### 3. Test Organization

Organize tests in logical groups based on resource or functionality:

```javascript
describe("User API", function () {
  // Authentication happens in the before() hook

  describe("GET /users", function () {
    it("should return a list of users", async function () {
      // Test implementation
    });
  });

  describe("POST /users", function () {
    it("should create a new user", async function () {
      // Test implementation
    });
  });
});
```

## Writing Effective API Tests

### Request Testing Template

```javascript
it("should [expected behavior]", async function () {
  // 1. Setup - prepare any necessary data
  const requestData = {
    /* request payload */
  };

  // 2. Execute - make the API call
  const response = await axios.method(`${BASE_URL}/endpoint`, requestData, {
    headers,
  });

  // 3. Verify - check the response using chai assertions
  expect(response.status).to.equal(expectedStatusCode);
  expect(response.data).to.include.keys(["id", "name"]);
  expect(response.data.name).to.equal(expectedName);

  // 4. Additional validations as needed
});
```

### Using Chai-HTTP

As an alternative to Axios, you can use Chai-HTTP for more integrated testing:

```javascript
const chai = require("chai");
const chaiHttp = require("chai-http");
const expect = chai.expect;

chai.use(chaiHttp);

describe("Products API", function () {
  it("should get all products", function (done) {
    chai
      .request(BASE_URL)
      .get("/products")
      .set(headers)
      .end(function (err, res) {
        expect(err).to.be.null;
        expect(res).to.have.status(200);
        expect(res.body).to.be.an("array");
        done();
      });
  });

  // For async/await style with chai-http:
  it("should get a specific product", async function () {
    const res = await chai.request(BASE_URL).get("/products/1").set(headers);

    expect(res).to.have.status(200);
    expect(res.body).to.have.property("id");
  });
});
```

### Mock External Dependencies

If your API calls external services, use a mocking library like Sinon:

```javascript
const sinon = require("sinon");
const externalService = require("external-service");

// In your test file
beforeEach(function () {
  // Create stub before each test
  sinon
    .stub(externalService, "someMethod")
    .resolves({ data: mockResponseData });
});

afterEach(function () {
  // Restore after each test
  sinon.restore();
});
```

## Test Coverage

### Generating Coverage Reports

The NYC package (Istanbul) will be used for generating coverage reports:

```bash
npm run test:coverage
```

This will:

1. Run all tests
2. Generate coverage information
3. Produce reports in the formats specified in your `.nycrc` file
4. Check coverage against thresholds

### Viewing Coverage Reports

After running the coverage command:

- Text report appears in the console
- HTML report is generated in the `coverage` directory
- LCOV report can be used with external tools

## Sample Test Implementation

Here's a complete example of an API test suite using Mocha and Chai:

```javascript
const axios = require("axios");
const chai = require("chai");
const expect = chai.expect;

const BASE_URL = "https://api.example.com";

// Credentials for testing
const TEST_CREDENTIALS = {
  username: "test_user@example.com",
  password: "SecurePassword123!",
};

describe("Product API", function () {
  let authToken;
  let headers;

  // Authentication before all tests
  before(async function () {
    try {
      const loginResponse = await axios.post(
        `${BASE_URL}/auth/login`,
        TEST_CREDENTIALS
      );
      authToken = loginResponse.data.token;
      headers = {
        Authorization: `Bearer ${authToken}`,
        "Content-Type": "application/json",
      };
    } catch (error) {
      console.error("Authentication failed:", error.message);
      throw error;
    }
  });

  describe("GET /products", function () {
    it("should return a list of products", async function () {
      const response = await axios.get(`${BASE_URL}/products`, { headers });

      expect(response.status).to.equal(200);
      expect(response.data).to.be.an("array");

      if (response.data.length > 0) {
        expect(response.data[0]).to.have.property("id");
        expect(response.data[0]).to.have.property("name");
        expect(response.data[0]).to.have.property("price");
      }
    });

    it("should filter products by category", async function () {
      const category = "electronics";
      const response = await axios.get(
        `${BASE_URL}/products?category=${category}`,
        { headers }
      );

      expect(response.status).to.equal(200);
      response.data.forEach((product) => {
        expect(product.category).to.equal(category);
      });
    });
  });

  describe("POST /products", function () {
    it("should create a new product", async function () {
      const newProduct = {
        name: "Test Product",
        description: "A product created in a test",
        price: 19.99,
        category: "test",
      };

      const response = await axios.post(`${BASE_URL}/products`, newProduct, {
        headers,
      });

      expect(response.status).to.equal(201);
      expect(response.data).to.have.property("id");
      expect(response.data.name).to.equal(newProduct.name);
      expect(response.data.price).to.equal(newProduct.price);
    });

    it("should return 400 for invalid product data", async function () {
      const invalidProduct = {
        // Missing required name field
        description: "An invalid product",
        price: "not-a-number", // Invalid price format
      };

      try {
        await axios.post(`${BASE_URL}/products`, invalidProduct, { headers });
        // If we get here, the request didn't fail as expected
        expect.fail("Request should have failed with 400");
      } catch (error) {
        expect(error.response.status).to.equal(400);
        expect(error.response.data).to.have.property("errors");
      }
    });
  });

  describe("GET /products/:id", function () {
    it("should fetch a specific product by ID", async function () {
      // Assume product ID 1 exists
      const productId = 1;
      const response = await axios.get(`${BASE_URL}/products/${productId}`, {
        headers,
      });

      expect(response.status).to.equal(200);
      expect(response.data).to.have.property("id", productId);
    });

    it("should return 404 for non-existent product ID", async function () {
      const nonExistentId = 9999999;

      try {
        await axios.get(`${BASE_URL}/products/${nonExistentId}`, { headers });
        // If we get here, the request didn't fail as expected
        expect.fail("Request should have failed with 404");
      } catch (error) {
        expect(error.response.status).to.equal(404);
      }
    });
  });
});
```

## Using Chai-HTTP Example

Here's an example using Chai-HTTP instead of Axios:

```javascript
const chai = require("chai");
const chaiHttp = require("chai-http");
const expect = chai.expect;

chai.use(chaiHttp);

const BASE_URL = "https://api.example.com";

// Credentials for testing
const TEST_CREDENTIALS = {
  username: "test_user@example.com",
  password: "SecurePassword123!",
};

describe("User API with Chai-HTTP", function () {
  let authToken;

  before(function (done) {
    chai
      .request(BASE_URL)
      .post("/auth/login")
      .send(TEST_CREDENTIALS)
      .end(function (err, res) {
        expect(res).to.have.status(200);
        authToken = res.body.token;
        done();
      });
  });

  describe("GET /users", function () {
    it("should get all users", function (done) {
      chai
        .request(BASE_URL)
        .get("/users")
        .set("Authorization", `Bearer ${authToken}`)
        .end(function (err, res) {
          expect(res).to.have.status(200);
          expect(res.body).to.be.an("array");
          done();
        });
    });

    it("should get user by ID", function (done) {
      const userId = 1;
      chai
        .request(BASE_URL)
        .get(`/users/${userId}`)
        .set("Authorization", `Bearer ${authToken}`)
        .end(function (err, res) {
          expect(res).to.have.status(200);
          expect(res.body).to.have.property("id", userId);
          done();
        });
    });
  });
});
```

## Running the Tests

Execute the tests with the following command:

```bash
npm run test                # Run tests
npm run test:coverage       # Run tests with coverage
```

## Best Practices

1. **Keep credentials secure**: Never commit real credentials to your repository.
2. **Use environment variables**: Store API base URLs and other configuration in environment variables.
3. **Clean up after tests**: If your tests create resources, consider adding cleanup code in `after` or `afterEach` hooks.
4. **Test error scenarios**: Don't just test the happy path; test error conditions too.
5. **Validate response schemas**: Use Chai plugins like `chai-json-schema` to validate response structures.
6. **Keep tests focused**: Each test should verify one specific aspect of functionality.
7. **Maintain test independence**: Tests should not depend on each other's state.
8. **Use timeouts appropriately**: Adjust Mocha's timeout for longer-running tests.

## Troubleshooting Common Issues

- **Authentication failures**: Verify the login endpoint and credentials.
- **Timeout errors**: Use Mocha's `--timeout` flag or `this.timeout()` inside tests for longer operations.
- **Data inconsistencies**: Remember that other processes might be modifying the data; focus on structure validation rather than exact content.
- **Assertion errors**: Double-check your Chai assertions and the actual vs. expected values.
- **CORS issues**: These should not affect automated tests but may need special handling in some environments.

## Hooks Reference

Mocha provides several hooks for test setup and teardown:

- `before()`: Run once before all tests
- `beforeEach()`: Run before each test
- `after()`: Run once after all tests
- `afterEach()`: Run after each test

Example usage:

```javascript
describe("API Resource", function () {
  before(function () {
    // Run once before all tests in this block
    // Setup authentication, etc.
  });

  beforeEach(function () {
    // Run before each test in this block
    // Setup test data
  });

  afterEach(function () {
    // Run after each test in this block
    // Clean up test data
  });

  after(function () {
    // Run once after all tests in this block
    // Cleanup resources
  });

  // Test cases...
});
```
