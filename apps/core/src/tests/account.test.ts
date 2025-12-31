/* eslint-disable @typescript-eslint/no-explicit-any */
import app from "@/server.js"
import { expect, it, describe, beforeAll, afterAll } from "vitest"
import { db } from "@/common/infrastructure/database/index.js"
import { createUsers } from "./seeders/users.js"

beforeAll(() => {})

describe("authentication", () => {
  it("should successfully login with valid credentials", async () => {
    // arrange
    const user = await createUsers()

    // act
    // Using fetch-style API for Hono testing
    const loginResponse = await app.fetch("/account/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        username: user.username,
        password: user.password,
      }),
    })

    console.log(loginResponse)

    const loginBody = (await loginResponse.json()) as any

    // assert
    expect(loginBody).toHaveProperty("token")

    // profile
    const workspaceResponse = await app.fetch("/account/workspaces", {
      method: "GET",
      headers: {
        Authorization: `Bearer ${loginBody.token}`,
      },
    })

    const workspaceBody = await workspaceResponse.json()

    // assert profile response
    expect(workspaceBody).toHaveProperty("workspaces")
    expect(workspaceResponse.status).toBe(200)
  })

  it("should reject login with invalid credentials", async () => {
    const response = await app.fetch("/account/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        username: "invalid@example.com",
        password: "Password123*",
      }),
    })

    const body = await response.json()

    expect(body).toHaveProperty("message")
    expect(response.status).toBe(401)
  })
})

afterAll(async () => {
  await db.destroy()
})
