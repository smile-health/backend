import z from "zod"

export const NonBiasCalculateDetailQuerySchema = z.object({
  village_id: z.coerce.number().int().positive(),
})

export type NonBiasCalculateDetailQueryDTO = z.infer<
  typeof NonBiasCalculateDetailQuerySchema
>

export interface NonBiasCalculateDetailResponse {
  village_id: number
  village_name: string
  puskesmas_id: number | undefined
  puskesmas_name: string
  absolute_immunization: {
    title: string
    name_label: string
    value_label: string
    items: VaccineSummary[]
  }
  number_of_target: {
    title: string
    name_label: string
    value_label: string
    items: TargetItem[]
  }
  vaccine_vials_used: {
    title: string
    name_label: string
    value_label: string
    items: VaccineSummary[]
  }
  vaccine_utilization_rate: {
    title: string
    name_label: string
    value_label: string
    items: VaccineSummary[]
  }
  projected_yearly_needs: {
    title: string
    name_label: string
    value_label: string
    items: VaccineSummary[]
  }
  projected_monthly_vaccine_needs: {
    title: string
    name_label: string
    value_label: string
    items: ProjectedMonthlyNeedItem[]
  }
  projected_yearly_immunization_logistics_needs: {
    title: string
    name_label: string
    value_label: string
    items: VillageImmunizationItem[]
  }
  projected_monthly_immunization_logistics_needs: {
    title: string
    name_label: string
    value_label: string
    items: ProjectedLogisticsNeedItem[]
  }
}

export interface VaccineSummary {
  id: number
  name: string
  value: number | null
  detail?: MaterialStockDetail[] | VialNeedsDetail[]
}

export interface MaterialStockDetail {
  label: string
  type: string
  count: number | null
}

export interface VialNeedsDetail {
  label: string
  data: VaccineDetail[]
}

export interface VaccineDetail {
  label: string
  data: MaterialStockDetail[]
}

export interface TargetItem {
  id: number
  name: string
  value?: number
  targets?: {
    name: string
    value: number
  }[]
}

export const SaveVillageImmunizationAchievementSchema = z.object({
  village_id: z.coerce.number().int().positive(),
  items: z.record(z.coerce.number(), z.number()),
})

export type SaveVillageImmunizationAchievementDTO = z.infer<
  typeof SaveVillageImmunizationAchievementSchema
>

export interface VillageImmunizationItem {
  id: number
  name: string
  value: number | null
}

export interface ProjectedMonthlyNeedItem {
  id: number
  name: string
  min_stock: number | null
  max_stock: number | null
  available_stock: number | null
  request_qty: number | null
}

export interface ProjectedLogisticsNeedItem {
  id: number
  name: string
  calculation_based_on_vaccine_needs: number | null
  available_stock: number | null
  request_qty: number | null
}

export interface SaveVillageImmunizationDataResponse {
  village_id: number
  village_name: string
  puskesmas_id: number
  puskesmas_name: string
  absolute_immunization: {
    title: string
    name_label: string
    value_label: string
    items: VillageImmunizationItem[]
  }
  number_of_target: {
    title: string
    name_label: string
    value_label: string
    items: VillageImmunizationItem[]
  }
  vaccine_vials_used: {
    title: string
    name_label: string
    value_label: string
    items: VillageImmunizationItem[]
  }
  vaccine_utilization_rate: {
    title: string
    name_label: string
    value_label: string
    items: VillageImmunizationItem[]
  }
  projected_yearly_needs: {
    title: string
    name_label: string
    value_label: string
    items: VillageImmunizationItem[]
  }
  projected_monthly_vaccine_needs: {
    title: string
    name_label: string
    value_label: string
    items: ProjectedMonthlyNeedItem[]
  }
  projected_yearly_immunization_logistics_needs: {
    title: string
    name_label: string
    value_label: string
    items: VillageImmunizationItem[]
  }
  projected_monthly_immunization_logistics_needs: {
    title: string
    name_label: string
    value_label: string
    items: ProjectedLogisticsNeedItem[]
  }
}

export const SaveNonBiasImmunizationLogisticsSchema = z.object({
  village_id: z.coerce.number().int().positive(),
  village_name: z.string(),
  puskesmas_id: z.number(),
  puskesmas_name: z.string(),
  absolute_immunization: z.object({
    title: z.string(),
    name_label: z.string(),
    value_label: z.string(),
    items: z.array(
      z.object({
        id: z.number(),
        name: z.string(),
        value: z.number(),
      })
    ),
  }),
  number_of_target: z.object({
    title: z.string(),
    name_label: z.string(),
    value_label: z.string(),
    items: z.array(
      z.object({
        id: z.number(),
        name: z.string(),
        value: z.number(),
      })
    ),
  }),
  vaccine_vials_used: z.object({
    title: z.string(),
    name_label: z.string(),
    value_label: z.string(),
    items: z.array(
      z.object({
        id: z.number(),
        name: z.string(),
        value: z.number(),
      })
    ),
  }),
  vaccine_utilization_rate: z.object({
    title: z.string(),
    name_label: z.string(),
    value_label: z.string(),
    items: z.array(
      z.object({
        id: z.number(),
        name: z.string(),
        value: z.number(),
      })
    ),
  }),
  projected_yearly_needs: z.object({
    title: z.string(),
    name_label: z.string(),
    value_label: z.string(),
    items: z.array(
      z.object({
        id: z.number(),
        name: z.string(),
        value: z.number(),
      })
    ),
  }),
  projected_monthly_vaccine_needs: z.object({
    title: z.string(),
    name_label: z.string(),
    value_label: z.string(),
    items: z.array(
      z.object({
        id: z.number(),
        name: z.string(),
        min_stock: z.number(),
        max_stock: z.number(),
        available_stock: z.number(),
        request_qty: z.number(),
      })
    ),
  }),
  projected_yearly_immunization_logistics_needs: z.object({
    title: z.string(),
    name_label: z.string(),
    value_label: z.string(),
    items: z.array(
      z.object({
        id: z.number(),
        name: z.string(),
        value: z.number(),
      })
    ),
  }),
  projected_monthly_immunization_logistics_needs: z.object({
    title: z.string(),
    name_label: z.string(),
    value_label: z.string(),
    items: z.array(
      z.object({
        id: z.number(),
        name: z.string(),
        calculation_based_on_vaccine_needs: z.number(),
        available_stock: z.number(),
        request_qty: z.number(),
      })
    ),
  }),
})

export type SaveNonBiasImmunizationLogisticsDTO = z.infer<
  typeof SaveNonBiasImmunizationLogisticsSchema
>

export const DataCheckerQuerySchema = z.object({
  keyword: z.string().optional(),
})

export type DataCheckerQueryDTO = z.infer<typeof DataCheckerQuerySchema>

export interface VillageListItem {
  id: number
  name: string
  has_data: boolean
}

export interface VillageListResponse {
  data: {
    total: number
    total_with_data: number
    entities: VillageListItem[]
  }
}

export const UpdateNonBiasImmunizationLogisticsSchema = z.object({
  absolute_immunization: z.object({
    title: z.string(),
    name_label: z.string(),
    value_label: z.string(),
    items: z.array(
      z.object({
        id: z.number(),
        name: z.string(),
        value: z.number(),
      })
    ),
  }),
  number_of_target: z.object({
    title: z.string(),
    name_label: z.string(),
    value_label: z.string(),
    items: z.array(
      z.object({
        id: z.number(),
        name: z.string(),
        value: z.number(),
      })
    ),
  }),
  vaccine_vials_used: z.object({
    title: z.string(),
    name_label: z.string(),
    value_label: z.string(),
    items: z.array(
      z.object({
        id: z.number(),
        name: z.string(),
        value: z.number(),
      })
    ),
  }),
  vaccine_utilization_rate: z.object({
    title: z.string(),
    name_label: z.string(),
    value_label: z.string(),
    items: z.array(
      z.object({
        id: z.number(),
        name: z.string(),
        value: z.number(),
      })
    ),
  }),
  projected_yearly_needs: z.object({
    title: z.string(),
    name_label: z.string(),
    value_label: z.string(),
    items: z.array(
      z.object({
        id: z.number(),
        name: z.string(),
        value: z.number(),
      })
    ),
  }),
  projected_monthly_vaccine_needs: z.object({
    title: z.string(),
    name_label: z.string(),
    value_label: z.string(),
    items: z.array(
      z.object({
        id: z.number(),
        name: z.string(),
        min_stock: z.number(),
        max_stock: z.number(),
        available_stock: z.number(),
        request_qty: z.number(),
      })
    ),
  }),
  projected_yearly_immunization_logistics_needs: z.object({
    title: z.string(),
    name_label: z.string(),
    value_label: z.string(),
    items: z.array(
      z.object({
        id: z.number(),
        name: z.string(),
        value: z.number(),
      })
    ),
  }),
  projected_monthly_immunization_logistics_needs: z.object({
    title: z.string(),
    name_label: z.string(),
    value_label: z.string(),
    items: z.array(
      z.object({
        id: z.number(),
        name: z.string(),
        calculation_based_on_vaccine_needs: z.number(),
        available_stock: z.number(),
        request_qty: z.number(),
      })
    ),
  }),
})

export type UpdateNonBiasImmunizationLogisticsDTO = z.infer<
  typeof UpdateNonBiasImmunizationLogisticsSchema
>

export const RecalculateVillageEstimationSchema = z.object({
  village_id: z.coerce.number().int().positive(),
  items: z.record(z.coerce.number(), z.number()),
  vials_used: z.record(z.coerce.number(), z.number()),
})

export type RecalculateVillageEstimationDTO = z.infer<
  typeof RecalculateVillageEstimationSchema
>

export type RecalculateVillageEstimationResponse =
  SaveVillageImmunizationDataResponse
