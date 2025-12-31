import z from "zod"

const ImmunizationDataSchema = z.object({
  hb0: z.number(),
  bcg: z.number(),
  bopv_total_capaian_1_sd_4: z.number(),
  ipv_total_capaian_1_dan_2: z.number(),
  pcv_total_capaian_1_sd_3: z.number(),
  dpt_hb_hib_total_capaian_1_sd_4: z.number(),
  mr_1_dan_mr_2: z.number(),
  rotavirus_total_capaian_1_sd_3: z.number(),
})

export const AbsoluteImmunizationCoverageSchema = ImmunizationDataSchema.extend(
  {
    wus_hamil_dan_tidak_hamil: z.number(),
    td: z.number(),
  }
)

export const VialImmunizationCoverageSchema = ImmunizationDataSchema.extend({
  wus_1_tahun_sebelumnya: z.number(),
  td: z.number(),
})

export type AbsoluteImmunizationCoverage = z.infer<
  typeof AbsoluteImmunizationCoverageSchema
>

export interface SumOfAbsoluteImmunization
  extends AbsoluteImmunizationCoverage {}

export type VialImmunizationCoverage = z.infer<
  typeof VialImmunizationCoverageSchema
>
export interface SumOfVialImmunization extends VialImmunizationCoverage {}

export interface GlobalSummary {
  label: string
  type?: string
  count: number
}

export interface GlobalDataImmunization {
  id: number
  label: string
  data: Array<{
    label: string
    type?: string
    count: number
  }>
}

export interface AbsoluteNumberofRoutineImmunization {
  summary: GlobalSummary[]
  absolute_number_of_routine_immunization_by_villages: {
    data: GlobalDataImmunization[]
  }
}

export interface NumberVaccineVialsUsed {
  summary: GlobalSummary[]
  number_vaccine_vials_used_by_villages: {
    data: GlobalDataImmunization[]
  }
}

export interface ImmunizationAchievementItem {
  label: string
  type: string
  count: number
}

export interface SchoolImmunizationAchievement {
  id: number
  label: string
  data: ImmunizationAchievementItem[]
}

export interface VaccineVialsUsedBySchool {
  summary: ImmunizationAchievementItem[]
  vaccine_vials_used_by_school: {
    data_out_of_school?: SchoolImmunizationAchievement[]
    data: SchoolImmunizationAchievement[]
  }
}

export interface NumberOfVaccineUtilizationRate {
  summary: Array<{
    label: string
    type?: string
    count: number
  }>
}

export interface VaccineUtilizationRateBias {
  summary: ImmunizationAchievementItem[]
}

export interface ProjectedOneYearVaccine {
  summary: GlobalSummary[]
  projected_one_year_vaccine: {
    data: GlobalDataImmunization[]
  }
}

export interface ProjectedMonthlyVaccine {
  summary: GlobalSummary[]
  projected_monthly_vaccine: {
    data: GlobalDataImmunization[]
  }
}

export interface VaccineProjection {
  label: string
  id: number
  data: GlobalSummary[]
}

export interface DetailMonthlyProjectedVaccine {
  id: number
  label: string
  data: VaccineProjection[]
}

export const GlobalIdRequestSchema = z.object({
  id: z.coerce.number(),
})

export interface ImmunizationLogisticsNeed {
  summary: GlobalSummary[]
  immunization_logistics_need: {
    data: GlobalDataImmunization[]
  }
}

export interface LogisticsProjection {
  label: string
  id: number
  data: GlobalSummary[]
}

export interface DetailMonthlyVaccineLogistic {
  id: number
  label: string
  data: LogisticsProjection[]
}

export interface ImmunizationAchievementsSummary {
  summary: ImmunizationAchievementItem[]
  achievements_by_school: {
    data_out_of_school?: SchoolImmunizationAchievement[]
    data: SchoolImmunizationAchievement[]
  }
}

export interface VialNeedsBySchool {
  summary: ImmunizationAchievementItem[]
  vial_needs_by_school: {
    data_out_of_school?: SchoolImmunizationAchievement[]
    data: SchoolImmunizationAchievement[]
  }
}

export interface VaccineVialNeedsItem {
  label: string
  data: GlobalSummary[]
}

export interface GradeVialNeeds {
  label: string
  data: VaccineVialNeedsItem[]
}

export interface DetailVialNeedsBySchool {
  id: number
  label: string
  data: GradeVialNeeds[]
}

export interface MonthlyLogisticsItem {
  label: string
  data: ImmunizationAchievementItem[]
}

export interface SchoolLogisticsNeeds {
  id: number
  label: string
  data: MonthlyLogisticsItem[]
}

export interface AdsSbNeeds {
  summary: MonthlyLogisticsItem[]
  ads_sb_needs: {
    data_out_of_school?: SchoolLogisticsNeeds[]
    data: SchoolLogisticsNeeds[]
  }
}

export interface PreviousYearImmunizationData {
  absolute: {
    hb0: number
    bcg: number
    bopv_total_capaian_1_sd_4: number
    ipv_total_capaian_1_dan_2: number
    pcv_total_capaian_1_sd_3: number
    dpt_hb_hib_total_capaian_1_sd_4: number
    mr_1_dan_mr_2: number
    rotavirus_total_capaian_1_sd_3: number
    td: number
  }

  vial: {
    hb0: number
    bcg: number
    bopv_total_capaian_1_sd_4: number
    ipv_total_capaian_1_dan_2: number
    pcv_total_capaian_1_sd_3: number
    dpt_hb_hib_total_capaian_1_sd_4: number
    mr_1_dan_mr_2: number
    rotavirus_total_capaian_1_sd_3: number
    td: number
  }
}

export interface VaccineCalculationInput {
  target_bbl: number
  target_si: number
  target_baduta: number
  target_wus: number
  previous_year_data: PreviousYearImmunizationData
}

export interface VaccineVialsNeeded {
  hb0: number
  bcg: number
  bopv: number
  ipv: number
  pcv: number
  dpt_hb_hib: number
  mr: number
  rotavirus: number
  td: number
}

export interface MonthlyVaccineStock {
  min_stock: number
  max_stock: number
  available_stock: number
  request_qty: number
}

export interface MonthlyStockByVaccine {
  hb0: MonthlyVaccineStock
  bcg: MonthlyVaccineStock
  bopv: MonthlyVaccineStock
  ipv: MonthlyVaccineStock
  pcv: MonthlyVaccineStock
  dpt_hb_hib: MonthlyVaccineStock
  mr: MonthlyVaccineStock
  rotavirus: MonthlyVaccineStock
  td: MonthlyVaccineStock
}

export interface UtilizationRates {
  hb0: number
  bcg: number
  bopv: number
  ipv: number
  pcv: number
  dpt_hb_hib: number
  mr: number
  rotavirus: number
  td: number
}

export interface VaccineLogisticsNeeds {
  ads_5ml: number
  ads_05ml: number
  ads_005ml: number
  safety_box_25l: number
  safety_box_5l: number
}
