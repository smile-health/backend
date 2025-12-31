import app from "@/server.js"
import { faker } from "@faker-js/faker"
import { expect, it, describe, beforeAll, afterAll } from "vitest"
import { db } from "@/common/infrastructure/database/index.js"
import { TCreateUserReq } from "@/modules/user/user.schema.js"
import { createToken } from "./utils/auth.js"
import { createUsers } from "./seeders/users.js"

beforeAll(() => {})

describe("create users", () => {
  it("should successfully create users with valid credentials", async () => {
    const decryptPass = faker.internet.password({ length: 8 })
    const create: Partial<TCreateUserReq> = {
      username: faker.internet.userName(),
      password: decryptPass,
      email: faker.internet.email(),
      address: faker.location.street(),
      firstname: faker.person.firstName(),
      lastname: faker.person.lastName(),
      gender: 1,
      date_of_birth: faker.date.birthdate(),
      mobile_phone: faker.phone.number(),
    }

    const response = await app.request("/users", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${createToken()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(create),
    })

    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data).toHaveProperty("id")
  })

  it("should reject create users with invalid request", async () => {
    const decryptPass = faker.internet.password({ length: 8 })
    const create: Partial<TCreateUserReq> = {
      username: faker.internet.userName(),
      password: decryptPass,
      email: "faker.internet.email()",
      address: faker.location.street(),
      firstname: faker.person.firstName(),
      lastname: faker.person.lastName(),
      gender: 1,
      date_of_birth: faker.date.birthdate(),
      mobile_phone: faker.phone.number(),
    }

    const response = await app.request("/users", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${createToken()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(create),
    })

    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data).toHaveProperty("error")
  })

  it("should reject create users with invalid email already used", async () => {
    await createUsers()

    const decryptPass = faker.internet.password({ length: 8 })
    const create: Partial<TCreateUserReq> = {
      username: faker.internet.userName(),
      password: decryptPass,
      email: "babal@test.com",
      address: faker.location.street(),
      firstname: faker.person.firstName(),
      lastname: faker.person.lastName(),
      gender: 1,
      date_of_birth: faker.date.birthdate(),
      mobile_phone: faker.phone.number(),
    }

    const response = await app.request("/users", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${createToken()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(create),
    })

    const data = await response.json()

    expect(response.status).toBe(401)
    expect(data).toHaveProperty("message")
  })
})

describe("detail users", () => {
  it("should successfully get detail user", async () => {})
})

afterAll(async () => {
  await db.destroy()
})
