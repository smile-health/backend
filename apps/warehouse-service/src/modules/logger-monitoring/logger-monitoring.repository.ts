import { DB } from "@/common/infrastructure/database/types/db.js"
import { execQuery } from "@/common/infrastructure/database/index.js"
import { Context } from "@smile-health/lib/types/context.js"
import { LoggerMonitoringQuery } from "./logger-monitoring.query.js"
import {
  LoggerMonitoringSummaryAssetDTO,
  LoggerMonitoringSummaryDTO,
  LoggerMonitoringDailyDTO,
  LoggerInfoDTO,
  ExcursionCCECountDTO,
  LocationNamesDTO,
} from "./logger-monitoring.schema.js"

export class LoggerMonitoringRepository {
  constructor(private readonly query: LoggerMonitoringQuery) {}

  /**
   * Get summary asset data (CCE and Logger status by week)
   */
  async getSummaryAsset(
    c: Context<DB>,
    year: number,
    provinceId?: number,
    regencyId?: number
  ): Promise<LoggerMonitoringSummaryAssetDTO[]> {
    const sql = this.query.buildSummaryAssetQuery(year, provinceId, regencyId)
    const result = await execQuery<LoggerMonitoringSummaryAssetDTO[]>(sql)
    return Array.isArray(result) ? result : []
  }

  /**
   * Get summary data (Logger connectivity and excursion metrics)
   */
  async getSummary(
    c: Context<DB>,
    year: number,
    provinceId?: number,
    regencyId?: number
  ): Promise<LoggerMonitoringSummaryDTO[]> {
    const sql = this.query.buildSummaryQuery(year, provinceId, regencyId)
    const result = await execQuery<LoggerMonitoringSummaryDTO[]>(sql)
    return Array.isArray(result) ? result : []
  }

  /**
   * Get CCE excursion counts (distinct CCE with/without excursions)
   */
  async getExcursionCCECount(
    c: Context<DB>,
    year: number,
    provinceId?: number,
    regencyId?: number
  ): Promise<ExcursionCCECountDTO[]> {
    const sql = this.query.buildExcursionCCECountQuery(
      year,
      provinceId,
      regencyId
    )
    const result = await execQuery<ExcursionCCECountDTO[]>(sql)
    return Array.isArray(result) ? result : []
  }

  /**
   * Get daily logger data
   */
  async getDailyData(
    c: Context<DB>,
    startDate: string,
    endDate: string,
    provinceId?: number,
    regencyId?: number,
    month?: number,
    year?: number
  ): Promise<LoggerMonitoringDailyDTO[]> {
    const sql = this.query.buildDailyQuery(
      startDate,
      endDate,
      provinceId,
      regencyId,
      month,
      year
    )
    const result = await execQuery<LoggerMonitoringDailyDTO[]>(sql)
    return Array.isArray(result) ? result : []
  }

  /**
   * Get logger info (all records)
   */
  async getLoggerInfo(
    c: Context<DB>,
    provinceId?: number,
    regencyId?: number
  ): Promise<LoggerInfoDTO[]> {
    const sql = this.query.buildLoggerInfoQuery(provinceId, regencyId)
    const result = await execQuery<LoggerInfoDTO[]>(sql)
    return Array.isArray(result) ? result : []
  }

  /**
   * Check if logger sent data in period
   */
  async checkLoggerMonitoring(
    c: Context<DB>,
    startDate: string,
    endDate: string,
    assetRtmdId: number
  ): Promise<boolean> {
    const sql = this.query.buildLoggerMonitoringCheckQuery(
      startDate,
      endDate,
      assetRtmdId
    )
    const result = await execQuery<Array<{ asset_rtmd_id: number }>>(sql)
    return Array.isArray(result) && result.length > 0
  }

  /**
   * Get province/regency names for filtering
   */
  async getLocationNames(
    c: Context<DB>,
    provinceId?: number,
    regencyId?: number
  ): Promise<LocationNamesDTO> {
    if (!provinceId && !regencyId) {
      return {}
    }

    let sql = ""

    if (regencyId) {
      sql = `
        SELECT DISTINCT
          province_name AS province,
          regency_name AS regency
        FROM datamart_logger_monitoring FINAL
        WHERE regency_id = '${regencyId}'
        LIMIT 1
      `
    } else if (provinceId) {
      sql = `
        SELECT DISTINCT
          province_name AS province
        FROM datamart_logger_monitoring FINAL
        WHERE province_id = '${provinceId}'
        LIMIT 1
      `
    }

    const result = await execQuery<LocationNamesDTO[]>(sql)
    return Array.isArray(result) && result.length > 0 && result[0]
      ? result[0]
      : {}
  }
}
