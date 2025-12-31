// Logger Monitoring Query Builder for ClickHouse

export class LoggerMonitoringQuery {
  /**
   * Build query for Summary Asset data (CCE and Logger status by week)
   * Source: dashboard_logger_summary_asset table
   */
  buildSummaryAssetQuery(
    year: number,
    provinceId?: number,
    regencyId?: number
  ): string {
    const whereClause = this.buildWhereClause(year, provinceId, regencyId)

    return `
      SELECT 
        province_id,
        province_name,
        regency_id,
        regency_name,
        week,
        month,
        year,
        SUM(cce_registered_with_smile) AS cce_registered_with_smile,
        SUM(cce_functional_status) AS cce_functional_status,
        SUM(cce_broken_and_under_repair_status) AS cce_broken_and_under_repair_status,
        SUM(cce_broken_and_need_repair_status) AS cce_broken_and_need_repair_status,
        SUM(cce_broken_and_cannot_be_repaire_status) AS cce_broken_and_cannot_be_repaire_status,
        SUM(cce_functional_status_related_to_logger) AS cce_functional_status_related_to_logger,
        SUM(logger_active_on_smile) AS logger_active_on_smile,
        SUM(logger_releted_at_cce) AS logger_releted_at_cce,
        SUM(logger_not_releted_at_cce) AS logger_not_releted_at_cce
      FROM dashboard_logger_summary_asset FINAL
      WHERE ${whereClause}
      GROUP BY province_id, province_name, regency_id, regency_name, week, month, year
      ORDER BY week
    `
  }

  /**
   * Build query for Summary data (Logger connectivity and excursion metrics)
   * Source: dashboard_logger_summary table
   */
  buildSummaryQuery(
    year: number,
    provinceId?: number,
    regencyId?: number
  ): string {
    const whereClause = this.buildWhereClause(year, provinceId, regencyId)

    return `
      SELECT 
        week,
        SUM(logger_that_send_data) AS logger_that_send_data,
        SUM(logger_online_twenty_four_hours) AS logger_online_twenty_four_hours,
        SUM(logger_was_once_offline) AS logger_was_once_offline,
        SUM(logger_offline_under_one_hours) AS logger_offline_under_one_hours,
        SUM(logger_offline_one_until_ten_hours) AS logger_offline_one_until_ten_hours,
        SUM(logger_offline_over_ten_hours) AS logger_offline_over_ten_hours,
        SUM(facilities_with_reported_excursion_incident) AS facilities_with_reported_excursion_incident,
        SUM(facilities_with_no_reported_excursion_incident) AS facilities_with_no_reported_excursion_incident,
        SUM(facilities_with_reported_low_temperature_excursion) AS facilities_with_reported_low_temperature_excursion,
        SUM(facilities_with_reported_high_temperature_excursion) AS facilities_with_reported_high_temperature_excursion,
        SUM(freq_facility_excursion_over_8_cce) AS freq_facility_excursion_over_8_cce,
        SUM(freq_facility_excursion_between_2_min_0_5_cce) AS freq_facility_excursion_between_2_min_0_5_cce,
        SUM(freq_facility_excursion_below_min_0_5_cce) AS freq_facility_excursion_below_min_0_5_cce,
        SUM(freq_facility_excursion_over_min_15_cce) AS freq_facility_excursion_over_min_15_cce,
        SUM(freq_facility_excursion_over_min_0_5_cce) AS freq_facility_excursion_over_min_0_5_cce,
        SUM(freq_facility_excursion_below_2_cce) AS freq_facility_excursion_below_2_cce,
        SUM(freq_excursion_over_8_cce_cat_1) AS freq_excursion_over_8_cce_cat_1,
        SUM(freq_excursion_over_8_cce_cat_2) AS freq_excursion_over_8_cce_cat_2,
        SUM(freq_excursion_over_8_cce_cat_3) AS freq_excursion_over_8_cce_cat_3,
        SUM(freq_excursion_between_2_min_0_5_cce_cat_1) AS freq_excursion_between_2_min_0_5_cce_cat_1,
        SUM(freq_excursion_between_2_min_0_5_cce_cat_2) AS freq_excursion_between_2_min_0_5_cce_cat_2,
        SUM(freq_excursion_between_2_min_0_5_cce_cat_3) AS freq_excursion_between_2_min_0_5_cce_cat_3,
        SUM(freq_excursion_below_min_0_5_cce_cat_1) AS freq_excursion_below_min_0_5_cce_cat_1,
        SUM(freq_excursion_below_min_0_5_cce_cat_2) AS freq_excursion_below_min_0_5_cce_cat_2,
        SUM(freq_excursion_below_min_0_5_cce_cat_3) AS freq_excursion_below_min_0_5_cce_cat_3,
        SUM(freq_excursion_over_min_15_cce_cat_1) AS freq_excursion_over_min_15_cce_cat_1,
        SUM(freq_excursion_over_min_15_cce_cat_2) AS freq_excursion_over_min_15_cce_cat_2,
        SUM(freq_excursion_over_min_15_cce_cat_3) AS freq_excursion_over_min_15_cce_cat_3,
        SUM(freq_excursion_over_min_0_5_cce_cat_1) AS freq_excursion_over_min_0_5_cce_cat_1,
        SUM(freq_excursion_over_min_0_5_cce_cat_2) AS freq_excursion_over_min_0_5_cce_cat_2,
        SUM(freq_excursion_over_min_0_5_cce_cat_3) AS freq_excursion_over_min_0_5_cce_cat_3,
        SUM(freq_excursion_over_8_sum) AS freq_excursion_over_8_sum,
        SUM(freq_excursion_over_8_sum_cat_1) AS freq_excursion_over_8_sum_cat_1,
        SUM(freq_excursion_over_8_sum_cat_2) AS freq_excursion_over_8_sum_cat_2,
        SUM(freq_excursion_over_8_sum_cat_3) AS freq_excursion_over_8_sum_cat_3,
        SUM(freq_excursion_between_2_min_0_5_sum) AS freq_excursion_between_2_min_0_5_sum,
        SUM(freq_excursion_between_2_min_0_5_sum_cat_1) AS freq_excursion_between_2_min_0_5_sum_cat_1,
        SUM(freq_excursion_between_2_min_0_5_sum_cat_2) AS freq_excursion_between_2_min_0_5_sum_cat_2,
        SUM(freq_excursion_between_2_min_0_5_sum_cat_3) AS freq_excursion_between_2_min_0_5_sum_cat_3,
        SUM(freq_excursion_below_min_0_5_sum) AS freq_excursion_below_min_0_5_sum,
        SUM(freq_excursion_below_min_0_5_sum_cat_1) AS freq_excursion_below_min_0_5_sum_cat_1,
        SUM(freq_excursion_below_min_0_5_sum_cat_2) AS freq_excursion_below_min_0_5_sum_cat_2,
        SUM(freq_excursion_below_min_0_5_sum_cat_3) AS freq_excursion_below_min_0_5_sum_cat_3,
        SUM(freq_excursion_over_min_15_sum) AS freq_excursion_over_min_15_sum,
        SUM(freq_excursion_over_min_15_sum_cat_1) AS freq_excursion_over_min_15_sum_cat_1,
        SUM(freq_excursion_over_min_15_sum_cat_2) AS freq_excursion_over_min_15_sum_cat_2,
        SUM(freq_excursion_over_min_15_sum_cat_3) AS freq_excursion_over_min_15_sum_cat_3,
        SUM(freq_excursion_over_min_0_5_sum) AS freq_excursion_over_min_0_5_sum,
        SUM(freq_excursion_over_min_0_5_sum_cat_1) AS freq_excursion_over_min_0_5_sum_cat_1,
        SUM(freq_excursion_over_min_0_5_sum_cat_2) AS freq_excursion_over_min_0_5_sum_cat_2,
        SUM(freq_excursion_over_min_0_5_sum_cat_3) AS freq_excursion_over_min_0_5_sum_cat_3
      FROM dashboard_logger_summary FINAL
      WHERE ${whereClause}
      GROUP BY week
      ORDER BY week
    `
  }

  /**
   * Build query for Excursion CCE Count (distinct CCE with/without excursions)
   * Source: datamart_logger_monitoring table
   */
  buildExcursionCCECountQuery(
    year: number,
    provinceId?: number,
    regencyId?: number
  ): string {
    const whereClause = this.buildWhereClause(year, provinceId, regencyId)

    return `
      SELECT 
        week,
        COUNT(DISTINCT CASE 
          WHEN (freq_excursion_over_8 > 0 
            OR freq_excursion_between_2_min_0_5 > 0 
            OR freq_excursion_below_min_0_5 > 0 
            OR freq_excursion_over_min_15 > 0 
            OR freq_excursion_over_min_0_5 > 0 
            OR freq_excursion_below_min_2 > 0)
          THEN asset_inventory_id 
        END) AS cce_with_excursion_events,
        COUNT(DISTINCT CASE 
          WHEN (freq_excursion_over_8 = 0 
            AND freq_excursion_between_2_min_0_5 = 0 
            AND freq_excursion_below_min_0_5 = 0 
            AND freq_excursion_over_min_15 = 0 
            AND freq_excursion_over_min_0_5 = 0 
            AND freq_excursion_below_min_2 = 0)
          THEN asset_inventory_id 
        END) AS cce_without_excursion_events
      FROM datamart_logger_monitoring FINAL
      WHERE ${whereClause}
      GROUP BY week
      ORDER BY week
    `
  }

  /**
   * Build query for Daily logger data
   * Source: datamart_logger_monitoring table
   */
  buildDailyQuery(
    startDate: string,
    endDate: string,
    provinceId?: number,
    regencyId?: number,
    month?: number,
    year?: number
  ): string {
    let whereClause = `logger_date BETWEEN toDate('${startDate}') AND toDate('${endDate}')`

    if (month !== undefined && year !== undefined) {
      whereClause = `month = ${month} AND year = ${year}`
    }

    if (provinceId) {
      whereClause += ` AND province_id = '${provinceId}'`
    }

    if (regencyId) {
      whereClause += ` AND regency_id = '${regencyId}'`
    }

    return `
      SELECT 
        province_name,
        regency_name,
        entity_id,
        entity_name,
        entity_type,
        asset_rtmd_id,
        asset_rtmd_type_name,
        asset_inventory_model_name,
        asset_rtmd_min_temperature,
        asset_rtmd_max_temperature,
        asset_rtmd_serial_number,
        manufacture_name,
        asset_rtmd_vendor_name,
        toString(logger_date) AS logger_date,
        week,
        daily_data_sent,
        toString(max_datetime) AS max_datetime,
        toString(min_datetime) AS min_datetime,
        hour_online,
        hour_offline,
        category_hour_offline,
        weekly_offline_category,
        excursion_type,
        freq_excursion_over_8,
        duration_excursion_over_8,
        freq_excursion_over_8_below_1_hour,
        duration_excursion_over_8_below_1_hour,
        freq_excursion_over_8_between_1_until_10_hour,
        duration_excursion_over_8_between_1_until_10_hour,
        freq_excursion_over_8_over_10_hour,
        duration_excursion_over_8_over_10_hour,
        freq_excursion_between_2_min_0_5,
        duration_excursion_between_2_min_0_5,
        freq_excursion_between_2_min_0_5_below_1_hour,
        duration_excursion_between_2_min_0_5_below_1_hour,
        freq_excursion_between_2_min_0_5_between_1_until_10_hour,
        duration_excursion_between_2_min_0_5_between_1_until_10_hour,
        freq_excursion_between_2_min_0_5_over_10_hour,
        duration_excursion_between_2_min_0_5_over_10_hour,
        freq_excursion_below_min_0_5,
        duration_excursion_below_min_0_5,
        freq_excursion_below_min_0_5_below_1_hour,
        duration_excursion_below_min_0_5_below_1_hour,
        freq_excursion_below_min_0_5_between_1_until_10_hour,
        duration_excursion_below_min_0_5_between_1_until_10_hour,
        freq_excursion_below_min_0_5_over_10_hour,
        duration_excursion_below_min_0_5_over_10_hour,
        freq_excursion_over_min_15,
        duration_excursion_over_min_15,
        freq_excursion_over_min_15_below_1_hour,
        duration_excursion_over_min_15_below_1_hour,
        freq_excursion_over_min_15_between_1_until_10_hour,
        duration_excursion_over_min_15_between_1_until_10_hour,
        freq_excursion_over_min_15_over_10_hour,
        duration_excursion_over_min_15_over_10_hour,
        freq_excursion_over_min_0_5,
        duration_excursion_over_min_0_5,
        freq_excursion_over_min_0_5_below_1_hour,
        duration_excursion_over_min_0_5_below_1_hour,
        freq_excursion_over_min_0_5_between_1_until_10_hour,
        duration_excursion_over_min_0_5_between_1_until_10_hour,
        freq_excursion_over_min_0_5_over_10_hour,
        duration_excursion_over_min_0_5_over_10_hour,
        freq_excursion_below_min_2,
        duration_excursion_below_min_2,
        freq_excursion_below_min_2_below_1_hour,
        duration_excursion_below_min_2_below_1_hour,
        freq_excursion_below_min_2_between_1_until_10_hour,
        duration_excursion_below_min_2_between_1_until_10_hour,
        freq_excursion_below_min_2_over_10_hour,
        duration_excursion_below_min_2_over_10_hour
      FROM datamart_logger_monitoring FINAL
      WHERE ${whereClause}
    `
  }

  /**
   * Get logger info (all records)
   * Source: dashboard_info_logger table
   */
  buildLoggerInfoQuery(provinceId?: number, regencyId?: number): string {
    let whereClause = "1=1"

    if (provinceId) {
      whereClause += ` AND province_id = ${provinceId}`
    }

    if (regencyId) {
      whereClause += ` AND regency_id = ${regencyId}`
    }

    return `
      SELECT 
        province_name,
        regency_name,
        entity_id,
        entity_name,
        entity_type,
        id_coldstorage AS asset_inventory_id,
        type_coldstorage AS asset_inventory_asset_type_name,
        model_coldstorage AS asset_inventory_model_name,
        manufacture_name_coldstorage AS asset_inventory_manufacture_name,
        working_status_coldstorage AS asset_inventory_working_status_id,
        CASE 
          WHEN working_status_coldstorage = 1 THEN 'Functional'
          WHEN working_status_coldstorage = 2 THEN 'Broken - Under Repair'
          WHEN working_status_coldstorage = 3 THEN 'Broken - Need Repair'
          WHEN working_status_coldstorage = 4 THEN 'Broken - Cannot be Repaired'
          ELSE 'Unknown'
        END AS working_status,
        id_logger AS asset_rtmd_id,
        model_logger AS asset_model_name,
        asset_rtmd_serial_number AS serial_number,
        lattitude AS lat,
        longitude AS lng,
        manufacture_name_coldstorage AS manufacture_name,
        asset_status_active AS status,
        tahun_anggaran AS budget_year,
        toString(created_at) AS created_at,
        toString(updated_at) AS updated_at
      FROM dashboard_info_logger FINAL
      WHERE ${whereClause}
    `
  }

  /**
   * Build query to check if logger sent data in period
   * Source: datamart_logger_monitoring table
   */
  buildLoggerMonitoringCheckQuery(
    startDate: string,
    endDate: string,
    assetRtmdId: number
  ): string {
    return `
      SELECT asset_rtmd_id
      FROM datamart_logger_monitoring FINAL
      WHERE logger_date BETWEEN toDate('${startDate}') AND toDate('${endDate}')
        AND asset_rtmd_id = ${assetRtmdId}
      LIMIT 1
    `
  }

  /**
   * Helper: Build WHERE clause for year and location filtering
   */
  private buildWhereClause(
    year: number,
    provinceId?: number,
    regencyId?: number
  ): string {
    let whereClause = `year = ${year}`

    if (provinceId) {
      whereClause += ` AND province_id = '${provinceId}'`
    }

    if (regencyId) {
      whereClause += ` AND regency_id = '${regencyId}'`
    }

    return whereClause
  }
}
