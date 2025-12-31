import { expect } from "chai"
import axios from "axios"
import { before, describe, it } from "mocha"
import {
  makeAuthenticatedRequest,
  authenticate,
  validateResponseStatus,
  validateJsonResponse,
} from "../utils/test-utils"

// Define the Mocha context type
interface MochaContext {
  accessToken?: string;
  // Add any other properties you use with 'this' in your tests
}

const BASE_URL = process.env.API_BASE_URL || "http://localhost:3000"

describe("Authentication API", () => {
  describe("POST /auth/login", function() {
    it("should return access token with valid credentials", async function() {
      const response = await axios({
        url: `${BASE_URL}/auth/login`,
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "Device-Type": "web",
        },
        data: new URLSearchParams({
          username: process.env.TEST_USERNAME || "testuser",
          password: process.env.TEST_PASSWORD || "password",
        }),
      })

      validateResponseStatus(response, 200)
      validateJsonResponse(response)

      expect(response.data).to.have.property("authDetails")
      expect(response.data.authDetails).to.have.property("access_token")
      expect(response.data.authDetails.access_token).to.be.a("string")
    })

    it("should reject invalid credentials", async function() {
      try {
        await axios({
          url: `${BASE_URL}/auth/login`,
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            "Device-Type": "web",
          },
          data: new URLSearchParams({
            username: "invaliduser",
            password: "invalidpassword",
          }),
        })

        // If we reach here, the request did not fail as expected
        expect.fail("Request should have failed with 401")
      } catch (error: any) {
        expect(error.response.status).to.equal(401)
      }
    })
  })

  describe("Authentication Token Usage", function() {
    let accessToken: string

    before(async function(this: MochaContext) {
      accessToken = await authenticate()
      this.accessToken = accessToken
    })

    it("should access protected endpoint with valid token", async function() {
      const response = await makeAuthenticatedRequest(
        "/some-protected-endpoint",
        "GET",
        null,
        accessToken
      )
      validateResponseStatus(response, 200)
    })

    it("should reject requests with invalid token", async function() {
      try {
        await axios({
          url: `${BASE_URL}/some-protected-endpoint`,
          method: "GET",
          headers: {
            Authorization: "Bearer invalid-token",
            "Content-Type": "application/json",
          },
        })

        // If we reach here, the request did not fail as expected
        expect.fail("Request should have failed with 401")
      } catch (error: any) {
        expect(error.response.status).to.equal(401)
      }
    })

    // Test for token refresh if applicable
    it("should be able to refresh an expired token", async function () {
      // This test might need to be skipped if token refresh isn't implemented
      this.skip()

      // Implementation would typically:
      // 1. Get a token
      // 2. Wait for it to expire or mock expiration
      // 3. Attempt to refresh
      // 4. Verify the new token works
    })
  })
})
