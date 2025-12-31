import { Context } from "hono"
import { AssetMonitoringDeviceRepository } from "./asset-monitoring-device.repository.js"
import {
    AssetMonitoringDeviceQueryParams,
    ColdstorageDashboardResponse,
    ExcursionDashboardResponse,
} from "./asset-monitoring-device.schema.js"
import { FileResponse } from "@smile/lib/types/file.js"
import WarehouseTemplate from "@smile/lib/excel/warehouse-template.js"
import { AssetMonitoringDeviceExcel } from "./asset-monitoring-device.excel.js"

export class AssetMonitoringDeviceModule {
    constructor(
        private readonly assetMonitoringDeviceRepository: AssetMonitoringDeviceRepository,
        private readonly assetMonitoringDeviceExcel: AssetMonitoringDeviceExcel
    ) { }

    async getColdstorageDashboard(
        c: Context,
        queryParams: AssetMonitoringDeviceQueryParams
    ): Promise<ColdstorageDashboardResponse> {
        const [
            vaccineColdstorage,
            rtmdTotal,
            rtmdStatus,
            avgOfflineDurationDaily,
            assetUpdatedAt,
            loggerUpdatedAt,
        ] = await Promise.all([
            this.assetMonitoringDeviceRepository.fetchVaccineColdstorage(c, queryParams),
            this.assetMonitoringDeviceRepository.fetchRtmdTotal(c, queryParams),
            this.assetMonitoringDeviceRepository.fetchRtmdStatus(c, queryParams),
            this.assetMonitoringDeviceRepository.fetchAvgOfflineDurationDaily(c, queryParams),
            this.assetMonitoringDeviceRepository.getLastUpdate(c, "asset"),
            this.assetMonitoringDeviceRepository.getLastUpdate(c, "datamart_logger"),
        ])

        return {
            vaccine_coldstorage: {
                ...vaccineColdstorage,
                updated_at: assetUpdatedAt,
            },
            rtmd_total: {
                ...rtmdTotal,
                updated_at: loggerUpdatedAt,
            },
            rtmd_status: rtmdStatus,
            avg_offline_duration_daily: avgOfflineDurationDaily,
            updated_at: loggerUpdatedAt,
        }
    }

    async getExcursionDashboard(
        c: Context,
        queryParams: AssetMonitoringDeviceQueryParams
    ): Promise<ExcursionDashboardResponse> {
        const [
            totalEventsByCategory,
            totalAsset,
            totalEventsByAsset,
            totalEntities,
            tempStatus,
            updatedAt,
        ] = await Promise.all([
            this.assetMonitoringDeviceRepository.fetchTotalEventsByCategory(
                c,
                queryParams
            ),
            this.assetMonitoringDeviceRepository.fetchTotalAsset(c, queryParams),
            this.assetMonitoringDeviceRepository.fetchTotalEventsByAsset(
                c,
                queryParams
            ),
            this.assetMonitoringDeviceRepository.fetchTotalEntities(c, queryParams),
            this.assetMonitoringDeviceRepository.fetchTempStatus(c, queryParams),
            this.assetMonitoringDeviceRepository.getLastUpdate(c, "datamart_logger"),
        ])

        return {
            total_events_by_category: totalEventsByCategory,
            total_asset: totalAsset,
            total_events_by_asset: totalEventsByAsset,
            total_entities: totalEntities,
            temp_status: tempStatus,
            updated_at: updatedAt,
        }
    }

    async exportTempStatus(
        c: Context,
        queryParams: AssetMonitoringDeviceQueryParams
    ): Promise<FileResponse> {
        const data = await this.assetMonitoringDeviceRepository.fetchExportData(
            c,
            queryParams
        )

        const nodeBuffer = await this.assetMonitoringDeviceExcel.generateSummaryReport(
            c,
            data,
            queryParams
        )

        const arrayBuffer = nodeBuffer.buffer.slice(
            nodeBuffer.byteOffset,
            nodeBuffer.byteOffset + nodeBuffer.byteLength
        ) as ArrayBuffer

        return {
            filename: `Asset Monitoring Device - Temperature Status.xlsx`,
            buffer: arrayBuffer,
        }
    }
}
