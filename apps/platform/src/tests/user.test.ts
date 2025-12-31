/* eslint-disable @typescript-eslint/no-explicit-any */
import app from "@/server.js"
import { expect, it, describe, beforeAll, afterAll } from "vitest"
import { db } from "@/common/infrastructure/database/index.js"
import env from "@/config/env.js"
import { createToken } from "./utils/auth.js"

beforeAll(() => {})

describe("get user list", () => {
  it("should return user list", async () => {
    // generate token
    const token = createToken(env.WORKSPACE_ID)

    // profile
    const resp = (await app.request("/users", {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })) as any

    const body = await resp.json()

    // assert profile response
    expect(body).toHaveProperty("list")
    expect(resp.status).toBe(200)
  })

  it("should reject for invalid workspace ID", async () => {
    // generate token
    const token = createToken(999)

    // profile
    const resp = (await app.request("/users", {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })) as any

    const body = await resp.json()

    expect(body).toHaveProperty("message")
    expect(resp.status).toBe(403)
  })
})

afterAll(async () => {
  await db.destroy()
})
