#!/usr/bin/env node
// cli.js
import { Command } from "commander"
import { runWorker } from "./index.js"
import { compareDatabases } from "./scripts/compare-dbs.js"
import { migrateActivity } from "./scripts/data-migration/global/migrate-activity.js"
import { migrateBudgetSource } from "./scripts/data-migration/global/migrate-budget-source.js"
import { migrateEntities } from "./scripts/data-migration/global/migrate-entity-bulk.js"
import { migrateGlobalData } from "./scripts/data-migration/global/migrate-global-data.js"
import { migrateLocation } from "./scripts/data-migration/global/migrate-location.js"
import { migrateManufacture } from "./scripts/data-migration/global/migrate-manufacture.js"
import { migrateMaterial } from "./scripts/data-migration/global/migrate-material.js"
import { migrateUsers } from "./scripts/data-migration/global/migrate-user-bulk.js"
import { migrateUserChangelogs } from "./scripts/data-migration/global/migrate-user-changelogs.js"
import { updateMaterialUnits } from "./scripts/data-migration/global/update-material-units.js"
import { migrateBatches } from "./scripts/data-migration/workspace/migrate-batches.js"
import { migrateEntityRelations } from "./scripts/data-migration/workspace/migrate-entity/index.js"
import {
  migrateCustomerVendorsOnly,
  migrateEntityActivitiesOnly,
  migrateEntityMaterialActivitiesOnly,
} from "./scripts/data-migration/workspace/migrate-entity/individual-migrations.js"

import { migrateMaterialRelations } from "./scripts/data-migration/workspace/migrate-material/index.js"
import { migrateOrderAndRelations } from "./scripts/data-migration/workspace/migrate-order/index.js"
import { migratePatients } from "./scripts/data-migration/workspace/migrate-patients.js"
import { migrateReconciliations } from "./scripts/data-migration/workspace/migrate-reconciliations.js"
import { migrateStockOpnames } from "./scripts/data-migration/workspace/migrate-stock-opnames.js"
import { migrateStockAndRelations } from "./scripts/data-migration/workspace/migrate-stock/index.js"
import { migrateTransactionReasons } from "./scripts/data-migration/workspace/migrate-transaction-reasons.js"
import {
  fixCreatedBy,
  fixCreatedByRaw,
} from "./scripts/data-migration/workspace/migrate-transaction/fix-created-by.js"
import { migrateTransactionAndRelations } from "./scripts/data-migration/workspace/migrate-transaction/index.js"
import {
  updateTransactionEntityActivityId,
  updateTransactionEntityActivityIdRaw,
} from "./scripts/data-migration/workspace/migrate-transaction/update-entity-activity-id.js"
import { populateRolesToResourceMapping } from "./scripts/data-migration/workspace/populate-roles-to-resource-mapping.js"
import { populateTransactionTypes } from "./scripts/data-migration/workspace/populate-transaction-type.js"

import { migrateDisposalShipment } from "./scripts/data-migration/workspace/migrate-disposal-2/disposal-shipment.js"
import { migrateDisposalStock } from "./scripts/data-migration/workspace/migrate-disposal-2/disposal-stocks.js"
import { migrateDisposalTransactions } from "./scripts/data-migration/workspace/migrate-disposal-2/disposal-transactions.js"

import { migrateAssetCommunicationProviderV3ToV5 } from "./scripts/data-migration/global/migrate-asset-communication-provider-v3-to-v5.js"
import { migrateAssetInventoryRtmdV3ToV5 } from "./scripts/data-migration/global/migrate-asset-inventory-rtmd-v3-to-v5.js"
import { migrateAssetModelV3ToV5 } from "./scripts/data-migration/global/migrate-asset-model-v3-to-v5.js"
import { migrateAssetRtmdHistoriesV3ToV5 } from "./scripts/data-migration/global/migrate-asset-rtmd-histories-v3-to-v5.js"
import { migrateAssetRtmdStatus } from "./scripts/data-migration/global/migrate-asset-rtmd-status.js"
import { migrateAssetTypeV3ToV5 } from "./scripts/data-migration/global/migrate-asset-type-v3-to-v5.js"
import { migrateAssetVendorV3ToV5 } from "./scripts/data-migration/global/migrate-asset-vendor-v3-to-v5.js"
import { migrateAssets } from "./scripts/data-migration/global/migrate-assets.js"
import { migrateMaterialVolumeV3ToV5 } from "./scripts/data-migration/global/migrate-material-volume-v3-to-v5.js"
import { migratePqsV3ToV5 } from "./scripts/data-migration/global/migrate-pqs-v3-to-v5.js"
import { populateEntityParentId } from "./scripts/data-migration/global/populate-entity-parent-id.js"
import { updateStatus } from "./scripts/data-migration/update-status.js"
import { cleanupEventReportItems } from "./scripts/data-migration/workspace/cleanup-event-report-items.js"
import { migrateAssetInventories } from "./scripts/data-migration/workspace/migrate-asset-inventories.js"
import { migrateWsAssets } from "./scripts/data-migration/workspace/migrate-assets.js"
import { migrateBiofarmaIntegration } from "./scripts/data-migration/workspace/migrate-biofarma/index.js"
import { migrateColdstorageMaterialV3ToV5 } from "./scripts/data-migration/workspace/migrate-coldstorage-material-v3-to-v5.js"
import { migrateColdstoragePerTemperatureV3ToV5 } from "./scripts/data-migration/workspace/migrate-coldstorage-per-temperature-v3-to-v5.js"
import { migrateColdstorageV3ToV5 } from "./scripts/data-migration/workspace/migrate-coldstorage-v3-to-v5.js"
import { migrateCommitmentItemV3ToV5 } from "./scripts/data-migration/workspace/migrate-commitment-item-v3-to-v5.js"
import { migrateCommitmentV3ToV5 } from "./scripts/data-migration/workspace/migrate-commitment-v3-to-v5.js"
import { migrateContractV3ToV5 } from "./scripts/data-migration/workspace/migrate-contract-v3-to-v5.js"
import { migrateEmonevIntegration } from "./scripts/data-migration/workspace/migrate-emonev/index.js"
import { migrateEntityPrepMinMax } from "./scripts/data-migration/workspace/migrate-entity-prep-min-max.js"
import { compareEntity } from "./scripts/data-migration/workspace/migrate-entity/entity-compare.js"
import { migrateEventReport } from "./scripts/data-migration/workspace/migrate-event-report.js"
import { migrateIntegrationData } from "./scripts/data-migration/workspace/migrate-integration/index.js"
import { migrateLoggerHistoriesIntegration } from "./scripts/data-migration/workspace/migrate-logger-histories/index.js"
import { migrateLoggersIntegration } from "./scripts/data-migration/workspace/migrate-loggers/index.js"
import { updateBatchMaterialId } from "./scripts/data-migration/workspace/update-batch-material-id.js"

// post data migration
import { migrateAssetModelsNonPqs } from "./scripts/post-data-migration/global/migrate-asset-models-non-pqs.js"
import { migrateAssetTypesLogistic } from "./scripts/post-data-migration/global/migrate-asset-types-logistic.js"
import { migrateAssetVendorTypesCommunicationProvider } from "./scripts/post-data-migration/global/migrate-asset-vendor-types-communication-provider.js"
import { migrateWsAssetInventories } from "./scripts/post-data-migration/global/migrate-ws-asset-inventory.js"
import { migrateWsAssetManagementSupport } from "./scripts/post-data-migration/global/migrate-ws-asset-management-support.js"

// pre data migration
import { updateMasterActivitiesCode } from "./scripts/pre-data-migration/activity/update-master-activities-code.js"
import { generateEntityCode } from "./scripts/pre-data-migration/entity/generate-entity-code.js"
import { removeDuplicateMsi } from "./scripts/pre-data-migration/entity/remove-duplicate-msi.js"
import { seedMaterialParents } from "./scripts/pre-data-migration/material/seed-material-parents.js"
import { updateMaterialChildren } from "./scripts/pre-data-migration/material/update-material-children.js"

// data validation
import { validateDataSupportStage } from "./scripts/data-validation/migrate-data-support-stage.js"
import { validateGlobalStage } from "./scripts/data-validation/migrate-global-stage.js"
import { validatePreMigrationStage } from "./scripts/data-validation/pre-migration-stage.js"

const program = new Command()

program
  .name("app-cli")
  .description("CLI for worker and utility commands")
  .version("1.0.0")

program
  .command("run-worker")
  .description("Start the worker")
  .action(async () => runWorker())

program
  .command("validate-pre-migration-stage")
  .description("Run pre-migration stage validation script")
  .option("--programId <programId>", "Program ID to validate", "1")
  .action(async (option) =>
    validatePreMigrationStage(
      Number(option.programId),
      "validate-pre-migration-stage"
    )
  )

program
  .command("validate-global-stage")
  .description("Run selection stage validation script")
  .option("--programId <programId>", "Program ID to validate", "1")
  .action(async (option) =>
    validateGlobalStage(Number(option.programId), "validate-global-stage")
  )

program
  .command("validate-data-support-stage")
  .description("Run data support stage validation script")
  .option("--programId <programId>", "Program ID to validate", "1")
  .action(async (option) =>
    validateDataSupportStage(
      Number(option.programId),
      "validate-data-support-stage"
    )
  )

program
  .command("validate-all-stages")
  .description("Run all data validation scripts")
  .option("--programId <programId>", "Program ID to validate", "1")
  .action(async (option) => {
    const programId = Number(option.programId)
    console.log("Running all validation stages...")
    await validatePreMigrationStage(
      programId,
      "validate-pre-migration-stage",
      false
    )
    await validateDataSupportStage(
      programId,
      "validate-data-support-stage",
      false
    )
    await validateGlobalStage(programId, "validate-global-stage", false)
    console.log("All validation stages completed.")
    process.exit(0)
  })

program
  .command("migrate-entity-bulk")
  .description("Migrate entity data from existing smile database")
  .option("--batchSize <limit>")
  .option("--programId <programId>")
  .option("--truncate")
  .action(async (option) =>
    migrateEntities(
      Number(option.batchSize ?? 10000),
      Number(option.programId),
      option.truncate
    )
  )

program
  .command("compare-data-entity-imun-vs-logistic")
  .description("Compare entity data from existing smile database")
  .option("--programId <programId>")
  .option("--limit <limit>")
  .action(async (option) =>
    compareEntity(Number(option.programId), Number(option.limit))
  )

program
  .command("migrate-user-bulk")
  .description("Migrate user data from existing smile database")
  .option("--batchSize <limit>")
  .option("--programId <programId>")
  .option("--truncate", "Truncate user tables before migration")
  .action(async (option) =>
    migrateUsers(
      Number(option.batchSize ?? 10000),
      Number(option.programId),
      option.truncate
    )
  )

program
  .command("migrate-location")
  .description("Migrate location data from existing smile database")
  .option("--programId <programId>")
  .action(async (option) => migrateLocation(Number(option.programId)))

program
  .command("migrate-material")
  .description("Migrate material data from existing smile database")
  .option("--is-hierarchy", "Determine if materials have hierarchy")
  .option("--programId <programId>")
  .option("--truncate", "Truncate material tables before migration")
  .action(async (option) =>
    migrateMaterial(
      option.isHierarchy,
      Number(option.programId),
      option.truncate
    )
  )

program
  .command("update-material-units")
  .description("Update material unit IDs based on source material units")
  .option("--limit <limit>", "Limit number of materials to process", "0")
  .option("--programId <programId>", "Program ID to process", "1")
  .action(async (option) =>
    updateMaterialUnits(Number(option.limit), Number(option.programId))
  )

program
  .command("migrate-manufacture")
  .description("Migrate manufacture data from existing smile database")
  .option("--limit <limit>")
  .option("--programId <programId>")
  .option("--truncate", "Truncate manufacture tables before migration")
  .action(async (option) =>
    migrateManufacture(
      Number(option.limit ?? 10000),
      Number(option.programId),
      option.truncate
    )
  )

program
  .command("migrate-budget-source")
  .description("Migrate budget-source data from existing smile database")
  .option("--limit <limit>")
  .option("--programId <programId>")
  .option("--truncate", "Truncate budget source tables before migration")
  .action(async (option) =>
    migrateBudgetSource(
      Number(option.limit ?? 10000),
      Number(option.programId),
      option.truncate
    )
  )

program
  .command("migrate-user-changelogs")
  .description("Migrate user changelogs data from existing smile database")
  .option("--limit <limit>")
  .option("--programId <programId>")
  .action(async (option) =>
    migrateUserChangelogs(Number(option.limit), Number(option.programId))
  )

program
  .command("migrate-activity")
  .description("Migrate activity data from existing smile database")
  .option("--truncate", "Truncate existing data")
  .option("--limit <limit>")
  .option("--programId <programId>")
  .action(async (option) =>
    migrateActivity(
      option.truncate,
      Number(option.limit),
      Number(option.programId)
    )
  )

program
  .command("migrate-global-data")
  .description(
    "Migrate global data (workspaces, entity tags/types, mapping activities)"
  )
  .action(async () => migrateGlobalData())

program
  .command("migrate-assets")
  .description("Migrate global from existing smile iot database")
  .option("--programId <programId>")
  .action(async (option) => migrateAssets(Number(option.programId)))

program
  .command("migrate-ws-assets")
  .description("Migrate workspace assets from existing smile iot database")
  .option("--programId <programId>")
  .action(async (option) => migrateWsAssets(Number(option.programId)))

program
  .command("migrate-ws-asset-inventories")
  .description("Migrate asset inventories from existing smile iot database")
  .option("--programId <programId>")
  .option("--truncate", "Truncate asset inventory tables before migration")
  .action(async (option) =>
    migrateAssetInventories(Number(option.programId), option.truncate)
  )

program
  .command("migrate-ws-batch")
  .description("Migrate batch data from existing smile database")
  .option("--programId <programId>")
  .option("--truncate", "Truncate batch tables before migration")
  .action(async (option) =>
    migrateBatches(Number(option.programId), option.truncate)
  )

program
  .command("migrate-ws-entity")
  .description("Migrate entity relation data from existing smile database")
  .option("--batchSize <batchSize>")
  .option("--programId <programId>")
  .option("--currentBatch <currentBatch>")
  .option("--currentProgramId <currentProgramId>")
  .option("--truncate", "Truncate entity tables before migration")
  .action(async (option) =>
    migrateEntityRelations(
      Number(option.batchSize),
      Number(option.programId),
      Number(option.currentBatch ?? 0),
      Number(option.currentProgramId ?? 0),
      option.truncate
    )
  )

program
  .command("migrate-ws-customer-vendors")
  .description("Migrate customer-vendors data from existing smile database")
  .option("--batchSize <batchSize>")
  .option("--programId <programId>")
  .option("--currentBatch <currentBatch>")
  .option("--currentProgramId <currentProgramId>")
  .option("--isSequential <isSequential>")
  .option("--truncate", "Truncate customer-vendor tables before migration")
  .action(async (option) =>
    migrateCustomerVendorsOnly(
      Number(option.batchSize),
      Number(option.programId),
      Number(option.currentBatch ?? 0),
      Number(option.currentProgramId ?? 0),
      Boolean(option.isSequential ?? false),
      option.truncate
    )
  )

program
  .command("migrate-ws-entity-activities")
  .description("Migrate entity activities data from existing smile database")
  .option("--batchSize <batchSize>")
  .option("--programId <programId>")
  .option("--currentBatch <currentBatch>")
  .option("--currentProgramId <currentProgramId>")
  .option("--truncate", "Truncate entity activity tables before migration")
  .action(async (option) =>
    migrateEntityActivitiesOnly(
      Number(option.batchSize),
      Number(option.programId),
      Number(option.currentBatch ?? 0),
      Number(option.currentProgramId ?? 0),
      option.truncate
    )
  )

program
  .command("migrate-ws-entity-material-activities")
  .description(
    "Migrate entity material activities data from existing smile database"
  )
  .option("--batchSize <batchSize>")
  .option("--programId <programId>")
  .option("--currentBatch <currentBatch>")
  .option("--currentProgramId <currentProgramId>")
  .option("--isSequential <isSequential>")
  .option(
    "--truncate",
    "Truncate entity material activity tables before migration"
  )
  .action(async (option) =>
    migrateEntityMaterialActivitiesOnly(
      Number(option.batchSize ?? 10000),
      Number(option.programId),
      Number(option.currentBatch ?? 0),
      Number(option.currentProgramId ?? 0),
      Boolean(option.isSequential ?? false),
      option.truncate
    )
  )

program
  .command("migrate-ws-material")
  .description("Migrate material relation data from existing smile database")
  .option("--batchSize <batchSize>")
  .option("--programId <programId>")
  .option("--truncate", "Truncate material tables before migration")
  .action(async (option) =>
    migrateMaterialRelations(
      Number(option.batchSize),
      Number(option.programId),
      option.truncate
    )
  )

program
  .command("migrate-ws-stock")
  .description("Migrate stock data from existing smile database")
  .option("--batchSize <batchSize>")
  .option("--programId <programId>")
  .option("--truncate", "Truncate stock tables before migration")
  .action(async (option) =>
    migrateStockAndRelations(
      Number(option.batchSize),
      Number(option.programId),
      option.truncate
    )
  )

program
  .command("migrate-ws-order")
  .description("Migrate Order data from existing smile database")
  .option("--batchSize <batchSize>")
  .option("--programId <programId>")
  .option("--truncate", "Truncate order tables before migration")
  .action(async (option) =>
    migrateOrderAndRelations(
      Number(option.batchSize),
      Number(option.programId),
      option.truncate
    )
  )

program
  .command("migrate-ws-transactions")
  .description("Migrate transactions data from existing smile database")
  .option("--batchSize <batchSize>")
  .option("--programId <programId>")
  .option("--truncate", "Truncate transaction tables before migration")
  .option(
    "--updatedAfter <updatedAfter>",
    "Only migrate rows with updatedAt >= this date (ISO string)"
  )
  .option(
    "--updatedBefore <updatedBefore>",
    "Only migrate rows with updatedAt < this date (ISO string)"
  )
  .option("--skipConsumptions", "Skip consumption migration")
  .action(async (option) =>
    migrateTransactionAndRelations(
      Number(option.batchSize),
      Number(option.programId),
      option.truncate,
      option.updatedAfter,
      option.updatedBefore,
      option.skipConsumptions
    )
  )

program
  .command("update-ws-transactions-entity-activity-id")
  .description("Update entity_activity_id for ws_transactions table")
  .option("--batchSize <batchSize>")
  .action(async (option) =>
    updateTransactionEntityActivityId(Number(option.batchSize))
  )

program
  .command("update-ws-transactions-entity-activity-id-raw")
  .description(
    "Update entity_activity_id for ws_transactions table using raw SQL"
  )
  .option("--batchSize <batchSize>")
  .action(async (option) =>
    updateTransactionEntityActivityIdRaw(Number(option.batchSize))
  )

program
  .command("populate-transaction-types")
  .description("Populate ws_transaction_types table with predefined data")
  .action(async () => populateTransactionTypes())

program
  .command("populate-roles-to-resource-mapping")
  .description("Populate roles_to_resource_mapping table with predefined data")
  .action(async () => populateRolesToResourceMapping())

program
  .command("migrate-ws-patients")
  .description("Migrate patients data from existing smile database")
  .option("--batchSize <batchSize>")
  .option("--programId <programId>")
  .option("--truncate", "Truncate patient tables before migration")
  .action(async (option) =>
    migratePatients(
      Number(option.batchSize ?? 10000),
      Number(option.programId),
      option.truncate
    )
  )

program
  .command("migrate-ws-transaction-reasons")
  .description("Migrate transaction reasons data from existing smile database")
  .option("--programId <programId>")
  .action(async (option) => migrateTransactionReasons(Number(option.programId)))

program
  .command("migrate-ws-stock-opnames")
  .description("Migrate stock opnames data from existing smile database")
  .option("--batchSize <batchSize>")
  .option("--programId <programId>")
  .option("--truncate", "Truncate disposal transaction tables before migration")
  .action(async (option) =>
    migrateStockOpnames(
      Number(option.batchSize),
      Number(option.programId),
      option.truncate
    )
  )

program
  .command("migrate-ws-reconciliations")
  .description("Migrate reconciliations data from existing smile database")
  .option("--batchSize <batchSize>")
  .option("--programId <programId>")
  .option("--truncate", "Truncate reconciliation tables before migration")
  .action(async (option) =>
    migrateReconciliations(
      Number(option.batchSize),
      Number(option.programId),
      option.truncate
    )
  )

program
  .command("migrate-ws-disposal-transactions")
  .description(
    "Migrate disposal transactions data from existing smile database"
  )
  .option("--batchSize <batchSize>")
  .option("--programId <programId>")
  .option("--truncate", "Truncate disposal transaction tables before migration")
  .action(async (option) => {
    migrateDisposalTransactions(
      Number(option.batchSize ?? 10000),
      Number(option.programId),
      option.truncate
    )
  })

program
  .command("migrate-ws-disposal-shipments")
  .description("Migrate disposal shipments data from existing smile database")
  .option("--batchSize <batchSize>")
  .option("--programId <programId>")
  .option("--truncate", "Truncate disposal shipment tables before migration")
  .action(async (option) => {
    migrateDisposalShipment(
      Number(option.batchSize ?? 10000),
      Number(option.programId),
      option.truncate
    )
  })

program
  .command("migrate-ws-disposal-stocks")
  .description("Migrate disposal stocks data from existing smile database")
  .option("--batchSize <batchSize>")
  .option("--programId <programId>")
  .option("--truncate", "Truncate disposal stock tables before migration")
  .action(async (option) => {
    migrateDisposalStock(
      Number(option.batchSize ?? 10000),
      Number(option.programId),
      option.truncate
    )
  })

program
  .command("migrate-ws-event-report")
  .description("Migrate event report data from existing smile database")
  .option("--batchSize <batchSize>")
  .option("--programId <programId>")
  .option("--truncate", "Truncate event report tables before migration")
  .action(async (option) => {
    migrateEventReport(
      Number(option.batchSize),
      Number(option.programId),
      option.truncate
    )
  })

program
  .command("migrate-ws-entity-prep-min-max")
  .description("Migrate entity prep min max data from existing smile database")
  .option("--batchSize <batchSize>")
  .option("--programId <programId>")
  .option("--truncate")
  .action(async (option) => {
    migrateEntityPrepMinMax(
      Number(option.batchSize ?? 10000),
      Number(option.programId),
      option.truncate
    )
  })

program
  .command("cleanup-ws-event-report")
  .description("Cleanup event report data in platform database")
  .option("--batchSize <batchSize>")
  .option("--programId <programId>")
  .action(async (option) => {
    cleanupEventReportItems(Number(option.batchSize), Number(option.programId))
  })

program
  .command("populate-entity-parent-id")
  .description("Populate parent_id for entities table")
  .action(async () => populateEntityParentId())

program
  .command("migrate-count")
  .description("Count data migration from existing smile database")
  .action(async () => compareDatabases())

program
  .command("update-status")
  .description(
    "Update status column to 1 in budget_sources, manufacturers, and ws_transaction_reasons tables"
  )
  .action(async () => updateStatus())

program
  .command("update-batch-material-id")
  .description("Update material_id in ws_batches from ws_stocks data")
  .option(
    "--batchSize <batchSize>",
    "Number of batches to process at once",
    "1000"
  )
  .action(async (option) => {
    updateBatchMaterialId(Number(option.batchSize))
  })

program
  .command("fix-created-by")
  .description("fix created by")
  .option(
    "--batchSize <batchSize>",
    "Number of batches to process at once",
    "1000"
  )
  .option("--programId <programId>")
  .action(async (option) => {
    fixCreatedBy(Number(option.batchSize), Number(option.programId))
  })

program
  .command("fix-created-by-raw")
  .description("fix created by using raw SQL")
  .option(
    "--batchSize <batchSize>",
    "Number of batches to process at once",
    "1000"
  )
  .option("--programId <programId>")
  .action(async (option) => {
    fixCreatedByRaw(Number(option.batchSize), Number(option.programId))
  })

program
  .command("migrate-ws-biofarma")
  .description("Migrate Biofarma integration data from existing smile database")
  .option(
    "--batchSize <batchSize>",
    "Number of records to process per batch",
    "1000"
  )
  .option("--programId <programId>", "Program ID for database selection", "1")
  .option("--truncate", "Truncate Biofarma integration tables before migration")
  .action(async (option) => {
    migrateBiofarmaIntegration(
      Number(option.batchSize),
      Number(option.programId),
      option.truncate
    )
  })

program
  .command("migrate-ws-emonev")
  .description("Migrate Emonev integration data from existing smile database")
  .option(
    "--batchSize <batchSize>",
    "Number of records to process per batch",
    "1000"
  )
  .option("--programId <programId>", "Program ID for database selection", "1")
  .option("--truncate", "Truncate Emonev integration tables before migration")
  .action(async (option) => {
    await migrateEmonevIntegration(
      Number(option.batchSize),
      Number(option.programId),
      option.truncate
    )
  })

program
  .command("migrate-ws-logger-histories")
  .description("Migrate logger history data from existing smile database")
  .option(
    "--batchSize <batchSize>",
    "Number of records to process per batch",
    "1000"
  )
  .option("--programId <programId>", "Program ID for database selection", "1")
  .option("--truncate", "Truncate logger history tables before migration")
  .action(async (option) => {
    migrateLoggerHistoriesIntegration(
      Number(option.batchSize),
      Number(option.programId),
      option.truncate
    )
  })

program
  .command("migrate-ws-loggers")
  .description("Migrate logger data from existing smile iot database")
  .option(
    "--batchSize <batchSize>",
    "Number of records to process per batch",
    "1000"
  )
  .option("--programId <programId>", "Program ID for database selection", "1")
  .option("--truncate", "Truncate logger tables before migration")
  .action(async (option) => {
    await migrateLoggersIntegration(
      Number(option.batchSize),
      Number(option.programId),
      option.truncate
    )
  })

program
  .command("migrate-ws-integration-asik")
  .description(
    "Migrate integration data (ASIK Aggregate and Ayo Sehat) from existing smile database"
  )
  .option(
    "--batchSize <batchSize>",
    "Number of records to process per batch",
    "1000"
  )
  .option("--programId <programId>", "Program ID for database selection", "1")
  .option("--truncate", "Truncate integration tables before migration")
  .action(async (option) => {
    migrateIntegrationData(
      Number(option.batchSize),
      Number(option.programId),
      option.truncate
    )
  })

program
  .command("time")
  .description("Show the current time")
  .action(() => {
    const currentTime = new Date().toLocaleString()
    console.log(`Current time: ${currentTime}`)
  })

program
  .command("migrate-asset-types-logistic")
  .option("--limit <limit>", "Limit per batch", "10000")
  .option(
    "--truncate",
    "Truncate temperature_thresholds, asset_types_temperatues and asset_types_classifications before migration"
  )
  .action(async (options) => {
    await migrateAssetTypesLogistic(Number(options.limit), options.truncate)
    process.exit(0)
  })

program
  .command("migrate-asset-models-non-pqs")
  .option("--limit <limit>", "Limit per batch", "10000")
  .option(
    "--truncate",
    "Truncate asset_models_non_temperature_capacities before migration"
  )
  .action(async (options) => {
    await migrateAssetModelsNonPqs(Number(options.limit), options.truncate)
    process.exit(0)
  })

program
  .command("seed-material-parents")
  .description("Seed material parents data from constants")
  .option("--truncate", "Delete existing material parents before seeding")
  .option("--programId <programId>", "Program ID for database selection", "1")
  .action(async (options) => {
    await seedMaterialParents(options.truncate, Number(options.programId))
    process.exit(0)
  })

program
  .command("update-material-children")
  .description("Update material children data from constants")
  .option("--programId <programId>", "Program ID for database selection", "1")
  .action(async (options) => {
    await updateMaterialChildren(Number(options.programId))
    process.exit(0)
  })

program
  .command("remove-duplicate-msi")
  .description("Remove duplicate id_satu_sehat on entities")
  .option("--programId <programId>", "Program ID for database selection", "1")
  .action(async (options) => {
    await removeDuplicateMsi(Number(options.programId))
    process.exit(0)
  })

program
  .command("update-master-activities-code")
  .description("Update master_activities code column with predefined mappings")
  .option("--programId <programId>", "Program ID for database selection", "1")
  .action(async (options) => {
    await updateMasterActivitiesCode(Number(options.programId))
    process.exit(0)
  })

program
  .command("generate-entity-code")
  .description(
    "Generate code for entities based on name, province_id, and regency_id"
  )
  .option("--programId <programId>", "Program ID for database selection", "1")
  .action(async (options) => {
    await generateEntityCode(Number(options.programId))
    process.exit(0)
  })

program
  .command("migrate-asset-types-v3-to-v5")
  .option("--limit <limit>", "Limit per batch", "10000")
  .option("--programId <programId>", "Program ID for database selection", "1")
  .option(
    "--truncate",
    "Truncate data on asset type mapping table based on program id"
  )
  .action(async (options) => {
    await migrateAssetTypeV3ToV5(
      Number(options.limit),
      Number(options.programId),
      options.truncate
    )
    process.exit(0)
  })

program
  .command("migrate-material-volumes-v3-to-v5")
  .option("--limit <limit>", "Limit per batch", "10000")
  .option("--programId <programId>", "Program ID for database selection", "1")
  .option(
    "--truncate",
    "Truncate data on volume material mapping table based on program id"
  )
  .action(async (options) => {
    await migrateMaterialVolumeV3ToV5(
      Number(options.limit),
      Number(options.programId),
      options.truncate
    )
    process.exit(0)
  })

program
  .command("migrate-asset-vendor-types-communication-provider")
  .action(async () => {
    await migrateAssetVendorTypesCommunicationProvider()
    process.exit(0)
  })

program
  .command("migrate-asset-vendors-v3-to-v5")
  .option("--limit <limit>", "Limit per batch", "10000")
  .option("--programId <programId>", "Program ID for database selection", "1")
  .option(
    "--truncate",
    "Truncate data on asset vendor mapping table based on program id"
  )
  .action(async (options) => {
    await migrateAssetVendorV3ToV5(
      Number(options.limit),
      Number(options.programId),
      options.truncate
    )
    process.exit(0)
  })

program
  .command("migrate-asset-communication-providers-v3-to-v5")
  .option("--limit <limit>", "Limit per batch", "10000")
  .option("--programId <programId>", "Program ID for database selection", "1")
  .option(
    "--truncate",
    "Truncate data on asset communication provider mapping table based on program id"
  )
  .action(async (options) => {
    await migrateAssetCommunicationProviderV3ToV5(
      Number(options.limit),
      Number(options.programId),
      options.truncate
    )
    process.exit(0)
  })

program
  .command("migrate-ws-asset-management-support")
  .option(
    "--truncate",
    "Truncate data on asset global management support tables"
  )
  .action(async (options) => {
    await migrateWsAssetManagementSupport(options.truncate)
    process.exit(0)
  })

program
  .command("migrate-asset-rtmd-statuses")
  .option("--truncate", "Truncate data on asset rtmd statuses table")
  .action(async (options) => {
    await migrateAssetRtmdStatus(options.truncate)
    process.exit(0)
  })

program
  .command("migrate-pqs-v3-to-v5")
  .option("--limit <limit>", "Limit per batch", "10000")
  .option("--programId <programId>", "Program ID for database selection", "1")
  .option(
    "--truncate",
    "Truncate data on cce mapping table based on program id"
  )
  .action(async (options) => {
    await migratePqsV3ToV5(
      Number(options.limit),
      Number(options.programId),
      options.truncate
    )
    process.exit(0)
  })

program
  .command("migrate-asset-models-v3-to-v5")
  .option("--limit <limit>", "Limit per batch", "10000")
  .option("--programId <programId>", "Program ID for database selection", "1")
  .option(
    "--truncate",
    "Truncate data on asset models mapping table based on program id"
  )
  .action(async (options) => {
    await migrateAssetModelV3ToV5(
      Number(options.limit),
      Number(options.programId),
      options.truncate
    )
    process.exit(0)
  })

program
  .command("migrate-post-ws-asset-inventories")
  .option("--limit <limit>", "Limit per batch", "10000")
  .action(async (options) => {
    await migrateWsAssetInventories(Number(options.limit))
    process.exit(0)
  })

program
  .command("migrate-asset-inventories-rtmds-v3-to-v5")
  .option("--limit <limit>", "Limit per batch", "10000")
  .option("--programId <programId>", "Program ID for database selection", "1")
  .option(
    "--truncate",
    "Truncate data on asset models mapping table based on program id"
  )
  .action(async (options) => {
    await migrateAssetInventoryRtmdV3ToV5(
      Number(options.limit),
      Number(options.programId),
      options.truncate
    )
    process.exit(0)
  })

program
  .command("migrate-asset-rtmd-histories-v3-to-v5")
  .option("--limit <limit>", "Limit per batch", "10000")
  .option("--startId <startId>", "start saved id to platform", "10")
  .option("--programId <programId>", "Program ID for database selection", "1")
  .option(
    "--truncate",
    "Truncate data on asset models mapping table based on program id"
  )
  .action(async (options) => {
    await migrateAssetRtmdHistoriesV3ToV5(
      Number(options.limit),
      Number(options.startId),
      Number(options.programId),
      options.truncate
    )
    process.exit(0)
  })

program
  .command("migrate-contracts-v3-to-v5")
  .option("--limit <limit>", "Limit per batch", "1000")
  .option("--programId <programId>", "Program ID for database selection", "1")
  .option(
    "--truncate",
    "Truncate data on contracts mapping table based on program id"
  )
  .action(async (options) => {
    await migrateContractV3ToV5(
      Number(options.limit),
      Number(options.programId),
      options.truncate
    )
    process.exit(0)
  })

program
  .command("migrate-commitments-v3-to-v5")
  .option("--limit <limit>", "Limit per batch", "1000")
  .option("--programId <programId>", "Program ID for database selection", "1")
  .option(
    "--truncate",
    "Truncate data on commitments mapping table based on program id"
  )
  .action(async (options) => {
    await migrateCommitmentV3ToV5(
      Number(options.limit),
      Number(options.programId),
      options.truncate
    )
    process.exit(0)
  })

program
  .command("migrate-commitment-items-v3-to-v5")
  .option("--limit <limit>", "Limit per batch", "1000")
  .option("--programId <programId>", "Program ID for database selection", "1")
  .action(async (options) => {
    await migrateCommitmentItemV3ToV5(
      Number(options.limit),
      Number(options.programId)
    )
    process.exit(0)
  })

program
  .command("migrate-coldstorages-v3-to-v5")
  .option("--limit <limit>", "Limit per batch", "1000")
  .option("--programId <programId>", "Program ID for database selection", "1")
  .option(
    "--truncate",
    "Truncate data on coldstorages mapping table based on program id"
  )
  .action(async (options) => {
    await migrateColdstorageV3ToV5(
      Number(options.limit),
      Number(options.programId),
      options.truncate
    )
    process.exit(0)
  })

program
  .command("migrate-coldstorage-materials-v3-to-v5")
  .option("--limit <limit>", "Limit per batch", "1000")
  .option("--programId <programId>", "Program ID for database selection", "1")
  .option(
    "--truncate",
    "Truncate data on coldstorage materials mapping table based on program id"
  )
  .action(async (options) => {
    await migrateColdstorageMaterialV3ToV5(
      Number(options.limit),
      Number(options.programId),
      options.truncate
    )
    process.exit(0)
  })

program
  .command("migrate-coldstorage-per-temperatures-v3-to-v5")
  .option("--limit <limit>", "Limit per batch", "1000")
  .option("--programId <programId>", "Program ID for database selection", "1")
  .option(
    "--truncate",
    "Truncate data on coldstorage per temperature mapping table based on program id"
  )
  .action(async (options) => {
    await migrateColdstoragePerTemperatureV3ToV5(
      Number(options.limit),
      Number(options.programId),
      options.truncate
    )
    process.exit(0)
  })

program
  .command("populate-the-naming-of-the-same-entity")
  .option("--limit <limit>", "Limit per batch", "1000")
  .option(
    "--location <location>",
    "Location for database selection",
    "province"
  )
  .option("--fileCsv <fileCsv>", "File CSV for upload", false)
  .action(async (options) => {
    const { populateNamingOfTheSameEntityImunVsSmile5 } = await import(
      "./scripts/data-migration/workspace/migrate-entity/populate-naming-of-the-same-entity-imun-vs-smile5.js"
    )

    await populateNamingOfTheSameEntityImunVsSmile5(
      Number(options.limit),
      options.location,
      Boolean(options.fileCsv === "true" ? true : false)
    )
    process.exit(0)
  })

program
  .command("populate-the-naming-of-the-same-entity-imun")
  .option("--limit <limit>", "Limit per batch", "1000")
  .option(
    "--location <location>",
    "Location for database selection",
    "province"
  )
  .option("--fileCsv <fileCsv>", "File CSV for upload", false)
  .action(async (options) => {
    const { populateNamingOfTheSameEntityImun } = await import(
      "./scripts/data-migration/workspace/migrate-entity/populate-naming-of-the-same-entity-imun.js"
    )

    await populateNamingOfTheSameEntityImun(
      options.limit === "null" ? null : Number(options.limit),
      options.location,
      Boolean(options.fileCsv === "true" ? true : false)
    )
    process.exit(0)
  })

program.parse(process.argv)
