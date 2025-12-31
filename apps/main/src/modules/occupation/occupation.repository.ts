import { Context } from "hono"

export class OccupationRepository {
  async getOccupationStreamData(c: Context) {
    return c.var.trx
      .selectFrom("occupations")
      .where("occupations.deleted_at", "is", null)
      .select(["occupations.id", "occupations.title as name"])
      .orderBy("occupations.id", "asc")
      .stream()
  }
}
