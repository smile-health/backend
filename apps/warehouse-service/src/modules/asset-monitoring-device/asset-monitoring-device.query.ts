import { AssetMonitoringDeviceQueryParams } from "./asset-monitoring-device.schema.js"

export class AssetMonitoringDeviceQuery {


  private buildEntityFilters(
    queryParams: AssetMonitoringDeviceQueryParams,
    excludeEntityTagId: boolean = false
  ): string {
    let filter = ""

    if (!excludeEntityTagId && queryParams.entity_tag_ids && queryParams.entity_tag_ids.length > 0) {
      filter += ` AND toInt64(da.entity_tag_id) IN (${queryParams.entity_tag_ids.join(",")})`
    }

    if (queryParams.province_id) {
      filter += ` AND da.province_id = '${queryParams.province_id}'`
    }

    if (queryParams.regency_id) {
      filter += ` AND da.regency_id = '${queryParams.regency_id}'`
    }

    if (queryParams.entity_id) {
      filter += ` AND da.entity_id = '${queryParams.entity_id}'`
    }

    if (queryParams.type_id) {
      filter += ` AND da.type_id = '${queryParams.type_id}'`
    }

    return filter
  }

  private buildRawEntityFilters(
    queryParams: AssetMonitoringDeviceQueryParams
  ): string {
    let filter = ""

    if (queryParams.entity_tag_ids && queryParams.entity_tag_ids.length > 0) {
      filter += ` AND toInt64(da.entity_tag_id) IN (${queryParams.entity_tag_ids.join(",")})`
    }

    if (queryParams.province_id) {
      filter += ` AND da.province_id = '${queryParams.province_id}'`
    }

    if (queryParams.regency_id) {
      filter += ` AND da.regency_id = '${queryParams.regency_id}'`
    }

    if (queryParams.entity_id) {
      filter += ` AND da.id = '${queryParams.entity_id}'`
    }

    if (queryParams.type_id) {
      filter += ` AND da.type_id = '${queryParams.type_id}'`
    }

    return filter
  }

  private buildPqsFilter(queryParams: AssetMonitoringDeviceQueryParams): string {
    const isPqs = queryParams.is_pqs ?? 1
    return isPqs
      ? "AND da.is_who_pqs = 1"
      : "AND (da.is_who_pqs = 0 OR da.is_who_pqs IS NULL)"
  }

  private buildFreqSumExpressions(queryParams: AssetMonitoringDeviceQueryParams) {
    const selectedDurations = queryParams.excursion_durations ?? [1, 2, 3]
    const tempMinMax = queryParams.temp_min_max ?? 1

    const durationSuffixes: Record<number, string> = {
      1: "_below_1_hour",
      2: "_between_1_until_10_hour",
      3: "_over_10_hour",
    }

    const columns = this.getColumnTempMinMax(tempMinMax);

    const colMap = new Map(columns.map(c => [c[1], c[0]]));

    const buildExpr = (alias: string, prefix: string = "") => {
      const baseName = colMap.get(alias);
      if (!baseName) return "0";

      const parts: string[] = []
      for (const d of selectedDurations) {
        if (durationSuffixes[d]) parts.push(`${prefix}${baseName}${durationSuffixes[d]}`)
      }
      return parts.length > 0 ? parts.join(" + ") : "0"
    }

    return {
      lessThanTempFreq: buildExpr("less_than_temp"),
      betweenTempFreq: buildExpr("between_temp"),
      moreThanTempFreq: buildExpr("more_than_temp"),
      buildWithPrefix: (prefix: string) => ({
        lessThanTempFreq: buildExpr("less_than_temp", prefix),
        betweenTempFreq: buildExpr("between_temp", prefix),
        moreThanTempFreq: buildExpr("more_than_temp", prefix),
      })
    }
  }

  private getFilterSevenDays(
    from: string | undefined | null,
    to: string | undefined | null
  ): { dateFilter: string; emptyResultCondition: string } {
    const fromStr = from ?? ""
    const toStr = to ?? ""
    const fromDate = new Date(fromStr)
    const toDate = new Date(toStr)

    fromDate.setHours(0, 0, 0, 0)
    toDate.setHours(0, 0, 0, 0)

    const diffTime = Math.abs(toDate.getTime() - fromDate.getTime())
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24))

    if (
      !fromStr ||
      !toStr ||
      isNaN(fromDate.getTime()) ||
      isNaN(toDate.getTime()) ||
      diffDays < 7
    ) {
      return {
        dateFilter: "WHERE 1=0",
        emptyResultCondition: "AND 1=0",
      }
    }

    return {
      dateFilter: `
        WHERE toDate(logger_date, 'Asia/Jakarta') BETWEEN 
          toDate('${toStr}') - 7 AND toDate('${toStr}') - 1
      `,
      emptyResultCondition: "",
    }
  }

  private getExcursionFilters(queryParams: AssetMonitoringDeviceQueryParams) {
    const excursionDurations = queryParams.excursion_durations ?? [1, 2, 3]
    const tempMinMax = queryParams.temp_min_max ?? 1

    const columnTempMinMax = this.getColumnTempMinMax(tempMinMax)
    const columnDurationExcursion: Record<number, string> = {
      1: "_below_1_hour",
      2: "_between_1_until_10_hour",
      3: "_over_10_hour",
    }

    const sumParts = this.buildSumParts(columnTempMinMax, excursionDurations, columnDurationExcursion)
    const durationNormalExpression = this.buildDurationNormalExpression(tempMinMax, columnTempMinMax, excursionDurations, columnDurationExcursion)

    const wherePqs = ""

    return { sumParts, durationNormalExpression, wherePqs, columnTempMinMax }
  }

  private getColumnTempMinMax(tempMinMax: number) {
    return tempMinMax === 2
      ? [
        ["freq_excursion_over_min_15", "between_temp"],
        ["freq_excursion_over_min_0_5", "more_than_temp"],
      ]
      : [
        ["freq_excursion_below_min_0_5", "less_than_temp"],
        ["freq_excursion_between_2_min_0_5", "between_temp"],
        ["freq_excursion_over_8", "more_than_temp"],
      ]
  }

  private buildSumParts(
    columnTempMinMax: string[][],
    excursionDurations: number[],
    columnDurationExcursion: Record<number, string>
  ) {
    const sumParts: string[] = []
    for (const col of columnTempMinMax) {
      const itemSumPart: string[] = []
      const colName = col[0]!.replace("freq", "duration")
      const alias = `duration_${col[1]}`

      for (const durationId of excursionDurations) {
        const suffix = columnDurationExcursion[durationId]
        if (suffix) {
          itemSumPart.push(`dlm.${colName}${suffix}`)
        }
      }

      const sumExpr = itemSumPart.length > 0 ? `SUM(${itemSumPart.join(" + ")})` : "0"
      sumParts.push(`${sumExpr} AS ${alias}`)
    }
    return sumParts
  }

  private buildDurationNormalExpression(
    tempMinMax: number,
    columnTempMinMax: string[][],
    excursionDurations: number[],
    columnDurationExcursion: Record<number, string>
  ) {
    const totalDurationParts: string[] = []
    for (const col of columnTempMinMax) {
      if (tempMinMax === 2 && col[1] === "less_than_temp") continue;

      const colName = col[0]!.replace("freq", "duration")
      for (const durationId of excursionDurations) {
        const suffix = columnDurationExcursion[durationId]
        if (suffix) {
          totalDurationParts.push(`dlm.${colName}${suffix}`)
        }
      }
    }

    return totalDurationParts.length > 0
      ? `SUM(dlm.hour_online - (${totalDurationParts.join(" + ")}))`
      : `SUM(dlm.hour_online)`
  }

  private getGroupingAttributes(queryParams: AssetMonitoringDeviceQueryParams): {
    selectId: string
    selectName: string
    groupBy: string
  } {
    const hasEntityFilter =
      (queryParams.entity_id) ||
      (queryParams.entity_tag_ids && queryParams.entity_tag_ids.length > 0)

    if (hasEntityFilter) {
      return {
        selectId: "da.entity_id",
        selectName: "da.entity_name",
        groupBy: "da.entity_id, da.entity_name",
      }
    }

    if (queryParams.province_id && queryParams.regency_id) {
      return {
        selectId: "da.entity_id",
        selectName: "da.entity_name",
        groupBy: "da.entity_id, da.entity_name",
      }
    }

    if (queryParams.province_id && !queryParams.regency_id) {
      return {
        selectId: "toInt64(dlm.regency_id)",
        selectName: "dlm.regency_name",
        groupBy: "dlm.regency_id, dlm.regency_name",
      }
    }

    return {
      selectId: "toInt64(dlm.province_id)",
      selectName: "dlm.province_name",
      groupBy: "dlm.province_id, dlm.province_name",
    }
  }

  buildVaccineColdstorageQuery(
    queryParams: AssetMonitoringDeviceQueryParams
  ): string {
    let filter = this.buildEntityFilters(queryParams)

    const query = `
    WITH total_asset AS (
        SELECT
            count (DISTINCT da.id) total
        FROM
            datamart_assets_v5 da FINAL
            LEFT JOIN raw_asset_inventory_rtmds air FINAL ON da.id = air.asset_inventory_id
        WHERE
            da.deleted_at IS NULL
            AND has(da.asset_classifications_id, 1)
            AND da.status = 1
            ${filter}
    ),
    total_relation_rtmd AS (
        SELECT
            count (da.id) AS rtmd
        FROM
            raw_asset_inventory_rtmds air FINAL
            LEFT JOIN datamart_assets_v5 da FINAL ON da.id = air.asset_inventory_id
        WHERE
            da.deleted_at IS NULL
            AND has(da.asset_classifications_id, 1)
            AND da.status = 1
            ${filter}
    )
SELECT
    ta.total,
    trr.rtmd
FROM
    total_asset ta,
    total_relation_rtmd trr;    
    `
    return query.trim()
  }

  buildRtmdTotalQuery(queryParams: AssetMonitoringDeviceQueryParams): string {
    const filterRawEntity = this.buildRawEntityFilters(queryParams)
    const filterEntityAsset = this.buildEntityFilters(queryParams, true)

    const query = `
    WITH filtered_assets AS (
      SELECT
        count(air.id) AS total
      FROM raw_asset_rtmds air FINAL
      LEFT JOIN raw_entities da FINAL ON da.id = air.entity_id
        WHERE air.deleted_at IS NULL
          ${filterRawEntity}
    ),
    online_assets AS (
      SELECT
        count(DISTINCT dlm.asset_rtmd_id) online
      FROM datamart_logger_monitoring dlm FINAL
      LEFT JOIN raw_asset_inventory_rtmds air FINAL ON air.asset_rtmd_id = dlm.asset_rtmd_id
      LEFT JOIN datamart_assets_v5 da FINAL ON da.id = air.asset_inventory_id
        WHERE air.deleted_at IS NULL
        ${filterEntityAsset}
    )
    SELECT 
      fa.total,
      oa.online
    FROM filtered_assets fa, online_assets oa;    
    `
    return query.trim()
  }

  buildRtmdStatusQuery(queryParams: AssetMonitoringDeviceQueryParams): string {
    const filter = this.buildEntityFilters(queryParams)

    const { dateFilter, emptyResultCondition } = this.getFilterSevenDays(
      queryParams.from,
      queryParams.to
    )

    const query = `
      WITH monitoring_stats AS (
        SELECT 
          asset_inventory_id,
          argMax(asset_rtmd_min_temperature, logger_date) AS min_temp,
          argMax(asset_rtmd_max_temperature, logger_date) AS max_temp
        FROM datamart_logger_monitoring FINAL
        ${dateFilter}
        GROUP BY asset_inventory_id
      )
      SELECT 
        da.type_id AS id,
        da.asset_type_name AS asset_type,
        ROUND(IF(count(DISTINCT da.id) > 0, (count(DISTINCT ms.asset_inventory_id) / count(DISTINCT da.id)) * 100, 0), 2) AS online,
        ROUND(IF(count(DISTINCT da.id) > 0, ((count(DISTINCT da.id) - count(DISTINCT ms.asset_inventory_id)) / count(DISTINCT da.id)) * 100, 0), 2) AS offline,
        min(ms.min_temp) AS min_temp,
        max(ms.max_temp) AS max_temp,
        count(DISTINCT ms.asset_inventory_id) AS total_online,
        toInt64(count(DISTINCT da.id) - count(DISTINCT ms.asset_inventory_id)) AS total_offline,
        count(DISTINCT da.id) AS total
      FROM monitoring_stats ms
      RIGHT JOIN datamart_assets_v5 da FINAL ON da.id = ms.asset_inventory_id
      WHERE da.deleted_at IS NULL 
        AND has(da.asset_classifications_id, 1)
        AND da.status = 1
        ${filter}
        ${emptyResultCondition}
      GROUP BY da.type_id, da.asset_type_name
      ORDER BY da.type_id ASC
    `
    return query.trim()
  }

  buildAllRtmdStatusQuery(
    queryParams: AssetMonitoringDeviceQueryParams
  ): string {
    const filter = this.buildEntityFilters(queryParams)

    const query = `
      WITH latest_rtmd AS (
        SELECT 
          asset_rtmd_id,
          argMax(asset_rtmd_min_temperature, logger_date) AS asset_rtmd_min_temperature,
          argMax(asset_rtmd_max_temperature, logger_date) AS asset_rtmd_max_temperature,
          max(logger_date) AS last_seen
        FROM datamart_logger_monitoring FINAL
        WHERE toDate(logger_date) BETWEEN toDateTime({from:String}, 'Asia/Jakarta') 
                                      AND toDateTime({to:String}, 'Asia/Jakarta')
        GROUP BY asset_rtmd_id
      ),
      online_check AS (
        SELECT DISTINCT asset_rtmd_id
        FROM datamart_logger_monitoring FINAL
        WHERE toDate(logger_date, 'Asia/Jakarta') 
          BETWEEN toDate({from:String}) AND toDate({to:String})
      )
      SELECT 
        da.id AS asset_id,
        da.type_id AS type_id,
        da.asset_type_name AS asset_type,
        COALESCE(nullIf(lr.asset_rtmd_min_temperature, 0), 2) AS min_temp,
        COALESCE(nullIf(lr.asset_rtmd_max_temperature, 0), 8) AS max_temp,
        IF(oc.asset_rtmd_id IS NOT NULL, TRUE, FALSE) AS online
      FROM datamart_assets_v5 da FINAL
      INNER JOIN raw_asset_inventory_rtmds air FINAL ON da.id = air.asset_inventory_id
      LEFT JOIN latest_rtmd lr ON lr.asset_rtmd_id = air.asset_rtmd_id
      LEFT JOIN online_check oc ON oc.asset_rtmd_id = air.asset_rtmd_id
      WHERE da.deleted_at IS NULL
        AND has(da.asset_classifications_id, 1)
        AND da.status = 1
        ${filter}
      ORDER BY da.id DESC
      LIMIT 1000
    `
    return query.trim()
  }

  buildAvgOfflineDurationDailyQuery(
    queryParams: AssetMonitoringDeviceQueryParams
  ): string {
    const filter = this.buildEntityFilters(queryParams)

    const query = `
        WITH daily_avg_offline AS (
          SELECT 
            dlm.asset_inventory_id,
            dlm.logger_date,
            ROUND(AVG(dlm.hour_offline), 2) AS hour_offline
          FROM datamart_logger_monitoring dlm FINAL
          LEFT JOIN datamart_assets_v5 da FINAL ON da.id = dlm.asset_inventory_id
          WHERE dlm.asset_inventory_id IS NOT NULL
            AND has(da.asset_classifications_id, 1)
            AND da.status = 1
            AND da.deleted_at IS NULL
            AND toDate(dlm.logger_date, 'Asia/Jakarta') BETWEEN 
              toDate('${queryParams.from}') AND toDate('${queryParams.to}')
            ${filter}
          GROUP BY dlm.logger_date, dlm.asset_inventory_id
        )
        SELECT 
          logger_date,
          countIf(hour_offline < 1) AS total_less_than_one_hour,
          countIf(hour_offline >= 1 AND hour_offline <= 10) AS total_between_one_ten_hour,
          countIf(hour_offline > 10) AS total_more_than_ten_hour,
          ifNull(ROUND(avgIf(hour_offline, hour_offline < 1), 2), 0) AS less_than_one_hour,
          ifNull(ROUND(avgIf(hour_offline, hour_offline >= 1 AND hour_offline <= 10), 2), 0) AS between_one_ten_hour,
          ifNull(ROUND(avgIf(hour_offline, hour_offline > 10), 2), 0) AS more_than_ten_hour
        FROM daily_avg_offline
        GROUP BY logger_date
        ORDER BY logger_date ASC
    `
    return query.trim()
  }

  buildTotalEventsByCategoryQuery(
    queryParams: AssetMonitoringDeviceQueryParams
  ): string {
    const filter = this.buildEntityFilters(queryParams)
    const pqsFilter = this.buildPqsFilter(queryParams)
    const { lessThanTempFreq, betweenTempFreq, moreThanTempFreq } = this.buildFreqSumExpressions(queryParams)

    const query = `
      SELECT 
        dlm.week AS week,
        dlm.year AS year,
        SUM(${lessThanTempFreq}) AS less_than_temp,
        SUM(${betweenTempFreq}) AS between_temp,
        SUM(${moreThanTempFreq}) AS more_than_temp
      FROM datamart_logger_monitoring dlm FINAL
      INNER JOIN raw_asset_inventory_rtmds air FINAL ON air.asset_rtmd_id = dlm.asset_rtmd_id
      INNER JOIN datamart_assets_v5 da FINAL ON da.id = air.asset_inventory_id
      WHERE da.deleted_at IS NULL
        AND has(da.asset_classifications_id, 1)
        AND da.status = 1
        AND toDate(dlm.logger_date, 'Asia/Jakarta') BETWEEN 
          toDate('${queryParams.from}') AND toDate('${queryParams.to}')
        ${filter}
        ${pqsFilter}
      GROUP BY week, year
      ORDER BY year ASC, week ASC
    `
    return query.trim()
  }

  buildTotalEventsByAssetQuery(
    queryParams: AssetMonitoringDeviceQueryParams
  ): string {
    const filter = this.buildEntityFilters(queryParams)
    const pqsFilter = this.buildPqsFilter(queryParams)
    const { lessThanTempFreq, betweenTempFreq, moreThanTempFreq } = this.buildFreqSumExpressions(queryParams)

    const query = `
      SELECT 
        da.type_id AS id, 
        da.asset_type_name AS asset_type,
        dlm.asset_rtmd_min_temperature AS min_temp, 
        dlm.asset_rtmd_max_temperature AS max_temp, 
        SUM(dlm.less_than_temp) AS less_than_temp, 
        SUM(dlm.between_temp) AS between_temp, 
        SUM(dlm.more_than_temp) AS more_than_temp 
      FROM datamart_assets_v5 da FINAL
      INNER JOIN raw_asset_inventory_rtmds air FINAL ON air.asset_inventory_id = da.id 
      LEFT JOIN (
        SELECT 
          dlm.asset_rtmd_id, 
          dlm.asset_rtmd_min_temperature, 
          dlm.asset_rtmd_max_temperature, 
          SUM(${lessThanTempFreq}) AS less_than_temp, 
          SUM(${betweenTempFreq}) AS between_temp, 
          SUM(${moreThanTempFreq}) AS more_than_temp 
        FROM datamart_logger_monitoring dlm FINAL
        WHERE toDate(dlm.logger_date, 'Asia/Jakarta') BETWEEN 
          toDate('${queryParams.from}') AND toDate('${queryParams.to}')
        GROUP BY 
          dlm.asset_rtmd_id, 
          dlm.asset_rtmd_min_temperature, 
          dlm.asset_rtmd_max_temperature
      ) dlm ON dlm.asset_rtmd_id = air.asset_rtmd_id 
      WHERE da.deleted_at IS NULL 
        AND has(da.asset_classifications_id, 1)
        AND da.status = 1
        AND air.deleted_at IS NULL 
        ${filter}
        ${pqsFilter}
      GROUP BY 
        da.type_id,
        da.asset_type_name,
        dlm.asset_rtmd_min_temperature, 
        dlm.asset_rtmd_max_temperature 
      ORDER BY da.type_id DESC
    `
    return query.trim()
  }

  buildTotalAssetQuery(queryParams: AssetMonitoringDeviceQueryParams): string {
    const filter = this.buildEntityFilters(queryParams)
    const pqsFilter = this.buildPqsFilter(queryParams)
    const { lessThanTempFreq, betweenTempFreq, moreThanTempFreq } = this.buildFreqSumExpressions(queryParams)

    const query = `
      WITH weekly_excursions AS (
        SELECT 
          dlm.week AS week,
          dlm.year AS year,
          da.id AS asset_id,
          SUM(${lessThanTempFreq}) AS freq_below_min,
          SUM(${betweenTempFreq}) AS freq_between,
          SUM(${moreThanTempFreq}) AS freq_over
        FROM datamart_logger_monitoring dlm FINAL
        INNER JOIN raw_asset_inventory_rtmds air FINAL ON air.asset_rtmd_id = dlm.asset_rtmd_id
        INNER JOIN datamart_assets_v5 da FINAL ON da.id = air.asset_inventory_id
        WHERE da.deleted_at IS NULL
          AND has(da.asset_classifications_id, 1)
          AND da.status = 1
          AND toDate(dlm.logger_date, 'Asia/Jakarta') BETWEEN 
          toDate('${queryParams.from}') AND toDate('${queryParams.to}')
          ${filter}
          ${pqsFilter}
        GROUP BY week, year, da.id
      )
      SELECT 
        week,
        year,
        countIf(freq_below_min > 0) AS less_than_temp,
        countIf(freq_between > 0) AS between_temp,
        countIf(freq_over > 0) AS more_than_temp
      FROM weekly_excursions
      GROUP BY week, year
      ORDER BY year ASC, week ASC
    `
    return query.trim()
  }

  buildTotalEntitiesQuery(
    queryParams: AssetMonitoringDeviceQueryParams
  ): string {
    const filter = this.buildEntityFilters(queryParams)
    const pqsFilter = this.buildPqsFilter(queryParams)
    const { lessThanTempFreq, betweenTempFreq, moreThanTempFreq } = this.buildFreqSumExpressions(queryParams).buildWithPrefix("dlm.")

    const query = `
      WITH entity_excursions AS (
        SELECT
          dlm.entity_id,
          SUM(${lessThanTempFreq}) AS less_than_temp,
          SUM(${betweenTempFreq}) AS between_temp,
          SUM(${moreThanTempFreq}) AS more_than_temp
        FROM datamart_logger_monitoring dlm FINAL
        INNER JOIN raw_asset_inventory_rtmds air FINAL ON air.asset_rtmd_id = dlm.asset_rtmd_id
        INNER JOIN datamart_assets_v5 da FINAL ON da.id = air.asset_inventory_id
        WHERE da.deleted_at IS NULL
          AND has(da.asset_classifications_id, 1)
          AND da.status = 1
          AND toDate(dlm.logger_date, 'Asia/Jakarta') BETWEEN 
          toDate('${queryParams.from}') AND toDate('${queryParams.to}')
          ${filter}
          ${pqsFilter}
        GROUP BY dlm.entity_id
      ),
      aggregated_data AS (
        SELECT
          countIf(less_than_temp > 0) AS total_less_than_temp,
          countIf(between_temp > 0) AS total_between_temp,
          countIf(more_than_temp > 0) AS total_more_than_temp
        FROM entity_excursions
      )
      SELECT
        total_less_than_temp,
        total_between_temp,
        total_more_than_temp,
        total_less_than_temp + total_between_temp + total_more_than_temp AS total,
        if(total > 0, total_less_than_temp * 100.0 / total, 0) AS less_than_temp,
        if(total > 0, total_between_temp * 100.0 / total, 0) AS between_temp,
        if(total > 0, total_more_than_temp * 100.0 / total, 0) AS more_than_temp
      FROM aggregated_data
    `
    return query.trim()
  }

  buildTempStatusQuery(queryParams: AssetMonitoringDeviceQueryParams): string {
    const filter = this.buildEntityFilters(queryParams)
    const wherePqs = this.buildPqsFilter(queryParams)
    const { sumParts } = this.getExcursionFilters(queryParams)

    const generatedSumParts = sumParts.join(",\n          ")

    let finalSumParts = generatedSumParts;
    if (queryParams.temp_min_max === 2) {
      finalSumParts += ", 0 AS duration_less_than_temp"
    }

    const query = `
      WITH hour_diff_calc AS (
        SELECT date_diff('day', toDate('${queryParams.from}'), toDate('${queryParams.to}')) * 24 AS hour_diff
      ), 
      monitoring_agg AS (
        SELECT
          dlm.asset_inventory_id AS asset_inventory_id,
          dlm.entity_id AS entity_id,
          dlm.entity_name AS entity_name, 
          dlm.province_id AS province_id,
          dlm.province_name AS province_name,
          argMax(dlm.asset_rtmd_min_temperature, dlm.logger_date) AS asset_rtmd_min_temperature,
          argMax(dlm.asset_rtmd_max_temperature, dlm.logger_date) AS asset_rtmd_max_temperature,
          ${finalSumParts},
          SUM(dlm.hour_online) AS total_hour_online
        FROM datamart_logger_monitoring dlm FINAL
        INNER JOIN raw_asset_inventory_rtmds air FINAL ON air.asset_rtmd_id = dlm.asset_rtmd_id
        INNER JOIN datamart_assets_v5 da FINAL ON da.id = air.asset_inventory_id
        WHERE da.deleted_at IS NULL
          AND has(da.asset_classifications_id, 1)
          AND da.status = 1
          AND toDate(dlm.logger_date, 'Asia/Jakarta') BETWEEN 
            toDate('${queryParams.from}') AND toDate('${queryParams.to}')
          ${filter}
          ${wherePqs}
        GROUP BY
          dlm.asset_inventory_id, dlm.entity_id, dlm.entity_name, dlm.province_id, dlm.province_name
      ),
      monitoring_calc AS (
        SELECT
          ma.*,
          hd.hour_diff,
          GREATEST(0, ROUND(ma.total_hour_online - (ma.duration_less_than_temp + ma.duration_between_temp + ma.duration_more_than_temp), 2)) AS duration_normal_temp
        FROM monitoring_agg ma
        CROSS JOIN hour_diff_calc hd
      ),
      monitoring_final AS (
        SELECT
          mc.*,
          mc.hour_diff - (mc.duration_normal_temp + mc.duration_less_than_temp + mc.duration_between_temp + mc.duration_more_than_temp) AS offline
        FROM monitoring_calc mc
      )
      SELECT 
        COALESCE(toInt64(mf.province_id), mf.entity_id) AS entity_id,
        COALESCE(mf.province_name, entity_name) AS name,
        ROUND(IF(any(mf.hour_diff) > 0, (AVG(toFloat64(mf.offline)) / any(mf.hour_diff)) * 100, 0), 2) AS offline,
        COUNT(mf.asset_inventory_id) AS rtmd,
        COUNT(DISTINCT mf.entity_id) AS entities,
        any(mf.hour_diff) AS hour_diff,
        COALESCE(ROUND(AVG(toFloat64(mf.offline)), 2), toFloat64(any(mf.hour_diff))) AS duration_offline,
        COALESCE(ROUND(AVG(toFloat64(mf.duration_normal_temp)), 2), 0) AS duration_normal_temp,
        COALESCE(ROUND(AVG(toFloat64(mf.duration_less_than_temp)), 2), 0) AS duration_less_than_temp,
        COALESCE(ROUND(AVG(toFloat64(mf.duration_between_temp)), 2), 0) AS duration_between_temp,
        COALESCE(ROUND(AVG(toFloat64(mf.duration_more_than_temp)), 2), 0) AS duration_more_than_temp,
        COALESCE(ROUND(AVG(toFloat64(mf.duration_normal_temp)), 2), 0) AS normal_temp,
        COALESCE(ROUND(AVG(toFloat64(mf.duration_less_than_temp)), 2), 0) AS less_than_temp,
        COALESCE(ROUND(AVG(toFloat64(mf.duration_between_temp)), 2), 0) AS between_temp,
        COALESCE(ROUND(AVG(toFloat64(mf.duration_more_than_temp)), 2), 0) AS more_than_temp
      FROM monitoring_final mf
      GROUP BY 1, 2
    `
    return query.trim()
  }

  buildExportDataQuery(queryParams: AssetMonitoringDeviceQueryParams): string {
    const filter = this.buildEntityFilters(queryParams)
    const wherePqs = this.buildPqsFilter(queryParams)
    const { sumParts } = this.getExcursionFilters(queryParams)

    const generatedSumParts = sumParts.join(",\n          ")

    let finalSumParts = generatedSumParts;
    if (queryParams.temp_min_max === 2) {
      finalSumParts += ", 0 AS duration_less_than_temp"
    }

    const query = `
      WITH hour_diff_calc AS (
        SELECT date_diff('day', toDate('${queryParams.from}'), toDate('${queryParams.to}')) * 24 AS hour_diff
      ), 
      monitoring_agg AS (
        SELECT
          dlm.asset_inventory_id AS asset_inventory_id,
          dlm.entity_id AS entity_id,
          dlm.entity_name AS entity_name, 
          dlm.province_id AS province_id,
          dlm.province_name AS province_name,
          arrayStringConcat(groupUniqArray(da.asset_type_name), ', ') as tags,
          argMax(dlm.asset_rtmd_min_temperature, dlm.logger_date) AS asset_rtmd_min_temperature,
          argMax(dlm.asset_rtmd_max_temperature, dlm.logger_date) AS asset_rtmd_max_temperature,
          ${finalSumParts},
          SUM(dlm.hour_online) AS total_hour_online
        FROM datamart_logger_monitoring dlm FINAL
        INNER JOIN raw_asset_inventory_rtmds air FINAL ON air.asset_rtmd_id = dlm.asset_rtmd_id
        INNER JOIN datamart_assets_v5 da FINAL ON da.id = air.asset_inventory_id
        WHERE da.deleted_at IS NULL
          AND has(da.asset_classifications_id, 1)
          AND da.status = 1
          AND toDate(dlm.logger_date, 'Asia/Jakarta') BETWEEN 
            toDate('${queryParams.from}') AND toDate('${queryParams.to}')
          ${filter}
          ${wherePqs}
        GROUP BY
          dlm.asset_inventory_id, dlm.entity_id, dlm.entity_name, dlm.province_id, dlm.province_name
      ),
      monitoring_calc AS (
        SELECT
          ma.*,
          hd.hour_diff,
          GREATEST(0, ROUND(ma.total_hour_online - (ma.duration_less_than_temp + ma.duration_between_temp + ma.duration_more_than_temp), 2)) AS duration_normal_temp
        FROM monitoring_agg ma
        CROSS JOIN hour_diff_calc hd
      ),
      monitoring_final AS (
        SELECT
          mc.*,
          mc.hour_diff - (mc.duration_normal_temp + mc.duration_less_than_temp + mc.duration_between_temp + mc.duration_more_than_temp) AS offline
        FROM monitoring_calc mc
      )
      SELECT 
        COALESCE(toInt64(mf.province_id), mf.entity_id) AS entity_id,
        COALESCE(mf.province_name, entity_name) AS name,
        mf.province_name,
        '-' as regency_name, -- Safe placeholder
        tags as entity_tags,
        ROUND(IF(any(mf.hour_diff) > 0, (AVG(toFloat64(mf.offline)) / any(mf.hour_diff)) * 100, 0), 2) AS offline,
        COUNT(mf.asset_inventory_id) AS rtmd,
        COUNT(DISTINCT mf.entity_id) AS entities,
        any(mf.hour_diff) AS hour_diff,
        COALESCE(ROUND(AVG(toFloat64(mf.offline)), 2), toFloat64(any(mf.hour_diff))) AS duration_offline,
        COALESCE(ROUND(AVG(toFloat64(mf.duration_normal_temp)), 2), 0) AS duration_normal_temp,
        COALESCE(ROUND(AVG(toFloat64(mf.duration_less_than_temp)), 2), 0) AS duration_less_than_temp,
        COALESCE(ROUND(AVG(toFloat64(mf.duration_between_temp)), 2), 0) AS duration_between_temp,
        COALESCE(ROUND(AVG(toFloat64(mf.duration_more_than_temp)), 2), 0) AS duration_more_than_temp,
        COALESCE(ROUND(AVG(toFloat64(mf.duration_normal_temp)), 2), 0) AS normal_temp,
        COALESCE(ROUND(AVG(toFloat64(mf.duration_less_than_temp)), 2), 0) AS less_than_temp,
        COALESCE(ROUND(AVG(toFloat64(mf.duration_between_temp)), 2), 0) AS between_temp,
        COALESCE(ROUND(AVG(toFloat64(mf.duration_more_than_temp)), 2), 0) AS more_than_temp
      FROM monitoring_final mf
      GROUP BY 1, 2, 3, 4, 5
    `
    return query.trim()
  }
}
