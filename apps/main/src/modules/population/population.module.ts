import { UserRepository } from "@/modules/user/user.repository.js"
import { Context } from "hono"
import { PopulationRepository } from "./population.repository.js"
import {
  GetPopulationByProgramPlanParams,
  GetPopulationByProgramPlanQueries,
} from "./population.schema.js"

export class PopulationModule {
  constructor(
    private readonly repo: PopulationRepository,
    private readonly userRepo: UserRepository
  ) {}

  async getPopulationByProgramPlan(
    c: Context,
    params: GetPopulationByProgramPlanParams,
    query: GetPopulationByProgramPlanQueries
  ) {
    const programPlanId = Number(params.id)
    const { province_id } = query

    const { year, approach, aggregate, rows, provinceName } =
      await this.repo.getPopulationDetailByProgramPlan(
        c,
        programPlanId,
        province_id
      )

    if (aggregate.length === 0 && rows.length === 0) {
      return {
        year_plan: String(year),
        approach,
        data: [],
      }
    }

    const targetGroupNameOrder = aggregate.map((a) => a.name)

    const groups = new Map<
      number,
      {
        entity_id: number
        entity_name: string
        province_name: string | null
        regency_name: string | null
        populations: Array<{
          id: number
          name: string
          population_number: number
        }>
        latest_updated_at: Date | null
        latest_updated_by: number | null
      }
    >()

    for (const r of rows) {
      const g = groups.get(r.entity_id) ?? {
        entity_id: r.entity_id,
        entity_name: r.entity_name,
        province_name: r.province_name ?? null,
        regency_name: r.regency_name ?? null,
        populations: [],
        latest_updated_at: null,
        latest_updated_by: null,
      }
      g.populations.push({
        id: r.target_group_id,
        name: r.target_group_title,
        population_number: Number(r.population_number),
      })
      if (
        !g.latest_updated_at ||
        (r.updated_at && r.updated_at > g.latest_updated_at)
      ) {
        g.latest_updated_at = r.updated_at ?? null
        g.latest_updated_by = r.updated_by ?? null
      }
      groups.set(r.entity_id, g)
    }

    const userIds = Array.from(
      new Set(
        Array.from(groups.values())
          .map((g) => g.latest_updated_by)
          .filter((v): v is number => v !== null)
      )
    )

    const mapUsers = await this.userRepo.getBasicDetailMapped(c, userIds)

    type PopulationItem = {
      id: number
      name: string
      population_number: number
    }

    type DataItem = {
      entity: {
        province?: string | null
        id?: number
        name?: string
        regency?: string | null
      }
      population: PopulationItem[]
      user_updated_at?: Date | null
      user_updated_by?: {
        id: number
        username: string | null
        firstname?: string | null
        lastname?: string | null
        fullname: string
      }
    }

    const data: DataItem[] = []

    data.push({
      entity: { province: provinceName ?? null },
      population: aggregate.map((a) => ({
        id: a.id,
        name: a.name,
        population_number: Number(a.population_number),
      })),
    })

    for (const g of groups.values()) {
      g.populations.sort(
        (a, b) =>
          targetGroupNameOrder.indexOf(a.name) -
          targetGroupNameOrder.indexOf(b.name)
      )
      data.push({
        entity: {
          id: g.entity_id,
          name: g.entity_name,
          province: g.province_name ?? null,
          regency: g.regency_name ?? null,
        },
        population: g.populations,
        user_updated_at: g.latest_updated_at ?? null,
        user_updated_by: g.latest_updated_by
          ? (mapUsers[g.latest_updated_by] as {
              id: number
              username: string | null
              firstname: string | null
              lastname: string | null
              fullname: string
            })
          : undefined,
      })
    }

    return {
      year_plan: String(year),
      approach,
      data,
    }
  }
}
