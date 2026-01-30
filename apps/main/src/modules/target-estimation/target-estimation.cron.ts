/**
 * Target Estimation Cron Job
 *
 * This cron job recalculates target estimation data daily for both:
 * - Non-Bias (Villages): Service points, worker needs, facility requirements
 * - Bias (Schools): Required sessions and service days for August/November
 *
 * It only updates EXISTING data in the database - it does NOT create new records.
 *
 * Flow:
 * 1. Get all microplanningIds for next year
 * 2. For each microplanning, get only villages/schools that already have data in DB
 * 3. Recalculate service requirements based on current target counts
 * 4. Update the existing records with new calculated values
 *
 * Tables updated:
 * - ws_microplanning_village_details (village estimations)
 * - ws_microplanning_school_details (school estimations)
 */
import { DB } from "@/common/infrastructure/database/types/db.js"
import { Context } from "@smile-health/lib/types/context.js"
import moment from "moment-timezone"
import { TargetsRepository } from "../targets/targets.repository.js"
import { TargetEstimationRepository } from "./target-estimation.repository.js"
import {
  SCHOOL_TARGET_GROUPS,
  VILLAGE_TARGET_GROUPS,
  FACILITY_SERVICE_CAPACITY,
  OUTREACH_SERVICE_CAPACITY,
  WORKERS_PER_SERVICE_POINT,
  WUS_COVERAGE_PERCENTAGE,
  TARGET_GROUP,
  BADUTA_INJECTION_DOSE,
  BBL_INJECTION_DOSE,
  PERCENTAGE_100,
  SI_INJECTION_DOSE,
  TOTAL_MONTH,
} from "@/common/constants/target.js"

export class TargetEstimationCron {
  constructor(
    private readonly targetsRepo: TargetsRepository,
    private readonly targetEstimationRepo: TargetEstimationRepository
  ) {}

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

  #extractVillageTargets(countMap: Record<number, number>) {
    return {
      bbl: countMap[1] ?? 0,
      si: countMap[2] ?? 0,
      baduta: countMap[3] ?? 0,
      wus: countMap[9] ?? 0,
    }
  }

  #calculateVillageInjections(
    counts: Array<{ target_group_id: number | null; count: number }>,
    data: {
      outreach_service_percentage: number
      facility_service_percentage: number
      available_outreach_service: number
      available_facility_service: number
      available_worker: number
    }
  ) {
    const map: Record<number, number> = {}
    counts.forEach((c) => {
      if (c.target_group_id !== null) {
        map[c.target_group_id] = Number(c.count)
      }
    })

    const { bbl, si, baduta, wus } = this.#extractVillageTargets(map)

    // Calculate yearly injections
    const yearInfant =
      bbl * BBL_INJECTION_DOSE +
      si * SI_INJECTION_DOSE +
      baduta * BADUTA_INJECTION_DOSE
    const yearWUS = (wus * WUS_COVERAGE_PERCENTAGE) / PERCENTAGE_100
    const monthly = Math.round((yearInfant + yearWUS) / TOTAL_MONTH)

    // Calculate required monthly services
    const outreachMonthly = Math.round(
      (data.outreach_service_percentage / PERCENTAGE_100) *
        (monthly / OUTREACH_SERVICE_CAPACITY)
    )
    const facilityMonthly =
      Math.round(
        (data.facility_service_percentage / PERCENTAGE_100) *
          (monthly / FACILITY_SERVICE_CAPACITY)
      ) + 1

    // Calculate additional services needed
    const outreachAdd = outreachMonthly - data.available_outreach_service
    const facilityAdd = facilityMonthly - data.available_facility_service

    // Calculate additional vaccinators needed
    const outreachVac =
      data.available_outreach_service > 0
        ? Math.floor(outreachMonthly / data.available_outreach_service)
        : 0

    const facilityVac =
      data.available_facility_service > 0
        ? Math.floor(facilityMonthly / data.available_facility_service)
        : 0

    // Calculate ideal worker needs
    const idealWorker =
      data.available_outreach_service * WORKERS_PER_SERVICE_POINT +
      data.available_facility_service * WORKERS_PER_SERVICE_POINT

    // Calculate gap
    const gapWorker = idealWorker - data.available_worker

    return {
      required_monthly_outreach_service: outreachMonthly,
      required_monthly_facility_service: facilityMonthly,
      additional_outreach_service: outreachAdd,
      additional_facility_service: facilityAdd,
      additional_outreach_vaccinator_service: outreachVac,
      additional_facility_vaccinator_service: facilityVac,
      health_worker_ideal_needs: idealWorker,
      gap_health_worker: gapWorker,
    }
  }

  #calculateBiasInjections(
    counts: Array<{ target_group_id: number | null; count: number }>,
    availableVaccinator: { august: number; november: number }
  ) {
    const map: Record<number, number> = {}
    counts.forEach((c) => {
      if (c.target_group_id !== null) {
        map[c.target_group_id] = Number(c.count)
      }
    })

    const { grade1, grade2, grade5Female, grade5Male } =
      this.#extractSchoolGrades(map)

    const augustInjectionYear = grade1 + grade5Female
    const novemberInjectionYear = grade1 + grade2 + grade5Male + grade5Female

    const augustSessions = Math.round(
      augustInjectionYear / FACILITY_SERVICE_CAPACITY
    )
    const augustServiceDays =
      availableVaccinator.august > 0
        ? Math.floor(augustSessions / availableVaccinator.august)
        : 0

    const novemberSessions = Math.round(
      novemberInjectionYear / FACILITY_SERVICE_CAPACITY
    )
    const novemberServiceDays =
      availableVaccinator.november > 0
        ? Math.floor(novemberSessions / availableVaccinator.november)
        : 0

    return {
      augustSessions,
      augustServiceDays,
      novemberSessions,
      novemberServiceDays,
    }
  }

  async #processSchoolEstimations(
    c: Context<DB>,
    microplanningId: number,
    microplanningEntityId: number,
    promotionCounts: Record<number, number>
  ) {
    console.log("=== Starting Recalculate School Estimations ===")
    const schoolEstimations =
      await this.targetEstimationRepo.getAllSchoolEstimationsByMicroplanningId(
        c,
        microplanningId
      )
    console.log(`  Found ${schoolEstimations.length} school estimations`)

    const estimationsBySchool = new Map<number, typeof schoolEstimations>()
    for (const estimation of schoolEstimations) {
      const schoolId = estimation.school_id
      if (schoolId !== null) {
        if (!estimationsBySchool.has(schoolId)) {
          estimationsBySchool.set(schoolId, [])
        }
        estimationsBySchool.get(schoolId)!.push(estimation)
      }
    }

    for (const [schoolId, estimations] of estimationsBySchool) {
      await this.#processSchool(
        c,
        schoolId,
        estimations,
        microplanningId,
        microplanningEntityId,
        promotionCounts
      )
    }
    console.log("=== End Recalculate School Estimations ===")
  }

  async #processSchool(
    c: Context<DB>,
    schoolId: number,
    estimations: Array<{
      id: number
      school_id: number | null
      schedule_month: string | null
      available_vaccinator: number | null
    }>,
    microplanningId: number,
    microplanningEntityId: number,
    promotionCounts: Record<number, number>
  ) {
    const isOutOfSchool = schoolId === microplanningEntityId

    let counts: Array<{
      target_group_id: number | null
      count: string | number | bigint
    }>

    if (isOutOfSchool) {
      const entity = await this.targetEstimationRepo.getEntitySubDistrictId(
        c,
        microplanningEntityId
      )
      if (!entity?.sub_district_id) {
        console.log(`    Skipping school ${schoolId} - no sub_district_id found`)
        return
      }
      counts =
        await this.targetEstimationRepo.getOutOfSchoolTargetCountsForCron(
          c,
          Number(entity.sub_district_id),
          SCHOOL_TARGET_GROUPS,
          microplanningId
        )
    } else {
      counts = await this.targetEstimationRepo.getTargetCountsBySchoolId(
        c,
        schoolId,
        SCHOOL_TARGET_GROUPS,
        microplanningId
      )
    }

    const augustEstimation = estimations.find(
      (e) => e.schedule_month === "August"
    )
    const novemberEstimation = estimations.find(
      (e) => e.schedule_month === "November"
    )

    const availableVaccinator = {
      august: augustEstimation?.available_vaccinator ?? 0,
      november: novemberEstimation?.available_vaccinator ?? 0,
    }

    const formattedCounts = counts.map((row) => ({
      target_group_id: row.target_group_id,
      count:
        Number(row.count) +
        (row.target_group_id !== null
          ? (promotionCounts[row.target_group_id] ?? 0)
          : 0),
    }))

    const calculations = this.#calculateBiasInjections(
      formattedCounts,
      availableVaccinator
    )

    if (augustEstimation) {
      await this.targetEstimationRepo.updateSchoolEstimationById(
        c,
        augustEstimation.id,
        {
          required_service: calculations.augustSessions,
          required_service_days: calculations.augustServiceDays,
        }
      )
      console.log(
        `    Updated school ${schoolId} August: sessions=${calculations.augustSessions}, days=${calculations.augustServiceDays}`
      )
    }

    if (novemberEstimation) {
      await this.targetEstimationRepo.updateSchoolEstimationById(
        c,
        novemberEstimation.id,
        {
          required_service: calculations.novemberSessions,
          required_service_days: calculations.novemberServiceDays,
        }
      )
      console.log(
        `    Updated school ${schoolId} November: sessions=${calculations.novemberSessions}, days=${calculations.novemberServiceDays}`
      )
    }
  }

  async #processVillageEstimations(
    c: Context<DB>,
    microplanningId: number,
    promotionCounts: Record<number, number>
  ) {
    console.log("=== Starting Recalculate Village Estimations ===")
    const villageEstimations =
      await this.targetEstimationRepo.getAllVillageEstimationsByMicroplanningId(
        c,
        microplanningId
      )
    console.log(`  Found ${villageEstimations.length} village estimations`)

    for (const villageEstimation of villageEstimations) {
      await this.#processVillage(c, villageEstimation, microplanningId, promotionCounts)
    }
    console.log("=== End Recalculate Village Estimations ===")
  }

  async #processVillage(
    c: Context<DB>,
    villageEstimation: {
      id: number
      village_id: number | null
      outreach_service_percentage: string | number | null
      facility_service_percentage: string | number | null
      available_outreach_service: number | null
      available_facillity_service: number | null
      available_worker: number | null
    },
    microplanningId: number,
    promotionCounts: Record<number, number>
  ) {
    const villageId = villageEstimation.village_id
    if (villageId === null) return

    const counts = await this.targetEstimationRepo.getTargetCountsByVillageId(
      c,
      villageId,
      VILLAGE_TARGET_GROUPS,
      microplanningId
    )

    const savedData = {
      outreach_service_percentage: Number(
        villageEstimation.outreach_service_percentage ?? 0
      ),
      facility_service_percentage: Number(
        villageEstimation.facility_service_percentage ?? 0
      ),
      available_outreach_service:
        villageEstimation.available_outreach_service ?? 0,
      available_facility_service:
        villageEstimation.available_facillity_service ?? 0,
      available_worker: villageEstimation.available_worker ?? 0,
    }

    const formattedCounts = counts.map((row) => ({
      target_group_id: row.target_group_id,
      count:
        Number(row.count) +
        (row.target_group_id !== null
          ? (promotionCounts[row.target_group_id] ?? 0)
          : 0),
    }))

    const calculations = this.#calculateVillageInjections(
      formattedCounts,
      savedData
    )

    await this.targetEstimationRepo.updateVillageEstimationById(
      c,
      villageEstimation.id,
      calculations
    )

    console.log(
      `    Updated village ${villageId}: outreach=${calculations.required_monthly_outreach_service}, facility=${calculations.required_monthly_facility_service}, idealWorker=${calculations.health_worker_ideal_needs}`
    )
  }

  async #processMicroplanning(
    c: Context<DB>,
    microplanning: { id: number; entity_id: number | null }
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

    if (microplanningEntityId === null) {
      console.log(`  Skipping microplanning ${microplanningId} - no entity_id`)
      return
    }

    await this.#processSchoolEstimations(
      c,
      microplanningId,
      microplanningEntityId,
      promotionCounts
    )

    await this.#processVillageEstimations(c, microplanningId, promotionCounts)
  }

  /**
   * Main cron handler to recalculate target estimations
   *
   * This method:
   * 1. Gets all microplannings for next year
   * 2. For each microplanning, finds schools/villages with EXISTING estimation data
   * 3. Recalculates service requirements based on updated target counts
   * 4. Updates session counts, service days, and worker needs
   *
   * Important: Only updates existing records, does NOT create new ones
   */
  public readonly handleRecalculateTargets = async (c: Context<DB>) => {
    console.log("=== Start Daily Target Estimation Recalculation ===")
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

    for (const microplanning of microplannings) {
      await this.#processMicroplanning(c, microplanning)
    }

    console.log("\nEnd Process", moment().format("YYYY-MM-DD HH:mm:ss"))
    console.log("=== End Daily Target Estimation Recalculation ===")
  }

  /**
   * Handle target group promotion based on ws_microplan_targets_consumptions ideal dates
   *
   * Logic:
   * 1. Get all unique targets with active consumptions (today between ideal_date and end_ideal_date)
   * 2. For each target, get the first (lowest) target_group_id from consumptions
   * 3. Compare with current target_group_id in ws_targets
   * 4. If different, update the target_group_id based on TARGET_GROUP by gender
   */
  async #handleTargetGroupPromotion(c: Context<DB>, microplanningId: number) {
    const today = new Date()

    // Get all unique targets with active consumptions
    const targetsWithActiveConsumptions =
      await this.targetEstimationRepo.getUniqueTargetsWithActiveConsumptions(
        c,
        microplanningId,
        today
      )

    console.log(
      `  Found ${targetsWithActiveConsumptions.length} targets with active consumptions`
    )

    // Count targets by their new target_group_id (do not update ws_targets)
    const counts: Record<number, number> = {}
    let skippedCount = 0

    for (const target of targetsWithActiveConsumptions) {
      const targetId = target.target_id
      const currentTargetGroupId = target.current_target_group_id
      const gender = target.gender // 1 = male, 2 = female

      // Get the first (lowest) target_group_id from active consumptions
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

      // If current target_group_id matches the first consumption, skip
      if (currentTargetGroupId === firstTargetGroupId) {
        skippedCount++
        continue
      }

      // Validate that the new target_group_id is valid for this gender
      const validTargetGroups = TARGET_GROUP[gender as 1 | 2] ?? []
      if (
        firstTargetGroupId === null ||
        !validTargetGroups.includes(firstTargetGroupId)
      ) {
        console.log(
          `    Skipping target ${targetId}: target_group_id ${firstTargetGroupId} not valid for gender ${gender}`
        )
        skippedCount++
        continue
      }

      // Add to counts instead of updating ws_targets
      counts[firstTargetGroupId] = (counts[firstTargetGroupId] ?? 0) + 1

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
}
