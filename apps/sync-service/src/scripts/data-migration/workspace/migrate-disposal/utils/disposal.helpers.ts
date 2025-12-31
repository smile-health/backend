import { db } from "@/common/infrastructure/database/index.js"
import { DB } from "@/common/infrastructure/database/types/db.js"
import { MappingItem } from "@/common/types.js"
import { associateField } from "@smile/lib/utils.js"
import pluralize from "pluralize"

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

  const result = rows.reduce(
    (acc, row) => {
      const key = row.existing_program_id ?? 1
      acc[key] ??= []
      acc[key].push(row.program_id)
      return acc
    },
    {} as Record<number, number[]>
  )
  return result
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
  programId: number[] | number,
  entityIds: number[]
) => {
  if (entityIds.length === 0) {
    return {}
  }

  if (!Array.isArray(programId)) {
    programId = [programId]
  }

  const res = await db
    .selectFrom("mapping_entities as ew")
    .select(["ew.platform_entity_id", "ew.existing_entity_id"])
    .where("ew.program_id", "in", programId)
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

export const getMapStockIds = async (
  programId: number[] | number,
  stockIds: number[]
) => {
  if (stockIds.length === 0) {
    return {}
  }

  if (!Array.isArray(programId)) programId = [programId]

  const res = await db
    .selectFrom("mapping_stocks as mw")
    .select(["mw.platform_stock_id", "mw.existing_stock_id"])
    .where("mw.program_id", "in", programId)
    .where("mw.existing_stock_id", "in", stockIds)
    .execute()
  return associateField(res, "existing_stock_id", "platform_stock_id")
}

export const getMapBatchIds = async (
  programId: number[] | number,
  batchIds: number[]
) => {
  if (batchIds.length === 0) {
    return {}
  }

  if (!Array.isArray(programId)) programId = [programId]

  const res = await db
    .selectFrom("mapping_batches as mw")
    .select(["mw.platform_batch_id", "mw.existing_batch_id"])
    .where("mw.program_id", "in", programId)
    .where("mw.existing_batch_id", "in", batchIds)
    .execute()
  return associateField(res, "existing_batch_id", "platform_batch_id")
}

export const getMapTransactionReasonIds = async (
  programId: number[] | number,
  transactionReasonIds: number[]
) => {
  if (transactionReasonIds.length === 0) {
    return {}
  }

  if (!Array.isArray(programId)) programId = [programId]

  const res = await db
    .selectFrom("mapping_transaction_reasons as mw")
    .select([
      "mw.platform_transaction_reason_id",
      "mw.existing_transaction_reason_id",
    ])
    .where("mw.program_id", "in", programId)
    .where("mw.existing_transaction_reason_id", "in", transactionReasonIds)
    .execute()
  return associateField(
    res,
    "existing_transaction_reason_id",
    "platform_transaction_reason_id"
  )
}

export const getMapOrderIds = async (programId: number, orderIds: number[]) => {
  if (orderIds.length === 0) {
    return {}
  }

  const res = await db
    .selectFrom("mapping_orders as mw")
    .select(["mw.platform_order_id", "mw.existing_order_id"])
    .where("mw.program_id", "in", programId)
    .where("mw.existing_order_id", "in", orderIds)
    .execute()
  return associateField(res, "existing_order_id", "platform_order_id")
}

export const getMapUserIds = async (
  programId: number[] | number,
  userIds: number[]
) => {
  if (userIds.length === 0) {
    return {}
  }

  if (!Array.isArray(programId)) {
    programId = [programId]
  }

  const res = await db
    .selectFrom("mapping_users as mw")
    .select(["mw.platform_user_id", "mw.existing_user_id"])
    .where("mw.program_id", "in", programId)
    .where("mw.existing_user_id", "in", userIds)
    .execute()
  return associateField(res, "existing_user_id", "platform_user_id")
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
    .where("mw.program_id", "in", programId)
    .where("mw.existing_budget_source_id", "in", budgetSourceIds)
    .execute()
  return associateField(
    res,
    "existing_budget_source_id",
    "platform_budget_source_id"
  )
}

export const getMapActivityIds = async (
  programId: number[] | number,
  activityIds: number[]
) => {
  if (activityIds.length === 0) {
    return {}
  }

  if (!Array.isArray(programId)) {
    programId = [programId]
  }

  const res = await db
    .selectFrom("mapping_activities as mw")
    .select(["mw.platform_activity_id", "mw.existing_activity_id"])
    .where("mw.program_id", "in", programId)
    .where("mw.existing_activity_id", "in", activityIds)
    .execute()
  return associateField(
    res,
    "existing_activity_id",
    "platform_activity_id"
  ) as Record<number, number>
}

export const getPlatformProgramIdByPlatformActivityId = async (
  activityId: number
) => {
  if (!activityId) {
    return
  }

  const res = await db
    .selectFrom("mapping_activities as mw")
    .select(["mw.program_id"])
    .where("mw.platform_activity_id", "=", activityId)
    .executeTakeFirst()
  return res?.program_id
}

export const getMapStockExterminationIds = async (
  programId: number | number[],
  stockExterminationIds: number[]
) => {
  if (stockExterminationIds.length === 0) {
    return {}
  }

  if (!Array.isArray(programId)) {
    programId = [programId]
  }

  const res = await db
    .selectFrom("mapping_stock_exterminations as mse")
    .select([
      "mse.platform_stock_extermination_id",
      "mse.existing_stock_extermination_id",
    ])
    .where("mse.program_id", "in", programId)
    .where("mse.existing_stock_extermination_id", "in", stockExterminationIds)
    .execute()
  return associateField(
    res,
    "existing_stock_extermination_id",
    "platform_stock_extermination_id"
  )
}

export const getMapExterminationTransactionTypeIds = async (
  programId: number | number[],
  exterminationTransactionTypeIds: number[]
) => {
  if (exterminationTransactionTypeIds.length === 0) {
    return {}
  }

  if (!Array.isArray(programId)) {
    programId = [programId]
  }

  const res = await db
    .selectFrom("mapping_extermination_transaction_types as mett")
    .select([
      "mett.platform_extermination_transaction_type_id",
      "mett.existing_extermination_transaction_type_id",
    ])
    .where("mett.program_id", "in", programId)
    .where(
      "mett.existing_extermination_transaction_type_id",
      "in",
      exterminationTransactionTypeIds
    )
    .execute()
  return associateField(
    res,
    "existing_extermination_transaction_type_id",
    "platform_extermination_transaction_type_id"
  )
}

export const getMapExterminationFlowIds = async (
  programId: number | number[],
  exterminationFlowIds: number[]
) => {
  if (exterminationFlowIds.length === 0) {
    return {}
  }

  if (!Array.isArray(programId)) {
    programId = [programId]
  }

  const res = await db
    .selectFrom("mapping_extermination_flows as mef")
    .select([
      "mef.platform_extermination_flow_id",
      "mef.existing_extermination_flow_id",
    ])
    .where("mef.program_id", "in", programId)
    .where("mef.existing_extermination_flow_id", "in", exterminationFlowIds)
    .execute()
  return associateField(
    res,
    "existing_extermination_flow_id",
    "platform_extermination_flow_id"
  )
}

export const getMapExterminationShipmentIds = async (
  programId: number | number[],
  exterminationShipmentIds: number[]
) => {
  if (exterminationShipmentIds.length === 0) {
    return {}
  }
  if (!Array.isArray(programId)) {
    programId = [programId]
  }
  const res = await db
    .selectFrom("mapping_extermination_shipments as mes")
    .select([
      "mes.platform_extermination_shipment_id",
      "mes.existing_extermination_shipment_id",
    ])
    .where("mes.program_id", "in", programId)
    .where(
      "mes.existing_extermination_shipment_id",
      "in",
      exterminationShipmentIds
    )
    .execute()
  return associateField(
    res,
    "existing_extermination_shipment_id",
    "platform_extermination_shipment_id"
  )
}

export const getMapExterminationShipmentItemIds = async (
  programId: number | number[],
  exterminationShipmentItemIds: number[]
) => {
  if (exterminationShipmentItemIds.length === 0) {
    return {}
  }
  if (!Array.isArray(programId)) {
    programId = [programId]
  }
  const res = await db
    .selectFrom("mapping_extermination_shipment_items as mes")
    .select([
      "mes.platform_extermination_shipment_item_id",
      "mes.existing_extermination_shipment_item_id",
    ])
    .where("mes.program_id", "in", programId)
    .where(
      "mes.existing_extermination_shipment_item_id",
      "in",
      exterminationShipmentItemIds
    )
    .execute()
  return associateField(
    res,
    "existing_extermination_shipment_item_id",
    "platform_extermination_shipment_item_id"
  )
}
