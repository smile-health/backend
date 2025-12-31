import { Context } from "hono"
import XlsxPopulate from "xlsx-populate"
import moment from "moment"
import _ from "lodash"
import { AssetMonitoringDeviceQueryParams } from "./asset-monitoring-device.schema.js"

export class AssetMonitoringDeviceExcel {
    constructor() { }

    async generateFilters(
        c: Context,
        queryParams: AssetMonitoringDeviceQueryParams
    ): Promise<{ label: string; value: string }[]> {
        const filters: { label: string; value: string }[] = []

        if (queryParams.from) {
            filters.push({ label: "From Date", value: queryParams.from })
        }

        if (queryParams.to) {
            filters.push({ label: "To Date", value: queryParams.to })
        }

        // Add other filters as needed
        return filters
    }

    async generateSummaryReport(
        c: Context,
        data: any[],
        queryParams: AssetMonitoringDeviceQueryParams
    ): Promise<Buffer> {
        const workbook = await XlsxPopulate.fromBlankAsync()
        const sheet = workbook.sheet(0)
        sheet.name("Temperature Status")

        // Setup Headers
        const startRow = 1
        const ALIGN_CENTER = { verticalAlignment: "center", horizontalAlignment: "center", wrapText: true }
        const BOLD = { bold: true }

        const headers = [
            c.var.t("common.province", "Provinsi"),
            c.var.t("common.regency", "Kabupaten/Kota"),
            c.var.t("common.entity_id", "ID"),
            c.var.t("common.entity", "Nama Asset"),
            c.var.t("common.entity_tag", "Tag"),
            c.var.t("dashboard.temp_status.header.less_than_temp", "Kurang dari suhu"),
            c.var.t("dashboard.temp_status.header.between_temp_low", "Antara suhu"),
            c.var.t("dashboard.temp_status.header.normal_temp", "Normal suhu"),
            c.var.t("dashboard.temp_status.header.more_than_temp", "Lebih dari suhu"),
            c.var.t("dashboard.temp_status.header.offline", "Offline"),
            c.var.t("dashboard.temp_status.header.duration_less_than_temp", "Durasi kurang dari suhu"),
            c.var.t("dashboard.temp_status.header.duration_between_temp_low", "Durasi antara suhu"),
            c.var.t("dashboard.temp_status.header.duration_normal_temp", "Durasi normal suhu"),
            c.var.t("dashboard.temp_status.header.duration_more_than_temp", "Durasi lebih dari suhu"),
            c.var.t("dashboard.temp_status.header.duration_offline", "Durasi offline"),
        ]

        headers.forEach((header, index) => {
            sheet.cell(startRow, index + 1).value(header).style({ ...ALIGN_CENTER, ...BOLD })
            sheet.column(index + 1).width(25) // Default width
        })

        // Specific widths
        sheet.column("A").width(25) // Prov
        sheet.column("B").width(25) // Kab
        sheet.column("C").width(15) // ID
        sheet.column("D").width(40) // Entity Name - Wider
        sheet.column("E").width(30) // Tags
        // Metrics columns
        for (let i = 6; i <= 15; i++) {
            sheet.column(i).width(20)
        }

        // Process Data
        let rowIndex = startRow + 1
        data.forEach(row => {
            sheet.cell(rowIndex, 1).value(row.province_name)
            sheet.cell(rowIndex, 2).value(row.regency_name)
            sheet.cell(rowIndex, 3).value(row.entity_id)
            sheet.cell(rowIndex, 4).value(row.name)
            sheet.cell(rowIndex, 5).value(row.entity_tags || "-")

            // % columns
            sheet.cell(rowIndex, 6).value(`${row.less_than_temp} %`)
            sheet.cell(rowIndex, 7).value(`${row.between_temp} %`)
            sheet.cell(rowIndex, 8).value(`${row.normal_temp} %`)
            sheet.cell(rowIndex, 9).value(`${row.more_than_temp} %`)
            sheet.cell(rowIndex, 10).value(`${row.offline} %`)

            // Duration columns
            sheet.cell(rowIndex, 11).value(row.duration_less_than_temp)
            sheet.cell(rowIndex, 12).value(row.duration_between_temp)
            sheet.cell(rowIndex, 13).value(row.duration_normal_temp)
            sheet.cell(rowIndex, 14).value(row.duration_more_than_temp)
            sheet.cell(rowIndex, 15).value(row.duration_offline)

            rowIndex++
        })

        const buffer = await workbook.outputAsync()
        return buffer as Buffer
    }

    buildExportOptions(
        c: Context,
        data: any[],
        filters: { label: string; value: string }[]
    ): any {
        return {
            sheetName: "Temperature Status",
            columns: [
                { header: "Asset ID", key: "asset_id", width: 15 },
                { header: "Type ID", key: "type_id", width: 15 },
                { header: "Min Temperature", key: "min_temp", width: 20 },
                { header: "Max Temperature", key: "max_temp", width: 20 },
                { header: "Online", key: "online", width: 15 },
            ],
            titleBar: {
                title: "Asset Monitoring Device - Temperature Status",
                subtitle: "Export Report",
            },
            filters: filters,
            data: data,
        }
    }
}
