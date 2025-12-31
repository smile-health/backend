import { QueryParamsSchema } from "@/common/schemas/query-param.schema.js"
import { z } from "zod"

export const AssetMonitoringDeviceQueryParamsSchema = z.intersection(
    QueryParamsSchema,
    z.object({
        type_ids: z.preprocess(
            (val) => (typeof val === "string" ? val.split(",").map(Number) : val),
            z.array(z.number()).optional()
        ),
        type_id: z.coerce.number().int().optional(),
        excursion_durations: z.preprocess(
            (val) => (typeof val === "string" ? val.split(",").map(Number) : val),
            z.array(z.number()).optional()
        ),
        temp_min_max: z.coerce.number().int().optional(),
        is_pqs: z.coerce.number().int().optional(),
        period: z.enum(['daily', 'monthly', 'annual']).optional().default('daily'),
    })
)

export const RtmdTotalDTO = z.object({
    total: z.number(),
    online: z.number(),
    updated_at: z.string().optional(),
})

export const RtmdStatusDTO = z.object({
    id: z.number(),
    asset_type: z.string(),
    online: z.number(),
    offline: z.number(),
    min_temp: z.number().nullable(),
    max_temp: z.number().nullable(),
    total_online: z.number(),
    total_offline: z.number(),
    total: z.number(),
})

export const VaccineColdstorageDT = z.object({
    total: z.number(),
    rtmd: z.number(),
    updated_at: z.string().optional(),
})

export const AvgOfflineDurationDTO = z.object({
    total_less_than_one_hour: z.number(),
    total_between_one_ten_hour: z.number(),
    total_more_than_ten_hour: z.number(),
    less_than_one_hour: z.number().nullable(),
    between_one_ten_hour: z.number().nullable(),
    more_than_ten_hour: z.number().nullable(),
    logger_date: z.string(),
})

export const TotalEventsByCategoryDTO = z.object({
    week: z.number(),
    year: z.number(),
    less_than_temp: z.number(),
    between_temp: z.number(),
    more_than_temp: z.number(),
})

export const TotalEventsByAssetDTO = z.object({
    id: z.number(),
    asset_type: z.string().optional(),
    min_temp: z.number().nullable(),
    max_temp: z.number().nullable(),
    less_than_temp: z.number(),
    between_temp: z.number(),
    more_than_temp: z.number(),
})

export const TotalAssetDTO = z.object({
    week: z.number(),
    year: z.number(),
    less_than_temp: z.number(),
    between_temp: z.number(),
    more_than_temp: z.number(),
})

export const TotalEntitiesDTO = z.object({
    less_than_temp: z.object({
        total: z.number(),
        percentage: z.number(),
    }),
    between_temp: z.object({
        total: z.number(),
        percentage: z.number(),
    }),
    more_than_temp: z.object({
        total: z.number(),
        percentage: z.number(),
    }),
    total: z.number(),
})

export const TempStatusDTO = z.object({
    name: z.string(),
    entity_id: z.number(),
    rtmd: z.number(),
    entities: z.number(),
    hour_diff: z.number(),
    duration_offline: z.number(),
    duration_normal_temp: z.number(),
    duration_less_than_temp: z.number(),
    duration_between_temp: z.number(),
    duration_more_than_temp: z.number(),
    offline: z.number(),
    normal_temp: z.number(),
    less_than_temp: z.number(),
    between_temp: z.number(),
    more_than_temp: z.number(),
})

export const ColdstorageDashboardResponseSchema = z.object({
    vaccine_coldstorage: VaccineColdstorageDT,
    rtmd_total: RtmdTotalDTO,
    rtmd_status: z.array(RtmdStatusDTO),
    avg_offline_duration_daily: z.array(AvgOfflineDurationDTO),
    updated_at: z.string(),
})

export const ExcursionDashboardResponseSchema = z.object({
    total_events_by_category: z.array(TotalEventsByCategoryDTO),
    total_asset: z.array(TotalAssetDTO),
    total_events_by_asset: z.array(TotalEventsByAssetDTO),
    total_entities: TotalEntitiesDTO,
    temp_status: z.array(TempStatusDTO),
    updated_at: z.string(),
})

export type AssetMonitoringDeviceQueryParams = z.infer<
    typeof AssetMonitoringDeviceQueryParamsSchema
>
export type RtmdTotalDTO = z.infer<typeof RtmdTotalDTO>
export type RtmdStatusDTO = z.infer<typeof RtmdStatusDTO>
export type VaccineColdstorageDT = z.infer<typeof VaccineColdstorageDT>
export type AvgOfflineDurationDTO = z.infer<typeof AvgOfflineDurationDTO>
export type TotalEventsByCategoryDTO = z.infer<typeof TotalEventsByCategoryDTO>
export type TotalEventsByAssetDTO = z.infer<typeof TotalEventsByAssetDTO>
export type TotalAssetDTO = z.infer<typeof TotalAssetDTO>
export type TotalEntitiesDTO = z.infer<typeof TotalEntitiesDTO>
export type TempStatusDTO = z.infer<typeof TempStatusDTO>
export type ColdstorageDashboardResponse = z.infer<
    typeof ColdstorageDashboardResponseSchema
>
export type ExcursionDashboardResponse = z.infer<
    typeof ExcursionDashboardResponseSchema
>
