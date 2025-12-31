import { Context } from "hono"
import { BaseRepository } from "../base.repository"
import { ASSET_CLASSIFICATION } from "@/common/constants/assets"
import { sql } from "kysely"
import { GetColdstorageListQuery } from "./coldstorage.shcema"

export class ColdstorageRepository extends BaseRepository<"coldstorages"> {
  constructor() {
    super("coldstorages")
  }

  /**
   * CRITICAL: Get coldstorage with row lock to prevent concurrent modifications
   * This prevents race conditions when multiple requests try to update the same coldstorage
   */
  async findOneWithLock(c: Context, where: Partial<any>) {
    const conditions = Object.entries(where)
    let query = c.var.trx
      .selectFrom(this.tableName)
      .where("deleted_at", "is", null)

    for (const [key, value] of conditions) {
      query = query.where(key as any, "=", value)
    }

    return await query
      .selectAll()
      .forUpdate() // 🔒 Row-level lock
      .executeTakeFirst()
  }

  /**
   * CRITICAL: Get asset inventories WITH LOCK
   * Prevents asset data from being modified during calculation
   */
  async getCapacitiesAssetInventoryIsCCEByEntityIdWithLock(
    c: Context,
    entityId: number
  ) {
    const { trx } = c.var

    return await trx
      .selectFrom("asset_inventories as ai")
      .innerJoin("asset_models_temperatures_capacities as amtc", (join) =>
        join
          .onRef("ai.asset_model_temperature_capacity_id", "=", "amtc.id")
          .on("amtc.deleted_at", "is", null)
      )
      .innerJoin("asset_models as am", (join) =>
        join
          .onRef("amtc.asset_model_id", "=", "am.id")
          .on("am.deleted_at", "is", null)
      )
      .innerJoin("asset_types as at", (join) =>
        join
          .onRef("am.asset_type_id", "=", "at.id")
          .on("at.deleted_at", "is", null)
      )
      .innerJoin("asset_types_classifications as atc", (join) =>
        join
          .onRef("at.id", "=", "atc.asset_type_id")
          .on("atc.asset_classifications_id", "=", ASSET_CLASSIFICATION.CCE)
          .on("atc.deleted_at", "is", null)
      )
      .innerJoin("asset_types_temperatures as att", (join) =>
        join
          .onRef("amtc.asset_type_temperature_id", "=", "att.id")
          .on("att.deleted_at", "is", null)
      )
      .innerJoin("temperature_thresholds as tt", (join) =>
        join
          .onRef("att.temperature_threshold_id", "=", "tt.id")
          .on("tt.is_predefined", "=", 1)
          .on("tt.deleted_at", "is", null)
      )
      .where("ai.entity_id", "=", entityId)
      .where("ai.working_status_id", "=", 1)
      .where("ai.status", "=", 1)
      .where("ai.deleted_at", "is", null)
      .select([
        "ai.id as asset_inventory_id",
        "amtc.net_capacity",
        "amtc.gross_capacity",
        "tt.min_temperature",
        "tt.max_temperature",
        "att.id as asset_type_temperature_id",
        "tt.id as temperature_threshold_id", // opsional, tapi sering dibutuhkan
      ])
      .forUpdate() // 🔒 Mengunci baris di asset_inventories
      .execute()
  }

  async getRangeTemperature(c: Context) {
    return await c.var.trx
      .selectFrom("temperature_thresholds as tt")
      .where("tt.deleted_at", "is", null)
      .where("tt.is_predefined", "=", 1)
      .where("tt.min_temperature", "in", [-25, 2, -86])
      .where("tt.max_temperature", "in", [-15, 8, -40])
      .select([
        "tt.id as temperature_threshold_id",
        "tt.min_temperature",
        "tt.max_temperature",
      ])
      .execute()
  }

  /**
   * CRITICAL: Get entity material stock WITH LOCK
   * Prevents ws_stocks from being modified during calculation
   */
  async entityMaterialStockWithLock(
    c: Context,
    entityId: number,
    materialId: number,
    programId: number
  ) {
    return await c.var.trx
      .selectFrom("ws_materials as wsm")
      .innerJoin("ws_stocks as wss", (join) =>
        join
          .onRef("wsm.id", "=", "wss.material_id")
          .on("wss.deleted_at", "is", null)
      )
      .innerJoin("ws_entities as wse", (join) =>
        join
          .onRef("wse.id", "=", "wss.entity_id")
          .on("wse.deleted_at", "is", null)
          .on("wse.global_id", "=", entityId)
          .on("wse.program_id", "=", programId)
      )
      .where("wsm.id", "=", materialId)
      .where("wsm.deleted_at", "is", null)
      .where("wsm.program_id", "=", programId)
      .select([
        "wsm.id as material_id",
        "wsm.global_id as global_material_id",
        "wss.qty",
        "wse.id as entity_id",
        "wss.id as stock_id",
        "wss.manufacture_id",
        sql<number>`(
          SELECT SUM(ws2.qty) FROM ws_stocks as ws2
          WHERE ws2.deleted_at IS NULL
          AND ws2.entity_id = wss.entity_id
          AND ws2.parent_material_id = COALESCE(wsm.parent_id, wsm.id)
          FOR UPDATE
        )`.as("stock_on_hand"),
      ])
      .forUpdate() // 🔒 Lock ws_stocks rows - prevent modifications
      .execute()
  }

  /**
   * Get entity material stock WITHOUT lock (for backward compatibility)
   */
  async entityMaterialStock(
    c: Context,
    entityId: number,
    materialId: number,
    programId: number
  ) {
    return await c.var.trx
      .selectFrom("ws_materials as wsm")
      .innerJoin("ws_stocks as wss", (join) =>
        join
          .onRef("wsm.id", "=", "wss.material_id")
          .on("wss.deleted_at", "is", null)
      )
      .innerJoin("ws_entities as wse", (join) =>
        join
          .onRef("wse.id", "=", "wss.entity_id")
          .on("wse.deleted_at", "is", null)
          .on("wse.global_id", "=", entityId)
          .on("wse.program_id", "=", programId)
      )
      .where("wsm.id", "=", materialId)
      .where("wsm.deleted_at", "is", null)
      .where("wsm.program_id", "=", programId)
      .select([
        "wsm.id as material_id",
        "wsm.global_id as global_material_id",
        "wss.qty",
        "wse.id as entity_id",
        "wss.id as stock_id",
        "wss.manufacture_id",
        sql<number>`(
          SELECT SUM(ws2.qty) FROM ws_stocks as ws2
          WHERE ws2.deleted_at IS NULL
          AND ws2.entity_id = wss.entity_id
          AND ws2.parent_material_id = COALESCE(wsm.parent_id, wsm.id)
        )`.as("stock_on_hand"),
      ])
      .execute()
  }

  /**
   * CRITICAL: Get entity material activity WITH LOCK
   */
  async getEntityMaterialActivityWithLock(
    c: Context,
    materialId: number,
    entityId: number,
    programId: number
  ) {
    return await c.var.trx
      .selectFrom("ws_entity_material_activities as wema")
      .innerJoin("ws_entities as wse", (join) =>
        join
          .onRef("wema.entity_id", "=", "wse.id")
          .on("wse.global_id", "=", entityId)
          .on("wse.program_id", "=", programId)
          .on("wse.deleted_at", "is", null)
      )
      .innerJoin("ws_materials as wsm", (join) =>
        join
          .onRef("wema.material_id", "=", "wsm.id")
          .on("wsm.id", "=", materialId)
          .on("wsm.program_id", "=", programId)
          .on("wsm.deleted_at", "is", null)
      )
      .where("wema.material_id", "=", materialId)
      .where("wema.deleted_at", "is", null)
      .select([
        "wema.id as entity_material_activity_id",
        "wema.max",
        "wema.min",
      ])
      .groupBy("wema.activity_id")
      .forUpdate() // 🔒 Lock activity rows
      .execute()
  }

  /**
   * Get entity material activity WITHOUT lock (for backward compatibility)
   */
  async getEntityMaterialActivity(
    c: Context,
    materialId: number,
    entityId: number,
    programId: number
  ) {
    return await c.var.trx
      .selectFrom("ws_entity_material_activities as wema")
      .innerJoin("ws_entities as wse", (join) =>
        join
          .onRef("wema.entity_id", "=", "wse.id")
          .on("wse.global_id", "=", entityId)
          .on("wse.program_id", "=", programId)
          .on("wse.deleted_at", "is", null)
      )
      .innerJoin("ws_materials as wsm", (join) =>
        join
          .onRef("wema.material_id", "=", "wsm.id")
          .on("wsm.id", "=", materialId)
          .on("wsm.program_id", "=", programId)
          .on("wsm.deleted_at", "is", null)
      )
      .where("wema.material_id", "=", materialId)
      .where("wema.deleted_at", "is", null)
      .select([
        "wema.id as entity_material_activity_id",
        "wema.max",
        "wema.min",
      ])
      .groupBy("wema.activity_id")
      .execute()
  }

  async getMasterMaterialVolume(
    c: Context,
    materialId: number,
    manufactureId: number
  ) {
    return await c.var.trx
      .selectFrom("materials as m")
      .innerJoin("material_volumes as mv", (join) =>
        join
          .onRef("m.id", "=", "mv.material_id")
          .on("mv.deleted_at", "is", null)
      )
      .innerJoin("ws_manufactures as wm", (join) =>
        join
          .onRef("mv.manufacture_id", "=", "wm.global_id")
          .on("wm.deleted_at", "is", null)
          .on("wm.id", "=", manufactureId)
      )
      .where("m.id", "=", materialId)
      .select([
        "m.id as material_id",
        "m.consumption_unit_per_distribution_unit",
        "mv.box_length",
        "mv.box_width",
        "mv.box_height",
        "mv.unit_per_box",
      ])
      .executeTakeFirst()
  }

  async getMateriaVolumeLatest(
    c: Context,
    materialId: number,
    programId: number
  ) {
    return await c.var.trx
      .selectFrom("material_volumes as mv")
      .innerJoin("ws_materials as m", (join) =>
        join
          .onRef("mv.material_id", "=", "m.global_id")
          .on("m.deleted_at", "is", null)
          .on("m.id", "=", materialId)
          .on("m.program_id", "=", programId)
      )
      .where("mv.deleted_at", "is", null)
      .orderBy("mv.created_at", "desc")
      .select([
        "mv.id as material_volume_id",
        "mv.box_length",
        "mv.box_width",
        "mv.box_height",
        "mv.unit_per_box",
        "m.consumption_unit_per_distribution_unit",
      ])
      .executeTakeFirst()
  }

  /**
   * CRITICAL: Get coldstorage material with row lock
   * Prevents concurrent updates to the same material record
   */
  async getColdstorageMaterialByMaterialIdAndColdstorageIdWithLock(
    c: Context,
    materialId: number,
    coldstorageId: number
  ) {
    return await c.var.trx
      .selectFrom("coldstorage_materials as cm")
      .where("cm.material_id", "=", materialId)
      .where("cm.coldstorage_id", "=", coldstorageId)
      .where("cm.deleted_at", "is", null)
      .selectAll()
      .forUpdate() // 🔒 Row-level lock
      .executeTakeFirst()
  }

  async getColdstorageMaterialByMaterialIdAndColdstorageId(
    c: Context,
    materialId: number,
    coldstorageId: number
  ) {
    return await c.var.trx
      .selectFrom("coldstorage_materials as cm")
      .where("cm.material_id", "=", materialId)
      .where("cm.coldstorage_id", "=", coldstorageId)
      .where("cm.deleted_at", "is", null)
      .selectAll()
      .executeTakeFirst()
  }

  /**
   * CRITICAL: Get all coldstorage materials with row lock
   * Use this when you need to update multiple materials and prevent race conditions
   */
  async getColdstorageMaterialByEntityIdWithLock(c: Context, entityId: number) {
    return await c.var.trx
      .selectFrom("coldstorage_materials as cm")
      .innerJoin("ws_materials as wm", (join) =>
        join
          .onRef("cm.material_id", "=", "wm.id")
          .on("wm.deleted_at", "is", null)
      )
      .leftJoin("temperature_thresholds as tt", (join) =>
        join
          .onRef("wm.min_temperature", "=", "tt.min_temperature")
          .onRef("wm.max_temperature", "=", "tt.max_temperature")
          .on("tt.is_predefined", "=", 1)
          .on("tt.deleted_at", "is", null)
      )
      .where("cm.entity_id", "=", entityId)
      .where("cm.deleted_at", "is", null)
      .selectAll("cm")
      .select(["tt.id as temperature_threshold_id"])
      .forUpdate() // 🔒 Row-level lock
      .execute()
  }

  async getColdstorageMaterialByEntityId(c: Context, entityId: number) {
    return await c.var.trx
      .selectFrom("coldstorage_materials as cm")
      .innerJoin("ws_materials as wm", (join) =>
        join
          .onRef("cm.material_id", "=", "wm.id")
          .on("wm.deleted_at", "is", null)
      )
      .leftJoin("temperature_thresholds as tt", (join) =>
        join
          .onRef("wm.min_temperature", "=", "tt.min_temperature")
          .onRef("wm.max_temperature", "=", "tt.max_temperature")
          .on("tt.is_predefined", "=", 1)
          .on("tt.deleted_at", "is", null)
      )
      .where("cm.entity_id", "=", entityId)
      .where("cm.deleted_at", "is", null)
      .selectAll("cm")
      .select(["tt.id as temperature_threshold_id"])
      .execute()
  }

  async createColdstorageMaterial(c: Context, data: any) {
    return await c.var.trx
      .insertInto("coldstorage_materials")
      .values(data)
      .executeTakeFirst()
  }

  async updateColdstorageMaterial(c: Context, id: number, data: any) {
    return await c.var.trx
      .updateTable("coldstorage_materials")
      .set(data)
      .where("id", "=", id)
      .executeTakeFirst()
  }

  /**
   * Batch update for better performance when updating multiple materials
   * Use this instead of multiple individual updates in a loop
   */
  async batchUpdateColdstorageMaterials(
    c: Context,
    updates: Array<{ id: number; data: any }>
  ) {
    const promises = updates.map(({ id, data }) =>
      this.updateColdstorageMaterial(c, id, data)
    )
    return await Promise.all(promises)
  }

  /**
   * CRITICAL: Get coldstorage per temperature with row lock
   * Prevents concurrent updates to temperature-specific records
   */
  async getColdstoragePerTemperatureDataWithLock(
    c: Context,
    entityId: number,
    coldstorageId: number,
    temperatureThresholdId: number
  ) {
    return await c.var.trx
      .selectFrom("coldstorage_per_temperature as cpt")
      .where("cpt.entity_id", "=", entityId)
      .where("cpt.coldstorage_id", "=", coldstorageId)
      .where("cpt.temperature_threshold_id", "=", temperatureThresholdId)
      .where("cpt.deleted_at", "is", null)
      .selectAll()
      .forUpdate() // 🔒 Row-level lock
      .executeTakeFirst()
  }

  async getColdstoragePerTemperatureData(
    c: Context,
    entityId: number,
    coldstorageId: number,
    temperatureThresholdId: number
  ) {
    return await c.var.trx
      .selectFrom("coldstorage_per_temperature as cpt")
      .where("cpt.entity_id", "=", entityId)
      .where("cpt.coldstorage_id", "=", coldstorageId)
      .where("cpt.temperature_threshold_id", "=", temperatureThresholdId)
      .where("cpt.deleted_at", "is", null)
      .select(["cpt.id"])
      .executeTakeFirst()
  }

  async createColdstoragePerTemperature(c: Context, data: any) {
    return await c.var.trx
      .insertInto("coldstorage_per_temperature")
      .values(data)
      .executeTakeFirst()
  }

  async updateColdstoragePerTemperature(c: Context, id: number, data: any) {
    return await c.var.trx
      .updateTable("coldstorage_per_temperature")
      .set(data)
      .where("id", "=", id)
      .executeTakeFirst()
  }

  /**
   * Batch upsert for coldstorage per temperature
   * More efficient than individual upsert operations
   */
  async batchUpsertColdstoragePerTemperature(
    c: Context,
    records: Array<{
      existing?: { id: number }
      data: any
    }>
  ) {
    const promises = records.map(({ existing, data }) => {
      if (existing) {
        return this.updateColdstoragePerTemperature(c, existing.id, data)
      } else {
        return this.createColdstoragePerTemperature(c, data)
      }
    })
    return await Promise.all(promises)
  }

  /**
   * Get coldstorage materials with material details
   *
   * IMPORTANT LOGIC:
   * - If programId provided: Return materials for that program only
   * - If programId NOT provided: Aggregate materials by global_id across all programs
   *
   * This ensures accurate volume calculations when viewing all programs
   */
  async getColdstorageMaterials(
    c: Context,
    coldstorageId: number,
    programId?: number
  ) {
    if (programId) {
      // Filter by specific program - return raw data
      return await this.getColdstorageMaterialsByProgram(
        c,
        coldstorageId,
        programId
      )
    } else {
      // No program filter - aggregate by global_id
      return await this.getColdstorageMaterialsAggregated(c, coldstorageId)
    }
  }

  /**
   * Get materials filtered by specific program
   */
  private async getColdstorageMaterialsByProgram(
    c: Context,
    coldstorageId: number,
    programId: number
  ) {
    return await c.var.trx
      .selectFrom("coldstorage_materials as cm")
      .innerJoin("ws_materials as wm", (join) =>
        join
          .onRef("cm.material_id", "=", "wm.id")
          .on("wm.deleted_at", "is", null)
          .on("wm.program_id", "=", programId)
      )
      .leftJoin("temperature_thresholds as tt", (join) =>
        join
          .onRef("wm.min_temperature", "=", "tt.min_temperature")
          .onRef("wm.max_temperature", "=", "tt.max_temperature")
          .on("tt.is_predefined", "=", 1)
          .on("tt.deleted_at", "is", null)
      )
      .where("cm.coldstorage_id", "=", coldstorageId)
      .where("cm.deleted_at", "is", null)
      .select([
        "cm.id as cm_id",
        "cm.coldstorage_id",
        "cm.entity_id",
        "cm.material_id",
        "cm.dosage_stock",
        "cm.vial_stock",
        "cm.package_stock",
        "cm.package_volume",
        "cm.remain_package_fulfill",
        "cm.volume_per_liter",
        "cm.created_at as cm_created_at",
        "cm.updated_at as cm_updated_at",
        "cm.max_dosage",
        "cm.recommend_order_base_on_max",
        "cm.projection_stock",
        "cm.projection_vial_stock",
        "cm.projection_package_stock",
        "cm.projection_package_volume",

        // Master material fields
        "wm.id as material_id",
        "wm.global_id as material_global_id",
        "wm.name as material_name",
        "wm.code as material_code",
        "wm.consumption_unit_per_distribution_unit",
        "wm.material_type_id",
        "wm.is_temperature_sensitive",
        "wm.program_id",

        // Temperature range
        "tt.id as temperature_threshold_id",
        "tt.min_temperature",
        "tt.max_temperature",
      ])
      .execute()
  }

  /**
   * Get materials aggregated by global_id (across all programs)
   *
   * This aggregates:
   * - dosage_stock: SUM across programs
   * - vial_stock: SUM across programs
   * - package_stock: SUM across programs
   * - package_volume: SUM across programs (CRITICAL for capacity calculation)
   * - projection_*: SUM across programs
   *
   * Groups by global_id to avoid duplicate materials
   */
  private async getColdstorageMaterialsAggregated(
    c: Context,
    coldstorageId: number
  ) {
    return await c.var.trx
      .selectFrom("coldstorage_materials as cm")
      .innerJoin("ws_materials as wm", (join) =>
        join
          .onRef("cm.material_id", "=", "wm.id")
          .on("wm.deleted_at", "is", null)
      )
      .leftJoin("temperature_thresholds as tt", (join) =>
        join
          .onRef("wm.min_temperature", "=", "tt.min_temperature")
          .onRef("wm.max_temperature", "=", "tt.max_temperature")
          .on("tt.is_predefined", "=", 1)
          .on("tt.deleted_at", "is", null)
      )
      .where("cm.coldstorage_id", "=", coldstorageId)
      .where("cm.deleted_at", "is", null)
      .select([
        // Use MIN for IDs (just to have a value, not meaningful for aggregated data)
        sql<number>`MIN(cm.id)`.as("cm_id"),
        sql<number>`MIN(cm.coldstorage_id)`.as("coldstorage_id"),
        sql<number>`MIN(cm.entity_id)`.as("entity_id"),
        sql<number>`MIN(cm.material_id)`.as("material_id"),

        // Aggregate stock data across programs
        sql<number>`SUM(cm.dosage_stock)`.as("dosage_stock"),
        sql<number>`SUM(cm.vial_stock)`.as("vial_stock"),
        sql<number>`SUM(cm.package_stock)`.as("package_stock"),
        sql<number>`SUM(cm.package_volume)`.as("package_volume"),
        sql<number>`SUM(cm.remain_package_fulfill)`.as(
          "remain_package_fulfill"
        ),

        // Take AVG for volume_per_liter (should be same across programs)
        sql<number>`AVG(cm.volume_per_liter)`.as("volume_per_liter"),

        // Use MAX for dates (most recent)
        sql<Date>`MAX(cm.created_at)`.as("cm_created_at"),
        sql<Date>`MAX(cm.updated_at)`.as("cm_updated_at"),

        // Aggregate dosage calculations
        sql<number>`SUM(cm.max_dosage)`.as("max_dosage"),
        sql<number>`SUM(cm.recommend_order_base_on_max)`.as(
          "recommend_order_base_on_max"
        ),
        sql<number>`SUM(cm.projection_stock)`.as("projection_stock"),
        sql<number>`SUM(cm.projection_vial_stock)`.as("projection_vial_stock"),
        sql<number>`SUM(cm.projection_package_stock)`.as(
          "projection_package_stock"
        ),
        sql<number>`SUM(cm.projection_package_volume)`.as(
          "projection_package_volume"
        ),

        // Master material fields (same across programs, use MIN/MAX to pick one)
        "wm.global_id as material_global_id",
        sql<string>`MAX(wm.name)`.as("material_name"),
        sql<string>`MAX(wm.code)`.as("material_code"),
        sql<number>`MAX(wm.consumption_unit_per_distribution_unit)`.as(
          "consumption_unit_per_distribution_unit"
        ),
        sql<number>`MAX(wm.material_type_id)`.as("material_type_id"),
        sql<number>`MAX(wm.is_temperature_sensitive)`.as(
          "is_temperature_sensitive"
        ),

        // Program ID: NULL for aggregated view (represents "All Programs")
        sql<number>`NULL`.as("program_id"),

        // Temperature range (same across programs)
        sql<number>`MAX(tt.id)`.as("temperature_threshold_id"),
        sql<number>`MAX(tt.min_temperature)`.as("min_temperature"),
        sql<number>`MAX(tt.max_temperature)`.as("max_temperature"),
      ])
      .groupBy("wm.global_id") // KEY: Group by global_id to aggregate across programs
      .execute()
  }

  /**
   * Get coldstorage per temperature records
   */
  async getColdstoragePerTemperature(c: Context, coldstorageId: number) {
    return await c.var.trx
      .selectFrom("coldstorage_per_temperature as cpt")
      .innerJoin("temperature_thresholds as tt", (join) =>
        join
          .onRef("cpt.temperature_threshold_id", "=", "tt.id")
          .on("tt.deleted_at", "is", null)
      )
      .where("cpt.coldstorage_id", "=", coldstorageId)
      .where("cpt.deleted_at", "is", null)
      .select([
        "cpt.id",
        "cpt.coldstorage_id",
        "cpt.entity_id",
        "cpt.temperature_threshold_id",
        "cpt.volume_asset",
        "cpt.total_volume",
        "cpt.percentage_capacity",
        "cpt.projection_volume_asset",
        "cpt.projection_total_volume",
        "cpt.projection_percentage_capacity",
        "cpt.created_at",
        "cpt.updated_at",
        "tt.min_temperature",
        "tt.max_temperature",
      ])
      .execute()
  }

  /**
   * Get all assets for entity (flattened list)
   */
  async getAllAssets(c: Context, entityId: number) {
    const { trx } = c.var

    return await trx
      .selectFrom("asset_inventories as ai")
      .innerJoin("asset_models_temperatures_capacities as amtc", (join) =>
        join
          .onRef("ai.asset_model_temperature_capacity_id", "=", "amtc.id")
          .on("amtc.deleted_at", "is", null)
      )
      .innerJoin("asset_models as am", (join) =>
        join
          .onRef("amtc.asset_model_id", "=", "am.id")
          .on("am.deleted_at", "is", null)
      )
      .innerJoin("manufactures as m", (join) =>
        join
          .onRef("am.manufacture_id", "=", "m.id")
          .on("m.deleted_at", "is", null)
      )
      .innerJoin("asset_types as at", (join) =>
        join
          .onRef("am.asset_type_id", "=", "at.id")
          .on("at.deleted_at", "is", null)
      )
      .innerJoin("asset_types_classifications as atc", (join) =>
        join
          .onRef("at.id", "=", "atc.asset_type_id")
          .on("atc.asset_classifications_id", "=", ASSET_CLASSIFICATION.CCE)
          .on("atc.deleted_at", "is", null)
      )
      .innerJoin("asset_types_temperatures as att", (join) =>
        join
          .onRef("amtc.asset_type_temperature_id", "=", "att.id")
          .on("att.deleted_at", "is", null)
      )
      .innerJoin("temperature_thresholds as tt", (join) =>
        join
          .onRef("att.temperature_threshold_id", "=", "tt.id")
          .on("tt.is_predefined", "=", 1)
          .on("tt.deleted_at", "is", null)
      )
      .where("ai.entity_id", "=", entityId)
      .where("ai.working_status_id", "=", 1)
      .where("ai.status", "=", 1)
      .where("ai.deleted_at", "is", null)
      .select([
        "ai.id",
        "ai.serial_number",
        "ai.working_status_id as status",
        "amtc.gross_capacity",
        "amtc.net_capacity",
        "at.id as asset_type_id",
        "at.name as asset_type_name",
        "tt.id as temperature_threshold_id",
        "tt.min_temperature",
        "tt.max_temperature",
        "m.id as manufacture_id",
        "m.name as manufacture_name",
        "am.id as asset_model_id",
        "am.name as asset_model_name",
      ])
      .execute()
  }

  /**
   * Get all master material volume & manufacture by material IDs
   */
  // coldstorage.repository.ts
  async getAllMasterMaterialVolume(c: Context, materialIds: number[]) {
    if (!materialIds || materialIds.length === 0) {
      return []
    }

    return await c.var.trx
      .selectFrom("ws_materials as m")
      .innerJoin("material_volumes as mv", (join) =>
        join
          .onRef("m.global_id", "=", "mv.material_id")
          .on("mv.deleted_at", "is", null)
      )
      .innerJoin("manufactures as wm", (join) =>
        join
          .onRef("mv.manufacture_id", "=", "wm.id")
          .on("wm.deleted_at", "is", null)
      )
      .where("m.id", "in", materialIds)
      .select([
        "mv.id as material_volume_id",
        "m.global_id as material_id",
        "m.consumption_unit_per_distribution_unit",
        "mv.box_length",
        "mv.box_width",
        "mv.box_height",
        "mv.unit_per_box",
        "wm.name as manufacture_name",
      ])
      .groupBy("mv.id")
      .execute()
  }

  async getProgramMaterialByColdstorageId(c: Context, coldstorageId: number) {
    return await c.var.trx
      .selectFrom("coldstorage_materials as cm")
      .innerJoin("ws_materials as wm", (join) =>
        join
          .onRef("cm.material_id", "=", "wm.id")
          .on("wm.deleted_at", "is", null)
      )
      .innerJoin("workspaces as w", (join) =>
        join.onRef("wm.program_id", "=", "w.id").on("w.deleted_at", "is", null)
      )
      .where("cm.coldstorage_id", "=", coldstorageId)
      .where("cm.deleted_at", "is", null)
      .select(["wm.program_id", "w.name"])
      .groupBy("wm.program_id")
      .execute()
  }

  async getListColdstorage(c: Context, queryParam: GetColdstorageListQuery) {
    let queries = c.var.trx
      .selectFrom("coldstorages as cs")
      .innerJoin("entities as e", (join) =>
        join.onRef("cs.entity_id", "=", "e.id").on("e.deleted_at", "is", null)
      )
      .where("cs.deleted_at", "is", null)

    queries = this.applySorting(queries, queryParam)

    if (queryParam.entity_tag_id) {
      queries = queries.where("e.entity_tag_id", "=", queryParam.entity_tag_id)
    }

    if (queryParam.capacities_status) {
      switch (queryParam.capacities_status) {
        case "empty":
          queries = queries.where("cs.percentage_capacity", "=", 0)
          break
        case "low":
          queries = queries
            .where("cs.percentage_capacity", ">", 0)
            .where("cs.percentage_capacity", "<=", 19)
          break
        case "normal":
          queries = queries
            .where("cs.percentage_capacity", ">", 19)
            .where("cs.percentage_capacity", "<=", 80)
          break
        case "high":
          queries = queries.where("cs.percentage_capacity", ">", 80)
          break
      }
    }

    const isNotNullOrEmpty = (eb: any, field: string) => {
      return eb.and([eb(field, "is not", null), eb(field, "!=", "")])
    }

    if (queryParam.province_id) {
      queries = queries
        .where("e.province_id", "=", `${queryParam.province_id}`)
        .orderBy("e.entity_tag_id", "asc")
    }

    if (queryParam.regency_id) {
      queries = queries
        .where("e.regency_id", "=", `${queryParam.regency_id}`)
        .where((eb) => isNotNullOrEmpty(eb, "e.regency_id"))
        .orderBy("e.entity_tag_id", "asc")
    }

    if (queryParam.health_facility_id) {
      queries = queries
        .where("e.id", "=", queryParam.health_facility_id)
        .where((eb) => isNotNullOrEmpty(eb, "e.province_id"))
        .where((eb) => isNotNullOrEmpty(eb, "e.regency_id"))
        .where((eb) => isNotNullOrEmpty(eb, "e.sub_district_id"))
    }

    let additionalQueries = queries

    const [parentList, totallist] = await Promise.all([
      additionalQueries
        .select([
          "cs.id",
          "cs.volume_asset",
          "cs.total_volume",
          "cs.percentage_capacity",
          "cs.created_at",
          "cs.updated_at",
          "cs.created_by",
          "cs.updated_by",
          "e.name",
        ])
        .groupBy("cs.id")
        .execute(),
      additionalQueries
        .select(() => sql`count(distinct ${sql.ref("cs.id")})`.as("total"))
        .executeTakeFirst(),
    ])

    return {
      parentList,
      total: totallist?.total ?? 0,
    }
  }

  async getListColdstorageWithoutPagination(
    c: Context,
    queryParam: GetColdstorageListQuery
  ) {
    const serialNumbersSubquery = c.var.trx
      .selectFrom("asset_inventories as ai")
      .innerJoin("asset_models_temperatures_capacities as amtc", (join) =>
        join
          .onRef("ai.asset_model_temperature_capacity_id", "=", "amtc.id")
          .on("amtc.deleted_at", "is", null)
      )
      .innerJoin("asset_models as am", (join) =>
        join
          .onRef("amtc.asset_model_id", "=", "am.id")
          .on("am.deleted_at", "is", null)
      )
      .innerJoin("asset_types as at", (join) =>
        join
          .onRef("am.asset_type_id", "=", "at.id")
          .on("at.deleted_at", "is", null)
      )
      .innerJoin("asset_types_classifications as atc", (join) =>
        join
          .onRef("at.id", "=", "atc.asset_type_id")
          .on("atc.asset_classifications_id", "=", ASSET_CLASSIFICATION.CCE)
          .on("atc.deleted_at", "is", null)
      )
      .where("ai.deleted_at", "is", null)
      .where("ai.working_status_id", "=", 1)
      .where("ai.status", "=", 1)
      .select([
        "ai.entity_id",
        sql<string>`GROUP_CONCAT(DISTINCT ai.serial_number ORDER BY ai.serial_number SEPARATOR ',')`.as(
          "serial_numbers"
        ),
      ])
      .groupBy("ai.entity_id")
      .as("serial_data")

    let queries = c.var.trx
      .selectFrom("coldstorages as cs")
      .innerJoin("entities as e", (join) =>
        join.onRef("cs.entity_id", "=", "e.id").on("e.deleted_at", "is", null)
      )
      .leftJoin("locations as p", "p.id", "e.province_id")
      .leftJoin("locations as r", "r.id", "e.regency_id")
      .leftJoin(serialNumbersSubquery, "serial_data.entity_id", "cs.entity_id")
      .where("cs.deleted_at", "is", null)

    queries = this.applySorting(queries, queryParam)

    if (queryParam.entity_tag_id) {
      queries = queries.where("e.entity_tag_id", "=", queryParam.entity_tag_id)
    }

    if (queryParam.capacities_status) {
      switch (queryParam.capacities_status) {
        case "empty":
          queries = queries.where("cs.percentage_capacity", "=", 0)
          break
        case "low":
          queries = queries
            .where("cs.percentage_capacity", ">", 0)
            .where("cs.percentage_capacity", "<=", 19)
          break
        case "normal":
          queries = queries
            .where("cs.percentage_capacity", ">", 19)
            .where("cs.percentage_capacity", "<=", 80)
          break
        case "high":
          queries = queries.where("cs.percentage_capacity", ">", 80)
          break
      }
    }

    const isNotNullOrEmpty = (eb: any, field: string) => {
      return eb.and([eb(field, "is not", null), eb(field, "!=", "")])
    }

    if (queryParam.province_id) {
      queries = queries
        .where("e.province_id", "=", `${queryParam.province_id}`)
        .orderBy("e.entity_tag_id", "asc")
    }

    if (queryParam.regency_id) {
      queries = queries
        .where("e.regency_id", "=", `${queryParam.regency_id}`)
        .where((eb) => isNotNullOrEmpty(eb, "e.regency_id"))
        .orderBy("e.entity_tag_id", "asc")
    }

    if (queryParam.health_facility_id) {
      queries = queries
        .where("e.id", "=", queryParam.health_facility_id)
        .where((eb) => isNotNullOrEmpty(eb, "e.province_id"))
        .where((eb) => isNotNullOrEmpty(eb, "e.regency_id"))
        .where((eb) => isNotNullOrEmpty(eb, "e.sub_district_id"))
    }

    const result = await queries
      .select([
        "cs.id",
        "cs.volume_asset",
        "cs.total_volume",
        "cs.percentage_capacity",
        "cs.updated_at",
        "cs.created_by",
        "cs.updated_by",
        "e.name",
        "e.id as entity_id",
        "serial_data.serial_numbers",
        "r.name as regency_name",
        "p.name as province_name",
      ])
      .stream()

    return result
  }

  async geColdstorageById(c: Context, id: number) {
    return await c.var.trx
      .selectFrom("coldstorages as cs")
      .innerJoin("entities as e", (join) =>
        join.onRef("cs.entity_id", "=", "e.id").on("e.deleted_at", "is", null)
      )
      .where("cs.entity_id", "=", id)
      .where("cs.deleted_at", "is", null)
      .select(["cs.percentage_capacity", "e.name"])
      .executeTakeFirst()
  }

  private applySorting(query: any, queryParam: GetColdstorageListQuery) {
    const sortMapping = {
      entity_name: "e.name",
      total_volume: "cs.total_volume",
      percentage_capacity: "cs.percentage_capacity",
    }

    if (queryParam.sort_by && sortMapping[queryParam.sort_by]) {
      const order =
        queryParam.sort_type?.toLowerCase() === "desc" ? "desc" : "asc"
      query = query.orderBy(sortMapping[queryParam.sort_by], order)
    }

    return query
  }
}
