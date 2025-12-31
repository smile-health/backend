import { execQuery } from "@/common/infrastructure/database/index.js"
import { Context } from "hono"
import { AssetMonitoringDeviceQuery } from "./asset-monitoring-device.query.js"
import {
    AssetMonitoringDeviceQueryParams,
    AvgOfflineDurationDTO,
    RtmdStatusDTO,
    RtmdTotalDTO,
    TempStatusDTO,
    TotalAssetDTO,
    TotalEntitiesDTO,
    TotalEventsByAssetDTO,
    TotalEventsByCategoryDTO,
    VaccineColdstorageDT,
} from "./asset-monitoring-device.schema.js"

export class AssetMonitoringDeviceRepository {
    constructor(
        private readonly assetMonitoringDeviceQuery: AssetMonitoringDeviceQuery
    ) { }

    private buildQueryParams(
        queryParams: AssetMonitoringDeviceQueryParams,
        options: {
            includeDateRange?: boolean
            includeTypeIds?: boolean
            includeEntityTagIds?: boolean
        }
    ): Record<string, unknown> {
        const params: Record<string, unknown> = {}

        if (options.includeDateRange) {
            params.from = queryParams.from
            params.to = queryParams.to
        }

        if (options.includeTypeIds && queryParams.type_ids && queryParams.type_ids.length > 0) {
            params.type_ids = queryParams.type_ids
        }

        if (options.includeEntityTagIds && queryParams.entity_tag_ids && queryParams.entity_tag_ids.length > 0) {
            params.entity_tag_ids = queryParams.entity_tag_ids
        }

        return params
    }

    async fetchRtmdTotal(
        c: Context,
        queryParams: AssetMonitoringDeviceQueryParams
    ): Promise<RtmdTotalDTO> {
        const query = this.assetMonitoringDeviceQuery.buildRtmdTotalQuery(queryParams)
        const params = this.buildQueryParams(queryParams, {
            includeEntityTagIds: true,
        })
        const result = await execQuery<RtmdTotalDTO[]>(query, params)
        return result[0] || { total: 0, online: 0 }
    }

    async fetchRtmdStatus(
        c: Context,
        queryParams: AssetMonitoringDeviceQueryParams
    ): Promise<RtmdStatusDTO[]> {
        try {
            const query = this.assetMonitoringDeviceQuery.buildRtmdStatusQuery(queryParams)
            const params = this.buildQueryParams(queryParams, {
                includeDateRange: true,
                includeEntityTagIds: true,
            })
            const result = await execQuery<RtmdStatusDTO[]>(query, params)
            return result
        } catch (error) {
            console.error('fetchRtmdStatus error (possibly broken VIEW):', error)
            return []
        }
    }

    async fetchVaccineColdstorage(
        c: Context,
        queryParams: AssetMonitoringDeviceQueryParams
    ): Promise<VaccineColdstorageDT> {
        const query = this.assetMonitoringDeviceQuery.buildVaccineColdstorageQuery(queryParams)
        const params = this.buildQueryParams(queryParams, {
            includeEntityTagIds: true,
        })
        const result = await execQuery<VaccineColdstorageDT[]>(query, params)
        return result[0] || { total: 0, rtmd: 0 }
    }

    async fetchAvgOfflineDurationDaily(
        c: Context,
        queryParams: AssetMonitoringDeviceQueryParams
    ): Promise<AvgOfflineDurationDTO[]> {
        try {
            const query = this.assetMonitoringDeviceQuery.buildAvgOfflineDurationDailyQuery(queryParams)
            const params = this.buildQueryParams(queryParams, {
                includeDateRange: true,
                includeEntityTagIds: true,
            })
            const result = await execQuery<AvgOfflineDurationDTO[]>(query, params)
            return result
        } catch (error) {
            console.error('fetchAvgOfflineDurationDaily error (possibly broken VIEW):', error)
            return []
        }
    }

    async fetchTotalEventsByCategory(
        c: Context,
        queryParams: AssetMonitoringDeviceQueryParams
    ): Promise<TotalEventsByCategoryDTO[]> {
        try {
            const query = this.assetMonitoringDeviceQuery.buildTotalEventsByCategoryQuery(queryParams)
            const params = this.buildQueryParams(queryParams, {
                includeDateRange: true,
                includeEntityTagIds: true,
            })
            const result = await execQuery<TotalEventsByCategoryDTO[]>(query, params)
            return result
        } catch (error) {
            console.error('fetchTotalEventsByCategory error (possibly broken VIEW):', error)
            return []
        }
    }

    async fetchTotalEventsByAsset(
        c: Context,
        queryParams: AssetMonitoringDeviceQueryParams
    ): Promise<TotalEventsByAssetDTO[]> {
        try {
            const query = this.assetMonitoringDeviceQuery.buildTotalEventsByAssetQuery(queryParams)
            const params = this.buildQueryParams(queryParams, {
                includeDateRange: true,
                includeTypeIds: true,
                includeEntityTagIds: true,
            })
            const result = await execQuery<TotalEventsByAssetDTO[]>(query, params)
            return result
        } catch (error) {
            console.error('fetchTotalEventsByAsset error (possibly broken VIEW):', error)
            return []
        }
    }

    async fetchTotalAsset(
        c: Context,
        queryParams: AssetMonitoringDeviceQueryParams
    ): Promise<TotalAssetDTO[]> {
        try {
            const query = this.assetMonitoringDeviceQuery.buildTotalAssetQuery(queryParams)
            const params = this.buildQueryParams(queryParams, {
                includeDateRange: true,
                includeEntityTagIds: true,
            })
            const result = await execQuery<TotalAssetDTO[]>(query, params)
            return result
        } catch (error) {
            console.error('fetchTotalAsset error (possibly broken VIEW):', error)
            return []
        }
    }

    async fetchTotalEntities(
        c: Context,
        queryParams: AssetMonitoringDeviceQueryParams
    ): Promise<TotalEntitiesDTO> {
        try {
            const query = this.assetMonitoringDeviceQuery.buildTotalEntitiesQuery(queryParams)
            const params = this.buildQueryParams(queryParams, {
                includeDateRange: true,
                includeEntityTagIds: true,
            })
            const result = await execQuery<any[]>(query, params)
            const raw = result[0] || {
                total_less_than_temp: 0,
                total_between_temp: 0,
                total_more_than_temp: 0,
                total: 0,
                less_than_temp: 0,
                between_temp: 0,
                more_than_temp: 0,
            }

            return {
                less_than_temp: {
                    total: raw.total_less_than_temp,
                    percentage: Math.round(raw.less_than_temp),
                },
                between_temp: {
                    total: raw.total_between_temp,
                    percentage: Math.round(raw.between_temp),
                },
                more_than_temp: {
                    total: raw.total_more_than_temp,
                    percentage: Math.round(raw.more_than_temp),
                },
                total: raw.total,
            }
        } catch (error) {
            console.error('fetchTotalEntities error (possibly broken VIEW):', error)
            return {
                less_than_temp: {
                    total: 0,
                    percentage: 0,
                },
                between_temp: {
                    total: 0,
                    percentage: 0,
                },
                more_than_temp: {
                    total: 0,
                    percentage: 0,
                },
                total: 0,
            }
        }
    }

    async fetchTempStatus(
        c: Context,
        queryParams: AssetMonitoringDeviceQueryParams
    ): Promise<TempStatusDTO[]> {
        try {
            const query = this.assetMonitoringDeviceQuery.buildTempStatusQuery(queryParams)
            const params = this.buildQueryParams(queryParams, {
                includeDateRange: true,
                includeEntityTagIds: true,
            })
            const result = await execQuery<TempStatusDTO[]>(query, params)
            return result
        } catch (error) {
            console.error('fetchTempStatus error (possibly broken VIEW):', error)
            return []
        }
    }

    async getLastUpdate(c: Context, tableName: string): Promise<string> {
        try {
            const query = `SELECT toDateTime(max(updated_at), 'Asia/Jakarta') as updated_at FROM datamart_assets_v5 FINAL`
            const result = await execQuery<{ updated_at: string }[]>(query, {})
            return result[0]?.updated_at || new Date().toISOString()
        } catch {
            return new Date().toISOString()
        }
    }

    async fetchExportData(
        c: Context,
        queryParams: AssetMonitoringDeviceQueryParams
    ): Promise<any[]> {
        try {
            const query = this.assetMonitoringDeviceQuery.buildExportDataQuery(queryParams)
            const params = this.buildQueryParams(queryParams, {
                includeDateRange: true,
                includeEntityTagIds: true,
            })
            const result = await execQuery<any[]>(query, params)
            return result
        } catch (error) {
            console.error('fetchExportData error:', error)
            return []
        }
    }
}
