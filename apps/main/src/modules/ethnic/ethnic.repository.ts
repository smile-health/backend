import { Context } from "hono"

export class EthnicRepository {
  async getEthnicStreamData(c: Context) {
    return c.var.trx
      .selectFrom("ethnics")
      .where("ethnics.deleted_at", "is", null)
      .select(["ethnics.id", "ethnics.title as name"])
      .orderBy("ethnics.id", "asc")
      .stream()
  }
}
