import { Context } from "hono"
import { sql } from "kysely"
import { BaseRepository } from "../base.repository.js"
import {
  AnnualNeedIpvRequest,
  AnnualPopulationRequest,
  GetListAnnualNeedsQueries,
  GetNationalIpQueries,
  GetPopulationQueries,
  GetListAnnualNeedsByEntityQueries,
  GetAnnualNeedResultQueries,
  UpdatePopulationStatusRequest,
  GetAnnualNeedIpQueries,
  UpdateIpStatusRequest,
  UpdatePopulationRequest,
  UpdateIpRequest,
  CreateAnnualNeedResultRequest,
} from "./annual-needs.schema.js"
import { AnnualNeedApprovalStatus } from "../../common/constants/annual-needs.js"
type SubstitutionMap = Map<number, number[]>
export class AnnualNeedRepository extends BaseRepository<"ws_annual_needs"> {
  constructor() {
    super("ws_annual_needs", false)
  }

  async getById(c: Context, id: number) {
    const data = await c.var.trx
      .selectFrom("ws_annual_needs as wan")
      .innerJoin("locations as p", "p.id", "wan.province_id")
      .leftJoin("locations as r", "r.id", "wan.regency_id")
      .innerJoin("ws_program_plans as wpp", "wpp.id", "wan.program_plan_id")
      .select([
        "wan.id",
        "wan.province_id",
        "p.name as province_name",
        "wan.regency_id",
        "r.name as regency_name",
        "wan.program_plan_id",
        "wpp.year",
        "wan.status",
      ])
      .where("wan.id", "=", id)
      .where("wan.deleted_at", "is", null)
      .executeTakeFirst()

    return data
  }

  async updateStatus(c: Context, annualNeedId: number, status: number) {
    const result = await c.var.trx
      .updateTable("ws_annual_needs")
      .set({
        status,
        updated_at: new Date(),
        updated_by: c.get("user")?.id || null,
      })
      .where("id", "=", annualNeedId)
      .where("deleted_at", "is", null)
      .executeTakeFirst()

    return {
      affectedRows: Number(result.numUpdatedRows) || 0,
    }
  }

  async getListNeedsByEntity(
    c: Context,
    entityId: number,
    params: GetListAnnualNeedsByEntityQueries
  ) {
    const { page, paginate } = params
    const offset = (page - 1) * paginate

    const query = c.var.trx
      .selectFrom("ws_annual_needs as wan")
      .innerJoin("ws_program_plans as wpp", "wan.program_plan_id", "wpp.id")
      .select([
        "wan.id as id",
        "wan.program_plan_id",
        "wpp.year as year",
        "wan.status as status",
      ])
      .where("wan.entity_id", "=", entityId)
      .where("wan.deleted_at", "is", null)

    const [list, totalList] = await Promise.all([
      query.limit(paginate).offset(offset).execute(),
      query.select((eb) => eb.fn.countAll().as("total")).executeTakeFirst(),
    ])

    return {
      list,
      total: Number(totalList?.total) || 0,
    }
  }

  async getListNeedsProvince(c: Context, params: GetListAnnualNeedsQueries) {
    const {
      program_plan_year: year,
      province_id: provinceId,
      status,
      page,
      paginate,
    } = params
    let query = c.var.trx
      .selectFrom("ws_annual_needs as wan")
      .innerJoin("ws_program_plans as wpp", "wan.program_plan_id", "wpp.id")
      .innerJoin("locations as p", "p.id", "wan.province_id")
      .innerJoin("ws_entities as e", "e.id", "wan.entity_id")
      .select([
        "wan.id as id",
        "wpp.year as year",
        "wan.status as status",
        "wan.program_plan_id",
        "wan.province_id",
        "p.name as province_name",
        "wan.entity_id",
        "e.name as entity_name",
        "wan.min_max_status as min_max_status",
        "wan.min_max_updated_at as min_max_updated_at",
      ])
      .where("wpp.year", "=", year)
      .where("wan.province_id", "=", provinceId)

    if (status) query = query.where("wan.status", "=", status)

    const offset = (page - 1) * paginate

    const queryMinMaxStatus = c.var.trx
      .selectFrom("ws_annual_need_min_max_status as wamms")
      .innerJoin("ws_program_plans as wpp", "wamms.program_plan_id", "wpp.id")
      .select([
        "wamms.id",
        "wamms.province_activated_at",
        "wamms.regency_activated_at",
      ])
      .where("wamms.province_id", "=", provinceId)
      .where("wpp.year", "=", year)

    const queryEntityProvince = c.var.trx
      .selectFrom("ws_entities as e")
      .select(["e.id", "e.name"])
      .where("e.province_id", "=", provinceId.toString())
      .where("e.deleted_at", "is", null)
      .where("e.entity_tag_id", "=", 5)
      .where("program_id", "=", c.var.programId)

    const [list, totalList, minMaxStatus, entityProvince] = await Promise.all([
      query.limit(paginate).offset(offset).execute(),
      query.select((eb) => eb.fn.countAll().as("total")).executeTakeFirst(),
      queryMinMaxStatus.executeTakeFirst(),
      queryEntityProvince.executeTakeFirst(),
    ])

    return {
      list,
      total: Number(totalList?.total) || 0,
      min_max_status: minMaxStatus,
      entityProvince,
    }
  }

  async submitAnnualNeedPopulation(c: Context, body: AnnualPopulationRequest) {
    const { annual_need_id } = body
    const data: {
      annual_need_id: number
      entity_id: number
      target_group_id: number
      percentage: number
      population: number
      population_correction: number
      created_at: Date
      updated_at: Date
      created_by: number | null
      updated_by: number | null
    }[] = []
    for (const entity of body.entities) {
      for (const target_group of entity.target_groups) {
        data.push({
          annual_need_id,
          entity_id: entity.entity_id,
          target_group_id: target_group.target_group_id,
          percentage: target_group.percentage,
          population: target_group.population,
          population_correction: target_group.population_correction,
          created_at: new Date(),
          updated_at: new Date(),
          created_by: c.get("user")?.id || null,
          updated_by: c.get("user")?.id || null,
        })
      }
    }

    if (data.length > 0) {
      await c.var.trx
        .insertInto("ws_annual_need_populations")
        .values(data)
        .onDuplicateKeyUpdate({
          percentage: sql`values(percentage)`,
          population: sql`values(population)`,
          population_correction: sql`values(population_correction)`,
          updated_at: sql`values(updated_at)`,
          updated_by: sql`values(updated_by)`,
        })
        .execute()
    }

    return { success: true, inserted: data.length }
  }

  async submitAnnualNeedIpv(c: Context, body: AnnualNeedIpvRequest) {
    const { annual_need_id } = body

    const data: {
      annual_need_id: number
      material_id: number
      activity_id: number
      sku: number
      national_ip: number
      regency_ip: number
      created_at: Date
      updated_at: Date
      created_by: number | null
      updated_by: number | null
      target_group_id: number | null
    }[] = []

    for (const ip of body.ips) {
      data.push({
        annual_need_id,
        material_id: ip.material_id,
        activity_id: ip.activity_id,
        sku: ip.sku,
        national_ip: ip.national_ip,
        regency_ip: ip.regency_ip,
        created_at: new Date(),
        updated_at: new Date(),
        created_by: c.get("user")?.id || null,
        updated_by: c.get("user")?.id || null,
        target_group_id: ip.target_group_id || null,
      })
    }

    if (data.length > 0) {
      await c.var.trx
        .insertInto("ws_annual_need_ipvs")
        .values(data)
        .onDuplicateKeyUpdate({
          sku: sql`values(sku)`,
          national_ip: sql`values(national_ip)`,
          regency_ip: sql`values(regency_ip)`,
          updated_at: sql`values(updated_at)`,
          updated_by: sql`values(updated_by)`,
        })
        .execute()
    }

    return { success: true, inserted: data.length }
  }

  async getNationalIp(
    c: Context,
    programPlanId: number,
    params: GetNationalIpQueries
  ) {
    const { page, paginate } = params
    const offset = (page - 1) * paginate

    const baseQuery = c.var.trx
      .selectFrom("ws_annual_need_ipvs as wani")
      .innerJoin("ws_annual_needs as wan", "wan.id", "wani.annual_need_id")
      .innerJoin("ws_materials as m", "m.id", "wani.material_id")
      .innerJoin("ws_activities as wa", "wa.id", "wani.activity_id")
      .leftJoin("ws_users as u", "u.id", "wani.updated_by")
      .where("wan.program_plan_id", "=", programPlanId)
      .where("wani.deleted_at", "is", null)
      .where("wan.deleted_at", "is", null)

    const [list, totalList] = await Promise.all([
      baseQuery
        .select([
          "wani.id",
          "wani.material_id",
          sql<string>`m.name`.as("material_name"),
          "wani.activity_id",
          sql<string>`wa.name`.as("activity_name"),
          "wani.sku",
          "wani.national_ip",
          "wani.updated_by",
          sql<string>`u.firstname`.as("updated_by_firstname"),
          sql<string>`u.lastname`.as("updated_by_lastname"),
          "wani.updated_at",
        ])
        .limit(paginate)
        .offset(offset)
        .execute(),
      baseQuery.select((eb) => eb.fn.countAll().as("total")).executeTakeFirst(),
    ])

    return {
      list,
      total: Number(totalList?.total) || 0,
    }
  }

  async getMonthlyDistributionDetail(
    c: Context,
    annualNeedId: number,
    entityId: number,
    materialId: number,
    activityId: number
  ) {
    const result = await c.var.trx
      .selectFrom("ws_annual_need_results as wanr")
      .innerJoin("ws_entities as e", "e.id", "wanr.entity_id")
      .innerJoin("ws_materials as m", "m.id", "wanr.material_id")
      .innerJoin("ws_activities as wa", "wa.id", "wanr.activity_id")
      .select([
        "wanr.id",
        "wanr.entity_id",
        sql<string>`e.name`.as("entity_name"),
        "wanr.material_id",
        sql<string>`m.name`.as("material_name"),
        "wanr.activity_id",
        sql<string>`wa.name`.as("activity_name"),
        "wanr.month_distribution",
        "wanr.monthly_need",
      ])
      .where("wanr.annual_need_id", "=", annualNeedId)
      .where("wanr.entity_id", "=", entityId)
      .where("wanr.material_id", "=", materialId)
      .where("wanr.activity_id", "=", activityId)
      .where("wanr.deleted_at", "is", null)
      .execute()

    const data: {
      entity_id: number | null
      entity_name: string | null
      material_id: number | null
      material_name: string | null
      activity_id: number | null
      activity_name: string | null
      month_distribution: {
        month: string
        quantity: number
      }[]
    } = {
      entity_id: null,
      entity_name: null,
      material_id: null,
      material_name: null,
      activity_id: null,
      activity_name: null,
      month_distribution: [],
    }

    const monthMap = new Map<number, { monthLabel: string; quantity: number }>()

    for (const item of result) {
      // metadata (just set it once, the data is the same)
      data.entity_id ??= item.entity_id
      data.entity_name ??= item.entity_name
      data.material_id ??= item.material_id
      data.material_name ??= item.material_name
      data.activity_id ??= item.activity_id
      data.activity_name ??= item.activity_name

      const monthlyNeed = item.monthly_need ?? 0
      const months = this.parseMonthDistribution(item.month_distribution)

      for (const rawMonth of months) {
        const monthIndex = Number(rawMonth) // 1–12
        const monthLabel = this.formatMonthName(monthIndex, c.var.language)

        const current = monthMap.get(monthIndex)
        monthMap.set(monthIndex, {
          monthLabel,
          quantity: (current?.quantity ?? 0) + monthlyNeed,
        })
      }
    }

    data.month_distribution = Array.from(monthMap.entries())
      .sort(([a], [b]) => a - b)
      .map(([, val]) => ({
        month: val.monthLabel,
        quantity: val.quantity,
      }))

    return data
  }

  private formatMonthName(
    monthNumber: number,
    language: string | undefined
  ): string {
    const locale = language ?? "en"
    const formatter = new Intl.DateTimeFormat(locale, { month: "long" })
    return formatter.format(new Date(2000, monthNumber - 1, 1))
  }

  private parseMonthDistribution(raw: string | null | undefined): number[] {
    if (!raw) return []

    if (Array.isArray(raw)) return raw

    let months: number[] = []

    try {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed)) {
        months = parsed
          .map((v) => Number(v))
          .filter((m) => Number.isInteger(m) && m >= 1 && m <= 12)
      }
    } catch {
      months = String(raw)
        .split(",")
        .map((v) => Number(v.trim()))
        .filter((m) => Number.isInteger(m) && m >= 1 && m <= 12)
    }

    return months
  }

  async getPopulation(
    c: Context,
    programPlanId: number,
    params: GetPopulationQueries
  ) {
    const { regencyId } = params

    // Get program plan info
    const programPlan = await c.var.trx
      .selectFrom("ws_program_plans as wpp")
      .innerJoin("plan_approaches as pa", "pa.id", "wpp.approach_id")
      .select(["wpp.year as year_plan", "pa.name as approach"])
      .where("wpp.id", "=", programPlanId)
      .where("wpp.deleted_at", "is", null)
      .where("pa.deleted_at", "is", null)
      .executeTakeFirst()

    if (!programPlan) {
      return null
    }

    // Get annual need to find entity_id and province_id
    let annualNeedQuery = c.var.trx
      .selectFrom("ws_annual_needs as wan")
      .innerJoin("ws_program_plans as wpp", "wan.program_plan_id", "wpp.id")
      .select([
        "wan.id as annual_need_id",
        "wan.entity_id",
        "wan.province_id",
        "wpp.year",
      ])
      .where("wan.program_plan_id", "=", programPlanId)
      .where("wan.deleted_at", "is", null)

    if (regencyId) {
      annualNeedQuery = annualNeedQuery.where("wan.regency_id", "=", regencyId)
    }

    const annualNeed = await annualNeedQuery.executeTakeFirst()

    if (!annualNeed) {
      return null
    }

    const { global_id } = await c.var.trx
      .selectFrom("ws_entities")
      .select("global_id")
      .where("id", "=", annualNeed.entity_id)
      .executeTakeFirstOrThrow()

    // Get province info
    const province = await c.var.trx
      .selectFrom("locations as l")
      .select(["l.id", "l.name"])
      .where("l.id", "=", annualNeed.province_id)
      .executeTakeFirst()

    // Get entity info
    const entity = await c.var.trx
      .selectFrom("ws_entities as e")
      .select(["e.id", "e.name"])
      .where("e.id", "=", annualNeed.entity_id)
      .executeTakeFirst()

    // Get population data from populations (data yang sudah di-submit untuk annual need ini)
    const populations = await c.var.trx
      .selectFrom("populations as wanp")
      .innerJoin("target_groups as tg", "tg.id", "wanp.target_group_id")
      .select(["wanp.id", "tg.title as name", "wanp.population_number"])
      .where("wanp.year", "=", annualNeed.year)
      .where("wanp.entity_id", "=", global_id)
      .where("wanp.deleted_at", "is", null)
      .execute()

    return {
      year_plan: programPlan.year_plan,
      approach: programPlan.approach,
      province,
      entity,
      populations,
    }
  }

  async getAnnualNeedResultList(
    c: Context,
    annualNeedId: number,
    params: GetAnnualNeedResultQueries
  ) {
    const { page, paginate, activity_id, material_id, entity_id } = params
    const offset = (page - 1) * paginate

    let baseQuery = c.var.trx
      .selectFrom("ws_annual_need_results as anr")
      .leftJoin("ws_materials as m", "anr.material_id", "m.id")
      .leftJoin("ws_entities as e", "anr.entity_id", "e.id")
      .leftJoin("ws_users as u", "anr.updated_by", "u.id")
      .leftJoin("ws_activities as a", "anr.activity_id", "a.id")
      .leftJoin("locations as r", "r.id", "e.regency_id")
      .leftJoin("locations as sd", "sd.id", "e.sub_district_id")
      .where("anr.deleted_at", "is", null)
      .where("anr.annual_need_id", "=", annualNeedId)

    if (activity_id)
      baseQuery = baseQuery.where("anr.activity_id", "=", activity_id)
    if (material_id)
      baseQuery = baseQuery.where("anr.material_id", "=", material_id)
    if (entity_id) baseQuery = baseQuery.where("anr.entity_id", "=", entity_id)

    const query = baseQuery
      .select([
        "anr.entity_id",
        "e.name as entity_name",
        "anr.material_id",
        "m.name as material_name",
        "m.consumption_unit_per_distribution_unit as dose_per_vial",
        "e.regency_id",
        "r.name as regency_name",
        "e.sub_district_id",
        "sd.name as sub_district_name",
        sql`SUM(anr.ip)`.as("ip"),
        sql`SUM(anr.yearly_need)`.as("yearly_need"),
        sql`SUM(anr.monthly_need)`.as("monthly_need"),
        sql`SUM(anr.weekly_need)`.as("weekly_need"),
        sql`SUM(anr.min)`.as("min"),
        sql`SUM(anr.max)`.as("max"),
        "anr.updated_by",
        "u.firstname as updated_by_firstname",
        "u.lastname as updated_by_lastname",
        "anr.updated_at",
        "anr.activity_id",
        "a.name as activity_name",
        sql`SUM(anr.yearly_need_vial)`.as("yearly_need_vial"),
        sql`SUM(anr.monthly_need_vial)`.as("monthly_need_vial"),
        sql`SUM(anr.weekly_need_vial)`.as("weekly_need_vial"),
      ])
      .orderBy("anr.id", "asc")
      .groupBy(["anr.entity_id", "anr.material_id", "anr.activity_id"])

    const countQuery = baseQuery
      .select((eb) => eb.fn.count("anr.id").as("total"))
      .groupBy(["anr.entity_id", "anr.material_id", "anr.activity_id"])

    const [data, totalData] = await Promise.all([
      query.limit(paginate).offset(offset).execute(),
      countQuery.execute(),
    ])

    return {
      data,
      total: Number(totalData.length) || 0,
    }
  }

  async getPopulationByAnnualNeedId(c: Context, annualNeedId: number) {
    // Get all entities that have submitted population data for this annual need
    const populationData = await c.var.trx
      .selectFrom("ws_annual_need_populations as wanp")
      .innerJoin("ws_entities as e", "e.id", "wanp.entity_id")
      .innerJoin("target_groups as tg", "tg.id", "wanp.target_group_id")
      .leftJoin("locations as l", "l.id", "e.sub_district_id")
      .leftJoin("ws_users as u", "u.id", "wanp.updated_by")
      .select([
        "wanp.id as population_id",
        "wanp.entity_id",
        "e.name as entity_name",
        "e.sub_district_id",
        "l.name as sub_district_name",
        "wanp.target_group_id",
        "tg.title as target_group_name",
        "wanp.percentage",
        "wanp.population",
        "wanp.population_correction",
        "wanp.updated_by",
        "wanp.updated_at",
        "wanp.status",
        sql<string>`CONCAT(u.firstname, ' ', u.lastname)`.as("updated_by_name"),
      ])
      .where("wanp.annual_need_id", "=", annualNeedId)
      .where("wanp.deleted_at", "is", null)
      .orderBy("wanp.entity_id", "asc")
      .orderBy("wanp.target_group_id", "asc")
      .execute()

    return populationData
  }

  async updatePopulationStatus(
    c: Context,
    annualNeedId: number,
    data: UpdatePopulationStatusRequest
  ) {
    const statusMapping: Record<number, string> = {
      [AnnualNeedApprovalStatus.APPROVED]: "approved",
      [AnnualNeedApprovalStatus.REJECTED]: "rejected",
    }

    let updatedCount = 0

    for (const item of data) {
      const statusString = statusMapping[item.status]
      if (!statusString) {
        continue
      }

      const result = await c.var.trx
        .updateTable("ws_annual_need_populations")
        .set({
          status: item.status,
          updated_at: new Date(),
          updated_by: c.get("user")?.id || null,
        })
        .where("id", "=", item.id)
        .where("annual_need_id", "=", annualNeedId)
        .where("entity_id", "=", item.entity_id)
        .where("target_group_id", "=", item.target_group_id)
        .where("deleted_at", "is", null)
        .executeTakeFirst()

      updatedCount += Number(result.numUpdatedRows) || 0
    }

    return {
      affectedRows: updatedCount,
    }
  }

  async updatePopulation(
    c: Context,
    annualNeedId: number,
    data: UpdatePopulationRequest
  ) {
    const statusMapping: Record<number, string> = {
      [AnnualNeedApprovalStatus.REJECTED]: "rejected",
      [AnnualNeedApprovalStatus.APPROVED]: "approved",
    }

    let updatedCount = 0

    for (const item of data) {
      const statusString = statusMapping[item.status]
      if (!statusString) {
        continue
      }

      const result = await c.var.trx
        .updateTable("ws_annual_need_populations")
        .set({
          percentage: item.percentage,
          population: item.population,
          population_correction: item.population_correction,
          status: item.status,
          updated_at: new Date(),
          updated_by: c.get("user")?.id || null,
        })
        .where("id", "=", item.id)
        .where("annual_need_id", "=", annualNeedId)
        .where("deleted_at", "is", null)
        .executeTakeFirst()

      updatedCount += Number(result.numUpdatedRows) || 0
    }

    return {
      affectedRows: updatedCount,
    }
  }

  async getAnnualNeedIp(
    c: Context,
    annualNeedId: number,
    params: GetAnnualNeedIpQueries
  ) {
    // Get annual need basic info
    const annualNeed = await c.var.trx
      .selectFrom("ws_annual_needs as wan")
      .innerJoin("locations as p", "p.id", "wan.province_id")
      .leftJoin("locations as r", "r.id", "wan.regency_id")
      .innerJoin("ws_program_plans as wpp", "wpp.id", "wan.program_plan_id")
      .select([
        "wan.id",
        "wan.province_id",
        "p.name as province_name",
        "wan.regency_id",
        "r.name as regency_name",
        "wan.program_plan_id",
        "wpp.year",
      ])
      .where("wan.id", "=", annualNeedId)
      .where("wan.deleted_at", "is", null)
      .executeTakeFirst()

    if (!annualNeed) {
      return null
    }

    // Get IP data with pagination
    const query = c.var.trx
      .selectFrom("ws_annual_need_ipvs as wani")
      .innerJoin("ws_materials as m", "m.id", "wani.material_id")
      .innerJoin("ws_activities as wa", "wa.id", "wani.activity_id")
      .leftJoin("ws_users as u", "u.id", "wani.updated_by")
      .leftJoin("target_groups as tg", "tg.id", "wani.target_group_id")
      .select([
        "wani.id",
        "wani.material_id",
        "m.name as material_name",
        "wani.activity_id",
        "wa.name as activity_name",
        "wani.sku",
        "wani.national_ip",
        "wani.regency_ip",
        "wani.updated_by",
        sql<string>`CONCAT(COALESCE(u.firstname, ''), ' ', COALESCE(u.lastname, ''))`.as(
          "user_name"
        ),
        "wani.updated_at",
        "wani.target_group_id",
        "tg.title as target_group_name",
        "wani.status",
      ])
      .where("wani.annual_need_id", "=", annualNeedId)
      .where("wani.deleted_at", "is", null)

    const { page = 1, paginate = 10 } = params
    const offset = (page - 1) * paginate

    const [data, countResult] = await Promise.all([
      query.limit(paginate).offset(offset).execute(),
      c.var.trx
        .selectFrom("ws_annual_need_ipvs")
        .select(sql<number>`COUNT(*)`.as("count"))
        .where("annual_need_id", "=", annualNeedId)
        .where("deleted_at", "is", null)
        .executeTakeFirst(),
    ])

    const total = Number(countResult?.count || 0)

    return {
      annualNeed,
      data,
      total,
      page,
      paginate,
    }
  }

  async getMasterNationalIp(
    c: Context,
    annualNeedId: number,
    params: GetAnnualNeedIpQueries
  ) {
    const annualNeed = await this.getById(c, annualNeedId)
    if (!annualNeed) return null

    const query = c.var.trx
      .selectFrom("ws_plan_tasks as wpt")
      .innerJoin("ws_materials as wm", "wm.id", "wpt.material_id")
      .innerJoin("ws_activities as wa", "wa.id", "wpt.activity_id")
      .innerJoin("target_groups as tg", "tg.id", "wpt.target_group_id")
      .select([
        "wm.id as material_id",
        "wm.name as material_name",
        "wpt.activity_id",
        "wa.name as activity_name",
        "wm.consumption_unit_per_distribution_unit as sku",
        "wpt.ip as national_ip",
        "wpt.target_group_id",
        "tg.title as target_group_name",
      ])
      .where("wpt.program_plan_id", "=", annualNeed.program_plan_id)
      .where("wpt.deleted_at", "is", null)

    const { page = 1, paginate = 10 } = params
    const offset = (page - 1) * paginate

    const [list, totalList] = await Promise.all([
      query.limit(paginate).offset(offset).execute(),
      query.select((eb) => eb.fn.countAll().as("total")).executeTakeFirst(),
    ])

    return {
      data: list,
      total: Number(totalList?.total) || 0,
    }
  }

  async updateIpStatus(
    c: Context,
    annualNeedId: number,
    data: UpdateIpStatusRequest
  ) {
    const statusMapping: Record<number, string> = {
      [AnnualNeedApprovalStatus.APPROVED]: "approved",
      [AnnualNeedApprovalStatus.REJECTED]: "rejected",
    }

    let updatedCount = 0

    for (const item of data) {
      const statusString = statusMapping[item.status]
      if (!statusString) {
        continue
      }

      const result = await c.var.trx
        .updateTable("ws_annual_need_ipvs")
        .set({
          status: item.status,
          updated_at: new Date(),
          updated_by: c.get("user")?.id || null,
        })
        .where("id", "=", item.id)
        .where("annual_need_id", "=", annualNeedId)
        .where("deleted_at", "is", null)
        .executeTakeFirst()

      updatedCount += Number(result.numUpdatedRows) || 0
    }

    return {
      affectedRows: updatedCount,
    }
  }

  async updateIp(c: Context, annualNeedId: number, data: UpdateIpRequest) {
    const statusMapping: Record<number, string> = {
      [AnnualNeedApprovalStatus.APPROVED]: "approved",
      [AnnualNeedApprovalStatus.REJECTED]: "rejected",
    }

    let updatedCount = 0

    for (const item of data) {
      const statusString = statusMapping[item.status]
      if (!statusString) {
        continue
      }

      const result = await c.var.trx
        .updateTable("ws_annual_need_ipvs")
        .set({
          regency_ip: item.regency_ip,
          status: item.status,
          updated_at: new Date(),
          updated_by: c.get("user")?.id || null,
        })
        .where("id", "=", item.id)
        .where("annual_need_id", "=", annualNeedId)
        .where("deleted_at", "is", null)
        .executeTakeFirst()

      updatedCount += Number(result.numUpdatedRows) || 0
    }

    return {
      affectedRows: updatedCount,
    }
  }

  async findExistingAnnualNeedResult(
    c: Context,
    data: CreateAnnualNeedResultRequest
  ) {
    const result = await c.var.trx
      .selectFrom("ws_annual_need_results")
      .select(["id"])
      .where("annual_need_id", "=", data.annual_need_id)
      .where("deleted_at", "is", null)
      .executeTakeFirst()

    return result
  }

  // Helper to apply ratio conversion
  private readonly calc = (v, factor, m = 1) => Math.ceil(v * factor * m)

  applyRatio = (item, ratio) => {
    const factor = ratio.to_material_qty / ratio.from_material_qty
    const subtype = (ratio.material_subtype || "").toLowerCase()

    let yearly_need_vial = this.calc(item.yearly_need_vial, factor)
    let monthly_need_vial = this.calc(item.monthly_need_vial, factor)
    let weekly_need_vial = this.calc(item.weekly_need_vial, factor)

    let yearly_need = this.calc(item.yearly_need, factor)
    let monthly_need = this.calc(item.monthly_need, factor)
    let weekly_need = this.calc(item.weekly_need, factor)

    if (subtype === "dropper") {
      yearly_need = yearly_need_vial
      monthly_need = monthly_need_vial
      weekly_need = weekly_need_vial
    }

    if (subtype === "diluents" || subtype === "injection device") {
      const m = subtype === "diluents" ? ratio.sku : item.ip

      yearly_need = this.calc(item.yearly_need_vial, factor, m)
      monthly_need = this.calc(item.monthly_need_vial, factor, m)
      weekly_need = this.calc(item.weekly_need_vial, factor, m)

      yearly_need_vial = yearly_need
      monthly_need_vial = monthly_need
      weekly_need_vial = weekly_need
    }

    return {
      ...item,
      material_id: ratio.to_material_id,
      dependent_material_id: item.material_id,
      yearly_need,
      monthly_need,
      weekly_need,
      min: weekly_need,
      max: monthly_need,
      yearly_need_vial,
      monthly_need_vial,
      weekly_need_vial,
    }
  }

  private async fetchAnnualNeedDependencies(
    c: Context,
    annualNeedId: number,
    programPlanId: number,
    provinceId: number
  ) {
    return Promise.all([
      c.var.trx
        .selectFrom("ws_annual_need_ipvs as wani")
        .selectAll("wani")
        .innerJoin("ws_materials as wm", "wm.id", "wani.material_id")
        .select("wm.consumption_unit_per_distribution_unit as dose_per_unit")
        .where("wani.annual_need_id", "=", annualNeedId)
        .where("wani.deleted_at", "is", null)
        .execute(),

      c.var.trx
        .selectFrom("ws_annual_need_populations")
        .selectAll()
        .where("annual_need_id", "=", annualNeedId)
        .where("deleted_at", "is", null)
        .execute(),

      c.var.trx
        .selectFrom("ws_plan_tasks as wpt")
        .innerJoin("ws_coverage as wc", "wc.plan_task_id", "wpt.id")
        .selectAll("wpt")
        .select("wc.coverage_number")
        .where("wpt.program_plan_id", "=", programPlanId)
        .where("wc.province_id", "=", provinceId)
        .where("wpt.deleted_at", "is", null)
        .execute(),

      c.var.trx
        .selectFrom("ws_material_ratios as wmr")
        .innerJoin("ws_materials as wm", "wm.id", "wmr.from_material_id")
        .innerJoin("material_subtypes as wms", "wms.id", "wmr.to_subtype_id")
        .selectAll("wmr")
        .select([
          "wms.name as material_subtype",
          "wm.consumption_unit_per_distribution_unit as sku",
        ])
        .where("wmr.program_plan_id", "=", programPlanId)
        .where("wmr.deleted_at", "is", null)
        .execute(),
    ])
  }

  private buildTaskMap(tasks: any[]) {
    const map = new Map<string, any>()
    for (const t of tasks) {
      map.set(`${t.material_id}-${t.activity_id}-${t.target_group_id}`, t)
    }
    return map
  }

  private buildRatioMap(ratios: any[]) {
    const map = new Map<number, any[]>()
    for (const r of ratios) {
      if (!map.has(r.from_material_id)) map.set(r.from_material_id, [])
      map.get(r.from_material_id)!.push(r)
    }
    return map
  }

  private computeNeeds(pop, ip, pt) {
    const population = pop.population_correction ?? 0
    const coverage = pt.coverage_number ?? 0
    const dose = pt.number_of_dose ?? 1
    const ipValue = ip.regency_ip || 1
    const sku = ip.dose_per_unit || 1

    const yearlyVial = Math.ceil(
      (population * (coverage / 100) * dose) / ipValue
    )

    const yearlyDose = yearlyVial * sku

    const months = (pt.month_distribution || "")
      .split(",")
      .map(Number)
      .filter(Boolean)

    const monthlyVial = months.length
      ? Math.ceil(yearlyVial / months.length)
      : 0

    const weeklyVial = Math.ceil(monthlyVial / 4)

    return {
      yearlyDose,
      monthlyNeed: monthlyVial * sku,
      weeklyNeed: weeklyVial * sku,
      yearlyVial,
      monthlyVial,
      weeklyVial,
      month_distribution: JSON.stringify(months),
    }
  }

  private buildBaseResults({
    ipvs,
    populations,
    taskMap,
    annualNeedId,
    userId,
    now,
  }) {
    const updateIps: {
      annual_need_id: number
      material_id: number
      activity_id: number
      sku: number
      updated_at: Date
      updated_by: number | null
      target_group_id: number | null
    }[] = []

    // ----- BUILD INITIAL ITEMS -----
    const results: {
      annual_need_id: number
      entity_id: number
      activity_id: number
      material_id: number
      ip: number
      yearly_need: number
      monthly_need: number
      weekly_need: number
      min: number
      max: number
      month_distribution: string
      created_at: Date
      updated_at: Date
      created_by: number | null
      updated_by: number | null
      target_group_id: number
      dependent_material_id: number | null
      yearly_need_vial: number
      monthly_need_vial: number
      weekly_need_vial: number
    }[] = []

    for (const ip of ipvs) {
      if (ip.sku !== ip.dose_per_unit) {
        updateIps.push({
          annual_need_id: annualNeedId,
          material_id: ip.material_id,
          activity_id: ip.activity_id,
          sku: ip.dose_per_unit,
          updated_at: now,
          updated_by: userId,
          target_group_id: ip.target_group_id,
        })
      }

      for (const pop of populations.filter(
        (p) => p.target_group_id === ip.target_group_id
      )) {
        const pt = taskMap.get(
          `${ip.material_id}-${ip.activity_id}-${pop.target_group_id}`
        )
        if (!pt) continue

        const calc = this.computeNeeds(pop, ip, pt)

        results.push({
          annual_need_id: annualNeedId,
          entity_id: pop.entity_id,
          activity_id: ip.activity_id,
          material_id: ip.material_id,
          ip: ip.regency_ip || 0,
          yearly_need: calc.yearlyDose,
          monthly_need: calc.monthlyNeed,
          weekly_need: calc.weeklyNeed,
          min: calc.weeklyNeed,
          max: calc.monthlyNeed,
          month_distribution: calc.month_distribution,
          created_at: now,
          updated_at: now,
          created_by: userId,
          updated_by: userId,
          target_group_id: pop.target_group_id,
          dependent_material_id: null,
          yearly_need_vial: calc.yearlyVial,
          monthly_need_vial: calc.monthlyVial,
          weekly_need_vial: calc.weeklyVial,
        })
      }
    }

    return { results, updateIps }
  }

  private expandMaterialRatios(baseResults, ratioMap) {
    const queue = [...baseResults]
    const visited = new Set<string>()
    const resultMap = new Map<string, any>()

    const makeKey = (v) =>
      `${v.entity_id}-${v.material_id}-${v.activity_id}-${v.target_group_id}`

    for (const r of baseResults) {
      resultMap.set(makeKey(r), { ...r })
    }

    while (queue.length) {
      const cur = queue.shift()
      if (!cur) continue

      const key = `${cur.entity_id}-${cur.material_id}-${cur.dependent_material_id ?? "root"}-${cur.activity_id}-${cur.target_group_id}`
      if (visited.has(key)) continue
      visited.add(key)

      const ratios = ratioMap.get(cur.material_id)
      if (!ratios) continue

      for (const r of ratios) {
        const converted = this.applyRatio(cur, r)
        const ratKey = makeKey(converted)
        const existing = resultMap.get(ratKey)

        if (existing) {
          // summary need result
          existing.yearly_need += converted.yearly_need
          existing.monthly_need += converted.monthly_need
          existing.weekly_need += converted.weekly_need
          existing.yearly_need_vial += converted.yearly_need_vial
          existing.monthly_need_vial += converted.monthly_need_vial
          existing.weekly_need_vial += converted.weekly_need_vial
          existing.min += converted.min
          existing.max += converted.max
        } else {
          // new data
          queue.push(converted)
          resultMap.set(ratKey, converted)
        }
      }
    }

    return Array.from(resultMap.values())
  }

  async createAnnualNeedResults(c: Context, annualNeedId: number) {
    const annualNeed = await this.getById(c, annualNeedId)
    if (!annualNeed) return null

    const { program_plan_id, province_id } = annualNeed
    const userId = c.get("user")?.id ?? null
    const now = new Date()

    const [ipvs, populations, tasks, ratios] =
      await this.fetchAnnualNeedDependencies(
        c,
        annualNeedId,
        program_plan_id,
        province_id
      )

    const taskMap = this.buildTaskMap(tasks)
    const ratioMap = this.buildRatioMap(ratios)

    const { results, updateIps } = this.buildBaseResults({
      ipvs,
      populations,
      taskMap,
      annualNeedId,
      userId,
      now,
    })

    const finalResults = this.expandMaterialRatios(results, ratioMap)

    if (finalResults.length) {
      await c.var.trx
        .insertInto("ws_annual_need_results")
        .values(finalResults)
        .onDuplicateKeyUpdate({
          ip: sql`values(ip)`,
          yearly_need: sql`values(yearly_need)`,
          monthly_need: sql`values(monthly_need)`,
          weekly_need: sql`values(weekly_need)`,
          min: sql`values(min)`,
          max: sql`values(max)`,
          month_distribution: sql`values(month_distribution)`,
          updated_at: sql`values(updated_at)`,
          updated_by: sql`values(updated_by)`,
          target_group_id: sql`values(target_group_id)`,
          dependent_material_id: sql`values(dependent_material_id)`,
          yearly_need_vial: sql`values(yearly_need_vial)`,
          monthly_need_vial: sql`values(monthly_need_vial)`,
          weekly_need_vial: sql`values(weekly_need_vial)`,
        })
        .execute()
    }

    if (updateIps.length) {
      await c.var.trx
        .insertInto("ws_annual_need_ipvs")
        .values(updateIps)
        .onDuplicateKeyUpdate({
          sku: sql`values(sku)`,
          updated_at: sql`values(updated_at)`,
          updated_by: sql`values(updated_by)`,
        })
        .execute()
    }

    return {
      success: true,
      message: `Inserted/Updated ${finalResults.length} records.`,
    }
  }

  async buildSubstitutionMap(
    c: Context,
    programPlanId: number,
    materialIds: number[]
  ): Promise<SubstitutionMap> {
    if (!materialIds.length) return new Map()

    const rows = await c.var.trx
      .selectFrom("ws_material_substitutions")
      .select(["material_id", "substitution_material_id"])
      .where("material_id", "in", materialIds)
      .where("program_plan_id", "=", programPlanId)
      .where("deleted_at", "is", null)
      .execute()

    const map: SubstitutionMap = new Map()

    for (const r of rows) {
      const list = map.get(r.material_id) ?? []
      list.push(r.substitution_material_id)
      map.set(r.material_id, list)
    }

    return map
  }

  buildSubstitutionUpdate(
    c: Context,
    params: {
      entityId: number
      activityId: number
      substitutionMaterialIds: number[]
      min: number
      max: number
      updatedAt: Date
      updatedBy: number | null
    }
  ) {
    if (!params.substitutionMaterialIds.length) return null

    return c.var.trx
      .updateTable("ws_entity_material_activities")
      .set({
        min: params.min,
        max: params.max,
        updated_at: params.updatedAt,
        updated_by: params.updatedBy,
      })
      .where("activity_id", "=", params.activityId)
      .where("entity_id", "=", params.entityId)
      .where("deleted_at", "is", null)
      .where("material_id", "in", params.substitutionMaterialIds)
  }

  buildBaseUpdate(
    c: Context,
    params: {
      entityId: number
      activityId: number
      min: number
      max: number
      updatedAt: Date
      updatedBy: number | null
    }
  ) {
    return c.var.trx
      .updateTable("ws_entity_material_activities")
      .set({
        min: params.min,
        max: params.max,
        updated_at: params.updatedAt,
        updated_by: params.updatedBy,
      })
      .where("activity_id", "=", params.activityId)
      .where("entity_id", "=", params.entityId)
      .where("deleted_at", "is", null)
  }

  async activatedMinMaxHealthCenter(
    c: Context,
    programPlanId: number,
    annualNeedIds: number[]
  ) {
    const updatedAt = new Date()
    const updatedBy = c.get("user")?.id ?? null

    const annualNeedResults = await c.var.trx
      .selectFrom("ws_annual_need_results")
      .select([
        "entity_id",
        "material_id",
        "activity_id",
        sql`SUM(min)`.as("total_min"),
        sql`SUM(max)`.as("total_max"),
      ])
      .where("annual_need_id", "in", annualNeedIds)
      .where("deleted_at", "is", null)
      .groupBy(["entity_id", "material_id", "activity_id"])
      .execute()

    if (!annualNeedResults.length) return

    const substitutionMap = await this.buildSubstitutionMap(
      c,
      programPlanId,
      annualNeedResults.map((r) => r.material_id)
    )

    const queries = annualNeedResults.flatMap((r) => {
      const min = Number(r.total_min ?? 0)
      const max = Number(r.total_max ?? 0)

      const updates: Promise<any[]>[] = []

      // material utama
      updates.push(
        this.buildBaseUpdate(c, {
          entityId: r.entity_id,
          activityId: r.activity_id,
          min,
          max,
          updatedAt,
          updatedBy,
        })
          .where("material_id", "=", r.material_id)
          .execute()
      )

      // material substitution
      const substitutionIds = substitutionMap.get(r.material_id)
      if (substitutionIds?.length) {
        updates.push(
          this.buildSubstitutionUpdate(c, {
            entityId: r.entity_id,
            activityId: r.activity_id,
            substitutionMaterialIds: substitutionIds,
            min,
            max,
            updatedAt,
            updatedBy,
          })!.execute()
        )
      }

      return updates
    })

    await Promise.all(queries)

    return { substitutionMap }
  }

  async createOrUpdateAnnualNeedMinMaxStatus(
    c: Context,
    programPlanId: number,
    provinceId: number
  ) {
    const existing = await c.var.trx
      .selectFrom("ws_annual_need_min_max_status")
      .selectAll()
      .where("province_id", "=", provinceId)
      .where("program_plan_id", "=", programPlanId)
      .where("deleted_at", "is", null)
      .executeTakeFirst()

    if (!existing) {
      const entity = await c.var.trx
        .selectFrom("ws_entities")
        .select(["id"])
        .where("province_id", "=", provinceId.toString())
        .where("entity_tag_id", "=", 5)
        .where("program_id", "=", c.var.programId)
        .executeTakeFirst()

      await c.var.trx
        .insertInto("ws_annual_need_min_max_status")
        .values({
          province_id: provinceId,
          program_plan_id: programPlanId,
          entity_id: entity?.id || 0,
          regency_activated_at: new Date(),
          created_at: new Date(),
          updated_at: new Date(),
          created_by: c.get("user")?.id || null,
          updated_by: c.get("user")?.id || null,
        })
        .executeTakeFirst()

      return null
    }

    await c.var.trx
      .updateTable("ws_annual_need_min_max_status")
      .set({
        regency_activated_at: new Date(),
        province_activated_at: null,
        updated_at: new Date(),
        updated_by: c.get("user")?.id || null,
      })
      .where("id", "=", existing.id)
      .executeTakeFirst()
  }

  async activatedMinMaxRegency(
    c: Context,
    programPlanId: number,
    annualNeedIds: number[]
  ) {
    const userId = c.get("user")?.id ?? null
    const now = new Date()

    // 1. Fetch annual needs
    const annualNeeds = await c.var.trx
      .selectFrom("ws_annual_needs")
      .select(["id", "entity_id", "province_id"])
      .where("id", "in", annualNeedIds)
      .where("deleted_at", "is", null)
      .execute()

    if (annualNeeds.length === 0) {
      return { success: false, message: "No annual needs found." }
    }

    // Update min max for health centers under these annual needs

    const result = await this.activatedMinMaxHealthCenter(
      c,
      programPlanId,
      annualNeedIds
    )

    // 2. Fetch aggregated min values (grouped)
    const annualNeedResults = await c.var.trx
      .selectFrom("ws_annual_need_results")
      .select([
        "annual_need_id",
        "material_id",
        "activity_id",
        sql`SUM(min)`.as("total_min"),
      ])
      .where("annual_need_id", "in", annualNeedIds)
      .where("deleted_at", "is", null)
      .groupBy(["annual_need_id", "material_id", "activity_id"])
      .execute()

    // Build a quick lookup table:
    // Map: annual_need_id → [rows]
    const resultMap = new Map<number, typeof annualNeedResults>()

    for (const row of annualNeedResults) {
      if (!resultMap.has(row.annual_need_id)) {
        resultMap.set(row.annual_need_id, [])
      }
      resultMap.get(row.annual_need_id)!.push(row)
    }

    // 3. Build batch updates

    const updates: Promise<any[]>[] = []

    for (const need of annualNeeds) {
      const rows = resultMap.get(need.id) ?? []

      for (const r of rows) {
        const min = Number(r.total_min ?? 0)
        const max = min * 2

        updates.push(
          this.buildBaseUpdate(c, {
            entityId: need.entity_id,
            activityId: r.activity_id,
            min,
            max,
            updatedAt: new Date(),
            updatedBy: c.get("user")?.id || null,
          })
            .where("material_id", "=", r.material_id)
            .execute()
        )

        const substitutionIds = result?.substitutionMap.get(r.material_id) || []
        if (substitutionIds?.length) {
          updates.push(
            this.buildSubstitutionUpdate(c, {
              entityId: need.entity_id,
              activityId: r.activity_id,
              substitutionMaterialIds: substitutionIds,
              min,
              max,
              updatedAt: new Date(),
              updatedBy: c.get("user")?.id || null,
            })!.execute()
          )
        }
      }
    }

    await Promise.all(updates)

    // 4. Update annual need status in batch
    await c.var.trx
      .updateTable("ws_annual_needs")
      .set({
        min_max_status: 1,
        min_max_updated_at: now,
        updated_at: now,
        updated_by: userId,
      })
      .where("id", "in", annualNeedIds)
      .execute()

    // 5. Create or update annual_need_min_max_status records
    const provinceId = annualNeeds[0]?.province_id || 0
    await this.createOrUpdateAnnualNeedMinMaxStatus(
      c,
      programPlanId,
      provinceId
    )

    return {
      success: true,
      message: `Activated Min-Max for ${annualNeedIds.length} regencies.`,
    }
  }

  async actvitatedMinMaxProvince(
    c: Context,
    programPlanId: number,
    provinceId: number
  ) {
    const userId = c.get("user")?.id ?? null
    const now = new Date()

    // 1. Fetch annual needs
    const annualNeeds = await c.var.trx
      .selectFrom("ws_annual_needs")
      .select(["id", "entity_id"])
      .where("province_id", "=", provinceId)
      .where("program_plan_id", "=", programPlanId)
      .where("deleted_at", "is", null)
      .execute()

    if (annualNeeds.length === 0) {
      return { success: false, message: "No annual needs found." }
    }

    const annualMinMax = await c.var.trx
      .selectFrom("ws_annual_need_min_max_status")
      .select(["entity_id", "id"])
      .where("province_id", "=", provinceId)
      .where("program_plan_id", "=", programPlanId)
      .where("deleted_at", "is", null)
      .executeTakeFirst()

    const idMinMax = annualMinMax?.id ?? 0
    const entityId = annualMinMax?.entity_id ?? 0

    const annualNeedIds = annualNeeds.map((an) => an.id)

    // 2. Fetch aggregated min values (grouped)
    const annualNeedResults = await c.var.trx
      .selectFrom("ws_annual_need_results")
      .select(["material_id", "activity_id", sql`SUM(min)`.as("total_min")])
      .where("annual_need_id", "in", annualNeedIds)
      .where("deleted_at", "is", null)
      .groupBy(["material_id", "activity_id"])
      .execute()

    const substitutionMap = await this.buildSubstitutionMap(
      c,
      programPlanId,
      annualNeedResults.map((r) => r.material_id)
    )

    // 3. Build batch updates
    // Build UPSERT payload

    const updates: Promise<any[]>[] = []

    const queries = annualNeedResults.flatMap((r) => {
      const min = Number(r.total_min) || 0
      const max = min * 3
      updates.push(
        this.buildBaseUpdate(c, {
          entityId,
          activityId: r.activity_id,
          min,
          max,
          updatedAt: now,
          updatedBy: userId,
        })
          .where("material_id", "=", r.material_id)
          .execute()
      )

      const substitutionIds = substitutionMap.get(r.material_id) || []
      if (substitutionIds?.length) {
        updates.push(
          this.buildSubstitutionUpdate(c, {
            entityId,
            activityId: r.activity_id,
            substitutionMaterialIds: substitutionIds,
            min,
            max,
            updatedAt: now,
            updatedBy: userId,
          })!.execute()
        )
      }

      return updates
    })

    // 4. Perform bulk update (by UPSERT)
    await Promise.all(queries)

    // 5. Update province activated at in ws_annual_need_min_max_status
    await c.var.trx
      .updateTable("ws_annual_need_min_max_status")
      .set({
        province_activated_at: now,
        updated_at: now,
        updated_by: userId,
      })
      .where("id", "=", idMinMax)
      .execute()

    return {
      success: true,
      message: `Activated Min-Max for ${updates.length} material & activities.`,
    }
  }

  async runMinMaxCron(c: Context) {
    const now = new Date()

    // 1. Take all program plans for current year
    const programPlans = await c.var.db
      .selectFrom("ws_program_plans")
      .select(["id"])
      .where("deleted_at", "is", null)
      .where("year", "=", now.getFullYear())
      .execute()

    for (const plan of programPlans) {
      const programPlanId = plan.id

      // 2. Take all provinces that have annual needs in this program
      const provinces = await c.var.db
        .selectFrom("ws_annual_needs")
        .select((eb) => [
          "province_id",
          eb.fn.count("id").as("total"),
          eb.fn
            .sum(eb.case().when("status", "=", 1).then(1).else(0).end())
            .as("total_approved"),
        ])
        .where("program_plan_id", "=", programPlanId)
        .where("deleted_at", "is", null)
        .groupBy("province_id")
        .execute()

      for (const prov of provinces.filter(
        (v) => Number(v.total) === Number(v.total_approved)
      )) {
        const provinceId = prov.province_id

        // 3. Take all annual need ID (for regency)
        const annualNeeds = await c.var.db
          .selectFrom("ws_annual_needs")
          .select(["id"])
          .where("province_id", "=", provinceId)
          .where("program_plan_id", "=", programPlanId)
          .where("deleted_at", "is", null)
          .execute()

        const annualNeedIds = annualNeeds.map((v) => v.id)

        if (annualNeedIds.length === 0) continue

        await this.activatedMinMaxRegency(c, programPlanId, annualNeedIds)

        // 5. Run min–max for province (Provincial Health Office)
        await this.actvitatedMinMaxProvince(c, programPlanId, provinceId)
      }
    }

    console.log("Cron Min–Max has finished running:", now)
  }
}
