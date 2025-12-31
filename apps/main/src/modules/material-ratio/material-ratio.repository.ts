import { DB } from "@/common/infrastructure/database/types/db.js"
import { ValidationError } from "@smile/lib/error.js"
import { Context } from "hono"
import { Selectable, sql } from "kysely"
import { BaseRepository } from "../base.repository.js"
import {
  CreateInput,
  ListQueries,
  UpdateInput,
} from "./material-ratio.schema.js"

/** Row type returned by queries with joins */
export type MaterialRatioRow = Pick<
  Selectable<DB["ws_material_ratios"]>,
  | "id"
  | "from_material_id"
  | "from_material_qty"
  | "to_material_id"
  | "to_material_qty"
  | "from_subtype_id"
  | "to_subtype_id"
  | "updated_at"
  | "updated_by"
> & {
  from_material_name: string | null
  from_subtype_name: string | null
  to_material_name: string | null
  to_subtype_name: string | null
}

const MATERIAL_RATIO_SELECT = [
  "mr.id",
  "mr.from_material_id",
  "mr.from_material_qty",
  "mr.to_material_id",
  "mr.to_material_qty",
  "mr.from_subtype_id",
  "mr.to_subtype_id",
  "mr.updated_at",
  "mr.updated_by",
  "m_from.name as from_material_name",
  "m_to.name as to_material_name",
  "ms_from.name as from_subtype_name",
  "ms_to.name as to_subtype_name",
] as const

export class MaterialRatioRepository extends BaseRepository<"ws_material_ratios"> {
  constructor() {
    super("ws_material_ratios", false)
  }

  private handleDuplicateError(c: Context, error: unknown) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "ER_DUP_ENTRY"
    ) {
      throw new ValidationError(c.var.t("common.duplicate"))
    }
    throw error
  }

  private baseSelectQuery(c: Context) {
    return c.var.trx
      .selectFrom("ws_material_ratios as mr")
      .leftJoin("ws_materials as m_from", "m_from.id", "mr.from_material_id")
      .leftJoin("ws_materials as m_to", "m_to.id", "mr.to_material_id")
      .leftJoin(
        "material_subtypes as ms_from",
        "ms_from.id",
        "mr.from_subtype_id"
      )
      .leftJoin("material_subtypes as ms_to", "ms_to.id", "mr.to_subtype_id")
      .where("m_from.deleted_at", "is", null)
      .where("m_to.deleted_at", "is", null)
      .where("mr.deleted_at", "is", null)
  }

  async insert(c: Context, payload: CreateInput) {
    try {
      const existing = await c.var.trx
        .selectFrom("ws_material_ratios")
        .select(["id", "deleted_at"])
        .where("program_plan_id", "=", payload.program_plan_id)
        .where("from_material_id", "=", payload.from_material_id)
        .where("to_material_id", "=", payload.to_material_id)
        .executeTakeFirst()

      if (existing?.id != null) {
        if (existing.deleted_at == null) {
          throw new ValidationError(c.var.t("common.duplicate"))
        }

        await this.update(
          c,
          {
            program_plan_id: payload.program_plan_id,
            from_subtype_id: payload.from_subtype_id,
            from_material_id: payload.from_material_id,
            from_material_qty: payload.from_material_qty,
            to_subtype_id: payload.to_subtype_id,
            to_material_id: payload.to_material_id,
            to_material_qty: payload.to_material_qty,
            deleted_at: null,
            deleted_by: null,
          },
          { id: existing.id }
        )
      } else {
        await this.create(c, payload)
      }
    } catch (error) {
      this.handleDuplicateError(c, error)
    }
  }

  async patch(c: Context, id: number, payload: UpdateInput) {
    try {
      await this.update(c, payload, { id })
    } catch (error) {
      this.handleDuplicateError(c, error)
    }
  }

  async listByProgramPlan(
    c: Context,
    programPlanId: number,
    queries: ListQueries
  ) {
    const { page, paginate, material_id: materialIds } = queries
    const offset = (page - 1) * paginate

    const baseQuery = this.baseSelectQuery(c)
      .where("mr.program_plan_id", "=", programPlanId)
      .$if(!!materialIds?.length, (qb) =>
        qb.where((eb) =>
          eb.or([
            eb("mr.from_material_id", "in", materialIds!),
            eb("mr.to_material_id", "in", materialIds!),
          ])
        )
      )

    const [rows, countResult] = await Promise.all([
      baseQuery
        .select(MATERIAL_RATIO_SELECT)
        .distinct()
        .limit(paginate)
        .offset(offset)
        .execute(),
      baseQuery
        .select(sql<number>`COUNT(DISTINCT mr.id)`.as("total"))
        .executeTakeFirst(),
    ])

    return {
      list: rows,
      total: Number(countResult?.total ?? 0),
    }
  }

  async findById(c: Context, id: number) {
    const row = await this.baseSelectQuery(c)
      .where("mr.id", "=", id)
      .select(MATERIAL_RATIO_SELECT)
      .executeTakeFirst()

    return row ?? null
  }

  async softDelete(c: Context, id: number) {
    await c.var.trx
      .updateTable("ws_material_ratios")
      .set({
        deleted_at: new Date(),
        deleted_by: c.var.userId,
      })
      .where("id", "=", id)
      .where("deleted_at", "is", null)
      .execute()
  }
}
