import {
  KFA_LEVEL_CODE_TO_ID,
  KFA_LEVEL_ID,
} from "@/common/constants/material.js"
import { DB } from "@/common/infrastructure/database/types/db.js"
import { Context } from "@smile/lib/types/context.js"
import { associate } from "@smile/lib/utils.js"
import {
  ComparisonOperatorExpression,
  Expression,
  InsertResult,
  ReferenceExpression,
  sql,
  SqlBool,
} from "kysely"
import {
  CreateEntityMaterialActivityDTO,
  CreateLogImportEntityMaterialDTO,
  EntityMaterialDTO,
  GetEntityMaterialsParams,
  GetEntityMaterialsQueries,
  GetImportEntityMaterialQueries,
} from "./entity-material.schema.js"
import { GetEntitiesQueries } from "../entity/entity.schema.js"
import { db } from "@/common/infrastructure/database/index.js"

export class EntityMaterialRepository {
  async findAllMaterialEntityGrouped(
    c: Context<DB>,
    queries: GetEntityMaterialsQueries,
    params: GetEntityMaterialsParams,
    isKFAEnabled: boolean = false
  ) {
    const offset = (queries.page - 1) * queries.paginate
    const query = c.var.trx
      .selectFrom("entity_master_material_activities as emma")
      .leftJoin(
        "entity_has_master_materials as ehmm",
        "ehmm.id",
        "emma.entity_master_material_id"
      )
      .leftJoin("master_materials as mm", "mm.id", "ehmm.master_material_id")
      .$if(isKFAEnabled, (qb) =>
        qb.where(
          "mm.kfa_level_id",
          "=",
          KFA_LEVEL_CODE_TO_ID[queries.kfa_level ?? 0] ?? KFA_LEVEL_ID.TEMPLATE
        )
      )
      .$if(queries.keyword != null, (qb) =>
        qb.where("mm.name", "like", `%${queries.keyword}%`)
      )
      .where("ehmm.entity_id", "=", params.entityId)
      .where("emma.deleted_at", "is", null)

    const [data, count] = await Promise.all([
      query
        .select([
          "ehmm.master_material_id",
          "mm.name",
          "mm.temperature_min",
          "mm.temperature_max",
        ])
        .limit(queries.paginate)
        .offset(offset)
        .orderBy("emma.updated_at", "desc")
        .groupBy("ehmm.master_material_id")
        .execute(),
      query
        .select(() =>
          sql<string>`count(distinct ehmm.master_material_id)`.as("total")
        )
        .executeTakeFirstOrThrow(),
    ])

    return { data, total: Number(count.total) }
  }

  async findAll(
    c: Context<DB>,
    queries: GetEntityMaterialsQueries,
    params: GetEntityMaterialsParams,
    materialIds: number[],
    isKFAEnabled: boolean = false
  ) {
    return c.var.trx
      .selectFrom("entity_master_material_activities as emma")
      .leftJoin(
        "entity_has_master_materials as ehmm",
        "ehmm.id",
        "emma.entity_master_material_id"
      )
      .leftJoin("master_materials as mm", "mm.id", "ehmm.master_material_id")
      .selectAll("emma") // Memilih semua kolom dari alias "emma"
      .select("ehmm.master_material_id")
      .select((eb) =>
        sql`${eb.ref("emma.stock_on_hand")} - ${eb.ref("emma.allocated")}`.as(
          "available"
        )
      )
      .where("ehmm.entity_id", "=", params.entityId)
      .where("emma.deleted_at", "is", null)
      .$if(materialIds.length !== 0, (qb) =>
        qb.where("ehmm.master_material_id", "in", materialIds)
      )
      .$if(queries.keyword != null, (qb) =>
        qb.where("mm.name", "like", `%${queries.keyword}%`)
      )
      .$if(isKFAEnabled, (qb) =>
        qb.where(
          "mm.kfa_level_id",
          "=",
          KFA_LEVEL_CODE_TO_ID[queries.kfa_level ?? 0] ?? KFA_LEVEL_ID.TEMPLATE
        )
      )
      .orderBy("updated_at")
      .execute()
  }

  async findDynamicMaterial<T>(
    c: Context<DB>,
    whereClause: ReferenceExpression<DB, "master_materials">,
    operator: ComparisonOperatorExpression,
    value: T
  ) {
    const data = await c.var.trx
      .selectFrom("master_materials")
      .where(whereClause, operator, value)
      .selectAll()
      .execute()
    return data
  }

  async getMaterialHasActivity(
    c: Context<DB>,
    activityIDs: number[],
    materialIDs: number[]
  ) {
    const data = await c.var.trx
      .selectFrom("master_material_has_activities")
      .$if(materialIDs.length > 0, (qb) =>
        qb.where("master_material_id", "in", materialIDs)
      )
      .$if(activityIDs.length > 0, (qb) =>
        qb.where("activity_id", "in", activityIDs)
      )
      .selectAll()
      .execute()
    return data
  }

  async findDynamicEntity<T>(
    c: Context<DB>,
    whereClause: ReferenceExpression<DB, "entities">,
    operator: ComparisonOperatorExpression,
    value: T
  ) {
    const data = await c.var.trx
      .selectFrom("entities")
      .where(whereClause, operator, value)
      .selectAll()
      .execute()
    return data
  }

  async findDynamicEntityMaterialActivity<T>(
    c: Context<DB>,
    whereClause: ReferenceExpression<DB, "entity_master_material_activities">,
    operator: ComparisonOperatorExpression,
    value: T,
    withDeleted: boolean = false
  ) {
    const data = await c.var.trx
      .selectFrom("entity_master_material_activities")
      .where(whereClause, operator, value)
      .$if(!withDeleted, (qb) => qb.where("deleted_at", "is", null))
      .selectAll()
      .execute()
    return data
  }

  async findDynamicEntityMaterial<T>(
    c: Context<DB>,
    whereClause: ReferenceExpression<DB, "entity_has_master_materials">,
    operator: ComparisonOperatorExpression,
    value: T,
    withDeleted: boolean = false
  ) {
    const data = await c.var.trx
      .selectFrom("entity_has_master_materials")
      .where(whereClause, operator, value)
      .$if(!withDeleted, (qb) => qb.where("deleted_at", "is", null))
      .selectAll()
      .execute()
    return data
  }

  async getMaterialEntityMapped(c: Context<DB>, entityMaterialIds: number[]) {
    if (entityMaterialIds.length === 0) return {}
    const entityMaterials = await c.var.trx
      .selectFrom("entity_has_master_materials")
      .select([
        "id",
        "master_material_id",
        "entity_id",
        "min",
        "max",
        "allocated_stock",
        "on_hand_stock",
        "stock_last_update",
        "total_open_vial",
        "updated_at",
      ])
      .where("id", "in", entityMaterialIds)
      .execute()

    return associate(entityMaterials, "id")
  }

  async getEntityMaterialsByEntityIDandMaterialID(
    c: Context<DB>,
    entityID: number,
    materialID: number,
    activityID?: number,
    withActivity: boolean = false
  ) {
    const entityMaterialsID = await c.var.trx
      .selectFrom("entity_has_master_materials as ehmm")
      .select([
        "ehmm.id",
        "ehmm.entity_id",
        "ehmm.master_material_id",
        "ehmm.deleted_at",
      ])
      .where("ehmm.entity_id", "=", entityID)
      .where("ehmm.master_material_id", "=", materialID)
      .$if(withActivity, (qb) =>
        qb
          .innerJoin(
            "entity_master_material_activities as emma",
            "emma.entity_master_material_id",
            "ehmm.id"
          )
          .where("emma.activity_id", "=", activityID ?? 0)
          .select(["emma.id as emma_id", "emma.deleted_at as emma_deleted_at"])
      )
      .executeTakeFirst()
    return entityMaterialsID
  }

  async createEntityMaterial(
    c: Context<DB>,
    data: EntityMaterialDTO
  ): Promise<InsertResult[]> {
    if (!data) return []
    return await c.var.trx
      .insertInto("entity_has_master_materials")
      .values(data)
      .execute()
  }

  async createEntityMaterialActivity(
    c: Context<DB>,
    data: CreateEntityMaterialActivityDTO
  ): Promise<InsertResult[]> {
    const result = await c.var.trx
      .insertInto("entity_master_material_activities")
      .values(data)
      .execute()
    return result
  }

  async updateEntityMaterial<
    T extends { [key: string]: string | number | Date | null },
  >(c: Context<DB>, id: number, data: T) {
    const result = await c.var.trx
      .updateTable("entity_has_master_materials")
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
    withDeleted: boolean = false
  ) {
    const result = await c.var.trx
      .selectFrom("entity_master_material_activities as emma")
      .$if(id.length > 0, (qb) => qb.where("id", "in", id))
      .$if(activityID.length > 0, (qb) =>
        qb.where("activity_id", "in", activityID)
      )
      .$if(activityID.length > 0, (qb) =>
        qb.where("entity_master_material_id", "in", entityMaterialId)
      )
      .$if(!withDeleted, (qb) => qb.where("deleted_at", "is", null))
      .selectAll("emma")
      .execute()
    return result
  }

  async updateEntityMaterialActivity<
    T extends { [key: string]: string | number | Date | null },
  >(c: Context<DB>, id: number, data: T) {
    const result = await c.var.trx
      .updateTable("entity_master_material_activities")
      .set(data)
      .where("id", "=", id)
      .execute()
    return result
  }

  async getMaterialChild(c: Context<DB>, id: number[], activityID: number) {
    const data = await c.var.trx
      .selectFrom("master_materials as mm")
      .innerJoin(
        "master_material_has_activities as mmha",
        "mmha.master_material_id",
        "mm.id"
      )
      .where("mmha.activity_id", "=", activityID)
      .where("mm.parent_id", "in", id)
      .where("mm.kfa_level_id", "=", KFA_LEVEL_ID.VARIANT)
      .where("mm.deleted_at", "is", null)
      .select([
        "mm.id",
        "mm.name",
        "mm.kfa_level_id",
        "mm.parent_id",
        "mmha.activity_id",
      ])
      .execute()
    return data
  }

  async getEntityMaterialActiveOrder(
    c: Context<DB>,
    entityId: number,
    materialIds: number[]
  ) {
    const data = await c.var.trx
      .selectFrom("orders as order")
      .innerJoin("order_items as oi", "oi.order_id", "order.id")
      .select((fn) => fn.fn.countAll().as("total"))
      .where((eb) =>
        eb.or([
          eb("order.customer_id", "=", entityId),
          eb("order.vendor_id", "=", entityId),
        ])
      )
      .where("oi.master_material_id", "in", materialIds)
      .executeTakeFirstOrThrow()
    return data
  }

  async getEntityMaterialActiveTransaction(
    c: Context<DB>,
    entityId: number,
    materialIds: number[]
  ) {
    const data = await c.var.trx
      .selectFrom("transactions as tr")
      .select((fn) => fn.fn.countAll().as("total"))
      .where((eb) =>
        eb.or([
          eb("tr.customer_id", "=", entityId),
          eb("tr.vendor_id", "=", entityId),
          eb("tr.entity_id", "=", entityId),
        ])
      )
      .where("tr.master_material_id", "in", materialIds)
      .executeTakeFirstOrThrow()
    return data
  }

  async getEntityMaterialWithEntityIdAndParentMaterialId(
    c: Context<DB>,
    entityId: number,
    materialId: number
  ) {
    const data = await c.var.trx
      .selectFrom("entity_has_master_materials as ehmm")
      .innerJoin("master_materials as mm", "mm.id", "ehmm.master_material_id")
      .select(["mm.id as id", "ehmm.id as ehmm_id"])
      .where("ehmm.entity_id", "=", entityId)
      .where("mm.parent_id", "=", materialId)
      .execute()
    return data
  }

  async getEntityMaterialActivityWithEntityIdAndParentMaterialId(
    c: Context<DB>,
    entityId: number,
    activityId: number,
    materialId: number[]
  ) {
    const data = await c.var.trx
      .selectFrom("entity_master_material_activities as emma")
      .leftJoin(
        "entity_has_master_materials as ehmm",
        "ehmm.id",
        "emma.entity_master_material_id"
      )
      .leftJoin("master_materials as mm", "mm.id", "ehmm.master_material_id")
      .select([
        "emma.id as emma_id",
        "ehmm.id as ehmm_id",
        "emma.activity_id as emma_activity_id",
        "mm.id as mm_id",
      ])
      .where("emma.activity_id", "=", activityId)
      .where("mm.parent_id", "in", materialId)
      .where("ehmm.entity_id", "=", entityId)
      .execute()
    return data
  }

  getEntityStream(
    c: Context<DB>,
    query: GetEntitiesQueries & { village_ids: string[] }
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
      .selectFrom("entities as e")
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
        qb.innerJoin("entity_entity_tags as eet", (join) =>
          join
            .onRef("eet.entity_id", "=", "e.id")
            .on("eet.entity_tag_id", "in", entity_tag_ids ?? [])
        )
      )
      .select(["e.id as id", "e.name as name"])
      .stream()
  }

  async createLogImportEntityMaterial(
    c: Context<DB> | null,
    data: CreateLogImportEntityMaterialDTO
  ) {
    const dbConnection = c ? c.var.trx : db
    return await dbConnection
      .insertInto("log_entity_material_imports")
      .values(data)
      .execute()
  }

  async findLogImportEntityMaterialAll(
    c: Context<DB>,
    queries: GetImportEntityMaterialQueries
  ) {
    const startDate = queries.start_date
      ? new Date(queries.start_date!).setHours(0, 0, 0, 0)
      : null

    const endDate = queries.end_date
      ? new Date(queries.end_date!).setHours(23, 59, 59, 999)
      : null
    const offset = (queries.page - 1) * queries.paginate
    const query = c.var.trx
      .selectFrom("log_entity_material_imports")
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
}
