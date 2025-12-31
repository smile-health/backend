/**
 * Vaccine Needs Calculator
 *
 * Calculates vaccine vial requirements based on target populations and utilization rates.
 * Formula references from immunization logistics planning documents.
 */

import type {
  VaccineCalculationInput,
  VaccineVialsNeeded,
  MonthlyStockByVaccine,
  MonthlyVaccineStock,
  UtilizationRates,
  VaccineLogisticsNeeds,
} from "./immunization-logistics.schema.js"

export function safeDiv(numerator: number, denominator: number): number {
  return denominator > 0 ? numerator / denominator : 0
}

export function calcVialNeed(target: number, rate: number): number {
  return rate > 0 ? Math.round(target / rate) + 1 : 1
}

export function calcVialNeedNoBuffer(target: number, rate: number): number {
  return rate > 0 ? Math.round(safeDiv(target, rate) * 100) / 100 : 0
}

/**
 * Calculates vaccine vial needs for one year based on target populations and previous year data
 *
 * @param input - Target populations and previous year immunization data
 * @returns Calculated vaccine vial needs for each vaccine type
 *
 * @example
 * const input = {
 *   target_bbl: 150,
 *   target_si: 140,
 *   target_baduta: 280,
 *   target_wus: 1000,
 *   previous_year_data: {
 *     absolute: {
 *       hb0: 150,
 *       bcg: 100,
 *       bopv_total_capaian_1_sd_4: 150,
 *       ipv_total_capaian_1_dan_2: 100,
 *       pcv_total_capaian_1_sd_3: 180,
 *       dpt_hb_hib_total_capaian_1_sd_4: 150,
 *       mr_1_dan_mr_2: 150,
 *       rotavirus_total_capaian_1_sd_3: 175,
 *       td: 200
 *     },
 *     vial: {
 *       hb0: 150,
 *       bcg: 16,
 *       bopv_total_capaian_1_sd_4: 20,
 *       ipv_total_capaian_1_dan_2: 19,
 *       pcv_total_capaian_1_sd_3: 18,
 *       dpt_hb_hib_total_capaian_1_sd_4: 16,
 *       mr_1_dan_mr_2: 20,
 *       rotavirus_total_capaian_1_sd_3: 19,
 *       td: 30
 *     }
 *   }
 * }
 * const needs = calculateVaccineVialsNeeded(input)
 */
export function calculateVaccineVialsNeeded({
  target_bbl,
  target_si,
  target_baduta,
  target_wus,
  previous_year_data: { absolute, vial },
}: VaccineCalculationInput): VaccineVialsNeeded {
  const rate = {
    hb0: safeDiv(absolute.hb0, vial.hb0),
    bcg: safeDiv(absolute.bcg, vial.bcg),
    opv: safeDiv(
      absolute.bopv_total_capaian_1_sd_4,
      vial.bopv_total_capaian_1_sd_4
    ),
    ipv: safeDiv(
      absolute.ipv_total_capaian_1_dan_2,
      vial.ipv_total_capaian_1_dan_2
    ),
    pcv: safeDiv(
      absolute.pcv_total_capaian_1_sd_3,
      vial.pcv_total_capaian_1_sd_3
    ),
    dpt: safeDiv(
      absolute.dpt_hb_hib_total_capaian_1_sd_4,
      vial.dpt_hb_hib_total_capaian_1_sd_4
    ),
    mr: safeDiv(absolute.mr_1_dan_mr_2, vial.mr_1_dan_mr_2),
    rv: safeDiv(
      absolute.rotavirus_total_capaian_1_sd_3,
      vial.rotavirus_total_capaian_1_sd_3
    ),
    td: safeDiv(absolute.td, vial.td),
  }

  return {
    hb0: calcVialNeedNoBuffer(target_bbl, rate.hb0),
    bcg: calcVialNeedNoBuffer(target_bbl, rate.bcg),
    bopv: calcVialNeed(target_si + target_baduta, rate.opv),
    ipv: calcVialNeed(target_si * 2, rate.ipv),
    pcv: calcVialNeed(target_si * 2 + target_baduta, rate.pcv),
    dpt_hb_hib: calcVialNeed(target_si * 3 + target_baduta, rate.dpt),
    mr: calcVialNeed(target_si + target_baduta, rate.mr),
    rotavirus: calcVialNeed(target_si * 3, rate.rv),
    td: calcVialNeed(target_wus * 0.1, rate.td),
  }
}

const calcMonthlyStock = (
  yearly: number,
  available: number
): MonthlyVaccineStock => {
  const monthly = yearly / 12
  const min = Math.ceil(monthly * 0.25)
  const max = Math.ceil(monthly * 1.25)
  return {
    min_stock: min,
    max_stock: max,
    available_stock: available,
    request_qty: Math.max(0, max - available),
  }
}

export function calculateMonthlyStock(
  yearlyNeeds: VaccineVialsNeeded,
  currentStock: Partial<Record<keyof VaccineVialsNeeded, number>> = {}
): MonthlyStockByVaccine {
  return {
    hb0: calcMonthlyStock(yearlyNeeds.hb0, currentStock.hb0 ?? 0),
    bcg: calcMonthlyStock(yearlyNeeds.bcg, currentStock.bcg ?? 0),
    bopv: calcMonthlyStock(yearlyNeeds.bopv, currentStock.bopv ?? 0),
    ipv: calcMonthlyStock(yearlyNeeds.ipv, currentStock.ipv ?? 0),
    pcv: calcMonthlyStock(yearlyNeeds.pcv, currentStock.pcv ?? 0),
    dpt_hb_hib: calcMonthlyStock(
      yearlyNeeds.dpt_hb_hib,
      currentStock.dpt_hb_hib ?? 0
    ),
    mr: calcMonthlyStock(yearlyNeeds.mr, currentStock.mr ?? 0),
    rotavirus: calcMonthlyStock(
      yearlyNeeds.rotavirus,
      currentStock.rotavirus ?? 0
    ),
    td: calcMonthlyStock(yearlyNeeds.td, currentStock.td ?? 0),
  }
}

export function calculateLogisticsNeeds(
  { bcg, dpt_hb_hib, ipv, pcv, mr, td }: VaccineVialsNeeded,
  rates: UtilizationRates
): VaccineLogisticsNeeds {
  const ads5ml = bcg + mr
  const ads05ml =
    dpt_hb_hib * rates.dpt_hb_hib +
    ipv * rates.ipv +
    pcv * rates.pcv +
    mr * rates.mr +
    td * rates.td
  const ads005ml = bcg * rates.bcg
  const total = ads5ml + ads05ml + ads005ml

  return {
    ads_5ml: ads5ml,
    ads_05ml: ads05ml,
    ads_005ml: ads005ml,
    safety_box_25l: Math.ceil(total / 50),
    safety_box_5l: Math.ceil(total / 100),
  }
}
