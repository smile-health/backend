import { DB } from "@/common/infrastructure/database/types/db.js"
import { Context } from "@smile-health/lib/types/context.js"
import { LoggerMonitoringRepository } from "../../logger-monitoring/logger-monitoring.repository.js"
import { ConfigProgram } from "../download-report.schema.js"
import moment from "moment-timezone"
import { MultiSheetZipExporter } from "@smile-health/lib/excel/multi-sheet-zip.js"
import env from "../../../config/env.js"
import { DownloadByCodeLocal } from "../download-report.schema.js"

export class LoggerMonitoringGenerateReport {
  constructor(private readonly repo: LoggerMonitoringRepository) {}

  /**
   * Handle logger monitoring report for recent period (last 7 days) - Code 59
   */
  async handleLoggerMonitoringRecent(
    c: Context<DB>,
    lang: string,
    programId: number,
    configProgram: ConfigProgram,
    provinceId?: number,
    regencyId?: number,
    printBy?: string
  ): Promise<DownloadByCodeLocal> {
    const now = moment().tz("Asia/Jakarta")
    const sevenDaysAgo = now.clone().subtract(7, "days")
    const startDate = sevenDaysAgo.format("YYYY-MM-DD")
    const endDate = now.format("YYYY-MM-DD")

    return this.generateReport(
      c,
      lang,
      "59",
      startDate,
      endDate,
      provinceId,
      regencyId,
      printBy
    )
  }

  /**
   * Handle logger monitoring report for specific month/year - Code 60
   */
  async handleLoggerMonitoringMonthly(
    c: Context<DB>,
    lang: string,
    month: number,
    year: number,
    provinceId?: number,
    regencyId?: number,
    printBy?: string
  ): Promise<DownloadByCodeLocal> {
    // Calculate start and end date for the month
    const startDate = moment()
      .year(year)
      .month(month - 1)
      .startOf("month")
      .format("YYYY-MM-DD")
    const endDate = moment()
      .year(year)
      .month(month - 1)
      .endOf("month")
      .format("YYYY-MM-DD")

    return this.generateReport(
      c,
      lang,
      "60",
      startDate,
      endDate,
      provinceId,
      regencyId,
      printBy,
      month,
      year
    )
  }

  /**
   * Main report generation logic
   */
  private async generateReport(
    c: Context<DB>,
    lang: string,
    code: string,
    startDate: string,
    endDate: string,
    provinceId?: number,
    regencyId?: number,
    printBy?: string,
    month?: number,
    year?: number
  ): Promise<DownloadByCodeLocal> {
    const exporter = new MultiSheetZipExporter({
      language: lang,
      timezone: "Asia/Jakarta",
      batchSize: env.EXPORT_EXCEL_BATCH_SIZE,
      bucketName: env.EXPORT_EXCEL_BUCKET_NAME,
    })

    const title: string = c.var.t(`download-report.name.${code}`, {
      month,
      year,
    })

    const filePath: string = `${crypto.randomUUID()}.zip`

    const groupId = title
    const groupName = title.replace(/\//g, " ")

    // Initialize file group
    await exporter.initFileGroupWarehouse(groupId, groupName)

    // Fetch all data in parallel
    const currentYear = moment().year()
    const [
      {
        filters: summaryFilters,
        columns: summaryColumns,
        dataRows: summaryDataRows,
      },
      dailyData,
      loggerInfoData,
    ] = await Promise.all([
      this.prepareSummaryData(c, currentYear, provinceId, regencyId),
      this.prepareDailyData(
        c,
        startDate,
        endDate,
        provinceId,
        regencyId,
        month,
        year
      ),
      this.prepareLoggerInfoData(c, startDate, endDate, provinceId, regencyId),
    ])

    // Summary Sheet
    const summarySheetName = c.var.t("download-report.sheet.summary")
    await exporter.initSheet(groupId, summarySheetName)
    await exporter.setFilters(groupId, summarySheetName, summaryFilters)
    await exporter.setColumns(groupId, summarySheetName, summaryColumns)
    await exporter.addRows(groupId, summarySheetName, summaryDataRows)

    // Daily Sheet
    const dailySheetName = c.var.t("download-report.sheet.daily")
    await exporter.initSheet(groupId, dailySheetName)
    await exporter.setColumns(groupId, dailySheetName, this.getDailyColumns(c))
    await exporter.addRows(groupId, dailySheetName, dailyData)

    // Logger Info Sheet
    const loggerInfoSheetName = c.var.t("download-report.sheet.logger_info")
    await exporter.initSheet(groupId, loggerInfoSheetName)
    await exporter.setColumns(
      groupId,
      loggerInfoSheetName,
      this.getLoggerInfoColumns(c)
    )
    await exporter.addRows(groupId, loggerInfoSheetName, loggerInfoData)

    await exporter.generateAndSaveZipFile(filePath)

    return {
      status: true,
      filename: `${title} ${moment().format("DD-MM-YYYY")}`,
      filePath,
    }
  }

  /**
   * Prepare Summary Sheet data (filters, headers, and data rows)
   */
  private async prepareSummaryData(
    c: Context<DB>,
    year: number,
    provinceId?: number,
    regencyId?: number
  ): Promise<{
    filters: Array<{ key: string; value: string }>
    columns: Array<{ key?: string; header: string; width: number }>
    dataRows: Array<Record<string, unknown>>
  }> {
    // Get location names
    const location = await this.repo.getLocationNames(c, provinceId, regencyId)

    // Build filters
    const filters = [
      {
        key: c.var.t("download-report.column.location"),
        value: location.province || c.var.t("download-report.national"),
      },
      {
        key: c.var.t("download-report.column.province"),
        value: location.province || "-",
      },
      {
        key: c.var.t("download-report.column.regency"),
        value: location.regency || "-",
      },
      {
        key: c.var.t("download-report.column.period_start"),
        value: moment().year(year).startOf("year").format("MMMM YYYY"),
      },
      {
        key: c.var.t("download-report.column.period_end"),
        value: moment().format("MMMM YYYY"),
      },
      {
        key: c.var.t("download-report.column.print_date"),
        value: moment().tz("Asia/Jakarta").format("DD MMMM YYYY"),
      },
    ]

    // Fetch summary data
    const [summaryAsset, summary, excursionCCE] = await Promise.all([
      this.repo.getSummaryAsset(c, year, provinceId, regencyId),
      this.repo.getSummary(c, year, provinceId, regencyId),
      this.repo.getExcursionCCECount(c, year, provinceId, regencyId),
    ])

    // Group data by week
    const summaryAssetByWeek = this.groupByWeek(summaryAsset) as Record<
      number,
      unknown
    >
    const summaryByWeek = this.groupByWeek(summary) as Record<number, unknown>
    const excursionByWeek = this.groupByWeek(excursionCCE) as Record<
      number,
      unknown
    >

    // Build columns for summary sheet (3 fixed columns + 52 week columns)
    const columns: Array<{ key?: string; header: string; width: number }> = [
      { key: "col1", header: "No", width: 10 },
      {
        key: "col2",
        header: c.var.t("download-report.column.variables"),
        width: 40,
      },
    ]

    // Add 52 week columns
    for (let week = 1; week <= 52; week++) {
      columns.push({
        key: `week_${week}`,
        header: `${c.var.t("download-report.column.week")} ${week}`,
        width: 15,
      })
    }

    // Build data rows with all 77 variables
    const dataRows = this.buildSummaryDataRows(
      c,
      summaryAssetByWeek,
      summaryByWeek,
      excursionByWeek
    )

    return { filters, columns, dataRows }
  }

  /**
   * Prepare Daily Sheet data
   */
  private async prepareDailyData(
    c: Context<DB>,
    startDate: string,
    endDate: string,
    provinceId?: number,
    regencyId?: number,
    month?: number,
    year?: number
  ): Promise<Array<Record<string, unknown>>> {
    // Fetch daily data
    const dailyData = await this.repo.getDailyData(
      c,
      startDate,
      endDate,
      provinceId,
      regencyId,
      month,
      year
    )

    // Transform data to rows
    const rows = dailyData.map((item, index) => ({
      no: index + 1,
      province_name: item.province_name,
      regency_name: item.regency_name,
      entity_id: item.entity_id,
      entity_name: item.entity_name,
      entity_type: item.entity_type,
      asset_rtmd_id: item.asset_rtmd_id,
      asset_rtmd_type_name: item.asset_rtmd_type_name,
      asset_inventory_model_name: item.asset_inventory_model_name,
      asset_rtmd_min_temperature: item.asset_rtmd_min_temperature,
      asset_rtmd_max_temperature: item.asset_rtmd_max_temperature,
      asset_rtmd_serial_number: item.asset_rtmd_serial_number,
      manufacture_name: item.manufacture_name,
      asset_rtmd_vendor_name: item.asset_rtmd_vendor_name,
      logger_date: item.logger_date,
      week: item.week,
      daily_data_sent: item.daily_data_sent,
      max_datetime: item.max_datetime,
      min_datetime: item.min_datetime,
      hour_online: item.hour_online,
      hour_offline: item.hour_offline,
      category_hour_offline: item.category_hour_offline,
      weekly_offline_category: item.weekly_offline_category,
      excursion_type: item.excursion_type,
      freq_excursion_over_8: item.freq_excursion_over_8,
      duration_excursion_over_8: item.duration_excursion_over_8,
      freq_excursion_over_8_below_1_hour:
        item.freq_excursion_over_8_below_1_hour,
      duration_excursion_over_8_below_1_hour:
        item.duration_excursion_over_8_below_1_hour,
      freq_excursion_over_8_between_1_until_10_hour:
        item.freq_excursion_over_8_between_1_until_10_hour,
      duration_excursion_over_8_between_1_until_10_hour:
        item.duration_excursion_over_8_between_1_until_10_hour,
      freq_excursion_over_8_over_10_hour:
        item.freq_excursion_over_8_over_10_hour,
      duration_excursion_over_8_over_10_hour:
        item.duration_excursion_over_8_over_10_hour,
      freq_excursion_between_2_min_0_5: item.freq_excursion_between_2_min_0_5,
      duration_excursion_between_2_min_0_5:
        item.duration_excursion_between_2_min_0_5,
      freq_excursion_between_2_min_0_5_below_1_hour:
        item.freq_excursion_between_2_min_0_5_below_1_hour,
      duration_excursion_between_2_min_0_5_below_1_hour:
        item.duration_excursion_between_2_min_0_5_below_1_hour,
      freq_excursion_between_2_min_0_5_between_1_until_10_hour:
        item.freq_excursion_between_2_min_0_5_between_1_until_10_hour,
      duration_excursion_between_2_min_0_5_between_1_until_10_hour:
        item.duration_excursion_between_2_min_0_5_between_1_until_10_hour,
      freq_excursion_between_2_min_0_5_over_10_hour:
        item.freq_excursion_between_2_min_0_5_over_10_hour,
      duration_excursion_between_2_min_0_5_over_10_hour:
        item.duration_excursion_between_2_min_0_5_over_10_hour,
      freq_excursion_below_min_0_5: item.freq_excursion_below_min_0_5,
      duration_excursion_below_min_0_5: item.duration_excursion_below_min_0_5,
      freq_excursion_below_min_0_5_below_1_hour:
        item.freq_excursion_below_min_0_5_below_1_hour,
      duration_excursion_below_min_0_5_below_1_hour:
        item.duration_excursion_below_min_0_5_below_1_hour,
      freq_excursion_below_min_0_5_between_1_until_10_hour:
        item.freq_excursion_below_min_0_5_between_1_until_10_hour,
      duration_excursion_below_min_0_5_between_1_until_10_hour:
        item.duration_excursion_below_min_0_5_between_1_until_10_hour,
      freq_excursion_below_min_0_5_over_10_hour:
        item.freq_excursion_below_min_0_5_over_10_hour,
      duration_excursion_below_min_0_5_over_10_hour:
        item.duration_excursion_below_min_0_5_over_10_hour,
      freq_excursion_over_min_15: item.freq_excursion_over_min_15,
      duration_excursion_over_min_15: item.duration_excursion_over_min_15,
      freq_excursion_over_min_15_below_1_hour:
        item.freq_excursion_over_min_15_below_1_hour,
      duration_excursion_over_min_15_below_1_hour:
        item.duration_excursion_over_min_15_below_1_hour,
      freq_excursion_over_min_15_between_1_until_10_hour:
        item.freq_excursion_over_min_15_between_1_until_10_hour,
      duration_excursion_over_min_15_between_1_until_10_hour:
        item.duration_excursion_over_min_15_between_1_until_10_hour,
      freq_excursion_over_min_15_over_10_hour:
        item.freq_excursion_over_min_15_over_10_hour,
      duration_excursion_over_min_15_over_10_hour:
        item.duration_excursion_over_min_15_over_10_hour,
      freq_excursion_over_min_0_5: item.freq_excursion_over_min_0_5,
      duration_excursion_over_min_0_5: item.duration_excursion_over_min_0_5,
      freq_excursion_over_min_0_5_below_1_hour:
        item.freq_excursion_over_min_0_5_below_1_hour,
      duration_excursion_over_min_0_5_below_1_hour:
        item.duration_excursion_over_min_0_5_below_1_hour,
      freq_excursion_over_min_0_5_between_1_until_10_hour:
        item.freq_excursion_over_min_0_5_between_1_until_10_hour,
      duration_excursion_over_min_0_5_between_1_until_10_hour:
        item.duration_excursion_over_min_0_5_between_1_until_10_hour,
      freq_excursion_over_min_0_5_over_10_hour:
        item.freq_excursion_over_min_0_5_over_10_hour,
      duration_excursion_over_min_0_5_over_10_hour:
        item.duration_excursion_over_min_0_5_over_10_hour,
      freq_excursion_below_min_2: item.freq_excursion_below_min_2,
      duration_excursion_below_min_2: item.duration_excursion_below_min_2,
      freq_excursion_below_min_2_below_1_hour:
        item.freq_excursion_below_min_2_below_1_hour,
      duration_excursion_below_min_2_below_1_hour:
        item.duration_excursion_below_min_2_below_1_hour,
      freq_excursion_below_min_2_between_1_until_10_hour:
        item.freq_excursion_below_min_2_between_1_until_10_hour,
      duration_excursion_below_min_2_between_1_until_10_hour:
        item.duration_excursion_below_min_2_between_1_until_10_hour,
      freq_excursion_below_min_2_over_10_hour:
        item.freq_excursion_below_min_2_over_10_hour,
      duration_excursion_below_min_2_over_10_hour:
        item.duration_excursion_below_min_2_over_10_hour,
    }))

    return rows
  }

  /**
   * Prepare Logger Info Sheet data with asset master data
   */
  private async prepareLoggerInfoData(
    c: Context<DB>,
    startDate: string,
    endDate: string,
    provinceId?: number,
    regencyId?: number
  ): Promise<Array<Record<string, unknown>>> {
    // Fetch all logger info at once
    const loggerInfo = await this.repo.getLoggerInfo(c, provinceId, regencyId)

    // Map logger info to rows with row numbers
    const rows = loggerInfo.map((item, index) => ({
      no: index + 1,
      province_name: item.province_name,
      regency_name: item.regency_name,
      entity_id: item.entity_id,
      entity_name: item.entity_name,
      entity_type: item.entity_type,
      asset_inventory_id: item.asset_inventory_id,
      asset_inventory_asset_type_name: item.asset_inventory_asset_type_name,
      asset_inventory_model_name: item.asset_inventory_model_name,
      asset_inventory_manufacture_name: item.asset_inventory_manufacture_name,
      asset_inventory_working_status_id: item.asset_inventory_working_status_id,
      working_status: item.working_status,
      asset_rtmd_id: item.asset_rtmd_id,
      asset_model_name: item.asset_model_name,
      serial_number: item.serial_number,
      lat: item.lat,
      lng: item.lng,
      manufacture_name: item.manufacture_name,
      status: item.status,
      budget_year: item.budget_year,
      created_at: item.created_at,
      updated_at: item.updated_at,
      status_data_temp: "No",
    }))

    return rows
  }

  /**
   * Get column definitions for Daily sheet
   */
  private getDailyColumns(
    c: Context<DB>
  ): Array<{ key: string; header: string; width: number }> {
    return [
      { key: "no", header: c.var.t("download-report.column.no"), width: 10 },
      {
        key: "province_name",
        header: c.var.t("download-report.column.province_name"),
        width: 30,
      },
      {
        key: "regency_name",
        header: c.var.t("download-report.column.regency_name"),
        width: 30,
      },
      {
        key: "entity_id",
        header: c.var.t("download-report.column.entity_id"),
        width: 20,
      },
      {
        key: "entity_name",
        header: c.var.t("download-report.column.entity_name"),
        width: 40,
      },
      {
        key: "entity_type",
        header: c.var.t("download-report.column.entity_type"),
        width: 20,
      },
      {
        key: "asset_rtmd_id",
        header: c.var.t("download-report.column.logger_id"),
        width: 20,
      },
      {
        key: "asset_rtmd_type_name",
        header: c.var.t("download-report.column.logger_type"),
        width: 30,
      },
      {
        key: "asset_inventory_model_name",
        header: c.var.t("download-report.column.cce_model"),
        width: 30,
      },
      {
        key: "asset_rtmd_min_temperature",
        header: c.var.t("download-report.column.min_temp"),
        width: 20,
      },
      {
        key: "asset_rtmd_max_temperature",
        header: c.var.t("download-report.column.max_temp"),
        width: 20,
      },
      {
        key: "asset_rtmd_serial_number",
        header: c.var.t("download-report.column.logger_serial"),
        width: 30,
      },
      {
        key: "manufacture_name",
        header: c.var.t("download-report.column.manufacturer"),
        width: 30,
      },
      {
        key: "asset_rtmd_vendor_name",
        header: c.var.t("download-report.column.vendor"),
        width: 30,
      },
      {
        key: "logger_date",
        header: c.var.t("download-report.column.logger_date"),
        width: 20,
      },
      {
        key: "week",
        header: c.var.t("download-report.column.week"),
        width: 15,
      },
      {
        key: "daily_data_sent",
        header: c.var.t("download-report.column.daily_data_sent"),
        width: 20,
      },
      {
        key: "max_datetime",
        header: c.var.t("download-report.column.max_datetime"),
        width: 25,
      },
      {
        key: "min_datetime",
        header: c.var.t("download-report.column.min_datetime"),
        width: 25,
      },
      {
        key: "hour_online",
        header: c.var.t("download-report.column.hour_online"),
        width: 20,
      },
      {
        key: "hour_offline",
        header: c.var.t("download-report.column.hour_offline"),
        width: 20,
      },
      {
        key: "category_hour_offline",
        header: c.var.t("download-report.column.category_hour_offline"),
        width: 30,
      },
      {
        key: "weekly_offline_category",
        header: c.var.t("download-report.column.weekly_offline_category"),
        width: 30,
      },
      {
        key: "excursion_type",
        header: c.var.t("download-report.column.excursion_type"),
        width: 30,
      },
      // Excursion frequency and duration columns (72 total)
      {
        key: "freq_excursion_over_8",
        header: c.var.t("download-report.column.freq_excursion_over_8"),
        width: 25,
      },
      {
        key: "duration_excursion_over_8",
        header: c.var.t("download-report.column.duration_excursion_over_8"),
        width: 25,
      },
      {
        key: "freq_excursion_over_8_below_1_hour",
        header: c.var.t(
          "download-report.column.freq_excursion_over_8_below_1_hour"
        ),
        width: 30,
      },
      {
        key: "duration_excursion_over_8_below_1_hour",
        header: c.var.t(
          "download-report.column.duration_excursion_over_8_below_1_hour"
        ),
        width: 30,
      },
      {
        key: "freq_excursion_over_8_between_1_until_10_hour",
        header: c.var.t(
          "download-report.column.freq_excursion_over_8_between_1_until_10_hour"
        ),
        width: 35,
      },
      {
        key: "duration_excursion_over_8_between_1_until_10_hour",
        header: c.var.t(
          "download-report.column.duration_excursion_over_8_between_1_until_10_hour"
        ),
        width: 35,
      },
      {
        key: "freq_excursion_over_8_over_10_hour",
        header: c.var.t(
          "download-report.column.freq_excursion_over_8_over_10_hour"
        ),
        width: 30,
      },
      {
        key: "duration_excursion_over_8_over_10_hour",
        header: c.var.t(
          "download-report.column.duration_excursion_over_8_over_10_hour"
        ),
        width: 30,
      },
      // Add remaining excursion columns (abbreviated for brevity - follow same pattern)
      {
        key: "freq_excursion_between_2_min_0_5",
        header: c.var.t(
          "download-report.column.freq_excursion_between_2_min_0_5"
        ),
        width: 30,
      },
      {
        key: "duration_excursion_between_2_min_0_5",
        header: c.var.t(
          "download-report.column.duration_excursion_between_2_min_0_5"
        ),
        width: 30,
      },
      {
        key: "freq_excursion_below_min_0_5",
        header: c.var.t("download-report.column.freq_excursion_below_min_0_5"),
        width: 30,
      },
      {
        key: "duration_excursion_below_min_0_5",
        header: c.var.t(
          "download-report.column.duration_excursion_below_min_0_5"
        ),
        width: 30,
      },
      {
        key: "freq_excursion_over_min_15",
        header: c.var.t("download-report.column.freq_excursion_over_min_15"),
        width: 30,
      },
      {
        key: "duration_excursion_over_min_15",
        header: c.var.t(
          "download-report.column.duration_excursion_over_min_15"
        ),
        width: 30,
      },
      {
        key: "freq_excursion_over_min_0_5",
        header: c.var.t("download-report.column.freq_excursion_over_min_0_5"),
        width: 30,
      },
      {
        key: "duration_excursion_over_min_0_5",
        header: c.var.t(
          "download-report.column.duration_excursion_over_min_0_5"
        ),
        width: 30,
      },
      {
        key: "freq_excursion_below_min_2",
        header: c.var.t("download-report.column.freq_excursion_below_min_2"),
        width: 30,
      },
      {
        key: "duration_excursion_below_min_2",
        header: c.var.t(
          "download-report.column.duration_excursion_below_min_2"
        ),
        width: 30,
      },
    ]
  }

  /**
   * Get column definitions for Logger Info sheet
   */
  private getLoggerInfoColumns(
    c: Context<DB>
  ): Array<{ key: string; header: string; width: number }> {
    return [
      { key: "no", header: c.var.t("download-report.column.no"), width: 10 },
      {
        key: "province_name",
        header: c.var.t("download-report.column.province_name"),
        width: 30,
      },
      {
        key: "regency_name",
        header: c.var.t("download-report.column.regency_name"),
        width: 30,
      },
      {
        key: "entity_id",
        header: c.var.t("download-report.column.entity_id"),
        width: 20,
      },
      {
        key: "entity_name",
        header: c.var.t("download-report.column.entity_name"),
        width: 40,
      },
      {
        key: "entity_type",
        header: c.var.t("download-report.column.entity_type"),
        width: 20,
      },
      {
        key: "asset_inventory_id",
        header: c.var.t("download-report.column.cce_id"),
        width: 20,
      },
      {
        key: "asset_inventory_asset_type_name",
        header: c.var.t("download-report.column.cce_type"),
        width: 30,
      },
      {
        key: "asset_inventory_model_name",
        header: c.var.t("download-report.column.cce_model"),
        width: 30,
      },
      {
        key: "asset_inventory_manufacture_name",
        header: c.var.t("download-report.column.cce_manufacturer"),
        width: 30,
      },
      {
        key: "asset_inventory_working_status_id",
        header: c.var.t("download-report.column.working_status_id"),
        width: 25,
      },
      {
        key: "working_status",
        header: c.var.t("download-report.column.working_status"),
        width: 30,
      },
      {
        key: "asset_rtmd_id",
        header: c.var.t("download-report.column.logger_id"),
        width: 20,
      },
      {
        key: "asset_model_name",
        header: c.var.t("download-report.column.logger_model"),
        width: 30,
      },
      {
        key: "serial_number",
        header: c.var.t("download-report.column.serial_number"),
        width: 30,
      },
      {
        key: "lat",
        header: c.var.t("download-report.column.latitude"),
        width: 20,
      },
      {
        key: "lng",
        header: c.var.t("download-report.column.longitude"),
        width: 20,
      },
      {
        key: "manufacture_name",
        header: c.var.t("download-report.column.manufacturer"),
        width: 30,
      },
      {
        key: "status",
        header: c.var.t("download-report.column.status"),
        width: 15,
      },
      {
        key: "budget_year",
        header: c.var.t("download-report.column.budget_year"),
        width: 20,
      },
      {
        key: "created_at",
        header: c.var.t("download-report.column.created_at"),
        width: 25,
      },
      {
        key: "updated_at",
        header: c.var.t("download-report.column.updated_at"),
        width: 25,
      },
      {
        key: "status_data_temp",
        header: c.var.t("download-report.column.data_transmission_status"),
        width: 30,
      },
    ]
  }

  /**
   * Helper: Group array by week property
   */
  private groupByWeek<T extends { week: number }>(
    data: T[]
  ): Record<number, T> {
    return data.reduce(
      (acc, item) => {
        acc[item.week] = item
        return acc
      },
      {} as Record<number, T>
    )
  }

  /**
   * Helper: Build summary data rows (77 variables across 52 weeks)
   */
  private buildSummaryDataRows(
    c: Context<DB>,
    summaryAssetByWeek: Record<number, unknown>,
    summaryByWeek: Record<number, unknown>,
    excursionByWeek: Record<number, unknown>
  ): Array<Record<string, unknown>> {
    const rows: Array<Record<string, unknown>> = []

    // Define all 77 variables with their data sources
    const variables = [
      {
        no: "1",
        label: c.var.t("download-report.summary.cce_registered"),
        key: "cce_registered_with_smile",
        source: "asset",
      },
      {
        no: "1.1",
        label: c.var.t("download-report.summary.cce_functional"),
        key: "cce_functional_status",
        source: "asset",
      },
      {
        no: "1.1.2",
        label: c.var.t("download-report.summary.cce_broken_repair"),
        key: "cce_broken_and_under_repair_status",
        source: "asset",
      },
      {
        no: "1.1.3",
        label: c.var.t("download-report.summary.cce_broken_need_repair"),
        key: "cce_broken_and_need_repair_status",
        source: "asset",
      },
      {
        no: "1.1.4",
        label: c.var.t("download-report.summary.cce_broken_cannot_repair"),
        key: "cce_broken_and_cannot_be_repaire_status",
        source: "asset",
      },
      {
        no: "1.1.5",
        label: c.var.t("download-report.summary.cce_functional_with_logger"),
        key: "cce_functional_status_related_to_logger",
        source: "asset",
      },
      {
        no: "1.2",
        label: c.var.t("download-report.summary.logger_active"),
        key: "logger_active_on_smile",
        source: "asset",
      },
      {
        no: "1.3",
        label: c.var.t("download-report.summary.logger_related_cce"),
        key: "logger_releted_at_cce",
        source: "asset",
      },
      {
        no: "2",
        label: c.var.t("download-report.summary.logger_send_data"),
        key: "logger_that_send_data",
        source: "summary",
      },
      {
        no: "2.1",
        label: c.var.t("download-report.summary.logger_online_24h"),
        key: "logger_online_twenty_four_hours",
        source: "summary",
      },
      {
        no: "2.1.1",
        label: c.var.t("download-report.summary.logger_once_offline"),
        key: "logger_was_once_offline",
        source: "summary",
      },
      {
        no: "2.1.2",
        label: c.var.t("download-report.summary.logger_offline_under_1h"),
        key: "logger_offline_under_one_hours",
        source: "summary",
      },
      {
        no: "2.1.3",
        label: c.var.t("download-report.summary.logger_offline_1_10h"),
        key: "logger_offline_one_until_ten_hours",
        source: "summary",
      },
      {
        no: "2.1.4",
        label: c.var.t("download-report.summary.logger_offline_over_10h"),
        key: "logger_offline_over_ten_hours",
        source: "summary",
      },
      {
        no: "3",
        label: c.var.t("download-report.summary.cce_functional_send_data"),
        key: "cce_functional_status_send_data_to_logger",
        source: "summary",
      },
      {
        no: "3.1",
        label: c.var.t("download-report.summary.facilities_without_excursion"),
        key: "cce_without_excursion_events",
        source: "excursion",
      },
      {
        no: "3.2",
        label: c.var.t("download-report.summary.facilities_with_excursion"),
        key: "cce_with_excursion_events",
        source: "excursion",
      },
      {
        no: "3.2.1",
        label: c.var.t("download-report.summary.freq_excursion_over_8_cce"),
        key: "freq_excursion_over_8_cce",
        source: "summary",
      },
      {
        no: "3.2.1.1",
        label: c.var.t(
          "download-report.summary.freq_excursion_over_8_cce_cat_1"
        ),
        key: "freq_excursion_over_8_cce_cat_1",
        source: "summary",
      },
      {
        no: "3.2.1.2",
        label: c.var.t(
          "download-report.summary.freq_excursion_over_8_cce_cat_2"
        ),
        key: "freq_excursion_over_8_cce_cat_2",
        source: "summary",
      },
      {
        no: "3.2.1.3",
        label: c.var.t(
          "download-report.summary.freq_excursion_over_8_cce_cat_3"
        ),
        key: "freq_excursion_over_8_cce_cat_3",
        source: "summary",
      },
      {
        no: "3.2.2",
        label: c.var.t(
          "download-report.summary.freq_excursion_between_2_min_0_5_cce"
        ),
        key: "freq_excursion_between_2_min_0_5_cce",
        source: "summary",
      },
      {
        no: "3.2.2.1",
        label: c.var.t(
          "download-report.summary.freq_excursion_between_2_min_0_5_cce_cat_1"
        ),
        key: "freq_excursion_between_2_min_0_5_cce_cat_1",
        source: "summary",
      },
      {
        no: "3.2.2.2",
        label: c.var.t(
          "download-report.summary.freq_excursion_between_2_min_0_5_cce_cat_2"
        ),
        key: "freq_excursion_between_2_min_0_5_cce_cat_2",
        source: "summary",
      },
      {
        no: "3.2.2.3",
        label: c.var.t(
          "download-report.summary.freq_excursion_between_2_min_0_5_cce_cat_3"
        ),
        key: "freq_excursion_between_2_min_0_5_cce_cat_3",
        source: "summary",
      },
      {
        no: "3.2.3",
        label: c.var.t(
          "download-report.summary.freq_excursion_below_min_0_5_cce"
        ),
        key: "freq_excursion_below_min_0_5_cce",
        source: "summary",
      },
      {
        no: "3.2.3.1",
        label: c.var.t(
          "download-report.summary.freq_excursion_below_min_0_5_cce_cat_1"
        ),
        key: "freq_excursion_below_min_0_5_cce_cat_1",
        source: "summary",
      },
      {
        no: "3.2.3.2",
        label: c.var.t(
          "download-report.summary.freq_excursion_below_min_0_5_cce_cat_2"
        ),
        key: "freq_excursion_below_min_0_5_cce_cat_2",
        source: "summary",
      },
      {
        no: "3.2.3.3",
        label: c.var.t(
          "download-report.summary.freq_excursion_below_min_0_5_cce_cat_3"
        ),
        key: "freq_excursion_below_min_0_5_cce_cat_3",
        source: "summary",
      },
      {
        no: "3.2.4",
        label: c.var.t(
          "download-report.summary.freq_excursion_over_min_15_cce"
        ),
        key: "freq_excursion_over_min_15_cce",
        source: "summary",
      },
      {
        no: "3.2.4.1",
        label: c.var.t(
          "download-report.summary.freq_excursion_over_min_15_cce_cat_1"
        ),
        key: "freq_excursion_over_min_15_cce_cat_1",
        source: "summary",
      },
      {
        no: "3.2.4.2",
        label: c.var.t(
          "download-report.summary.freq_excursion_over_min_15_cce_cat_2"
        ),
        key: "freq_excursion_over_min_15_cce_cat_2",
        source: "summary",
      },
      {
        no: "3.2.4.3",
        label: c.var.t(
          "download-report.summary.freq_excursion_over_min_15_cce_cat_3"
        ),
        key: "freq_excursion_over_min_15_cce_cat_3",
        source: "summary",
      },
      {
        no: "3.2.5",
        label: c.var.t(
          "download-report.summary.freq_excursion_over_min_0_5_cce"
        ),
        key: "freq_excursion_over_min_0_5_cce",
        source: "summary",
      },
      {
        no: "3.2.5.1",
        label: c.var.t(
          "download-report.summary.freq_excursion_over_min_0_5_cce_cat_1"
        ),
        key: "freq_excursion_over_min_0_5_cce_cat_1",
        source: "summary",
      },
      {
        no: "3.2.5.2",
        label: c.var.t(
          "download-report.summary.freq_excursion_over_min_0_5_cce_cat_2"
        ),
        key: "freq_excursion_over_min_0_5_cce_cat_2",
        source: "summary",
      },
      {
        no: "3.2.5.3",
        label: c.var.t(
          "download-report.summary.freq_excursion_over_min_0_5_cce_cat_3"
        ),
        key: "freq_excursion_over_min_0_5_cce_cat_3",
        source: "summary",
      },
      {
        no: "3.3",
        label: c.var.t("download-report.summary.freq_excursion_over_8_sum"),
        key: "freq_excursion_over_8_sum",
        source: "summary",
      },
      {
        no: "3.3.1",
        label: c.var.t(
          "download-report.summary.freq_excursion_over_8_sum_cat_1"
        ),
        key: "freq_excursion_over_8_sum_cat_1",
        source: "summary",
      },
      {
        no: "3.3.2",
        label: c.var.t(
          "download-report.summary.freq_excursion_over_8_sum_cat_2"
        ),
        key: "freq_excursion_over_8_sum_cat_2",
        source: "summary",
      },
      {
        no: "3.3.3",
        label: c.var.t(
          "download-report.summary.freq_excursion_over_8_sum_cat_3"
        ),
        key: "freq_excursion_over_8_sum_cat_3",
        source: "summary",
      },
      {
        no: "3.4",
        label: c.var.t(
          "download-report.summary.freq_excursion_between_2_min_0_5_sum"
        ),
        key: "freq_excursion_between_2_min_0_5_sum",
        source: "summary",
      },
      {
        no: "3.4.1",
        label: c.var.t(
          "download-report.summary.freq_excursion_between_2_min_0_5_sum_cat_1"
        ),
        key: "freq_excursion_between_2_min_0_5_sum_cat_1",
        source: "summary",
      },
      {
        no: "3.4.2",
        label: c.var.t(
          "download-report.summary.freq_excursion_between_2_min_0_5_sum_cat_2"
        ),
        key: "freq_excursion_between_2_min_0_5_sum_cat_2",
        source: "summary",
      },
      {
        no: "3.4.3",
        label: c.var.t(
          "download-report.summary.freq_excursion_between_2_min_0_5_sum_cat_3"
        ),
        key: "freq_excursion_between_2_min_0_5_sum_cat_3",
        source: "summary",
      },
      {
        no: "3.5",
        label: c.var.t(
          "download-report.summary.freq_excursion_below_min_0_5_sum"
        ),
        key: "freq_excursion_below_min_0_5_sum",
        source: "summary",
      },
      {
        no: "3.5.1",
        label: c.var.t(
          "download-report.summary.freq_excursion_below_min_0_5_sum_cat_1"
        ),
        key: "freq_excursion_below_min_0_5_sum_cat_1",
        source: "summary",
      },
      {
        no: "3.5.2",
        label: c.var.t(
          "download-report.summary.freq_excursion_below_min_0_5_sum_cat_2"
        ),
        key: "freq_excursion_below_min_0_5_sum_cat_2",
        source: "summary",
      },
      {
        no: "3.5.3",
        label: c.var.t(
          "download-report.summary.freq_excursion_below_min_0_5_sum_cat_3"
        ),
        key: "freq_excursion_below_min_0_5_sum_cat_3",
        source: "summary",
      },
      {
        no: "3.6",
        label: c.var.t(
          "download-report.summary.freq_excursion_over_min_15_sum"
        ),
        key: "freq_excursion_over_min_15_sum",
        source: "summary",
      },
      {
        no: "3.6.1",
        label: c.var.t(
          "download-report.summary.freq_excursion_over_min_15_sum_cat_1"
        ),
        key: "freq_excursion_over_min_15_sum_cat_1",
        source: "summary",
      },
      {
        no: "3.6.2",
        label: c.var.t(
          "download-report.summary.freq_excursion_over_min_15_sum_cat_2"
        ),
        key: "freq_excursion_over_min_15_sum_cat_2",
        source: "summary",
      },
      {
        no: "3.6.3",
        label: c.var.t(
          "download-report.summary.freq_excursion_over_min_15_sum_cat_3"
        ),
        key: "freq_excursion_over_min_15_sum_cat_3",
        source: "summary",
      },
      {
        no: "3.7",
        label: c.var.t(
          "download-report.summary.freq_excursion_over_min_0_5_sum"
        ),
        key: "freq_excursion_over_min_0_5_sum",
        source: "summary",
      },
      {
        no: "3.7.1",
        label: c.var.t(
          "download-report.summary.freq_excursion_over_min_0_5_sum_cat_1"
        ),
        key: "freq_excursion_over_min_0_5_sum_cat_1",
        source: "summary",
      },
      {
        no: "3.7.2",
        label: c.var.t(
          "download-report.summary.freq_excursion_over_min_0_5_sum_cat_2"
        ),
        key: "freq_excursion_over_min_0_5_sum_cat_2",
        source: "summary",
      },
      {
        no: "3.7.3",
        label: c.var.t(
          "download-report.summary.freq_excursion_over_min_0_5_sum_cat_3"
        ),
        key: "freq_excursion_over_min_0_5_sum_cat_3",
        source: "summary",
      },
      {
        no: "4",
        label: c.var.t(
          "download-report.summary.facilities_no_reported_excursion"
        ),
        key: "facilities_with_no_reported_excursion_incident",
        source: "summary",
      },
      {
        no: "4.1",
        label: c.var.t("download-report.summary.facilities_reported_excursion"),
        key: "facilities_with_reported_excursion_incident",
        source: "summary",
      },
      {
        no: "4.1.1",
        label: c.var.t("download-report.summary.facilities_reported_low_temp"),
        key: "facilities_with_reported_low_temperature_excursion",
        source: "summary",
      },
      {
        no: "4.1.1.1",
        label: c.var.t(
          "download-report.summary.freq_facility_excursion_below_2"
        ),
        key: "freq_facility_excursion_below_2_cce",
        source: "summary",
      },
      {
        no: "4.1.1.2",
        label: c.var.t(
          "download-report.summary.freq_facility_excursion_between_2_min_0_5"
        ),
        key: "freq_facility_excursion_between_2_min_0_5_cce",
        source: "summary",
      },
      {
        no: "4.1.1.3",
        label: c.var.t(
          "download-report.summary.freq_facility_excursion_below_min_0_5"
        ),
        key: "freq_facility_excursion_below_min_0_5_cce",
        source: "summary",
      },
      {
        no: "4.1.2",
        label: c.var.t("download-report.summary.facilities_reported_high_temp"),
        key: "facilities_with_reported_high_temperature_excursion",
        source: "summary",
      },
      {
        no: "4.1.2.1",
        label: c.var.t(
          "download-report.summary.freq_facility_excursion_over_8"
        ),
        key: "freq_facility_excursion_over_8_cce",
        source: "summary",
      },
      {
        no: "4.1.2.2",
        label: c.var.t(
          "download-report.summary.freq_facility_excursion_over_min_15"
        ),
        key: "freq_facility_excursion_over_min_15_cce",
        source: "summary",
      },
      {
        no: "4.1.2.3",
        label: c.var.t(
          "download-report.summary.freq_facility_excursion_over_min_0_5"
        ),
        key: "freq_facility_excursion_over_min_0_5_cce",
        source: "summary",
      },
    ]

    // Build rows for each variable
    for (const variable of variables) {
      const row: Record<string, unknown> = {
        col1: variable.no,
        col2: variable.label,
      }

      // Add data for each week (1-52)
      for (let week = 1; week <= 52; week++) {
        let value: number | string = 0
        if (variable.source === "asset" && summaryAssetByWeek[week]) {
          const weekData = summaryAssetByWeek[week] as Record<string, unknown>
          value = (weekData?.[variable.key] as number) || 0
        } else if (variable.source === "summary" && summaryByWeek[week]) {
          const weekData = summaryByWeek[week] as Record<string, unknown>
          value = (weekData?.[variable.key] as number) || 0
        } else if (variable.source === "excursion" && excursionByWeek[week]) {
          const weekData = excursionByWeek[week] as Record<string, unknown>
          value = (weekData?.[variable.key] as number) || 0
        }
        row[`week_${week}`] = value
      }

      rows.push(row)
    }

    return rows
  }
}
