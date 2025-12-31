import { DB } from "@/common/infrastructure/database/types/db.js"
import { Context } from "@smile/lib/types/context.js"
import { GetProtocolQueries } from "./protocol.schema.js"

export class ProtocolRepository {
  async findAll(c: Context<DB>, param: GetProtocolQueries) {
    const { page, paginate, keyword, program_id } = param
    let query = c.var.trx
      .selectFrom("protocols as p")
      .selectAll("p")
      .orderBy("p.id")

    if (program_id) {
      query = query.innerJoin("protocol_programs as pp", (eb) =>
        eb
          .onRef("pp.protocol_id", "=", "p.id")
          .on("pp.program_id", "=", Number(program_id))
      )
    }

    if (keyword) query = query.where("p.name", "like", `%${keyword}%`)

    if (paginate && page) {
      const offset = (page - 1) * paginate
      query = query.limit(paginate).offset(offset)
    }

    const [data, count] = await Promise.all([
      query.execute(),
      query
        .clearSelect()
        .clearOrderBy()
        .select(c.var.trx.fn.count("id").as("total"))
        .executeTakeFirstOrThrow(),
    ])

    return {
      data,
      total: count ? Number(count.total) : 0,
    }
  }
}
