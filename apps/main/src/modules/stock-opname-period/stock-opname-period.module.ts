import { NotFoundError } from "@smile-health/lib/error.js"
import { PaginatedResponse } from "@smile-health/lib/types/paginate.js"
import {
  formatDateWithTimezone,
  formatPeriodName,
  getUniqueIdsFromFields,
} from "@smile-health/lib/utils.js"
import { type Context } from "hono"
import moment from "moment"
import { type z } from "zod"
import { UserRepository } from "../user/user.repository.js"
import { StockOpnamePeriodTemplate } from "./stock-opname-period.excel.js"
import StockOpnamePeriodRepository from "./stock-opname-period.repository.js"
import {
  CreateStockOpnamePeriodRequest,
  GetStockOpnamePeriodsQueries,
  UpdateStockOpnamePeriodRequest,
} from "./stock-opname-period.schema.js"

type StockOpnamePeriodsQueries = z.infer<typeof GetStockOpnamePeriodsQueries>

export class StockOpnamePeriodModule {
  constructor(
    protected readonly repo: StockOpnamePeriodRepository,
    protected readonly userRepo: UserRepository
  ) {}

  readonly #setStartEndDate = (data) => {
    const start_date = moment
      .tz(data.start_date, "YYYY-MM-DD", "Asia/Jakarta")
      .startOf("day")
      .utc()
      .format("YYYY-MM-DD HH:mm:ss")
    return {
      ...data,
      start_date,
      end_date: `${data.end_date} 16:59:59`,
    }
  }

  async getAll(c: Context, params: StockOpnamePeriodsQueries) {
    const { data, total } = await this.repo.findAll(c, params)
    const language = c.var.language || "en"

    const userIds = getUniqueIdsFromFields(data, "created_by", "updated_by")
    const usersMap = await this.userRepo.getBasicDetailMapped(c, userIds)

    const parsedData = data.map((p) => ({
      ...p,
      name: formatPeriodName(p.month_period, p.year_period, language),
      user_created_by: usersMap[p.created_by ?? 0] ?? null,
      user_updated_by: usersMap[p.updated_by ?? 0] ?? null,
    }))

    return new PaginatedResponse(
      { ...params, paginate: params.paginate ?? total },
      parsedData,
      total
    )
  }

  async create(
    c: Context,
    data: z.infer<typeof CreateStockOpnamePeriodRequest>
  ) {
    const dataCreate = this.#setStartEndDate(data)
    // only 1 period can activa at a time, so update all other status to 0
    if (dataCreate.status === 1) {
      await this.repo.update(c, { status: 0 }, { status: 1 })
    }

    const res = await this.repo.create(c, dataCreate)
    return this.getById(c, Number(res.insertId))
  }

  async update(
    c: Context,
    id: number,
    data: z.infer<typeof UpdateStockOpnamePeriodRequest>
  ) {
    const dataUpdate = this.#setStartEndDate(data)
    // only 1 period can active at a time, so update all other status to 0
    if (dataUpdate.status === 1) {
      await this.repo.update(c, { status: 0 }, { status: 1 })
    }
    await this.repo.update(c, dataUpdate, { id })
    return this.getById(c, id)
  }

  async updateStatus(c: Context, id: number, status: number) {
    // only 1 period can activa at a time, so update all other status to 0
    if (status === 1) {
      await this.repo.update(c, { status: 0 }, { status: 1 })
    }
    await this.repo.update(c, { status }, { id })
    return this.getById(c, id)
  }

  async getById(c: Context, id: number) {
    const res = await this.repo.findById(c, id)
    if (!res) {
      throw new NotFoundError("Stock Opname Period not found")
    }

    return {
      ...res,
      name: formatPeriodName(res.month_period, res.year_period, c.var.language),
    }
  }

  async exportExcel(c: Context, params: StockOpnamePeriodsQueries) {
    const stream = await this.repo.getListOpnamePeriodStream(c, params)
    const rows: (string | number | Date | null)[][] = []
    const timezone = c.req.header("Timezone")

    for await (const item of stream) {
      const row = [
        formatPeriodName(item.month_period, item.year_period, c.var.language),
        item.start_date ? moment(item.start_date).format("DD/MM/YYYY") : "",
        item.end_date ? moment(item.end_date).format("DD/MM/YYYY") : "",
        item.status === 1
          ? c.var.t("stock_opname.label.active")
          : c.var.t("stock_opname.label.inactive"),
        formatDateWithTimezone(item.created_at, timezone),
        formatDateWithTimezone(item.updated_at, timezone),
        item.full_name_created,
        item.full_name_updated,
      ]

      rows.push(row)
    }

    const columns = [
      {
        key: "period",
        header: c.var.t("stock_opname_period.label.period"),
        width: 20,
      },
      {
        key: "start_date",
        header: c.var.t("stock_opname_period.label.start_date"),
        width: 20,
      },
      {
        key: "end_date",
        header: c.var.t("stock_opname_period.label.end_date"),
        width: 20,
      },
      {
        key: "status",
        header: c.var.t("stock_opname_period.label.status"),

        width: 20,
      },
      {
        key: "created_at",
        header: c.var.t("stock_opname_period.label.created_at"),
        width: 20,
      },
      {
        key: "updated_at",
        header: c.var.t("stock_opname_period.label.updated_at"),
        width: 20,
      },
      {
        key: "created_by",
        header: c.var.t("stock_opname_period.label.created_by"),
        width: 20,
      },
      {
        key: "updated_by",
        header: c.var.t("stock_opname_period.label.updated_by"),
        width: 20,
      },
    ]

    const title = c.var.t("stock_opname_period.export.title")
    const excelTemplate = new StockOpnamePeriodTemplate()
    await excelTemplate.initSheet(title)
    excelTemplate.setTitle(title)
    excelTemplate.setTimezone(timezone)
    excelTemplate.setColumns(columns)
    await excelTemplate.setRows(title, rows)

    return excelTemplate.generate()
  }
}
