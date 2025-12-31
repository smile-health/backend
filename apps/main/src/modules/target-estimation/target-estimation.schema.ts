import z from "zod"

export const CalculateTargetEstimationPathRequestSchema = z.object({
  id: z.coerce.number(),
})

export const CalculateTargetEstimationRequestSchema = z.object({
  outreach_service_percentage: z.number(),
  facility_based_service_percentage: z.number(),
  outreach_service_available_number: z.number(),
  facility_based_service_available_number: z.number(),
})

export type CalculateTargetEstimationPathRequestDTO = z.infer<
  typeof CalculateTargetEstimationPathRequestSchema
>

export type CalculateTargetEstimationRequestDTO = z.infer<
  typeof CalculateTargetEstimationRequestSchema
>

export const GetDetailCalculateSchema = z.object({
  id: z.coerce.number(),
  category: z.enum(["bias", "non-bias"]),
})

export const CalculateTargetEstimationBiasRequestSchema = z.object({
  august_immunization_service: z.number(),
  november_immunization_service: z.number(),
})

export type CalculateTargetEstimationBiasRequestDTO = z.infer<
  typeof CalculateTargetEstimationBiasRequestSchema
>

export interface TargetSummaryNonBiasResponse {
  entity_id: number
  name: string | null
  immunization_service: Array<{
    label: string
    services?: Array<{
      label: string | null
      type?: string
      count?: number | null
      sub_label?: string
      sub_services?: Array<{
        label: string
        type?: string
        count: number | null
      }>
    }>
  }>
  community_health_worker: Array<{
    label: string
    type?: string
    count: number | null
  }>
  number_of_target: Array<{
    label: string
    count?: number
    targets?: Array<{
      label: string
      type?: string
      count: number
    }>
  }>
  number_of_injection: Array<{
    label: string
    count: number | null
    targets?: Array<{
      label: string
      type?: string
      count: number
    }>
  }>
}

export interface TargetSummaryBiasResponse {
  entity_id: number
  name: string | null
  immunization_service: Array<{
    label: string
    services?: Array<{
      label: string
      type?: string
      count: number | null
    }>
  }>
  number_of_target: Array<{
    label: string
    type?: string
    count?: number
    targets?: Array<{
      label: string
      type?: string
      count: number
    }>
  }>
  number_of_injection: Array<{
    label: string
    type?: string
    count: number
  }>
}

export type TargetSummaryResponse =
  | TargetSummaryNonBiasResponse
  | TargetSummaryBiasResponse

export type GetDetailCalculateDTO = z.infer<typeof GetDetailCalculateSchema>

export const SaveEstimationSchema = z.object({
  village_id: z
    .number()
    .int()
    .positive("village_id must be a positive integer"),
  service_percentage_outreach: z.number().int().min(0).max(100),
  service_percentage_facility: z.number().int().min(0).max(100),
  required_monthly_outreach: z.number().int().min(0),
  required_monthly_facility: z.number().int().min(0),
  available_service_outreach: z.number().int().min(0),
  available_service_facility: z.number().int().min(0),
  required_additional_outreach: z.number().int(),
  required_vaccinator_outreach: z.number().int().min(0),
  required_additional_facility: z.number().int(),
  required_vaccinator_facility: z.number().int().min(0),
  ideal_needs: z.number().int().min(0),
  available_worker: z.number().int().min(0),
  gap_worker: z.number().int(),
})

export type SaveEstimationRequest = z.infer<typeof SaveEstimationSchema>

export const SaveEstimationBiasSchema = z.object({
  school_id: z.number().int().positive("school_id must be a positive integer"),
  august_service_point: z.number().int().min(0),
  august_service_days: z.number().int().min(0),
  august_vaccinator: z.number().int().min(0),
  november_service_point: z.number().int().min(0),
  november_service_days: z.number().int().min(0),
  november_vaccinator: z.number().int().min(0),
})

export type SaveEstimationBiasRequest = z.infer<typeof SaveEstimationBiasSchema>

export const AddTargetCalculateNonBiasSchema = SaveEstimationSchema.pick({
  village_id: true,
  service_percentage_outreach: true,
  service_percentage_facility: true,
  required_monthly_outreach: true,
  required_monthly_facility: true,
  available_service_outreach: true,
  available_service_facility: true,
  required_additional_outreach: true,
  required_vaccinator_outreach: true,
  required_additional_facility: true,
  required_vaccinator_facility: true,
  ideal_needs: true,
  available_worker: true,
  gap_worker: true,
})

export const UpdateEstimationSchema = SaveEstimationSchema.omit({
  village_id: true,
})

export type UpdateEstimationRequest = z.infer<typeof UpdateEstimationSchema>

export const UpdateEstimationBiasSchema = SaveEstimationBiasSchema.omit({
  school_id: true,
})

export type UpdateEstimationBiasRequest = z.infer<
  typeof UpdateEstimationBiasSchema
>

export const SchoolIdParamSchema = z.object({
  school_id: z.coerce.number().int().positive(),
})

export type SchoolIdParam = z.infer<typeof SchoolIdParamSchema>

export const VillageIdParamSchema = z.object({
  village_id: z.coerce.number().int().positive(),
})

export type VillageIdParam = z.infer<typeof VillageIdParamSchema>

export const GlobalCategoryRequestSchema = z.object({
  category: z.enum(["bias", "non-bias"]),
})

export type GlobalCategoryRequestDTO = z.infer<
  typeof GlobalCategoryRequestSchema
>

export interface ImmunizationServiceSummary {
  aggregate_of_all_villages: string
  required_monthly_service_points: Array<{
    label: string
    type?: string
    count: number
  }>
  available_service_points_days: Array<{
    label: string
    type?: string
    count: number
  }>
  option_of_immunization_service_solution: Array<{
    sub_label: string
    items: Array<{
      label: string
      type?: string
      count: number
    }>
  }>
  immunization_service_by_village: {
    data: ImmunizationServiceVillage[]
  }
}

export interface ImmunizationServiceVillage {
  id: number
  name: string
  service_percentage_by_type: Array<{
    label: string
    type?: string
    count: number
  }>
  required_monthly_service_points: Array<{
    label: string
    type?: string
    count: number
  }>
  available_service_points_days: Array<{
    label: string
    type?: string
    count: number
  }>
  option_of_immunization_service_solution: Array<{
    sub_label: string
    items: Array<{
      label: string
      type?: string
      count: number
    }>
  }>
}

export interface ImmunizationServiceBiasSummary {
  aggregate_of_all_schools: string
  immunization_service_on_august: Array<{
    label: string
    type?: string
    count: number
  }>
  immunization_service_on_november: Array<{
    label: string
    type?: string
    count: number
  }>
  immunization_service_summary_by_school: {
    data_out_of_school: ImmunizationServiceSchool[]
    data: ImmunizationServiceSchool[]
  }
}

export interface ImmunizationServiceSchool {
  id: number
  name: string
  immunization_service_on_august: Array<{
    label: string
    type?: string
    count: number
  }>
  immunization_service_on_november: Array<{
    label: string
    type?: string
    count: number
  }>
}

export const DataCheckerQuerySchema = z.object({
  category: z.enum(["bias", "non-bias"]),
  keyword: z.string().optional(),
})

export interface CommunityHealthWorkerVillage {
  village_id: number
  village_name: string
  data: Array<{
    label: string
    type?: string
    count: number
  }>
}

export interface CommunityHealthWorkerSummary {
  aggregate_of_all_villages: string
  summary: Array<{
    label: string
    type?: string
    count: number
  }>
  community_health_worker_by_village: CommunityHealthWorkerVillage[]
}

export interface EntityListItem {
  id: number
  name: string
  has_data: boolean
}

export interface EntityListResponse {
  data: {
    total: number
    total_with_data: number
    entities: EntityListItem[]
  }
}

export interface OutOfSchoolItem {
  id: number
  name: string
  has_data: boolean
}

export interface SchoolDataResponse {
  data_out_of_school: {
    total: number
    total_with_data: number
    entities: OutOfSchoolItem[]
  }
  data: {
    total: number
    total_with_data: number
    entities: EntityListItem[]
  }
}

export interface InjectionDashboardSummaryBias {
  number_of_injection: Array<{
    label: string
    type?: string
    count: number | null
  }>
  number_of_injection_by_school: {
    data_out_of_school: Array<{
      label: string
      data: Array<{
        label: string
        type?: string
        count: number | null
      }>
    }>
    data: Array<{
      label: string
      data: Array<{
        label: string
        type?: string
        count: number | null
      }>
    }>
  }
}

export interface InjectionDashboardSummaryNonBias {
  total_annual_injection: Array<{
    label: string
    type?: string
    count: number | null
  }>
  total_monthly_injection: Array<{
    label: string
    type?: string
    count: number | null
  }>
  number_of_injection_by_village: {
    data: Array<{
      label: string
      data: Array<{
        label: string
        type?: string
        count: number | null
      }>
    }>
  }
}

export type InjectionDashboardSummary =
  | InjectionDashboardSummaryNonBias
  | InjectionDashboardSummaryBias
