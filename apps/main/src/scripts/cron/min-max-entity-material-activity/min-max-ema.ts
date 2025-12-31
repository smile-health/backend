import { db } from "@/common/infrastructure/database/index.js"
import { DB } from "@/common/infrastructure/database/types/db.js"
import { CompiledQuery, Transaction } from "kysely"

const updateProvince = async (
  trx: Transaction<DB>,
  programId: number[],
  entityId: number[],
  materialId: number[]
) => {
  try {
    console.log("===========================================================")
    console.info("🚀 [START] Updating Min Max for Province level...")

    // Build dynamic WHERE conditions for filtering
    const programFilter =
      programId.length > 0
        ? `AND wep.program_id IN (${programId.join(",")})`
        : ""
    const entityFilter =
      entityId.length > 0 ? `AND wema.entity_id IN (${entityId.join(",")})` : ""
    const materialFilter =
      materialId.length > 0
        ? `AND wema.material_id IN (${materialId.join(",")})`
        : ""

    // Drop temporary table if exists
    await trx.executeQuery(
      CompiledQuery.raw("DROP TEMPORARY TABLE IF EXISTS tmp_minmax_province")
    )

    // Create temporary table with calculated min/max values
    await trx.executeQuery(
      CompiledQuery.raw(`
      CREATE TEMPORARY TABLE tmp_minmax_province      ENGINE=InnoDB
      AS
      SELECT
        x.wema_id,
        -- Calculate MIN/MAX based on GET formula
        CEIL(
          CASE
            WHEN x.konsumsi_per_bulan * 0.3 * COALESCE(x.distribution_time, 0)
                 >=  x.konsumsi_per_bulan       * COALESCE(x.lead_time, 0)
            THEN x.konsumsi_per_bulan * 0.3 * COALESCE(x.distribution_time, 0)
            ELSE x.konsumsi_per_bulan       * COALESCE(x.lead_time, 0)
          END
        ) AS calc_min,
        CEIL(
          x.konsumsi_per_bulan * (
            COALESCE(x.distribution_time, 0) * 1.1 + COALESCE(x.lead_time, 0)
          )
        ) AS calc_max
      FROM (
        /* ===== Base per GET province ===== */
        SELECT
          wp.wema_id,
          /* Monthly consumption = total 3 months / 3 */
          COALESCE(t3.consumption_qty, 0) / 3.0 AS konsumsi_per_bulan,
          epmm.distribution_time,
          epmm.lead_time
        FROM (
          /* WEMA list: active province entities, not deleted */
          SELECT
              wema.id          AS wema_id,
              wep.province_id,                      -- can be NULL, keep it
              wema.activity_id,
              wema.material_id AS parent_material_id,
              wema.entity_id   AS province_entity_id
          FROM ws_entity_material_activities wema
          JOIN ws_entities wep ON wep.id = wema.entity_id
          AND wep.\`type\`   = 1
          AND wep.\`status\` = 1
          AND wep.deleted_at IS NULL
          WHERE wema.deleted_at IS NULL
            ${programFilter}
            ${entityFilter}
            ${materialFilter}
        ) wp
        LEFT JOIN (
          /* Last 3 months consumption (WIB), all entities in the province, is_vendor=1 */
          SELECT
              wet.province_id,
              ws.parent_material_id,
              wt.activity_id,
              SUM(wt.change_qty * -1) AS consumption_qty
          FROM ws_transactions wt
          JOIN ws_entities wet
            ON wet.id = wt.entity_id
          AND wet.deleted_at IS NULL
          AND wet.is_vendor = 1
          JOIN ws_stocks ws
            ON ws.id = wt.stock_id
          AND ws.deleted_at IS NULL
          JOIN ws_materials wm
            ON wm.id = ws.material_id
          AND wm.deleted_at IS NULL
          WHERE wt.deleted_at IS NULL
            AND wt.transaction_type_id IN (5,10)
            AND wt.order_id IS NULL
            AND DATE(wt.created_at + INTERVAL 7 HOUR)
                  BETWEEN LAST_DAY(CURRENT_DATE() - INTERVAL 4 MONTH) + INTERVAL 1 DAY
                      AND LAST_DAY(CURRENT_DATE() - INTERVAL 1 MONTH)
          GROUP BY wet.province_id, ws.parent_material_id, wt.activity_id
        ) t3
          ON t3.province_id        = wp.province_id
        AND t3.parent_material_id = wp.parent_material_id
        AND t3.activity_id        = wp.activity_id
        LEFT JOIN entity_prep_min_max epmm
          ON epmm.entity_id = wp.province_entity_id
      ) x
    `)
    )

    console.log(
      await trx.executeQuery(
        CompiledQuery.raw(`
        SELECT COUNT(*) AS row_count FROM tmp_minmax_province
      `)
      )
    )

    // Add primary key index for faster JOIN update
    await trx.executeQuery(
      CompiledQuery.raw(`
      ALTER TABLE tmp_minmax_province
        ADD PRIMARY KEY (wema_id)
    `)
    )

    // Update min and max columns only if there are changes
    const updateResult = await trx.executeQuery(
      CompiledQuery.raw(`
      UPDATE ws_entity_material_activities w
      JOIN tmp_minmax_province t
        ON t.wema_id = w.id
      JOIN ws_entities e
        ON e.id = w.entity_id
      AND e.\`type\`   = 1
      AND e.\`status\` = 1
      AND e.deleted_at IS NULL
      SET w.\`min\` = t.calc_min,
          w.\`max\` = t.calc_max,
          w.updated_at = UTC_TIMESTAMP()
      WHERE w.deleted_at IS NULL
        AND NOT (w.\`min\` <=> t.calc_min AND w.\`max\` <=> t.calc_max)
    `)
    )

    // Clean up temporary table
    await trx.executeQuery(
      CompiledQuery.raw(`
      DROP TEMPORARY TABLE IF EXISTS tmp_minmax_province
    `)
    )

    console.info(
      `✅ [COMPLETE] Province Min Max updated: ${updateResult.numAffectedRows || 0} rows affected`
    )
  } catch (error) {
    // Clean up temporary table in case of error
    try {
      await trx.executeQuery(
        CompiledQuery.raw(`DROP TEMPORARY TABLE IF EXISTS tmp_minmax_province`)
      )
    } catch (cleanupError) {
      console.warn(
        "⚠️ [WARNING] Failed to cleanup temporary table:",
        cleanupError
      )
    }

    console.error("❌ [ERROR] Error updating Province Min Max:", error)
    console.log("===========================================================")
    throw error
  }
}

const updateRegency = async (
  trx: Transaction<DB>,
  programId: number[],
  entityId: number[],
  materialId: number[]
) => {
  try {
    console.log("===========================================================")
    console.info("🚀 [START] Updating Min Max for Regency level...")

    // Build dynamic WHERE conditions for filtering
    const programFilter =
      programId.length > 0
        ? `AND wer.program_id IN (${programId.join(",")})`
        : ""
    const entityFilter =
      entityId.length > 0 ? `AND wema.entity_id IN (${entityId.join(",")})` : ""
    const materialFilter =
      materialId.length > 0
        ? `AND wema.material_id IN (${materialId.join(",")})`
        : ""

    // Drop temporary table if exists
    await trx.executeQuery(
      CompiledQuery.raw("DROP TEMPORARY TABLE IF EXISTS tmp_minmax_regency")
    )

    // Create temporary table with calculated min/max values
    await trx.executeQuery(
      CompiledQuery.raw(`
      CREATE TEMPORARY TABLE tmp_minmax_regency ENGINE=InnoDB
      AS
      SELECT
        x.wema_id,
        -- Calculate MIN/MAX based on GET formula
        CEIL(
          CASE
            WHEN x.konsumsi_per_bulan * 0.3 * COALESCE(x.distribution_time, 0)
                 >=  x.konsumsi_per_bulan       * COALESCE(x.lead_time, 0)
            THEN x.konsumsi_per_bulan * 0.3 * COALESCE(x.distribution_time, 0)
            ELSE x.konsumsi_per_bulan       * COALESCE(x.lead_time, 0)
          END
        ) AS calc_min,
        CEIL(
          x.konsumsi_per_bulan * (
            COALESCE(x.distribution_time, 0) * 1.1 + COALESCE(x.lead_time, 0)
          )
        ) AS calc_max
      FROM (
        /* ===== Base per GET regency ===== */
        SELECT
          wr.wema_id,
          /* Monthly consumption = total 3 months / 3 */
          COALESCE(t3.consumption_qty, 0) / 3.0 AS konsumsi_per_bulan,
          epmm.distribution_time,
          epmm.lead_time
        FROM (
          /* WEMA list: active regency entities, not deleted */
          SELECT
              wema.id          AS wema_id,
              wer.regency_id,                      -- can be NULL, keep it
              wema.activity_id,
              wema.material_id AS parent_material_id,
              wema.entity_id   AS regency_entity_id
          FROM ws_entity_material_activities wema
          JOIN ws_entities wer ON wer.id = wema.entity_id
          AND wer.\`type\`   = 2
          AND wer.\`status\` = 1
          AND wer.deleted_at IS NULL
          WHERE wema.deleted_at IS NULL
            ${programFilter}
            ${entityFilter}
            ${materialFilter}
        ) wr
        LEFT JOIN (
          /* Last 3 months consumption (WIB), only entities type 2 & 3, is_vendor=1 */
          SELECT
              wet.regency_id,
              ws.parent_material_id,
              wt.activity_id,
              SUM(wt.change_qty * -1) AS consumption_qty
          FROM ws_transactions wt
          JOIN ws_entities wet
            ON wet.id = wt.entity_id
          AND wet.deleted_at IS NULL
          AND wet.is_vendor = 1
          AND wet.\`type\` IN (2,3)   -- exclude provinsi
          JOIN ws_stocks ws
            ON ws.id = wt.stock_id
          AND ws.deleted_at IS NULL
          JOIN ws_materials wm
            ON wm.id = ws.material_id
          AND wm.deleted_at IS NULL
          WHERE wt.deleted_at IS NULL
            AND wt.transaction_type_id IN (5,10)
            AND wt.order_id IS NULL
            AND DATE(wt.created_at + INTERVAL 7 HOUR)
                  BETWEEN LAST_DAY(CURRENT_DATE() - INTERVAL 4 MONTH) + INTERVAL 1 DAY
                      AND LAST_DAY(CURRENT_DATE() - INTERVAL 1 MONTH)
          GROUP BY wet.regency_id, ws.parent_material_id, wt.activity_id
        ) t3
          ON t3.regency_id        = wr.regency_id
        AND t3.parent_material_id = wr.parent_material_id
        AND t3.activity_id        = wr.activity_id
        LEFT JOIN (
          /* handle duplicate params: take MAX as default */
          SELECT entity_id,
          MAX(distribution_time) AS distribution_time,
          MAX(lead_time)         AS lead_time
          FROM entity_prep_min_max
          GROUP BY entity_id
        ) epmm
          ON epmm.entity_id = wr.regency_entity_id
      ) x
    `)
    )

    console.log(
      await trx.executeQuery(
        CompiledQuery.raw(`
        SELECT COUNT(*) AS row_count FROM tmp_minmax_regency
      `)
      )
    )

    // Add primary key index for faster JOIN update
    await trx.executeQuery(
      CompiledQuery.raw(`
      ALTER TABLE tmp_minmax_regency
        ADD PRIMARY KEY (wema_id)
    `)
    )

    // Update min and max columns only if there are changes
    const updateResult = await trx.executeQuery(
      CompiledQuery.raw(`
      UPDATE ws_entity_material_activities w
      JOIN tmp_minmax_regency t
        ON t.wema_id = w.id
      JOIN ws_entities e
        ON e.id = w.entity_id
      AND e.\`type\`   = 2
      AND e.\`status\` = 1
      AND e.deleted_at IS NULL
      SET w.\`min\` = t.calc_min,
          w.\`max\` = t.calc_max,
          w.updated_at = UTC_TIMESTAMP()
      WHERE w.deleted_at IS NULL
        AND NOT (w.\`min\` <=> t.calc_min AND w.\`max\` <=> t.calc_max)
    `)
    )

    // Clean up temporary table
    await trx.executeQuery(
      CompiledQuery.raw(`
      DROP TEMPORARY TABLE IF EXISTS tmp_minmax_regency
    `)
    )

    console.info(
      `✅ [COMPLETE] Regency Min Max updated: ${updateResult.numAffectedRows || 0} rows affected`
    )
  } catch (error) {
    // Clean up temporary table in case of error
    try {
      await trx.executeQuery(
        CompiledQuery.raw(`DROP TEMPORARY TABLE IF EXISTS tmp_minmax_regency`)
      )
    } catch (cleanupError) {
      console.warn(
        "⚠️ [WARNING] Failed to cleanup temporary table:",
        cleanupError
      )
    }

    console.error("❌ [ERROR] Error updating Regency Min Max:", error)
    console.log("===========================================================")
    throw error
  }
}

const updateEntity = async (
  trx: Transaction<DB>,
  programId: number[],
  entityId: number[],
  materialId: number[]
) => {
  try {
    console.log("===========================================================")
    console.info("🚀 [START] Updating Min Max for Entity level...")

    // Build dynamic WHERE conditions for filtering
    const programFilter =
      programId.length > 0
        ? `AND wef.program_id IN (${programId.join(",")})`
        : ""
    const entityFilter =
      entityId.length > 0 ? `AND wema.entity_id IN (${entityId.join(",")})` : ""
    const materialFilter =
      materialId.length > 0
        ? `AND wema.material_id IN (${materialId.join(",")})`
        : ""

    // Drop temporary table if exists
    await trx.executeQuery(
      CompiledQuery.raw("DROP TEMPORARY TABLE IF EXISTS tmp_minmax_entity")
    )

    // Create temporary table with calculated min/max values
    await trx.executeQuery(
      CompiledQuery.raw(`
      CREATE TEMPORARY TABLE tmp_minmax_entity ENGINE=InnoDB
      AS
      SELECT
        x.wema_id,
        -- Calculate MIN/MAX based on GET formula
        CEIL(
          CASE
            WHEN x.konsumsi_per_bulan * 0.3 * COALESCE(ep.distribution_time, 0)
                 >=  x.konsumsi_per_bulan   * COALESCE(ep.lead_time, 0)
            THEN x.konsumsi_per_bulan * 0.3 * COALESCE(ep.distribution_time, 0)
            ELSE x.konsumsi_per_bulan       * COALESCE(ep.lead_time, 0)
          END
        ) AS calc_min,
        CEIL(
          x.konsumsi_per_bulan * (
            COALESCE(ep.distribution_time, 0) * 1.1 + COALESCE(ep.lead_time, 0)
          )
        ) AS calc_max
      FROM (
        /* ===== Base per GET entity (type=3) — konsumsi dirinya sendiri ===== */
        SELECT
          wema.id          AS wema_id,
          wema.entity_id   AS entity_id,
          wema.material_id AS parent_material_id,
          wema.activity_id,
          /* Monthly consumption = total 3 months / 3 */
          COALESCE(t3.consumption_qty, 0) / 3.0 AS konsumsi_per_bulan
        FROM ws_entity_material_activities wema
        JOIN ws_entities wef
          ON wef.id = wema.entity_id
          AND wef.\`type\`   = 3
          AND wef.\`status\` = 1
          AND wef.deleted_at IS NULL
        LEFT JOIN (
          /* Last 3 months consumption (WIB), only from itself, is_vendor=1 */
          SELECT
            wet.id AS entity_id,
            ws.parent_material_id,
            wt.activity_id,
            SUM(wt.change_qty * -1) AS consumption_qty
          FROM ws_transactions wt
          JOIN ws_entities wet
            ON wet.id = wt.entity_id
          AND wet.deleted_at IS NULL
          AND wet.is_vendor = 1
          AND wet.\`type\` = 3
          JOIN ws_stocks ws
            ON ws.id = wt.stock_id
          AND ws.deleted_at IS NULL
          JOIN ws_materials wm
            ON wm.id = ws.material_id
          AND wm.deleted_at IS NULL
          WHERE wt.deleted_at IS NULL
            AND wt.transaction_type_id IN (5,10)
            AND wt.order_id IS NULL
            AND DATE(wt.created_at + INTERVAL 7 HOUR)
            BETWEEN LAST_DAY(CURRENT_DATE() - INTERVAL 4 MONTH) + INTERVAL 1 DAY
            AND LAST_DAY(CURRENT_DATE() - INTERVAL 1 MONTH)
          GROUP BY wet.id, ws.parent_material_id, wt.activity_id
        ) t3
          ON t3.entity_id           = wema.entity_id
          AND t3.parent_material_id = wema.material_id
          AND t3.activity_id        = wema.activity_id
        WHERE wema.deleted_at IS NULL
          ${programFilter}
          ${entityFilter}
          ${materialFilter}
      ) x
      LEFT JOIN (
        /* Handle duplicate params per entity: take MAX() */
        SELECT entity_id,
        MAX(distribution_time) AS distribution_time,
        MAX(lead_time)         AS lead_time
        FROM entity_prep_min_max
        GROUP BY entity_id
      ) ep
        ON ep.entity_id = x.entity_id
    `)
    )

    console.log(
      await trx.executeQuery(
        CompiledQuery.raw(`
        SELECT COUNT(*) AS row_count FROM tmp_minmax_entity
      `)
      )
    )

    // Add primary key index for faster JOIN update
    await trx.executeQuery(
      CompiledQuery.raw(`
      ALTER TABLE tmp_minmax_entity
        ADD PRIMARY KEY (wema_id)
    `)
    )

    // Update min and max columns only if there are changes
    const updateResult = await trx.executeQuery(
      CompiledQuery.raw(`
      UPDATE ws_entity_material_activities w
      JOIN tmp_minmax_entity t
        ON t.wema_id = w.id
      JOIN ws_entities e
        ON e.id = w.entity_id
      AND e.\`type\`   = 3
      AND e.\`status\` = 1
      AND e.deleted_at IS NULL
      SET w.\`min\` = t.calc_min,
          w.\`max\` = t.calc_max,
          w.updated_at = UTC_TIMESTAMP()
      WHERE w.deleted_at IS NULL
        AND NOT (w.\`min\` <=> t.calc_min AND w.\`max\` <=> t.calc_max)
    `)
    )

    // Clean up temporary table
    await trx.executeQuery(
      CompiledQuery.raw(`
      DROP TEMPORARY TABLE IF EXISTS tmp_minmax_entity
    `)
    )

    console.info(
      `✅ [COMPLETE] Entity Min Max updated: ${updateResult.numAffectedRows || 0} rows affected`
    )
  } catch (error) {
    // Clean up temporary table in case of error
    try {
      await trx.executeQuery(
        CompiledQuery.raw(`DROP TEMPORARY TABLE IF EXISTS tmp_minmax_entity`)
      )
    } catch (cleanupError) {
      console.warn(
        "⚠️ [WARNING] Failed to cleanup temporary table:",
        cleanupError
      )
    }

    console.error("❌ [ERROR] Error updating Entity Min Max:", error)
    console.log("===========================================================")
    throw error
  }
}

export const UpdateMinMaxEMA = async (
  program_ids?: string,
  entity_ids?: string,
  material_ids?: string
) => {
  try {
    console.info("+++++++++++++++++++++++++++++++++++++++++++++++++++++++++++")
    console.info("🚀 [START] Start Update Min Max EMA...")
    await db.transaction().execute(async (trx) => {
      console.log("🔄 [Process] Processing with parameters:", {
        program_ids,
        entity_ids,
        material_ids,
      })
      const programIdList = program_ids
        ? program_ids.split(",").map(Number)
        : []
      const entityIdList = entity_ids ? entity_ids.split(",").map(Number) : []
      const materialIdList = material_ids
        ? material_ids.split(",").map(Number)
        : []

      await updateProvince(trx, programIdList, entityIdList, materialIdList)
      await updateRegency(trx, programIdList, entityIdList, materialIdList)
      await updateEntity(trx, programIdList, entityIdList, materialIdList)
    })
    console.info("✅ [COMPLETE] Complete Update Min Max EMA ...")
    console.info("+++++++++++++++++++++++++++++++++++++++++++++++++++++++++++")
    process.exit(0)
  } catch (error) {
    console.error("❌ [ERROR] Error updating Min Max EMA:", error)
    console.info("+++++++++++++++++++++++++++++++++++++++++++++++++++++++++++")
    process.exit(1)
  }
}
