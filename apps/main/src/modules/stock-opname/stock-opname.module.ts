import { TOPIC } from "@smile/lib/rabbitmq/topic.js"
import { PaginatedResponse } from "@smile/lib/types/paginate.js"
import {
  associate,
  collect,
  formatPeriodName,
  getUniqueIdsFromFields,
  pick,
} from "@smile/lib/utils.js"
import { type Context } from "hono"
import { type z } from "zod"
import { ActivityRepository } from "../activity/activity.repository.js"
import { BaseModule } from "../base.module.js"
import { EntityRepository } from "../entity/entity.repository.js"
import ExportHistoryRepository from "../export-history/export-history.repository.js"
import { MaterialRepository } from "../material/material.repository.js"
import StockOpnamePeriodRepository from "../stock-opname-period/stock-opname-period.repository.js"
import { UserRepository } from "../user/user.repository.js"
import StockOpnameRepository from "./stock-opname.repository.js"
import {
  CreateStockOpnameRequest,
  GetStockOpnamesQueries,
} from "./stock-opname.schema.js"
import { Publisher } from "@smile/lib/rabbitmq/publisher.js"

type StockOpnamesQueries = z.infer<typeof GetStockOpnamesQueries>

export class StockOpnameModule extends BaseModule {
  constructor(
    protected readonly repo: StockOpnameRepository,
    protected readonly entityRepo: EntityRepository,
    protected readonly userRepo: UserRepository,
    protected readonly activityRepo: ActivityRepository,
    protected readonly materialRepo: MaterialRepository,
    protected readonly periodRepo: StockOpnamePeriodRepository,
    protected readonly exportHistoryRepo: ExportHistoryRepository,
    protected readonly publisher: Publisher
  ) {
    super(exportHistoryRepo, publisher)
  }

  async getAll(c: Context, params: StockOpnamesQueries) {
    const { data, total } = await this.repo.findAll(c, params)
    if (data.length === 0) {
      return new PaginatedResponse(params)
    }

    // Get related data
    const entityIds = collect(data, "entity_id")
    const activityIds = collect(data, "activity_id")
    const materialIds = getUniqueIdsFromFields(
      data,
      "material_id",
      "parent_material_id"
    )

    const userIds = getUniqueIdsFromFields(data, "created_by", "updated_by")
    const [entities, activities, materials, periods, users] = await Promise.all(
      [
        this.entityRepo.getBasicDetailMapped(c, entityIds),
        this.activityRepo.find(c, { id: activityIds }),
        this.materialRepo.find(c, { id: materialIds }),
        this.periodRepo.find(c, { id: collect(data, "period_id") }),
        this.userRepo.getBasicDetailMapped(c, userIds),
      ]
    )

    const mapActivities = associate(
      activities.map((m) => ({ id: m.id, name: m.name })),
      "id"
    )
    const mapMaterials = associate(
      materials.map((m) => ({ id: m.id, name: m.name })),
      "id"
    )
    const mapPeriods = associate(
      periods.map((m) => ({
        id: m.id,
        name: formatPeriodName(
          m.month_period,
          m.year_period,
          c.var.language || "en"
        ),
      })),
      "id"
    )

    const list = data.map((item) => ({
      ...pick(item, [
        "id",
        "recorded_qty",
        "actual_qty",
        "in_transit_qty",
        "created_at",
        "updated_at",
        "is_within_period",
      ]),
      entity: entities[item.entity_id],
      activity: mapActivities[item.activity_id ?? 0] ?? null,
      material: mapMaterials[item.material_id ?? 0] ?? null,
      parent_material: mapMaterials[item.parent_material_id ?? 0] ?? null,
      batch: {
        code: item.batch_code,
        expired_date: item.expired_date,
      },
      period: mapPeriods[item.period_id ?? 0] ?? null,
      user_created_by: users[item.created_by ?? 0] ?? null,
      user_updated_by: users[item.updated_by ?? 0] ?? null,
    }))

    return new PaginatedResponse(params, list, total)
  }

  async create(c: Context, data: z.infer<typeof CreateStockOpnameRequest>) {
    const materialMap = await this.materialRepo.getMaterialMapped(c, [
      ...new Set(data.items.map((item) => item.material_id)),
    ])

    const records = data.items.flatMap((item) =>
      item.stocks.map((stock) => {
        const material = materialMap[item.material_id ?? 0]
        if (!stock.expired_date) {
          stock.expired_date = null
        }

        return {
          period_id: data.period_id,
          entity_id: data.entity_id,
          is_within_period: data.is_within_period,
          material_id: item.material_id,
          parent_material_id: material?.parent_id ?? null,
          ...stock,
          stock_id: stock.stock_id ?? 0,
          batch_code: stock.batch_code ?? "",
          created_by: c.var.userId,
          updated_by: c.var.userId,
        }
      })
    )
    return await this.repo.createMany(c, records)
  }

  async export(c: Context, params: StockOpnamesQueries) {
    return await this.handleAsyncExport(c, TOPIC.STOCK_OPNAME_EXPORTED, {
      filename: "StockOpname",
      params,
    })
  }
}
