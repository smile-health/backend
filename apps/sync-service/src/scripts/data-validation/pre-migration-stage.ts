import { IMMUNIZATION } from "../data-migration/constants/program.js"
import { getMigrationDB } from "../db.migration.js"
import { materialChildren } from "../pre-data-migration/constants/material-children.js"
import { materialParents } from "../pre-data-migration/constants/material-parents.js"
import { sql } from "kysely"
import BaseTemplate from "@smile-health/lib/excel/index.js"
import { PROCESSOR } from "@smile-health/lib/excel/types.js"
import path from "path"

interface ValidationRecord {
  number: number
  script: string
  category: string
  status: "PASS" | "ERROR" | "WARNING"
  message: string
}

export const validatePreMigrationStage = async (
  programId = IMMUNIZATION,
  scriptName = "validate-pre-migration-stage",
  shouldExit = true
) => {
  const migrationDB = getMigrationDB(programId)
  console.log("🚀 Starting Post-Migration Validation...")

  const validationRecords: ValidationRecord[] = []
  const errors: string[] = []
  const warnings: string[] = []
  let recordNumber = 1

  try {
    // 1. Validate Master Activities Codes
    console.log("\n🔍 Validating Master Activities Codes...")
    const expectedCodes: Record<number, string> = {
      1: "rutin",
      6: "covid",
      12: "rabies",
    }

    for (const [id, code] of Object.entries(expectedCodes)) {
      const activity = await migrationDB
        .selectFrom("master_activities")
        .select("code")
        .where("id", "=", Number(id))
        .executeTakeFirst()

      if (!activity) {
        const msg = `Activity ID ${id} not found.`
        errors.push(msg)
        validationRecords.push({
          number: recordNumber++,
          script: scriptName,
          category: "Master Activities",
          status: "ERROR",
          message: msg,
        })
      } else if (activity.code !== code) {
        const msg = `Activity ID ${id} has wrong code. Expected '${code}', got '${activity.code}'`
        errors.push(msg)
        validationRecords.push({
          number: recordNumber++,
          script: scriptName,
          category: "Master Activities",
          status: "ERROR",
          message: msg,
        })
      } else {
        const msg = `Activity ID ${id} has correct code: ${code}`
        console.log(`  ✅ ${msg}`)
        validationRecords.push({
          number: recordNumber++,
          script: scriptName,
          category: "Master Activities",
          status: "PASS",
          message: msg,
        })
      }
    }

    // 2. Validate Material Children Updates
    console.log("\n🔍 Validating Material Children Updates (Sample)...")
    // Check first 5 defined children
    const childrenToCheck = materialChildren.slice(0, 5)

    for (const child of childrenToCheck) {
      const material = await migrationDB
        .selectFrom("master_materials")
        .select(["name", "kfa_code", "description"])
        .where("id", "=", child.id)
        .executeTakeFirst()

      if (!material) {
        const msg = `Material Child ID ${child.id} not found.`
        errors.push(msg)
        validationRecords.push({
          number: recordNumber++,
          script: scriptName,
          category: "Material Children",
          status: "ERROR",
          message: msg,
        })
        continue
      }

      if (child.name && material.name !== child.name) {
        const msg = `Material ${child.id}: Name mismatch. Expected '${child.name}', got '${material.name}'`
        errors.push(msg)
        validationRecords.push({
          number: recordNumber++,
          script: scriptName,
          category: "Material Children",
          status: "ERROR",
          message: msg,
        })
      }
      if (child.kfa_code && material.kfa_code !== child.kfa_code) {
        const msg = `Material ${child.id}: KFA Code mismatch. Expected '${child.kfa_code}', got '${material.kfa_code}'`
        errors.push(msg)
        validationRecords.push({
          number: recordNumber++,
          script: scriptName,
          category: "Material Children",
          status: "ERROR",
          message: msg,
        })
      }
    }
    const childMsg = `Checked ${childrenToCheck.length} material children samples.`
    console.log(`  ✅ ${childMsg}`)
    validationRecords.push({
      number: recordNumber++,
      script: scriptName,
      category: "Material Children",
      status: "PASS",
      message: childMsg,
    })

    // 3. Validate Material Parents Hierarchy
    console.log("\n🔍 Validating Material Parents Hierarchy...")
    for (const parent of materialParents) {
      // Check if parent exists by description (since we don't know the ID generated)
      const parentRecord = await migrationDB
        .selectFrom("master_materials")
        .select("id")
        .where("description", "=", parent.description)
        .where("kfa_level_id", "=", 2)
        .executeTakeFirst()

      if (!parentRecord) {
        const msg = `Parent material '${parent.description}' not found.`
        errors.push(msg)
        validationRecords.push({
          number: recordNumber++,
          script: scriptName,
          category: "Material Parents",
          status: "ERROR",
          message: msg,
        })
        continue
      }

      // Check if children are linked to this parent
      const childrenCount = await migrationDB
        .selectFrom("master_materials")
        .select(sql<number>`count(*)`.as("count"))
        .where("parent_id", "=", parentRecord.id)
        .where("id", "in", parent.children_ids)
        .executeTakeFirst()

      const linkedCount = Number(childrenCount?.count || 0)
      if (linkedCount !== parent.children_ids.length) {
        const msg = `Parent '${parent.description}' (ID: ${parentRecord.id}) has ${linkedCount}/${parent.children_ids.length} children linked.`
        errors.push(msg)
        validationRecords.push({
          number: recordNumber++,
          script: scriptName,
          category: "Material Parents",
          status: "ERROR",
          message: msg,
        })
      } else {
        const msg = `Parent '${parent.description}' has all ${linkedCount} children linked.`
        console.log(`  ✅ ${msg}`)
        validationRecords.push({
          number: recordNumber++,
          script: scriptName,
          category: "Material Parents",
          status: "PASS",
          message: msg,
        })
      }
    }

    // 4. Validate Duplicate MSI Removal
    console.log("\n🔍 Validating Duplicate MSI Removal...")
    const duplicates = await migrationDB
      .selectFrom("mapping_entities")
      .select(["id_satu_sehat", sql<number>`count(*)`.as("count")])
      .groupBy("id_satu_sehat")
      .having(sql`count(*)`, ">", 1)
      .execute()

    if (duplicates.length > 0) {
      const msg = `Found ${duplicates.length} remaining duplicate id_satu_sehat groups.`
      warnings.push(msg)
      validationRecords.push({
        number: recordNumber++,
        script: scriptName,
        category: "Duplicate MSI",
        status: "WARNING",
        message: msg,
      })
      duplicates.slice(0, 3).forEach((d) => {
        const dupMsg = `Duplicate MSI: ${d.id_satu_sehat} (Count: ${d.count})`
        console.log(`  ⚠️  ${dupMsg}`)
        validationRecords.push({
          number: recordNumber++,
          script: scriptName,
          category: "Duplicate MSI",
          status: "WARNING",
          message: dupMsg,
        })
      })
    } else {
      const msg = "No duplicate id_satu_sehat found."
      console.log(`  ✅ ${msg}`)
      validationRecords.push({
        number: recordNumber++,
        script: scriptName,
        category: "Duplicate MSI",
        status: "PASS",
        message: msg,
      })
    }
  } catch (error) {
    console.error("❌ Validation script failed with error:", error)
    if (shouldExit) {
      process.exit(1)
    }
  }

  console.log("\n📊 Validation Summary")
  console.log("=====================")

  if (errors.length === 0 && warnings.length === 0) {
    console.log("✅ ALL CHECKS PASSED")
  } else {
    if (errors.length > 0) {
      console.log(`❌ ${errors.length} ERRORS found:`)
      errors.forEach((e) => console.log(`   - ${e}`))
    }
    if (warnings.length > 0) {
      console.log(`⚠️  ${warnings.length} WARNINGS found:`)
      warnings.forEach((w) => console.log(`   - ${w}`))
    }
  }

  // Export to Excel
  await exportValidationToExcel(validationRecords, errors, warnings, scriptName)

  if (shouldExit) {
    process.exit(errors.length > 0 ? 1 : 0)
  }
}

const exportValidationToExcel = async (
  records: ValidationRecord[],
  errors: string[],
  warnings: string[],
  scriptName: string
) => {
  try {
    const excel = new BaseTemplate(2, 1, PROCESSOR.EXCELJS)
    excel.setTitle("Migration Validation Report")

    // Create main validation results sheet
    await excel.initSheet("Validation Results")
    excel.setColumns(
      [
        { header: "Row Number", width: 12, key: "number" },
        { header: "Script", width: 30, key: "script" },
        { header: "Category", width: 25, key: "category" },
        { header: "Status", width: 12, key: "status" },
        { header: "Message", width: 80, key: "message" },
      ],
      "A1",
      "Validation Results"
    )

    await excel.addRows("Validation Results", records, 2, "A")
    await excel.setRowFontBold("Validation Results", 1)
    await excel.autoFitColumns("Validation Results")

    // Create summary sheet
    await excel.initSheet("Summary")
    const summaryData = [
      { metric: "Total Validations", value: records.length },
      {
        metric: "Passed",
        value: records.filter((r) => r.status === "PASS").length,
      },
      { metric: "Errors", value: errors.length },
      { metric: "Warnings", value: warnings.length },
    ]

    excel.setColumns(
      [
        { header: "Metric", width: 25, key: "metric" },
        { header: "Count", width: 15, key: "value" },
      ],
      "A1",
      "Summary"
    )

    await excel.addRows("Summary", summaryData, 2, "A")
    await excel.setRowFontBold("Summary", 1)
    await excel.autoFitColumns("Summary")

    // Create errors sheet if there are errors
    if (errors.length > 0) {
      await excel.initSheet("Errors")
      const errorData = errors.map((error, index) => ({ id: index + 1, error }))

      excel.setColumns(
        [
          { header: "ID", width: 5, key: "id" },
          { header: "Error Message", width: 100, key: "error" },
        ],
        "A1",
        "Errors"
      )

      await excel.addRows("Errors", errorData, 2, "A")
      await excel.setRowFontBold("Errors", 1)
      await excel.autoFitColumns("Errors")
    }

    // Create warnings sheet if there are warnings
    if (warnings.length > 0) {
      await excel.initSheet("Warnings")
      const warningData = warnings.map((warning, index) => ({
        id: index + 1,
        warning,
      }))

      excel.setColumns(
        [
          { header: "ID", width: 5, key: "id" },
          { header: "Warning Message", width: 100, key: "warning" },
        ],
        "A1",
        "Warnings"
      )

      await excel.addRows("Warnings", warningData, 2, "A")
      await excel.setRowFontBold("Warnings", 1)
      await excel.autoFitColumns("Warnings")
    }

    const { filename } = await excel.generate(scriptName)
    const outputDir = path.join(
      process.cwd(),
      "src",
      "scripts",
      "data-validation",
      "output"
    )
    const outputPath = path.join(outputDir, `${filename}.xlsx`)

    await excel.writeFile(outputPath)
    console.log(`\n📊 Validation report exported to: ${outputPath}`)
  } catch (error) {
    console.error("❌ Failed to export validation report to Excel:", error)
  }
}
