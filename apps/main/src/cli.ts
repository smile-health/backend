#!/usr/bin/env node
// cli.js
import { Command } from "commander"
import { Context } from "hono"
import {
  db,
  rollbackMigration,
  runMigrations,
} from "./common/infrastructure/database/index.js"
import { checkBiofarmaOrder } from "./modules/biofarma-order/biofarma-order.controller.js"
import { cleansingBatchStock } from "./scripts/cleansing-batch-stock.js"
import { compareOrderData } from "./scripts/clickhouse/compare-data-order.js"
import { updateOrInsertOrderListClickHouse } from "./scripts/clickhouse/sync-order-list.js"
import {
  dailyAssetCalibrationReminder,
  dailyAssetMaintenanceReminder,
  dailyAssetWarrantyReminder,
} from "./scripts/cron/asset/daily_asset_reminder.js"
import {
  syncBiofarmaDashboard,
  syncBiofarmaOrders,
} from "./scripts/cron/biofarma/sync_orders.js"
import { inactiveEntityReminder } from "./scripts/cron/entity/inactive_entity_reminder.js"
import { checkProgressExportHistory } from "./scripts/cron/export-history/check_progress_export_history.js"
import { UpdateMinMaxEMA } from "./scripts/cron/min-max-entity-material-activity/min-max-ema.js"
import { patientReminder } from "./scripts/cron/patient/patient_reminder.js"
import { dailyStockExpiredReminder } from "./scripts/cron/stock/daily_stock_expired_reminder.js"
import "./scripts/cron/stock/daily_stock_reminder.js"
import { dailyStockReminder } from "./scripts/cron/stock/daily_stock_reminder.js"
import { encryptPatients } from "./scripts/encrypt-patients.js"
import { up as migrateDisposalShipment } from "./scripts/migrate-disposal/shipment.js"
import { populateEntityMaterialsActivityFinalDistribution } from "./scripts/populate-ema-final-distribution.js"
import { populateEntityStock } from "./scripts/populate-entity-stock.js"
import { populateEntityMaterialsAndVendors } from "./scripts/populate-entity-vendors-customer-level-subdistrict.js"
import { populateCustomerVendor } from "./scripts/siha/populate-customer-vendor.js"
import { populateMasterData } from "./scripts/siha/populate-master-data.js"
import { retryValidateOrder } from "./scripts/siha/retry-validate-order.js"
import { doActivateAnnualNeedMinMax } from "./scripts/cron/annual-need-min-max/activate-annual-need-min-max.js"
import { dailyTargetSnapshot } from "./scripts/cron/daily-target-snapshot/daily_target_snapshot.js"
import { dailyBiasImmunizationRecalculation } from "./scripts/cron/bias-immunization-logistics/daily_bias_immunization_recalculation.js"
import { dailyNonBiasImmunizationRecalculation } from "./scripts/cron/non-bias-immunization-logistics/daily_non_bias_immunization_recalculation.js"
import { dailyTargetRecalculation } from "./scripts/cron/target-estimation/daily_target_recalculation.js"

const program = new Command()

program
  .name("app-cli")
  .description("CLI for worker and utility commands")
  .version("1.0.0")

program
  .command("run-migrate")
  .description("Start the migration latest")
  .action(async () => {
    await runMigrations()
  })

program
  .command("run-rollback")
  .description("Start the migration rollback")
  .action(async () => {
    await rollbackMigration()
  })

program
  .command("populate-entity-stock")
  .description("Populate entity stock data")
  .option("--entityIds <entityIds>")
  .option("--materialIds <materialIds>")
  .option("--programId <programId>")
  .action(async (option) =>
    populateEntityStock(
      option.entityIds,
      option.materialIds,
      Number(option.programId)
    )
  )

program
  .command("migrate-disposal-shipment")
  .description("Run migration for Disposal Shipment tables")
  .action(async () => {
    await migrateDisposalShipment(db as any)
    console.log("Disposal Shipment migration completed.")
  })

program
  .command("time")
  .description("Show the current time")
  .action(() => {
    const currentTime = new Date().toLocaleString()
    console.log(`Current time: ${currentTime}`)
  })

program
  .command("daily-stock-reminder")
  .description("Run daily stock reminder notifications")
  .action(async () => dailyStockReminder({} as Context))

program
  .command("daily-stock-expired-reminder")
  .description("Run daily stock expired reminder notifications")
  .action(async () => dailyStockExpiredReminder({} as Context))

program
  .command("inactive-entity-reminder")
  .description("Run inactive entity reminder notifications")
  .action(async () => inactiveEntityReminder({} as Context))

program
  .command("patient-reminder")
  .description("Run patient reminder notifications")
  .action(async () => patientReminder({} as Context))

program
  .command("check-progress-export-history")
  .description("Check progress export history")
  .action(async () => checkProgressExportHistory())

program
  .command("siha-populate-master-data")
  .description("Populate master data with activityId, kfaCodes, and msiCodes")
  .requiredOption("--activityIds <activityIds>", "Activity ID")
  .requiredOption("--kfaCodes <kfaCodes>", "Comma separated KFA codes")
  .requiredOption("--msiCodes <msiCodes>", "Comma separated MSI codes")
  .action(async (options) => {
    const activityIds = options.activityIds.split(",").map(Number)
    const kfaCodes = options.kfaCodes.split(",")
    const msiCodes = options.msiCodes.split(",").map(Number)
    await populateMasterData(activityIds, kfaCodes, msiCodes)
  })

program
  .command("update-or-insert-order-list-clickhouse")
  .description("Update or insert order list to clickhouse")
  .requiredOption("--orderIds <orderIds>", "Activity ID")
  .action(async (options) => {
    const orderIds = options.orderIds.split(",").map(Number)
    await updateOrInsertOrderListClickHouse(orderIds)
  })

program
  .command("siha-populate-customer-vendor")
  .description(
    "Populate customer and vendor data with activityId, vendorCodes, and customerCodes"
  )
  .requiredOption("--activityIds <activityIds>", "Activity IDs")
  .requiredOption("--vendorCode <vendorCode>", "Vendor msi codes")
  .requiredOption(
    "--customerCodes <customerCodes>",
    "Comma separated customer msi codes"
  )
  .action(async (options) => {
    const activityId = options.activityIds.split(",").map(Number)
    const vendorCode = Number(options.vendorCode)
    const customerCodes = options.customerCodes.split(",").map(Number)
    await populateCustomerVendor(activityId, vendorCode, customerCodes)
  })

program
  .command("compare-order-data")
  .description("Compare order data")
  .requiredOption("--programIds <programIds>", "Program IDs")
  .action(async (options) => {
    const programIds = options.programIds.split(",").map(Number)
    await compareOrderData(programIds)
  })

program
  .command("retry-validate-order")
  .requiredOption("--orderIds <orderIds>", "Order IDs")
  .description("Retry failed validate order attempts by publishing messages")
  .action(async (options) => {
    const orderIds = options.orderIds.split(",").map(Number)
    await retryValidateOrder(orderIds)
  })

program
  .command("encrypt-patient")
  .description(
    "Encrypt ws_patients name, birth_date (to enc_birth_date), address, residential_address"
  )
  .option("--batchSize <batchSize>", "Batch size (default 1000)")
  .action(async (options) => {
    const batchSize = options.batchSize ? Number(options.batchSize) : 1000
    await encryptPatients(batchSize)
  })

program
  .command("asset-maintenance-reminder")
  .description("Run daily asset maintenance reminder notifications")
  .action(async () => {
    await dailyAssetMaintenanceReminder()
  })

program
  .command("asset-calibration-reminder")
  .description("Run daily asset calibration reminder notifications")
  .action(async () => {
    await dailyAssetCalibrationReminder()
  })

program
  .command("asset-warranty-reminder")
  .description("Run daily asset warranty reminder notifications")
  .action(async () => {
    await dailyAssetWarrantyReminder()
  })

program
  .command("check-biofarma-order")
  .description("Check and process Biofarma orders")
  .option("--monthly", "Process monthly data")
  .option("--isV2", "Use V2 processing")
  .option("--startDate <startDate>", "Start date for filtering (YYYY-MM-DD)")
  .option("--endDate <endDate>", "End date for filtering (YYYY-MM-DD)")
  .action(async (options) => {
    const filterDate =
      options.startDate || options.endDate
        ? {
            start_date: options.startDate,
            end_date: options.endDate,
          }
        : null

    await checkBiofarmaOrder({
      filterDate,
      monthly: options.monthly || false,
      isV2: options.isV2 || false,
    })
  })

program
  .command("sync-biofarma-orders")
  .description("Sync Biofarma orders from external system")
  .requiredOption("--type <type>", "Order type: hub or province")
  .option("--startDate <startDate>", "Start date (YYYY-MM-DD)")
  .option("--endDate <endDate>", "End date (YYYY-MM-DD)")
  .action(async (options) => {
    const { type, startDate, endDate } = options

    if (type !== "hub" && type !== "province") {
      console.error("Error: Type must be either 'hub' or 'province'")
      process.exit(1)
    }

    await syncBiofarmaOrders(type, startDate, endDate)
  })

program
  .command("sync-biofarma-dashboard")
  .description("Sync Biofarma dashboard data from external system")
  .requiredOption("--type <type>", "Dashboard type: hub or province")
  .option("--startDate <startDate>", "Start date (YYYY-MM-DD)")
  .option("--endDate <endDate>", "End date (YYYY-MM-DD)")
  .action(async (options) => {
    const { type, startDate, endDate } = options

    if (type !== "hub" && type !== "province") {
      console.error("Error: Type must be either 'hub' or 'province'")
      process.exit(1)
    }

    await syncBiofarmaDashboard(type, startDate, endDate)
  })

program
  .command("populate-entity-materials-and-vendors")
  .description(
    "Populate entity materials and vendors at customer level subdistrict"
  )
  .requiredOption("--provinceId <provinceId>", "Province ID")
  .requiredOption("--regencyId <regencyId>", "Regency ID")
  .requiredOption("--entityTagId <entityTagId>", "Entity Tag ID")
  .requiredOption("--programId <programId>", "Program ID")
  .requiredOption("--vendorId <vendorId>", "Vendor ID")
  .action(async (options) => {
    const { provinceId, regencyId, entityTagId, programId, vendorId } = options

    await populateEntityMaterialsAndVendors({
      provinceId,
      regencyId,
      entityTagId: Number(entityTagId),
      programId: Number(programId),
      vendorId: Number(vendorId),
    })
  })

program
  .command("populate-entity-materials-activity-final-distribution")
  .description(
    "Populate entity materials and activity vendors final distribution"
  )
  .requiredOption("--provinceId <provinceId>", "Province ID")
  .requiredOption("--regencyId <regencyId>", "Regency ID")
  .requiredOption("--subDistrictId <subDistrictId>", "Sub District ID")
  .requiredOption("--programId <programId>", "Program ID")
  .requiredOption("--vendorId <vendorId>", "Vendor ID")
  .option("--activityIds <activityIds>", "Comma separated Activity IDs")
  .option("--codes <codes>", "Comma separated Entity Codes")
  .option("--names <names>", "Comma separated Entity Names")
  .action(async (options) => {
    const {
      provinceId,
      regencyId,
      subDistrictId,
      programId,
      vendorId,
      activityIds,
      codes,
      names,
    } = options

    await populateEntityMaterialsActivityFinalDistribution({
      provinceId,
      regencyId,
      subDistrictId,
      programId: Number(programId),
      vendorId: Number(vendorId),
      activityIds: activityIds
        ? activityIds.split(",").map((id: string) => Number(id))
        : [],
      codes: codes ? codes.split(",").map((id: string) => Number(id)) : [],
      names: names ? names.split(",") : [],
    })
  })
  .command("cleansing-batch-stock")
  .description("Cleansing batch stock data")
  .option("--programId <programId>")
  .option("--batchSize <batchSize>")
  .action(async (option) =>
    cleansingBatchStock(
      Number(option.programId),
      Number(option.batchSize || 1000)
    )
  )

program
  .command("update-min-max-ema")
  .description("Update min max EMA")
  .option("--programIds <programIds>")
  .option("--entityIds <entityIds>")
  .option("--materialIds <materialIds>")
  .action(
    async (option) =>
      await UpdateMinMaxEMA(
        option.programIds,
        option.entityIds,
        option.materialIds
      )
  )

program
  .command("activate-annual-need-min-max")
  .description("Activate annual need min max cron job")
  .action(async () => {
    await doActivateAnnualNeedMinMax()
  })

program
  .command("daily-target-snapshot")
  .description("Run daily target count snapshot for microplanning")
  .action(async () => {
    await dailyTargetSnapshot()
  })
  
program
  .command("daily-target-recalculation")
  .description("Run daily target estimation recalculation")
  .action(async () => {
    await dailyTargetRecalculation()
  })

program
  .command("daily-bias-immunization-recalculation")
  .description("Run daily bias immunization logistics recalculation")
  .action(async () => {
    await dailyBiasImmunizationRecalculation()
  })

program
  .command("daily-non-bias-immunization-recalculation")
  .description("Run daily non bias immunization logistics recalculation")
  .action(async () => {
    await dailyNonBiasImmunizationRecalculation()
  })

program.parse(process.argv)
