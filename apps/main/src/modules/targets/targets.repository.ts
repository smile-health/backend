import { Context } from "hono"
import { BaseRepository } from "../base.repository.js"
import {
  CreateTargetDataInternalDTO,
  NikListRequestDTO,
  UpdateTargetDataRequest,
  CreateTargetIdealDTO,
} from "./targets.schema.js"
import {
  SCHOOL_ENTITY_TAG_ID,
  SCHOOL_TARGET_GROUPS,
  TARGET_GROUP,
  VILLAGE_TARGET_GROUPS,
} from "@/common/constants/target.js"
import { TargetConsumptionQueries } from "../microplanning/microplanning-dashboard.schema.js"
import { sql } from "kysely"
import moment from "moment"

type LocationType = "province" | "city" | "district" | "village"

export class TargetsRepository extends BaseRepository<"ws_targets"> {
  constructor() {
    super("ws_targets")
  }

  async findOrCreateMicroplanning(
    c: Context,
    entityId: number,
    year: number
  ): Promise<number> {
    const existing = await c.var.trx
      .selectFrom("ws_microplanning")
      .select("id")
      .where("entity_id", "=", entityId)
      .where("year", "=", year)
      .where("deleted_at", "is", null)
      .executeTakeFirst()

    if (existing) {
      return Number(existing.id)
    }

    const result = await c.var.trx
      .insertInto("ws_microplanning")
      .values({
        entity_id: entityId,
        year: year,
        status: 0,
      })
      .executeTakeFirstOrThrow()

    return Number(result.insertId)
  }

  async getMicroplanningById(c: Context, microplanningId: number) {
    return await c.var.trx
      .selectFrom("ws_microplanning")
      .select(["id", "status"])
      .where("id", "=", microplanningId)
      .where("deleted_at", "is", null)
      .executeTakeFirst()
  }

  async create(c: Context, data: CreateTargetDataInternalDTO) {
    const result = await c.var.trx
      .insertInto("ws_targets")
      .values({
        ...data,
      })
      .executeTakeFirstOrThrow()

    return result
  }

  async existsByNIK(c: Context, nik: string): Promise<boolean> {
    const result = await c.var.trx
      .selectFrom("ws_targets")
      .select(["id"])
      .where("nik", "=", nik)
      .executeTakeFirst()

    return !!result
  }

  async findAllWithGroup(
    c: Context,
    ids: number[],
    subDistrictId: number,
    microplanningId: number
  ) {
    const result = await c.var.trx
      .selectFrom("target_groups as tg")
      .where("tg.id", "in", ids)
      .leftJoin("ws_targets as t", (join) =>
        join
          .onRef("tg.id", "=", "t.target_group_id")
          .on("t.deleted_at", "is", null)
          .on("t.microplanning_id", "=", microplanningId)
          .on((eb) =>
            eb.or([
              eb.and([
                eb("tg.id", "in", VILLAGE_TARGET_GROUPS),
                eb("t.entity_id", "is", null),
                eb("t.residence_subdistrict_id", "=", subDistrictId),
              ]),
              eb.and([
                eb("tg.id", "in", SCHOOL_TARGET_GROUPS),
                eb("t.entity_id", "in", (subquery) =>
                  subquery
                    .selectFrom("entities")
                    .select("id")
                    .where("sub_district_id", "=", String(subDistrictId))
                    .where("entity_tag_id", "=", SCHOOL_ENTITY_TAG_ID)
                    .where("deleted_at", "is", null)
                ),
              ]),
            ])
          )
      )
      .select((q) => [
        "tg.id",
        "tg.title",
        q.fn.count("t.id").$castTo<string>().as("qty"),
      ])
      .groupBy("tg.id")
      .orderBy("tg.id")
      .execute()

    return result
  }

  async findEqualAgeGroupCounts(
    c: Context,
    subDistrictId: number,
    microplanningId: number
  ) {
    const results = await c.var.trx
      .selectFrom("ws_targets as t")
      .where("t.entity_id", "is", null)
      .where("t.residence_subdistrict_id", "=", subDistrictId)
      .where("t.microplanning_id", "=", microplanningId)
      .where("t.deleted_at", "is", null)
      .where("t.target_group_id", "in", SCHOOL_TARGET_GROUPS)
      .select((q) => [
        "t.target_group_id",
        "t.gender",
        q.fn.count("t.id").$castTo<string>().as("qty"),
      ])
      .groupBy(["t.target_group_id", "t.gender"])
      .execute()

    return results
  }

  async findByTargetGroup(c: Context, target_group_id: number) {
    const firstResult = await c.var.trx
      .selectFrom("ws_targets")
      .select("entity_id")
      .where("target_group_id", "=", target_group_id)
      .where("deleted_at", "is", null)
      .limit(1)
      .executeTakeFirst()

    return firstResult && firstResult.entity_id !== null
  }

  async findAll(c: Context, query: NikListRequestDTO, microplanningId: number) {
    const categoryIdNum = query.category_id
      ? Number(query.category_id)
      : undefined
    const isDecimalCategory =
      categoryIdNum !== undefined && !Number.isInteger(categoryIdNum)
    const baseTargetGroupId = isDecimalCategory
      ? Math.floor(categoryIdNum)
      : categoryIdNum

    const targetGroupId11_1 = 10.1
    const categoryGenderMap: Record<number, number | null> = {
      4.1: null,
      5.1: null,
      7.1: 2,
      [targetGroupId11_1]: 1,
    }

    let result = c.var.trx
      .selectFrom("ws_targets")
      .where("deleted_at", "is", null)
      .where("microplanning_id", "=", microplanningId)
      .$if(query.prefix == "village", (q) =>
        q
          .where("residence_village_id", "=", Number(query.id))
          .where("entity_id", "is", null)
      )
      .$if(query.prefix === "school", (q) =>
        q.where((eb) =>
          eb.or([
            eb("entity_id", "=", Number(query.id)),
            eb.and([
              eb("entity_id", "is", null),
              eb("residence_village_id", "=", Number(query.id)),
            ]),
          ])
        )
      )
      .$if(query.category_id !== undefined && !isDecimalCategory, (q) =>
        q.where("target_group_id", "=", baseTargetGroupId!)
      )
      .$if(isDecimalCategory, (q) => {
        const gender = categoryGenderMap[categoryIdNum!]
        let subQuery = q
          .where("target_group_id", "=", baseTargetGroupId!)
          .where("entity_id", "is", null)

        if (gender !== null && gender !== undefined) {
          subQuery = subQuery.where("gender", "=", gender)
        }

        return subQuery
      })
      .select(["nik", "id"])

    if (query.keyword) {
      result = result.where("nik", "like", `%${query.keyword}%`)
    }

    result = result.orderBy("id", "desc")

    const offset = (query.page - 1) * query.paginate
    const [list, totalList, name, categoryData] = await Promise.all([
      result.limit(query.paginate).offset(offset).execute(),
      result
        .select((q) => q.fn.countAll().as("total"))
        .executeTakeFirstOrThrow(),
      query.prefix === "school"
        ? c.var.trx
            .selectFrom("entities")
            .select("name")
            .where("id", "=", Number(query.id))
            .executeTakeFirst()
            .then(
              (entityResult) =>
                entityResult ??
                c.var.trx
                  .selectFrom("locations")
                  .select((eb) =>
                    eb
                      .fn<string>("CONCAT", [eb.val("DESA "), eb.ref("name")])
                      .as("name")
                  )
                  .where("id", "=", Number(query.id))
                  .executeTakeFirst()
            )
        : c.var.trx
            .selectFrom("locations")
            .select("name")
            .where("id", "=", Number(query.id))
            .executeTakeFirst(),
      c.var.trx
        .selectFrom("ws_targets as t")
        .leftJoin("target_groups as tg", "t.target_group_id", "tg.id")
        .select("tg.id as category_id")
        .$if(query.prefix === "village", (q) =>
          q
            .where("t.residence_village_id", "=", Number(query.id))
            .where("t.entity_id", "is", null)
        )
        .$if(query.prefix === "school", (q) =>
          q.where((eb) =>
            eb.or([
              eb("entity_id", "=", Number(query.id)),
              eb.and([
                eb("entity_id", "is", null),
                eb("residence_village_id", "=", Number(query.id)),
              ]),
            ])
          )
        )
        .where("t.deleted_at", "is", null)
        .where("t.target_group_id", "is not", null)
        .$if(query.category_id !== undefined && !isDecimalCategory, (q) =>
          q.where("t.target_group_id", "=", baseTargetGroupId!)
        )
        .$if(isDecimalCategory, (q) => {
          const gender = categoryGenderMap[categoryIdNum!]
          let subQuery = q
            .where("t.target_group_id", "=", baseTargetGroupId!)
            .where("t.entity_id", "is", null)

          if (gender !== null && gender !== undefined) {
            subQuery = subQuery.where("t.gender", "=", gender)
          }

          return subQuery
        })
        .limit(1)
        .executeTakeFirst(),
    ])

    let formattedName: string | null = null
    if (query.prefix === "school") {
      formattedName = name?.name || null
    } else if (name?.name) {
      formattedName = `DESA ${name.name}`
    }

    const finalCategoryId = isDecimalCategory
      ? categoryIdNum
      : categoryData?.category_id || null

    return {
      name: formattedName,
      category_id: finalCategoryId,
      list: list,
      total: Number(totalList?.total) || 0,
    }
  }

  async delete(c: Context, nik: string, microplanningId: number) {
    const result = await c.var.trx
      .updateTable("ws_targets")
      .set({
        deleted_at: new Date(),
      })
      .where("nik", "=", nik)
      .where("microplanning_id", "=", microplanningId)
      .where("deleted_at", "is", null)
      .executeTakeFirst()

    return (result.numChangedRows ?? 0) > 0
  }

  async findByNik(c: Context, nik: string, microplanningId: number) {
    return await c.var.trx
      .selectFrom("ws_targets as t")
      .leftJoin("educations as edu", "t.education_id", "edu.id")
      .leftJoin("occupations as occ", "t.occupation_id", "occ.id")
      .leftJoin("religions as rel", "t.religion_id", "rel.id")
      .leftJoin("ethnics as eth", "t.ethnic_id", "eth.id")
      .select([
        "t.id",
        "t.nik",
        "t.gender",
        "t.date_of_birth",
        "t.registered_postal_code",
        "t.registered_village_id",
        "t.registered_address",
        "t.residence_postal_code",
        "t.residence_village_id",
        "t.residence_address",
        "t.entity_id",
        "t.grade",
        "t.target_group_id",
        "t.name",
        "t.marital_status",
        "t.education_id",
        "edu.title as education_title",
        "t.occupation_id",
        "occ.title as occupation_title",
        "t.religion_id",
        "rel.title as religion_title",
        "t.ethnic_id",
        "eth.title as ethnic_title",
        "t.phone_number",
      ])
      .where("t.nik", "=", nik)
      .where("t.microplanning_id", "=", microplanningId)
      .where("t.deleted_at", "is", null)
      .executeTakeFirst()
  }

  async update(
    c: Context,
    nik: string,
    data: UpdateTargetDataRequest,
    microplanningId: number
  ) {
    const result = await c.var.trx
      .updateTable("ws_targets")
      .set({
        registered_village_id: data.registered_village_id,
        registered_postal_code: data.registered_postal_code,
        registered_address: data.registered_address,
        residence_village_id: data.residence_village_id,
        residence_postal_code: data.residence_postal_code,
        residence_address: data.residence_address,
        entity_id: data.entity_id,
        grade: data.grade,
        name: data.name,
        marital_status: data.marital_status,
        education_id: data.education_id,
        occupation_id: data.occupation_id,
        religion_id: data.religion_id,
        ethnic_id: data.ethnic_id,
        phone_number: data.phone_number,
        updated_at: new Date(),
      })
      .where("nik", "=", nik)
      .where("microplanning_id", "=", microplanningId)
      .where("deleted_at", "is", null)
      .executeTakeFirst()

    return (result.numChangedRows ?? 0) > 0
  }

  async findGroupedTargets(
    c: Context,
    groupBy: "bias" | "non-bias",
    microplanningId: number,
    subDistrictId?: number
  ) {
    if (groupBy === "bias") {
      let query = c.var.trx
        .selectFrom("entities as e")
        .leftJoin("ws_targets as t", (join) =>
          join
            .onRef("e.id", "=", "t.entity_id")
            .on("t.deleted_at", "is", null)
            .on("t.microplanning_id", "=", microplanningId)
        )
        .leftJoin("target_groups as tg", "tg.id", "t.target_group_id")
        .leftJoin("locations as l", "e.sub_district_id", "l.id")
        .where("e.deleted_at", "is", null)
        .where((eb) =>
          eb.or([eb("e.name", "like", "MI%"), eb("e.name", "like", "SD%")])
        )
        .where("e.entity_tag_id", "=", SCHOOL_ENTITY_TAG_ID)

      if (subDistrictId) {
        query = query.where("e.sub_district_id", "=", String(subDistrictId))
      }

      const result = await query
        .select([
          "e.id",
          "e.name",
          "l.name as district",
          "t.target_group_id",
          "tg.title as target_group_title",
        ])
        .execute()

      return result
    } else {
      let query = c.var.trx
        .selectFrom("locations as l")
        .leftJoin("ws_targets as t", (join) =>
          join
            .onRef("l.id", "=", "t.residence_village_id")
            .on("t.deleted_at", "is", null)
            .on("t.entity_id", "is", null)
            .on("t.microplanning_id", "=", microplanningId)
        )
        .leftJoin("target_groups as tg", "tg.id", "t.target_group_id")
        .where("l.level", "=", 3)

      if (subDistrictId) {
        query = query.where("l.parent_id", "=", subDistrictId)
      }

      const result = await query
        .select([
          "l.id",
          "l.name",
          "t.target_group_id",
          "tg.title as target_group_title",
        ])
        .execute()

      return result
    }
  }

  async findTargetsBIAS(
    c: Context,
    sub_district_id: number,
    target_group_id: number
  ) {
    const result = c.var.trx
      .selectFrom("ws_targets as s")
      .leftJoin("entities as e", (join) =>
        join
          .onRef("e.id", "=", "s.entity_id")
          .on("e.sub_district_id", "=", String(sub_district_id))
          .on("e.entity_tag_id", "=", SCHOOL_ENTITY_TAG_ID)
      )
      .where("s.target_group_id", "=", target_group_id)
      .where("s.deleted_at", "is", null)
      .select((q) => [
        "e.id",
        "e.name as village_name",
        q.fn.count("s.id").as("total"),
      ])
      .groupBy("e.id")
      .execute()

    const sum = (await result).reduce(
      (acc, item) => acc + Number(item.total),
      0
    )

    return { result, sum }
  }

  async findOutOfSchoolTargets(
    c: Context,
    sub_district_id: number,
    target_group_ids: number[],
    microplanningId: number
  ) {
    return await c.var.trx
      .selectFrom("ws_targets")
      .where("residence_subdistrict_id", "=", sub_district_id)
      .where("target_group_id", "in", target_group_ids)
      .where("entity_id", "is", null)
      .where("microplanning_id", "=", microplanningId)
      .where("deleted_at", "is", null)
      .select(["target_group_id"])
      .execute()
  }

  async getTargetsByAgeGroup(
    c: Context,
    locationIds: number[],
    locationType: LocationType,
    gender?: number,
    start_date?: string,
    end_date?: string
  ) {
    const columnMap = {
      province: "residence_province_id" as const,
      city: "residence_regency_id" as const,
      district: "residence_subdistrict_id" as const,
      village: "residence_village_id" as const,
    }

    const locationColumn = columnMap[locationType]

    return await c.var.trx
      .selectFrom("ws_targets")
      .select([locationColumn, "date_of_birth"])
      .where("deleted_at", "is", null)
      .where(locationColumn, "in", locationIds)
      .$if(gender !== undefined, (qb) => qb.where("gender", "=", gender!))
      .$if(start_date !== undefined, (qb) =>
        qb.where("created_at", ">=", start_date! as any)
      )
      .$if(end_date !== undefined, (qb) =>
        qb.where("created_at", "<=", end_date! as any)
      )
      .execute()
  }

  async getConsumptionsByAgeGroup(
    c: Context,
    locationIds: number[],
    locationType: LocationType,
    gender?: number,
    start_date?: string,
    end_date?: string
  ) {
    const columnMap = {
      province: "residential_province_id" as const,
      city: "residential_regency_id" as const,
      district: "residential_subdistrict_id" as const,
      village: "residential_village_id" as const,
    }

    const locationColumn = columnMap[locationType]

    return await c.var.trx
      .selectFrom("ws_patient_immunizations as c")
      .innerJoin("ws_patients as p", "c.patient_id", "p.id")
      .select([`p.${locationColumn}` as any, "p.birth_date"])
      .where("c.deleted_at", "is", null)
      .where("p.deleted_at", "is", null)
      .where(`p.${locationColumn}` as any, "in", locationIds)
      .$if(gender !== undefined, (qb) => qb.where("p.gender", "=", gender!))
      .$if(start_date !== undefined, (qb) =>
        qb.where("c.created_at", ">=", start_date! as any)
      )
      .$if(end_date !== undefined, (qb) =>
        qb.where("c.created_at", "<=", end_date! as any)
      )
      .execute()
  }

  async getMaterialTargets(
    c: Context,
    locationIds: number[],
    locationType: LocationType,
    gender?: number,
    start_date?: string,
    end_date?: string
  ) {
    const columnMap = {
      province: "residence_province_id" as const,
      city: "residence_regency_id" as const,
      district: "residence_subdistrict_id" as const,
      village: "residence_village_id" as const,
    }

    const targetColumn = columnMap[locationType]

    const baseQuery = (category: "bias" | "non_bias") => {
      let query = c.var.trx
        .selectFrom("ws_targets as t")
        .innerJoin("ws_material_targets as mt", (join) => join.onTrue())
        .innerJoin("ws_materials as m", "mt.material_id", "m.id")
        .leftJoin("ws_materials as m_parent", "m.parent_id", "m_parent.id")
        .select((eb) => [
          `t.${targetColumn}` as any,
          eb
            .case()
            .when("m.parent_id", "is not", null)
            .then(
              eb.fn("CONCAT", [
                eb.ref("m.name"),
                eb.val(" ["),
                eb.fn
                  .agg<number>("ROW_NUMBER")
                  .over((ob) =>
                    ob
                      .partitionBy([
                        "m.parent_id",
                        `t.${targetColumn}`,
                        "t.date_of_birth",
                      ])
                      .orderBy("mt.id", "asc")
                  ),
                eb.val("]"),
              ])
            )
            .else(eb.ref("m.name"))
            .end()
            .as("material_name"),
          "t.date_of_birth",
        ])
        .where("t.deleted_at", "is", null)
        .where(targetColumn, "in", locationIds)
        .where("mt.category", "=", category)
        .where("mt.type", "=", "immunization")
        .where("mt.deleted_at", "is", null)
        .where("m.deleted_at", "is", null)

      if (gender !== undefined) {
        query = query.where("t.gender", "=", gender)
      }

      if (start_date !== undefined) {
        query = query.where("t.created_at", ">=", start_date as any)
      }

      if (end_date !== undefined) {
        query = query.where("t.created_at", "<=", end_date as any)
      }

      return query
    }

    const [biasTargets, nonBiasTargets] = await Promise.all([
      baseQuery("bias").execute(),
      baseQuery("non_bias").execute(),
    ])

    return [...biasTargets, ...nonBiasTargets]
  }

  async getCountMaterialTargets(
    c: Context,
    locationIds: number[],
    locationType: LocationType,
    gender?: number,
    start_date?: string,
    end_date?: string,
    material_ids?: number[]
  ) {
    const substringLength = {
      province: 2,
      city: 4,
      district: 6,
      village: 10,
    }

    const length = substringLength[locationType]

    const baseQuery = (category: "bias" | "non_bias") => {
      const query = c.var.trx
        .selectFrom("ws_material_targets as mt")
        .innerJoin("ws_material_needs as mn", "mn.material_target_id", "mt.id")
        .innerJoin("ws_materials as m", "mt.material_id", "m.id")
        .innerJoin("ws_microplanning as mc", "mn.microplanning_id", "mc.id")
        // .innerJoin("ws_targets as t", "t.microplanning_id", "mc.id")
        .select([
          sql<string>`SUBSTRING(LPAD(CAST(mn.reference_id AS CHAR), 10, '0'), 1, ${sql.raw(String(length))})`.as(
            "location_id"
          ),
          "m.name as material_name",
          "mn.total_needs as total",
        ])
        .where(
          sql`SUBSTRING(LPAD(CAST(mn.reference_id AS CHAR), 10, '0'), 1, ${sql.raw(String(length))})`,
          "in",
          locationIds.map((id) => String(id).padStart(length, "0"))
        )
        .where("mt.category", "=", category)
        .where("mt.type", "=", "primary")
        .where("mt.deleted_at", "is", null)
        .where("m.deleted_at", "is", null)
        // .$if(gender !== undefined, (qb) => qb.where("t.gender", "=", gender!))
        .$if(start_date !== undefined, (qb) => {
          const startDate = moment(start_date).format("YYYY")
          return qb.where("mc.year", ">=", startDate as any)
        })
        .$if(end_date !== undefined, (qb) => {
          const endDate = moment(end_date).format("YYYY")
          return qb.where("mc.year", "<=", endDate as any)
        })
        // .$if(targetGroups !== undefined && targetGroups.length > 0, (qb) =>
        //   qb.where("t.target_group_id", "in", targetGroups!)
        // )
        .$if(material_ids !== undefined && material_ids.length > 0, (qb) =>
          qb.where("mt.material_id", "in", material_ids!)
        )

      return query
    }

    const [biasTargets, nonBiasTargets] = await Promise.all([
      baseQuery("bias").execute(),
      baseQuery("non_bias").execute(),
    ])

    return [...biasTargets, ...nonBiasTargets]
  }

  async getMaterialConsumptions(
    c: Context,
    locationIds: number[],
    locationType: LocationType,
    queries: TargetConsumptionQueries
  ) {
    const columnMap = {
      province: "residential_province_id" as const,
      city: "residential_regency_id" as const,
      district: "residential_subdistrict_id" as const,
      village: "residential_village_id" as const,
    }

    const patientColumn = columnMap[locationType]

    return await c.var.trx
      .selectFrom("ws_patient_immunizations as pi")
      .innerJoin("ws_patients as p", "pi.patient_id", "p.id")
      .innerJoin(
        "ws_patient_immunization_details as pid",
        "pid.patient_immunization_id",
        "pi.id"
      )
      .innerJoin("ws_material_targets as mt", "mt.id", "pid.material_target_id")
      .innerJoin("ws_materials as m", "m.id", "mt.material_id")
      .leftJoin("ws_materials as m_parent", "m.parent_id", "m_parent.id")
      .select((eb) => [
        `p.${patientColumn}` as any,
        "mt.id as material_target_id",
        eb
          .case()
          .when("m.parent_id", "is not", null)
          .then(eb.ref("m_parent.name"))
          .else(eb.ref("m.name"))
          .end()
          .as("material_base_name"),
        "m.name as material_name",
        eb.fn.count("pid.id").as("total"),
      ])
      .where("pi.deleted_at", "is", null)
      .where("p.deleted_at", "is", null)
      .where("pid.deleted_at", "is", null)
      .where("mt.type", "=", "immunization")
      .where("pid.last_status", "=", 2)
      .where("pid.last_is_given", "=", 1)
      .where("mt.deleted_at", "is", null)
      .where("m.deleted_at", "is", null)
      .where(`p.${patientColumn}` as any, "in", locationIds)
      .$if(queries.gender !== undefined, (qb) =>
        qb.where("p.gender", "=", queries.gender)
      )
      .$if(queries.start_date !== undefined, (qb) =>
        qb.where("pid.injection_date", ">=", queries.start_date! as any)
      )
      .$if(queries.end_date !== undefined, (qb) =>
        qb.where("pid.injection_date", "<=", queries.end_date! as any)
      )
      .$if(
        queries.material_id !== undefined && queries.material_id.length > 0,
        (qb) => qb.where("m.global_id", "in", queries.material_id)
      )
      .$if(
        queries.batch_ids !== undefined && queries.batch_ids.length > 0,
        (qb) => qb.where("pid.batch_id", "in", queries.batch_ids)
      )
      .$if(
        queries.target_group !== undefined && queries.target_group.length > 0,
        (qb) => qb.where("pid.target_group_id", "in", queries.target_group)
      )
      .groupBy([`p.${patientColumn}`, "mt.id", "material_base_name", "m.name"])
      .execute()
  }

  async getImmunizationMaterialTargets(c: Context) {
    return await c.var.trx
      .selectFrom("ws_material_targets as mt")
      .innerJoin("ws_materials as m", "mt.material_id", "m.id")
      .select([
        "mt.id as mt_id",
        "m.id as material_id",
        "m.name as material_name",
        "mt.start_ideal_days",
        "mt.end_ideal_days",
        "mt.parent_id",
        "mt.category",
      ])
      .where("mt.type", "=", "immunization")
      .where("mt.deleted_at", "is", null)
      .where("m.deleted_at", "is", null)
      .orderBy("m.parent_id", "asc")
      .orderBy("mt.start_ideal_days", "asc")
      .execute()
  }

  async getAllImmunizationMaterialTargets(c: Context) {
    return await c.var.trx
      .selectFrom("ws_material_targets")
      .select(["id", "material_id", "start_ideal_days", "category"])
      .where("type", "=", "immunization")
      .where("deleted_at", "is", null)
      .execute()
  }

  async createTargetIdeals(c: Context, data: CreateTargetIdealDTO[]) {
    if (data.length === 0) return

    await c.var.trx
      .insertInto("ws_microplan_targets_consumptions")
      .values(data)
      .execute()
  }

  async updateTargetIdeals(c: Context, id: number, data) {
    if (data.length === 0) return

    await c.var.trx
      .updateTable("ws_microplan_targets_consumptions")
      .set(data)
      .where("id", "=", id)
      .execute()
  }

  async getTotalTargetData(
    c: Context,
    locationIds: number[],
    locationType: LocationType,
    gender?: number,
    start_date?: string,
    end_date?: string
  ) {
    const columnMap = {
      province: "residential_province_id" as const,
      city: "residential_regency_id" as const,
      district: "residential_subdistrict_id" as const,
      village: "residential_village_id" as const,
    }

    const patientColumn = columnMap[locationType]

    return await c.var.trx
      .selectFrom("ws_patient_immunization_details as pid")
      .innerJoin(
        "ws_patient_immunizations as pi",
        "pid.patient_immunization_id",
        "pi.id"
      )
      .innerJoin("ws_patients as p", "pi.patient_id", "p.id")
      .innerJoin("ws_material_targets as mt", "mt.id", "pid.material_target_id")
      .innerJoin("ws_materials as m", "m.id", "mt.material_id")
      .leftJoin("ws_materials as m_parent", "m.parent_id", "m_parent.id")
      .select((eb) => [
        `p.${patientColumn}` as any,
        eb
          .case()
          .when("m.parent_id", "is not", null)
          .then(eb.ref("m_parent.name"))
          .else(eb.ref("m.name"))
          .end()
          .as("material_base_name"),
        "m.name as material_name",
        "mt.id as material_target_id",
        eb.fn.count("pid.id").as("count"),
      ])
      .where("pid.last_status", "=", 2)
      .where("pid.last_is_given", "=", 1)
      .where("pid.deleted_at", "is", null)
      .where("pi.deleted_at", "is", null)
      .where("p.deleted_at", "is", null)
      .where("mt.type", "=", "immunization")
      .where("mt.deleted_at", "is", null)
      .where("m.deleted_at", "is", null)
      .where(`p.${patientColumn}` as any, "in", locationIds)
      .$if(gender !== undefined, (qb) => qb.where("p.gender", "=", gender!))
      .$if(start_date !== undefined, (qb) =>
        qb.where("pi.created_at", ">=", start_date! as any)
      )
      .$if(end_date !== undefined, (qb) =>
        qb.where("pi.created_at", "<=", end_date! as any)
      )
      .groupBy([`p.${patientColumn}`, "material_base_name", "m.name", "mt.id"])
      .execute()
  }

  async getMaterialTargetsByIdealDate(
    c: Context,
    locationIds: number[],
    locationType: LocationType,
    queries: TargetConsumptionQueries
  ) {
    const columnMap = {
      province: "residence_province_id" as const,
      city: "residence_regency_id" as const,
      district: "residence_subdistrict_id" as const,
      village: "residence_village_id" as const,
    }

    const targetColumn = columnMap[locationType]

    return await c.var.trx
      .selectFrom("ws_microplan_targets_consumptions as wmts")
      .innerJoin("ws_targets as t", "wmts.target_id", "t.id")
      .innerJoin(
        "ws_material_targets as mt",
        "wmts.material_target_id",
        "mt.id"
      )
      .innerJoin("ws_materials as m", "mt.material_id", "m.id")
      .innerJoin("ws_microplanning as wm", "wmts.microplanning_id", "wm.id")
      .leftJoin("ws_materials as m_parent", "m.parent_id", "m_parent.id")
      .select((eb) => [
        `t.${targetColumn}` as any,
        "mt.id as material_target_id",
        eb
          .case()
          .when("m.parent_id", "is not", null)
          .then(eb.ref("m_parent.name"))
          .else(eb.ref("m.name"))
          .end()
          .as("material_base_name"),
        "m.name as material_name",
        eb.fn.count("wmts.id").as("total"),
      ])
      .where("wmts.deleted_at", "is", null)
      .where("t.deleted_at", "is", null)
      .where("mt.type", "=", "immunization")
      .where("mt.deleted_at", "is", null)
      .where("m.deleted_at", "is", null)
      .where("wm.status", "=", 1)
      .where(`t.${targetColumn}` as any, "in", locationIds)
      .$if(queries.start_date !== undefined, (qb) =>
        qb.where("wmts.ideal_date", ">=", queries.start_date! as any)
      )
      .$if(queries.end_date !== undefined, (qb) =>
        qb.where("wmts.ideal_date", "<=", queries.end_date! as any)
      )
      .$if(queries.gender !== undefined, (qb) =>
        qb.where("t.gender", "=", queries.gender)
      )
      .$if(
        queries.material_id !== undefined && queries.material_id.length > 0,
        (qb) => qb.where("m.global_id", "in", queries.material_id)
      )
      .$if(
        queries.target_group !== undefined && queries.target_group.length > 0,
        (qb) => qb.where("wmts.target_group_id", "in", queries.target_group)
      )
      .groupBy([`t.${targetColumn}`, "mt.id", "material_base_name", "m.name"])
      .execute()
  }

  async getTargetGroup(c: Context, ageInDays: number, gender: number) {
    const result = await c.var.trx
      .selectFrom("target_groups")
      .select("id")
      .where("age_min", "<=", ageInDays)
      .where("age_max", ">=", ageInDays)
      .where("id", "in", TARGET_GROUP[gender])
      .where("deleted_at", "is", null)
      .where("is_active", "=", 1)
      .executeTakeFirst()

    return result
  }

  async getImmunizationMaterialTargetsWithDose(c: Context) {
    const materialTargets = await c.var.trx
      .selectFrom("ws_material_targets as mt")
      .innerJoin("ws_materials as m", "mt.material_id", "m.id")
      .select([
        "mt.id as mt_id",
        "m.id as material_id",
        "m.name as material_name",
        "mt.start_ideal_days",
        "mt.end_ideal_days",
        "mt.parent_id",
        "mt.category",
      ])
      .where("mt.type", "=", "immunization")
      .where("mt.deleted_at", "is", null)
      .where("m.deleted_at", "is", null)
      .orderBy("mt.start_ideal_days", "asc")
      .execute()

    // Get base name: use parent_name if exists, otherwise use material_name
    const getBaseName = (target: (typeof materialTargets)[0]): string => {
      return target.material_name
    }

    // First pass: count total doses per vaccine type
    const doseCountPerVaccine = new Map<string, number>()
    for (const target of materialTargets) {
      const baseName = getBaseName(target)
      doseCountPerVaccine.set(
        baseName,
        (doseCountPerVaccine.get(baseName) ?? 0) + 1
      )
    }

    // Second pass: assign dose numbers and formatted names
    const doseAssigned = new Map<string, number>()
    const result = materialTargets.map((target) => {
      const baseName = getBaseName(target)
      const totalDoses = doseCountPerVaccine.get(baseName) ?? 1
      const currentDose = (doseAssigned.get(baseName) ?? 0) + 1
      doseAssigned.set(baseName, currentDose)

      // Only add [dose] if there are multiple doses
      const formattedName =
        totalDoses > 1 ? `${baseName} ${currentDose}` : baseName

      return {
        mt_id: target.mt_id,
        material_id: target.material_id,
        material_name: target.material_name,
        base_name: baseName,
        dose: currentDose,
        formatted_name: formattedName,
        start_ideal_days: target.start_ideal_days,
        end_ideal_days: target.end_ideal_days,
        parent_id: target.parent_id,
        category: target.category,
      }
    })

    return result
  }

  async getBatchByMaterialId(c: Context, materialIds: number[]) {
    return await c.var.trx
      .selectFrom("ws_batches")
      .where("material_id", "in", materialIds)
      .where("deleted_at", "is", null)
      .orderBy("expired_date", "desc")
      .select(["id", "code", "expired_date"])
      .execute()
  }

  async getMicroplanTargetConsumptions(c: Context, targetId: number) {
    return await c.var.trx
      .selectFrom("ws_microplan_targets_consumptions")
      .where("target_id", "=", targetId)
      .where("deleted_at", "is", null)
      .select(["id", "ideal_date"])
      .execute()
  }

  async getAllMicroplanningsByYear(c: Context, year: number) {
    return c.var.trx
      .selectFrom("ws_microplanning")
      .selectAll()
      .where("year", "=", year)
      .where("deleted_at", "is", null)
      .execute()
  }

  async getNonBiasTargetsByMicroplanningId(
    c: Context,
    microplanningId: number,
    targetGroupIds: number[]
  ) {
    return c.var.trx
      .selectFrom("ws_targets as t")
      .selectAll("t")
      .where("t.microplanning_id", "=", microplanningId)
      .where("t.entity_id", "is", null)
      .where("t.target_group_id", "in", targetGroupIds)
      .where("t.deleted_at", "is", null)
      .execute()
  }

  async getBiasTargetsByMicroplanningId(
    c: Context,
    microplanningId: number,
    targetGroupIds: number[]
  ) {
    return c.var.trx
      .selectFrom("ws_targets as t")
      .selectAll("t")
      .where("t.microplanning_id", "=", microplanningId)
      .where("t.entity_id", "is not", null)
      .where("t.target_group_id", "in", targetGroupIds)
      .where("t.deleted_at", "is", null)
      .execute()
  }

  async getAllTargetGroups(c: Context) {
    return await c.var.trx
      .selectFrom("target_groups")
      .select(["id", "title", "age_min", "age_max", "is_active"])
      .where("deleted_at", "is", null)
      .where("is_active", "=", 1)
      .orderBy("id")
      .execute()
  }

  async getTargetsCountByGroup(
    c: Context,
    microplanningId: number,
    subDistrictId: number,
    targetGroupIds: number[]
  ) {
    return await c.var.trx
      .selectFrom("ws_targets as t")
      .innerJoin("target_groups as tg", "t.target_group_id", "tg.id")
      .select((q) => [
        "tg.id",
        "tg.title",
        q.fn.count("t.id").$castTo<string>().as("qty"),
      ])
      .where("t.deleted_at", "is", null)
      .where("t.microplanning_id", "=", microplanningId)
      .where("tg.id", "in", targetGroupIds)
      .where((eb) =>
        eb.or([
          eb.and([
            eb("tg.id", "in", VILLAGE_TARGET_GROUPS),
            eb("t.entity_id", "is", null),
            eb("t.residence_subdistrict_id", "=", subDistrictId),
          ]),
          eb.and([
            eb("tg.id", "in", SCHOOL_TARGET_GROUPS),
            eb("t.entity_id", "in", (subquery) =>
              subquery
                .selectFrom("entities")
                .select("id")
                .where("sub_district_id", "=", String(subDistrictId))
                .where("entity_tag_id", "=", SCHOOL_ENTITY_TAG_ID)
                .where("deleted_at", "is", null)
            ),
          ]),
        ])
      )
      .groupBy("tg.id")
      .orderBy("tg.id")
      .execute()
  }

  async getMicroplanningsForNextYear(c: Context) {
    const nextYear = new Date().getFullYear() + 1
    return await c.var.trx
      .selectFrom("ws_microplanning as m")
      .innerJoin("entities as e", "e.id", "m.entity_id")
      .select([
        "m.id as microplanning_id",
        "m.entity_id",
        "m.year",
        "e.sub_district_id",
      ])
      .where("m.year", "=", nextYear)
      .where("m.deleted_at", "is", null)
      .where("e.deleted_at", "is", null)
      .execute()
  }

  async getVillagesBySubDistrict(c: Context, subDistrictId: number) {
    return await c.var.trx
      .selectFrom("locations")
      .select(["id", "name"])
      .where("parent_id", "=", subDistrictId)
      .where("level", "=", 3)
      .execute()
  }

  async getSchoolsBySubDistrict(c: Context, subDistrictId: number) {
    return await c.var.trx
      .selectFrom("entities")
      .select(["id", "name"])
      .where("sub_district_id", "=", String(subDistrictId))
      .where("entity_tag_id", "=", SCHOOL_ENTITY_TAG_ID)
      .where("deleted_at", "is", null)
      .execute()
  }

  async getSnapshotCurrentCountsVillage(
    c: Context,
    villageId: number,
    microplanningId: number,
    targetGroupIds: number[]
  ) {
    return await c.var.trx
      .selectFrom("ws_targets")
      .select((eb) => [
        "target_group_id",
        eb.fn.count("id").$castTo<string>().as("count"),
      ])
      .where("deleted_at", "is", null)
      .where("target_group_id", "is not", null)
      .where("entity_id", "is", null)
      .where("residence_village_id", "=", villageId)
      .where("microplanning_id", "=", microplanningId)
      .where("target_group_id", "in", targetGroupIds)
      .groupBy("target_group_id")
      .execute()
  }

  async getSnapshotCurrentCountsSchool(
    c: Context,
    entityId: number,
    microplanningId: number,
    targetGroupIds: number[]
  ) {
    return await c.var.trx
      .selectFrom("ws_targets")
      .select((eb) => [
        "target_group_id",
        eb.fn.count("id").$castTo<string>().as("count"),
      ])
      .where("deleted_at", "is", null)
      .where("target_group_id", "is not", null)
      .where("entity_id", "=", entityId)
      .where("microplanning_id", "=", microplanningId)
      .where("target_group_id", "in", targetGroupIds)
      .groupBy("target_group_id")
      .execute()
  }

  async getSnapshotCurrentCountsOutOfSchool(
    c: Context,
    subDistrictId: number,
    microplanningId: number,
    targetGroupIds: number[]
  ) {
    return await c.var.trx
      .selectFrom("ws_targets")
      .select((eb) => [
        "target_group_id",
        eb.fn.count("id").$castTo<string>().as("count"),
      ])
      .where("deleted_at", "is", null)
      .where("target_group_id", "is not", null)
      .where("entity_id", "is", null)
      .where("residence_subdistrict_id", "=", subDistrictId)
      .where("microplanning_id", "=", microplanningId)
      .where("target_group_id", "in", targetGroupIds)
      .groupBy("target_group_id")
      .execute()
  }

  async getSnapshotPromotedCountsVillage(
    c: Context,
    villageId: number,
    microplanningId: number,
    targetGroupIds: number[]
  ) {
    return await c.var.trx
      .selectFrom("ws_targets as t")
      .innerJoin(
        "ws_microplan_targets_consumptions as mtc",
        "mtc.target_id",
        "t.id"
      )
      .select((eb) => [
        "mtc.target_group_id as original_group",
        eb.fn.countAll().$castTo<string>().as("promoted_count"),
      ])
      .where("t.deleted_at", "is", null)
      .where("mtc.deleted_at", "is", null)
      .where("t.microplanning_id", "=", microplanningId)
      .where("t.residence_village_id", "=", villageId)
      .where("t.entity_id", "is", null)
      .whereRef("t.target_group_id", ">", "mtc.target_group_id")
      .where("mtc.target_group_id", "in", targetGroupIds)
      .groupBy("mtc.target_group_id")
      .execute()
  }

  async getSnapshotPromotedCountsSchool(
    c: Context,
    entityId: number,
    microplanningId: number,
    targetGroupIds: number[]
  ) {
    return await c.var.trx
      .selectFrom("ws_targets as t")
      .innerJoin(
        "ws_microplan_targets_consumptions as mtc",
        "mtc.target_id",
        "t.id"
      )
      .select((eb) => [
        "mtc.target_group_id as original_group",
        eb.fn.countAll().$castTo<string>().as("promoted_count"),
      ])
      .where("t.deleted_at", "is", null)
      .where("mtc.deleted_at", "is", null)
      .where("t.microplanning_id", "=", microplanningId)
      .where("t.entity_id", "=", entityId)
      .whereRef("t.target_group_id", ">", "mtc.target_group_id")
      .where("mtc.target_group_id", "in", targetGroupIds)
      .groupBy("mtc.target_group_id")
      .execute()
  }

  async getSnapshotPromotedCountsOutOfSchool(
    c: Context,
    subDistrictId: number,
    microplanningId: number,
    targetGroupIds: number[]
  ) {
    return await c.var.trx
      .selectFrom("ws_targets as t")
      .innerJoin(
        "ws_microplan_targets_consumptions as mtc",
        "mtc.target_id",
        "t.id"
      )
      .select((eb) => [
        "mtc.target_group_id as original_group",
        eb.fn.countAll().$castTo<string>().as("promoted_count"),
      ])
      .where("t.deleted_at", "is", null)
      .where("mtc.deleted_at", "is", null)
      .where("t.microplanning_id", "=", microplanningId)
      .where("t.residence_subdistrict_id", "=", subDistrictId)
      .where("t.entity_id", "is", null)
      .whereRef("t.target_group_id", ">", "mtc.target_group_id")
      .where("mtc.target_group_id", "in", targetGroupIds)
      .groupBy("mtc.target_group_id")
      .execute()
  }

  async upsertDailyTargetSnapshot(
    c: Context,
    data: {
      snapshot_date: string
      microplanning_id: number
      target_group_id: number
      entity_type: string
      reference_id: number
      sub_district_id: number | null
      current_count: number
      cumulative_count: number
      promoted_out_count: number
      newly_added_count: number
    }
  ) {
    const upsertQuery = sql`
      INSERT INTO ws_daily_target_count_snapshots (
        snapshot_date,
        microplanning_id,
        target_group_id,
        entity_type,
        reference_id,
        sub_district_id,
        current_count,
        cumulative_count,
        promoted_out_count,
        newly_added_count,
        created_at,
        updated_at
      ) VALUES (
        ${data.snapshot_date},
        ${data.microplanning_id},
        ${data.target_group_id},
        ${data.entity_type},
        ${data.reference_id},
        ${data.sub_district_id},
        ${data.current_count},
        ${data.cumulative_count},
        ${data.promoted_out_count},
        ${data.newly_added_count},
        NOW(),
        NOW()
      )
      ON DUPLICATE KEY UPDATE
        current_count = VALUES(current_count),
        cumulative_count = VALUES(cumulative_count),
        promoted_out_count = VALUES(promoted_out_count),
        newly_added_count = VALUES(newly_added_count),
        updated_at = NOW()
    `
    return await c.var.trx.executeQuery(upsertQuery.compile(c.var.trx))
  }

  async getPreviousDaySnapshot(
    c: Context,
    previousDate: string,
    microplanningId: number,
    entityType: string,
    referenceId: number,
    targetGroupId: number
  ) {
    return await c.var.trx
      .selectFrom("ws_daily_target_count_snapshots")
      .select(["current_count", "cumulative_count"])
      .where("snapshot_date", "=", previousDate)
      .where("microplanning_id", "=", microplanningId)
      .where("entity_type", "=", entityType)
      .where("reference_id", "=", referenceId)
      .where("target_group_id", "=", targetGroupId)
      .where("deleted_at", "is", null)
      .executeTakeFirst()
  }

  async getSnapshotByDate(
    c: Context,
    snapshotDate: string,
    microplanningId: number,
    entityType: string,
    referenceId: number
  ) {
    return await c.var.trx
      .selectFrom("ws_daily_target_count_snapshots")
      .selectAll()
      .where("snapshot_date", "=", snapshotDate)
      .where("microplanning_id", "=", microplanningId)
      .where("entity_type", "=", entityType)
      .where("reference_id", "=", referenceId)
      .where("deleted_at", "is", null)
      .execute()
  }

  async getSnapshotHistoricalTrend(
    c: Context,
    microplanningId: number,
    entityType: string,
    referenceId: number,
    startDate: string,
    endDate: string
  ) {
    return await c.var.trx
      .selectFrom("ws_daily_target_count_snapshots")
      .select(["snapshot_date", "target_group_id", "cumulative_count"])
      .where("microplanning_id", "=", microplanningId)
      .where("entity_type", "=", entityType)
      .where("reference_id", "=", referenceId)
      .where("snapshot_date", ">=", startDate)
      .where("snapshot_date", "<=", endDate)
      .where("deleted_at", "is", null)
      .orderBy("snapshot_date", "asc")
      .execute()
  }

  async getSnapshotAggregateBySubDistrict(
    c: Context,
    snapshotDate: string,
    microplanningId: number,
    subDistrictId: number
  ) {
    return await c.var.trx
      .selectFrom("ws_daily_target_count_snapshots")
      .select((eb) => [
        "target_group_id",
        "entity_type",
        eb.fn.sum("cumulative_count").$castTo<string>().as("total_cumulative"),
        eb.fn.sum("current_count").$castTo<string>().as("total_current"),
      ])
      .where("snapshot_date", "=", snapshotDate)
      .where("microplanning_id", "=", microplanningId)
      .where("sub_district_id", "=", subDistrictId)
      .where("deleted_at", "is", null)
      .groupBy(["target_group_id", "entity_type"])
      .execute()
  }

  async getTargetsWithDateOfBirthByLocation(
    c: Context,
    subDistrictId: number,
    targetGroupId: number,
    microplanningId: number
  ) {
    return await c.var.trx
      .selectFrom("locations as l")
      .leftJoin("ws_targets as s", (join) =>
        join
          .onRef("l.id", "=", "s.residence_village_id")
          .on("s.target_group_id", "=", targetGroupId)
          .on("s.microplanning_id", "=", microplanningId)
          .on("s.deleted_at", "is", null)
      )
      .where("l.parent_id", "=", subDistrictId)
      .where("s.entity_id", "is", null)
      .select([
        "l.id as village_id",
        "l.name as village_name",
        "s.id as target_id",
        "s.date_of_birth",
        "s.gender",
        "s.target_group_id",
      ])
      .execute()
  }

  async getTargetsWithDateOfBirthByEntity(
    c: Context,
    subDistrictId: number,
    targetGroupId: number,
    microplanningId: number
  ) {
    return await c.var.trx
      .selectFrom("entities as e")
      .leftJoin("ws_targets as s", (join) =>
        join
          .onRef("e.id", "=", "s.entity_id")
          .on("s.target_group_id", "=", targetGroupId)
          .on("s.microplanning_id", "=", microplanningId)
          .on("s.deleted_at", "is", null)
      )
      .where("e.sub_district_id", "=", String(subDistrictId))
      .where("e.entity_tag_id", "=", SCHOOL_ENTITY_TAG_ID)
      .where("e.deleted_at", "is", null)
      .select([
        "e.id as entity_id",
        "e.name as entity_name",
        "s.id as target_id",
        "s.date_of_birth",
        "s.gender",
        "s.target_group_id",
      ])
      .execute()
  }

  async getTargetsByReferenceId(
    c: Context,
    referenceId: number,
    targetGroupId: number,
    microplanningId: number,
    type: "location" | "entity"
  ) {
    return await c.var.trx
      .selectFrom("ws_targets")
      .select(["id", "nik", "date_of_birth", "gender", "target_group_id"])
      .where("deleted_at", "is", null)
      .where("microplanning_id", "=", microplanningId)
      .where("target_group_id", "=", targetGroupId)
      .$if(type === "location", (q) =>
        q
          .where("residence_village_id", "=", referenceId)
          .where("entity_id", "is", null)
      )
      .$if(type === "entity", (q) => q.where("entity_id", "=", referenceId))
      .execute()
  }

  async getTargetsForRecalculation(
    c: Context,
    microplanningId: number,
    subDistrictId: number
  ) {
    return await c.var.trx
      .selectFrom("ws_targets as t")
      .select(["t.id", "t.date_of_birth", "t.gender", "t.entity_id"])
      .where("t.deleted_at", "is", null)
      .where("t.microplanning_id", "=", microplanningId)
      .where((eb) =>
        eb.or([
          eb.and([
            eb("t.entity_id", "is", null),
            eb("t.residence_subdistrict_id", "=", subDistrictId),
          ]),
          eb("t.entity_id", "in", (subquery) =>
            subquery
              .selectFrom("entities")
              .select("id")
              .where("sub_district_id", "=", String(subDistrictId))
              .where("entity_tag_id", "=", SCHOOL_ENTITY_TAG_ID)
              .where("deleted_at", "is", null)
          ),
        ])
      )
      .execute()
  }
}
