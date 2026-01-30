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

const ACTIVITY_CODE_MAPPING: Record<number, string> = {
  1: "rutin",
  2: "bias",
  3: "ori",
  4: "campaign",
  6: "covid",
  7: "bian",
  11: "extended",
  12: "rabies",
  18: "dengue",
  19: "difteri",
}

export const validateGlobalStage = async (
  programId = IMMUNIZATION,
  scriptName = "validate-global-stage",
  shouldExit = true
) => {
  const migrationDB = getMigrationDB(programId)
  console.log("🚀 Starting Selection Stage Validation...")

  const validationRecords: ValidationRecord[] = []
  const errors: string[] = []
  const warnings: string[] = []
  let recordNumber = 1

  try {
    // 1. Validate Master Activities Code (update-master-activities-code)
    console.log("\n🔍 Validating Master Activities Code Update...")
    const activitiesValidation = await validateMasterActivitiesCode(
      migrationDB,
      validationRecords,
      recordNumber
    )
    recordNumber = activitiesValidation.recordNumber
    errors.push(...activitiesValidation.errors)
    warnings.push(...activitiesValidation.warnings)

    // 2. Validate Material Parents Seeding (seed-material-parents)
    console.log("\n🔍 Validating Material Parents Seeding...")
    const parentsValidation = await validateMaterialParents(
      migrationDB,
      validationRecords,
      recordNumber
    )
    recordNumber = parentsValidation.recordNumber
    errors.push(...parentsValidation.errors)
    warnings.push(...parentsValidation.warnings)

    // 3. Validate Material Children Update (update-material-children)
    console.log("\n🔍 Validating Material Children Update...")
    const childrenValidation = await validateMaterialChildren(
      migrationDB,
      validationRecords,
      recordNumber
    )
    recordNumber = childrenValidation.recordNumber
    errors.push(...childrenValidation.errors)
    warnings.push(...childrenValidation.warnings)

    // 4. Validate Duplicate MSI Removal (remove-duplicate-msi)
    console.log("\n🔍 Validating Duplicate MSI Removal...")
    const msiValidation = await validateDuplicateMsi(
      migrationDB,
      validationRecords,
      recordNumber
    )
    recordNumber = msiValidation.recordNumber
    errors.push(...msiValidation.errors)
    warnings.push(...msiValidation.warnings)

    // 5. Data consistency checks
    console.log("\n🔍 Validating Data Consistency...")
    const consistencyValidation = await validateDataConsistency(
      migrationDB,
      validationRecords,
      recordNumber
    )
    recordNumber = consistencyValidation.recordNumber
    errors.push(...consistencyValidation.errors)
    warnings.push(...consistencyValidation.warnings)
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

async function validateMasterActivitiesCode(
  migrationDB: any,
  validationRecords: ValidationRecord[],
  recordNumber: number
) {
  const errors: string[] = []
  const warnings: string[] = []
  let currentRecordNumber = recordNumber

  try {
    const activities = await migrationDB
      .selectFrom("master_activities")
      .select(["id", "name", "code"])
      .execute()

    let passCount = 0
    let errorCount = 0

    for (const [activityId, expectedCode] of Object.entries(
      ACTIVITY_CODE_MAPPING
    )) {
      const id = parseInt(activityId)
      const activity = activities.find((a) => a.id === id)

      if (!activity) {
        const msg = `Activity ID ${id} not found in master_activities table.`
        errors.push(msg)
        validationRecords.push({
          number: currentRecordNumber++,
          script: "update-master-activities-code",
          category: "Master Activities Code",
          status: "ERROR",
          message: msg,
        })
        errorCount++
      } else if (activity.code !== expectedCode) {
        const msg = `Activity ID ${id} (${activity.name}): Code mismatch. Expected '${expectedCode}', got '${activity.code || "NULL"}'`
        errors.push(msg)
        validationRecords.push({
          number: currentRecordNumber++,
          script: "update-master-activities-code",
          category: "Master Activities Code",
          status: "ERROR",
          message: msg,
        })
        errorCount++
      } else {
        const msg = `Activity ID ${id} (${activity.name}) has correct code: ${expectedCode}`
        console.log(`  ✅ ${msg}`)
        validationRecords.push({
          number: currentRecordNumber++,
          script: "update-master-activities-code",
          category: "Master Activities Code",
          status: "PASS",
          message: msg,
        })
        passCount++
      }
    }

    const summaryMsg = `Activity codes validation: ${passCount} passed, ${errorCount} errors`
    console.log(`  📊 ${summaryMsg}`)
    validationRecords.push({
      number: currentRecordNumber++,
      script: "update-master-activities-code",
      category: "Master Activities Code",
      status: errorCount > 0 ? "ERROR" : "PASS",
      message: summaryMsg,
    })
  } catch (error) {
    const msg = `Failed to validate master activities code: ${error}`
    errors.push(msg)
    validationRecords.push({
      number: currentRecordNumber++,
      script: "update-master-activities-code",
      category: "Master Activities Code",
      status: "ERROR",
      message: msg,
    })
  }

  return { recordNumber: currentRecordNumber, errors, warnings }
}

async function validateMaterialParents(
  migrationDB: any,
  validationRecords: ValidationRecord[],
  recordNumber: number
) {
  const errors: string[] = []
  const warnings: string[] = []
  let currentRecordNumber = recordNumber

  try {
    for (const parent of materialParents) {
      // Check if parent exists by description
      const parentRecord = await migrationDB
        .selectFrom("master_materials")
        .select(["id", "kfa_level_id", "description"])
        .where("description", "=", parent.description)
        .where("kfa_level_id", "=", 2)
        .executeTakeFirst()

      if (!parentRecord) {
        const msg = `Parent material '${parent.description}' not found with kfa_level_id = 2.`
        errors.push(msg)
        validationRecords.push({
          number: currentRecordNumber++,
          script: "seed-material-parents",
          category: "Material Parents",
          status: "ERROR",
          message: msg,
        })
        continue
      }

      // Check if all children have correct parent_id
      const childrenWithParent = await migrationDB
        .selectFrom("master_materials")
        .select(sql<number>`count(*)`.as("count"))
        .where("parent_id", "=", parentRecord.id)
        .where("id", "in", parent.children_ids)
        .executeTakeFirst()

      const linkedCount = Number(childrenWithParent?.count || 0)
      if (linkedCount !== parent.children_ids.length) {
        const msg = `Parent '${parent.description}' (ID: ${parentRecord.id}) has ${linkedCount}/${parent.children_ids.length} children linked.`
        errors.push(msg)
        validationRecords.push({
          number: currentRecordNumber++,
          script: "seed-material-parents",
          category: "Material Parents",
          status: "ERROR",
          message: msg,
        })
      } else {
        const msg = `Parent '${parent.description}' (ID: ${parentRecord.id}) has all ${linkedCount} children linked correctly.`
        console.log(`  ✅ ${msg}`)
        validationRecords.push({
          number: currentRecordNumber++,
          script: "seed-material-parents",
          category: "Material Parents",
          status: "PASS",
          message: msg,
        })
      }

      // Check if children have correct kfa_level_id = 3
      const childrenWithWrongLevel = await migrationDB
        .selectFrom("master_materials")
        .select(["id"])
        .where("parent_id", "=", parentRecord.id)
        .where("kfa_level_id", "!=", 3)
        .execute()

      if (childrenWithWrongLevel.length > 0) {
        const msg = `Parent '${parent.description}': Found ${childrenWithWrongLevel.length} children with incorrect kfa_level_id (not 3).`
        warnings.push(msg)
        validationRecords.push({
          number: currentRecordNumber++,
          script: "seed-material-parents",
          category: "Material Parents",
          status: "WARNING",
          message: msg,
        })
      }
    }

    const summaryMsg = `Material parents validation completed for ${materialParents.length} parents.`
    console.log(`  📊 ${summaryMsg}`)
    validationRecords.push({
      number: currentRecordNumber++,
      script: "seed-material-parents",
      category: "Material Parents",
      status: errors.length > 0 ? "ERROR" : "PASS",
      message: summaryMsg,
    })
  } catch (error) {
    const msg = `Failed to validate material parents: ${error}`
    errors.push(msg)
    validationRecords.push({
      number: currentRecordNumber++,
      script: "seed-material-parents",
      category: "Material Parents",
      status: "ERROR",
      message: msg,
    })
  }

  return { recordNumber: currentRecordNumber, errors, warnings }
}

async function validateMaterialChildren(
  migrationDB: any,
  validationRecords: ValidationRecord[],
  recordNumber: number
) {
  const errors: string[] = []
  const warnings: string[] = []
  let currentRecordNumber = recordNumber

  try {
    let passCount = 0
    let errorCount = 0

    for (const child of materialChildren) {
      const material = await migrationDB
        .selectFrom("master_materials")
        .select(["id", "name", "kfa_code", "description"])
        .where("id", "=", child.id)
        .executeTakeFirst()

      if (!material) {
        const msg = `Material Child ID ${child.id} not found.`
        errors.push(msg)
        validationRecords.push({
          number: currentRecordNumber++,
          script: "update-material-children",
          category: "Material Children",
          status: "ERROR",
          message: msg,
        })
        errorCount++
        continue
      }

      let childHasError = false

      if (child.name && material.name !== child.name) {
        const msg = `Material ${child.id}: Name mismatch. Expected '${child.name}', got '${material.name}'`
        errors.push(msg)
        validationRecords.push({
          number: currentRecordNumber++,
          script: "update-material-children",
          category: "Material Children",
          status: "ERROR",
          message: msg,
        })
        childHasError = true
        errorCount++
      }

      if (child.kfa_code && material.kfa_code !== child.kfa_code) {
        const msg = `Material ${child.id}: KFA Code mismatch. Expected '${child.kfa_code}', got '${material.kfa_code}'`
        errors.push(msg)
        validationRecords.push({
          number: currentRecordNumber++,
          script: "update-material-children",
          category: "Material Children",
          status: "ERROR",
          message: msg,
        })
        childHasError = true
        errorCount++
      }

      // Check if activity associations are present
      if (child.activity_ids && child.activity_ids.length > 0) {
        const activityCount = await migrationDB
          .selectFrom("master_material_has_activities")
          .select(sql<number>`count(*)`.as("count"))
          .where("master_material_id", "=", child.id)
          .where("activity_id", "in", child.activity_ids)
          .executeTakeFirst()

        const linkedCount = Number(activityCount?.count || 0)
        if (linkedCount !== child.activity_ids.length) {
          const msg = `Material ${child.id}: Has ${linkedCount}/${child.activity_ids.length} activity associations.`
          warnings.push(msg)
          validationRecords.push({
            number: currentRecordNumber++,
            script: "update-material-children",
            category: "Material Children",
            status: "WARNING",
            message: msg,
          })
        }
      }

      if (!childHasError) {
        passCount++
      }
    }

    const summaryMsg = `Material children validation: ${passCount} passed, ${errorCount} errors`
    console.log(`  📊 ${summaryMsg}`)
    validationRecords.push({
      number: currentRecordNumber++,
      script: "update-material-children",
      category: "Material Children",
      status: errorCount > 0 ? "ERROR" : "PASS",
      message: summaryMsg,
    })
  } catch (error) {
    const msg = `Failed to validate material children: ${error}`
    errors.push(msg)
    validationRecords.push({
      number: currentRecordNumber++,
      script: "update-material-children",
      category: "Material Children",
      status: "ERROR",
      message: msg,
    })
  }

  return { recordNumber: currentRecordNumber, errors, warnings }
}

async function validateDuplicateMsi(
  migrationDB: any,
  validationRecords: ValidationRecord[],
  recordNumber: number
) {
  const errors: string[] = []
  const warnings: string[] = []
  let currentRecordNumber = recordNumber

  try {
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
        number: currentRecordNumber++,
        script: "remove-duplicate-msi",
        category: "Duplicate MSI",
        status: "WARNING",
        message: msg,
      })

      duplicates.slice(0, 5).forEach((d) => {
        const dupMsg = `Duplicate MSI: ${d.id_satu_sehat} (Count: ${d.count})`
        console.log(`  ⚠️  ${dupMsg}`)
        validationRecords.push({
          number: currentRecordNumber++,
          script: "remove-duplicate-msi",
          category: "Duplicate MSI",
          status: "WARNING",
          message: dupMsg,
        })
      })
    } else {
      const msg = "No duplicate id_satu_sehat found."
      console.log(`  ✅ ${msg}`)
      validationRecords.push({
        number: currentRecordNumber++,
        script: "remove-duplicate-msi",
        category: "Duplicate MSI",
        status: "PASS",
        message: msg,
      })
    }
  } catch (error) {
    const msg = `Failed to validate duplicate MSI removal: ${error}`
    errors.push(msg)
    validationRecords.push({
      number: currentRecordNumber++,
      script: "remove-duplicate-msi",
      category: "Duplicate MSI",
      status: "ERROR",
      message: msg,
    })
  }

  return { recordNumber: currentRecordNumber, errors, warnings }
}

async function validateDataConsistency(
  migrationDB: any,
  validationRecords: ValidationRecord[],
  recordNumber: number
) {
  const errors: string[] = []
  const warnings: string[] = []
  let currentRecordNumber = recordNumber

  try {
    // Check for orphaned materials (children without parents)
    const orphanedChildren = await migrationDB
      .selectFrom("master_materials")
      .select(sql<number>`count(*)`.as("count"))
      .where("kfa_level_id", "=", 3)
      .where("parent_id", "is", null)
      .executeTakeFirst()

    const orphanedCount = Number(orphanedChildren?.count || 0)
    if (orphanedCount > 0) {
      const msg = `Found ${orphanedCount} orphaned children materials (kfa_level_id = 3 without parent_id).`
      warnings.push(msg)
      validationRecords.push({
        number: currentRecordNumber++,
        script: "data-consistency",
        category: "Data Consistency",
        status: "WARNING",
        message: msg,
      })
    } else {
      const msg = "No orphaned children materials found."
      console.log(`  ✅ ${msg}`)
      validationRecords.push({
        number: currentRecordNumber++,
        script: "data-consistency",
        category: "Data Consistency",
        status: "PASS",
        message: msg,
      })
    }

    // Check for circular parent-child relationships
    const circularRefs = await migrationDB
      .selectFrom("master_materials")
      .select(sql<number>`count(*)`.as("count"))
      .where("id", "=", sql`parent_id`)
      .executeTakeFirst()

    const circularCount = Number(circularRefs?.count || 0)
    if (circularCount > 0) {
      const msg = `Found ${circularCount} materials with circular parent-child relationships.`
      errors.push(msg)
      validationRecords.push({
        number: currentRecordNumber++,
        script: "data-consistency",
        category: "Data Consistency",
        status: "ERROR",
        message: msg,
      })
    } else {
      const msg = "No circular parent-child relationships found."
      console.log(`  ✅ ${msg}`)
      validationRecords.push({
        number: currentRecordNumber++,
        script: "data-consistency",
        category: "Data Consistency",
        status: "PASS",
        message: msg,
      })
    }

    // Check for entities with null id_satu_sehat
    const nullMsi = await migrationDB
      .selectFrom("mapping_entities")
      .select(sql<number>`count(*)`.as("count"))
      .where("id_satu_sehat", "is", null)
      .executeTakeFirst()

    const nullCount = Number(nullMsi?.count || 0)
    if (nullCount > 0) {
      const msg = `Found ${nullCount} mapping_entities records with null id_satu_sehat.`
      warnings.push(msg)
      validationRecords.push({
        number: currentRecordNumber++,
        script: "data-consistency",
        category: "Data Consistency",
        status: "WARNING",
        message: msg,
      })
    } else {
      const msg = "No null id_satu_sehat values found."
      console.log(`  ✅ ${msg}`)
      validationRecords.push({
        number: currentRecordNumber++,
        script: "data-consistency",
        category: "Data Consistency",
        status: "PASS",
        message: msg,
      })
    }
  } catch (error) {
    const msg = `Failed to validate data consistency: ${error}`
    errors.push(msg)
    validationRecords.push({
      number: currentRecordNumber++,
      script: "data-consistency",
      category: "Data Consistency",
      status: "ERROR",
      message: msg,
    })
  }

  return { recordNumber: currentRecordNumber, errors, warnings }
}

const exportValidationToExcel = async (
  records: ValidationRecord[],
  errors: string[],
  warnings: string[],
  scriptName: string
) => {
  try {
    const excel = new BaseTemplate(2, 1, PROCESSOR.EXCELJS)
    excel.setTitle("Selection Stage Validation Report")

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

    // Create script breakdown sheet
    await excel.initSheet("Script Breakdown")
    const scripts = new Map<
      string,
      { pass: number; error: number; warning: number }
    >()

    records.forEach((r) => {
      if (!scripts.has(r.script)) {
        scripts.set(r.script, { pass: 0, error: 0, warning: 0 })
      }
      const stats = scripts.get(r.script)!
      if (r.status === "PASS") stats.pass++
      else if (r.status === "ERROR") stats.error++
      else if (r.status === "WARNING") stats.warning++
    })

    const scriptData = Array.from(scripts.entries()).map(([script, stats]) => ({
      script,
      pass: stats.pass,
      error: stats.error,
      warning: stats.warning,
    }))

    excel.setColumns(
      [
        { header: "Script Name", width: 35, key: "script" },
        { header: "Pass", width: 10, key: "pass" },
        { header: "Error", width: 10, key: "error" },
        { header: "Warning", width: 10, key: "warning" },
      ],
      "A1",
      "Script Breakdown"
    )

    await excel.addRows("Script Breakdown", scriptData, 2, "A")
    await excel.setRowFontBold("Script Breakdown", 1)
    await excel.autoFitColumns("Script Breakdown")

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
