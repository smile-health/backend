/* eslint-disable @typescript-eslint/no-explicit-any */
import { db } from "@/common/infrastructure/database/index.js"
import { DB } from "@/common/infrastructure/database/types/db.js"
import { MappingItem } from "@/common/types.js"
import { db as platformDB } from "@/scripts/db.platform.js"
import { associateField } from "@smile/lib/utils.js"
import { sql } from "kysely"
import pluralize from "pluralize"

/**
 * Safe SQL join helper that handles empty arrays gracefully
 * @param ids Array of IDs to join
 * @param separator SQL separator (default: comma)
 * @returns SQL fragment or null for empty arrays
 */
export const safeSqlJoin = (ids: number[], separator = sql`, `) => {
  if (ids.length === 0) {
    // Return a SQL fragment that will never match anything
    return sql`NULL`
  }
  return sql.join(
    ids.map((id) => sql`${id}`),
    separator
  )
}

export const partition = <T>(
  array: T[],
  predicate: (item: T) => boolean
): [T[], T[]] => {
  return array.reduce<[T[], T[]]>(
    ([pass, fail], item) => {
      if (predicate(item)) {
        pass.push(item)
      } else {
        fail.push(item)
      }
      return [pass, fail]
    },
    [[], []]
  )
}

export const getMapExistingToPlatformProgramId = async () => {
  const rows = await db
    .selectFrom("mapping_activities")
    .select(["program_id", "existing_program_id"])
    .orderBy("program_id")
    .distinct()
    .execute()

  return rows.reduce(
    (acc, row) => {
      const key = row.existing_program_id ?? 1
      acc[key] ??= []
      acc[key].push(row.program_id)
      return acc
    },
    {} as Record<number, number[]>
  )
}

export const getMapExistingActivityIdsByProgramId = async () => {
  const rows = await db
    .selectFrom("mapping_activities")
    .select(["program_id", "existing_activity_id"])
    .orderBy(["program_id", "existing_activity_id"])
    .distinct()
    .execute()

  return rows.reduce(
    (acc, row) => {
      const key = row.program_id || 1
      acc[key] ??= []
      acc[key].push(row.existing_activity_id)
      return acc
    },
    {} as Record<number, number[]>
  )
}

export const getMapPlatformToExistingProgramId = async () => {
  const rows = await db
    .selectFrom("mapping_activities")
    .select(["program_id", "existing_program_id"])
    .distinct()
    .orderBy("program_id")
    .execute()

  return associateField(rows, "program_id", "existing_program_id")
}

export const insertTableMapping = async (
  table: MappingItem,
  programId: number,
  mapExistingToPlatform: object,
  mapExistingToGlobalPlatform?: object
) => {
  const tableName = `mapping_${table}`
  const columnName = pluralize.singular(table)
  const platformIdColumn = `platform_${columnName}_id`
  const existingIdColumn = `existing_${columnName}_id`
  const globalIdColumn = `platform_global_id`

  let values = Object.entries(mapExistingToPlatform).map(
    ([existingId, platformId]) => ({
      program_id: programId,
      [platformIdColumn]: platformId,
      [existingIdColumn]: existingId,
    })
  )

  if (mapExistingToGlobalPlatform) {
    values = values.map((item) => {
      // Get the corresponding global ID using the existingId from the current item
      const existingId = item[existingIdColumn]
      const globalId = mapExistingToGlobalPlatform[existingId]

      // Return a new object with the global ID added
      return {
        ...item,
        [globalIdColumn]: globalId,
      }
    })
  }

  return db
    .insertInto(tableName as keyof DB)
    .values(values)
    .onDuplicateKeyUpdate({ updated_at: new Date() })
    .execute()
}

export const getMapEntityIds = async (
  programId: number,
  entityIds: number[]
) => {
  if (entityIds.length === 0) {
    return {}
  }

  const res = await db
    .selectFrom("mapping_entities as ew")
    .select(["ew.platform_entity_id", "ew.existing_entity_id"])
    .where("ew.program_id", "=", programId)
    .where("ew.existing_entity_id", "in", entityIds)
    .execute()
  return associateField(res, "existing_entity_id", "platform_entity_id")
}

export const getMapMaterialIds = async (
  programId: number | number[],
  materialIds: number[]
) => {
  if (materialIds.length === 0) {
    return {}
  }

  if (!Array.isArray(programId)) {
    programId = [programId]
  }

  const res = await db
    .selectFrom("mapping_materials as mw")
    .select(["mw.platform_material_id", "mw.existing_material_id"])
    .where("mw.program_id", "in", programId)
    .where("mw.existing_material_id", "in", materialIds)
    .execute()
  return associateField(res, "existing_material_id", "platform_material_id")
}

export const getMapGlobalMaterialIds = async (
  programId: number | number[],
  materialIds: number[]
) => {
  if (materialIds.length === 0) {
    return {}
  }

  if (!Array.isArray(programId)) {
    programId = [programId]
  }

  const res = await db
    .selectFrom("mapping_materials as mw")
    .select(["mw.platform_global_id", "mw.existing_material_id"])
    .where("mw.program_id", "in", programId)
    .where("mw.existing_material_id", "in", materialIds)
    .execute()
  return associateField(res, "existing_material_id", "platform_global_id")
}

export const getMapStockIds = async (programId: number, stockIds: number[]) => {
  if (stockIds.length === 0) {
    return {}
  }
  const res = await db
    .selectFrom("mapping_stocks as mw")
    .select(["mw.platform_stock_id", "mw.existing_stock_id"])
    .where("mw.program_id", "=", programId)
    .where("mw.existing_stock_id", "in", stockIds)
    .execute()
  return associateField(res, "existing_stock_id", "platform_stock_id")
}

export const getMapBatchIds = async (programId: number, batchIds: number[]) => {
  if (batchIds.length === 0) {
    return {}
  }

  const res = await db
    .selectFrom("mapping_batches as mw")
    .select(["mw.platform_batch_id", "mw.existing_batch_id"])
    .where("mw.program_id", "=", programId)
    .where("mw.existing_batch_id", "in", batchIds)
    .execute()
  return associateField(res, "existing_batch_id", "platform_batch_id")
}

export const getMapOrderIds = async (programId: number, orderIds: number[]) => {
  if (orderIds.length === 0) {
    return {}
  }

  const res = await db
    .selectFrom("mapping_orders as mw")
    .select(["mw.platform_order_id", "mw.existing_order_id"])
    .where("mw.program_id", "=", programId)
    .where("mw.existing_order_id", "in", orderIds)
    .execute()
  return associateField(res, "existing_order_id", "platform_order_id")
}

export const getMapPatientIds = async (
  programId: number,
  patientIds: number[]
) => {
  if (patientIds.length === 0) {
    return {}
  }

  const res = await db
    .selectFrom("mapping_patients as mw")
    .select(["mw.platform_patient_id", "mw.existing_patient_id"])
    .where("mw.program_id", "=", programId)
    .where("mw.existing_patient_id", "in", patientIds)
    .execute()
  return associateField(res, "existing_patient_id", "platform_patient_id")
}

export const getMapSequenceIds = (
  methodId: number | null,
  sequenceId: number | null
) => {
  let mapSequences = {}
  if (!methodId)
    mapSequences = {
      1: {
        sequence_id: 19,
        type_id: null,
      },
      2: {
        sequence_id: 20,
        type_id: null,
      },
    }
  else if (methodId === 1)
    mapSequences = {
      1: { sequence_id: 3, type_id: 2 },
      2: { sequence_id: 4, type_id: 2 },
      3: { sequence_id: 5, type_id: 2 },
      4: { sequence_id: 6, type_id: 3 },
      5: { sequence_id: 7, type_id: 3 },
      6: { sequence_id: 1, type_id: 1 },
      7: { sequence_id: 2, type_id: 1 },
    }
  else if (methodId === 2)
    mapSequences = {
      1: { sequence_id: 10, type_id: 2 },
      8: { sequence_id: 11, type_id: 2 },
      2: { sequence_id: 12, type_id: 2 },
      4: { sequence_id: 13, type_id: 3 },
      5: { sequence_id: 14, type_id: 3 },
      6: { sequence_id: 8, type_id: 1 },
      7: { sequence_id: 9, type_id: 1 },
    }

  return sequenceId ? (mapSequences[sequenceId] || { sequence_id: null, type_id: null }) : { sequence_id: null, type_id: null }
}

export const getMapUserIds = async (programId: number, userIds: number[]) => {
  if (userIds.length === 0) {
    return {}
  }

  const res = await db
    .selectFrom("mapping_users as mw")
    .select(["mw.platform_user_id", "mw.existing_user_id"])
    .where("mw.program_id", "=", programId)
    .where("mw.existing_user_id", "in", userIds)
    .execute()
  return associateField(res, "existing_user_id", "platform_user_id")
}

export const getMapTransactionIds = async (
  programId: number,
  ids: number[]
) => {
  if (ids.length === 0) {
    return {}
  }

  const res = await db
    .selectFrom("mapping_transactions as mt")
    .select(["mt.platform_transaction_id", "mt.existing_transaction_id"])
    .where("mt.program_id", "=", programId)
    .where("mt.existing_transaction_id", "in", ids)
    .execute()
  return associateField(
    res,
    "existing_transaction_id",
    "platform_transaction_id"
  )
}

export const getMapGlobalUserIds = async (userIds: number[]) => {
  if (userIds.length === 0) {
    return {}
  }

  const res = await db
    .selectFrom("mapping_users as mw")
    .select(["mw.platform_global_id", "mw.existing_user_id"])
    .where("mw.existing_user_id", "in", userIds)
    .execute()
  return associateField(res, "existing_user_id", "platform_global_id")
}

export const getMapManufactureIds = async (
  programId: number,
  manufactureIds: number[]
) => {
  if (manufactureIds.length === 0) {
    return {}
  }

  const res = await db
    .selectFrom("mapping_manufactures as mw")
    .select(["mw.platform_manufacture_id", "mw.existing_manufacture_id"])
    .where("mw.program_id", "=", programId)
    .where("mw.existing_manufacture_id", "in", manufactureIds)
    .execute()
  return associateField(
    res,
    "existing_manufacture_id",
    "platform_manufacture_id"
  )
}

export const getMapGlobalManufactureIds = async (
  programId: number,
  manufactureIds: number[]
) => {
  if (manufactureIds.length === 0) {
    return {}
  }

  const res = await db
    .selectFrom("mapping_manufactures as mw")
    .select(["mw.platform_global_id", "mw.existing_manufacture_id"])
    .where("mw.program_id", "=", programId)
    .where("mw.existing_manufacture_id", "in", manufactureIds)
    .execute()
  return associateField(res, "existing_manufacture_id", "platform_global_id")
}

export const getMapBudgetSourceIds = async (
  programId: number,
  budgetSourceIds: number[]
) => {
  if (budgetSourceIds.length === 0) {
    return {}
  }

  const res = await db
    .selectFrom("mapping_budget_sources as mw")
    .select(["mw.platform_budget_source_id", "mw.existing_budget_source_id"])
    .where("mw.program_id", "=", programId)
    .where("mw.existing_budget_source_id", "in", budgetSourceIds)
    .execute()
  return associateField(
    res,
    "existing_budget_source_id",
    "platform_budget_source_id"
  )
}

export const getMapActivityIds = async (
  programId: number,
  activityIds: number[]
) => {
  if (activityIds.length === 0) {
    return {}
  }

  const res = await db
    .selectFrom("mapping_activities as mw")
    .select(["mw.platform_activity_id", "mw.existing_activity_id"])
    .where("mw.program_id", "=", programId)
    .where("mw.existing_activity_id", "in", activityIds)
    .execute()
  return associateField(
    res,
    "existing_activity_id",
    "platform_activity_id"
  ) as Record<number, number>
}

export const getMapAssetTypeIds = async (
  programId: number,
  assetTypeIds: number[]
) => {
  if (assetTypeIds.length === 0) {
    return {}
  }

  const res = await db
    .selectFrom("mapping_asset_types as mat")
    .select(["mat.platform_asset_type_id", "mat.existing_asset_type_id"])
    .where("mat.program_id", "=", programId)
    .where("mat.existing_asset_type_id", "in", assetTypeIds)
    .execute()
  return associateField(res, "existing_asset_type_id", "platform_asset_type_id")
}

export const getMapAssetModelIds = async (
  programId: number,
  assetModelIds: number[]
) => {
  if (assetModelIds.length === 0) {
    return {}
  }

  const res = await db
    .selectFrom("mapping_asset_models as mam")
    .select(["mam.platform_asset_model_id", "mam.existing_asset_model_id"])
    .where("mam.program_id", "=", programId)
    .where("mam.existing_asset_model_id", "in", assetModelIds)
    .execute()
  return associateField(
    res,
    "existing_asset_model_id",
    "platform_asset_model_id"
  )
}

export const getMapAssetVendorTypeIds = async (
  programId: number,
  assetVendorTypeIds: number[]
) => {
  if (assetVendorTypeIds.length === 0) {
    return {}
  }

  const res = await db
    .selectFrom("mapping_asset_vendor_types as mavt")
    .select([
      "mavt.platform_asset_vendor_type_id",
      "mavt.existing_asset_vendor_type_id",
    ])
    .where("mavt.program_id", "=", programId)
    .where("mavt.existing_asset_vendor_type_id", "in", assetVendorTypeIds)
    .execute()
  return associateField(
    res,
    "existing_asset_vendor_type_id",
    "platform_asset_vendor_type_id"
  )
}

export const getMapAssetIds = async (programId: number, assetIds: number[]) => {
  if (assetIds.length === 0) {
    return {}
  }

  const res = await db
    .selectFrom("mapping_assets as ma")
    .select(["ma.platform_asset_id", "ma.existing_asset_id"])
    .where("ma.program_id", "=", programId)
    .where("ma.existing_asset_id", "in", assetIds)
    .execute()
  return associateField(res, "existing_asset_id", "platform_asset_id")
}

export const getMapStockOpnameIds = async (
  programId: number,
  stockOpnameIds: number[]
) => {
  if (stockOpnameIds.length === 0) {
    return {}
  }

  const res = await db
    .selectFrom("mapping_stock_opnames as mso")
    .select(["mso.platform_stock_opname_id", "mso.existing_stock_opname_id"])
    .where("mso.program_id", "=", programId)
    .where("mso.existing_stock_opname_id", "in", stockOpnameIds)
    .execute()
  return associateField(
    res,
    "existing_stock_opname_id",
    "platform_stock_opname_id"
  )
}

export const getMapStockOpnamePeriodIds = async (
  programId: number,
  stockOpnamePeriodIds: number[]
) => {
  if (stockOpnamePeriodIds.length === 0) {
    return {}
  }

  const res = await db
    .selectFrom("mapping_stock_opname_periods as msop")
    .select([
      "msop.platform_stock_opname_period_id",
      "msop.existing_stock_opname_period_id",
    ])
    .where("msop.program_id", "=", programId)
    .where("msop.existing_stock_opname_period_id", "in", stockOpnamePeriodIds)
    .execute()
  return associateField(
    res,
    "existing_stock_opname_period_id",
    "platform_stock_opname_period_id"
  )
}

export const getMapTransactionReasonIds = async (
  programId: number,
  reasonIds: number[]
) => {
  if (reasonIds.length === 0) {
    return {}
  }

  const res = await db
    .selectFrom("mapping_transaction_reasons as mtr")
    .select([
      "mtr.platform_transaction_reason_id",
      "mtr.existing_transaction_reason_id",
    ])
    .where("mtr.program_id", "=", programId)
    .where("mtr.existing_transaction_reason_id", "in", reasonIds)
    .execute()
  return associateField(
    res,
    "existing_transaction_reason_id",
    "platform_transaction_reason_id"
  ) as Record<number, number>
}

export const getMapDisposalStockIds = async (
  programId: number,
  ids: number[]
) => {
  if (ids.length === 0) {
    return {}
  }

  const res = await db
    .selectFrom("mapping_stock_exterminations as mtr")
    .select([
      "mtr.platform_stock_extermination_id",
      "mtr.existing_stock_extermination_id",
    ])
    .where("mtr.program_id", "=", programId)
    .where("mtr.existing_stock_extermination_id", "in", ids)
    .execute()
  return associateField(
    res,
    "existing_stock_extermination_id",
    "platform_stock_extermination_id"
  ) as Record<number, number>
}

export const deleteTableMapping = async (
  table: MappingItem,
  programIds: number[]
) => {
  const tableName = `mapping_${table}`

  // Only execute delete if programIds is not empty
  if (programIds.length > 0) {
    // Delete rows with specified program IDs
    await db
      .deleteFrom(tableName as keyof DB)
      .where("program_id", "in", programIds)
      .execute()

    // Reset auto increment for the table
    await resetIncrement(db, tableName)
  }
}

export const deleteTableMaster = async (
  table: MappingItem,
  programIds: number[]
) => {
  // Only execute delete if programIds is not empty
  if (programIds.length === 0) {
    return
  }

  const singularTable = pluralize.singular(table)
  const mainTableName = table as any
  const workspaceTableName = `${singularTable}_workspaces` as any

  const allowedSql = sql`(${safeSqlJoin(programIds)})`

  const subq = platformDB
    .selectFrom(workspaceTableName)
    .select(`${singularTable}_id`)
    .groupBy(`${singularTable}_id`)
    .having(
      sql`SUM(CASE WHEN workspace_id NOT IN ${allowedSql} THEN 1 ELSE 0 END)`,
      "=",
      0
    )

  // Delete materials that match the subquery
  await platformDB.deleteFrom(mainTableName).where("id", "in", subq).execute()

  // Attempt to delete from the workspace table first if it exists
  await platformDB
    .deleteFrom(workspaceTableName)
    .where("workspace_id", "in", programIds)
    .execute()

  await resetIncrement(platformDB, workspaceTableName)
  await resetIncrement(platformDB, mainTableName)
}

export const resetIncrement = async (db: any, tableName: string) => {
  // Get the maximum ID from the table
  const maxIdResult = await db
    .selectFrom(tableName)
    .select(db.fn.max("id").as("max_id"))
    .executeTakeFirst()

  const maxId = maxIdResult?.max_id || 0
  const nextId = maxId + 1

  // Reset auto increment to next ID
  const excludedTables: string[] = [
    // "budget_source_workspaces",
    // "user_workspaces",
    // "manufactures",
    // "materials",
    // "material_workspaces",
    // "ws_order_audits",
    // "ws_other_reasons",
    // "ws_purchases",
    // "ws_consumptions",
  ]
  if (!excludedTables.includes(tableName)) {
    await db.executeQuery({
      sql: `ALTER TABLE ${tableName} AUTO_INCREMENT = ${nextId}`,
      parameters: [],
    })
  }
}
