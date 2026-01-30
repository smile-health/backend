/**
 * Bias Immunization Logistics Cron Job
 *
 * This cron job recalculates BIAS (school-based) immunization logistics data daily.
 * It only updates EXISTING data in the database - it does NOT create new records.
 *
 * Flow:
 * 1. Get all microplanningIds for next year
 * 2. For each microplanning, get only schools that already have data in DB
 * 3. Recalculate vial needs based on current target counts (grade 1, 2, 5)
 * 4. Update the existing records with new calculated values
 *
 * BIAS Vaccines:
 * - August: MR (grade 1), HPV (grade 5 female)
 * - November: DT (grade 1), Td (grade 2 + grade 5)
 *
 * Tables updated:
 * - ws_material_needs (total_needs)
 * - ws_material_needs_details (kept as-is, only recalculate utilization_rate)
 * - ws_monthly_vaccine_need_details (request_qty)
 * - ws_vaccine_utilization_rate (vaccine_utilization_rate)
 * - ws_additional_needs (total)
 */
import { DB } from "@/common/infrastructure/database/types/db.js"
import { Context } from "@smile-health/lib/types/context.js"
import moment from "moment-timezone"
import { TargetsRepository } from "../targets/targets.repository.js"
import { TargetEstimationRepository } from "../target-estimation/target-estimation.repository.js"
import { BiasImmunizationLogisticsRepository } from "./bias-immunization-logistics.repository.js"
import { MaterialRepository } from "../material/material.repository.js"
import {
  PERCENTAGE_100,
  PERCENTAGE_50,
  SCHOOL_TARGET_GROUPS,
  TARGET_GROUP,
} from "@/common/constants/target.js"
import {
  calcVialNeedNoBuffer,
  safeDiv,
} from "../immunization-logistics/immunization-logistics.formula.js"
import { ProcessSchoolParams } from "./bias-immunization-logistics.schema.js"

export class BiasImmunizationCron {
  constructor(
    private readonly targetsRepo: TargetsRepository,
    private readonly targetEstimationRepo: TargetEstimationRepository,
    private readonly logisticsRepo: BiasImmunizationLogisticsRepository,
    private readonly materialRepo: MaterialRepository
  ) {}

  async #getMaterialIds(
    c: Context<DB>,
    type: "primary" | "additional",
    category: "bias" | "non_bias"
  ): Promise<{
    materialIds: number[]
    codeToIdMap: Map<string, number>
    idToCodeMap: Map<number, string>
    idToNameMap: Map<number, string>
  }> {
    const materialTargets = await this.materialRepo.findMaterialsFromTargets(
      c as any,
      type,
      category
    )

    const materialIds = materialTargets.map((m) => m.material_id)
    const rawMaterials = await this.materialRepo.findWsMaterialsByIds(
      c as any,
      materialIds
    )

    const codeToIdMap = new Map<string, number>()
    const idToCodeMap = new Map<number, string>()
    const idToNameMap = new Map<number, string>()

    const materialTargetNameMap = new Map(
      materialTargets.map((m) => [m.material_id, m.name])
    )

    rawMaterials.forEach((m) => {
      codeToIdMap.set(m.code, m.id)
      idToCodeMap.set(m.id, m.code)
      const name = materialTargetNameMap.get(m.id) ?? m.name
      idToNameMap.set(m.id, name)
    })

    return { materialIds, codeToIdMap, idToCodeMap, idToNameMap }
  }

  #findMaterialIdByCodeVariations(
    codeToIdMap: Map<string, number>,
    variations: string[]
  ): number {
    for (const variation of variations) {
      const id = codeToIdMap.get(variation)
      if (id && id !== 0) return id
    }
    return 0
  }

  #extractSchoolGrades(countMap: Map<number, number> | Record<number, number>) {
    const isMap = countMap instanceof Map
    const targetGroupId11 = 10
    return {
      grade1: isMap ? (countMap.get(4) ?? 0) : (countMap[4] ?? 0),
      grade2: isMap ? (countMap.get(5) ?? 0) : (countMap[5] ?? 0),
      grade5Female: isMap ? (countMap.get(7) ?? 0) : (countMap[7] ?? 0),
      grade5Male: isMap ? (countMap.get(targetGroupId11) ?? 0) : (countMap[targetGroupId11] ?? 0),
    }
  }

  #getBiasIds(primaryMaterials: { codeToIdMap: Map<string, number> }) {
    const mrId = this.#findMaterialIdByCodeVariations(
      primaryMaterials.codeToIdMap,
      [
        "MR",
        "MR @10 ds",
        "MR 1 @10 ds and MR 2 @10 ds",
        "VAKSIN MEASLES RUBELLA (MR) 10 DS/ PARTNERSHIP",
      ]
    )
    const dtId = this.#findMaterialIdByCodeVariations(
      primaryMaterials.codeToIdMap,
      ["DT", "DT @10 ds", "VAKSIN DT 10 DS"]
    )
    const tdId = this.#findMaterialIdByCodeVariations(
      primaryMaterials.codeToIdMap,
      ["Td", "Td @10 ds", "VAKSIN TD 10 DS"]
    )
    const hpvId = this.#findMaterialIdByCodeVariations(
      primaryMaterials.codeToIdMap,
      ["HPV", "HPV @1 DS", "HPV NusaGard"]
    )

    return { mrId, dtId, tdId, hpvId }
  }

  #getLogisticsIds(logisticMaterials: { codeToIdMap: Map<string, number> }) {
    const ads5mlId = this.#findMaterialIdByCodeVariations(
      logisticMaterials.codeToIdMap,
      ["ADS 5 ml", "ADS 5 ML", "ADS 5ml"]
    )
    const ads05mlId = this.#findMaterialIdByCodeVariations(
      logisticMaterials.codeToIdMap,
      ["ADS 0.5 ml", "ADS 0,5 ml", "ADS 0.5 ML", "ADS 0,5 ML"]
    )
    const sb25lId = this.#findMaterialIdByCodeVariations(
      logisticMaterials.codeToIdMap,
      ["SB 2.5 ltr", "SB 2.5 Ltr", "SB 2,5 ltr", "SB 2,5 Ltr", "SB 2.5 liter"]
    )
    const sb5lId = this.#findMaterialIdByCodeVariations(
      logisticMaterials.codeToIdMap,
      ["SB 5 ltr", "SB 5 Ltr", "SB 5 liter"]
    )

    return { ads5mlId, ads05mlId, sb25lId, sb5lId }
  }

  #calculateVialNeeds(
    gradeCounts: {
      grade1: number
      grade2: number
      grade5Female: number
      grade5Male: number
    },
    utilizationRates: { id: number; value: number | null }[],
    materialIds: {
      mrId: number
      dtId: number
      tdId: number
      hpvId: number
    }
  ) {
    const totalGrade1 = gradeCounts.grade1
    const totalGrade2 = gradeCounts.grade2
    const totalGrade5Female = gradeCounts.grade5Female
    const totalGrade5Male = gradeCounts.grade5Male

    const ipMR = Number(
      utilizationRates.find((r) => r.id === materialIds.mrId)?.value ?? 0
    )
    const ipDT = Number(
      utilizationRates.find((r) => r.id === materialIds.dtId)?.value ?? 0
    )
    const ipTd = Number(
      utilizationRates.find((r) => r.id === materialIds.tdId)?.value ?? 0
    )
    const ipHPV = Number(
      utilizationRates.find((r) => r.id === materialIds.hpvId)?.value ?? 0
    )

    const vialNeedMR = calcVialNeedNoBuffer(totalGrade1, ipMR)
    const vialNeedDT = calcVialNeedNoBuffer(totalGrade1, ipDT)
    const vialNeedTd = calcVialNeedNoBuffer(
      totalGrade2 + totalGrade5Female + totalGrade5Male,
      ipTd
    )
    const vialNeedHPV = calcVialNeedNoBuffer(totalGrade5Female, ipHPV)

    return {
      vialNeedMR,
      vialNeedDT,
      vialNeedTd,
      vialNeedHPV,
      ipMR,
      ipDT,
      ipTd,
      ipHPV,
    }
  }

  #calculateAdsSbNeeds(
    vialNeeds: {
      ipMR: number
      ipDT: number
      ipTd: number
      ipHPV: number
    },
    requestQty: {
      MR: number
      DT: number
      Td: number
      HPV: number
    }
  ) {
    const augustADS5ML = Math.round(requestQty.MR)
    const augustADS05ML = Math.round(
      requestQty.MR * vialNeeds.ipMR + requestQty.HPV * vialNeeds.ipHPV
    )
    const august = augustADS5ML + augustADS05ML
    const augustSB25LTR =
      august < 0
        ? Math.floor(august / PERCENTAGE_50)
        : Math.ceil(august / PERCENTAGE_50)
    const augustSB5LTR =
      august < 0
        ? Math.floor(august / PERCENTAGE_100)
        : Math.ceil(august / PERCENTAGE_100)

    const novemberADS05ML = Math.round(
      requestQty.DT * vialNeeds.ipDT + requestQty.Td * vialNeeds.ipTd
    )
    const novemberSB25LTR =
      novemberADS05ML < 0
        ? Math.floor(novemberADS05ML / PERCENTAGE_50)
        : Math.ceil(novemberADS05ML / PERCENTAGE_50)
    const novemberSB5LTR =
      novemberADS05ML < 0
        ? Math.floor(novemberADS05ML / PERCENTAGE_100)
        : Math.ceil(novemberADS05ML / PERCENTAGE_100)

    return {
      august: {
        ads5ml: augustADS5ML,
        ads05ml: augustADS05ML,
        sb25ltr: augustSB25LTR,
        sb5ltr: augustSB5LTR,
      },
      november: {
        ads05ml: novemberADS05ML,
        sb25ltr: novemberSB25LTR,
        sb5ltr: novemberSB5LTR,
      },
    }
  }

  #getVialNeedByMaterialId(
    materialId: number,
    vialNeeds: {
      vialNeedMR: number
      vialNeedDT: number
      vialNeedTd: number
      vialNeedHPV: number
    },
    biasIds: { mrId: number; dtId: number; tdId: number; hpvId: number }
  ): number {
    const mapping: Record<number, number> = {
      [biasIds.mrId]: vialNeeds.vialNeedMR,
      [biasIds.dtId]: vialNeeds.vialNeedDT,
      [biasIds.tdId]: vialNeeds.vialNeedTd,
      [biasIds.hpvId]: vialNeeds.vialNeedHPV,
    }
    return mapping[materialId] ?? 0
  }

  #getAdditionalNeedTotal(
    materialId: number,
    month: string | undefined,
    adsSbNeeds: {
      august: {
        ads5ml: number
        ads05ml: number
        sb25ltr: number
        sb5ltr: number
      }
      november: { ads05ml: number; sb25ltr: number; sb5ltr: number }
    },
    logisticsIds: {
      ads5mlId: number
      ads05mlId: number
      sb25lId: number
      sb5lId: number
    }
  ): number {
    const normalizedMonth = month?.toLowerCase()

    if (normalizedMonth === "august") {
      const augustMapping: Record<number, number> = {
        [logisticsIds.ads5mlId]: adsSbNeeds.august.ads5ml,
        [logisticsIds.ads05mlId]: adsSbNeeds.august.ads05ml,
        [logisticsIds.sb25lId]: adsSbNeeds.august.sb25ltr,
        [logisticsIds.sb5lId]: adsSbNeeds.august.sb5ltr,
      }
      return augustMapping[materialId] ?? 0
    }

    if (normalizedMonth === "november") {
      const novemberMapping: Record<number, number> = {
        [logisticsIds.ads05mlId]: adsSbNeeds.november.ads05ml,
        [logisticsIds.sb25lId]: adsSbNeeds.november.sb25ltr,
        [logisticsIds.sb5lId]: adsSbNeeds.november.sb5ltr,
      }
      return novemberMapping[materialId] ?? 0
    }

    return 0
  }

  async #getSchoolsToProcess(
    c: Context<DB>,
    subDistrictId: number,
    microplanningId: number,
    microplanningEntityId: number
  ) {
    const schoolsWithData =
      await this.logisticsRepo.getSchoolsBySubDistrictWithMaterialNeeds(
        c as any,
        subDistrictId,
        microplanningId
      )

    const schoolsToProcess = schoolsWithData.filter(
      (s) => s.material_need_id !== null
    )

    const outOfSchoolData =
      await this.logisticsRepo.checkExistingDataByReference(
        c as any,
        microplanningEntityId,
        "school",
        microplanningId
      )

    if (outOfSchoolData.length > 0 && outOfSchoolData[0]) {
      schoolsToProcess.push({
        school_id: microplanningEntityId,
        school_name: "Out of School",
        material_need_id: outOfSchoolData[0].id,
      })
    }

    return schoolsToProcess
  }

  #calculateUtilizationRates(
    primaryMaterialIds: number[],
    existingData: Array<{
      material_id: number
      type: string
      absolute_number_of_routine_immunization: number | null
      number_of_vials_used: number | null
    }>
  ) {
    return primaryMaterialIds.map((materialId) => {
      const existing = existingData.find(
        (e) => e.material_id === materialId && e.type === "primary"
      )
      const absolute = Number(
        existing?.absolute_number_of_routine_immunization ?? 0
      )
      const vialsUsed = Number(existing?.number_of_vials_used ?? 0)
      const rate =
        vialsUsed > 0 ? Math.ceil(safeDiv(absolute, vialsUsed)) : null

      return { id: materialId, value: rate }
    })
  }

  async #updatePrimaryMaterialNeeds(
    c: Context<DB>,
    existingData: Array<{
      material_id: number
      type: string
      material_need_id: number
      detail_remaining_stock: number | null
      absolute_number_of_routine_immunization: number | null
      number_of_vials_used: number | null
    }>,
    vialNeeds: {
      vialNeedMR: number
      vialNeedDT: number
      vialNeedTd: number
      vialNeedHPV: number
    },
    biasIds: { mrId: number; dtId: number; tdId: number; hpvId: number }
  ) {
    const primaryItems = existingData.filter((item) => item.type === "primary")

    for (const existingItem of primaryItems) {
      const materialId = existingItem.material_id
      const newTotalNeeds = this.#getVialNeedByMaterialId(
        materialId,
        vialNeeds,
        biasIds
      )

      const availableStockForMaterial = existingItem.detail_remaining_stock ?? 0
      const newRequestQty = newTotalNeeds - availableStockForMaterial

      const absolute = Number(
        existingItem.absolute_number_of_routine_immunization ?? 0
      )
      const vialsUsed = Number(existingItem.number_of_vials_used ?? 0)
      const newUtilizationRate =
        vialsUsed > 0 ? Math.ceil(safeDiv(absolute, vialsUsed)) : null

      await this.logisticsRepo.updateMaterialNeed(
        c as any,
        existingItem.material_need_id,
        newTotalNeeds
      )

      await this.logisticsRepo.updateMonthlyVaccineNeedDetail(
        c as any,
        existingItem.material_need_id,
        { request_qty: newRequestQty }
      )

      if (newUtilizationRate !== null) {
        await this.logisticsRepo.updateVaccineUtilizationRate(
          c as any,
          existingItem.material_need_id,
          newUtilizationRate
        )
      }

      console.log(
        `    Updated material ${materialId}: total_needs=${newTotalNeeds}, request_qty=${newRequestQty}, utilization_rate=${newUtilizationRate}`
      )
    }
  }

  async #updateAdditionalMaterialNeeds(
    c: Context<DB>,
    existingData: Array<{
      material_id: number
      type: string
      material_need_id: number
      injection_month: string | null
    }>,
    adsSbNeeds: {
      august: {
        ads5ml: number
        ads05ml: number
        sb25ltr: number
        sb5ltr: number
      }
      november: { ads05ml: number; sb25ltr: number; sb5ltr: number }
    },
    logisticsIds: {
      ads5mlId: number
      ads05mlId: number
      sb25lId: number
      sb5lId: number
    }
  ) {
    const additionalItems = existingData.filter(
      (item) => item.type === "additional"
    )

    for (const existingItem of additionalItems) {
      const materialId = existingItem.material_id
      const month = existingItem.injection_month ?? undefined
      const newTotal = this.#getAdditionalNeedTotal(
        materialId,
        month,
        adsSbNeeds,
        logisticsIds
      )

      await this.logisticsRepo.updateAdditionalNeed(
        c as any,
        existingItem.material_need_id,
        { total: newTotal }
      )

      console.log(
        `    Updated additional ${materialId} (${month}): total=${newTotal}`
      )
    }
  }

  async #processSchool(
    c: Context<DB>,
    data: ProcessSchoolParams
  ) {
    const schoolId = data.school.school_id
    const isOutOfSchool = schoolId === data.microplanningEntityId

    console.log(
      `  Processing school: ${schoolId} (${isOutOfSchool ? "Out of School" : data.school.school_name})`
    )

    const existingData = await this.logisticsRepo.getExistingMaterialNeeds(
      c as any,
      schoolId,
      "school",
      data.microplanningId
    )

    if (existingData.length === 0) {
      console.log(`    No existing data for school ${schoolId}, skipping`)
      return
    }

    const utilizationRates = this.#calculateUtilizationRates(
      data.primaryMaterials.materialIds,
      existingData
    )

    const counts = isOutOfSchool
      ? await this.targetEstimationRepo.getOutOfSchoolTargetCountsForCron(
          c,
          data.subDistrictId,
          SCHOOL_TARGET_GROUPS,
          data.microplanningId
        )
      : await this.targetEstimationRepo.getTargetCountsBySchoolId(
          c,
          schoolId,
          SCHOOL_TARGET_GROUPS,
          data.microplanningId
        )

    const formattedCounts = counts.map((row) => ({
      target_group_id: row.target_group_id,
      count:
        Number(row.count) +
        (row.target_group_id !== null
          ? (data.promotionCounts[row.target_group_id] ?? 0)
          : 0),
    }))

    const countMap = new Map(
      formattedCounts
        .filter((item) => item.target_group_id !== null)
        .map((item) => [item.target_group_id as number, item.count])
    )
    const gradeCounts = this.#extractSchoolGrades(countMap)

    const vialNeedsCalculated = this.#calculateVialNeeds(
      gradeCounts,
      utilizationRates,
      data.materialIdsMap
    )

    const getRequestQty = (materialId: number) => {
      const existing = existingData.find(
        (e) => e.material_id === materialId && e.type === "primary"
      )
      return Number(existing?.request_qty ?? 0)
    }

    const requestQty = {
      MR: getRequestQty(data.materialIdsMap.mrId),
      DT: getRequestQty(data.materialIdsMap.dtId),
      Td: getRequestQty(data.materialIdsMap.tdId),
      HPV: getRequestQty(data.materialIdsMap.hpvId),
    }

    const adsSbNeeds = this.#calculateAdsSbNeeds(
      vialNeedsCalculated,
      requestQty
    )

    await this.#updatePrimaryMaterialNeeds(
      c,
      existingData,
      vialNeedsCalculated,
      data.materialIdsMap
    )

    await this.#updateAdditionalMaterialNeeds(
      c,
      existingData,
      adsSbNeeds,
      data.logisticsIds
    )
  }

  async #handleTargetGroupPromotion(c: Context<DB>, microplanningId: number) {
    const today = new Date()

    const targetsWithActiveConsumptions =
      await this.targetEstimationRepo.getUniqueTargetsWithActiveConsumptions(
        c,
        microplanningId,
        today
      )

    console.log(
      `  Found ${targetsWithActiveConsumptions.length} targets with active consumptions`
    )

    const counts: Record<number, number> = {}
    let skippedCount = 0

    for (const target of targetsWithActiveConsumptions) {
      const targetId = target.target_id
      const currentTargetGroupId = target.current_target_group_id
      const gender = target.gender

      const firstConsumption =
        await this.targetEstimationRepo.getFirstConsumptionTargetGroup(
          c,
          targetId,
          today,
          target.target_group_id
        )

      if (!firstConsumption) {
        skippedCount++
        continue
      }

      const firstTargetGroupId = firstConsumption.target_group_id

      if (currentTargetGroupId === null) {
        skippedCount++
        continue
      }

      if (currentTargetGroupId === firstTargetGroupId) {
        skippedCount++
        continue
      }

      const validTargetGroups = TARGET_GROUP[gender as 1 | 2] || []
      if (!validTargetGroups.includes(firstTargetGroupId)) {
        console.log(
          `    Skipping target ${targetId}: target_group_id ${firstTargetGroupId} not valid for gender ${gender}`
        )
        skippedCount++
        continue
      }

      if (firstTargetGroupId !== null) {
        counts[firstTargetGroupId] = (counts[firstTargetGroupId] ?? 0) + 1
      }

      console.log(
        `    Target ${targetId} would promote: ${currentTargetGroupId} -> ${firstTargetGroupId}`
      )
    }

    console.log(`  Target group promotion counts:`, counts)
    console.log(
      `  Total would promote: ${Object.values(counts).reduce((a, b) => a + b, 0)}, skipped: ${skippedCount}`
    )

    return counts
  }

  /**
   * Main cron handler to recalculate bias immunization logistics
   *
   * This method:
   * 1. Gets all microplannings for next year
   * 2. For each microplanning, finds schools with EXISTING material needs data
   * 3. Recalculates vaccine vial needs based on updated target counts
   * 4. Updates ADS & Safety Box needs for August and November campaigns
   *
   * Important: Only updates existing records, does NOT create new ones
   */
  public readonly handleRecalculateBiasImmunization = async (
    c: Context<DB>
  ) => {
    console.log("=== Start Daily Bias Immunization Logistics Recalculation ===")
    console.log("Start Process", moment().format("YYYY-MM-DD HH:mm:ss"))

    const currentYear = new Date().getFullYear()
    const nextYear = currentYear + 1
    console.log(`Fetching microplannings for year: ${nextYear}`)

    const microplannings = await this.targetsRepo.getAllMicroplanningsByYear(
      c,
      nextYear
    )
    console.log(
      `Found ${microplannings.length} microplannings for year ${nextYear}`
    )

    const [primaryMaterials, logisticMaterials] = await Promise.all([
      this.#getMaterialIds(c, "primary", "bias"),
      this.#getMaterialIds(c, "additional", "bias"),
    ])

    const materialIdsMap = this.#getBiasIds(primaryMaterials)
    const logisticsIds = this.#getLogisticsIds(logisticMaterials)

    for (const microplanning of microplannings) {
      await this.#processMicroplanning(
        c,
        microplanning,
        primaryMaterials,
        materialIdsMap,
        logisticsIds
      )
    }

    console.log("\nEnd Process", moment().format("YYYY-MM-DD HH:mm:ss"))
    console.log("=== End Daily Bias Immunization Logistics Recalculation ===")
  }

  async #processMicroplanning(
    c: Context<DB>,
    microplanning: { id: number; entity_id: number | null },
    primaryMaterials: { materialIds: number[] },
    materialIdsMap: { mrId: number; dtId: number; tdId: number; hpvId: number },
    logisticsIds: {
      ads5mlId: number
      ads05mlId: number
      sb25lId: number
      sb5lId: number
    }
  ) {
    const microplanningId = microplanning.id
    const microplanningEntityId = microplanning.entity_id

    console.log(
      `\nProcessing microplanning ID: ${microplanningId}, Entity ID: ${microplanningEntityId}`
    )

    console.log("=== Starting Target Group Promotion Check ===")
    const promotionCounts = await this.#handleTargetGroupPromotion(
      c,
      microplanningId
    )
    console.log("=== End Target Group Promotion Check ===")

    console.log("=== Starting Recalculate Bias Immunization Logistics ===")

    const entity = await this.targetEstimationRepo.getEntitySubDistrictId(
      c,
      microplanningEntityId!
    )

    if (!entity?.sub_district_id) {
      console.log(
        `  Skipping microplanning ${microplanningId} - no sub_district_id found`
      )
      return
    }

    const subDistrictId = Number(entity.sub_district_id)
    const schoolsToProcess = await this.#getSchoolsToProcess(
      c,
      subDistrictId,
      microplanningId,
      microplanningEntityId!
    )

    const validSchools = schoolsToProcess.filter(
      (s) => s.school_name !== null
    ) as Array<{
      school_id: number
      school_name: string
      material_need_id: number | null
    }>

    console.log(
      `  Found ${validSchools.length} schools with data to recalculate`
    )

    for (const school of validSchools) {
      await this.#processSchool(c, {
        school,
        microplanningEntityId: microplanningEntityId!,
        subDistrictId,
        microplanningId,
        promotionCounts,
        primaryMaterials,
        materialIdsMap,
        logisticsIds
      })
    }

    console.log("=== End Recalculate Bias Immunization Logistics ===")
  }
}
