import { CustomContext } from "@smile/lib/types/context.js"
import { associate, collect } from "@smile/lib/utils.js"
import { AnyColumn, Insertable, ReferenceExpression } from "kysely"
import { isArray } from "lodash"
import pluralize from "pluralize"
import { DB } from "./infrastructure/database/types/db.js"
import { MappingItem } from "./types.js"

export async function getMapProgramIds(
  c: CustomContext<DB>,
  programIds: number[]
) {
  const rows = await c.var.trx
    .selectFrom("mapping_programs")
    .select(["existing_program_id", "platform_program_id"])
    .where("platform_program_id", "in", programIds)
    .distinct()
    .execute()

  return rows.reduce(
    (acc, row) => {
      const key = row.existing_program_id || 1
      acc[key] ??= []
      acc[key].push(row.platform_program_id)
      return acc
    },
    {} as Record<number, number[]>
  )
}

export async function getExistingId(
  c: CustomContext<DB>,
  table: MappingItem,
  platformId: number | undefined | null,
  programId?: number
) {
  if (!platformId) {
    return
  }

  const tableName = `mapping_${table}`
  const columnName = pluralize.singular(table)
  const platformIdColumn = `platform_${columnName}_id`
  const existingIdColumn = `existing_${columnName}_id`

  const row = await c.var.trx
    .selectFrom(tableName as keyof DB)
    .where(
      platformIdColumn as unknown as ReferenceExpression<DB, keyof DB>,
      "=",
      platformId
    )
    .$if(table !== "programs", (qb) =>
      qb.where("program_id", "=", programId ?? 1)
    )
    .selectAll()
    .executeTakeFirst()

  return row ? row[existingIdColumn] : null
}

export async function getPlatformId(
  c: CustomContext<DB>,
  table: MappingItem,
  platformId: number | undefined | null,
  programId: number | null
) {
  if (!platformId || !programId) {
    return
  }

  const tableName = `mapping_${table}`
  const columnName = pluralize.singular(table)
  const platformIdColumn = `platform_${columnName}_id`
  const existingIdColumn = `existing_${columnName}_id`

  const row = await c.var.trx
    .selectFrom(tableName as keyof DB)
    .where(
      existingIdColumn as unknown as ReferenceExpression<DB, keyof DB>,
      "=",
      platformId
    )
    .where("program_id", "=", programId)
    .selectAll()
    .executeTakeFirst()

  return row ? row[platformIdColumn] : null
}

export async function getExistingIds(
  c: CustomContext<DB>,
  table: MappingItem,
  platformIds: number[] | undefined,
  programId: number | null
) {
  const tableName = `mapping_${table}`
  const columnName = pluralize.singular(table)
  const platformIdColumn = `platform_${columnName}_id`
  const existingIdColumn = `existing_${columnName}_id`

  if (!platformIds || platformIds.length === 0) {
    return []
  }

  const rows = await c.var.trx
    .selectFrom(tableName as keyof DB)
    .where(
      platformIdColumn as unknown as ReferenceExpression<DB, keyof DB>,
      "in",
      platformIds
    )
    .where("program_id", "=", programId)
    .selectAll()
    .execute()

  return collect(rows, existingIdColumn as AnyColumn<DB, keyof DB>) as number[]
}

export async function getMapExistingIds(
  c: CustomContext<DB>,
  table: MappingItem,
  platformIds: number[] | undefined,
  programId: number | null
) {
  const tableName = `mapping_${table}`
  const columnName = pluralize.singular(table)
  const platformIdColumn = `platform_${columnName}_id`
  const existingIdColumn = `existing_${columnName}_id`

  if (!platformIds || platformIds.length === 0) {
    return []
  }

  const rows = await c.var.trx
    .selectFrom(tableName as keyof DB)
    .where(
      platformIdColumn as unknown as ReferenceExpression<DB, keyof DB>,
      "in",
      platformIds
    )
    .where("program_id", "=", programId)
    .selectAll()
    .execute()

  return associate(
    rows,
    platformIdColumn as AnyColumn<DB, keyof DB>,
    existingIdColumn as AnyColumn<DB, keyof DB>
  ) as object
}

export async function getMapPlatformIds(
  c: CustomContext<DB>,
  table: MappingItem,
  existingIds: number[] | undefined,
  programId: number | null
) {
  const tableName = `mapping_${table}`
  const columnName = pluralize.singular(table)
  const platformIdColumn = `platform_${columnName}_id`
  const existingIdColumn = `existing_${columnName}_id`

  if (!existingIds || existingIds.length === 0) {
    return []
  }

  const rows = await c.var.trx
    .selectFrom(tableName as keyof DB)
    .where(
      existingIdColumn as unknown as ReferenceExpression<DB, keyof DB>,
      "in",
      existingIds
    )
    .where("program_id", "=", programId)
    .selectAll()
    .execute()

  return associate(
    rows,
    existingIdColumn as AnyColumn<DB, keyof DB>,
    platformIdColumn as AnyColumn<DB, keyof DB>
  ) as object
}

export async function insertMapping<T extends keyof DB>(
  c: CustomContext<DB>,
  table: T,
  data: Insertable<DB[T]> | Insertable<DB[T]>[]
) {
  if (isArray(data) && data.length === 0) {
    return
  }

  return await c.var.trx
    .insertInto(table)
    .values(data)
    .onDuplicateKeyUpdate({ id: (eb) => eb.ref("id") })
    .execute()
}
