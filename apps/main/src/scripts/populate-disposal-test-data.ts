import { db } from "@/common/infrastructure/database/index.js";

async function populateDisposalTestData() {
  console.log("🚀 Starting disposal shipment test data population...")

  try {
    // 1. Create test disposal shipment
    const shipmentResult = await (db as any)
      .insertInto("disposal_shipments")
      .values({
        customer_id: 4303, // PUSKESMAS KEC. KRAMAT JATI
        vendor_id: 58797,  // PKL BATU AMPAR (VENDOR)
        activity_id: 6,    // COVID-19
        status: 4,         // SHIPPED
        no_document: "TEST-DISPOSAL-001",
        created_by: 49631,
        updated_by: 49631,
        created_at: new Date(),
        updated_at: new Date(),
        shipped_at: new Date(),
      })
      .executeTakeFirst()

    const shipmentId = Number(shipmentResult.insertId)
    console.log(`✅ Created disposal shipment with ID: ${shipmentId}`)

    if (shipmentId) {
      // 2. Create disposal shipment items
      const itemResult = await (db as any)
        .insertInto("disposal_shipment_items")
        .values({
          disposal_shipment_id: shipmentId,
          master_material_id: 82, // VAKSIN INAVAC SARS Cov-2
          qty: 10,
          created_by: 49631,
          updated_by: 49631,
          created_at: new Date(),
          updated_at: new Date(),
        })
        .executeTakeFirst()

      const itemId = Number(itemResult.insertId)
      console.log(`✅ Created disposal shipment item with ID: ${itemId}`)

      if (itemId) {
        // 3. Create disposal shipment stocks
        await (db as any)
          .insertInto("disposal_shipment_stocks")
          .values({
            disposal_item_id: itemId,
            stock_id: 2779395, // Example stock ID
            transaction_reason_id: 5, // Expired/ED
            disposal_discard_qty: 5,
            disposal_received_qty: 5,
            created_at: new Date(),
            updated_at: new Date(),
          })
          .execute()

        console.log(`✅ Created disposal shipment stock`)
      }

      // 4. Create disposal shipment comments
      await (db as any)
        .insertInto("disposal_shipment_comments")
        .values({
          disposal_shipment_id: shipmentId,
          comment: "Test disposal shipment for API testing",
          disposal_shipment_status: 4, // SHIPPED
          created_by: 49631,
          created_at: new Date(),
        })
        .execute()

      console.log(`✅ Created disposal shipment comment`)
    }

    // 5. Create additional test shipments with different statuses
    const statuses = [
      { status: 1, name: "PENDING" },
      { status: 5, name: "FULFILLED" },
      { status: 6, name: "CANCELLED" }
    ]

    for (const statusInfo of statuses) {
      const additionalShipment = await (db as any)
        .insertInto("disposal_shipments")
        .values({
          customer_id: 4303,
          vendor_id: 58797,
          activity_id: 6,
          status: statusInfo.status,
          no_document: `TEST-DISPOSAL-${statusInfo.name}`,
          created_by: 49631,
          updated_by: 49631,
          created_at: new Date(),
          updated_at: new Date(),
          ...(statusInfo.status === 5 && { fulfilled_at: new Date() }),
          ...(statusInfo.status === 6 && { cancelled_at: new Date() }),
        })
        .executeTakeFirst()

      console.log(`✅ Created ${statusInfo.name} disposal shipment with ID: ${Number(additionalShipment.insertId)}`)
    }

    console.log("🎉 Test data population completed successfully!")
    console.log("\n📋 Test Data Summary:")
    console.log("- 4 disposal shipments created (SHIPPED, PENDING, FULFILLED, CANCELLED)")
    console.log("- 1 disposal shipment item created")
    console.log("- 1 disposal shipment stock created")
    console.log("- 1 disposal shipment comment created")
    console.log("\n🧪 Ready for API testing!")

  } catch (error) {
    console.error("❌ Error populating test data:", error)
    throw error
  }
}

// Run the script
populateDisposalTestData()
  .then(() => {
    console.log("✅ Script completed successfully")
    process.exit(0)
  })
  .catch((error) => {
    console.error("❌ Script failed:", error)
    process.exit(1)
  })
