import { Context } from "hono"
import { TaskRepository } from "./task.repository.js"
import { TaskItem } from "./task.schema.js"

/** Row type returned by getExportRows query */
export type ExportRow = {
  task_id: number
  material_id: number
  activity_id: number
  target_group_id: number
  material_name: string | null
  activity_name: string | null
  target_group_name: string | null
  month_distribution: string | null
  number_of_dose: number | null
  updated_by: number | null
  province_id: number | null
  province_name: string | null
  coverage_number: number | null
  ip: number
  code: string
}

export class TaskExcelRepository {
  constructor(private readonly taskRepo: TaskRepository) {}

  async createTasks(
    c: Context,
    items: Array<TaskItem & { code: string }>
  ): Promise<void> {
    await this.taskRepo.createTasksWithCoverages(c, items)
  }

  async upsertTask(
    c: Context,
    item: TaskItem & { code: string }
  ): Promise<void> {
    const existing = await c.var.trx
      .selectFrom("ws_plan_tasks")
      .select(["id"])
      .where("deleted_at", "is", null)
      .where("program_plan_id", "=", item.program_plan_id)
      .where("material_id", "=", item.material_id)
      .where("activity_id", "=", item.activity_id)
      .where("target_group_id", "=", item.target_group_id)
      .executeTakeFirst()

    if (existing?.id != null) {
      await this.taskRepo.updateTaskWithCoverages(c, Number(existing.id), {
        ip: item.ip,
        month_distribution: item.month_distribution,
        number_of_dose: item.number_of_dose,
        coverages: item.coverages,
      })

      return
    }

    await this.taskRepo.createTasksWithCoverages(c, [item])
  }

  async getExportRows(
    c: Context,
    params: { programPlanId: number; materialId?: number; activityId?: number }
  ): Promise<ExportRow[]> {
    const { programPlanId, materialId, activityId } = params

    return (await c.var.trx
      .selectFrom("ws_plan_tasks as t")
      .innerJoin("ws_program_plans as pp", "pp.id", "t.program_plan_id")
      .innerJoin("ws_materials as m", "m.id", "t.material_id")
      .innerJoin("ws_activities as a", "a.id", "t.activity_id")
      .innerJoin("target_groups as tg", "tg.id", "t.target_group_id")
      .leftJoin("ws_coverage as wc", (join) =>
        join
          .onRef("wc.plan_task_id", "=", "t.id")
          .on("wc.deleted_at", "is", null)
      )
      .leftJoin("locations as l", "l.id", "wc.province_id")
      .where("t.deleted_at", "is", null)
      .where("pp.deleted_at", "is", null)
      .where("t.program_plan_id", "=", programPlanId)
      .$if(!!materialId, (qb) =>
        qb.where("t.material_id", "=", materialId as number)
      )
      .$if(!!activityId, (qb) =>
        qb.where("t.activity_id", "=", activityId as number)
      )
      .select([
        "t.id as task_id",
        "t.material_id",
        "t.activity_id",
        "t.target_group_id",
        "t.month_distribution",
        "t.number_of_dose",
        "t.updated_by",
        "t.ip",
        "t.code",
        "m.name as material_name",
        "a.name as activity_name",
        "tg.title as target_group_name",
        "wc.coverage_number",
        "l.id as province_id",
        "l.name as province_name",
      ])
      .execute()) as ExportRow[]
  }
}
