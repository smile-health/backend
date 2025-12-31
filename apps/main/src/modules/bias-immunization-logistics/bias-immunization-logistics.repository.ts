import { DB } from "@/common/infrastructure/database/types/db.js"
import { Context } from "hono"
import { Insertable } from "kysely"
import { SCHOOL_ENTITY_TAG_ID } from "@/common/constants/target.js"

export class BiasImmunizationLogisticsRepository {
  async checkExistingDataByReference(
    c: Context,
    referenceId: number,
    referenceType: string,
    microplanningId: number
  ) {
    return c.var.trx
      .selectFrom("ws_material_needs as wmn")
      .select(["wmn.id", "wmn.material_target_id", "wmn.reference_id"])
      .where("wmn.reference_id", "=", referenceId)
      .where("wmn.reference_type", "=", referenceType)
      .where("wmn.microplanning_id", "=", microplanningId)
      .where("wmn.deleted_at", "is", null)
      .execute()
  }

  async checkExistingData(
    c: Context,
    referenceId: number,
    referenceType: string,
    microplanningId: number,
    materialTargetIds: number[]
  ) {
    return c.var.trx
      .selectFrom("ws_material_needs as wmn")
      .select(["wmn.id", "wmn.material_target_id", "wmn.reference_id"])
      .where("wmn.reference_id", "=", referenceId)
      .where("wmn.reference_type", "=", referenceType)
      .where("wmn.microplanning_id", "=", microplanningId)
      .where("wmn.material_target_id", "in", materialTargetIds)
      .where("wmn.deleted_at", "is", null)
      .execute()
  }

  async saveMaterialNeed(
    c: Context,
    data: Insertable<DB["ws_material_needs"]>
  ) {
    const result = await c.var.trx
      .insertInto("ws_material_needs")
      .values({
        ...data,
        created_by: c.var.userId,
        updated_by: c.var.userId,
      })
      .executeTakeFirstOrThrow()

    return { id: Number(result.insertId) }
  }

  async saveMaterialNeedDetail(
    c: Context,
    data: Insertable<DB["ws_material_needs_details"]>
  ) {
    return c.var.trx
      .insertInto("ws_material_needs_details")
      .values({
        ...data,
        created_by: c.var.userId,
        updated_by: c.var.userId,
      })
      .executeTakeFirstOrThrow()
  }

  async saveMonthlyVaccineNeedDetail(
    c: Context,
    data: Insertable<DB["ws_monthly_vaccine_need_details"]>
  ) {
    return c.var.trx
      .insertInto("ws_monthly_vaccine_need_details")
      .values({
        ...data,
        created_by: c.var.userId,
        updated_by: c.var.userId,
      })
      .executeTakeFirstOrThrow()
  }

  async saveAdditionalNeed(
    c: Context,
    data: Insertable<DB["ws_additional_needs"]>
  ) {
    return c.var.trx
      .insertInto("ws_additional_needs")
      .values({
        ...data,
        created_by: c.var.userId,
        updated_by: c.var.userId,
      })
      .executeTakeFirstOrThrow()
  }

  async saveVaccineUtilizationRate(
    c: Context,
    data: Insertable<DB["ws_vaccine_utilization_rate"]>
  ) {
    return c.var.trx
      .insertInto("ws_vaccine_utilization_rate")
      .values({
        ...data,
        created_by: c.var.userId,
        updated_by: c.var.userId,
      })
      .executeTakeFirstOrThrow()
  }

  async getExistingMaterialNeeds(
    c: Context,
    referenceId: number,
    referenceType: string,
    microplanningId: number
  ) {
    return c.var.trx
      .selectFrom("ws_material_needs as wmn")
      .innerJoin(
        "ws_material_targets as wmt",
        "wmn.material_target_id",
        "wmt.id"
      )
      .leftJoin(
        "ws_material_needs_details as wmnd",
        "wmn.id",
        "wmnd.material_need_id"
      )
      .leftJoin(
        "ws_vaccine_utilization_rate as wvur",
        "wmn.id",
        "wvur.material_need_id"
      )
      .leftJoin("ws_additional_needs as wan", "wmn.id", "wan.material_need_id")
      .select([
        "wmn.id as material_need_id",
        "wmn.total_needs",
        "wmt.injection_month",
        "wmt.material_id",
        "wmt.category",
        "wmt.type",
        "wmnd.absolute_number_of_routine_immunization",
        "wmnd.number_of_vials_used",
        "wmnd.remaining_stock as detail_remaining_stock",
        "wvur.vaccine_utilization_rate",
        "wan.remaining_stock as additional_remaining_stock",
        "wan.total as additional_total",
      ])
      .where("wmn.reference_id", "=", referenceId)
      .where("wmn.reference_type", "=", referenceType)
      .where("wmn.microplanning_id", "=", microplanningId)
      .where("wmn.deleted_at", "is", null)
      .where("wmt.deleted_at", "is", null)
      .execute()
  }

  async getSchoolsBySubDistrictWithMaterialNeeds(
    c: Context,
    subDistrictId: number,
    microplanningId: number,
    keyword?: string
  ) {
    let query = c.var.trx
      .selectFrom("entities as e")
      .leftJoin("ws_material_needs as wmn", (join) =>
        join
          .onRef("wmn.reference_id", "=", "e.id")
          .on("wmn.reference_type", "=", "school")
          .on("wmn.microplanning_id", "=", microplanningId)
          .on("wmn.deleted_at", "is", null)
      )
      .select([
        "e.id as school_id",
        "e.name as school_name",
        "wmn.id as material_need_id",
      ])
      .where("e.sub_district_id", "=", String(subDistrictId))
      .where("e.entity_tag_id", "=", SCHOOL_ENTITY_TAG_ID)
      .where((eb) =>
        eb.or([eb("e.name", "like", "MI%"), eb("e.name", "like", "SD%")])
      )

    if (keyword) {
      query = query.where("e.name", "like", `%${keyword}%`)
    }

    return query.groupBy("e.id").orderBy("e.id", "asc").execute()
  }

  async updateMaterialNeed(
    c: Context,
    materialNeedId: number,
    totalNeeds: number | null
  ) {
    return c.var.trx
      .updateTable("ws_material_needs")
      .set({
        total_needs: totalNeeds,
        updated_by: c.var.userId,
        updated_at: new Date(),
      })
      .where("id", "=", materialNeedId)
      .where("deleted_at", "is", null)
      .executeTakeFirstOrThrow()
  }

  async updateMaterialNeedDetail(
    c: Context,
    materialNeedId: number,
    data: {
      absolute_number_of_routine_immunization: number | null
      number_of_vials_used: number | null
      remaining_stock: number | null
    }
  ) {
    return c.var.trx
      .updateTable("ws_material_needs_details")
      .set({
        ...data,
        updated_by: c.var.userId,
        updated_at: new Date(),
      })
      .where("material_need_id", "=", materialNeedId)
      .executeTakeFirstOrThrow()
  }

  async updateMonthlyVaccineNeedDetail(
    c: Context,
    materialNeedId: number,
    data: {
      request_qty: number | null
    }
  ) {
    return c.var.trx
      .updateTable("ws_monthly_vaccine_need_details")
      .set({
        ...data,
        updated_by: c.var.userId,
        updated_at: new Date(),
      })
      .where("material_need_id", "=", materialNeedId)
      .executeTakeFirstOrThrow()
  }

  async updateVaccineUtilizationRate(
    c: Context,
    materialNeedId: number,
    vaccineUtilizationRate: number
  ) {
    return c.var.trx
      .updateTable("ws_vaccine_utilization_rate")
      .set({
        vaccine_utilization_rate: vaccineUtilizationRate,
        updated_by: c.var.userId,
        updated_at: new Date(),
      })
      .where("material_need_id", "=", materialNeedId)
      .executeTakeFirstOrThrow()
  }

  async updateAdditionalNeed(
    c: Context,
    materialNeedId: number,
    data: {
      total: number | null
    }
  ) {
    return c.var.trx
      .updateTable("ws_additional_needs")
      .set({
        ...data,
        updated_by: c.var.userId,
        updated_at: new Date(),
      })
      .where("material_need_id", "=", materialNeedId)
      .executeTakeFirstOrThrow()
  }

  async getTransactionQtyByEntity(
    c: Context,
    entityId: number,
    transactionTypeId: number = 2
  ) {
    return c.var.trx
      .selectFrom("ws_transactions as t")
      .leftJoin("ws_stocks as s", "t.stock_id", "s.id")
      .leftJoin("ws_materials as m", "s.material_id", "m.id")
      .innerJoin("ws_material_targets as wmt", (join) =>
        join
          .onRef("m.id", "=", "wmt.material_id")
          .on("wmt.category", "=", "bias")
          .on("wmt.type", "=", "primary")
      )
      .select([
        "m.id as material_id",
        "m.code",
        "m.name",
        "t.opening_qty",
        "t.change_qty",
        "s.qty",
      ])
      .where("t.entity_id", "=", entityId)
      .where("t.transaction_type_id", "=", transactionTypeId)
      .execute()
  }
}
