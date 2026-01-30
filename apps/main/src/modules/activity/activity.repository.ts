import { db } from "@/common/infrastructure/database/index.js"
import { WsActivities } from "@/common/infrastructure/database/types/db.js"
import { associate, group } from "@smile-health/lib/utils.js"
import { Context } from "hono"
import {
  ComparisonOperatorExpression,
  CompiledQuery,
  OrderByDirectionExpression,
  ReferenceExpression,
  sql,
} from "kysely"
import { ListCustomerVendorActivityDTO } from "../app-mobile-data/app-mobile-data.schema.js"
import { BaseRepository } from "../base.repository.js"
import {
  CreateActivityRequestDTO,
  GetActivityQuery,
  UpdateActivityRequestDTO,
} from "./activity.schema.js"

export class ActivityRepository extends BaseRepository<"ws_activities"> {
  constructor() {
    super("ws_activities")
  }

  async getActivityMapped(c: Context, activityIDs: number[]) {
    const activities = await c.var.trx
      .selectFrom("ws_activities")
      .select(["id", "name"])
      .$if(activityIDs.length !== 0, (qb) => qb.where("id", "in", activityIDs))
      .where("deleted_at", "is", null)
      .execute()
    return associate(activities, "id")
  }

  async getByMaterialId(c: Context, materialID: number) {
    const materialMap = await this.getByMaterialIdMapped(c, [materialID])
    return materialMap[materialID] ?? []
  }

  async getByMaterialIdMapped(c: Context, materialIDs: number[]) {
    const activities = await c.var.trx
      .selectFrom("ws_activities as a")
      .innerJoin("ws_material_activities as ma", "ma.activity_id", "a.id")
      .innerJoin("ws_materials as m", "m.id", "ma.material_id")
      .where("material_id", "in", materialIDs)
      .where("a.status", "=", 1)
      .where("a.deleted_at", "is", null)
      .select([
        "a.id",
        "a.name",
        "ma.material_id",
        "a.is_ordered_purchase",
        "a.is_ordered_sales",
        "ma.is_sequence",
        "ma.is_patient_needed as is_patient",
      ])
      .execute()

    return group(activities, "material_id")
  }

  async syncMaterialActivities(
    c: Context,
    materialId: number,
    activityIds: {
      id: number
      is_patient_needed: number
    }[]
  ) {
    await c.var.trx
      .deleteFrom("ws_material_activities")
      .where("material_id", "=", materialId)
      .execute()

    await c.var.trx
      .insertInto("ws_material_activities")
      .values(
        activityIds.map(({ id, is_patient_needed }) => ({
          material_id: materialId,
          activity_id: id,
          is_patient_needed,
        }))
      )
      .execute()
  }

  async findAll(
    c: Context,
    params: GetActivityQuery,
    programId: number,
    sortBy: string | undefined | null = "updated_at",
    sortType: string | undefined | null = "desc"
  ) {
    let query = c.var.trx.selectFrom("ws_activities").orderBy("status", "desc")

    if (params.keyword)
      query = query.where("name", "like", `%${params.keyword}%`)
    if (params.status !== undefined)
      query = query.where("status", "=", Number(params.status))
    if (sortBy)
      query = query.orderBy(
        sortBy as keyof WsActivities,
        sortType as OrderByDirectionExpression
      )

    const offset = (params.page - 1) * params.paginate
    const [activities, count] = await Promise.all([
      query
        .limit(params.paginate)
        .offset(offset)
        .selectAll()
        .where("deleted_at", "is", null)
        .where("program_id", "=", programId)
        .execute(),
      query
        .select((fn) => fn.fn.countAll().as("total"))
        .where("deleted_at", "is", null)
        .where("program_id", "=", programId)
        .executeTakeFirstOrThrow(),
    ])

    return {
      data: activities,
      total: Number(count.total),
    }
  }

  getStreamData(c: Context) {
    return c.var.trx
      .selectFrom("ws_activities")
      .where("program_id", "=", c.var.programId)
      .where("deleted_at", "is", null)
      .select(["id", "name"])
      .stream()
  }

  async findById(c: Context, id: number, programId: number) {
    return await c.var.trx
      .selectFrom("ws_activities")
      .selectAll()
      .where("id", "=", id)
      .where("program_id", "=", programId)
      .where("deleted_at", "is", null)
      .executeTakeFirst()
  }

  async findByIds(c: Context, id: number[], programId: number) {
    return await c.var.trx
      .selectFrom("ws_activities")
      .selectAll()
      .where("id", "in", id)
      .where("deleted_at", "is", null)
      .where("program_id", "=", programId)
      .execute()
  }

  async createActivity(c: Context, req: CreateActivityRequestDTO) {
    return await c.var.trx
      .insertInto("ws_activities")
      .values(req)
      .executeTakeFirst()
  }

  async updateActivity(c: Context, id: number, req: UpdateActivityRequestDTO) {
    const result = await c.var.trx
      .updateTable("ws_activities")
      .set(req)
      .where("id", "=", id)
      .executeTakeFirst()
    return result
  }

  async findAllWithoutPaginate(
    c: Context,
    params: GetActivityQuery,
    programId: number
  ) {
    let query = c.var.trx.selectFrom("ws_activities")

    if (params.keyword)
      query = query.where("name", "like", `%${params.keyword}%`)

    const activities = await query
      .selectAll()
      .where("deleted_at", "is", null)
      .where("program_id", "=", programId)
      .orderBy("updated_at desc")
      .execute()

    return {
      data: activities,
    }
  }

  async findByName(c: Context, name: string, programId: number) {
    return await c.var.trx
      .selectFrom("ws_activities")
      .selectAll()
      .where("name", "=", name)
      .where("deleted_at", "is", null)
      .where("program_id", "=", programId)
      .executeTakeFirst()
  }

  async findDynamicActivityName<T>(
    c: Context,
    whereClause: ReferenceExpression<DB, "ws_activities">,
    operator: ComparisonOperatorExpression,
    value: T
  ) {
    const data = await c.var.trx
      .selectFrom("ws_activities")
      .where(whereClause, operator, value)
      .selectAll()
      .execute()
    return data
  }

  async findDynamicActivityId<T>(
    c: Context,
    whereClause: ReferenceExpression<DB, "ws_activities">,
    operator: ComparisonOperatorExpression,
    value: T,
    programId: number
  ) {
    const data = await c.var.trx
      .selectFrom("ws_activities")
      .where(whereClause, operator, value)
      .where("program_id", "=", programId)
      .selectAll()
      .executeTakeFirst()
    return data
  }

  async findCreatedActivityName<T>(
    c: Context,
    whereClause: ReferenceExpression<DB, "ws_activities">,
    operator: ComparisonOperatorExpression,
    value: T
  ) {
    const data = await c.var.trx
      .selectFrom("ws_activities")
      .where(whereClause, operator, value)
      .selectAll()
      .executeTakeFirst()
    return data
  }

  async getOriginActivities(c: Context) {
    const { rows } = await db.executeQuery(
      CompiledQuery.raw("select get_origin_activities(?) as result", [
        c.var.programId,
      ])
    )

    return rows[0] as {
      result: Pick<ListCustomerVendorActivityDTO, "origin_activities">
    }
  }

  async getStockGreaterThanZeroByActivityId(c: Context, activityId: number) {
    return await c.var.trx
      .selectFrom("ws_stocks")
      .selectAll()
      .where("deleted_at", "is", null)
      .where("qty", ">", 0)
      .where("activity_id", "=", activityId)
      .executeTakeFirst()
  }

  async findByCode(c: Context, code: string) {
    return await c.var.trx
      .selectFrom("ws_activities")
      .select(["id", "name"])
      .where("code", "=", code)
      .where("deleted_at", "is", null)
      .execute()
  }

  async findEntityMaterials(c: Context, activityId: number) {
    return await c.var.trx
      .selectFrom("ws_entity_material_activities")
      .select(["id"])
      .where("activity_id", "=", activityId)
      .where("deleted_at", "is", null)
      .limit(1)
      .executeTakeFirst()
  }
}
