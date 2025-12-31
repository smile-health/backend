import { expect } from "chai"
import { describe, it } from "vitest"
import axios, { AxiosError } from "axios"
import { StatusCodes } from "http-status-codes"

import { BASE_HEADER_AUTH, BASE_URL_AUTH } from "../../utils/global-setup.js"

interface ErrorResponse {
  error?: string
  authDetails?: {
    access_token: string
  }
}

describe("Auth API Tests", () => {
  const LOGIN_URL = `${BASE_URL_AUTH}/auth/login`
  const DEFAULT_CREDS = new URLSearchParams({
    username: "arya12",
    password: "Smile12*",
    fcm_token: "",
  }).toString()

  describe("POST /auth/login", () => {
    it("should return token with valid credentials", async () => {
      let response
      try {
        response = await axios.post<ErrorResponse>(LOGIN_URL, DEFAULT_CREDS, {
          headers: BASE_HEADER_AUTH,
        })
      } catch (err) {
        const error = err as AxiosError<ErrorResponse>
        throw error
      }

      expect(response.status).to.equal(StatusCodes.OK)
      expect(response.data).to.have.property("authDetails")
      expect(response.data.authDetails).to.be.a("object")
      expect(response.data.authDetails).to.have.property("access_token")
      expect(response.data.authDetails.access_token).to.be.a("string")
    })

    it("should return 401 with invalid credentials", async () => {
      let response
      try {
        response = await axios.post<ErrorResponse>(
          LOGIN_URL,
          new URLSearchParams({
            username: "wrong",
            password: "wrong",
            fcm_token: "",
          }).toString(),
          { headers: BASE_HEADER_AUTH }
        )
      } catch (err) {
        const error = err as AxiosError<ErrorResponse>
        response = error.response
      }

      expect(response.status).to.equal(StatusCodes.UNAUTHORIZED)
      expect(response.data).to.have.property("message")
    })

    it("should return 400 with missing fields", async () => {
      let response
      try {
        response = await axios.post<ErrorResponse>(
          LOGIN_URL,
          new URLSearchParams({
            username: "admin",
            password: "",
            fcm_token: "",
          }).toString(),
          { headers: BASE_HEADER_AUTH }
        )
      } catch (err) {
        const error = err as AxiosError<ErrorResponse>
        response = error.response
      }

      expect(response.status).to.equal(StatusCodes.BAD_REQUEST)
      expect(response.data).to.have.property("message")
    })
  })
})
