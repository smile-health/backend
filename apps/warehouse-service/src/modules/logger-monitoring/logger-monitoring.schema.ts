// Logger Monitoring Schema Definitions

// Summary Asset Sheet - CCE and Logger Status by Week
export interface LoggerMonitoringSummaryAssetDTO {
  province_id: number
  province_name: string
  regency_id: number
  regency_name: string
  week: number
  month: number
  year: number
  cce_registered_with_smile: number
  cce_functional_status: number
  cce_broken_and_under_repair_status: number
  cce_broken_and_need_repair_status: number
  cce_broken_and_cannot_be_repaire_status: number
  cce_functional_status_related_to_logger: number
  logger_active_on_smile: number
  logger_releted_at_cce: number
  logger_not_releted_at_cce: number
}

// Summary Sheet - Logger Connectivity and Excursion Metrics by Week
export interface LoggerMonitoringSummaryDTO {
  week: number
  logger_that_send_data: number
  logger_online_twenty_four_hours: number
  logger_was_once_offline: number
  logger_offline_under_one_hours: number
  logger_offline_one_until_ten_hours: number
  logger_offline_over_ten_hours: number
  facilities_with_reported_excursion_incident: number
  facilities_with_no_reported_excursion_incident: number
  facilities_with_reported_low_temperature_excursion: number
  facilities_with_reported_high_temperature_excursion: number
  freq_facility_excursion_over_8_cce: number
  freq_facility_excursion_between_2_min_0_5_cce: number
  freq_facility_excursion_below_min_0_5_cce: number
  freq_facility_excursion_over_min_15_cce: number
  freq_facility_excursion_over_min_0_5_cce: number
  freq_facility_excursion_below_2_cce: number
  freq_excursion_over_8_cce_cat_1: number
  freq_excursion_over_8_cce_cat_2: number
  freq_excursion_over_8_cce_cat_3: number
  freq_excursion_between_2_min_0_5_cce_cat_1: number
  freq_excursion_between_2_min_0_5_cce_cat_2: number
  freq_excursion_between_2_min_0_5_cce_cat_3: number
  freq_excursion_below_min_0_5_cce_cat_1: number
  freq_excursion_below_min_0_5_cce_cat_2: number
  freq_excursion_below_min_0_5_cce_cat_3: number
  freq_excursion_over_min_15_cce_cat_1: number
  freq_excursion_over_min_15_cce_cat_2: number
  freq_excursion_over_min_15_cce_cat_3: number
  freq_excursion_over_min_0_5_cce_cat_1: number
  freq_excursion_over_min_0_5_cce_cat_2: number
  freq_excursion_over_min_0_5_cce_cat_3: number
  freq_excursion_over_8_sum: number
  freq_excursion_over_8_sum_cat_1: number
  freq_excursion_over_8_sum_cat_2: number
  freq_excursion_over_8_sum_cat_3: number
  freq_excursion_between_2_min_0_5_sum: number
  freq_excursion_between_2_min_0_5_sum_cat_1: number
  freq_excursion_between_2_min_0_5_sum_cat_2: number
  freq_excursion_between_2_min_0_5_sum_cat_3: number
  freq_excursion_below_min_0_5_sum: number
  freq_excursion_below_min_0_5_sum_cat_1: number
  freq_excursion_below_min_0_5_sum_cat_2: number
  freq_excursion_below_min_0_5_sum_cat_3: number
  freq_excursion_over_min_15_sum: number
  freq_excursion_over_min_15_sum_cat_1: number
  freq_excursion_over_min_15_sum_cat_2: number
  freq_excursion_over_min_15_sum_cat_3: number
  freq_excursion_over_min_0_5_sum: number
  freq_excursion_over_min_0_5_sum_cat_1: number
  freq_excursion_over_min_0_5_sum_cat_2: number
  freq_excursion_over_min_0_5_sum_cat_3: number
}

// Daily Sheet - Detailed Daily Logger Records
export interface LoggerMonitoringDailyDTO {
  province_name: string
  regency_name: string
  entity_id: number
  entity_name: string
  entity_type: number
  asset_rtmd_id: number
  asset_rtmd_type_name: string
  asset_inventory_model_name: string
  asset_rtmd_min_temperature: number
  asset_rtmd_max_temperature: number
  asset_rtmd_serial_number: string
  manufacture_name: string
  asset_rtmd_vendor_name: string
  logger_date: string
  week: number
  daily_data_sent: number
  max_datetime: string
  min_datetime: string
  hour_online: number
  hour_offline: number
  category_hour_offline: string
  weekly_offline_category: string
  excursion_type: string
  freq_excursion_over_8: number
  duration_excursion_over_8: number
  freq_excursion_over_8_below_1_hour: number
  duration_excursion_over_8_below_1_hour: number
  freq_excursion_over_8_between_1_until_10_hour: number
  duration_excursion_over_8_between_1_until_10_hour: number
  freq_excursion_over_8_over_10_hour: number
  duration_excursion_over_8_over_10_hour: number
  freq_excursion_between_2_min_0_5: number
  duration_excursion_between_2_min_0_5: number
  freq_excursion_between_2_min_0_5_below_1_hour: number
  duration_excursion_between_2_min_0_5_below_1_hour: number
  freq_excursion_between_2_min_0_5_between_1_until_10_hour: number
  duration_excursion_between_2_min_0_5_between_1_until_10_hour: number
  freq_excursion_between_2_min_0_5_over_10_hour: number
  duration_excursion_between_2_min_0_5_over_10_hour: number
  freq_excursion_below_min_0_5: number
  duration_excursion_below_min_0_5: number
  freq_excursion_below_min_0_5_below_1_hour: number
  duration_excursion_below_min_0_5_below_1_hour: number
  freq_excursion_below_min_0_5_between_1_until_10_hour: number
  duration_excursion_below_min_0_5_between_1_until_10_hour: number
  freq_excursion_below_min_0_5_over_10_hour: number
  duration_excursion_below_min_0_5_over_10_hour: number
  freq_excursion_over_min_15: number
  duration_excursion_over_min_15: number
  freq_excursion_over_min_15_below_1_hour: number
  duration_excursion_over_min_15_below_1_hour: number
  freq_excursion_over_min_15_between_1_until_10_hour: number
  duration_excursion_over_min_15_between_1_until_10_hour: number
  freq_excursion_over_min_15_over_10_hour: number
  duration_excursion_over_min_15_over_10_hour: number
  freq_excursion_over_min_0_5: number
  duration_excursion_over_min_0_5: number
  freq_excursion_over_min_0_5_below_1_hour: number
  duration_excursion_over_min_0_5_below_1_hour: number
  freq_excursion_over_min_0_5_between_1_until_10_hour: number
  duration_excursion_over_min_0_5_between_1_until_10_hour: number
  freq_excursion_over_min_0_5_over_10_hour: number
  duration_excursion_over_min_0_5_over_10_hour: number
  freq_excursion_below_min_2: number
  duration_excursion_below_min_2: number
  freq_excursion_below_min_2_below_1_hour: number
  duration_excursion_below_min_2_below_1_hour: number
  freq_excursion_below_min_2_between_1_until_10_hour: number
  duration_excursion_below_min_2_between_1_until_10_hour: number
  freq_excursion_below_min_2_over_10_hour: number
  duration_excursion_below_min_2_over_10_hour: number
}

// Logger Info Sheet - Asset Master Data
export interface LoggerInfoDTO {
  province_name: string
  regency_name: string
  entity_id: number
  entity_name: string
  entity_type: number
  asset_inventory_id: number
  asset_inventory_asset_type_name: string
  asset_inventory_model_name: string
  asset_inventory_manufacture_name: string
  asset_inventory_working_status_id: number
  working_status: string
  asset_rtmd_id: number | null
  asset_model_name: string | null
  serial_number: string | null
  lat: string | null
  lng: string | null
  manufacture_name: string | null
  status: number | null
  budget_year: number | null
  created_at: string
  updated_at: string
  status_data_temp?: string
}

// Excursion CCE Count - Distinct CCE with/without excursions
export interface ExcursionCCECountDTO {
  week: number
  cce_with_excursion_events: number
  cce_without_excursion_events: number
}

// Location names for filtering
export interface LocationNamesDTO {
  province?: string
  regency?: string
}
