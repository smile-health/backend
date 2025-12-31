/**
 * Daily Target Snapshot Cron Job
 *
 * This cron job creates daily snapshots of target counts for microplanning.
 * It captures the state of targets at a specific point in time for:
 * - Villages (Non-Bias targets: BBL, SI, Baduta, WUS)
 * - Schools (Bias targets: Grade 1, 2, 5 Female, 5 Male)
 * - Out-of-School targets
 *
 * Flow:
 * 1. Get all microplannings for next year
 * 2. For each microplanning, get sub_district_id from entity
 * 3. Process villages (Non-Bias) - count targets per target_group
 * 4. Process schools (Bias) - count targets per target_group
 * 5. Process out-of-school - count targets per target_group
 * 6. Upsert snapshot records with current_count, promoted_out_count, cumulative_count
 *
 * Tables used:
 * - ws_microplanning (source)
 * - ws_targets (source)
 * - ws_microplan_targets_consumptions (source - for promoted counts)
 * - ws_daily_target_count_snapshots (destination)
 */
import { Context } from "@smile/lib/types/context.js"
import { DB } from "@/common/infrastructure/database/types/db.js"
import moment from "moment"
import { TargetsRepository } from "./targets.repository.js"

const VILLAGE_TARGET_GROUPS = [1, 2, 3, 9]
const SCHOOL_TARGET_GROUPS = [4, 5, 7, 10]

export class TargetsCron {
  constructor(private readonly targetsRepo: TargetsRepository) {}

  /**
   * Main handler for daily snapshot cron job
   */
  public readonly handleDailyTargetSnapshot = async (c: Context<DB>) => {
    const snapshotDate = moment().format("YYYY-MM-DD")
    const previousDate = moment().subtract(1, "day").format("YYYY-MM-DD")

    console.log(
      `[DailyTargetSnapshot] Starting snapshot for date: ${snapshotDate}`
    )

    // Get all microplannings for next year
    const microplannings =
      await this.targetsRepo.getMicroplanningsForNextYear(c)

    console.log(
      `[DailyTargetSnapshot] Found ${microplannings.length} microplannings to process`
    )

    for (const mp of microplannings) {
      const subDistrictId = mp.sub_district_id
        ? Number(mp.sub_district_id)
        : null

      if (!subDistrictId) {
        console.log(
          `[DailyTargetSnapshot] Skipping microplanning ${mp.microplanning_id} - no sub_district_id`
        )
        continue
      }

      console.log(
        `[DailyTargetSnapshot] Processing microplanning ${mp.microplanning_id} for sub_district ${subDistrictId}`
      )

      // Process Non-Bias (Villages)
      await this.processSnapshotVillages(
        c,
        snapshotDate,
        previousDate,
        mp.microplanning_id,
        subDistrictId
      )

      // Process Bias (Schools)
      await this.processSnapshotSchools(
        c,
        snapshotDate,
        previousDate,
        mp.microplanning_id,
        subDistrictId
      )

      // Process Out-of-School
      await this.processSnapshotOutOfSchool(
        c,
        snapshotDate,
        previousDate,
        mp.microplanning_id,
        subDistrictId
      )
    }

    console.log(
      `[DailyTargetSnapshot] Completed snapshot for date: ${snapshotDate}`
    )
  }

  /**
   * Process villages (Non-Bias targets)
   */
  private async processSnapshotVillages(
    c: Context<DB>,
    snapshotDate: string,
    previousDate: string,
    microplanningId: number,
    subDistrictId: number
  ) {
    const villages = await this.targetsRepo.getVillagesBySubDistrict(
      c,
      subDistrictId
    )

    console.log(
      `[DailyTargetSnapshot] Processing ${villages.length} villages for microplanning ${microplanningId}`
    )

    for (const village of villages) {
      const villageId = village.id!

      // Get current counts
      const currentCounts =
        await this.targetsRepo.getSnapshotCurrentCountsVillage(
          c,
          villageId,
          microplanningId,
          VILLAGE_TARGET_GROUPS
        )

      // Get promoted counts
      const promotedCounts =
        await this.targetsRepo.getSnapshotPromotedCountsVillage(
          c,
          villageId,
          microplanningId,
          VILLAGE_TARGET_GROUPS
        )

      // Create count maps
      const currentMap = new Map<number, number>(
        currentCounts.map((item) => [
          item.target_group_id!,
          Number(item.count),
        ])
      )
      const promotedMap = new Map<number, number>(
        promotedCounts.map((item) => [
          item.original_group!,
          Number(item.promoted_count),
        ])
      )

      // Process each target group
      for (const targetGroupId of VILLAGE_TARGET_GROUPS) {
        const currentCount = currentMap.get(targetGroupId) ?? 0
        const promotedOutCount = promotedMap.get(targetGroupId) ?? 0
        const cumulativeCount = currentCount + promotedOutCount

        // Get previous day snapshot for newly_added calculation
        const previousSnapshot = await this.targetsRepo.getPreviousDaySnapshot(
          c,
          previousDate,
          microplanningId,
          "village",
          villageId,
          targetGroupId
        )

        const newlyAddedCount = previousSnapshot
          ? Math.max(0, cumulativeCount - previousSnapshot.cumulative_count)
          : cumulativeCount

        await this.targetsRepo.upsertDailyTargetSnapshot(c, {
          snapshot_date: snapshotDate,
          microplanning_id: microplanningId,
          target_group_id: targetGroupId,
          entity_type: "village",
          reference_id: villageId,
          sub_district_id: subDistrictId,
          current_count: currentCount,
          cumulative_count: cumulativeCount,
          promoted_out_count: promotedOutCount,
          newly_added_count: newlyAddedCount,
        })
      }
    }
  }

  /**
   * Process schools (Bias targets)
   */
  private async processSnapshotSchools(
    c: Context<DB>,
    snapshotDate: string,
    previousDate: string,
    microplanningId: number,
    subDistrictId: number
  ) {
    const schools = await this.targetsRepo.getSchoolsBySubDistrict(
      c,
      subDistrictId
    )

    console.log(
      `[DailyTargetSnapshot] Processing ${schools.length} schools for microplanning ${microplanningId}`
    )

    for (const school of schools) {
      const schoolId = school.id!

      // Get current counts
      const currentCounts =
        await this.targetsRepo.getSnapshotCurrentCountsSchool(
          c,
          schoolId,
          microplanningId,
          SCHOOL_TARGET_GROUPS
        )

      // Get promoted counts
      const promotedCounts =
        await this.targetsRepo.getSnapshotPromotedCountsSchool(
          c,
          schoolId,
          microplanningId,
          SCHOOL_TARGET_GROUPS
        )

      // Create count maps
      const currentMap = new Map<number, number>(
        currentCounts.map((item) => [
          item.target_group_id!,
          Number(item.count),
        ])
      )
      const promotedMap = new Map<number, number>(
        promotedCounts.map((item) => [
          item.original_group!,
          Number(item.promoted_count),
        ])
      )

      // Process each target group
      for (const targetGroupId of SCHOOL_TARGET_GROUPS) {
        const currentCount = currentMap.get(targetGroupId) ?? 0
        const promotedOutCount = promotedMap.get(targetGroupId) ?? 0
        const cumulativeCount = currentCount + promotedOutCount

        // Get previous day snapshot for newly_added calculation
        const previousSnapshot = await this.targetsRepo.getPreviousDaySnapshot(
          c,
          previousDate,
          microplanningId,
          "school",
          schoolId,
          targetGroupId
        )

        const newlyAddedCount = previousSnapshot
          ? Math.max(0, cumulativeCount - previousSnapshot.cumulative_count)
          : cumulativeCount

        await this.targetsRepo.upsertDailyTargetSnapshot(c, {
          snapshot_date: snapshotDate,
          microplanning_id: microplanningId,
          target_group_id: targetGroupId,
          entity_type: "school",
          reference_id: schoolId,
          sub_district_id: subDistrictId,
          current_count: currentCount,
          cumulative_count: cumulativeCount,
          promoted_out_count: promotedOutCount,
          newly_added_count: newlyAddedCount,
        })
      }
    }
  }

  /**
   * Process out-of-school targets
   */
  private async processSnapshotOutOfSchool(
    c: Context<DB>,
    snapshotDate: string,
    previousDate: string,
    microplanningId: number,
    subDistrictId: number
  ) {
    console.log(
      `[DailyTargetSnapshot] Processing out-of-school for sub_district ${subDistrictId}`
    )

    // Get current counts
    const currentCounts =
      await this.targetsRepo.getSnapshotCurrentCountsOutOfSchool(
        c,
        subDistrictId,
        microplanningId,
        SCHOOL_TARGET_GROUPS
      )

    // Get promoted counts
    const promotedCounts =
      await this.targetsRepo.getSnapshotPromotedCountsOutOfSchool(
        c,
        subDistrictId,
        microplanningId,
        SCHOOL_TARGET_GROUPS
      )

    // Create count maps
    const currentMap = new Map<number, number>(
      currentCounts.map((item) => [item.target_group_id!, Number(item.count)])
    )
    const promotedMap = new Map<number, number>(
      promotedCounts.map((item) => [
        item.original_group!,
        Number(item.promoted_count),
      ])
    )

    // Process each target group
    for (const targetGroupId of SCHOOL_TARGET_GROUPS) {
      const currentCount = currentMap.get(targetGroupId) ?? 0
      const promotedOutCount = promotedMap.get(targetGroupId) ?? 0
      const cumulativeCount = currentCount + promotedOutCount

      // Get previous day snapshot for newly_added calculation
      const previousSnapshot = await this.targetsRepo.getPreviousDaySnapshot(
        c,
        previousDate,
        microplanningId,
        "out_of_school",
        subDistrictId,
        targetGroupId
      )

      const newlyAddedCount = previousSnapshot
        ? Math.max(0, cumulativeCount - previousSnapshot.cumulative_count)
        : cumulativeCount

      await this.targetsRepo.upsertDailyTargetSnapshot(c, {
        snapshot_date: snapshotDate,
        microplanning_id: microplanningId,
        target_group_id: targetGroupId,
        entity_type: "out_of_school",
        reference_id: subDistrictId,
        sub_district_id: subDistrictId,
        current_count: currentCount,
        cumulative_count: cumulativeCount,
        promoted_out_count: promotedOutCount,
        newly_added_count: newlyAddedCount,
      })
    }
  }
}
