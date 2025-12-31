import axios, { AxiosRequestConfig, AxiosResponse } from "axios"
import { expect } from "chai"

// Base URL for API requests
const BASE_URL = process.env.API_BASE_URL || "http://localhost:3000"

// Authentication credentials for testing
const TEST_USERNAME = process.env.TEST_USERNAME || "testuser"
const TEST_PASSWORD = process.env.TEST_PASSWORD || "password"

// Interfaces
interface AuthResponse {
  authDetails: {
    access_token: string
    refresh_token?: string
    expires_in?: number
  }
}

/**
 * Authenticates a test user and returns the access token
 */
export async function authenticate(): Promise<string> {
  const response = await axios({
    url: `${BASE_URL}/auth/login`,
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "Device-Type": "web",
    },
    data: new URLSearchParams({
      username: TEST_USERNAME,
      password: TEST_PASSWORD,
    }),
  })

  const responseData = response.data as AuthResponse
  expect(responseData.authDetails).to.have.property("access_token")
  return responseData.authDetails.access_token
}

/**
 * Makes an authenticated API request
 */
export async function makeAuthenticatedRequest(
  path: string,
  method: string = "GET",
  data: any = null,
  token: string | null = null
): Promise<AxiosResponse> {
  if (!token) {
    token = await authenticate()
  }

  const config: AxiosRequestConfig = {
    url: `${BASE_URL}${path}`,
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  }

  if (data) {
    config.data = data
  }

  return axios(config)
}

/**
 * Test response validation helpers
 */
export const validateResponseStatus = (
  response: AxiosResponse,
  expectedStatus: number
) => {
  expect(response.status).to.equal(expectedStatus)
}

export const validateJsonResponse = (response: AxiosResponse) => {
  expect(response.headers["content-type"]).to.include("application/json")
}
