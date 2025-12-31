import { IMMUNIZATION } from "../data-migration/constants/program.js"
import { getMigrationDB } from "../db.migration.js"
import { db } from "../db.platform.js"
import { materialChildren } from "../pre-data-migration/constants/material-children.js"
import { materialParents } from "../pre-data-migration/constants/material-parents.js"
import { sql } from "kysely"
import BaseTemplate from "@smile/lib/excel/index.js"
import { PROCESSOR } from "@smile/lib/excel/types.js"
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

export const validateDataSupportStage = async (
  programId = IMMUNIZATION,
  scriptName = "validate-data-support-stage",
  shouldExit = true
) => {
  const migrationDB = getMigrationDB(programId)
  console.log("🚀 Starting Pre-Migration Stage Validation...")
  console.log(`📋 Stage: '0 Pre Migration Script'`)
  console.log(`Scripts to validate:`)
  console.log(`  1. update-material-children`)
  console.log(`  2. seed-material-parents --truncate`)
  console.log(`  3. update-master-activities-code`)
  console.log(`  4. remove-duplicate-msi`)
  console.log(`  5. compare-data-entity-imun-vs-logistic`)

  const validationRecords: ValidationRecord[] = []
  const errors: string[] = []
  const warnings: string[] = []
  let recordNumber = 1

  try {
    // 0. Pre-execution checks - database state before stage
    console.log("\n🔍 Pre-Execution Checks...")
    const preExecValidation = await validatePreExecutionState(
      migrationDB,
      validationRecords,
      recordNumber
    )
    recordNumber = preExecValidation.recordNumber
    errors.push(...preExecValidation.errors)
    warnings.push(...preExecValidation.warnings)

    // 1. Validate update-material-children execution
    console.log("\n🔍 Validating update-material-children Results...")
    const childrenUpdateValidation = await validateMaterialChildrenUpdate(
      migrationDB,
      validationRecords,
      recordNumber
    )
    recordNumber = childrenUpdateValidation.recordNumber
    errors.push(...childrenUpdateValidation.errors)
    warnings.push(...childrenUpdateValidation.warnings)

    // 2. Validate seed-material-parents execution (with --truncate)
    console.log("\n🔍 Validating seed-material-parents Results...")
    const parentsSeedValidation = await validateMaterialParentsSeed(
      migrationDB,
      validationRecords,
      recordNumber
    )
    recordNumber = parentsSeedValidation.recordNumber
    errors.push(...parentsSeedValidation.errors)
    warnings.push(...parentsSeedValidation.warnings)

    // 3. Validate update-master-activities-code execution
    console.log("\n🔍 Validating update-master-activities-code Results...")
    const activitiesCodeValidation = await validateActivitiesCodeUpdate(
      migrationDB,
      validationRecords,
      recordNumber
    )
    recordNumber = activitiesCodeValidation.recordNumber
    errors.push(...activitiesCodeValidation.errors)
    warnings.push(...activitiesCodeValidation.warnings)

    // 4. Validate remove-duplicate-msi execution
    console.log("\n🔍 Validating remove-duplicate-msi Results...")
    const msiRemovalValidation = await validateMsiRemoval(
      migrationDB,
      validationRecords,
      recordNumber
    )
    recordNumber = msiRemovalValidation.recordNumber
    errors.push(...msiRemovalValidation.errors)
    warnings.push(...msiRemovalValidation.warnings)

    // 5. Validate entity comparison readiness (compare-data-entity-imun-vs-logistic)
    console.log("\n🔍 Validating Entity Data Readiness...")
    const entityComparisonValidation = await validateEntityComparison(
      migrationDB,
      validationRecords,
      recordNumber
    )
    recordNumber = entityComparisonValidation.recordNumber
    errors.push(...entityComparisonValidation.errors)
    warnings.push(...entityComparisonValidation.warnings)

    // 6. Cross-script consistency checks
    console.log("\n🔍 Validating Cross-Script Consistency...")
    const crossScriptValidation = await validateCrossScriptConsistency(
      migrationDB,
      validationRecords,
      recordNumber
    )
    recordNumber = crossScriptValidation.recordNumber
    errors.push(...crossScriptValidation.errors)
    warnings.push(...crossScriptValidation.warnings)
  } catch (error) {
    console.error("❌ Validation script failed with error:", error)
    if (shouldExit) {
      process.exit(1)
    }
  }

  console.log("\n📊 Pre-Migration Stage Validation Summary")
  console.log("==========================================")

  if (errors.length === 0 && warnings.length === 0) {
    console.log("✅ ALL CHECKS PASSED - Ready for Migration Data Support Stage")
  } else {
    if (errors.length > 0) {
      console.log(`❌ ${errors.length} ERRORS found:`)
      errors.slice(0, 10).forEach((e) => console.log(`   - ${e}`))
      if (errors.length > 10)
        console.log(`   ... and ${errors.length - 10} more errors`)
    }
    if (warnings.length > 0) {
      console.log(`⚠️  ${warnings.length} WARNINGS found:`)
      warnings.slice(0, 10).forEach((w) => console.log(`   - ${w}`))
      if (warnings.length > 10)
        console.log(`   ... and ${warnings.length - 10} more warnings`)
    }
  }

  // Export to Excel
  await exportValidationToExcel(validationRecords, errors, warnings, scriptName)

  if (shouldExit) {
    process.exit(errors.length > 0 ? 1 : 0)
  }
}

async function validatePreExecutionState(
  migrationDB: any,
  validationRecords: ValidationRecord[],
  recordNumber: number
) {
  const errors: string[] = []
  const warnings: string[] = []
  let currentRecordNumber = recordNumber

  try {
    // Check if master_materials table has data
    const materialCount = await migrationDB
      .selectFrom("master_materials")
      .select(sql<number>`count(*)`.as("count"))
      .executeTakeFirst()

    const count = Number(materialCount?.count || 0)
    if (count === 0) {
      const msg =
        "master_materials table is empty - migration may not have been performed"
      errors.push(msg)
      validationRecords.push({
        number: currentRecordNumber++,
        script: "pre-execution-check",
        category: "Database State",
        status: "ERROR",
        message: msg,
      })
    } else {
      const msg = `master_materials table contains ${count} records`
      console.log(`  ✅ ${msg}`)
      validationRecords.push({
        number: currentRecordNumber++,
        script: "pre-execution-check",
        category: "Database State",
        status: "PASS",
        message: msg,
      })
    }

    // Check if mapping_entities table exists and has data
    const mappingCount = await migrationDB
      .selectFrom("mapping_entities")
      .select(sql<number>`count(*)`.as("count"))
      .executeTakeFirst()

    const mappingRecords = Number(mappingCount?.count || 0)
    const msg2 = `mapping_entities table contains ${mappingRecords} records`
    console.log(`  ℹ️  ${msg2}`)
    validationRecords.push({
      number: currentRecordNumber++,
      script: "pre-execution-check",
      category: "Database State",
      status: "PASS",
      message: msg2,
    })
  } catch (error) {
    const msg = `Failed to check pre-execution state: ${error}`
    errors.push(msg)
    validationRecords.push({
      number: currentRecordNumber++,
      script: "pre-execution-check",
      category: "Database State",
      status: "ERROR",
      message: msg,
    })
  }

  return { recordNumber: currentRecordNumber, errors, warnings }
}

async function validateMaterialChildrenUpdate(
  migrationDB: any,
  validationRecords: ValidationRecord[],
  recordNumber: number
) {
  const errors: string[] = []
  const warnings: string[] = []
  let currentRecordNumber = recordNumber

  try {
    let updatedCount = 0
    let matchingCount = 0

    for (const child of materialChildren) {
      const material = await migrationDB
        .selectFrom("master_materials")
        .select(["id", "name", "kfa_code", "description", "updated_at"])
        .where("id", "=", child.id)
        .executeTakeFirst()

      if (!material) {
        const msg = `Material Child ID ${child.id} not found in database`
        errors.push(msg)
        validationRecords.push({
          number: currentRecordNumber++,
          script: "update-material-children",
          category: "Material Update",
          status: "ERROR",
          message: msg,
        })
        continue
      }

      let childMatches = true

      if (child.name && material.name !== child.name) {
        childMatches = false
      }

      if (child.kfa_code && material.kfa_code !== child.kfa_code) {
        childMatches = false
      }

      if (childMatches) {
        matchingCount++
      }

      // Check activity associations
      if (child.activity_ids && child.activity_ids.length > 0) {
        const activityCount = await migrationDB
          .selectFrom("master_material_has_activities")
          .select(sql<number>`count(*)`.as("count"))
          .where("master_material_id", "=", child.id)
          .where("activity_id", "in", child.activity_ids)
          .executeTakeFirst()

        const linkedCount = Number(activityCount?.count || 0)
        if (linkedCount === child.activity_ids.length) {
          updatedCount++
        } else {
          const msg = `Material ${child.id}: Activity associations incomplete (${linkedCount}/${child.activity_ids.length})`
          warnings.push(msg)
          validationRecords.push({
            number: currentRecordNumber++,
            script: "update-material-children",
            category: "Material Update",
            status: "WARNING",
            message: msg,
          })
        }
      }
    }

    const summaryMsg = `Material children: ${matchingCount}/${materialChildren.length} attributes matched, ${updatedCount} with proper activity links`
    console.log(`  📊 ${summaryMsg}`)
    validationRecords.push({
      number: currentRecordNumber++,
      script: "update-material-children",
      category: "Material Update",
      status: matchingCount === materialChildren.length ? "PASS" : "WARNING",
      message: summaryMsg,
    })
  } catch (error) {
    const msg = `Failed to validate material children update: ${error}`
    errors.push(msg)
    validationRecords.push({
      number: currentRecordNumber++,
      script: "update-material-children",
      category: "Material Update",
      status: "ERROR",
      message: msg,
    })
  }

  return { recordNumber: currentRecordNumber, errors, warnings }
}

async function validateMaterialParentsSeed(
  migrationDB: any,
  validationRecords: ValidationRecord[],
  recordNumber: number
) {
  const errors: string[] = []
  const warnings: string[] = []
  let currentRecordNumber = recordNumber

  try {
    let successCount = 0
    let missingCount = 0

    for (const parent of materialParents) {
      const parentRecord = await migrationDB
        .selectFrom("master_materials")
        .select(["id", "kfa_level_id"])
        .where("description", "=", parent.description)
        .where("kfa_level_id", "=", 2)
        .executeTakeFirst()

      if (!parentRecord) {
        missingCount++
        errors.push(
          `Parent material '${parent.description}' not found with kfa_level_id = 2`
        )
        continue
      }

      const childrenLinked = await migrationDB
        .selectFrom("master_materials")
        .select(sql<number>`count(*)`.as("count"))
        .where("parent_id", "=", parentRecord.id)
        .where("id", "in", parent.children_ids)
        .executeTakeFirst()

      const linkedCount = Number(childrenLinked?.count || 0)
      if (linkedCount === parent.children_ids.length) {
        successCount++
      } else {
        warnings.push(
          `Parent '${parent.description}': ${linkedCount}/${parent.children_ids.length} children linked`
        )
      }
    }

    const summaryMsg = `Material parents: ${successCount}/${materialParents.length} successfully seeded with correct hierarchy`
    console.log(`  📊 ${summaryMsg}`)
    validationRecords.push({
      number: currentRecordNumber++,
      script: "seed-material-parents",
      category: "Material Parents",
      status: missingCount === 0 ? "PASS" : "ERROR",
      message: summaryMsg,
    })

    if (missingCount > 0) {
      errors.push(
        `${missingCount} parent materials missing after seed-material-parents`
      )
    }
  } catch (error) {
    const msg = `Failed to validate material parents seed: ${error}`
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

async function validateActivitiesCodeUpdate(
  migrationDB: any,
  validationRecords: ValidationRecord[],
  recordNumber: number
) {
  const errors: string[] = []
  const warnings: string[] = []
  let currentRecordNumber = recordNumber

  try {
    let correctCount = 0
    let incorrectCount = 0

    for (const [activityId, expectedCode] of Object.entries(
      ACTIVITY_CODE_MAPPING
    )) {
      const id = parseInt(activityId)
      const activity = await migrationDB
        .selectFrom("master_activities")
        .select(["id", "code"])
        .where("id", "=", id)
        .executeTakeFirst()

      if (!activity) {
        errors.push(`Activity ID ${id} not found`)
        incorrectCount++
        continue
      }

      if (activity.code === expectedCode) {
        correctCount++
      } else {
        errors.push(
          `Activity ${id}: Code is '${activity.code || "NULL"}', expected '${expectedCode}'`
        )
        incorrectCount++
      }
    }

    const summaryMsg = `Master activities code: ${correctCount}/${Object.keys(ACTIVITY_CODE_MAPPING).length} have correct codes`
    console.log(`  📊 ${summaryMsg}`)
    validationRecords.push({
      number: currentRecordNumber++,
      script: "update-master-activities-code",
      category: "Activities Code",
      status: incorrectCount === 0 ? "PASS" : "ERROR",
      message: summaryMsg,
    })
  } catch (error) {
    const msg = `Failed to validate activities code update: ${error}`
    errors.push(msg)
    validationRecords.push({
      number: currentRecordNumber++,
      script: "update-master-activities-code",
      category: "Activities Code",
      status: "ERROR",
      message: msg,
    })
  }

  return { recordNumber: currentRecordNumber, errors, warnings }
}

async function validateMsiRemoval(
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
      const msg = `Found ${duplicates.length} remaining duplicate id_satu_sehat groups after removal`
      warnings.push(msg)
      validationRecords.push({
        number: currentRecordNumber++,
        script: "remove-duplicate-msi",
        category: "Duplicate MSI",
        status: "WARNING",
        message: msg,
      })

      // Count total duplicates
      const totalDups = duplicates.reduce(
        (sum, d) => sum + (d.count as number) - 1,
        0
      )
      const dupMsg = `Total ${totalDups} duplicate records remaining`
      console.log(`  ⚠️  ${dupMsg}`)
      validationRecords.push({
        number: currentRecordNumber++,
        script: "remove-duplicate-msi",
        category: "Duplicate MSI",
        status: "WARNING",
        message: dupMsg,
      })
    } else {
      const msg = "No duplicate id_satu_sehat values found - removal successful"
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
    const msg = `Failed to validate MSI removal: ${error}`
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

async function validateEntityComparison(
  migrationDB: any,
  validationRecords: ValidationRecord[],
  recordNumber: number
) {
  const errors: string[] = []
  const warnings: string[] = []
  let currentRecordNumber = recordNumber

  try {
    // Check entity data readiness for comparison
    const entityCount = await migrationDB
      .selectFrom("entities")
      .select(sql<number>`count(*)`.as("count"))
      .executeTakeFirst()

    const count = Number(entityCount?.count || 0)
    if (count === 0) {
      const msg = "No entities found - migration not ready for comparison"
      errors.push(msg)
      validationRecords.push({
        number: currentRecordNumber++,
        script: "compare-data-entity-imun-vs-logistic",
        category: "Entity Comparison",
        status: "ERROR",
        message: msg,
      })
    } else {
      const msg = `${count} entities ready for comparison`
      console.log(`  ✅ ${msg}`)
      validationRecords.push({
        number: currentRecordNumber++,
        script: "compare-data-entity-imun-vs-logistic",
        category: "Entity Comparison",
        status: "PASS",
        message: msg,
      })
    }

    // Check entity with missing id_satu_sehat
    const nullMsiCount = await migrationDB
      .selectFrom("mapping_entities")
      .select(sql<number>`count(*)`.as("count"))
      .where("id_satu_sehat", "is", null)
      .executeTakeFirst()

    const nullCount = Number(nullMsiCount?.count || 0)
    if (nullCount > 0) {
      const msg = `${nullCount} entities with null id_satu_sehat`
      warnings.push(msg)
      validationRecords.push({
        number: currentRecordNumber++,
        script: "compare-data-entity-imun-vs-logistic",
        category: "Entity Comparison",
        status: "WARNING",
        message: msg,
      })
    }
  } catch (error) {
    const msg = `Failed to validate entity comparison: ${error}`
    errors.push(msg)
    validationRecords.push({
      number: currentRecordNumber++,
      script: "compare-data-entity-imun-vs-logistic",
      category: "Entity Comparison",
      status: "ERROR",
      message: msg,
    })
  }

  return { recordNumber: currentRecordNumber, errors, warnings }
}

async function validateCrossScriptConsistency(
  migrationDB: any,
  validationRecords: ValidationRecord[],
  recordNumber: number
) {
  const errors: string[] = []
  const warnings: string[] = []
  let currentRecordNumber = recordNumber

  try {
    // Check for orphaned child materials after parent seeding
    const orphans = await migrationDB
      .selectFrom("master_materials")
      .select(sql<number>`count(*)`.as("count"))
      .where("kfa_level_id", "=", 3)
      .where("parent_id", "is", null)
      .executeTakeFirst()

    const orphanCount = Number(orphans?.count || 0)
    if (orphanCount > 0) {
      const msg = `Found ${orphanCount} orphaned child materials (kfa_level_id=3 without parent)`
      errors.push(msg)
      validationRecords.push({
        number: currentRecordNumber++,
        script: "cross-script-consistency",
        category: "Consistency",
        status: "ERROR",
        message: msg,
      })
    } else {
      const msg = "No orphaned child materials found"
      console.log(`  ✅ ${msg}`)
      validationRecords.push({
        number: currentRecordNumber++,
        script: "cross-script-consistency",
        category: "Consistency",
        status: "PASS",
        message: msg,
      })
    }

    // Verify parent materials have kfa_level_id = 2
    const invalidParents = await migrationDB
      .selectFrom("master_materials")
      .select(sql<number>`count(*)`.as("count"))
      .where("kfa_level_id", "=", 2)
      .where("parent_id", "is not", null)
      .executeTakeFirst()

    const invalidCount = Number(invalidParents?.count || 0)
    if (invalidCount > 0) {
      const msg = `Found ${invalidCount} level-2 materials with parent_id (should not have parents)`
      warnings.push(msg)
      validationRecords.push({
        number: currentRecordNumber++,
        script: "cross-script-consistency",
        category: "Consistency",
        status: "WARNING",
        message: msg,
      })
    }

    // Check for entities ready for next stage
    const readyEntities = await migrationDB
      .selectFrom("entities")
      .select(sql<number>`count(*)`.as("count"))
      .where("deleted_at", "is", null)
      .executeTakeFirst()

    const readyCount = Number(readyEntities?.count || 0)
    const msg = `${readyCount} active entities ready for next migration stage`
    console.log(`  ℹ️  ${msg}`)
    validationRecords.push({
      number: currentRecordNumber++,
      script: "cross-script-consistency",
      category: "Consistency",
      status: "PASS",
      message: msg,
    })
  } catch (error) {
    const msg = `Failed to validate cross-script consistency: ${error}`
    errors.push(msg)
    validationRecords.push({
      number: currentRecordNumber++,
      script: "cross-script-consistency",
      category: "Consistency",
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
    excel.setTitle("Pre-Migration Stage Validation Report")

    // Create main validation results sheet
    await excel.initSheet("Validation Results")
    excel.setColumns(
      [
        { header: "Row Number", width: 12, key: "number" },
        { header: "Script", width: 35, key: "script" },
        { header: "Category", width: 25, key: "category" },
        { header: "Status", width: 12, key: "status" },
        { header: "Message", width: 100, key: "message" },
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
      {
        metric: "Stage Ready",
        value: errors.length === 0 ? "YES ✅" : "NO ❌",
      },
    ]

    excel.setColumns(
      [
        { header: "Metric", width: 25, key: "metric" },
        { header: "Value", width: 20, key: "value" },
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
      script: script.replace(/-/g, " ").toUpperCase(),
      pass: stats.pass,
      error: stats.error,
      warning: stats.warning,
    }))

    excel.setColumns(
      [
        { header: "Script Name", width: 40, key: "script" },
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
          { header: "Error Message", width: 120, key: "error" },
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
          { header: "Warning Message", width: 120, key: "warning" },
        ],
        "A1",
        "Warnings"
      )

      await excel.addRows("Warnings", warningData, 2, "A")
      await excel.setRowFontBold("Warnings", 1)
      await excel.autoFitColumns("Warnings")
    }

    // Create execution recommendations sheet
    await excel.initSheet("Recommendations")
    const recommendations = []

    if (errors.length === 0 && warnings.length === 0) {
      recommendations.push({
        stage: "✅ PRE-MIGRATION STAGE",
        recommendation: "READY TO PROCEED",
        action:
          "Execute stage '2 Migrate data support' (entity-bulk, user-bulk, manufacture, material migrations)",
        priority: "HIGH",
      })
    } else {
      if (errors.length > 0) {
        recommendations.push({
          stage: "❌ ERRORS DETECTED",
          recommendation: "RESOLVE BEFORE PROCEEDING",
          action: "Review error logs and fix issues before continuing",
          priority: "CRITICAL",
        })
      }
      if (warnings.length > 0) {
        recommendations.push({
          stage: "⚠️  WARNINGS DETECTED",
          recommendation: "REVIEW AND MONITOR",
          action: "Verify warnings do not impact downstream migrations",
          priority: "MEDIUM",
        })
      }
    }

    excel.setColumns(
      [
        { header: "Stage Status", width: 25, key: "stage" },
        { header: "Recommendation", width: 30, key: "recommendation" },
        { header: "Action", width: 60, key: "action" },
        { header: "Priority", width: 12, key: "priority" },
      ],
      "A1",
      "Recommendations"
    )

    await excel.addRows("Recommendations", recommendations, 2, "A")
    await excel.setRowFontBold("Recommendations", 1)
    await excel.autoFitColumns("Recommendations")

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
