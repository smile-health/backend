import { db } from "@/common/infrastructure/database/index.js"
import { faker } from "@faker-js/faker"
import bcrypt from "bcrypt"

export async function createUsers() {
  const user = {
    username: faker.internet.userName(),
    password: faker.internet.password({ length: 8 }),
    email: faker.internet.email(),
    address: faker.location.street(),
    firstname: faker.person.firstName(),
    lastname: faker.person.lastName(),
    gender: 1,
    date_of_birth: faker.date.birthdate(),
    mobile_phone: faker.phone.number(),
  }
  const result = await db
    .insertInto("users")
    .values({
      ...user,
      password: await bcrypt.hash(user.password, 10),
    })
    .executeTakeFirst()

  return { ...user, id: Number(result.insertId) }
}
