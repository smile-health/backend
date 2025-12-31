import { migrateRelationsForDisposal } from "./index.js"

/**
 * Example script to run the disposal migration
 *
 * This script demonstrates how to execute the disposal migration
 * with proper configuration and error handling.
 */
async function runDisposalMigration() {
  try {
    console.log("Starting disposal migration...")

    // Configuration
    const programIds = [1] // Replace with actual program IDs to migrate
    const batchSize = 100 // Adjust batch size based on your needs

    // Run the migration
    await migrateRelationsForDisposal(programIds, batchSize)

    console.log("Disposal migration completed successfully!")
  } catch (error) {
    console.error("Disposal migration failed:", error)
    process.exit(1)
  }
}

// Execute if this file is run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runDisposalMigration()
}

export { runDisposalMigration }
