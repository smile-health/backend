import { Context } from "hono"
import { StockBookQueryParams } from "./stock-book.schema.js"
import { StockBookRepository } from "./stock-book.repository.js"
import { buildStockBookExportOption } from "./stock-book.utils.js"
import moment from "moment"
import WarehouseTemplate from "@smile/lib/excel/warehouse-template.js"
import { BaseModule } from "../base.module.js"
import ExportHistoryRepository from "../export-history/export-history.repository.js"
import { Publisher } from "@smile/lib/rabbitmq/publisher.js"
import { EntityRepository } from "../entity/entity.repository.js"
import { TOPIC } from "@smile/lib/rabbitmq/topic.js"
import { NotFoundError } from "@smile/lib/error.js"

export class StockBookModule extends BaseModule {
  constructor(
    private readonly stockBookRepository: StockBookRepository,
    private readonly entityRepository: EntityRepository,
    protected readonly exportHistoryRepo: ExportHistoryRepository,
    protected readonly publisher: Publisher
  ) {
    super(exportHistoryRepo, publisher)
  }

  async exportStockBookExcel(c: Context, queryParams: StockBookQueryParams) {
    const entityResult = await this.entityRepository.fetchEntities(c, queryParams)
    const entitties = entityResult.records

    if (!entitties || (Array.isArray(entitties) && entitties.length === 0)) {
      throw new NotFoundError(
        c.var.t("validator.not_found", { field: c.var.t("common.entity") })
      )
    }

    queryParams.entity_id = entitties[0]!.id

    const { month, year } = queryParams

    const [stockBookTransactions, entityMaterialActivities] = await Promise.all(
      [
        await this.stockBookRepository.fetchStockBook(c, queryParams),
        await this.stockBookRepository.fetchEntityMaterialActivity(
          c,
          queryParams
        ),
      ]
    )

    const options = buildStockBookExportOption(
      c,
      stockBookTransactions,
      entityMaterialActivities,
      month,
      year
    )

    const template = new WarehouseTemplate()
    await template.initWorkbook()

    for (const option of options) {
      template.initSheet(option.sheetName)
      template.setTitleBar(option.sheetName, option.columns, option.titleBar)
      template.setFilters(option.sheetName, option.filters)
      template.setColumns(option.columns, undefined, option.sheetName)
      template.addRows(option.sheetName, option.data)
    }

    const entityName = entitties[0]!.name
    const monthName = moment(`${year}-${month}`, "YYYY-M").format("MMMM")

    const fileName = `${c.var.t("stock_book.label.title")} ${entityName} ${monthName} ${year} - ${moment().format("YYYY MM DD HH:mm:ss")}`
    template.setTitle(fileName)

    return await template.generate()
  }

  async exportAllStockkBookExcel(
    c: Context,
    queryParams: StockBookQueryParams
  ) {
    queryParams.program_id = c.var.programId

    return await this.handleAsyncExport(c, TOPIC.STOCK_BOOK_ALL_EXPORTED, {
      filename: c.var.t("stock_book.label.title"),
      params: queryParams,
    })
  }
}
