import { Context } from "hono"

export class ReligionRepository {
  async getReligionStreamData(c: Context) {
    return c.var.trx
      .selectFrom("religions")
      .where("religions.deleted_at", "is", null)
      .select(["religions.id", "religions.title as name"])
      .orderBy("religions.id", "asc")
      .stream()
  }
}
