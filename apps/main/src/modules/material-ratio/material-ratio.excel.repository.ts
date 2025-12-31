import { Context } from "hono"

/** Row type returned by getExportRows query */
export type ExportRow = {
  from_subtype_name: string | null
  from_material_name: string | null
  from_material_qty: number
  to_subtype_name: string | null
  to_material_name: string | null
  to_material_qty: number
  updated_by: number | null
}

export class MaterialRatioExcelRepository {
  async upsertRatio(
    c: Context,
    data: {
      program_plan_id: number
      from_subtype_id: number
      from_material_id: number
      from_material_qty: number
      to_subtype_id: number
      to_material_id: number
      to_material_qty: number
      user_id: number
    }
  ) {
    return await c.var.trx
      .insertInto("ws_material_ratios")
      .values({
        program_plan_id: data.program_plan_id,
        from_subtype_id: data.from_subtype_id,
        from_material_id: data.from_material_id,
        from_material_qty: data.from_material_qty,
        to_subtype_id: data.to_subtype_id,
        to_material_id: data.to_material_id,
        to_material_qty: data.to_material_qty,
        created_by: data.user_id,
        updated_by: data.user_id,
      })
      .onDuplicateKeyUpdate({
        from_subtype_id: data.from_subtype_id,
        from_material_qty: data.from_material_qty,
        to_subtype_id: data.to_subtype_id,
        to_material_qty: data.to_material_qty,
        updated_by: data.user_id,
        deleted_at: null,
        deleted_by: null,
      })
      .executeTakeFirst()
  }

  async getExportRows(
    c: Context,
    params: { programPlanId: number; materialIds?: number[] }
  ) {
    const { programPlanId, materialIds } = params

    return await c.var.trx
      .selectFrom("ws_material_ratios as mr")
      .leftJoin(
        "material_subtypes as ms_from",
        "ms_from.id",
        "mr.from_subtype_id"
      )
      .leftJoin("material_subtypes as ms_to", "ms_to.id", "mr.to_subtype_id")
      .leftJoin("ws_materials as m_from", "m_from.id", "mr.from_material_id")
      .leftJoin("ws_materials as m_to", "m_to.id", "mr.to_material_id")
      .where("mr.deleted_at", "is", null)
      .where("m_from.deleted_at", "is", null)
      .where("m_to.deleted_at", "is", null)
      .where("mr.program_plan_id", "=", programPlanId)
      .$if(!!materialIds?.length, (qb) =>
        qb.where((eb) =>
          eb.or([
            eb("mr.from_material_id", "in", materialIds!),
            eb("mr.to_material_id", "in", materialIds!),
          ])
        )
      )
      .select([
        "ms_from.name as from_subtype_name",
        "m_from.name as from_material_name",
        "mr.from_material_qty",
        "ms_to.name as to_subtype_name",
        "m_to.name as to_material_name",
        "mr.to_material_qty",
        "mr.updated_by",
      ])
      .execute()
  }
}
