import { ENTITY_TYPE } from "@/common/constants/entity.js"
import { getLastDateOfMonth } from "./download-report.util.js"

export class DownloadReportQuery {
  constructor() {}

  buildReceptionQuery(
    sheet: string,
    programId: number,
    state: string,
    provinceId?: number,
    regencyId?: number
  ) {
    const whereClauseState = {
      receptionNotAccepted: `
        AND dtv.orders_order_status_id in (4)
      `,
      receptionAcceptedFromMOH: `
        AND dtv.orders_order_status_id in (5) 
        AND dtv.entities_type in (5)
      `,
      receptionNotAcceptedByExpired: `
        AND dtv.expired_date < now('Asia/Jakarta')
        AND dtv.orders_order_status_id in (4)
      `,
    }
    const whereClauseProvince = provinceId
      ? `AND dtv.customer_province_id = ${provinceId}`
      : ""
    const whereClauseRegency = regencyId
      ? `AND dtv.customer_regency_id = ${regencyId}`
      : ""
    const selectedColumns =
      sheet === "detail"
        ? `
        dtv.transactions_activity_name AS activityName,
        dtv.batches_code AS batchCode,
        dtv.expired_date AS expiredBatch,
        wo.delivery_number AS deliveryNumber,
        dtv.transactions_order_id AS orderId,
        woa.shipped_at AS orderShippedAt,
        dtv.vendor_name AS vendorName,
        `
        : ""
    const selectedColumnsQty =
      sheet === "summary"
        ? `SUM(abs(dtv.transactions_change_qty)) AS qty`
        : "abs(dtv.transactions_change_qty) AS qty"
    const groupByClause = sheet === "summary" ? "GROUP BY 1,2,3,4,5,6,7" : ""
    return `
      SELECT 
        dtv.customer_province_id AS provinceId, 
        dtv.customer_province_name AS provinceName,
        dtv.customer_regency_id AS regencyId,
        dtv.customer_regency_name AS regencyName,
        dtv.customer_name AS name,
        dtv.customer_code AS code,
        dtv.dmm_name AS materialName,
        ${selectedColumns}
        ${selectedColumnsQty}
      FROM datamart_monitoring_transactions_v5 dtv FINAL
      LEFT JOIN raw_ws_orders wo ON dtv.transactions_order_id = wo.id
      LEFT JOIN raw_ws_order_audits woa ON wo.id = woa.order_id
      PREWHERE program_id = ${programId}
      WHERE 
        dtv.customer_province_id is not null
        AND dtv.transactions_transaction_type_id = 2
        ${whereClauseState[state] || ""}
        ${whereClauseProvince}
        ${whereClauseRegency}
          -- and dtv.transactions_master_material_id in {masterMaterialsId:Array(Int)}
      ${groupByClause}
      ORDER BY dtv.customer_province_id , dtv.customer_regency_name ASC;
    `
  }
  buildStockMaterialByProvince(
    state: string,
    isHierarchyEnabled: boolean,
    provinceId?: number,
    regencyId?: number
  ) {
    const whereClauseProvince = provinceId
      ? `AND dtv.entities_province_id = ${provinceId}`
      : ""
    const whereClauseRegency = regencyId
      ? `AND dtv.entities_regency_id = ${regencyId}`
      : ""
    const configs = {
      regency: {
        selectTempTable: `
          dtv.entities_regency_id AS regencyId, --AKTIFKAN UNTUK KAB/KOTA
          dtv.entities_regency_name AS regencyName, --AKTIFKAN UNTUK KAB/KOTA
        `,
        selectMain: `
          regencyId, --AKTIFKAN UNTUK KAB/KOTA
          regencyName, --AKTIFKAN UNTUK KAB/KOTA
        `,
        groupBy: ",5,6 --AKTIFKAN UNTUK KAB/KOTA",
        groupByMain: ",4,5 --AKTIFKAN UNTUK KAB/KOTA",
      },
      province: {
        selectTempTable: "",
        selectMain: "",
        groupBy: "",
        groupByMain: "",
      },
    }
    const config = configs[state]
    const materialColumn = isHierarchyEnabled
      ? "dtv.dmm_parent_id"
      : "dtv.transactions_master_material_id"
    return `
      WITH temp_table AS (
        SELECT 
          dtv.entities_province_id AS provinceId, 
          dtv.entities_province_name AS provinceName,
          ${config.selectTempTable}
          ${materialColumn} AS materialId,
          dtv.transactions_stock_id AS stockId,
          CASE 
            WHEN 
              argMax(dtv.transactions_transaction_type_id, dtv.transactions_id) =1
              THEN 0
            ELSE argMax(dtv.transactions_opening_qty, dtv.transactions_id)
          END AS openingQty,
          argMax(dtv.transactions_change_qty, dtv.transactions_id) AS changeQty
        FROM datamart_transactions_v5 dtv FINAL
        PREWHERE program_id = {programId:Int}
        WHERE
          dtv.entities_is_vendor = 1
          AND dtv.entities_type <> ${ENTITY_TYPE.CENTER}
          AND dtv.transactions_deleted_at is null
          AND dtv.master_deleted_at is null
          AND dtv.entities_province_id IS NOT NULL
          AND materialId IS NOT NULL
          ${whereClauseProvince}
          ${whereClauseRegency}
        GROUP BY
          1,2,3,4 ${config.groupBy}
      ) SELECT
          provinceId,
          provinceName,
          materialId,
          ${config.selectMain}
          SUM(openingQty + changeQty) AS total
      FROM temp_table
      GROUP BY
          1,2,3 ${config.groupByMain}
      HAVING
          total > 0
      ORDER BY
          provinceId ASC
      ;
    `
  }
  buildStockMaterialByBatch(
    state: string,
    provinceId?: number,
    regencyId?: number,
    offset?: number,
    limit?: number
  ) {
    const whereClauseProvince = provinceId
      ? `AND dtv.entities_province_id = ${provinceId}`
      : ""
    const whereClauseRegency = regencyId
      ? `AND dtv.entities_regency_id = ${regencyId}`
      : ""
    const pagination = offset ? `LIMIT ${limit} OFFSET ${offset}` : ""
    const baseQuery = `
      WITH temp_table AS (
        SELECT 
          dtv.entities_province_id AS provinceId, 
          dtv.entities_province_name AS provinceName,
          dtv.entities_regency_id AS regencyId,
          dtv.entities_regency_name AS regencyName,
          dtv.entities_name AS entityName,
          dtv.dmm_name AS materialName,
          dtv.stock_activity_name AS activityName,
          dtv.batches_code AS batchCode,
          dtv.expired_date AS expirationDate,
          dtv.entities_is_vendor AS isVendor,
          CASE 
            WHEN 
              argMax(dtv.transactions_transaction_type_id, dtv.transactions_id) =1
              THEN 0
            ELSE argMax(dtv.transactions_opening_qty, dtv.transactions_id)
          END AS openingQty,
          argMax(dtv.transactions_change_qty, dtv.transactions_id) AS changeQty
        FROM datamart_transactions_v5 dtv FINAL
        prewhere program_id = {programId:Int}
        WHERE
          dtv.entities_is_vendor = 1
          AND dtv.batches_code IS NOT NULL
          AND dtv.entities_type <> ${ENTITY_TYPE.CENTER}
          AND dtv.transactions_deleted_at is null
          AND dtv.master_deleted_at is null
          AND dtv.entities_province_id IS NOT NULL
          AND materialName IS NOT NULL
          ${whereClauseProvince}
          ${whereClauseRegency}
        GROUP BY
          1,2,3,4,5,6,7,8,9,10
      ) SELECT
          provinceId,
          provinceName,
          regencyId,
          regencyName,
          entityName,
          materialName,
          activityName,
          batchCode,
          expirationDate,
          isVendor,
          SUM(openingQty + changeQty) AS total
      FROM temp_table
      GROUP BY
          1,2,3,4,5,6,7,8,9,10
      HAVING
          total > 0
    `
    if (state !== "count") {
      return `
        ${baseQuery}
        ORDER BY
            provinceId ASC,
            regencyName ASC
        ${pagination}
      `
    }

    return `
      SELECT COUNT(*) AS total_rows
      FROM (
        ${baseQuery}
      ) AS final_result
    `
  }

  buildConsumptionByProvinceOrRegency(
    state: string,
    isHierarchyEnabled: boolean,
    provinceId?: number,
    regencyId?: number
  ) {
    const whereClauseProvince = provinceId
      ? `AND dtv.entities_province_id = ${provinceId}`
      : ""
    const whereClauseRegency = regencyId
      ? `AND dtv.entities_regency_id = ${regencyId}`
      : ""
    const configs = {
      regency: {
        selectTempTable: `
          dtv.entities_regency_id AS regencyId, --AKTIFKAN UNTUK KAB/KOTA
          dtv.entities_regency_name AS regencyName, --AKTIFKAN UNTUK KAB/KOTA
        `,
        selectMain: `
          regencyId, --AKTIFKAN UNTUK KAB/KOTA
          regencyName, --AKTIFKAN UNTUK KAB/KOTA
        `,
        groupByMain: ",4,5 --AKTIFKAN UNTUK KAB/KOTA",
      },
      province: {
        selectTempTable: "",
        selectMain: "",
        groupBy: "",
        groupByMain: "",
      },
    }
    const config = configs[state]
    const materialColumn = isHierarchyEnabled
      ? "dtv.dmm_parent_id"
      : "dtv.transactions_master_material_id"
    return `
      WITH temp_table AS (
        SELECT 
          dtv.entities_province_id AS provinceId, 
          dtv.entities_province_name AS provinceName,
          ${config.selectTempTable}
          ${materialColumn} AS materialId,
          dtv.transactions_transaction_type_id AS transactionType,
          dtv.transactions_change_qty AS changeQty
        FROM datamart_monitoring_transactions_v5 dtv FINAL
        prewhere program_id = {programId:Int}
        WHERE
          dtv.transactions_transaction_type_id IN (10,5) AND
          dtv.transactions_order_id IS NULL AND
          dtv.entities_is_vendor = 1
          ${whereClauseProvince}
          ${whereClauseRegency}
      ) SELECT
          provinceId,
          provinceName,
          ${config.selectMain}
          materialId,
          SUM(CASE WHEN transactionType = 10 THEN ABS(changeQty) 
            WHEN transactionType = 5 THEN -1* ABS(changeQty) 
          END) AS total
      FROM temp_table
      GROUP BY
          1,2,3 ${config.groupByMain}
      HAVING
          total > 0
      ORDER BY
          provinceId ASC ;
    `
  }

  buildConsumptionByEntity(provinceId?: number, regencyId?: number) {
    const whereClauseProvince = provinceId
      ? `AND dtv.entities_province_id = ${provinceId}`
      : ""
    const whereClauseRegency = regencyId
      ? `AND dtv.entities_regency_id = ${regencyId}`
      : ""
    return `
      WITH temp_table AS (
        SELECT 
          dtv.entities_province_id AS vendorProvinceId,
          dtv.entities_province_name AS vendorProvinceName,
          dtv.entities_regency_id AS vendorRegencyId,
          dtv.entities_regency_name AS vendorRegencyName,
          dtv.entities_id AS entityId,
          dtv.entities_name AS entityName,
          dtv.dmm_name AS materialName,
          dtv.dmm_unit_of_consumption_name AS materialUnit,
          dtv.batches_code AS batchCode,
          dtv.expired_date AS batchExpiry,
          dtv.manufacture_name AS manufactureName,
          dtv.vendor_name AS vendorName,
          dtv.customer_province_id AS customerProvinceId,
          dtv.customer_province_name AS customerProvinceName,
          dtv.customer_regency_id AS customerRegencyId,
          dtv.customer_regency_name AS customerRegencyName,
          dtv.customer_name AS customerName,
          dtv.transactions_created_at AS createdAt,
          dtv.transactions_transaction_type_id AS transactionType,
          dtv.transactions_change_qty AS changeQty
        FROM datamart_monitoring_transactions_v5 dtv FINAL
        PREWHERE dtv.program_id = {programId:Int}
        WHERE 
          dtv.transactions_transaction_type_id IN (10,5)
          AND dtv.transactions_order_id is null 
          ${whereClauseProvince}
          ${whereClauseRegency}
      ) SELECT
          vendorProvinceId,
          vendorProvinceName,
          vendorRegencyId,
          vendorRegencyName,
          entityId,
          entityName,
          materialName,
          materialUnit,
          batchCode,
          batchExpiry,
          manufactureName,
          vendorName,
          customerProvinceId,
          customerProvinceName,
          customerRegencyId,
          customerRegencyName,
          customerName,
          argMax(createdAt,createdAt) AS createdAt,
          'transaction.type.10' AS transactionTypeKey,
          SUM(CASE WHEN transactionType = 10 THEN ABS(changeQty)
            WHEN transactionType = 5 THEN -1*ABS(changeQty)
          END) AS total
      FROM temp_table a
      GROUP BY
          1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17
      HAVING
          total > 0
      ORDER BY
          vendorProvinceId ASC,
          vendorRegencyId ASC,
          entityName ASC,
          materialName ASC,
          vendorName ASC,
          customerProvinceId ASC,
          customerRegencyId ASC,
          customerName ASC
      ;
    `
  }

  buildDiscardQuery(provinceId?: number, regencyId?: number) {
    const whereClauseProvince = provinceId
      ? `AND dtv.entities_province_id = ${provinceId}`
      : ""
    const whereClauseRegency = regencyId
      ? `AND dtv.entities_regency_id = ${regencyId}`
      : ""
    return `
        WITH temp_table AS (
          SELECT 
            dtv.entities_province_id AS vendorProvinceId,
            dtv.entities_province_name AS vendorProvinceName,
            dtv.entities_regency_id AS vendorRegencyId,
            dtv.entities_regency_name AS vendorRegencyName,
            dtv.entities_id AS entityId,
            dtv.entities_name AS entityName,
            dtv.dmm_name AS materialName,
            dtv.dmm_unit_of_consumption_name aS materialUnit,
            dtv.batches_code aS batchCode,
            dtv.expired_date aS batchExpiry,
            dtv.manufacture_name AS manufactureName,
            dtv.vendor_name AS vendorName,
            dtv.customer_province_id AS customerProvinceId,
            dtv.customer_province_name AS customerProvinceName,
            dtv.customer_regency_id AS customerRegencyId,
            dtv.customer_regency_name AS customerRegencyName,
            dtv.customer_name aS customerName,
            dtv.transactions_created_at aS createdAt,
            dtv.transactions_transaction_type_id aS transactionType,
            dtv.transactions_change_qty AS changeQty
          FROM datamart_monitoring_transactions_v5 dtv FINAL
          PREWHERE dtv.program_id = {programId:Int}
          WHERE 
            dtv.transactions_transaction_type_id IN (4,9) --discarding
            AND dtv.transactions_deleted_at IS NULL
            AND dtv.master_deleted_at IS null
            ${whereClauseProvince}
            ${whereClauseRegency}
        ) SELECT
            vendorProvinceId,
            vendorProvinceName,
            vendorRegencyId,
            vendorRegencyName,
            entityId,
            entityName,
            materialName,
            materialUnit,
            batchCode,
            batchExpiry,
            manufactureName,
            vendorName,
            customerProvinceId,
            customerProvinceName,
            customerRegencyId,
            customerRegencyName,
            customerName,
            argMax(createdAt,createdAt) AS createdAt,
	          'transaction.type.4' AS transactionTypeKey,
            SUM(CASE WHEN transactionType = 4 THEN ABS(changeQty)
              WHEN transactionType = 9 THEN -1*ABS(changeQty)
            END) AS total
        FROM temp_table a
        GROUP BY
            1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17
        HAVING
            total > 0
        ORDER BY
            vendorProvinceId ASC,
            vendorRegencyId ASC,
            entityName ASC,
            materialName ASC,
            vendorName ASC,
            customerProvinceId ASC,
            customerRegencyId ASC,
            customerName ASC
        ;
    `
  }

  buildExpiredMaterial(
    state: string,
    isHierarchyEnabled: boolean,
    provinceId?: number,
    regencyId?: number
  ) {
    const states: string[] = state.split("-")
    const whereClauseProvince = provinceId
      ? `AND dtv.entities_province_id = ${provinceId}`
      : ""
    const whereClauseRegency = regencyId
      ? `AND dtv.entities_regency_id = ${regencyId}`
      : ""
    const configs = {
      province: {
        selectColumnTemp: "",
        selectColumn: "materialId,",
        groupByTemp: ",4",
        groupBy: ",3",
      },
      regency: {
        selectColumnTemp: `
          dtv.entities_regency_id AS regencyId, --AKTIFKAN UNTUK KAB/KOTA
          dtv.entities_regency_name AS regencyName, --AKTIFKAN UNTUK KAB/KOTA
        `,
        selectColumn: `
          regencyId,
          regencyName,
          materialId,
        `,
        groupByTemp: ",4,5,6",
        groupBy: ",3,4,5",
      },
      entity: {
        selectColumnTemp: `
          dtv.entities_regency_id AS regencyId, --AKTIFKAN UNTUK KAB/KOTA
          dtv.entities_regency_name AS regencyName, --AKTIFKAN UNTUK KAB/KOTA
          dtv.entities_name AS entityName,
          dtv.dmm_name AS materialName,
          dtv.stock_activity_name AS activityName,
          dtv.batches_code AS batchCode,
          dtv.expired_date AS expirationDate,
        `,
        selectColumn: `
          regencyId,
          regencyName,
          entityName,
          materialName,
          activityName,
          batchCode,
          expirationDate,
        `,
        groupByTemp: ",4,5,6,7,8,9,10,11",
        groupBy: ",3,4,5,6,7,8,9",
      },
    }
    const config = configs[states[0]!]
    const materialColumn = isHierarchyEnabled
      ? "dtv.dmm_parent_id"
      : "dtv.transactions_master_material_id"
    const date = new Date()
    const isNextMonth = states.length > 1 ? 2 : 1
    const limitExpired = getLastDateOfMonth(
      date.getFullYear(),
      date.getMonth() + isNextMonth
    )
    return `
      WITH temp_table AS (
        SELECT 
          dtv.entities_province_id AS provinceId, 
          dtv.entities_province_name AS provinceName,
          ${config.selectColumnTemp}
          ${materialColumn} AS materialId,
          dtv.transactions_stock_id AS stockId,
          CASE 
            WHEN 
              argMax(dtv.transactions_transaction_type_id, dtv.transactions_id) =1
              THEN 0
            ELSE argMax(dtv.transactions_opening_qty, dtv.transactions_id)
          END AS openingQty,
          argMax(dtv.transactions_change_qty, dtv.transactions_id) AS changeQty
        FROM datamart_transactions_v5 dtv FINAL
        PREWHERE program_id = {programId:Int}
        WHERE
          dtv.entities_is_vendor = 1
          AND dtv.entities_type <> ${ENTITY_TYPE.CENTER}
          AND dtv.transactions_deleted_at is null
          AND dtv.master_deleted_at is null
          AND dtv.entities_province_id IS NOT NULL
          AND materialId IS NOT NULL
          AND dtv.expired_date <= toDate('${limitExpired}')
          ${whereClauseProvince}
          ${whereClauseRegency}
        GROUP BY
          1,2,3 ${config.groupByTemp}
      ) SELECT
          provinceId,
          provinceName,
          ${config.selectColumn}
          SUM(openingQty + changeQty) AS total
      FROM temp_table
      GROUP BY
          1,2 ${config.groupBy}
      HAVING
          total > 0
      ORDER BY
          provinceId ASC
      ;
    `
  }
}
