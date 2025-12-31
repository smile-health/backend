import { IMMUNIZATION_PROGRAM_IDS } from "@/common/constants/common.js"
import { KFA_LEVEL_ID } from "@/common/constants/material.js"
import { ORDER_STATUS } from "@/common/constants/order.js"
import { DB } from "@/common/infrastructure/database/types/db.js"
import { associate, associateField, collect, group } from "@smile/lib/utils.js"
import { Context } from "hono"
import { Insertable, sql } from "kysely" // Import Insertable

export class BiofarmaRepository {
  public async upsertBiofarmaOrder(
    c: Context,
    order: Insertable<DB["integration_biofarma_orders"]>
  ) {
    return await c.var.trx
      .insertInto("integration_biofarma_orders")
      .values(order)
      .onDuplicateKeyUpdate(order)
      .execute()
  }

  public async insertBiofarmaOrders(
    c: Context,
    orders: Insertable<DB["integration_biofarma_orders"]>[]
  ) {
    if (orders.length === 0) {
      return
    }

    console.log(`insert ${orders.length} rows into integration_biofarma_orders`)

    return await c.var.trx
      .insertInto("integration_biofarma_orders")
      .values(orders)
      .onDuplicateKeyUpdate({
        exist_smile: sql`values(exist_smile)`,
        updated_at: new Date(),
      })
      .execute()
  }

  public async insertBiofarmaSmdvOrders(
    c: Context,
    orders: Insertable<DB["integration_biofarma_smdv_orders"]>[]
  ) {
    if (orders.length === 0) {
      return
    }
    return await c.var.trx
      .insertInto("integration_biofarma_smdv_orders")
      .values(orders)
      .onDuplicateKeyUpdate({ updated_at: new Date() })
      .execute()
  }

  public async getActivityIds(c: Context, programId: number) {
    const rows = await c.var.trx
      .selectFrom("ws_activities")
      .select("id")
      .where("program_id", "=", programId)
      .where("deleted_at", "is", null)
      .execute()

    return collect(rows, "id")
  }

  public async getMapOrderByNomorDO(c: Context, nomorDos: string[]) {
    if (nomorDos.length === 0) {
      return {}
    }

    const rows = await c.var.trx
      .selectFrom("ws_orders as o")
      .innerJoin("ws_activities as a", "a.id", "o.activity_id")
      .select([
        "o.id",
        "o.delivery_number",
        "o.order_status_id",
        "o.metadata",
        "a.program_id",
      ])
      .where("o.delivery_number", "in", nomorDos)
      .where("o.order_status_id", "not in", [ORDER_STATUS.CANCELED])
      .execute()

    return associate(rows, "delivery_number")
  }

  public async getMapEntityIdByCode(
    c: Context,
    entityCodes: string[],
    programIds = IMMUNIZATION_PROGRAM_IDS
  ) {
    if (entityCodes.length === 0) {
      return {}
    }

    const rows = await c.var.trx
      .selectFrom("ws_entities")
      .select(["id", "program_id", "code"])
      .where("code", "in", entityCodes)
      .where("program_id", "in", programIds)
      .where("deleted_at", "is", null)
      .execute()

    const mapByCode = group(rows, "code")

    return Object.entries(mapByCode).reduce(
      (acc, [code, rows]) => {
        acc[code] = associateField(rows, "program_id", "id")
        return acc
      },
      {} as Record<string, Record<number, number>>
    )
  }

  public async getMapBudgetSourceByProgramId(c: Context, title = "APBN") {
    const rows = await c.var.trx
      .selectFrom("ws_budget_sources")
      .select(["id", "program_id"])
      .where("name", "=", title)
      .where("deleted_at", "is", null)
      .execute()

    return associateField(rows, "program_id", "id")
  }

  public async getMapActivityByProgramId(
    c: Context,
    programIds = IMMUNIZATION_PROGRAM_IDS
  ) {
    const rows = await c.var.trx
      .selectFrom("ws_activities")
      .select(["id", "program_id"])
      .where("program_id", "in", programIds)
      .where("deleted_at", "is", null)
      .orderBy("id", "desc")
      .execute()

    return associateField(rows, "program_id", "id")
  }

  public async getMapMaterialByCode(c: Context, materialCodes: string[]) {
    if (materialCodes.length === 0) {
      return {}
    }

    const rows = await c.var.trx
      .selectFrom("ws_materials as m")
      .leftJoin("ws_material_activities as ma", "ma.material_id", "m.id")
      .select([
        "m.id",
        "m.code",
        sql<number>`MAX(m.program_id)`.as("program_id"),
        "consumption_unit_per_distribution_unit as pieces_per_unit",
      ])
      .select(sql<string>`GROUP_CONCAT(ma.activity_id)`.as("activity_ids"))
      .where("m.code", "in", materialCodes)
      .where("m.material_level_id", "=", KFA_LEVEL_ID.VARIANT)
      .where("m.deleted_at", "is", null)
      .groupBy("m.code")
      .execute()

    return associate(
      rows.map((row) => ({
        ...row,
        activity_ids: row.activity_ids
          ? row.activity_ids.split(",").map(Number)
          : [],
      })),
      "code"
    )
  }

  public async updateOrderMetadata(c: Context, id: number, metadata: object) {
    return await c.var.trx
      .updateTable("ws_orders")
      .set({ metadata: JSON.stringify(metadata) })
      .where("id", "=", id)
      .execute()
  }
}
