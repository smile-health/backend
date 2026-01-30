import { Context } from "@smile-health/lib/types/context.js"
import { MaterialTargetsPaginatedRequestDTO } from "./material-targets.schema.js"
import { DB } from "@/common/infrastructure/database/types/db.js"

export class MaterialTargetsRepository {
  async getListMaterialTargets(
    c: Context<DB>,
    params: MaterialTargetsPaginatedRequestDTO
  ) {
    const { category, type } = params

    const baseQuery = c.var.trx
      .selectFrom("ws_material_targets as wmt")
      .where("wmt.deleted_at", "is", null)
      .$if(category != null, (qr) =>
        qr.where("wmt.category", "=", category as "bias" | "non_bias")
      )
      .$if(type != null, (qr) =>
        qr.where(
          "wmt.type",
          "=",
          type as "primary" | "additional" | "immunization"
        )
      )
      .leftJoin("ws_materials as wm", "wmt.material_id", "wm.id")
      .select([
        "wmt.id",
        "wmt.category",
        "wmt.type",
        "wmt.material_id",
        "wm.name",
      ])

    const [list, totalList] = await Promise.all([
      baseQuery.execute(),
      baseQuery.select((qb) => qb.fn.countAll().as("total")).executeTakeFirst(),
    ])

    return { list, total: Number(totalList?.total) || 0 }
  }

  async getMaterialTargetsByMaterialIds(
    c: Context<DB>,
    materialIds: number[],
    category: "bias" | "non_bias",
    type: "primary" | "additional"
  ) {
    return c.var.trx
      .selectFrom("ws_material_targets as wmt")
      .select(["wmt.id", "wmt.material_id", "wmt.category", "wmt.type"])
      .where("wmt.material_id", "in", materialIds)
      .where("wmt.category", "=", category)
      .where("wmt.type", "=", type)
      .where("wmt.deleted_at", "is", null)
      .execute()
  }

  async getMaterialTargetsByMaterialIdsAndMonth(
    c: Context<DB>,
    materialIds: number[],
    category: "bias" | "non_bias",
    type: "primary" | "additional",
    injectionMonth: string
  ) {
    return c.var.trx
      .selectFrom("ws_material_targets as wmt")
      .select([
        "wmt.id",
        "wmt.material_id",
        "wmt.category",
        "wmt.type",
        "wmt.injection_month",
      ])
      .where("wmt.material_id", "in", materialIds)
      .where("wmt.category", "=", category)
      .where("wmt.type", "=", type)
      .where("wmt.injection_month", "=", injectionMonth)
      .where("wmt.deleted_at", "is", null)
      .execute()
  }
}
