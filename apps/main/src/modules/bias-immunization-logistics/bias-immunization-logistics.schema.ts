import z from "zod"

export const BiasCalculateDetailQuerySchema = z.object({
  school_id: z.coerce.number().int().positive(),
})

export type BiasCalculateDetailQueryDTO = z.infer<
  typeof BiasCalculateDetailQuerySchema
>

export interface BiasCalculateDetailResponse {
  school_id: number
  school_name: string
  puskesmas_id: number
  puskesmas_name: string
  number_of_immunization: {
    title: string
    name_label: string
    value_label: string
    items: GlobalSummary[]
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
    items: GlobalSummary[]
  }
  vaccine_utilization_rate: {
    title: string
    name_label: string
    value_label: string
    items: GlobalSummary[]
  }
  vial_needs: {
    title: string
    name_label: string
    value_label: string
    items: VialNeedItem[]
  }
  ads_sb_needs: {
    title: string
    name_label: string
    value_label: string
    items: GlobalSummary[] | AdsSbNeedMonth[]
  }
}

export interface GlobalSummary {
  id: number
  name: string
  value: number | null | MaterialStockDetail[]
  detail?: MaterialStockDetail[] | VialNeedsDetail[]
}

export interface VialNeedItem {
  id: number
  name: string
  min_stock: number | null
  max_stock: number | null
  available_stock: number | null
  request_qty: number | null
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

export const SaveImmunizationAchievementSchema = z.object({
  school_id: z.coerce.number().int().positive(),
  items: z.record(z.coerce.number(), z.number()),
})

export type SaveImmunizationAchievementDTO = z.infer<
  typeof SaveImmunizationAchievementSchema
>

export interface AdsSbNeedItem {
  id: number
  name: string
  value: number | null
}

export interface AdsSbNeedMonth {
  label: string
  targets: AdsSbNeedItem[]
}

export interface SaveImmunizationDataResponse {
  school_id: number
  school_name: string
  puskesmas_id: number
  puskesmas_name: string
  number_of_immunization: {
    title: string
    name_label: string
    value_label: string
    items: GlobalSummary[]
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
    items: GlobalSummary[]
  }
  vaccine_utilization_rate: {
    title: string
    name_label: string
    value_label: string
    items: GlobalSummary[]
  }
  vial_needs: {
    title: string
    name_label: string
    value_label: string
    items: VialNeedItem[]
  }
  ads_sb_needs: {
    title: string
    name_label: string
    value_label: string
    items: AdsSbNeedMonth[]
  }
}

export interface GlobalResponse {
  id: number
  label: string
  type: string
  value: number
}

export const SaveBiasImmunizationLogisticsSchema = z.object({
  school_id: z.coerce.number().int().positive(),
  school_name: z.string(),
  puskesmas_id: z.number(),
  puskesmas_name: z.string(),
  number_of_immunization: z.object({
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
        value: z.number().optional(),
        targets: z
          .array(
            z.object({
              name: z.string(),
              value: z.number(),
            })
          )
          .optional(),
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
  vial_needs: z.object({
    title: z.string(),
    name_label: z.string(),
    value_label: z.string(),
    items: z.array(
      z.object({
        id: z.number(),
        name: z.string(),
        min_stock: z.number().nullable(),
        max_stock: z.number(),
        available_stock: z.number(),
        request_qty: z.number(),
      })
    ),
  }),
  ads_sb_needs: z.object({
    title: z.string(),
    name_label: z.string(),
    value_label: z.string(),
    items: z.array(
      z.object({
        label: z.string(),
        targets: z.array(
          z.object({
            id: z.number(),
            name: z.string(),
            value: z.number(),
          })
        ),
      })
    ),
  }),
})

export type SaveBiasImmunizationLogisticsDTO = z.infer<
  typeof SaveBiasImmunizationLogisticsSchema
>

export const DataCheckerQuerySchema = z.object({
  keyword: z.string().optional(),
})

export type DataCheckerQueryDTO = z.infer<typeof DataCheckerQuerySchema>

export interface SchoolListItem {
  id: number
  name: string
  has_data: boolean
}

export interface OutOfSchoolItem {
  id: number
  name: string
  has_data: boolean
}

export interface SchoolListResponse {
  data_out_of_school: {
    total: number
    total_with_data: number
    entities: OutOfSchoolItem[]
  }
  data: {
    total: number
    total_with_data: number
    entities: SchoolListItem[]
  }
}

export interface ProcessSchoolParams {
  school: { school_id: number; school_name: string }
  microplanningEntityId: number
  subDistrictId: number
  microplanningId: number
  promotionCounts: Record<number, number>
  primaryMaterials: { materialIds: number[] }
  materialIdsMap: { mrId: number; dtId: number; tdId: number; hpvId: number }
  logisticsIds: {
    ads5mlId: number
    ads05mlId: number
    sb25lId: number
    sb5lId: number
  }
}

export const UpdateBiasImmunizationLogisticsSchema = z.object({
  number_of_immunization: z.object({
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
        value: z.number().optional(),
        targets: z
          .array(
            z.object({
              name: z.string(),
              value: z.number(),
            })
          )
          .optional(),
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
  vial_needs: z.object({
    title: z.string(),
    name_label: z.string(),
    value_label: z.string(),
    items: z.array(
      z.object({
        id: z.number(),
        name: z.string(),
        min_stock: z.number().nullable(),
        max_stock: z.number(),
        available_stock: z.number(),
        request_qty: z.number(),
      })
    ),
  }),
  ads_sb_needs: z.object({
    title: z.string(),
    name_label: z.string(),
    value_label: z.string(),
    items: z.array(
      z.object({
        label: z.string(),
        targets: z.array(
          z.object({
            id: z.number(),
            name: z.string(),
            value: z.number(),
          })
        ),
      })
    ),
  }),
})

export type UpdateBiasImmunizationLogisticsDTO = z.infer<
  typeof UpdateBiasImmunizationLogisticsSchema
>

export const RecalculateEstimationSchema = z.object({
  school_id: z.coerce.number().int().positive(),
  items: z.record(z.coerce.number(), z.number()),
  vials_used: z.record(z.coerce.number(), z.number()),
})

export type RecalculateEstimationDTO = z.infer<
  typeof RecalculateEstimationSchema
>

export type RecalculateEstimationResponse = SaveImmunizationDataResponse
