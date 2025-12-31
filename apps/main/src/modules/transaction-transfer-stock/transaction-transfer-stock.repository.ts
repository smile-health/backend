import { Context } from "hono"
import { BaseRepository } from "../base.repository.js"

export class TransactionTransferStockRepository extends BaseRepository<"ws_transactions"> {
  constructor() {
    super("ws_transactions", false)
  }

  async getListStockBatch(c: Context, listStockID: number[]) {
    const list = await c.var.trx
      .selectFrom("ws_stocks as wss")
      .leftJoin("ws_batches as wsb", "wsb.id", "wss.batch_id")
      .leftJoin("ws_materials as wsm", "wsm.id", "wss.material_id")
      .select([
        "wss.id as stock_id",
        "wss.qty",
        "wss.activity_id",
        "wss.price",
        "wsb.code as batch_code",
        "wsb.expired_date as batch_expired_date",
        "wsb.production_date as batch_production_date",
        "wsm.consumption_unit_per_distribution_unit",
      ])
      .where("wss.id", "in", listStockID)
      .where("wsb.deleted_at", "is", null)
      .where("wss.deleted_at", "is", null)
      .execute()

    return list
  }

  async findStockMaterial(
    c: Context,
    materialId: number,
    entityId: number,
    activityId: number,
    batchCode: string | null
  ) {
    return c.var.trx
      .selectFrom("ws_stocks as wss")
      .leftJoin("ws_batches as wsb", "wsb.id", "wss.batch_id")
      .where("wss.material_id", "=", materialId)
      .where("wss.entity_id", "=", entityId)
      .where("wss.activity_id", "=", activityId)
      .$if(!!batchCode, (qb) => qb.where("wsb.code", "=", batchCode))
      .where("wsb.deleted_at", "is", null)
      .where("wss.deleted_at", "is", null)
      .select([
        "wss.id as stock_id",
        "wss.qty",
        "wsb.code as batch_code",
        "wss.activity_id",
      ])
      .executeTakeFirst()
  }

  async getListGlobalMaterial(
    c: Context,
    listMaterialID: number[],
    companionProgramId: number
  ) {
    return c.var.trx
      .with("materials", (db) =>
        db
          .selectFrom("ws_materials as wsm")
          .where("wsm.id", "in", listMaterialID)
          .where("wsm.deleted_at", "is", null)
          .select([
            "wsm.id as material_id_source",
            "wsm.parent_id as parent_material_id_source",
            "wsm.global_id as global_material_id",
          ])
      )
      .selectFrom("materials as m")
      .innerJoin("ws_materials as wsm", (join) =>
        join.onRef("m.global_material_id", "=", "wsm.global_id")
      )
      .where("wsm.program_id", "=", companionProgramId)
      .where("wsm.deleted_at", "is", null)
      .select([
        "m.material_id_source",
        "m.parent_material_id_source",
        "wsm.id as material_id_companion",
        "wsm.parent_id as parent_material_id_companion",
      ])
      .execute()
  }

  async findGlobalEntity(
    c: Context,
    entityID: number,
    companionProgramId: number
  ) {
    return c.var.trx
      .with("entity", (db) =>
        db
          .selectFrom("ws_entities as wse")
          .where("wse.id", "=", entityID)
          .where("wse.deleted_at", "is", null)
          .where("wse.status", "=", 1)
          .select([
            "wse.id as entity_id_source",
            "wse.global_id as global_entity_id",
          ])
      )
      .selectFrom("entity as e")
      .innerJoin("ws_entities as wse", (join) =>
        join.onRef("e.global_entity_id", "=", "wse.global_id")
      )
      .where("wse.program_id", "=", companionProgramId)
      .where("wse.deleted_at", "is", null)
      .where("wse.status", "=", 1)
      .select(["e.entity_id_source", "wse.id as entity_id_companion"])
      .executeTakeFirst()
  }

  async getListGlobalManufacture(c: Context, listStockID: number[]) {
    return c.var.trx
      .with("manufactures_global", (db) =>
        db
          .selectFrom("ws_stocks as wss")
          .where("wss.id", "in", listStockID)
          .where("wss.deleted_at", "is", null)
          .innerJoin("ws_batches as wsb", "wss.batch_id", "wsb.id")
          .innerJoin("ws_manufactures as wsm", (join) =>
            join
              .onRef("wsm.id", "=", "wsb.manufacture_id")
              .on("wsm.deleted_at", "is", null)
              .on("wsm.status", "=", 1)
          )
          .select([
            "wss.id as stock_id",
            "wsm.id as manufacture_id_source",
            "wsm.global_id as global_manufacture_id",
          ])
      )
      .selectFrom("manufactures_global as mg")
      .innerJoin(
        "ws_manufactures as wsm",
        "wsm.global_id",
        "mg.global_manufacture_id"
      )
      .where("wsm.deleted_at", "is", null)
      .where("wsm.status", "=", 1)
      .select([
        "mg.stock_id",
        "mg.manufacture_id_source",
        "wsm.global_id as manufacture_id_companion",
      ])
      .execute()
  }

  async getListGlobalBudgetSource(c: Context, listStockID: number[]) {
    return c.var.trx
      .with("budget_source_global", (db) =>
        db
          .selectFrom("ws_stocks as wss")
          .where("wss.id", "in", listStockID)
          .where("wss.deleted_at", "is", null)
          .innerJoin("ws_budget_sources as wsbs", (join) =>
            join
              .onRef("wsbs.id", "=", "wss.budget_source_id")
              .on("wsbs.deleted_at", "is", null)
              .on("wsbs.status", "=", 1)
          )
          .select([
            "wss.id as stock_id",
            "wsbs.id as budget_source_id_source",
            "wsbs.global_id as global_budget_source_id",
          ])
      )
      .selectFrom("budget_source_global as bsg")
      .innerJoin(
        "ws_budget_sources as wsbs",
        "wsbs.global_id",
        "bsg.global_budget_source_id"
      )
      .where("wsbs.deleted_at", "is", null)
      .where("wsbs.status", "=", 1)
      .select([
        "bsg.stock_id",
        "bsg.budget_source_id_source",
        "wsbs.global_id as budget_source_id_companion",
      ])
      .execute()
  }

  async createManufactureWorkspace(
    c: Context,
    companionProgramId: number,
    companionManufactureId: number
  ) {
    const { userId } = c.var
    const result = await c.var.trx
      .selectFrom("manufacture_workspaces")
      .where("manufacture_id", "=", companionManufactureId)
      .where("workspace_id", "=", companionProgramId)
      .select(["id"])
      .executeTakeFirst()

    if (!result) {
      const res = await c.var.trx
        .insertInto("manufacture_workspaces")
        .values({
          manufacture_id: companionManufactureId,
          workspace_id: companionProgramId,
          updated_by: userId,
        })
        .executeTakeFirst()

      return Number(res.insertId)
    }

    return result.id
  }

  async createBudgetSourceWorkspace(
    c: Context,
    companionProgramId: number,
    companionBudgetSourceId: number
  ) {
    const result = await c.var.trx
      .selectFrom("budget_source_workspaces")
      .where("budget_source_id", "=", companionBudgetSourceId)
      .where("workspace_id", "=", companionProgramId)
      .select(["id"])
      .executeTakeFirst()

    if (!result) {
      const res = await c.var.trx
        .insertInto("budget_source_workspaces")
        .values({
          budget_source_id: companionBudgetSourceId,
          workspace_id: companionProgramId,
        })
        .executeTakeFirst()

      return Number(res.insertId)
    }

    return result.id
  }

  async createMaterialManufacture(
    c: Context,
    companionMaterialId: number,
    companionManufactureId: number | null
  ) {
    if (companionManufactureId !== null) {
      const result = await c.var.trx
        .selectFrom("ws_material_manufactures")
        .where("material_id", "=", companionMaterialId)
        .where("manufacture_id", "=", companionManufactureId)
        .select(["id"])
        .executeTakeFirst()

      if (!result) {
        await c.var.trx
          .insertInto("ws_material_manufactures")
          .values({
            material_id: companionMaterialId,
            manufacture_id: companionManufactureId,
          })
          .executeTakeFirst()
      }
    }
  }
}
