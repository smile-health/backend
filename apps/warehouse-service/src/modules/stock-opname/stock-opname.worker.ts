import { Consumer } from "@smile-health/lib/rabbitmq/consumer.js"
import { TOPIC } from "@smile-health/lib/rabbitmq/topic.js"
import { BaseWorker } from "../base.worker.js"
import ExportHistoryRepository from "../export-history/export-history.repository.js"
import { DB } from "@/common/infrastructure/database/types/db.js"
import { MultiSheetZipExporter } from "@smile-health/lib/excel/multi-sheet-zip.js"
import env from "../../config/env.js"
import { StockOpnameModule } from "./stock-opname.module.js"
import {
  buildSoComplianceExportOptions,
  buildSoMaterialExportOptions,
  buildSoResultExportOptions,
} from "./stock-opname.utils.js"
import { getExportLocationFileName } from "@/common/utils/export.js"
import { StockBookQueryParams } from "../stock-book/stock-book.schema.js"
import moment from "moment"
import { CustomContext } from "@smile-health/lib/types/context.js"

export class StockOpnameWorker extends BaseWorker {
  constructor(
    private readonly stockOpnameModule: StockOpnameModule,
    protected readonly exportHistoryRepo: ExportHistoryRepository
  ) {
    super(exportHistoryRepo)
  }

  private parseMessage(msg: string | null) {
    const parseMsg = JSON.parse(msg ?? "{}")
    return parseMsg.payload
  }

  public registerWorkers(consumer: Consumer<DB>) {
    consumer.route(
      TOPIC.DASHBOARD_STOCK_OPNAME_MATERIAL_EXPORTED,
      async (c, msg) => {
        const { params, options, language, timezone } = this.parseMessage(msg)
        await this.processAsyncExport(c, options, async () => {
          return await this.prepareMaterialExporter(
            c,
            language,
            timezone,
            params
          )
        })
      }
    )

    consumer.route(
      TOPIC.DASHBOARD_STOCK_OPNAME_COMPLIANCE_EXPORTED,
      async (c, msg) => {
        const { params, options, language, timezone } = this.parseMessage(msg)
        await this.processAsyncExport(c, options, async () => {
          return await this.prepareComplianceExporter(
            c,
            language,
            timezone,
            params
          )
        })
      }
    )

    consumer.route(
      TOPIC.DASHBOARD_STOCK_OPNAME_RESULT_EXPORTED,
      async (c, msg) => {
        const { params, options, language, timezone } = this.parseMessage(msg)
        await this.processAsyncExport(c, options, async () => {
          return await this.prepareResultExporter(c, language, timezone, params)
        })
      }
    )
  }

  private async prepareMaterialExporter(
    c: CustomContext<DB>,
    language: string,
    timezone: string,
    queryParams: StockBookQueryParams
  ) {
    const batchSize = 1000
    const paginate = {
      page: 1,
      paginate: batchSize,
      offset: 0,
    }

    const template = new MultiSheetZipExporter({
      language,
      timezone,
      batchSize: env.EXPORT_EXCEL_BATCH_SIZE,
      bucketName: env.EXPORT_EXCEL_BUCKET_NAME,
    })

    c.var.programId = queryParams.program_id

    // --- page pertama (biar dapat total_page dan filters)
    const [stockOpnameMaterial, filters] = await Promise.all([
      this.stockOpnameModule.stockOpnameMaterial(c, {
        ...queryParams,
        ...paginate,
      }),
      this.stockOpnameModule.generateFilters(c, {
        ...queryParams,
        ...paginate,
      }),
    ])

    const options = buildSoMaterialExportOptions(
      c,
      filters,
      stockOpnameMaterial
    )

    const regionLabel = getExportLocationFileName(c, queryParams, filters)
    const groupId = c.var.t("stock_opname.sheet.title.material")
    const fileName = `${groupId} ${regionLabel} ${moment().format("YYYY MM DD HH:mm:ss")}`

    // --- init file & sheets
    await template.initFileGroupWarehouse(groupId, fileName)
    for (const option of options) {
      await template.initSheet(groupId, option.sheetName)
      await template.setTitleBar(
        groupId,
        option.sheetName,
        option.columns,
        option.titleBar
      )
      await template.setFilters(groupId, option.sheetName, option.filters)
      await template.setColumns(groupId, option.sheetName, option.columns)
    }

    // --- loop per halaman, streaming tulis ke file
    const counters: Record<string, number> = {}
    for (let page = 1; page <= stockOpnameMaterial.total_page; page++) {
      const resp =
        page === 1
          ? stockOpnameMaterial
          : await this.stockOpnameModule.stockOpnameMaterial(c, {
              ...queryParams,
              paginate: batchSize,
              page,
              offset: (page - 1) * batchSize,
            })

      if (resp.data.length > 0) {
        const optionParPages = buildSoMaterialExportOptions(c, filters, resp)
        await this.addRowsData(groupId, template, optionParPages, counters)
      }
    }

    return template
  }

  private async prepareComplianceExporter(
    c: CustomContext<DB>,
    language: string,
    timezone: string,
    queryParams: StockBookQueryParams
  ) {
    const batchSize = 1000
    const paginate = {
      page: 1,
      paginate: batchSize,
      offset: 0,
    }

    const template = new MultiSheetZipExporter({
      language,
      timezone,
      batchSize: env.EXPORT_EXCEL_BATCH_SIZE,
      bucketName: env.EXPORT_EXCEL_BUCKET_NAME,
    })

    c.var.programId = queryParams.program_id

    // --- page pertama (biar dapat total_page dan filters)
    const [stockOpnameComplianceSummary, stockOpnameCompliance, filters] =
      await Promise.all([
        this.stockOpnameModule.stockOpnameComplianceSummary(c, {
          ...queryParams,
          ...paginate,
        }),
        this.stockOpnameModule.stockOpnameCompliance(c, {
          ...queryParams,
          ...paginate,
        }),
        this.stockOpnameModule.generateFilters(c, queryParams),
      ])

    const options = buildSoComplianceExportOptions(
      c,
      filters,
      stockOpnameComplianceSummary,
      stockOpnameCompliance
    )

    const regionLabel = getExportLocationFileName(c, queryParams, filters)
    const groupId = c.var.t("stock_opname.sheet.title.compliance")
    const fileName = `${groupId} ${regionLabel} ${moment().format("YYYY MM DD HH:mm:ss")}`

    // --- init file & sheets
    await template.initFileGroupWarehouse(groupId, fileName)
    for (const option of options) {
      await template.initSheet(groupId, option.sheetName)
      await template.setTitleBar(
        groupId,
        option.sheetName,
        option.columns,
        option.titleBar
      )
      await template.setFilters(groupId, option.sheetName, option.filters)
      await template.setColumns(groupId, option.sheetName, option.columns)
    }

    // --- loop per halaman, streaming tulis ke file
    const counters: Record<string, number> = {}
    for (let page = 1; page <= stockOpnameCompliance.total_page; page++) {
      const resp =
        page === 1
          ? stockOpnameCompliance
          : await this.stockOpnameModule.stockOpnameCompliance(c, {
              ...queryParams,
              paginate: batchSize,
              page,
              offset: (page - 1) * batchSize,
            })

      if (resp.data.length > 0) {
        const optionParPages = buildSoComplianceExportOptions(
          c,
          filters,
          page === 1 ? stockOpnameComplianceSummary : { data: [] },
          resp
        )
        await this.addRowsData(groupId, template, optionParPages, counters)
      }
    }

    return template
  }

  private async prepareResultExporter(
    c: CustomContext<DB>,
    language: string,
    timezone: string,
    queryParams: StockBookQueryParams
  ) {
    const batchSize = 1000
    const paginate = {
      page: 1,
      paginate: batchSize,
      offset: 0,
    }

    const template = new MultiSheetZipExporter({
      language,
      timezone,
      batchSize: env.EXPORT_EXCEL_BATCH_SIZE,
      bucketName: env.EXPORT_EXCEL_BUCKET_NAME,
    })

    c.var.programId = queryParams.program_id

    // --- page pertama (biar dapat total_page dan filters)
    const [stockOpnameResultSummary, stockOpnameResult, filters] =
      await Promise.all([
        this.stockOpnameModule.stockOpnameResultSummary(c, {
          ...queryParams,
          ...paginate,
        }),
        this.stockOpnameModule.stockOpnameResult(c, {
          ...queryParams,
          ...paginate,
        }),
        this.stockOpnameModule.generateFilters(c, queryParams),
      ])

    const options = buildSoResultExportOptions(
      c,
      filters,
      stockOpnameResultSummary,
      stockOpnameResult
    )

    const regionLabel = getExportLocationFileName(c, queryParams, filters)
    const groupId = c.var.t("stock_opname.sheet.title.result")
    const fileName = `${groupId} ${regionLabel} ${moment().format("YYYY MM DD HH:mm:ss")}`

    // --- init file & sheets
    await template.initFileGroupWarehouse(groupId, fileName)
    for (const option of options) {
      await template.initSheet(groupId, option.sheetName)
      await template.setTitleBar(
        groupId,
        option.sheetName,
        option.columns,
        option.titleBar
      )
      await template.setFilters(groupId, option.sheetName, option.filters)
      await template.setColumns(groupId, option.sheetName, option.columns)
    }

    // --- loop per halaman, streaming tulis ke file
    const counters: Record<string, number> = {}
    for (let page = 1; page <= stockOpnameResult.total_page; page++) {
      const resp =
        page === 1
          ? stockOpnameResult
          : await this.stockOpnameModule.stockOpnameResult(c, {
              ...queryParams,
              paginate: batchSize,
              page,
              offset: (page - 1) * batchSize,
            })

      if (resp.data.length > 0) {
        const optionParPages = buildSoResultExportOptions(
          c,
          filters,
          page === 1 ? stockOpnameResultSummary : { data: [] },
          resp
        )
        await this.addRowsData(groupId, template, optionParPages, counters)
      }
    }

    return template
  }

  private async addRowsData(
    groupId: string,
    template: MultiSheetZipExporter,
    options,
    counters: Record<string, number>
  ) {
    let largestCount = 0
    for (const { data } of options) {
      if (data instanceof Array && data.length > largestCount)
        largestCount = data.length
    }

    // single loop + yield row secara streaming
    for (let i = 0; i < largestCount; i++) {
      for (const { sheetName, data } of options) {
        const rowData = data[i]
        if (rowData) {
          counters[sheetName] = (counters[sheetName] ?? 0) + 1
          await template.addRows(groupId, sheetName, [
            { ...rowData, no: counters[sheetName] },
          ])
        }
      }
    }
  }
}
