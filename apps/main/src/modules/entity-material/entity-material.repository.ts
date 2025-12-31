import {
  KFA_LEVEL_CODE_TO_ID,
  KFA_LEVEL_ID,
} from "@/common/constants/material.js"
import { db } from "@/common/infrastructure/database/index.js"
import {
  DB,
  WsEntityMaterialActivities,
} from "@/common/infrastructure/database/types/db.js"
import { Context } from "@smile/lib/types/context.js"
import { associate } from "@smile/lib/utils.js"
import {
  ComparisonOperatorExpression,
  Expression,
  Insertable,
  InsertResult,
  ReferenceExpression,
  sql,
  SqlBool,
  Updateable,
} from "kysely"
import { GetEntitiesQueries } from "../entity/entity.schema.js"
import {
  CreateEntityMaterialActivityDTO,
  CreateLogImportEntityMaterialDTO,
  EntityUpdateUserAndDateDTO,
  GetEntityMaterialsParams,
  GetEntityMaterialsQueries,
  GetImportEntityMaterialQueries,
} from "./entity-material.schema.js"

export class EntityMaterialRepository {
  async findAllMaterialEntityGrouped(
    c: Context<DB>,
    queries: GetEntityMaterialsQueries,
    params: GetEntityMaterialsParams,
    programId: number,
    isKFAEnabled: boolean = false
  ) {
    const offset = (queries.page - 1) * queries.paginate
    const query = c.var.trx
      .selectFrom("ws_entity_material_activities as emma")
      // .leftJoin(
      //   "entity_has_ws_materials as ehmm",
      //   "ehmm.id",
      //   "emma.entity_master_material_id"
      // )
      .leftJoin("ws_materials as mm", "mm.id", "emma.material_id")
      .leftJoin("ws_activities as ma", "ma.id", "emma.activity_id")
      .$if(isKFAEnabled, (qb) =>
        qb.where(
          "mm.material_level_id",
          "=",
          KFA_LEVEL_CODE_TO_ID[queries.kfa_level ?? 0] ?? KFA_LEVEL_ID.TEMPLATE
        )
      )
      .$if(queries.keyword != null, (qb) =>
        qb.where("mm.name", "like", `%${queries.keyword}%`)
      )
      .where("mm.program_id", "=", programId)
      .where("ma.program_id", "=", programId)
      .where("emma.entity_id", "=", params.entityId)
      .where("emma.deleted_at", "is", null)

    const [data, count] = await Promise.all([
      query
        .select([
          "emma.material_id",
          "mm.name",
          "mm.min_temperature",
          "mm.max_temperature",
        ])
        .limit(queries.paginate)
        .offset(offset)
        .orderBy("emma.updated_at", "desc")
        .groupBy("emma.material_id")
        .execute(),
      query
        .select(() => sql<string>`count(distinct emma.material_id)`.as("total"))
        .executeTakeFirstOrThrow(),
    ])

    return { data, total: Number(count.total) }
  }

  async findAll(
    c: Context<DB>,
    queries: GetEntityMaterialsQueries,
    params: GetEntityMaterialsParams,
    materialIds: number[],
    programId: number,
    isKFAEnabled: boolean = false
  ) {
    return c.var.trx
      .selectFrom("ws_entity_material_activities as emma")
      .leftJoin("ws_materials as mm", "mm.id", "emma.material_id")
      .leftJoin("ws_activities as ma", "ma.id", "emma.activity_id")
      .selectAll("emma")
      .where("mm.program_id", "=", programId)
      .where("ma.program_id", "=", programId)
      .where("emma.entity_id", "=", params.entityId)
      .where("emma.deleted_at", "is", null)
      .$if(materialIds.length !== 0, (qb) =>
        qb.where("emma.material_id", "in", materialIds)
      )
      .$if(queries.keyword != null, (qb) =>
        qb.where("mm.name", "like", `%${queries.keyword}%`)
      )
      .$if(isKFAEnabled, (qb) =>
        qb.where(
          "mm.material_level_id",
          "=",
          KFA_LEVEL_CODE_TO_ID[queries.kfa_level ?? 0] ?? KFA_LEVEL_ID.TEMPLATE
        )
      )
      .orderBy("emma.updated_at desc")
      .execute()
  }

  async findDynamicMaterial<T>(
    c: Context<DB>,
    whereClause: ReferenceExpression<DB, "ws_materials">,
    operator: ComparisonOperatorExpression,
    value: T,
    programId: number
  ) {
    const data = await c.var.trx
      .selectFrom("ws_materials")
      .where(whereClause, operator, value)
      .where("program_id", "=", programId)
      .selectAll()
      .orderBy("name asc")
      .execute()
    return data
  }

  async getMaterialHasActivity(
    c: Context<DB>,
    activityIDs: number[],
    materialIDs: number[],
    programId: number
  ) {
    const data = await c.var.trx
      .selectFrom("ws_material_activities as wma")
      .leftJoin("ws_activities as ma", "ma.id", "wma.activity_id")
      .leftJoin("ws_materials as mm", "mm.id", "wma.material_id")
      .where("ma.program_id", "=", programId)
      .where("mm.program_id", "=", programId)
      .$if(materialIDs.length > 0, (qb) =>
        qb.where("wma.material_id", "in", materialIDs)
      )
      .$if(activityIDs.length > 0, (qb) =>
        qb.where("wma.activity_id", "in", activityIDs)
      )
      .selectAll()
      .execute()
    return data
  }

  async findDynamicEntity<T>(
    c: Context<DB>,
    whereClause: ReferenceExpression<DB, "ws_entities">,
    operator: ComparisonOperatorExpression,
    value: T
  ) {
    const data = await c.var.trx
      .selectFrom("ws_entities")
      .where(whereClause, operator, value)
      .selectAll()
      .execute()
    return data
  }

  async findDynamicEntityMaterialActivity<T>(
    c: Context<DB>,
    whereClause: ReferenceExpression<DB, "ws_entity_material_activities">,
    operator: ComparisonOperatorExpression,
    value: T,
    programId: number,
    withDeleted: boolean = false,
    deletedMaterialActivity: boolean = false
  ) {
    const data = await c.var.trx
      .selectFrom("ws_entity_material_activities as emma")
      .leftJoin("ws_activities as ma", "ma.id", "emma.activity_id")
      .leftJoin("ws_materials as mm", "mm.id", "emma.material_id")
      .where("ma.program_id", "=", programId)
      .where("mm.program_id", "=", programId)
      .where(sql.ref(`emma.${whereClause}`), operator, value)
      .$if(!withDeleted, (qb) => qb.where("emma.deleted_at", "is", null))
      .$if(deletedMaterialActivity, (qb) =>
        qb.where((eb) =>
          eb.or([eb("ma.deleted_at", "is", null), eb("ma.status", "=", 1)])
        )
      )
      .$if(deletedMaterialActivity, (qb) =>
        qb.where((eb) =>
          eb.or([eb("mm.deleted_at", "is", null), eb("mm.status", "=", 1)])
        )
      )
      .selectAll("emma")
      .select([
        "mm.material_level_id as material_level_id",
        "mm.parent_id as parent_id",
      ])
      .execute()
    return data
  }

  async findAppDataMaterial(
    c: Context<DB>,
    entityId: number,
    programId: number,
    isHierarchy: boolean = false,
    isKFAEnabled?: boolean
  ) {
    const data = await c.var.trx
      .selectFrom("ws_entity_material_activities as ema")
      .innerJoin(
        "ws_materials as m",
        isHierarchy ? "m.parent_id" : "m.id",
        "ema.material_id"
      )
      .where("m.program_id", "=", programId)
      .where("ema.entity_id", "=", entityId)
      .where("ema.deleted_at", "is", null)
      .where("m.deleted_at", "is", null)
      .where("m.status", "=", 1)
      .$if(!isHierarchy, (qb) =>
        qb.where(
          "m.material_level_id",
          "=",
          isKFAEnabled ? KFA_LEVEL_ID.TEMPLATE : KFA_LEVEL_ID.VARIANT
        )
      )
      .select([
        "m.material_level_id as material_level_id",
        "m.parent_id as parent_id",
        "m.id as material_id",
        "ema.activity_id",
        "ema.min",
        "ema.max",
      ])
      .execute()

    return data
  }

  async getMaterialEntityMapped(
    c: Context<DB>,
    entityMaterialIds: number[],
    materialIds: number[],
    programId: number
  ) {
    if (entityMaterialIds.length === 0) return {}
    const entityMaterials = await c.var.trx
      .selectFrom("ws_entity_material_activities as emma")
      .leftJoin("ws_activities as ma", "ma.id", "emma.activity_id")
      .select([
        "emma.id",
        "emma.material_id",
        "emma.entity_id",
        "emma.min",
        "emma.max",
        sql<number>`0`.as("total_allocated_qty"),
        sql<number>`0`.as("total_available_qty"),
        "emma.updated_at",
      ])
      .where("emma.id", "in", entityMaterialIds)
      .where("emma.material_id", "in", materialIds)
      .where("ma.program_id", "=", programId)
      .execute()

    return associate(entityMaterials, "id")
  }

  async getEntityMaterialsByEntityIDandMaterialID(
    c: Context<DB>,
    programId: number,
    entityID: number,
    materialID: number,
    activityID?: number
    // withActivity: boolean = false
  ) {
    const entityMaterialsID = await c.var.trx
      .selectFrom("ws_entity_material_activities as emma")
      .leftJoin("ws_activities as ma", "ma.id", "emma.activity_id")
      .leftJoin("ws_materials as mm", "mm.id", "emma.material_id")
      .select([
        "emma.id",
        "emma.entity_id",
        "emma.material_id",
        "emma.deleted_at",
      ])
      .where("ma.program_id", "=", programId)
      .where("mm.program_id", "=", programId)
      .where("emma.entity_id", "=", entityID)
      .where("emma.material_id", "=", materialID)
      .$if(!!activityID, (qb) => qb.where("emma.activity_id", "=", activityID!))
      .executeTakeFirst()
    return entityMaterialsID
  }

  async getEntityMaterialActivities(
    c: Context<DB>,
    entityID: number,
    materialID: number,
    activityID: number,
    programId: number
  ) {
    const entityMaterialActivities = await c.var.trx
      .selectFrom("ws_entity_material_activities as emma")
      .leftJoin("ws_activities as ma", "ma.id", "emma.activity_id")
      .leftJoin("ws_materials as mm", "mm.id", "emma.material_id")
      .selectAll()
      .where("ma.program_id", "=", programId)
      .where("mm.program_id", "=", programId)
      .where("emma.entity_id", "=", entityID)
      .where("emma.material_id", "=", materialID)
      .where("emma.activity_id", "=", activityID)
      .execute()
    return entityMaterialActivities
  }

  async createEntityMaterial(
    c: Context<DB>,
    data: Insertable<WsEntityMaterialActivities>
  ): Promise<InsertResult[]> {
    if (!data) return []
    return await c.var.trx
      .insertInto("ws_entity_material_activities")
      .values(data)
      .execute()
  }

  async updateUserAndDateEntity(
    c: Context<DB>,
    id: number,
    data: EntityUpdateUserAndDateDTO
  ) {
    const [result, entity] = await Promise.all([
      c.var.trx
        .updateTable("entity_workspaces")
        .set(data)
        .where("id", "=", id)
        .executeTakeFirstOrThrow(),
      c.var.trx
        .selectFrom("ws_entities")
        // .selectAll()
        .select(["global_id"])
        .where("id", "=", id)
        .executeTakeFirstOrThrow(),
    ])
    await c.var.trx
      .updateTable("entities")
      .set(data)
      .where("id", "=", entity.global_id)
      .executeTakeFirstOrThrow()

    return result
  }

  async createEntityMaterialActivity(
    c: Context<DB>,
    data: CreateEntityMaterialActivityDTO
  ): Promise<InsertResult[]> {
    const result = await c.var.trx
      .insertInto("ws_entity_material_activities")
      .values(data)
      .execute()
    return result
  }

  async updateEntityMaterial<
    T extends { [key: string]: string | number | Date | null },
  >(c: Context<DB>, id: number, data: T) {
    const result = await c.var.trx
      .updateTable("ws_entity_material_activities")
      .set(data)
      .where("id", "=", id)
      .executeTakeFirstOrThrow()
    return result
  }

  async getEntityMaterialActivity(
    c: Context<DB>,
    id: number[],
    activityID: number[],
    entityMaterialId: number[],
    programId: number,
    withDeleted: boolean = false
  ) {
    const result = await c.var.trx
      .selectFrom("ws_entity_material_activities as emma")
      .leftJoin("ws_activities as ma", "ma.id", "emma.activity_id")
      .leftJoin("ws_materials as mm", "mm.id", "emma.material_id")
      .where("ma.program_id", "=", programId)
      .where("mm.program_id", "=", programId)
      .$if(id.length > 0, (qb) => qb.where("id", "in", id))
      .$if(activityID.length > 0, (qb) =>
        qb.where("emma.activity_id", "in", activityID)
      )
      .$if(activityID.length > 0, (qb) =>
        qb.where("emma.id", "in", entityMaterialId)
      )
      .$if(!withDeleted, (qb) => qb.where("emma.deleted_at", "is", null))
      .selectAll("emma")
      .execute()
    return result
  }

  async updateEntityMaterialActivity(
    c: Context<DB>,
    id: number,
    data: Updateable<WsEntityMaterialActivities>
  ) {
    const result = await c.var.trx
      .updateTable("ws_entity_material_activities")
      .set(data)
      .where("id", "=", id)
      .execute()
    return result
  }

  async getMaterialChild(
    c: Context<DB>,
    id: number[],
    activityID: number,
    programId: number
  ) {
    const data = await c.var.trx
      .selectFrom("ws_materials as mm")
      .leftJoin("ws_material_activities as mmha", "mmha.material_id", "mm.id")
      .leftJoin("ws_activities as ma", "ma.id", "mmha.activity_id")
      .where("ma.program_id", "=", programId)
      .where("mm.program_id", "=", programId)
      .where("mmha.activity_id", "=", activityID)
      .where("mm.parent_id", "in", id)
      .where("mm.material_level_id", "=", KFA_LEVEL_ID.VARIANT)
      .where("mm.deleted_at", "is", null)
      .select([
        "mm.id",
        "mm.name",
        "mm.material_level_id",
        "mm.parent_id",
        "mm.parent_global_id",
        "mmha.activity_id",
      ])
      .execute()
    return data
  }

  async getEntityMaterialActiveOrder(
    c: Context<DB>,
    entityId: number,
    materialIds: number[],
    programId: number,
    activityId: number
  ) {
    const data = await c.var.trx
      .selectFrom("ws_orders as order")
      .leftJoin("ws_order_item_stocks as oi", "oi.order_id", "order.id")
      .leftJoin("ws_activities as ma", "ma.id", "order.activity_id")
      .leftJoin("ws_materials as mm", "mm.id", "oi.material_id")
      .select((fn) => fn.fn.countAll().as("total"))
      .where((eb) =>
        eb.or([
          eb("order.customer_id", "=", entityId),
          eb("order.vendor_id", "=", entityId),
        ])
      )
      .where("ma.program_id", "=", programId)
      .where("mm.program_id", "=", programId)
      .where("oi.material_id", "in", materialIds)
      .where("order.activity_id", "=", activityId)
      .executeTakeFirstOrThrow()
    return data
  }

  async getEntityMaterialActiveTransaction(
    c: Context<DB>,
    entityId: number,
    programId: number,
    materialIds: number[],
    activity_id: number
  ) {
    const data = await c.var.trx
      .selectFrom("ws_transactions as tr")
      .leftJoin("ws_activities as ma", "ma.id", "tr.activity_id")
      .leftJoin("ws_stocks as ws", "ws.id", "tr.stock_id")
      .select((fn) => fn.fn.countAll().as("total"))
      .where("ma.program_id", "=", programId)
      .where("ws.entity_id", "=", entityId)
      .where("ws.activity_id", "=", activity_id)
      .where("ws.material_id", "in", materialIds)
      .executeTakeFirstOrThrow()
    return data
  }

  async getEntityMaterialWithEntityIdAndParentMaterialId(
    c: Context<DB>,
    entityId: number,
    materialId: number,
    programId: number
  ) {
    const data = await c.var.trx
      .selectFrom("ws_entity_material_activities as emma")
      .leftJoin("ws_materials as mm", "mm.id", "emma.material_id")
      .leftJoin("ws_activities as ma", "ma.id", "emma.activity_id")
      .select(["emma.id as id", "mm.id as material_id"])
      .where("emma.entity_id", "=", entityId)
      .where("mm.parent_id", "=", materialId)
      .where("mm.program_id", "=", programId)
      .where("ma.program_id", "=", programId)
      .where("emma.deleted_at", "is", null)
      .execute()

    return data
  }

  async getEntityMaterialActivityWithEntityIdAndParentMaterialId(
    c: Context<DB>,
    entityId: number,
    activityId: number,
    materialId: number[],
    programId: number
  ) {
    const data = await c.var.trx
      .selectFrom("ws_entity_material_activities as emma")
      // .leftJoin(
      //   "entity_has_ws_materials as ehmm",
      //   "ehmm.id",
      //   "emma.entity_master_material_id"
      // )
      .leftJoin("ws_materials as mm", "mm.id", "emma.material_id")
      .leftJoin("ws_activities as ma", "ma.id", "emma.activity_id")
      .select([
        "emma.id as emma_id",
        // "ehmm.id as ehmm_id",
        "emma.activity_id as emma_activity_id",
        "mm.id as mm_id",
      ])
      .where("emma.activity_id", "=", activityId)
      .where("mm.parent_id", "in", materialId)
      .where("mm.program_id", "=", programId)
      .where("ma.program_id", "=", programId)
      .where("emma.entity_id", "=", entityId)
      .execute()
    return data
  }

  getEntityStream(
    c: Context<DB>,
    query: GetEntitiesQueries & { village_ids: string[] },
    programId: number
  ) {
    const {
      keyword,
      type_ids,
      province_ids,
      regency_ids,
      sub_district_ids,
      village_ids,
      entity_tag_ids,
    } = query
    return c.var.trx
      .selectFrom("ws_entities as e")
      .where("e.is_vendor", "=", 1)
      .where("e.status", "=", 1)
      .where("e.deleted_at", "is", null)
      .$if(keyword != null, (qb) => qb.where("e.name", "like", `%${keyword}%`))
      .$if(village_ids?.length !== 0, (qb) =>
        qb.where("e.village_id", "in", village_ids)
      )
      .$if(sub_district_ids?.length !== 0, (qb) =>
        qb.where("e.sub_district_id", "in", sub_district_ids ?? [])
      )
      .$if(regency_ids?.length !== 0, (qb) =>
        qb.where("e.regency_id", "in", regency_ids ?? [])
      )
      .$if(province_ids?.length !== 0, (qb) =>
        qb.where("e.province_id", "in", province_ids ?? [])
      )
      .$if(type_ids?.length !== 0, (qb) =>
        qb.where("e.type", "in", type_ids?.map(Number) ?? [])
      )
      .$if(entity_tag_ids?.length !== 0, (qb) =>
        qb.where("e.entity_tag_id", "in", entity_tag_ids?.map(Number) ?? [])
      )
      .where("e.program_id", "=", programId)
      .select(["e.id as id", "e.name as name"])
      .stream()
  }

  async createLogImportEntityMaterial(
    c: Context<DB> | null,
    data: CreateLogImportEntityMaterialDTO
  ) {
    const dbConnection = c ? c.var.trx : db
    return await dbConnection
      .insertInto("ws_entity_material_import_logs")
      .values(data)
      .execute()
  }

  async findLogImportEntityMaterialAll(
    c: Context<DB>,
    queries: GetImportEntityMaterialQueries,
    programId: number
  ) {
    const startDate = queries.start_date
      ? new Date(queries.start_date).setHours(0, 0, 0, 0)
      : null

    const endDate = queries.end_date
      ? new Date(queries.end_date).setHours(23, 59, 59, 999)
      : null
    const offset = (queries.page - 1) * queries.paginate
    const query = c.var.trx
      .selectFrom("ws_entity_material_import_logs")
      .where((query) => {
        const filters: Expression<SqlBool>[] = []
        if (startDate) {
          filters.push(query("created_at", ">=", new Date(startDate)))
        }
        if (endDate) {
          filters.push(query("created_at", "<=", new Date(endDate)))
        }
        return query.and(filters)
      })
      .where("deleted_at", "is", null)
      .where("program_id", "=", programId)

    const [data, count] = await Promise.all([
      query
        .select(["file", "status", "notes", "created_at", "created_by"])
        .limit(queries.paginate)
        .offset(offset)
        .orderBy("created_at", "desc")
        .execute(),
      query
        .select((fn) => fn.fn.countAll().as("total"))
        .executeTakeFirstOrThrow(),
    ])

    return { data, total: Number(count.total) }
  }

  async findById(c: Context<DB>, id: number) {
    return await c.var.trx
      .selectFrom("ws_entity_material_activities")
      .selectAll()
      .where("id", "=", id)
      .executeTakeFirst()
  }

  async getTotalMinMax(c: Context<DB>, entityId: number, materialId: number) {
    return await c.var.trx
      .selectFrom("ws_entity_material_activities as ema")
      .select([sql`SUM(ema.min)`.as("min"), sql`SUM(ema.max)`.as("max")])
      .where("ema.entity_id", "=", entityId)
      .where("ema.material_id", "=", materialId)
      .executeTakeFirst()
  }

  async getHierarchyTotalMinMax(
    c: Context<DB>,
    entityId: number,
    materialId: number
  ) {
    return await c.var.trx
      .selectFrom("ws_entity_material_activities as ema")
      .select([sql`SUM(ema.min)`.as("min"), sql`SUM(ema.max)`.as("max")])
      .innerJoin("ws_materials as m", "m.id", "ema.material_id")
      .where("ema.entity_id", "=", entityId)
      .where("m.parent_id", "=", materialId)
      .executeTakeFirst()
  }

  async getEntityMaterialByEntityIDandMaterialCode(
    c: Context<DB>,
    entityID: number,
    materialCode: string,
    activityID?: number
  ) {
    const result = await c.var.trx
      .selectFrom("ws_entity_material_activities as emma")
      .leftJoin("ws_activities as ma", "ma.id", "emma.activity_id")
      .leftJoin("ws_materials as mm", "mm.id", "emma.material_id")
      .select([
        "emma.id",
        "emma.entity_id",
        "emma.material_id",
        "emma.deleted_at",
      ])
      .where("emma.entity_id", "=", entityID)
      .where("mm.code", "=", materialCode)
      .$if(!!activityID, (qb) => qb.where("emma.activity_id", "=", activityID!))
      .executeTakeFirst()
    return result
  }
}
