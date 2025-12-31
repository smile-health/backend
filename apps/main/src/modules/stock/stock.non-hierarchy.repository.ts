import { Context } from "vm"
import { StockRepository } from "./stock.repository.js"
import { GetStockDetailsQueries } from "./stock.schema.js"
import { sql } from "kysely"

export class StockNonHierarchyRepository extends StockRepository {
  constructor() {
    super()
  }

  async findDetails(c: Context, params: GetStockDetailsQueries) {
    return await c.var.trx
      .selectFrom("ws_materials as ma")
      .innerJoin(
        "ws_entity_material_activities as ema",
        "ma.id",
        "ema.material_id"
      )
      .leftJoin("ws_stocks as s", (join) =>
        join
          .onRef("s.entity_id", "=", "ema.entity_id")
          .onRef("s.material_id", "=", "ma.id")
          .onRef("s.activity_id", "=", "ema.activity_id")
          .on("s.deleted_at", "is", null)
      )
      .leftJoin("ws_batches as b", "s.batch_id", "b.id")
      .leftJoin("ws_manufactures as m", "m.id", "b.manufacture_id")
      .leftJoin("ws_budget_sources as bs", "bs.id", "s.budget_source_id")
      .selectAll("s")
      .select([
        "ema.entity_id",
        "ma.id as material_id",
        "ema.activity_id",
        sql<number>`qty * price`.as("total_price"),
        sql`coalesce(ema.min, 0)`.as("min"),
        sql`coalesce(ema.max, 0)`.as("max"),
        sql`qty - allocated_qty`.as("available_qty"),
        sql`if(b.id is null, null, json_object(
          'id', b.id,
          'code', b.code,
          'production_date', b.production_date,
          'expired_date', b.expired_date,
          'manufacture', json_object(
            'id', m.id,
            'name', m.name,
            'address', m.address
          )
        ))`.as("batch"),
        sql`if(bs.id is null, null, json_object(
          'id', bs.id,
          'name', bs.name
        ))`.as("budget_source"),
      ])
      .where("ema.entity_id", "=", params.entity_id)
      .$if(!params.material_ids, (qb) =>
        qb.where(
          "ma.id",
          "=",
          params.material_id ?? 0
        )
      )
      .$if(!!params.activity_id, (qb) =>
        qb.where("ema.activity_id", "=", params.activity_id ?? 0)
      )
      .$if(!!params.only_have_qty, (qb) => qb.where("s.qty", ">", 0))
      .$if(!!params.expired_start_date, (qb) =>
        qb.where((eb) =>
          eb.or([
            eb(
              "b.expired_date",
              ">=",
              (params.expired_start_date as unknown as Date) ?? null
            ),
            eb("b.expired_date", "is", null),
          ])
        )
      )
      .$if(!!params.expired_end_date, (qb) =>
        qb.where((eb) =>
          eb.or([
            eb(
              "b.expired_date",
              "<=",
              (params.expired_end_date as unknown as Date) ?? null
            ),
            eb("b.expired_date", "is", null),
          ])
        )
      )
      .$if(!!params.batch_ids && params.batch_ids.length > 0, (qb) =>
        qb.where("s.batch_id", "in", params.batch_ids ?? [-1])
      )
      .$if(!!params.stock_ids && params.stock_ids.length > 0, (qb) =>
        qb.where("s.id", "in", params.stock_ids ?? [-1])
      )
      .$if(!!params.material_ids && params.material_ids.length > 0, (qb) =>
        qb.where("m.id", "in", params.material_ids ?? [-1])
      )
      .where("ema.deleted_at", "is", null)
      .where("ma.deleted_at", "is", null)
      .distinct()
      .execute()
  }
}
