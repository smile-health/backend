import { DB } from "@/common/infrastructure/database/types/db.js"
import { BaseRepository } from "@smile/lib/base/repository.js"
import { Context } from "@smile/lib/types/context.js"
import { associate, group } from "@smile/lib/utils.js"
import { ComparisonOperatorExpression, ReferenceExpression } from "kysely"
import { UpdateMaterialRequest } from "../material/material.schema.js"
import {
  CreateActivityRequestDTO,
  UpdateActivityRequestDTO,
  GetActivityQuery,
} from "./activity.schema.js"

export class ActivityRepository extends BaseRepository<
  DB,
  "master_activities"
> {
  constructor() {
    super("master_activities")
  }

  async getActivityMapped(c: Context<DB>, activityIDs: number[]) {
    const activities = await c.var.trx
      .selectFrom("master_activities")
      .select(["id", "name"])
      .$if(activityIDs.length !== 0, (qb) => qb.where("id", "in", activityIDs))
      .where("deleted_at", "is", null)
      .execute()
    return associate(activities, "id")
  }

  async getByMaterialId(c: Context<DB>, materialID: number) {
    const materialMap = await this.getByMaterialIdMapped(c, [materialID])
    return materialMap[materialID] ?? []
  }

  async getByMaterialIdMapped(c: Context<DB>, materialIDs: number[]) {
    const activities = await c.var.trx
      .selectFrom("master_activities as a")
      .innerJoin(
        "master_material_has_activities as ma",
        "ma.activity_id",
        "a.id"
      )
      .where("master_material_id", "in", materialIDs)
      .select([
        "a.id",
        "a.name",
        "ma.master_material_id",
        "a.is_ordered_purchase",
        "a.is_ordered_sales",
        "a.is_patient_id as is_patient",
        "ma.is_sequence",
      ]) // TODO: move is_patient to material_type activities pivot
      .execute()

    return group(activities, "master_material_id")
  }

  async syncMaterialActivities(
    c: Context<DB>,
    materialId: number,
    { activities }: UpdateMaterialRequest
  ) {
    await c.var.trx
      .deleteFrom("master_material_has_activities")
      .where("master_material_id", "=", materialId)
      .execute()

    for (const activity of activities) {
      await c.var.trx
        .insertInto("master_material_has_activities")
        .values({
          master_material_id: materialId,
          activity_id: activity.id,
          is_sequence: activity.is_sequence,
        })
        .execute()
    }
  }

  async findAll(c: Context<DB>, params: GetActivityQuery) {
    let query = c.var.trx.selectFrom("master_activities")

    if (params.keyword)
      query = query.where("name", "like", `%${params.keyword}%`)

    const offset = (params.page - 1) * params.paginate
    const [activities, count] = await Promise.all([
      query
        .limit(params.paginate)
        .offset(offset)
        .selectAll()
        .where("deleted_at", "is", null)
        .orderBy("updated_at desc")
        .execute(),
      query
        .select((fn) => fn.fn.countAll().as("total"))
        .where("deleted_at", "is", null)
        .executeTakeFirstOrThrow(),
    ])

    return {
      data: activities,
      total: Number(count.total),
    }
  }

  getStreamData(c: Context<DB>) {
    return c.var.trx
      .selectFrom("master_activities")
      .where("deleted_at", "is", null)
      .select(["id", "name"])
      .stream()
  }

  async findById(c: Context<DB>, id: number) {
    return await c.var.trx
      .selectFrom("master_activities")
      .selectAll()
      .where("id", "=", id)
      .where("deleted_at", "is", null)
      .executeTakeFirst()
  }

  async findByIds(c: Context<DB>, id: number[]) {
    return await c.var.trx
      .selectFrom("master_activities")
      .selectAll()
      .where("id", "in", id)
      .where("deleted_at", "is", null)
      .execute()
  }

  async createActivity(c: Context<DB>, req: CreateActivityRequestDTO) {
    return await c.var.trx
      .insertInto("master_activities")
      .values(req)
      .executeTakeFirst()
  }

  async updateActivity(
    c: Context<DB>,
    id: number,
    req: UpdateActivityRequestDTO
  ) {
    const result = await c.var.trx
      .updateTable("master_activities")
      .set(req)
      .where("id", "=", id)
      .executeTakeFirst()
    return result
  }

  async deleteActivity<T extends { [key: string]: number | Date }>(
    c: Context<DB>,
    id: number,
    req: T
  ) {
    const result = await c.var.trx
      .updateTable("master_activities")
      .set(req)
      .where("id", "=", id)
      .executeTakeFirst()
    return result
  }

  async findAllWithoutPaginate(c: Context<DB>, params: GetActivityQuery) {
    let query = c.var.trx.selectFrom("master_activities")

    if (params.keyword)
      query = query.where("name", "like", `%${params.keyword}%`)

    const activities = await query
      .selectAll()
      .where("deleted_at", "is", null)
      .orderBy("updated_at desc")
      .execute()

    return {
      data: activities,
    }
  }

  async findByName(c: Context<DB>, name: string) {
    return await c.var.trx
      .selectFrom("master_activities")
      .selectAll()
      .where("name", "=", name)
      .where("deleted_at", "is", null)
      .executeTakeFirst()
  }

  async findDynamicActivityName<T>(
    c: Context<DB>,
    whereClause: ReferenceExpression<DB, "master_activities">,
    operator: ComparisonOperatorExpression,
    value: T
  ) {
    const data = await c.var.trx
      .selectFrom("master_activities")
      .where(whereClause, operator, value)
      .selectAll()
      .execute()
    return data
  }

  async findDynamicActivityId<T>(
    c: Context<DB>,
    whereClause: ReferenceExpression<DB, "master_activities">,
    operator: ComparisonOperatorExpression,
    value: T
  ) {
    const data = await c.var.trx
      .selectFrom("master_activities")
      .where(whereClause, operator, value)
      .selectAll()
      .executeTakeFirst()
    return data
  }

  async findCreatedActivityName<T>(
    c: Context<DB>,
    whereClause: ReferenceExpression<DB, "master_activities">,
    operator: ComparisonOperatorExpression,
    value: T
  ) {
    const data = await c.var.trx
      .selectFrom("master_activities")
      .where(whereClause, operator, value)
      .selectAll()
      .executeTakeFirst()
    return data
  }
}
