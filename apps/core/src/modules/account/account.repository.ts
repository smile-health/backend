import { Context } from "hono"
import { sql } from "kysely"
import { LoginAttemptDto } from "./account.schema.js"

export class AccountRepository {
  async findByID(c: Context, id: number) {
    const result = await c.var.trx
      .selectFrom("users")
      .where("id", "=", id)
      .selectAll()
      .executeTakeFirstOrThrow()

    return result
  }

  async createLoginAttempt(c: Context, data: LoginAttemptDto) {
    const result = await c.var.trx
      .insertInto("login_attempts")
      .values(data)
      .executeTakeFirst()
    return result
  }

  async updateLoginAttempt(c: Context, data: LoginAttemptDto) {
    const result = await c.var.trx
      .updateTable("login_attempts")
      .set(data)
      .where("ip", "=", data.ip ?? "-")
      .executeTakeFirst()
    return result
  }

  async updateLoginAttemptStatic(c: Context, ip: string) {
    const result = await c.var.trx
      .updateTable("login_attempts")
      .set({
        hit: sql`hit + 1`,
        last_attempt: sql`NOW()`,
      })
      .where("ip", "=", ip)
      .executeTakeFirst()
    return result
  }

  async findIpLoginAttempt(c: Context, ip: string) {
    const result = await c.var.trx
      .selectFrom("login_attempts")
      .select(["ip", "hit", "last_attempt"])
      .where("ip", "=", ip)
      .executeTakeFirst()
    return result
  }
}
