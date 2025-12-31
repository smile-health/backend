#!/usr/bin/env bun
import { db } from "@/common/infrastructure/database/index.js"
import { up } from "./migrate-disposal/shipment.js"

async function runMigration() {
  console.log("🚀 Starting disposal shipment migration...")
  
  try {
    console.log("📋 Running disposal shipment table creation...")
    await up(db as any)
    
    console.log("✅ Disposal shipment migration completed successfully!")
    
    // Close database connection
    await db.destroy()
    
    process.exit(0)
  } catch (error) {
    console.error("❌ Migration failed:", error)
    process.exit(1)
  }
}

runMigration()
