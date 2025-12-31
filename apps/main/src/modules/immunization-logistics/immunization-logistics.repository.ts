import { Context } from "hono"
import { BaseRepository } from "../base.repository.js"

export class ImmunizationLogisticsRepository extends BaseRepository<"ws_targets"> {
  constructor() {
    super("ws_targets")
  }

  async getSchoolsBySubDistrict(
    c: Context,
    subDistrictId: number,
    microplanningId: number
  ) {
    return c.var.trx
      .selectFrom("entities as e")
      .leftJoin("ws_school_estimation_details as sed", (join) =>
        join
          .onRef("sed.school_id", "=", "e.id")
          .on("sed.microplanning_id", "=", microplanningId)
          .on("sed.deleted_at", "is", null)
      )
      .leftJoin("ws_microplanning as mp", (join) =>
        join
          .onRef("mp.id", "=", "sed.microplanning_id")
          .on("mp.deleted_at", "is", null)
      )
      .select(["e.id as school_id", "e.name as school_name"])
      .where("e.sub_district_id", "=", String(subDistrictId))
      .where("e.entity_tag_id", "=", 14)
      .where((eb) =>
        eb.or([eb("e.name", "like", "MI%"), eb("e.name", "like", "SD%")])
      )
      .groupBy("e.id")
      .orderBy("e.id", "asc")
      .execute()
  }

  async getVillageMaterialData(
    c: Context,
    subDistrictId: number,
    microplanningId: number
  ) {
    return c.var.trx
      .selectFrom("locations as l")
      .leftJoin("ws_material_needs as wmn", (join) =>
        join
          .onRef("wmn.reference_id", "=", "l.id")
          .on("wmn.reference_type", "=", "village")
          .on("wmn.microplanning_id", "=", microplanningId)
          .on("wmn.deleted_at", "is", null)
      )
      .leftJoin(
        "ws_material_needs_details as wmnd",
        "wmn.id",
        "wmnd.material_need_id"
      )
      .leftJoin(
        "ws_material_targets as wmt",
        "wmn.material_target_id",
        "wmt.id"
      )
      .leftJoin("ws_materials as m", "wmt.material_id", "m.id")
      .select([
        "l.id as village_id",
        "l.name as village_name",
        "m.id as material_id",
        "m.name as material_name",
        "wmnd.absolute_number_of_routine_immunization",
        "wmnd.number_of_vials_used",
        "wmn.total_needs",
      ])
      .where("l.parent_id", "=", subDistrictId)
      .where("l.level", "=", 3)
      .where("wmt.deleted_at", "is", null)
      .execute()
  }

  async getVillageVaccineUtilizationRate(
    c: Context,
    subDistrictId: number,
    microplanningId: number
  ) {
    return c.var.trx
      .selectFrom("locations as l")
      .leftJoin("ws_material_needs as wmn", (join) =>
        join
          .onRef("wmn.reference_id", "=", "l.id")
          .on("wmn.reference_type", "=", "village")
          .on("wmn.microplanning_id", "=", microplanningId)
          .on("wmn.deleted_at", "is", null)
      )
      .leftJoin(
        "ws_vaccine_utilization_rate as wvur",
        "wmn.id",
        "wvur.material_need_id"
      )
      .leftJoin(
        "ws_material_targets as wmt",
        "wmn.material_target_id",
        "wmt.id"
      )
      .leftJoin("ws_materials as m", "wmt.material_id", "m.id")
      .select([
        "l.id as village_id",
        "l.name as village_name",
        "m.id as material_id",
        "m.name as material_name",
        "wvur.vaccine_utilization_rate",
      ])
      .where("l.parent_id", "=", subDistrictId)
      .where("l.level", "=", 3)
      .where("wmt.deleted_at", "is", null)
      .execute()
  }

  async getSchoolVaccineUtilizationRate(
    c: Context,
    subDistrictId: number,
    microplanningId: number,
    entityId: number
  ) {
    return c.var.trx
      .selectFrom("entities as e")
      .leftJoin("ws_material_needs as wmn", (join) =>
        join
          .onRef("wmn.reference_id", "=", "e.id")
          .on("wmn.reference_type", "=", "school")
          .on("wmn.microplanning_id", "=", microplanningId)
          .on("wmn.deleted_at", "is", null)
      )
      .leftJoin(
        "ws_vaccine_utilization_rate as wvur",
        "wmn.id",
        "wvur.material_need_id"
      )
      .leftJoin(
        "ws_material_targets as wmt",
        "wmn.material_target_id",
        "wmt.id"
      )
      .leftJoin("ws_materials as m", "wmt.material_id", "m.id")
      .select([
        "e.id as school_id",
        "e.name as school_name",
        "m.id as material_id",
        "m.name as material_name",
        "wvur.vaccine_utilization_rate",
      ])
      .where("e.sub_district_id", "=", String(subDistrictId))
      .where("e.entity_tag_id", "=", 14)
      .where((eb) =>
        eb.or([eb("e.name", "like", "MI%"), eb("e.name", "like", "SD%")])
      )
      .where("wmt.deleted_at", "is", null)
      .execute()
  }

  async getVillageMonthlyVaccineData(
    c: Context,
    subDistrictId: number,
    microplanningId: number
  ) {
    return c.var.trx
      .selectFrom("locations as l")
      .leftJoin("ws_material_needs as wmn", (join) =>
        join
          .onRef("wmn.reference_id", "=", "l.id")
          .on("wmn.reference_type", "=", "village")
          .on("wmn.microplanning_id", "=", microplanningId)
          .on("wmn.deleted_at", "is", null)
      )
      .leftJoin(
        "ws_material_needs_details as wmnd",
        "wmn.id",
        "wmnd.material_need_id"
      )
      .leftJoin(
        "ws_monthly_vaccine_need_details as wmnvd",
        "wmn.id",
        "wmnvd.material_need_id"
      )
      .leftJoin(
        "ws_material_targets as wmt",
        "wmn.material_target_id",
        "wmt.id"
      )
      .leftJoin("ws_materials as m", "wmt.material_id", "m.id")
      .select([
        "l.id as village_id",
        "l.name as village_name",
        "m.id as material_id",
        "m.name as material_name",
        "wmnd.remaining_stock",
        "wmnvd.min_stock",
        "wmnvd.max_stock",
        "wmnvd.request_qty",
      ])
      .where("l.parent_id", "=", subDistrictId)
      .where("l.level", "=", 3)
      .where("wmt.deleted_at", "is", null)
      .execute()
  }

  async getVillageVaccineDetailData(
    c: Context,
    villageId: number,
    microplanningId: number
  ) {
    return c.var.trx
      .selectFrom("ws_material_needs as wmn")
      .innerJoin(
        "ws_material_targets as wmt",
        "wmn.material_target_id",
        "wmt.id"
      )
      .leftJoin("ws_materials as m", "wmt.material_id", "m.id")
      .leftJoin(
        "ws_material_needs_details as wmnd",
        "wmn.id",
        "wmnd.material_need_id"
      )
      .leftJoin(
        "ws_monthly_vaccine_need_details as wmnvd",
        "wmn.id",
        "wmnvd.material_need_id"
      )
      .select([
        "m.id as material_id",
        "m.name as material_name",
        "wmnd.remaining_stock",
        "wmnvd.min_stock",
        "wmnvd.max_stock",
        "wmnvd.request_qty",
      ])
      .where("wmn.reference_id", "=", villageId)
      .where("wmn.reference_type", "=", "village")
      .where("wmn.microplanning_id", "=", microplanningId)
      .where("wmn.deleted_at", "is", null)
      .where("wmt.deleted_at", "is", null)
      .execute()
  }

  async getVillageAdditionalNeedsData(
    c: Context,
    subDistrictId: number,
    microplanningId: number
  ) {
    return c.var.trx
      .selectFrom("locations as l")
      .leftJoin("ws_material_needs as wmn", (join) =>
        join
          .onRef("wmn.reference_id", "=", "l.id")
          .on("wmn.reference_type", "=", "village")
          .on("wmn.microplanning_id", "=", microplanningId)
          .on("wmn.deleted_at", "is", null)
      )
      .leftJoin("ws_additional_needs as wan", "wmn.id", "wan.material_need_id")
      .leftJoin(
        "ws_material_targets as wmt",
        "wan.material_target_id",
        "wmt.id"
      )
      .leftJoin("ws_materials as m", "wmt.material_id", "m.id")
      .select([
        "l.id as village_id",
        "l.name as village_name",
        "m.id as material_id",
        "m.name as material_name",
        "wan.remaining_stock",
        "wan.total",
      ])
      .where("l.parent_id", "=", subDistrictId)
      .where("l.level", "=", 3)
      .where("wmt.deleted_at", "is", null)
      .execute()
  }

  async getVillageLogisticsDetailData(
    c: Context,
    villageId: number,
    microplanningId: number
  ) {
    return c.var.trx
      .selectFrom("ws_material_needs as wmn")
      .innerJoin(
        "ws_material_targets as wmt",
        "wmn.material_target_id",
        "wmt.id"
      )
      .leftJoin("ws_materials as m", "wmt.material_id", "m.id")
      .leftJoin("ws_additional_needs as wan", (join) =>
        join
          .onRef("wan.material_need_id", "=", "wmn.id")
          .onRef("wan.material_target_id", "=", "wmt.id")
      )
      .select([
        "m.id as material_id",
        "m.name as material_name",
        "wan.remaining_stock",
        "wan.total",
      ])
      .where("wmn.reference_id", "=", villageId)
      .where("wmn.reference_type", "=", "village")
      .where("wmn.microplanning_id", "=", microplanningId)
      .where("wmn.deleted_at", "is", null)
      .where("wmt.deleted_at", "is", null)
      .execute()
  }

  async getSchoolVialNeedsData(
    c: Context,
    subDistrictId: number,
    microplanningId: number,
    entityId: number
  ) {
    return c.var.trx
      .selectFrom("entities as e")
      .leftJoin("ws_material_needs as wmn", (join) =>
        join
          .onRef("wmn.reference_id", "=", "e.id")
          .on("wmn.reference_type", "=", "school")
          .on("wmn.microplanning_id", "=", microplanningId)
          .on("wmn.deleted_at", "is", null)
      )
      .leftJoin(
        "ws_material_needs_details as wmnd",
        "wmn.id",
        "wmnd.material_need_id"
      )
      .leftJoin(
        "ws_monthly_vaccine_need_details as wmnvd",
        "wmn.id",
        "wmnvd.material_need_id"
      )
      .leftJoin(
        "ws_material_targets as wmt",
        "wmn.material_target_id",
        "wmt.id"
      )
      .leftJoin("ws_materials as m", "wmt.material_id", "m.id")
      .select([
        "e.id as school_id",
        "e.name as school_name",
        "m.id as material_id",
        "m.name as material_name",
        "wmn.total_needs as planning",
        "wmnd.remaining_stock as available_stock",
        "wmnvd.request_qty",
      ])
      .where("e.sub_district_id", "=", String(subDistrictId))
      .where("e.entity_tag_id", "=", 14)
      .where((eb) =>
        eb.or([eb("e.name", "like", "MI%"), eb("e.name", "like", "SD%")])
      )
      .where("wmt.deleted_at", "is", null)
      .execute()
  }

  async getSchoolDetailVialNeedsData(
    c: Context,
    schoolId: number,
    microplanningId: number
  ) {
    return c.var.trx
      .selectFrom("ws_material_needs as wmn")
      .innerJoin(
        "ws_material_targets as wmt",
        "wmn.material_target_id",
        "wmt.id"
      )
      .leftJoin("ws_materials as m", "wmt.material_id", "m.id")
      .leftJoin(
        "ws_material_needs_details as wmnd",
        "wmn.id",
        "wmnd.material_need_id"
      )
      .leftJoin(
        "ws_monthly_vaccine_need_details as wmnvd",
        "wmn.id",
        "wmnvd.material_need_id"
      )
      .select([
        "m.id as material_id",
        "m.name as material_name",
        "wmn.total_needs as planning",
        "wmnd.remaining_stock as available_stock",
        "wmnvd.request_qty",
      ])
      .where("wmn.reference_id", "=", schoolId)
      .where("wmn.reference_type", "=", "school")
      .where("wmn.microplanning_id", "=", microplanningId)
      .where("wmn.deleted_at", "is", null)
      .where("wmt.deleted_at", "is", null)
      .execute()
  }

  async getSchoolLogisticsData(
    c: Context,
    subDistrictId: number,
    microplanningId: number,
    entityId: number
  ) {
    return c.var.trx
      .selectFrom("entities as e")
      .leftJoin("ws_material_needs as wmn", (join) =>
        join
          .onRef("wmn.reference_id", "=", "e.id")
          .on("wmn.reference_type", "=", "school")
          .on("wmn.microplanning_id", "=", microplanningId)
          .on("wmn.deleted_at", "is", null)
      )
      .leftJoin("ws_additional_needs as wan", "wmn.id", "wan.material_need_id")
      .leftJoin(
        "ws_material_targets as wmt",
        "wan.material_target_id",
        "wmt.id"
      )
      .leftJoin("ws_materials as m", "wmt.material_id", "m.id")
      .select([
        "e.id as school_id",
        "e.name as school_name",
        "m.id as material_id",
        "m.name as material_name",
        "wan.total",
        "wmt.injection_month",
      ])
      .where("e.sub_district_id", "=", String(subDistrictId))
      .where("e.entity_tag_id", "=", 14)
      .where((eb) =>
        eb.or([eb("e.name", "like", "MI%"), eb("e.name", "like", "SD%")])
      )
      .where("wmt.deleted_at", "is", null)
      .execute()
  }

  async getSchoolMaterialNeedsDetails(
    c: Context,
    subDistrictId: number,
    microplanningId: number,
    entityId: number
  ) {
    return c.var.trx
      .selectFrom("entities as e")
      .leftJoin("ws_material_needs as wmn", (join) =>
        join
          .onRef("wmn.reference_id", "=", "e.id")
          .on("wmn.reference_type", "=", "school")
          .on("wmn.microplanning_id", "=", microplanningId)
          .on("wmn.deleted_at", "is", null)
      )
      .leftJoin(
        "ws_material_needs_details as wmnd",
        "wmn.id",
        "wmnd.material_need_id"
      )
      .leftJoin(
        "ws_material_targets as wmt",
        "wmn.material_target_id",
        "wmt.id"
      )
      .leftJoin("ws_materials as m", "wmt.material_id", "m.id")
      .select([
        "e.id as school_id",
        "e.name as school_name",
        "m.id as material_id",
        "m.name as material_name",
        "wmnd.absolute_number_of_routine_immunization",
        "wmnd.number_of_vials_used",
      ])
      .where("e.sub_district_id", "=", String(subDistrictId))
      .where("e.entity_tag_id", "=", 14)
      .where((eb) =>
        eb.or([eb("e.name", "like", "MI%"), eb("e.name", "like", "SD%")])
      )
      .where("wmt.deleted_at", "is", null)
      .execute()
  }

  async getOutOfSchoolMaterialNeedsDetails(
    c: Context,
    subDistrictId: number,
    microplanningId: number
  ) {
    return c.var.trx
      .selectFrom("ws_targets as wt")
      .leftJoin("ws_material_needs as wmn", (join) =>
        join
          .onRef("wmn.reference_id", "=", "wt.id")
          .on("wmn.reference_type", "=", "out_of_school")
          .on("wmn.microplanning_id", "=", microplanningId)
          .on("wmn.deleted_at", "is", null)
      )
      .leftJoin(
        "ws_material_needs_details as wmnd",
        "wmn.id",
        "wmnd.material_need_id"
      )
      .leftJoin(
        "ws_material_targets as wmt",
        "wmn.material_target_id",
        "wmt.id"
      )
      .leftJoin("ws_materials as m", "wmt.material_id", "m.id")
      .select([
        "m.id as material_id",
        "m.name as material_name",
        "wmnd.absolute_number_of_routine_immunization",
        "wmnd.number_of_vials_used",
      ])
      .where("wt.residence_subdistrict_id", "=", subDistrictId)
      .where("wt.entity_id", "is", null)
      .where("wt.deleted_at", "is", null)
      .where("wmt.deleted_at", "is", null)
      .groupBy(["m.id", "m.name"])
      .execute()
  }

  async getOutOfSchoolVialNeedsData(
    c: Context,
    subDistrictId: number,
    microplanningId: number
  ) {
    return c.var.trx
      .selectFrom("ws_targets as wt")
      .leftJoin("ws_material_needs as wmn", (join) =>
        join
          .onRef("wmn.reference_id", "=", "wt.id")
          .on("wmn.reference_type", "=", "out_of_school")
          .on("wmn.microplanning_id", "=", microplanningId)
          .on("wmn.deleted_at", "is", null)
      )
      .leftJoin(
        "ws_material_needs_details as wmnd",
        "wmn.id",
        "wmnd.material_need_id"
      )
      .leftJoin(
        "ws_monthly_vaccine_need_details as wmnvd",
        "wmn.id",
        "wmnvd.material_need_id"
      )
      .leftJoin(
        "ws_material_targets as wmt",
        "wmn.material_target_id",
        "wmt.id"
      )
      .leftJoin("ws_materials as m", "wmt.material_id", "m.id")
      .select([
        "m.id as material_id",
        "m.name as material_name",
        "wmn.total_needs as planning",
        "wmnd.remaining_stock as available_stock",
        "wmnvd.request_qty",
      ])
      .where("wt.residence_subdistrict_id", "=", subDistrictId)
      .where("wt.entity_id", "is", null)
      .where("wt.deleted_at", "is", null)
      .where("wmt.deleted_at", "is", null)
      .groupBy(["m.id", "m.name"])
      .execute()
  }

  async getOutOfSchoolLogisticsData(
    c: Context,
    subDistrictId: number,
    microplanningId: number
  ) {
    const entityId = c.var.userEntity?.global_id

    return c.var.trx
      .selectFrom("ws_material_needs as wmn")
      .leftJoin("ws_additional_needs as wan", "wmn.id", "wan.material_need_id")
      .leftJoin(
        "ws_material_targets as wmt",
        "wan.material_target_id",
        "wmt.id"
      )
      .leftJoin("ws_materials as m", "wmt.material_id", "m.id")
      .select((eb) => [
        "m.id as material_id",
        "m.name as material_name",
        eb.fn.sum<number>("wan.total").as("total"),
        "wmt.injection_month",
      ])
      .where((eb) =>
        eb.or([
          eb.and([
            eb("wmn.reference_type", "=", "out_of_school"),
            eb("wmn.microplanning_id", "=", microplanningId),
          ]),
          eb.and([
            eb("wmn.reference_type", "=", "school"),
            eb("wmn.reference_id", "=", entityId ?? 0),
            eb("wmn.microplanning_id", "=", microplanningId),
          ]),
        ])
      )
      .where("wmn.deleted_at", "is", null)
      .where("wmt.deleted_at", "is", null)
      .where("wmt.category", "=", "bias")
      .where("wmt.type", "=", "additional")
      .groupBy(["m.id", "m.name", "wmt.injection_month"])
      .execute()
  }
}
