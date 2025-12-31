import {
  GetListMaterialSubstitutionQueries,
  SubmitMaterialSubstitutionRequest,
  GetListMaterialForOptionQueries,
  ImportMaterialSubstitutionSchema,
} from "./annual-planning-material-substitution.schema.js"
import { Context } from "hono"
import { sql } from "kysely"
import { BaseRepository } from "../base.repository.js"
import { KFA_LEVEL_ID } from "@/common/constants/material.js"

export class AnnualPlanningMaterialSubstitutionRepository extends BaseRepository<"ws_material_substitutions"> {
  constructor() {
    super("ws_material_substitutions")
  }

  async getListMaterialSubstitution({
    context: c,
    params,
    id,
  }: {
    context: Context
    params: GetListMaterialSubstitutionQueries
    id: number
  }) {
    const { page, paginate, material_id } = params
    const offset = (page - 1) * paginate

    let query = c.var.trx
      .selectFrom(`${this.tableName} as wmsub`)
      .leftJoin("users as u_created", "u_created.id", "wmsub.created_by")
      .leftJoin("users as u_updated", "u_updated.id", "wmsub.updated_by")
      .leftJoin("ws_materials as wm", "wm.id", "wmsub.material_id")
      .leftJoin(
        "ws_materials as wmsub_mat",
        "wmsub_mat.id",
        "wmsub.substitution_material_id"
      )
      .where("wmsub.deleted_at", "is", null)
      .where("wmsub.program_plan_id", "=", id)

    if (material_id) {
      query = query.where("wmsub.material_id", "=", material_id)
    }

    const [list, totalList] = await Promise.all([
      query
        .groupBy("wmsub.material_id")
        .select([
          sql`MIN(wmsub.id)`.as("id"),
          sql`JSON_OBJECT(
            'id', wmsub.material_id, 
            'name', wm.name
          )`.as("material"),
          sql`JSON_ARRAYAGG(
            JSON_OBJECT(
              'id', wmsub.substitution_material_id,
              'name', wmsub_mat.name
            )
          )`.as("substitution_materials"),
          sql`MAX(wmsub.created_at)`.as("created_at"),
          sql`CASE
              WHEN (u_created.id IS NOT NULL) THEN
                JSON_OBJECT(
                'id', u_created.id, 
                'username', u_created.username, 
                'firstname', u_created.firstname,
                'lastname', u_created.lastname
                )
              ELSE NULL
            END`.as("user_created_by"),
          sql`MAX(wmsub.updated_at)`.as("updated_at"),
          sql`CASE
              WHEN (u_updated.id IS NOT NULL) THEN
                JSON_OBJECT(
                'id', u_updated.id, 
                'username', u_updated.username, 
              'firstname', u_updated.firstname,
              'lastname', u_updated.lastname
              )
              ELSE NULL
            END`.as("user_updated_by"),
        ])
        .limit(paginate)
        .offset(offset)
        .orderBy("updated_at", "desc")
        .orderBy("wmsub.id", "desc")
        .execute(),
      query
        .clearSelect()
        .select(() => sql`COUNT(DISTINCT wmsub.material_id)`.as("total"))
        .executeTakeFirst(),
    ])

    return {
      list,
      total: Number(totalList?.total ?? 0),
    }
  }

  async getByIdForDetail({
    ctx,
    id,
    programPlanId,
  }: {
    ctx: Context
    id: number
    programPlanId: number
  }) {
    const prequerySubstitution = ctx.var.trx
      .selectFrom(`${this.tableName} as wmsub`)
      .where("wmsub.id", "=", id)
      .where("wmsub.deleted_at", "is", null)
      .select("wmsub.material_id")
      .as("subquery_substitution_materials")

    const substitution = await ctx.var.trx
      .selectFrom(`${this.tableName} as wmsub`)
      .leftJoin(
        "ws_materials as wmsub_mat",
        "wmsub_mat.id",
        "wmsub.substitution_material_id"
      )
      .leftJoin("ws_materials as wm_mat", "wm_mat.id", "wmsub.material_id")
      .leftJoin("users as u_created", "u_created.id", "wmsub.created_by")
      .leftJoin("users as u_updated", "u_updated.id", "wmsub.updated_by")
      .innerJoin(
        prequerySubstitution,
        "subquery_substitution_materials.material_id",
        "wmsub.material_id"
      )
      .where("wmsub.program_plan_id", "=", programPlanId)
      .where("wmsub.deleted_at", "is", null)
      .groupBy("wmsub.material_id")
      .select([
        "wmsub.id as id",
        sql`JSON_OBJECT(
            'id', wmsub.material_id, 
            'name', wm_mat.name
          )`.as("material"),
        sql`JSON_ARRAYAGG(
            JSON_OBJECT(
              'id', wmsub.substitution_material_id,
              'name', wmsub_mat.name
            )
          )`.as("substitution_materials"),
        sql`MIN(wmsub.created_at)`.as("created_at"),
        sql`CASE
              WHEN (u_created.id IS NOT NULL) THEN
                JSON_OBJECT(
                'id', u_created.id, 
                'username', u_created.username, 
                'firstname', u_created.firstname,
                'lastname', u_created.lastname
                )
              ELSE NULL
            END`.as("user_created_by"),
        sql`MIN(wmsub.updated_at)`.as("updated_at"),
        sql`CASE
              WHEN (u_updated.id IS NOT NULL) THEN
                JSON_OBJECT(
                'id', u_updated.id, 
                'username', u_updated.username, 
              'firstname', u_updated.firstname,
              'lastname', u_updated.lastname
              )
              ELSE NULL
            END`.as("user_updated_by"),
      ])
      .executeTakeFirst()
    return substitution
  }

  async getById({
    ctx,
    id,
    programPlanId,
  }: {
    ctx: Context
    id: number
    programPlanId: number
  }) {
    const substitution = await ctx.var.trx
      .selectFrom(`${this.tableName}`)
      .where("id", "=", id)
      .where("program_plan_id", "=", programPlanId)
      .where("deleted_at", "is", null)
      .select(["id", "material_id"])
      .executeTakeFirst()
    return substitution
  }

  async checkMaterialExists({
    ctx,
    materialIds,
    programPlanId,
    isMaterialTask,
  }: {
    ctx: Context
    materialIds: Array<number>
    programPlanId: number
    isMaterialTask: boolean
  }) {
    const programId = ctx.var?.programId

    let material = ctx.var.trx
      .selectFrom("ws_materials as wm")
      .innerJoin("ws_program_plans as wpp", "wpp.program_id", "wm.program_id")
      .where("wm.id", "in", materialIds)
      .where("wpp.program_id", "=", programId)
      .where("wpp.id", "=", programPlanId)
      .where("wm.material_level_id", "=", KFA_LEVEL_ID.TEMPLATE)
      .where("wm.deleted_at", "is", null)
      .where("wpp.deleted_at", "is", null)
      .select(["wm.id as material_id"])

    if (isMaterialTask) {
      material = material
        .innerJoin("ws_plan_tasks as wpt", "wpt.material_id", "wm.id")
        .where("wpt.program_plan_id", "=", programPlanId)
        .where("wpt.deleted_at", "is", null)
    }

    const result = await material.execute()
    return result
  }

  async getExistingSubstitutions({
    ctx,
    substitutionId = null,
    materialIds,
    programPlanId,
    excludeDeleted = false,
  }: {
    ctx: Context
    substitutionId?: number | null
    materialIds?: Array<number>
    programPlanId: number
    excludeDeleted?: boolean
  }) {
    let processedMaterialIds = materialIds

    if (substitutionId) {
      const existingSubstiutionProcess = await this.getById({
        ctx,
        id: substitutionId,
        programPlanId,
      })
      if (existingSubstiutionProcess) {
        processedMaterialIds = [existingSubstiutionProcess.material_id]
      }
    }

    let query = ctx.var.trx
      .selectFrom(`${this.tableName}`)
      .where("program_plan_id", "=", programPlanId)
      .select([
        "id",
        "substitution_material_id",
        "deleted_at",
        "material_id",
        "program_plan_id",
      ])

    if (!!processedMaterialIds && processedMaterialIds.length > 0) {
      query = query.where("material_id", "in", processedMaterialIds)
    }
    if (excludeDeleted) {
      query = query.where("deleted_at", "is", null)
    }
    const results = await query.execute()
    return results
  }

  async submitMaterialSubstitution({
    context: c,
    values,
    paramSubstitutionId,
  }: {
    context: Context
    values: SubmitMaterialSubstitutionRequest
    paramSubstitutionId?: number | null
  }) {
    const materialIds = values?.material_id ? [values.material_id] : []
    const existingSubstitutions = await this.getExistingSubstitutions({
      ctx: c,
      substitutionId: paramSubstitutionId,
      materialIds,
      programPlanId: values.program_plan_id,
    })

    if (existingSubstitutions.length > 0) {
      if (
        Number(existingSubstitutions[0]?.material_id) !==
        Number(values.material_id)
      ) {
        await c.var.trx
          .updateTable(`${this.tableName}`)
          .set({
            material_id: values.material_id,
            updated_at: new Date(),
            updated_by: values.updated_by,
          })
          .where(
            "material_id",
            "=",
            Number(existingSubstitutions[0]?.material_id)
          )
          .where("program_plan_id", "=", values.program_plan_id)
          .where("deleted_at", "is", null)
          .execute()
      }
      const existingIds = existingSubstitutions
        .filter((sub) => sub.deleted_at === null)
        .map((sub) => sub.substitution_material_id)

      const existingIdsButDeleted = existingSubstitutions
        .filter((sub) => sub.deleted_at !== null)
        .map((sub) => sub.substitution_material_id)
      const idsToRestore = existingIdsButDeleted.filter((id) =>
        values.substitution_material_ids.includes(id)
      )
      if (idsToRestore.length > 0) {
        await c.var.trx
          .updateTable(`${this.tableName}`)
          .set({
            deleted_at: null,
            updated_at: new Date(),
            updated_by: values.updated_by,
            deleted_by: null,
          })
          .where("material_id", "=", values.material_id)
          .where("program_plan_id", "=", values.program_plan_id)
          .where("substitution_material_id", "in", idsToRestore)
          .execute()
      }

      const idsToDelete = existingIds.filter(
        (id) => !values.substitution_material_ids.includes(id)
      )
      if (idsToDelete.length > 0) {
        await c.var.trx
          .updateTable(`${this.tableName}`)
          .set({
            deleted_at: new Date(),
            updated_at: new Date(),
            updated_by: values.updated_by,
            deleted_by: values.updated_by,
          })
          .where("material_id", "=", values.material_id)
          .where("program_plan_id", "=", values.program_plan_id)
          .where("substitution_material_id", "in", idsToDelete)
          .execute()

        await c.var.trx
          .updateTable(`${this.tableName}`)
          .set({
            updated_at: new Date(),
            updated_by: values.updated_by,
          })
          .where("program_plan_id", "=", values.program_plan_id)
          .where("material_id", "=", values.material_id)
          .execute()
      }

      const rows = values.substitution_material_ids
        .map((substitutionID) => ({
          material_id: values.material_id,
          program_plan_id: values.program_plan_id,
          substitution_material_id: substitutionID,
          created_by: values.created_by,
          updated_by: values.updated_by,
        }))
        ?.filter((row) => {
          return !existingSubstitutions.some(
            (sub) =>
              sub.substitution_material_id === row.substitution_material_id
          )
        })
      if (rows.length > 0)
        await c.var.trx
          .insertInto(`${this.tableName}`)
          .values(rows)
          .onDuplicateKeyUpdate(() => ({
            updated_by: values.updated_by,
            updated_at: new Date(),
          }))
          .execute()
    } else {
      const rows = values.substitution_material_ids.map((substitutionID) => ({
        material_id: values.material_id,
        program_plan_id: values.program_plan_id,
        substitution_material_id: substitutionID,
        created_by: values.created_by,
        updated_by: values.updated_by,
      }))
      await c.var.trx
        .insertInto(`${this.tableName}`)
        .values(rows)
        .onDuplicateKeyUpdate(() => ({
          updated_by: values.updated_by,
          updated_at: new Date(),
        }))
        .execute()
    }
  }

  async deleteMaterialSubstitution(
    ctx: Context,
    params: { substitutionId: number; planId: number }
  ) {
    const getMaterialById = await this.getById({
      ctx,
      id: params.substitutionId,
      programPlanId: params.planId,
    })

    if (!getMaterialById) return

    await ctx.var.trx
      .updateTable(`${this.tableName}`)
      .set({
        deleted_at: new Date(),
        updated_at: new Date(),
        updated_by: ctx.var.user?.global_id,
        deleted_by: ctx.var.user?.global_id,
      })
      .where("material_id", "=", getMaterialById?.material_id)
      .where("program_plan_id", "=", params.planId)
      .execute()
  }

  async importMaterialSubstitution({
    context: ctx,
    params,
    rows,
  }: {
    context: Context
    params: { planId: number }
    rows: ImportMaterialSubstitutionSchema[]
  }) {
    const { planId } = params

    const bulkValues = rows.flatMap((item) =>
      item.SubstitutionId.map((subId) => ({
        material_id: Number(item.MaterialId),
        program_plan_id: planId,
        substitution_material_id: Number(subId),
        created_by: Number(ctx.var.user?.global_id),
        updated_by: Number(ctx.var.user?.global_id),
      }))
    )
    await ctx.var.trx.insertInto(this.tableName).values(bulkValues).execute()
  }

  async getMaterialExport({
    context: ctx,
    params,
    planId,
  }: {
    context: Context
    params: { material_id?: number }
    planId: number
  }) {
    const { material_id } = params
    let query = ctx.var.trx
      .selectFrom(`${this.tableName} as wmsub`)
      .leftJoin("users as u_created", "u_created.id", "wmsub.created_by")
      .leftJoin("users as u_updated", "u_updated.id", "wmsub.updated_by")
      .leftJoin("ws_materials as wm", "wm.id", "wmsub.material_id")
      .leftJoin(
        "ws_materials as wmsub_mat",
        "wmsub_mat.id",
        "wmsub.substitution_material_id"
      )
      .where("wmsub.deleted_at", "is", null)
      .where("wmsub.program_plan_id", "=", planId)

    if (material_id) {
      query = query.where("wmsub.material_id", "=", material_id)
    }

    const result = await query
      .select([
        sql`ROW_NUMBER() OVER (ORDER BY wmsub.updated_at DESC)`.as("no"),
        "wmsub.material_id",
        sql`COALESCE(wm.name, '-')`.as("material_name"),
        "wmsub.substitution_material_id",
        sql`COALESCE(wmsub_mat.name, '-')`.as("substitution_material_name"),
        sql`DATE_FORMAT(wmsub.updated_at, '%d %b %Y %H:%i')`.as("updated_at"),
        sql`CASE
              WHEN (u_updated.id IS NOT NULL) THEN
                CONCAT(
                  u_updated.firstname,
                  ' ',
                  COALESCE(u_updated.lastname, '')
                )
              ELSE NULL
            END`.as("updated_by"),
      ])
      .orderBy("wmsub.updated_at", "desc")
      .execute()

    return result
  }

  async getMaterialTasks({
    context: ctx,
    params,
    ids,
  }: {
    context: Context
    params?: GetListMaterialForOptionQueries & {
      excludeIds?: number[]
      planId: number
      isPlannedOnly?: boolean | null
      isForFilter?: boolean | null
    }
    ids?: Array<number>
  }) {
    const {
      page = 1,
      paginate = 10,
      keyword,
      planId,
      isPlannedOnly,
      isForFilter,
    } = params ?? {}
    const offset = (page - 1) * paginate
    const programId = ctx.var?.programId
    const query = ctx.var.trx
      .selectFrom("ws_materials as wm")
      .leftJoin("ws_material_substitutions as wms", (join) =>
        join
          .onRef("wms.material_id", "=", "wm.id")
          .onRef("wms.program_plan_id", "=", sql`${planId}`)
          .on("wms.deleted_at", "is", null)
      )

    let baseQueryWithoutJoin = query
      .where("wm.program_id", "=", programId)
      .where("wm.material_level_id", "=", KFA_LEVEL_ID.TEMPLATE)
      .where("wm.deleted_at", "is", null)

    if (!isForFilter) {
      baseQueryWithoutJoin = baseQueryWithoutJoin.where("wms.id", "is", null)
    }

    let baseQuery = isPlannedOnly
      ? baseQueryWithoutJoin
          .innerJoin("ws_plan_tasks as wpt", "wpt.material_id", "wm.id")
          .where("wpt.deleted_at", "is", null)
          .where("wpt.program_plan_id", "=", planId as number)
      : baseQueryWithoutJoin
          .leftJoin("ws_plan_tasks as wpt", (join) =>
            join
              .onRef("wpt.material_id", "=", "wm.id")
              .on("wpt.program_plan_id", "=", sql`${planId}`)
              .on("wpt.deleted_at", "is", null)
          )
          .where("wpt.id", "is", null)

    if (params?.excludeIds && params.excludeIds.length > 0) {
      baseQuery = baseQuery.where("wm.id", "not in", params.excludeIds)
    }

    if (keyword) {
      baseQuery = baseQuery.where("wm.name", "like", `%${keyword}%`)
    }

    if (ids && ids.length > 0) {
      const res = baseQuery
        .where("wm.id", "in", ids)
        .select(["wm.id"])
        .execute()
      return res
    }

    const [list, totalList] = await Promise.all([
      baseQuery
        .select(["wm.id", "wm.name"])
        .groupBy("wm.id")
        .limit(paginate)
        .offset(offset)
        .execute(),
      baseQuery.select((eb) => eb.fn.countAll().as("total")).executeTakeFirst(),
    ])

    return {
      list,
      total: Number(totalList?.total ?? 0),
    }
  }

  async getMaterialsForSubstitutionsForChecking({
    context: ctx,
    materialId,
    materialSubstitutionIds,
  }: {
    context: Context
    materialId: number
    materialSubstitutionIds: Array<number>
  }) {
    const programId = ctx.var?.programId

    const query = ctx.var.trx.selectFrom(`ws_materials as wm`)
    let baseQuery = query

      .where("wm.material_level_id", "=", KFA_LEVEL_ID.TEMPLATE)
      .where("wm.program_id", "=", programId)
      .where("wm.deleted_at", "is", null)

    if (materialId) {
      baseQuery = baseQuery.where("wm.id", "!=", materialId)
    }

    const res = baseQuery
      .where("wm.id", "in", materialSubstitutionIds)
      .select(["wm.id as id"])
      .execute()
    return res
  }

  async getStatusOfProgramPlan({
    ctx,
    planId,
  }: {
    ctx: Context
    planId: number
  }) {
    const programId = ctx.var?.programId
    const result = await ctx.var.trx
      .selectFrom("ws_program_plans as wpp")
      .where("wpp.program_id", "=", programId)
      .where("wpp.id", "=", planId)
      .where("wpp.deleted_at", "is", null)
      .select(sql`IF(wpp.status = 1, TRUE, FALSE)`.as("status"))
      .executeTakeFirst()

    return result
  }

  async getStreamMaterialOptions({
    ctx,
    planId,
    isPlannedOnly = false,
  }: {
    ctx: Context
    planId: number
    isPlannedOnly: boolean
  }) {
    const programId = ctx.var?.programId
    const initialQuery = ctx.var.trx
      .selectFrom("ws_materials as wm")
      .groupBy("wm.id")

    const baseQuery = isPlannedOnly
      ? initialQuery
          .innerJoin("ws_plan_tasks as wpt", "wpt.material_id", "wm.id")
          .where("wpt.deleted_at", "is", null)
          .where("wpt.program_plan_id", "=", planId)
          .leftJoin("ws_material_substitutions as wms", (join) =>
            join
              .onRef("wms.material_id", "=", "wm.id")
              .on("wms.program_plan_id", "=", sql`${planId}`)
              .on("wms.deleted_at", "is", null)
          )
          .where("wms.id", "is", null)
      : initialQuery
          .leftJoin("ws_plan_tasks as wpt", (join) =>
            join
              .onRef("wpt.material_id", "=", "wm.id")
              .on("wpt.program_plan_id", "=", sql`${planId}`)
              .on("wpt.deleted_at", "is", null)
          )
          .where("wpt.id", "is", null)
    const result = baseQuery
      .where("wm.program_id", "=", programId)
      .where("wm.material_level_id", "=", KFA_LEVEL_ID.TEMPLATE)
      .where("wm.deleted_at", "is", null)
      .select(["wm.id as id", "wm.name"])
      .orderBy("wm.name")
      .stream()
    return result
  }
}
