import { faker } from "@faker-js/faker"
import { db } from "@/common/infrastructure/database/index.js"

export async function createUser() {
  const user = {
    token_login: faker.internet.password(),
  }
  const result = await db.insertInto("users").values(user).executeTakeFirst()

  return { ...user, id: Number(result.insertId) }
}
