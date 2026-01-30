import { PaginatedResponse } from "@smile-health/lib/types/paginate.js"
import { Context } from "hono"
import { HTTPException } from "hono/http-exception"
import { AnnualNeedRepository } from "./annual-needs.repository.js"
import {
  AnnualNeedIpvRequest,
  AnnualPopulationRequest,
  CreateAnnualNeedsRequest,
  GetListAnnualNeedsQueries,
  GetNationalIpQueries,
  GetPopulationQueries,
  GetListAnnualNeedsByEntityQueries,
  UpdateAnnualNeedStatusRequest,
  GetAnnualNeedResultQueries,
  UpdatePopulationStatusRequest,
  GetAnnualNeedIpQueries,
  UpdateIpStatusRequest,
  UpdatePopulationRequest,
  UpdateIpRequest,
  CreateAnnualNeedResultRequest,
} from "./annual-needs.schema.js"

export class AnnualNeedModule {
  constructor(private readonly repo: AnnualNeedRepository) {}

  async getById(c: Context, id: number) {
    const data = await this.repo.getById(c, id)

    if (!data) {
      return null
    }

    return {
      id: data.id,
      province: {
        id: data.province_id,
        name: data.province_name,
      },
      regency: data.regency_id
        ? {
            id: data.regency_id,
            name: data.regency_name,
          }
        : null,
      program_plan: {
        id: data.program_plan_id,
        year: data.year,
      },
      status: data.status ?? null,
    }
  }

  async submit(c: Context, body: CreateAnnualNeedsRequest) {
    const payload = {
      province_id: body.province_id,
      regency_id: body.regency_id,
      entity_id: body.entity_id,
      program_plan_id: body.program_plan_id,
    }

    const result = await this.repo.create(c, payload)

    return {
      message: "Success",
      data: { insertId: Number(result?.insertId || 0) },
    }
  }

  async updateStatus(
    c: Context,
    annualNeedId: number,
    body: UpdateAnnualNeedStatusRequest
  ) {
    if (!body.status) {
      throw new Error("Invalid status value")
    }

    const result = await this.repo.updateStatus(c, annualNeedId, body.status)

    return {
      message: "Success",
      data: result,
    }
  }

  async listNeedsByEntity(
    c: Context,
    entityId: number,
    params: GetListAnnualNeedsByEntityQueries
  ) {
    const data = await this.repo.getListNeedsByEntity(c, entityId, params)

    const list = data.list.map((item) => {
      return {
        id: item.id,
        program_plan: {
          id: item.program_plan_id,
          year: item.year,
        },
        status: item.status,
      }
    })

    const response = new PaginatedResponse(params, list, data.total)
    return response
  }

  async listNeedsProvince(c: Context, params: GetListAnnualNeedsQueries) {
    const data = await this.repo.getListNeedsProvince(c, params)

    const canActivatedRegency =
      data.list.filter((it) => it.status === 1).length === data.list.length

    const canActivatedProvince =
      data.list.filter((it) => it.min_max_status === 1).length ===
      data.list.length

    const list = {
      province_entity: {
        id: data.entityProvince?.id,
        name: data.entityProvince?.name,
        province_id: params.province_id,
        min_max_status_province:
          data.min_max_status?.province_activated_at && canActivatedProvince
            ? "active"
            : "inactive",
        min_max_status_regency:
          data.min_max_status?.regency_activated_at && canActivatedRegency
            ? "active"
            : "inactive",
        can_activated_province: canActivatedProvince,
        can_activated_regency: canActivatedRegency,
        activated_province_date: canActivatedProvince
          ? data.min_max_status?.province_activated_at
          : null,
        activated_regency_date: canActivatedRegency
          ? data.min_max_status?.regency_activated_at
          : null,
      },
      annual_needs: data.list.map((item) => {
        return {
          id: item.id,
          entity: {
            id: item.entity_id,
            name: item.entity_name,
          },
          program_plan: {
            id: item.program_plan_id,
            year: item.year,
          },
          status: item.status,
          min_max_status: item.min_max_status,
          min_max_updated_at: item.min_max_updated_at,
        }
      }),
    }

    let response = new PaginatedResponse(params, [], data.total)
    return {
      ...response,
      data: list,
    }
  }

  async submitAnnualNeedPopulation(c: Context, body: AnnualPopulationRequest) {
    const result = await this.repo.submitAnnualNeedPopulation(c, body)

    return {
      message: "Success",
      data: result,
    }
  }

  async submitAnnualNeedIpv(c: Context, body: AnnualNeedIpvRequest) {
    const result = await this.repo.submitAnnualNeedIpv(c, body)

    return {
      message: "Success",
      data: result,
    }
  }

  async getNationalIp(
    c: Context,
    programPlanId: number,
    params: GetNationalIpQueries
  ) {
    const data = await this.repo.getNationalIp(c, programPlanId, params)

    const list = data.list.map((item) => {
      const userName =
        [item.updated_by_firstname, item.updated_by_lastname]
          .filter(Boolean)
          .join(" ") || null

      return {
        id: item.id,
        material: {
          id: item.material_id,
          name: item.material_name,
        },
        activity: {
          id: item.activity_id,
          name: item.activity_name,
        },
        sku: item.sku,
        ip: item.national_ip,
        user_updated_by: item.updated_by
          ? {
              id: item.updated_by,
              name: userName,
            }
          : null,
        updated_at: item.updated_at,
      }
    })

    const response = new PaginatedResponse(params, list, data.total)
    return response
  }

  async getMonthlyDistributionDetail(
    c: Context,
    annualNeedId: number,
    entityId: number,
    materialId: number,
    activityId: number
  ) {
    const data = await this.repo.getMonthlyDistributionDetail(
      c,
      annualNeedId,
      entityId,
      materialId,
      activityId
    )

    if (!data) {
      return {
        message: "Data not found",
        data: null,
      }
    }

    return {
      message: "Success",
      data: {
        entity: {
          id: data.entity_id,
          name: data.entity_name,
        },
        material: {
          id: data.material_id,
          name: data.material_name,
        },
        activity: {
          id: data.activity_id,
          name: data.activity_name,
        },
        monthly_distributions: data.month_distribution,
      },
    }
  }

  async getPopulation(
    c: Context,
    programPlanId: number,
    params: GetPopulationQueries
  ) {
    const data = await this.repo.getPopulation(c, programPlanId, params)

    if (!data) {
      return null
    }

    return {
      year_plan: data.year_plan,
      approach: data.approach,
      province: data.province
        ? {
            id: data.province.id,
            name: data.province.name,
          }
        : null,
      entity: data.entity
        ? {
            id: data.entity.id,
            name: data.entity.name,
          }
        : null,
      population_data: data.populations.map((pop) => ({
        id: pop.id,
        name: pop.name,
        population_number: Number(pop.population_number),
      })),
    }
  }

  async getAnnualNeedResultList(
    c: Context,
    annualNeedId: number,
    params: GetAnnualNeedResultQueries
  ) {
    const { data, total } = await this.repo.getAnnualNeedResultList(
      c,
      annualNeedId,
      params
    )

    if (data.length === 0) {
      return new PaginatedResponse(params)
    }

    const list = data.map((item) => {
      const userName =
        [item.updated_by_firstname, item.updated_by_lastname]
          .filter(Boolean)
          .join(" ") || null

      return {
        entity: {
          id: Number(item.entity_id),
          name: item.entity_name || "",
        },
        regency: {
          id: item.regency_id ? Number(item.regency_id) : null,
          name: item.regency_name || "",
        },
        sub_district: {
          id: item.sub_district_id ? Number(item.sub_district_id) : null,
          name: item.sub_district_name || "",
        },
        ip: item.ip,
        material: {
          id: Number(item.material_id),
          name: item.material_name || "",
        },
        activity: {
          id: Number(item.activity_id),
          name: item.activity_name || "",
        },
        yearly_need: {
          vial: Number(item.yearly_need_vial),
          dosis: Number(item.yearly_need),
        },
        monthly_need: {
          vial: Number(item.monthly_need_vial),
          dosis: Number(item.monthly_need),
        },
        weekly_need: {
          vial: Number(item.weekly_need_vial),
          dosis: Number(item.weekly_need),
        },
        min: Number(item.min),
        max: Number(item.max),
        user_updated_by: {
          id: item.updated_by ? Number(item.updated_by) : null,
          name: userName,
        },
        updated_at: item.updated_at
          ? new Date(item.updated_at)
              .toISOString()
              .replace("T", " ")
              .slice(0, 19)
          : "",
      }
    })

    return new PaginatedResponse(params, list, total)
  }

  private initEntityGroup(row: any) {
    return {
      entity: {
        id: Number(row.entity_id),
        name: row.entity_name ?? "",
      },
      sub_district: row.sub_district_id
        ? {
            id: row.sub_district_id,
            name: row.sub_district_name ?? "",
          }
        : null,
      annual_need_populations: [],
      user_updated_by: null as { id: number; name: string } | null,
      updated_at: null as Date | null,
    }
  }

  private mapPopulation(row: any) {
    return {
      id: Number(row.population_id ?? 0),
      target_group_id: Number(row.target_group_id ?? 0),
      target_group_name: row.target_group_name ?? "",
      percentage: Number(row.percentage ?? 0),
      population: Number(row.population ?? 0),
      population_correction: Number(row.population_correction ?? 0),
      status: row.status ?? null,
    }
  }

  private applyLatestUpdate(group: any, row: any) {
    if (!row.updated_at) return

    const current = new Date(row.updated_at)
    const existing = group.updated_at ? new Date(group.updated_at) : null

    if (!existing || current > existing) {
      group.updated_at = row.updated_at
      group.user_updated_by = row.updated_by
        ? { id: row.updated_by, name: row.updated_by_name ?? "" }
        : null
    }
  }

  async getPopulationByAnnualNeedId(c: Context, annualNeedId: number) {
    const populationData = await this.repo.getPopulationByAnnualNeedId(
      c,
      annualNeedId
    )

    if (!populationData?.length) {
      return { data: [] }
    }

    const groupedByEntity: Record<number, any> = {}

    for (const row of populationData) {
      const entityId = Number(row.entity_id)

      const group =
        groupedByEntity[entityId] ??
        (groupedByEntity[entityId] = this.initEntityGroup(row))

      group.annual_need_populations.push(this.mapPopulation(row))
      this.applyLatestUpdate(group, row)
    }

    return { data: Object.values(groupedByEntity) }
  }

  async updatePopulationStatus(
    c: Context,
    annualNeedId: number,
    body: UpdatePopulationStatusRequest
  ) {
    const result = await this.repo.updatePopulationStatus(c, annualNeedId, body)

    return {
      message: "Success",
      data: result,
    }
  }

  async updateIpStatus(
    c: Context,
    annualNeedId: number,
    body: UpdateIpStatusRequest
  ) {
    const result = await this.repo.updateIpStatus(c, annualNeedId, body)

    return {
      message: "Success",
      data: result,
    }
  }

  async updatePopulation(
    c: Context,
    annualNeedId: number,
    body: UpdatePopulationRequest
  ) {
    const result = await this.repo.updatePopulation(c, annualNeedId, body)

    return {
      message: "Success",
      data: result,
    }
  }

  async updateIp(c: Context, annualNeedId: number, body: UpdateIpRequest) {
    const result = await this.repo.updateIp(c, annualNeedId, body)

    return {
      message: "Success",
      data: result,
    }
  }

  async getMasterNationIp(c: Context, annualNeedId: number) {
    const annualNeed = await this.repo.getById(c, annualNeedId)

    if (!annualNeed) return null
  }

  async getAnnualNeedIp(
    c: Context,
    annualNeedId: number,
    params: GetAnnualNeedIpQueries
  ) {
    const result = await this.repo.getAnnualNeedIp(c, annualNeedId, params)

    if (!result) {
      return null
    }

    let { annualNeed, data, total, page, paginate } = result

    if (data.length === 0) {
      const nationalIps = (await this.repo.getMasterNationalIp(
        c,
        annualNeedId,
        params
      )) as any
      data = nationalIps.data
      total = nationalIps.total
    }

    const formattedData = data.map((item) => ({
      id: item.id,
      material: {
        id: item.material_id,
        name: item.material_name,
      },
      activity: {
        id: item.activity_id,
        name: item.activity_name,
      },
      target_group: {
        id: item.target_group_id,
        name: item.target_group_name,
      },
      sku: item.sku,
      national_ip: item.national_ip,
      regency_ip: item.regency_ip,
      status: item?.status,
      user_updated_by: item.updated_by
        ? {
            id: item.updated_by,
            name: item.user_name?.trim() || "",
          }
        : null,
      updated_at: item.updated_at,
    }))

    return {
      province: {
        id: annualNeed.province_id,
        name: annualNeed.province_name,
      },
      regency: annualNeed.regency_id
        ? {
            id: annualNeed.regency_id,
            name: annualNeed.regency_name,
          }
        : null,
      program_plan: {
        id: annualNeed.program_plan_id,
        year: annualNeed.year,
      },
      data: formattedData,
      meta: {
        page,
        paginate,
        total,
        total_pages: Math.ceil(total / paginate),
      },
    }
  }

  async createAnnualNeedResult(
    c: Context,
    data: CreateAnnualNeedResultRequest
  ) {
    const annualNeed = await this.repo.getById(c, data.annual_need_id)

    if (!annualNeed) {
      throw new HTTPException(404, {
        message: "Annual need not found",
      })
    }

    const result = await this.repo.createAnnualNeedResults(
      c,
      data.annual_need_id
    )
    return result
  }

  async activatedMinMaxRegency(
    c: Context,
    programPlanId: number,
    annualNeedIds: number[]
  ) {
    const result = await this.repo.activatedMinMaxRegency(
      c,
      programPlanId,
      annualNeedIds
    )
    return result
  }

  async activatedMinMaxProvince(
    c: Context,
    programPlanId: number,
    provinceId: number
  ) {
    const result = await this.repo.actvitatedMinMaxProvince(
      c,
      programPlanId,
      provinceId
    )
    return result
  }
}
