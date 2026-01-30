import { DB } from "@/common/infrastructure/database/types/db.js"
import { MultiSheetZipExporter } from "@smile-health/lib/excel/multi-sheet-zip.js"
import { Consumer } from "@smile-health/lib/rabbitmq/consumer.js"
import { TOPIC } from "@smile-health/lib/rabbitmq/topic.js"
import { Context } from "hono"
import { CustomContext } from "@smile-health/lib/types/context.js"
import moment from "moment"
import env from "../../config/env.js"
import { BaseWorker } from "../base.worker.js"
import ExportHistoryRepository from "../export-history/export-history.repository.js"
import { UserActivityModule } from "./user-activity.module.js";
import {
    UserActivityQueryParams,
} from "./user-activity.schema.js"
import { MaterialRepository } from "../material/material.repository.js"
import { KFA_LEVEL_CODE } from "@/common/constants/material.js"

export class UserActivityWorker extends BaseWorker {
    constructor(
        private readonly userActivityModule: UserActivityModule,
        protected readonly exportHistoryRepo: ExportHistoryRepository,
        private readonly materialRepo: MaterialRepository,

    ) {
        super(exportHistoryRepo)
    }

    public registerWorkers(consumer: Consumer<DB>) {
        consumer.route(TOPIC.REPORT_USER_ACTIVITY_EXPORTED, async (c, msg) => {
            const parseMsg = JSON.parse(msg ?? "{}")
            const { params, options, language, timezone } = parseMsg.payload

            await this.processAsyncExport(c, options, async () => {
                return await this.prepareExporter(c, language, timezone, params)
            })
        })
    }


    private async prepareExporter(
        c: CustomContext<DB>,
        language: string,
        timezone: string,
        queryParams: Pick<
            UserActivityQueryParams,
            | "activity_ids"
            | "material_ids"
            | "province_id"
            | "regency_id"
            | "from"
            | "is_customer_activity"
        >,
    ) {
        const { intervalPeriod, data } = await this.userActivityModule.getActivityByEntity(
            c as Context,
            queryParams,
            true
        )

        const materialResult = await this.materialRepo.fetchMaterials(
            c as Context,
            { ...queryParams, material_level_id: KFA_LEVEL_CODE.VARIANT },
            {
                is_paginate: false,
            }
        )
        const materials = materialResult.records

        const exporter = new MultiSheetZipExporter({
            language,
            timezone,
            batchSize: env.EXPORT_EXCEL_BATCH_SIZE,
            bucketName: env.EXPORT_EXCEL_BUCKET_NAME,
        })


        const title = c.var.t("user-activity.export.label")
        const sheetName = title
        const groupId = "user-activity"

        // Initialize file group and sheet
        await exporter.initFileGroupWarehouse(groupId, title)
        await exporter.initSheet(groupId, sheetName)

        // Title section
        const titleStyle = { bold: true, horizontalAlignment: "center" }
        // Merge cells from A1 to E1 for the title
        await exporter.addCell(groupId, sheetName, "A1", title, titleStyle, "AE1")

        // Filter information section
        await exporter.addCell(groupId, sheetName, "A2", c.var.t("common.year"))
        await exporter.addCell(groupId, sheetName, "B2", moment(queryParams.from).format("YYYY"))

        await exporter.addCell(groupId, sheetName, "A3", c.var.t("common.month"))
        await exporter.addCell(groupId, sheetName, "B3", moment(queryParams.from).format("MMMM"))

        await exporter.addCell(groupId, sheetName, "A4", c.var.t("common.entityorfaskes"))
        await exporter.addCell(groupId, sheetName, "B4", "")

        await exporter.addCell(groupId, sheetName, "A5", c.var.t("common.activity"))
        await exporter.addCell(
            groupId,
            sheetName,
            "B5",
            queryParams.activity_ids ? data[0]?.activity_name : ""
        )

        await exporter.addCell(groupId, sheetName, "A6", c.var.t("common.material"))
        const materialName =
            Array.isArray(materials) && materials.length > 0
                ? materials.map((mat) => mat.name).join(", ")
                : c.var.t("common.all")
        await exporter.addCell(
            groupId,
            sheetName,
            "B6",
            queryParams.material_ids ? materialName : ""
        )

        // Province and Regency info (top right)
        const valueProvince = queryParams.province_id ? data[0]?.province_name : ""
        const valueRegency = queryParams.regency_id ? data[0]?.regency_name : ""
        const dateStartCol = queryParams.is_customer_activity ? 9 : 7

        await exporter.addCell(
            groupId,
            sheetName,
            this.getColumnLetter(dateStartCol) + "3",
            c.var.t("entity.label.province")
        )
        await exporter.addCell(
            groupId,
            sheetName,
            this.getColumnLetter(dateStartCol + 1) + "3",
            valueProvince
        )

        await exporter.addCell(
            groupId,
            sheetName,
            this.getColumnLetter(dateStartCol) + "4",
            c.var.t("entity.label.regency")
        )
        await exporter.addCell(
            groupId,
            sheetName,
            this.getColumnLetter(dateStartCol + 1) + "4",
            valueRegency
        )

        // Header row
        const headerRow = 8
        const headerStyle = {
            bold: true, horizontalAlignment: "center", border: {
                top: { style: "thin", color: "000" },
                bottom: { style: "thin", color: "000" },
                left: { style: "thin", color: "000" },
                right: { style: "thin", color: "000" },
            }
        }

        const tableStyle = {
            border: {
                top: { style: "thin", color: "000" },
                bottom: { style: "thin", color: "000" },
                left: { style: "thin", color: "000" },
                right: { style: "thin", color: "000" },
            }
        }

        await exporter.addCell(groupId, sheetName, "A8", "No", headerStyle)
        await exporter.addCell(groupId, sheetName, "B8", c.var.t("common.province"), headerStyle)
        await exporter.addCell(groupId, sheetName, "C8", c.var.t("common.regency"), headerStyle)
        await exporter.addCell(groupId, sheetName, "D8", c.var.t("common.entity_id"), headerStyle)
        await exporter.addCell(groupId, sheetName, "E8", c.var.t("entity_customer.label.entity_name"), headerStyle)

        let currentHeaderCol = 6;

        // Conditional customer columns
        if (queryParams.is_customer_activity) {
            await exporter.addCell(groupId, sheetName, this.getColumnLetter(currentHeaderCol) + "8", c.var.t("common.customer_id"), headerStyle)
            currentHeaderCol++;
            await exporter.addCell(groupId, sheetName, this.getColumnLetter(currentHeaderCol) + "8", c.var.t("common.customer_name"), headerStyle)
            currentHeaderCol++;
        }

        await exporter.addCell(groupId, sheetName, this.getColumnLetter(currentHeaderCol) + "8", c.var.t("common.activity"), headerStyle)

        // Date headers
        const monthYearText =
            moment(queryParams.from).format("MMMM") +
            " " +
            moment(queryParams.from).format("YYYY")

        // Calculate end column for merging month/year header across all days
        const monthYearEndCol = dateStartCol + intervalPeriod!.length - 1
        const monthYearEndCell = this.getColumnLetter(monthYearEndCol) + "8"

        await exporter.addCell(
            groupId,
            sheetName,
            this.getColumnLetter(dateStartCol) + "8",
            monthYearText,
            headerStyle,
            monthYearEndCell // Merge across all daily columns
        )

        // Daily headers
        for (let day = 1; day <= intervalPeriod!.length; day++) {
            const colLetter = this.getColumnLetter(dateStartCol + (day - 1))
            const dayString = day.toString().padStart(2, "0")
            await exporter.addCell(
                groupId,
                sheetName,
                colLetter + "9",
                dayString,
                headerStyle
            )
        }

        // Summary columns
        const kolomTotalHariAktifCol = dateStartCol + intervalPeriod!.length
        const kolomTotalHariTidakAktifCol = kolomTotalHariAktifCol + 1
        const kolomTotalFrekuensiCol = kolomTotalHariTidakAktifCol + 1
        const kolomRataRataFrekuensiCol = kolomTotalFrekuensiCol + 1

        await exporter.addCell(
            groupId,
            sheetName,
            this.getColumnLetter(kolomTotalHariAktifCol) + "8",
            c.var.t("user-activity.export.total_active_days"),
            headerStyle
        )
        await exporter.addCell(
            groupId,
            sheetName,
            this.getColumnLetter(kolomTotalHariTidakAktifCol) + "8",
            c.var.t("user-activity.export.total_inactive_days"),
            headerStyle
        )
        await exporter.addCell(
            groupId,
            sheetName,
            this.getColumnLetter(kolomTotalFrekuensiCol) + "8",
            c.var.t("user-activity.export.total_frequency_expenditure"),
            headerStyle
        )
        await exporter.addCell(
            groupId,
            sheetName,
            this.getColumnLetter(kolomRataRataFrekuensiCol) + "8",
            c.var.t("user-activity.export.average_frequency"),
            headerStyle
        )

        // Data data
        let currentRow = 10
        let count = 0
        const dataRows: Record<string, unknown>[] = []

        for (const entitas of data) {
            count++
            const rowData: Record<string, unknown> = {
                no: count,
                province: entitas.province_name,
                regency: entitas.regency_name,
                entity_id: entitas.id,
                entity_name: entitas.name,
            }

            // Add customer data if applicable
            if (queryParams.is_customer_activity) {
                rowData.customer_id = entitas.customer_id || ""
                rowData.customer_name = entitas.customer_name || ""
            }

            rowData.activity = entitas.activity_name

            // Add daily data
            for (let i = 0; i < intervalPeriod!.length; i++) {
                const dateStr = intervalPeriod![i]
                const value = entitas.overview![dateStr!] ?? 0
                rowData[`day_${i}`] = value
            }

            // Add summary data
            rowData.total_active_days = entitas.total_active_days
            rowData.total_inactive_days = entitas.total_inactive_days
            rowData.total_frequency = entitas.total_frequency
            rowData.average_frequency = entitas.average_frequency

            dataRows.push(rowData)
        }

        // Add all data rows at once
        for (const [index, rowData] of dataRows.entries()) {
            const row = currentRow + index
            await exporter.addCell(groupId, sheetName, "A" + row, rowData.no, tableStyle)
            await exporter.addCell(groupId, sheetName, "B" + row, rowData.province, tableStyle)
            await exporter.addCell(groupId, sheetName, "C" + row, rowData.regency, tableStyle)
            await exporter.addCell(groupId, sheetName, "D" + row, rowData.entity_id, tableStyle)
            await exporter.addCell(groupId, sheetName, "E" + row, rowData.entity_name, tableStyle)

            let dataCol = 6;

            // Add customer data if applicable
            if (queryParams.is_customer_activity) {
                await exporter.addCell(groupId, sheetName, this.getColumnLetter(dataCol) + row, rowData.customer_id, tableStyle)
                dataCol++;
                await exporter.addCell(groupId, sheetName, this.getColumnLetter(dataCol) + row, rowData.customer_name, tableStyle)
                dataCol++;
            }

            await exporter.addCell(groupId, sheetName, this.getColumnLetter(dataCol) + row, rowData.activity, tableStyle)

            // Add daily data
            for (let i = 0; i < intervalPeriod!.length; i++) {
                const colLetter = this.getColumnLetter(dateStartCol + i)
                await exporter.addCell(groupId, sheetName, colLetter + row, rowData[`day_${i}`], tableStyle)
            }

            // Add summary data
            await exporter.addCell(groupId, sheetName, this.getColumnLetter(kolomTotalHariAktifCol) + row, rowData.total_active_days, tableStyle)
            await exporter.addCell(groupId, sheetName, this.getColumnLetter(kolomTotalHariTidakAktifCol) + row, rowData.total_inactive_days, tableStyle)
            await exporter.addCell(groupId, sheetName, this.getColumnLetter(kolomTotalFrekuensiCol) + row, rowData.total_frequency, tableStyle)
            await exporter.addCell(groupId, sheetName, this.getColumnLetter(kolomRataRataFrekuensiCol) + row, rowData.average_frequency, tableStyle)
        }


        return exporter
    }

    /**
     * Convert column number to letter (1 = A, 2 = B, 27 = AA, etc.)
     */
    private getColumnLetter(columnNumber: number): string {
        let columnLetter = ""
        while (columnNumber > 0) {
            columnNumber--
            columnLetter = String.fromCharCode(65 + (columnNumber % 26)) + columnLetter
            columnNumber = Math.floor(columnNumber / 26)
        }
        return columnLetter
    }
}