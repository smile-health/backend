import { Context } from "hono"

export class EducationRepository {
  async getEducationStreamData(c: Context) {
    return c.var.trx
      .selectFrom("educations")
      .where("educations.deleted_at", "is", null)
      .select(["educations.id", "educations.title as name"])
      .orderBy("educations.id", "asc")
      .stream()
  }
}
