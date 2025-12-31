#!/usr/bin/env node
// cli.js
//import { migrateUser } from "@/scripts/migrate-user.js"
import { Command } from "commander"
//import { migrateEntities } from "./scripts/migrate-entity-bulk.js"
//import { migrateEntity } from "./scripts/migrate-entity.js"
import { initiateFirstUsers } from "./scripts/migrate-first-users-smile.js"
//import { migrateLocation } from "./scripts/migrate-location.js"
//import { migrateManufacture } from "./scripts/migrate-manufacture.js"
//import { migrateMaterial } from "./scripts/migrate-material.js"
import { migrateRoleToResourceMapping } from "./scripts/migrate-roles-to-resource-mapping.js"
import { migrateUserKeycloak } from "./scripts/migrate-user-keycloak.js"
import {
  runMigrations,
  rollbackMigration,
} from "./common/infrastructure/database/index.js"
import { runWorker } from "./server.js"
import { sendingRecapNotif } from "./modules/notification/notification.recap-module.js"
import { syncAsikAggregateCron } from "./scripts/cron/asik/asik.js"
import {
  dailyAssetCalibrationReminder,
  dailyAssetMaintenanceReminder,
  dailyAssetWarrantyReminder,
} from "./scripts/cron/asset/daily_asset_reminder.js"

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
  .command("run-worker")
  .description("Start the worker")
  .action(async () => runWorker())

/*
program
  .command("migrate-user")
  .description("Migrate user data from existing smile database")
  .option("--reset", "Reset cache index")
  .option("--limit <limit>")
  .option("--programId <programId>")
  .action(async (option) =>
    migrateUser(option.reset, Number(option.limit), Number(option.programId))
  )

program
  .command("migrate-entity")
  .description("Migrate entity data from existing smile database")
  .option("--reset", "Reset cache index")
  .option("--limit <limit>")
  .option("--programId <programId>")
  .action(async (option) =>
    migrateEntity(option.reset, Number(option.limit), Number(option.programId))
  )

program
  .command("migrate-entity-bulk")
  .description("Migrate entity data from existing smile database")
  .option("--batchSize <limit>")
  .option("--programId <programId>")
  .action(async (option) =>
    migrateEntities(Number(option.batchSize), Number(option.programId))
  )



program
  .command("migrate-location")
  .description("Migrate location data from existing smile database")
  .action(async () => migrateLocation())

program
  .command("migrate-material")
  .description("Migrate material data from existing smile database")
  .option("--is-hierarchy", "Determine if materials have hierarchy")
  .option("--programId <programId>")
  .action(async (option) =>
    migrateMaterial(option.isHierarchy, Number(option.programId))
  )

program
  .command("migrate-manufacture")
  .description("Migrate manufacture data from existing smile database")
  .option("--reset", "Reset cache index")
  .option("--limit <limit>")
  .option("--programId <programId>")
  .action(async (option) =>
    migrateManufacture(
      option.reset,
      Number(option.limit),
      Number(option.programId)
    )
  )
*/

program
  .command("migrate-users-keycloak")
  .description(
    "Migrate user data from existing smile database into database keycloak"
  )
  .action(async () => migrateUserKeycloak())

program
  .command("migrate-first-users")
  .description("Create first users smile platform")
  .action(async () => initiateFirstUsers())

program
  .command("migrate-roles-resource-mapping")
  .description("Create first roles resource mapping")
  .action(async () => migrateRoleToResourceMapping())

program
  .command("time")
  .description("Show the current time")
  .action(() => {
    const currentTime = new Date().toLocaleString()
    console.log(`Current time: ${currentTime}`)
  })

program
  .command("recap-notif-email")
  .description("Send recap notification email to users")
  .action(async () => {
    await sendingRecapNotif()
    process.exit(0)
  })

program
  .command("asset-maintenance-reminder")
  .description("Run daily asset maintenance reminder notifications")
  .action(async () => dailyAssetMaintenanceReminder())

program
  .command("asset-calibration-reminder")
  .description("Run daily asset calibration reminder notifications")
  .action(async () => dailyAssetCalibrationReminder())

program
  .command("asset-warranty-reminder")
  .description("Run daily asset warranty reminder notifications")
  .action(async () => dailyAssetWarrantyReminder())

program
  .command("asik-aggregate-sync")
  .description("Sync ASIK daily aggregate into integration_asik_aggregate")
  .option("--input-date <inputDate>", "Input date in YYYY-MM-DD")
  .option("--page <page>", "Start page")
  .option("--no-iterate", "Only sync one page")
  .action(async (options) => {
    const page = options.page ? Number(options.page) : undefined
    await syncAsikAggregateCron(options.inputDate, page, options.iterate)
  })

program.parse(process.argv)
