import { ValidationError } from "@smile-health/lib/error.js"
import { Context } from "hono"
import { sql } from "kysely"
import { CoverageQueries, ListQueries, TaskItem } from "./task.schema.js"

/** Row type returned by list query */
export type TaskListRow = {
  id: number
  code: string | null
  material_id: number
  activity_id: number
  ip: number | null
  month_distribution: string | null
  target_group_id: number
  number_of_dose: number | null
  updated_at: Date | null
  updated_by: number | null
  material_name: string | null
  activity_name: string | null
  target_group_name: string | null
  coverage_province_count: number
}

/** Row type returned by detail query */
export type TaskDetailRow = {
  id: number
  code: string | null
  program_plan_id: number
  material_id: number
  activity_id: number
  ip: number | null
  month_distribution: string | null
  target_group_id: number
  number_of_dose: number | null
  material_name: string | null
  activity_name: string | null
  target_group_name: string | null
}

/** Coverage row type returned by detail query */
export type TaskCoverageRow = {
  id: number
  province_id: number
  coverage_number: number | null
  province_name: string | null
  target_group_id: number
}

/** Result type for getTaskDetail */
export type TaskDetailResult = {
  rows: TaskDetailRow[]
  coverages: TaskCoverageRow[]
}

export class TaskRepository {
  private handleDuplicateError(c: Context, error: unknown) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      (error as { code?: unknown }).code === "ER_DUP_ENTRY"
    ) {
      throw new ValidationError(c.var.t("common.duplicate"))
    }

    throw error
  }

  async createTasksWithCoverages(
    c: Context,
    items: Array<TaskItem & { code: string }>
  ) {
    try {
      for (const item of items) {
        const existingTask = await c.var.trx
          .selectFrom("ws_plan_tasks")
          .select(["id", "deleted_at"])
          .where("program_plan_id", "=", item.program_plan_id)
          .where("material_id", "=", item.material_id)
          .where("activity_id", "=", item.activity_id)
          .where("target_group_id", "=", item.target_group_id)
          .executeTakeFirst()

        let planTaskId: number | null = null

        if (existingTask?.id != null) {
          if (existingTask.deleted_at == null) {
            throw new ValidationError(c.var.t("common.duplicate"))
          }

          await c.var.trx
            .updateTable("ws_plan_tasks")
            .set({
              activity_id: item.activity_id,
              code: item.code,
              ip: item.ip,
              material_id: item.material_id,
              month_distribution: item.month_distribution,
              number_of_dose: item.number_of_dose,
              program_plan_id: item.program_plan_id,
              target_group_id: item.target_group_id,
              deleted_at: null,
              deleted_by: null,
              updated_by: c.var.userId,
            })
            .where("id", "=", existingTask.id)
            .execute()

          planTaskId = Number(existingTask.id)
        } else {
          const insertTaskResult = await c.var.trx
            .insertInto("ws_plan_tasks")
            .values({
              activity_id: item.activity_id,
              code: item.code,
              ip: item.ip,
              material_id: item.material_id,
              month_distribution: item.month_distribution,
              number_of_dose: item.number_of_dose,
              program_plan_id: item.program_plan_id,
              target_group_id: item.target_group_id,
              created_by: c.var.userId,
              updated_by: c.var.userId,
            })
            .executeTakeFirstOrThrow()

          const insertId = (insertTaskResult as { insertId?: unknown }).insertId

          if (insertId == null) {
            continue
          }

          planTaskId = Number(insertId)
        }

        if (
          !item.coverages ||
          item.coverages.length === 0 ||
          planTaskId == null
        ) {
          continue
        }

        const coverageRows = item.coverages.map((coverage) => ({
          plan_task_id: planTaskId,
          province_id: coverage.province_id,
          coverage_number: coverage.coverage_number,
          created_by: c.var.userId,
          updated_by: c.var.userId,
        }))

        await c.var.trx.insertInto("ws_coverage").values(coverageRows).execute()
      }
    } catch (error) {
      this.handleDuplicateError(c, error)
    }
  }

  async updateTaskWithCoverages(
    c: Context,
    id: number,
    item: Pick<
      TaskItem,
      "ip" | "month_distribution" | "number_of_dose" | "coverages"
    >
  ) {
    const now = new Date()

    await c.var.trx
      .updateTable("ws_plan_tasks")
      .set({
        ip: item.ip,
        month_distribution: item.month_distribution,
        number_of_dose: item.number_of_dose,
        updated_by: c.var.userId,
      })
      .where("id", "=", id)
      .where("deleted_at", "is", null)
      .execute()

    const existingCoverages = await c.var.trx
      .selectFrom("ws_coverage")
      .select(["id", "province_id"])
      .where("plan_task_id", "=", id)
      .where("deleted_at", "is", null)
      .execute()

    const coverageMap = existingCoverages.reduce((map, row) => {
      map.set(Number(row.province_id), Number(row.id))
      return map
    }, new Map<number, number>())

    const coverageToInsert: Array<{
      plan_task_id: number
      province_id: number
      coverage_number: number
      created_by: number | undefined
      updated_by: number | undefined
    }> = []

    const incomingProvinceIds = new Set<number>()

    for (const coverage of item.coverages ?? []) {
      const provinceId = Number(coverage.province_id)
      incomingProvinceIds.add(provinceId)
      const coverageId = coverageMap.get(provinceId)

      if (coverageId) {
        await c.var.trx
          .updateTable("ws_coverage")
          .set({
            coverage_number: coverage.coverage_number,
            updated_by: c.var.userId,
          })
          .where("id", "=", coverageId)
          .where("deleted_at", "is", null)
          .execute()
      } else {
        coverageToInsert.push({
          plan_task_id: id,
          province_id: provinceId,
          coverage_number: coverage.coverage_number,
          created_by: c.var.userId,
          updated_by: c.var.userId,
        })
      }
    }

    if (coverageToInsert.length > 0) {
      await c.var.trx
        .insertInto("ws_coverage")
        .values(coverageToInsert)
        .execute()
    }

    const provinceIdList = Array.from(incomingProvinceIds)

    let deleteQuery = c.var.trx
      .updateTable("ws_coverage")
      .set({
        deleted_at: now,
        deleted_by: c.var.userId,
        updated_by: c.var.userId,
      })
      .where("plan_task_id", "=", id)
      .where("deleted_at", "is", null)

    if (provinceIdList.length > 0) {
      deleteQuery = deleteQuery.where("province_id", "not in", provinceIdList)
    }

    await deleteQuery.execute()
  }

  async listByProgramPlan(
    c: Context,
    programPlanId: number,
    queries: ListQueries
  ) {
    const { page, paginate, material_id, activity_id } = queries
    const offset = (page - 1) * paginate

    const baseQuery = c.var.trx
      .selectFrom("ws_plan_tasks as t")
      .innerJoin("ws_program_plans as pp", "pp.id", "t.program_plan_id")
      .innerJoin("ws_materials as m", "m.id", "t.material_id")
      .innerJoin("ws_activities as a", "a.id", "t.activity_id")
      .innerJoin("target_groups as tg", "tg.id", "t.target_group_id")
      .where("t.deleted_at", "is", null)
      .where("pp.deleted_at", "is", null)
      .where("t.program_plan_id", "=", programPlanId)
      .$if(!!material_id, (qb) =>
        qb.where("t.material_id", "=", material_id as number)
      )
      .$if(!!activity_id, (qb) =>
        qb.where("t.activity_id", "=", activity_id as number)
      )

    const listQuery = baseQuery.leftJoin("ws_coverage as wc", (join) =>
      join.onRef("wc.plan_task_id", "=", "t.id").on("wc.deleted_at", "is", null)
    )

    const [rows, totalTasks] = await Promise.all([
      listQuery
        .select([
          "t.id",
          "t.code",
          "t.material_id",
          "t.activity_id",
          "t.ip",
          "t.month_distribution",
          "t.target_group_id",
          "t.number_of_dose",
          "t.updated_at",
          "t.updated_by",
          "m.name as material_name",
          "a.name as activity_name",
          "tg.title as target_group_name",
          sql<number>`COUNT(DISTINCT wc.province_id)`.as(
            "coverage_province_count"
          ),
        ])
        .groupBy([
          "t.id",
          "t.code",
          "t.material_id",
          "t.activity_id",
          "t.ip",
          "t.month_distribution",
          "t.target_group_id",
          "t.number_of_dose",
          "t.updated_at",
          "t.updated_by",
          "m.name",
          "a.name",
          "tg.title",
        ])
        .limit(paginate)
        .offset(offset)
        .execute(),

      baseQuery
        .select((eb) => eb.fn.countAll<number>().as("total"))
        .executeTakeFirst(),
    ])

    return {
      list: rows,
      total: Number(totalTasks?.total ?? 0),
    }
  }

  async getCoverageList(c: Context, taskId: number, queries: CoverageQueries) {
    const { page, paginate, province_id } = queries
    const offset = (page - 1) * paginate

    let baseQuery = c.var.trx
      .selectFrom("ws_coverage as wc")
      .innerJoin("locations as l", "l.id", "wc.province_id")
      .where("wc.deleted_at", "is", null)
      .where("wc.plan_task_id", "=", taskId)

    if (province_id) {
      baseQuery = baseQuery.where("wc.province_id", "=", province_id)
    }

    const [rows, total] = await Promise.all([
      baseQuery
        .select([
          "wc.province_id as province_id",
          "wc.coverage_number",
          "l.name as province_name",
        ])
        .limit(paginate)
        .offset(offset)
        .execute(),
      baseQuery
        .select((eb) => eb.fn.countAll<number>().as("total"))
        .executeTakeFirst(),
    ])

    return {
      list: rows,
      total: Number(total?.total ?? 0),
    }
  }

  async findById(c: Context, id: number): Promise<TaskDetailResult | null> {
    const rows = await c.var.trx
      .selectFrom("ws_plan_tasks as t")
      .innerJoin("ws_program_plans as pp", "pp.id", "t.program_plan_id")
      .innerJoin("ws_materials as m", "m.id", "t.material_id")
      .innerJoin("ws_activities as a", "a.id", "t.activity_id")
      .innerJoin("target_groups as tg", "tg.id", "t.target_group_id")
      .where("t.deleted_at", "is", null)
      .where("pp.deleted_at", "is", null)
      .where("t.id", "=", id)
      .select([
        "t.id",
        "t.code",
        "t.program_plan_id",
        "t.material_id",
        "t.activity_id",
        "t.ip",
        "t.month_distribution",
        "t.target_group_id",
        "t.number_of_dose",
        "m.name as material_name",
        "a.name as activity_name",
        "tg.title as target_group_name",
      ])
      .execute()

    const base = rows[0]
    if (!base) {
      return null
    }

    const coverages = await c.var.trx
      .selectFrom("ws_coverage as wc")
      .innerJoin("ws_plan_tasks as t", "t.id", "wc.plan_task_id")
      .innerJoin("locations as l", "l.id", "wc.province_id")
      .where("wc.deleted_at", "is", null)
      .where("t.deleted_at", "is", null)
      .where("t.id", "=", id)
      .select([
        "wc.id",
        "wc.province_id",
        "wc.coverage_number",
        "l.name as province_name",
        "t.target_group_id",
      ])
      .execute()

    return { rows, coverages }
  }

  async softDelete(c: Context, id: number) {
    const now = new Date()

    await c.var.trx
      .updateTable("ws_plan_tasks")
      .set({
        deleted_at: now,
        deleted_by: c.var.userId,
      })
      .where("id", "=", id)
      .where("deleted_at", "is", null)
      .execute()

    await c.var.trx
      .updateTable("ws_coverage")
      .set({
        deleted_at: now,
        deleted_by: c.var.userId,
      })
      .where("plan_task_id", "=", id)
      .where("deleted_at", "is", null)
      .execute()
  }
}
