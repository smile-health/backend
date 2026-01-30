import { Context } from "hono"
import {
  GetDetailCalculateDTO,
  TargetSummaryResponse,
  CalculateTargetEstimationBiasRequestDTO,
  CalculateTargetEstimationPathRequestDTO,
  CalculateTargetEstimationRequestDTO,
  SaveEstimationRequest,
  SaveEstimationBiasRequest,
  UpdateEstimationBiasRequest,
  UpdateEstimationRequest,
  SchoolIdParam,
  VillageIdParam,
  GlobalCategoryRequestDTO,
  ImmunizationServiceBiasSummary,
  ImmunizationServiceSummary,
  CommunityHealthWorkerSummary,
  EntityListResponse,
  SchoolDataResponse,
  InjectionDashboardSummary,
} from "./target-estimation.schema.js"
import {
  BADUTA_INJECTION_DOSE,
  BBL_INJECTION_DOSE,
  FACILITY_SERVICE_CAPACITY,
  OUTREACH_SERVICE_CAPACITY,
  PERCENTAGE_100,
  SCHOOL_TARGET_GROUPS,
  SCHOOL_TARGET_LABELS,
  SI_INJECTION_DOSE,
  TOTAL_MONTH,
  VILLAGE_LABEL,
  VILLAGE_TARGET_GROUPS,
  VILLAGE_TARGET_LABELS,
  WORKERS_PER_SERVICE_POINT,
  WUS_COVERAGE_PERCENTAGE,
} from "@/common/constants/target.js"
import { NotFoundError, ValidationError } from "@smile-health/lib/error.js"
import {
  createCountMap,
  createCountRecord,
} from "@/common/utils/target.utils.js"
import { LocationRepository } from "../location/location.repository.js"
import { TargetEstimationBiasRepository } from "../target-estimation-bias/target-estimation-bias.repository.js"
import { TargetEstimationNonBiasRepository } from "../target-estimation-non-bias/target-estimation-non-bias.repository.js"
import { EntitySchoolReposity } from "../entity-school/entity-school.repository.js"
import { TargetsRepository } from "../targets/targets.repository.js"
import { LOCATION } from "@/common/constants/location.js"
import { isEmpty } from "lodash"

export class TargetEstimationModule {
  constructor(
    private readonly nonBiasRepo: TargetEstimationNonBiasRepository,
    private readonly biasRepo: TargetEstimationBiasRepository,
    private readonly locationRepository: LocationRepository,
    private readonly entitySchoolRepo: EntitySchoolReposity,
    private readonly targetsRepo: TargetsRepository
  ) {}

  #getMonthlyInjection(
    countMap: Map<number, number>,
    isAugust: boolean
  ): number {
    const { grade1, grade2, grade5Female, grade5Male } =
      this.#extractSchoolGrades(countMap)

    return isAugust
      ? grade1 + grade5Female
      : grade1 + grade2 + grade5Male + grade5Female
  }

  #calculateBiasInjections(
    counts: Array<{ target_group_id: number; count: number }>,
    data: CalculateTargetEstimationBiasRequestDTO
  ) {
    const map = createCountRecord(counts)
    const { grade1, grade2, grade5Female, grade5Male } =
      this.#extractSchoolGrades(map)

    const augustInjectionYear = grade1 + grade5Female
    const novemberInjectionYear = grade1 + grade2 + grade5Male + grade5Female

    const augustSessions = Math.round(
      augustInjectionYear / FACILITY_SERVICE_CAPACITY
    )
    const augustVaccinator = data.august_immunization_service
    const augustServiceDays =
      augustVaccinator > 0
        ? Math.floor(augustInjectionYear / augustVaccinator)
        : 0

    const novemberSessions = Math.round(
      novemberInjectionYear / FACILITY_SERVICE_CAPACITY
    )
    const novemberVaccinator = data.november_immunization_service
    const novemberServiceDays =
      novemberVaccinator > 0
        ? Math.floor(novemberInjectionYear / novemberVaccinator)
        : 0

    return {
      augustInjectionYear,
      novemberInjectionYear,
      augustSessions,
      augustVaccinator,
      augustServiceDays,
      novemberSessions,
      novemberVaccinator,
      novemberServiceDays,
    }
  }

  #calculateInjections(
    counts: Array<{ target_group_id: number; count: number }>,
    data: CalculateTargetEstimationRequestDTO
  ) {
    const map = createCountRecord(counts)
    const { bbl, si, baduta, wus } = this.#extractVillageTargets(map)

    const yearInfant =
      bbl * BBL_INJECTION_DOSE +
      si * SI_INJECTION_DOSE +
      baduta * BADUTA_INJECTION_DOSE
    const yearWUS = (wus * WUS_COVERAGE_PERCENTAGE) / PERCENTAGE_100
    const monthly = (yearInfant + yearWUS) / TOTAL_MONTH

    const outreachMonthly = Math.round(
      (data.outreach_service_percentage / PERCENTAGE_100) *
        (monthly / OUTREACH_SERVICE_CAPACITY)
    )
    const facilityMonthly =
      Math.round(
        (data.facility_based_service_percentage / PERCENTAGE_100) *
          (monthly / FACILITY_SERVICE_CAPACITY)
      ) + 1

    const outreachAdd = outreachMonthly - data.outreach_service_available_number
    const facilityAdd =
      facilityMonthly - data.facility_based_service_available_number

    const outreachVac =
      data.outreach_service_available_number > 0
        ? Math.floor(outreachMonthly / data.outreach_service_available_number)
        : 0

    const facilityVac =
      data.facility_based_service_available_number > 0
        ? Math.floor(
            facilityMonthly / data.facility_based_service_available_number
          )
        : 0

    const idealWorker =
      data.outreach_service_available_number * WORKERS_PER_SERVICE_POINT +
      data.facility_based_service_available_number * WORKERS_PER_SERVICE_POINT

    return {
      injectionPerYearInfantBaduta: Math.round(yearInfant),
      injectionPerYearWUS: Math.round(yearWUS),
      injectionPerMonth: Math.round(monthly),
      optionalOutreachAdditionalVaccinator: outreachVac,
      optionalFacilityBasedAdditionalVaccinator: facilityVac,
      optionalOutreachAdditionalService: outreachAdd,
      optionalFacilityBasedAdditionalService: facilityAdd,
      idealNeededWorker: idealWorker,
      outreaceServiceNeededEveryMonth: outreachMonthly,
      facilityBasedServiceNeededEveryMonth: facilityMonthly,
    }
  }

  #extractVillageTargets(
    countMap: Map<number, number> | Record<number, number>
  ) {
    const isMap = countMap instanceof Map
    return {
      bbl: isMap ? (countMap.get(1) ?? 0) : (countMap[1] ?? 0),
      si: isMap ? (countMap.get(2) ?? 0) : (countMap[2] ?? 0),
      baduta: isMap ? (countMap.get(3) ?? 0) : (countMap[3] ?? 0),
      wus: isMap ? (countMap.get(9) ?? 0) : (countMap[9] ?? 0),
    }
  }

  #calcYearlyInjections(bbl: number, si: number, baduta: number, wus: number) {
    const yearlyBblBaduta =
      bbl * BBL_INJECTION_DOSE +
      si * SI_INJECTION_DOSE +
      baduta * BADUTA_INJECTION_DOSE
    const yearlyWus = Math.round(
      (wus * WUS_COVERAGE_PERCENTAGE) / PERCENTAGE_100
    )
    const monthly = Math.round((yearlyBblBaduta + yearlyWus) / TOTAL_MONTH)
    return { yearlyBblBaduta, yearlyWus, monthly }
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

  #calcBiasInjections(
    grade1: number,
    grade2: number,
    grade5Female: number,
    grade5Male: number
  ) {
    const augustInjection = grade1 + grade5Female
    const novemberInjection = grade1 + grade2 + grade5Male + grade5Female

    const augustServiceRequired = Math.round(
      augustInjection / FACILITY_SERVICE_CAPACITY
    )
    const novemberServiceRequired = Math.round(
      novemberInjection / FACILITY_SERVICE_CAPACITY
    )

    return {
      augustInjection: augustInjection,
      novemberInjection: novemberInjection,
      augustServiceRequired,
      novemberServiceRequired,
      augustServiceDays:
        augustServiceRequired > 0
          ? Math.floor(augustInjection / augustServiceRequired)
          : 0,
      novemberServiceDays:
        novemberServiceRequired > 0
          ? Math.floor(novemberInjection / novemberServiceRequired)
          : 0,
    }
  }

  async #checkVillageData(
    c: Context,
    subDistrictId: number,
    microplanningId: number,
    keyword?: string
  ): Promise<EntityListResponse> {
    const rawData = await this.nonBiasRepo.getVillagesBySubDistrict(
      c,
      subDistrictId,
      microplanningId,
      keyword
    )

    let dataCount = 0
    const entities = rawData.map((v) => {
      const hasData = v.microplanning_id !== null
      if (hasData) dataCount++

      return {
        id: v.village_id,
        name: VILLAGE_LABEL + " " + v.village_name.toUpperCase(),
        has_data: hasData,
      }
    })

    return {
      data: {
        total: rawData.length,
        total_with_data: dataCount,
        entities,
      },
    }
  }

  async #checkSchoolData(
    c: Context,
    subDistrictId: number,
    microplanningId: number,
    keyword?: string
  ): Promise<SchoolDataResponse> {
    const entityId = c.var.userEntity?.global_id
    if (!entityId) throw new ValidationError("Entity not found")

    const [outOfSchoolEstimation, rawData] = await Promise.all([
      this.biasRepo.getSchoolEstimationDetailsByMicroplanning(
        c,
        entityId,
        microplanningId
      ),
      this.biasRepo.getSchoolsBySubDistrict(
        c,
        subDistrictId,
        microplanningId,
        keyword
      ),
    ])

    const outOfSchoolHasData = outOfSchoolEstimation.length > 0

    const outOfSchoolEntities = [
      {
        id: entityId,
        name: "Children Not in School",
        has_data: outOfSchoolHasData,
      },
    ]

    let dataCount = 0
    const entities = rawData.map((school) => {
      const hasData = school.microplanning_id !== null
      if (hasData) dataCount++

      return {
        id: school.school_id,
        name: (school.school_name ?? "").toUpperCase(),
        has_data: hasData,
      }
    })

    return {
      data_out_of_school: {
        total: 1,
        total_with_data: outOfSchoolHasData ? 1 : 0,
        entities: outOfSchoolEntities,
      },
      data: {
        total: rawData.length,
        total_with_data: dataCount,
        entities,
      },
    }
  }

  async #getInjectionDashboardNonBias(
    c: Context,
    subDistrictId: number,
    microplanningId: number
  ): Promise<InjectionDashboardSummary> {
    const villages = await this.locationRepository.getLocations(
      c,
      LOCATION.VILLAGE,
      subDistrictId
    )

    let totalBblBaduta = 0
    let totalWus = 0
    let totalMonthly = 0

    const villageIds = villages.map((v) => v.id!).filter((id) => id != null)
    const batchCounts =
      await this.locationRepository.getBatchTargetCountsByLocationIds(
        c,
        villageIds,
        VILLAGE_TARGET_GROUPS,
        microplanningId
      )

    const countsMap = new Map(
      batchCounts.map((item) => [
        item.village_id,
        createCountRecord(item.counts),
      ])
    )

    const villageDetails = villages.map((village) => {
      const map = countsMap.get(village.id) || {}
      const { bbl, si, baduta, wus } = this.#extractVillageTargets(map)
      const { yearlyBblBaduta, yearlyWus, monthly } =
        this.#calcYearlyInjections(bbl, si, baduta, wus)

      totalBblBaduta += yearlyBblBaduta
      totalWus += yearlyWus
      totalMonthly += monthly

      return {
        village_name: `${VILLAGE_LABEL} ${village.name?.toUpperCase()}`,
        annual_bbl_baduta: yearlyBblBaduta,
        annual_wus: yearlyWus,
        monthly,
      }
    })

    return {
      total_annual_injection: [
        {
          label: "Bayi Baru Lahir (BBL) & Baduta",
          type: "number",
          count: totalBblBaduta,
        },
        {
          label: "Wanita Usia Subur (WUS)",
          type: "number",
          count: totalWus,
        },
      ],
      total_monthly_injection: [
        {
          label: "Monthly Injection",
          type: "number",
          count: totalMonthly,
        },
      ],
      number_of_injection_by_village: {
        data: villageDetails.map((v) => ({
          label: v.village_name,
          data: [
            {
              label: "Annual Injection (BBL & Baduta)",
              type: "number" as const,
              count: v.annual_bbl_baduta,
            },
            {
              label: "Annual Injection (WUS)",
              type: "number" as const,
              count: v.annual_wus,
            },
            {
              label: "Monthly Injection",
              type: "number" as const,
              count: v.monthly,
            },
          ],
        })),
      },
    }
  }

  async #getInjectionDashboardBias(
    c: Context,
    subDistrictId: number,
    microplanningId: number
  ): Promise<InjectionDashboardSummary> {
    const schools = await this.entitySchoolRepo.getSchoolsBySubDistrict(
      c,
      subDistrictId
    )

    if (isEmpty(schools)) {
      throw new ValidationError(
        c.var.t("validator.not_exist", {
          field: c.var.t("targets.label.school"),
        })
      )
    }

    let totalAugInjection = 0,
      totalNovInjection = 0

    const entityIds = schools.map((s) => s.id).filter((id) => id != null)
    const batchCounts = await this.biasRepo.getBatchTargetCountsByEntityIds(
      c,
      entityIds,
      SCHOOL_TARGET_GROUPS,
      microplanningId
    )

    const countsMap = new Map(
      batchCounts.map((item) => [
        item.entity_id,
        createCountRecord(item.counts),
      ])
    )

    const schoolDetails = schools.map((school) => {
      const countMap =
        countsMap.get(school.id) ?? ({} as Record<number, number>)
      const gradeCounts = this.#extractSchoolGrades(countMap)
      const biasCalc = this.#calcBiasInjections(
        gradeCounts.grade1,
        gradeCounts.grade2,
        gradeCounts.grade5Female,
        gradeCounts.grade5Male
      )

      totalAugInjection += biasCalc.augustInjection
      totalNovInjection += biasCalc.novemberInjection

      return {
        school_name: school.name,
        aug_injection: biasCalc.augustInjection,
        nov_injection: biasCalc.novemberInjection,
      }
    })

    const outOfSchoolSummary = await this.#getOutOfSchoolInjectionSummary(
      c,
      subDistrictId
    )

    const outOfSchoolAug =
      outOfSchoolSummary.data.find((d) => d.label === "August")?.count ?? 0
    const outOfSchoolNov =
      outOfSchoolSummary.data.find((d) => d.label === "November")?.count ?? 0

    return {
      number_of_injection: [
        {
          label: "August",
          type: "number",
          count: totalAugInjection + outOfSchoolAug,
        },
        {
          label: "November",
          type: "number",
          count: totalNovInjection + outOfSchoolNov,
        },
      ],
      number_of_injection_by_school: {
        data_out_of_school: [outOfSchoolSummary],
        data: schoolDetails.map((v) => ({
          label: v.school_name ?? "",
          data: [
            {
              label: "August",
              type: "number",
              count: v.aug_injection,
            },
            {
              label: "November",
              type: "number",
              count: v.nov_injection,
            },
          ],
        })),
      },
    }
  }

  async #getOutOfSchoolInjectionSummary(c: Context, subDistrictId: number) {
    const counts = await this.biasRepo.getOutOfSchoolTargetCounts(
      c,
      subDistrictId,
      SCHOOL_TARGET_GROUPS
    )

    const countMap = createCountRecord(counts)
    const gradeCounts = this.#extractSchoolGrades(countMap)
    const biasCalc = this.#calcBiasInjections(
      gradeCounts.grade1,
      gradeCounts.grade2,
      gradeCounts.grade5Female,
      gradeCounts.grade5Male
    )

    return {
      label: "Children Not in School",
      data: [
        {
          label: "August",
          type: "number" as const,
          count: biasCalc.augustInjection,
        },
        {
          label: "November",
          type: "number" as const,
          count: biasCalc.novemberInjection,
        },
      ],
    }
  }

  async #getTargetSummaryNonBias(
    c: Context,
    param: GetDetailCalculateDTO
  ): Promise<TargetSummaryResponse> {
    const entityId = c.var.userEntity?.global_id
    if (!entityId) {
      throw new ValidationError("Entity not found")
    }

    const currentYear = new Date().getFullYear()
    const nextYear = currentYear + 1
    const microplanningId = await this.targetsRepo.findOrCreateMicroplanning(
      c,
      entityId,
      nextYear
    )

    const [counts, location, savedEstimation] = await Promise.all([
      this.nonBiasRepo.getTargetCountsByVillageId(
        c,
        param.id,
        VILLAGE_TARGET_GROUPS,
        microplanningId
      ),
      this.nonBiasRepo.getLocationName(c, param.id),
      this.nonBiasRepo.getVillageEstimationDetailsByMicroplanning(
        c,
        param.id,
        microplanningId
      ),
    ])

    if (!location) {
      throw new ValidationError("Village not exist")
    }

    const countMap = createCountMap(counts)
    const { bbl, si, baduta, wus } = this.#extractVillageTargets(countMap)

    const buildImmunizationService = () => {
      if (!savedEstimation) {
        return [
          {
            label: "Service Percentage by Type",
            services: [
              { label: "Outreach Service", type: "percentage", count: null },
              {
                label: "Facility-based Service",
                type: "percentage",
                count: null,
              },
            ],
          },
          {
            label: "Required Monthly Service Points",
            services: [
              { label: "Outreach Service", type: "number", count: null },
              { label: "Facility-based Service", type: "number", count: null },
            ],
          },
          {
            label: "Available Service Points/Days",
            services: [
              { label: "Outreach Service", type: "number", count: null },
              { label: "Facility-based Service", type: "number", count: null },
            ],
          },
          {
            label: "Option of Immunization Service Solution",
            services: [
              {
                label: null,
                count: null,
                sub_label: "Outreach Service",
                sub_services: [
                  {
                    label: "Required Additional Service Points",
                    type: "number",
                    count: null,
                  },
                  {
                    label: "Vaccinator Required per Available Service Point",
                    type: "number",
                    count: null,
                  },
                ],
              },
              {
                label: null,
                count: null,
                sub_label: "Facility-based Service",
                sub_services: [
                  {
                    label: "Required Additional Days",
                    type: "number",
                    count: null,
                  },
                  {
                    label: "Vaccinator Required per Available Days",
                    type: "number",
                    count: null,
                  },
                ],
              },
            ],
          },
        ]
      }

      return [
        {
          label: "Service Percentage by Type",
          services: [
            {
              label: "Outreach Service",
              type: "percentage",
              count: Number(savedEstimation.outreach_service_percentage || 0),
            },
            {
              label: "Facility-based Service",
              type: "percentage",
              count: Number(savedEstimation.facility_service_percentage || 0),
            },
          ],
        },
        {
          label: "Required Monthly Service Points",
          services: [
            {
              label: "Outreach Service",
              type: "number",
              count: savedEstimation.required_monthly_outreach_service ?? 0,
            },
            {
              label: "Facility-based Service",
              type: "number",
              count: savedEstimation.required_monthly_facility_service ?? 0,
            },
          ],
        },
        {
          label: "Available Service Points/Days",
          services: [
            {
              label: "Outreach Service",
              type: "number",
              count: savedEstimation.available_outreach_service ?? 0,
            },
            {
              label: "Facility-based Service",
              type: "number",
              count: savedEstimation.available_facillity_service ?? 0,
            },
          ],
        },
        {
          label: "Option of Immunization Service Solution",
          services: [
            {
              label: null,
              count: null,
              sub_label: "Outreach Service",
              sub_services: [
                {
                  label: "Required Additional Service Points",
                  type: "number",
                  count: savedEstimation.additional_outreach_service ?? 0,
                },
                {
                  label: "Vaccinator Required per Available Service Point",
                  type: "number",
                  count:
                    savedEstimation.additional_outreach_vaccinator_service ?? 0,
                },
              ],
            },
            {
              label: null,
              count: null,
              sub_label: "Facility-based Service",
              sub_services: [
                {
                  label: "Required Additional Days",
                  type: "number",
                  count: savedEstimation.additional_facility_service ?? 0,
                },
                {
                  label: "Vaccinator Required per Available Days",
                  type: "number",
                  count:
                    savedEstimation.additional_facility_vaccinator_service ?? 0,
                },
              ],
            },
          ],
        },
      ]
    }

    const buildCommunityHealthWorker = () => {
      if (!savedEstimation) {
        return [
          { label: "Ideal Needs", count: null },
          { label: "Available Community Health Worker", count: null },
          { label: "Gap of Community Health Worker", count: null },
        ]
      }

      return [
        {
          label: "Ideal Needs",
          type: "number",
          count: savedEstimation.health_worker_ideal_needs ?? 0,
        },
        {
          label: "Available Community Health Worker",
          type: "number",
          count: savedEstimation.available_worker ?? 0,
        },
        {
          label: "Gap of Community Health Worker",
          type: "number",
          count: savedEstimation.gap_health_worker ?? 0,
        },
      ]
    }

    const { yearlyBblBaduta, yearlyWus, monthly } = this.#calcYearlyInjections(
      bbl,
      si,
      baduta,
      wus
    )

    return {
      entity_id: param.id,
      name: location?.name ? `${VILLAGE_LABEL} ${location.name}` : null,
      immunization_service: buildImmunizationService(),
      community_health_worker: buildCommunityHealthWorker(),
      number_of_target: [
        { label: VILLAGE_TARGET_LABELS[1], count: bbl },
        { label: VILLAGE_TARGET_LABELS[2], count: si },
        { label: VILLAGE_TARGET_LABELS[3], count: baduta },
        { label: VILLAGE_TARGET_LABELS[9], count: wus },
      ],
      number_of_injection: [
        {
          label: "Annual",
          count: yearlyBblBaduta + yearlyWus,
          targets: [
            {
              label: "Bayi Baru Lahir (BBL) & Baduta",
              type: "number",
              count: yearlyBblBaduta,
            },
            {
              label: "Wanita Usia Subur (WUS)",
              type: "number",
              count: yearlyWus,
            },
          ],
        },
        {
          label: "Monthly",
          count: monthly,
        },
      ],
    }
  }

  async #getTargetSummaryBias(
    c: Context,
    param: GetDetailCalculateDTO
  ): Promise<TargetSummaryResponse> {
    const {
      sub_district_id,
      name: entityName,
      global_id,
    } = c.var.userEntity ?? {}
    if (!global_id) throw new ValidationError("Entity not found")

    const microplanningId = await this.targetsRepo.findOrCreateMicroplanning(
      c,
      global_id,
      new Date().getFullYear() + 1
    )

    const isOutOfSchool = param.id === global_id

    const [counts, schoolName, savedEstimation] = await Promise.all([
      isOutOfSchool
        ? this.biasRepo.getOutOfSchoolTargetCounts(
            c,
            Number(sub_district_id),
            SCHOOL_TARGET_GROUPS,
            microplanningId
          )
        : this.biasRepo.getTargetCountsByEntityId(
            c,
            param.id,
            SCHOOL_TARGET_GROUPS,
            microplanningId
          ),
      isOutOfSchool
        ? Promise.resolve({ name: entityName ?? "Out of School" })
        : this.biasRepo.getSchoolName(c, param.id),
      this.biasRepo.getSchoolEstimationDetailsByMicroplanning(
        c,
        param.id,
        microplanningId
      ),
    ])

    if (!schoolName) throw new ValidationError("School not exist")

    const countMap = createCountMap(counts)
    const gradeCounts = this.#extractSchoolGrades(countMap)

    const formattedCounts = counts.map((row) => ({
      target_group_id: row.target_group_id!,
      count: Number(row.count),
    }))

    const augustSaved = savedEstimation.find(
      (d) => d.schedule_month === "August"
    )
    const novemberSaved = savedEstimation.find(
      (d) => d.schedule_month === "November"
    )

    const calculations = this.#calculateBiasInjections(formattedCounts, {
      august_immunization_service: 0,
      november_immunization_service: 0,
    })

    const buildServices = (
      saved: typeof augustSaved,
      calc: typeof calculations,
      isAugust: boolean
    ) => {
      if (saved) {
        return [
          {
            label: "Number of Service Service Points Required",
            type: "number",
            count: saved.required_service ?? 0,
          },
          {
            label: "Number of Service Days Required",
            type: "number",
            count: saved.required_service_days ?? 0,
          },
          {
            label: "Number of Vaccinators Carrying Out BIAS",
            type: "number",
            count: saved.available_vaccinator ?? 0,
          },
        ]
      }
      const serviceDays = isAugust
        ? calc.augustServiceDays
        : calc.novemberServiceDays
      return [
        {
          label: "Number of Service Service Points Required",
          type: "number",
          count: isAugust ? calc.augustSessions : calc.novemberSessions,
        },
        {
          label: "Number of Service Days Required",
          type: "number",
          count: isNaN(serviceDays) ? 0 : serviceDays,
        },
        {
          label: "Number of Vaccinators Carrying Out BIAS",
          type: "number",
          count: null,
        },
      ]
    }

    const augustServices = buildServices(augustSaved, calculations, true)
    const novemberServices = buildServices(novemberSaved, calculations, false)

    return {
      entity_id: isOutOfSchool ? global_id : param.id,
      name: schoolName?.name ?? null,
      immunization_service: [
        {
          label: "Immunization Service on August",
          services: augustServices,
        },
        {
          label: "Immunization Service on November",
          services: novemberServices,
        },
      ],
      number_of_target: [
        {
          label: SCHOOL_TARGET_LABELS[4],
          type: "number",
          count: gradeCounts.grade1,
        },
        {
          label: SCHOOL_TARGET_LABELS[5],
          type: "number",
          count: gradeCounts.grade2,
        },
        {
          label: SCHOOL_TARGET_LABELS[7],
          targets: [
            {
              label: "Td @10 ds (Male & Female)",
              type: "number",
              count: gradeCounts.grade5Female + gradeCounts.grade5Male,
            },
            {
              label: "HPV @1 DS (Female)",
              type: "number",
              count: gradeCounts.grade5Female,
            },
          ],
        },
      ],
      number_of_injection: [
        {
          label: "August",
          type: "number",
          count: this.#getMonthlyInjection(countMap, true),
        },
        {
          label: "November",
          type: "number",
          count: this.#getMonthlyInjection(countMap, false),
        },
      ],
    }
  }

  async #getOutOfSchoolServiceSummary(
    c: Context,
    subDistrictId: number,
    microplanningId: number
  ) {
    const entityId = c.var.userEntity?.global_id

    const counts = await this.biasRepo.getOutOfSchoolTargetCounts(
      c,
      subDistrictId,
      SCHOOL_TARGET_GROUPS
    )

    const countMap = createCountRecord(counts)
    const gradeCounts = this.#extractSchoolGrades(countMap)
    const biasCalc = this.#calcBiasInjections(
      gradeCounts.grade1,
      gradeCounts.grade2,
      gradeCounts.grade5Female,
      gradeCounts.grade5Male
    )

    let augustVaccinator = 0
    let novemberVaccinator = 0

    if (entityId) {
      const details =
        await this.biasRepo.getSchoolEstimationDetailsByMicroplanning(
          c,
          entityId,
          microplanningId
        )

      for (const detail of details) {
        if (detail.schedule_month === "August") {
          augustVaccinator += Number(detail.available_vaccinator ?? 0)
        } else if (detail.schedule_month === "November") {
          novemberVaccinator += Number(detail.available_vaccinator ?? 0)
        }
      }
    }

    const augustServiceDays = augustVaccinator
      ? Math.floor(biasCalc.augustServiceRequired / augustVaccinator)
      : 0
    const novemberServiceDays = novemberVaccinator
      ? Math.floor(biasCalc.novemberServiceRequired / novemberVaccinator)
      : 0

    return {
      august_service_points: biasCalc.augustServiceRequired,
      august_service_days: augustServiceDays,
      august_vaccinator: augustVaccinator,
      november_service_points: biasCalc.novemberServiceRequired,
      november_service_days: novemberServiceDays,
      november_vaccinator: novemberVaccinator,
    }
  }

  async #getNonBiasDashboard(
    c: Context,
    subDistrictId: number,
    microplanningId: number
  ): Promise<ImmunizationServiceSummary> {
    const villageData = await this.nonBiasRepo.getImmunizationServiceDashboard(
      c,
      subDistrictId,
      microplanningId
    )

    let totalMonthlyOutreach = 0,
      totalMonthlyFacility = 0
    let totalAvailableOutreach = 0,
      totalAvailableFacility = 0
    let totalAdditionalOutreach = 0,
      totalAdditionalFacility = 0
    let totalVaccinatorOutreach = 0,
      totalVaccinatorFacility = 0

    const villages = villageData.map((village) => {
      const outreachPercentage = Number(
        village.outreach_service_percentage ?? 0
      )
      const facilityPercentage = Number(
        village.facility_service_percentage ?? 0
      )
      const monthlyOutreach = village.required_monthly_outreach_service ?? 0
      const monthlyFacility = village.required_monthly_facility_service ?? 0
      const availableOutreach = village.available_outreach_service ?? 0
      const availableFacility = village.available_facillity_service ?? 0
      const additionalOutreach = village.additional_outreach_service ?? 0
      const additionalFacility = village.additional_facility_service ?? 0
      const vaccinatorOutreach =
        village.additional_outreach_vaccinator_service ?? 0
      const vaccinatorFacility =
        village.additional_facility_vaccinator_service ?? 0

      totalMonthlyOutreach += monthlyOutreach
      totalMonthlyFacility += monthlyFacility
      totalAvailableOutreach += availableOutreach
      totalAvailableFacility += availableFacility
      totalAdditionalOutreach += additionalOutreach
      totalAdditionalFacility += additionalFacility
      totalVaccinatorOutreach += vaccinatorOutreach
      totalVaccinatorFacility += vaccinatorFacility

      return {
        id: village.village_id,
        name: VILLAGE_LABEL + " " + village.village_name,
        service_percentage_by_type: [
          {
            label: "Outreach Service",
            type: "percentage",
            count: outreachPercentage,
          },
          {
            label: "Facility-based Service",
            type: "percentage",
            count: facilityPercentage,
          },
        ],
        required_monthly_service_points: [
          {
            label: "Outreach Service",
            type: "number",
            count: monthlyOutreach,
          },
          {
            label: "Facility-based Service",
            type: "number",
            count: monthlyFacility,
          },
        ],
        available_service_points_days: [
          {
            label: "Outreach Service",
            type: "number",
            count: availableOutreach,
          },
          {
            label: "Facility-based Service",
            type: "number",
            count: availableFacility,
          },
        ],
        option_of_immunization_service_solution: [
          {
            sub_label: "Outreach Service",
            items: [
              {
                label: "Required Additional Service Points",
                type: "number",
                count: additionalOutreach,
              },
              {
                label: "Vaccinator Required per Available Service Point",
                type: "number",
                count: vaccinatorOutreach,
              },
            ],
          },
          {
            sub_label: "Facility-based Service",
            items: [
              {
                label: "Required Additional Days",
                type: "number",
                count: additionalFacility,
              },
              {
                label: "Vaccinator Required per Available Days",
                type: "number",
                count: vaccinatorFacility,
              },
            ],
          },
        ],
      }
    })

    return {
      aggregate_of_all_villages: `Aggregate of all villages under this health facility`,
      required_monthly_service_points: [
        {
          label: "Outreach Service",
          type: "number",
          count: totalMonthlyOutreach,
        },
        {
          label: "Facility-based Service",
          type: "number",
          count: totalMonthlyFacility,
        },
      ],
      available_service_points_days: [
        {
          label: "Outreach Service",
          type: "number",
          count: totalAvailableOutreach,
        },
        {
          label: "Facility-based Service",
          type: "number",
          count: totalAvailableFacility,
        },
      ],
      option_of_immunization_service_solution: [
        {
          sub_label: "Outreach Service",
          items: [
            {
              label: "Required Additional Service Points",
              type: "number",
              count: totalAdditionalOutreach,
            },
            {
              label: "Vaccinator Required per Available Service Point",
              type: "number",
              count: totalVaccinatorOutreach,
            },
          ],
        },
        {
          sub_label: "Facility-based Service",
          items: [
            {
              label: "Required Additional Days",
              type: "number",
              count: totalAdditionalFacility,
            },
            {
              label: "Vaccinator Required per Available Days",
              type: "number",
              count: totalVaccinatorFacility,
            },
          ],
        },
      ],
      immunization_service_by_village: {
        data: villages,
      },
    }
  }

  async #getBiasDashboard(
    c: Context,
    subDistrictId: number,
    microplanningId: number
  ): Promise<ImmunizationServiceBiasSummary> {
    const schoolData = await this.biasRepo.getImmunizationServiceDashboard(
      c,
      subDistrictId,
      microplanningId
    )

    let totalAugustServicePoints = 0,
      totalAugustServiceDays = 0,
      totalAugustVaccinators = 0
    let totalNovemberServicePoints = 0,
      totalNovemberServiceDays = 0,
      totalNovemberVaccinators = 0

    const entityIds = schoolData
      .map((s) => s.entity_id!)
      .filter((id) => id != null)
    const batchCounts = await this.biasRepo.getBatchTargetCountsByEntityIds(
      c,
      entityIds,
      SCHOOL_TARGET_GROUPS,
      microplanningId
    )

    const countsMap = new Map(
      batchCounts.map((item) => [
        item.entity_id,
        createCountRecord(item.counts),
      ])
    )

    const schools = schoolData.map((school) => {
      const countMap =
        countsMap.get(school.entity_id) ?? ({} as Record<number, number>)
      const gradeCounts = this.#extractSchoolGrades(countMap)
      const biasCalc = this.#calcBiasInjections(
        gradeCounts.grade1,
        gradeCounts.grade2,
        gradeCounts.grade5Female,
        gradeCounts.grade5Male
      )

      const augustServicePoints = biasCalc.augustServiceRequired
      const augustServiceDays = Number(school.august_vaccinator)
        ? augustServicePoints / Number(school.august_vaccinator)
        : 0
      const novemberServicePoints = biasCalc.novemberServiceRequired
      const novemberServiceDays = Number(school.november_vaccinator)
        ? novemberServicePoints / Number(school.november_vaccinator)
        : 0

      const augustVaccinators = Number(school.august_vaccinator ?? 0)
      const novemberVaccinators = Number(school.november_vaccinator ?? 0)

      totalAugustServicePoints += augustServicePoints
      totalAugustServiceDays += augustServiceDays
      totalAugustVaccinators += augustVaccinators
      totalNovemberServicePoints += novemberServicePoints
      totalNovemberServiceDays += novemberServiceDays
      totalNovemberVaccinators += novemberVaccinators

      return {
        id: school.entity_id,
        name: school.entity_name ?? "",
        immunization_service_on_august: [
          {
            label: "Number of Service Service Points Required",
            type: "number",
            count: augustServicePoints,
          },
          {
            label: "Number of Service Days Required",
            type: "number",
            count: augustServiceDays,
          },
          {
            label: "Number of Vaccinators Carrying Out BIAS",
            type: "number",
            count: augustVaccinators,
          },
        ],
        immunization_service_on_november: [
          {
            label: "Number of Service Service Points Required",
            type: "number",
            count: novemberServicePoints,
          },
          {
            label: "Number of Service Days Required",
            type: "number",
            count: novemberServiceDays,
          },
          {
            label: "Number of Vaccinators Carrying Out BIAS",
            type: "number",
            count: novemberVaccinators,
          },
        ],
      }
    })

    const outOfSchoolData = await this.#getOutOfSchoolServiceSummary(
      c,
      subDistrictId,
      microplanningId
    )

    return {
      aggregate_of_all_schools: `Aggregate of all schools under this health facility`,
      immunization_service_on_august: [
        {
          label: "Number of Service Service Points Required",
          type: "number",
          count:
            totalAugustServicePoints + outOfSchoolData.august_service_points,
        },
        {
          label: "Number of Service Days Required",
          type: "number",
          count: totalAugustServiceDays + outOfSchoolData.august_service_days,
        },
        {
          label: "Number of Vaccinators Carrying Out BIAS",
          type: "number",
          count: totalAugustVaccinators + outOfSchoolData.august_vaccinator,
        },
      ],
      immunization_service_on_november: [
        {
          label: "Number of Service Service Points Required",
          type: "number",
          count:
            totalNovemberServicePoints +
            outOfSchoolData.november_service_points,
        },
        {
          label: "Number of Service Days Required",
          type: "number",
          count:
            totalNovemberServiceDays + outOfSchoolData.november_service_days,
        },
        {
          label: "Number of Vaccinators Carrying Out BIAS",
          type: "number",
          count: totalNovemberVaccinators + outOfSchoolData.november_vaccinator,
        },
      ],
      immunization_service_summary_by_school: {
        data_out_of_school: [
          {
            id: 0,
            name: "Children Not in School",
            immunization_service_on_august: [
              {
                label: "Number of Service Service Points Required",
                type: "number",
                count: outOfSchoolData.august_service_points,
              },
              {
                label: "Number of Service Days Required",
                type: "number",
                count: outOfSchoolData.august_service_days,
              },
              {
                label: "Number of Vaccinators Carrying Out BIAS",
                type: "number",
                count: outOfSchoolData.august_vaccinator,
              },
            ],
            immunization_service_on_november: [
              {
                label: "Number of Service Service Points Required",
                type: "number",
                count: outOfSchoolData.november_service_points,
              },
              {
                label: "Number of Service Days Required",
                type: "number",
                count: outOfSchoolData.november_service_days,
              },
              {
                label: "Number of Vaccinators Carrying Out BIAS",
                type: "number",
                count: outOfSchoolData.november_vaccinator,
              },
            ],
          },
        ],
        data: schools,
      },
    }
  }

  async getTargetSummaryById(
    c: Context,
    query: GetDetailCalculateDTO
  ): Promise<TargetSummaryResponse> {
    if (query.category === "non-bias") {
      return this.#getTargetSummaryNonBias(c, query)
    }
    return this.#getTargetSummaryBias(c, query)
  }

  async calculateTargetEstimation(
    c: Context,
    param: CalculateTargetEstimationPathRequestDTO,
    data: CalculateTargetEstimationRequestDTO
  ) {
    const { id } = param
    const targetIds = VILLAGE_TARGET_GROUPS

    const location = await this.locationRepository.findByID(c, id)
    if (!location) {
      throw new ValidationError("ID not exist")
    }

    const counts = await this.locationRepository.getTargetCountsByLocationId(
      c,
      id,
      targetIds
    )
    const countMap = createCountMap(counts)
    const { bbl, si, baduta, wus } = this.#extractVillageTargets(countMap)

    const calc = this.#calculateInjections(counts, data)

    return {
      entity_id: id,
      name: location?.name ? `${VILLAGE_LABEL} ${location.name}` : null,
      immunization_service: [
        {
          label: "Service Percentage by Type",
          services: [
            {
              label: "Outreach Service",
              type: "percentage",
              count: data.outreach_service_percentage,
            },
            {
              label: "Facility-based Service",
              type: "percentage",
              count: data.facility_based_service_percentage,
            },
          ],
        },
        {
          label: "Required Monthly Service Points",
          services: [
            {
              label: "Outreach Service",
              type: "number",
              count: Math.ceil(calc.outreaceServiceNeededEveryMonth),
            },
            {
              label: "Facility-based Service",
              type: "number",
              count: Math.ceil(calc.facilityBasedServiceNeededEveryMonth),
            },
          ],
        },
        {
          label: "Available Service Points/Days",
          services: [
            {
              label: "Outreach Service",
              type: "number",
              count: data.outreach_service_available_number,
            },
            {
              label: "Facility-based Service",
              type: "number",
              count: data.facility_based_service_available_number,
            },
          ],
        },
        {
          label: "Option of Immunization Service Solution",
          services: [
            {
              label: null,
              count: null,
              sub_label: "Outreach Service",
              sub_services: [
                {
                  label: "Required Additional Service Points",
                  type: "number",
                  count: Math.ceil(calc.optionalOutreachAdditionalService),
                },
                {
                  label: "Vaccinator Required per Available Service Point",
                  type: "number",
                  count: Math.ceil(calc.optionalOutreachAdditionalVaccinator),
                },
              ],
            },
            {
              label: null,
              count: null,
              sub_label: "Facility-based Service",
              sub_services: [
                {
                  label: "Required Additional Days",
                  type: "number",
                  count: Math.ceil(calc.optionalFacilityBasedAdditionalService),
                },
                {
                  label: "Vaccinator Required per Available Days",
                  type: "number",
                  count: Math.ceil(
                    calc.optionalFacilityBasedAdditionalVaccinator
                  ),
                },
              ],
            },
          ],
        },
      ],
      community_health_worker: [
        {
          label: "Ideal Needs",
          count: calc.idealNeededWorker,
        },
        {
          label: "Available Community Health Worker",
          count: null,
        },
        {
          label: "Gap of Community Health Worker",
          count: null,
        },
      ],
      number_of_target: [
        { label: VILLAGE_TARGET_LABELS[1], count: bbl },
        { label: VILLAGE_TARGET_LABELS[2], count: si },
        { label: VILLAGE_TARGET_LABELS[3], count: baduta },
        { label: VILLAGE_TARGET_LABELS[9], count: wus },
      ],
      number_of_injection: [
        {
          label: "Annual",
          count: calc.injectionPerYearInfantBaduta + calc.injectionPerYearWUS,
          targets: [
            {
              label: "Bayi Baru Lahir (BBL) & Baduta",
              type: "number",
              count: calc.injectionPerYearInfantBaduta,
            },
            {
              label: "Wanita Usia Subur (WUS)",
              type: "number",
              count: calc.injectionPerYearWUS,
            },
          ],
        },
        {
          label: "Monthly",
          count: calc.injectionPerMonth,
        },
      ],
    }
  }

  async saveEstimation(
    c: Context,
    data: SaveEstimationRequest,
    entityId: number
  ) {
    const currentYear = new Date().getFullYear()
    const nextYear = currentYear + 1
    const microplanningId = await this.targetsRepo.findOrCreateMicroplanning(
      c,
      entityId,
      nextYear
    )

    const existing = await this.nonBiasRepo.findByMicroplanningAndVillage(
      c,
      microplanningId,
      data.village_id
    )
    if (existing) {
      return {
        message: "Estimation already exists",
        id: existing.microplanning_id,
      }
    }

    const villageDetail = await this.nonBiasRepo.saveVillageDetail(c, {
      microplanning_id: microplanningId,
      village_id: data.village_id,
      outreach_service_percentage: data.service_percentage_outreach,
      facility_service_percentage: data.service_percentage_facility,
      required_monthly_outreach_service: data.required_monthly_outreach,
      required_monthly_facility_service: data.required_monthly_facility,
      available_outreach_service: data.available_service_outreach,
      available_facillity_service: data.available_service_facility,
      additional_outreach_service: data.required_additional_outreach,
      additional_facility_service: data.required_additional_facility,
      health_worker_ideal_needs: data.ideal_needs,
      available_worker: data.available_worker,
      gap_health_worker: data.gap_worker,
    })

    return {
      message: "Estimation saved successfully",
      id: microplanningId,
      village_detail_id: Number(villageDetail.insertId),
    }
  }

  async saveEstimationBias(
    c: Context,
    data: SaveEstimationBiasRequest,
    entityId: number
  ) {
    const currentYear = new Date().getFullYear()
    const nextYear = currentYear + 1
    const microplanningId = await this.targetsRepo.findOrCreateMicroplanning(
      c,
      entityId,
      nextYear
    )

    const existing = await this.biasRepo.findByMicroplanningAndSchool(
      c,
      microplanningId,
      data.school_id
    )
    if (existing && existing.length > 0) {
      return {
        message: "Bias estimation already exists",
        id: microplanningId,
      }
    }

    const augustDetail = await this.biasRepo.saveSchoolDetail(c, {
      microplanning_id: microplanningId,
      school_id: data.school_id,
      required_service: data.august_service_point,
      required_service_days: data.august_service_days,
      available_vaccinator: data.august_vaccinator,
      schedule_month: "August",
    })

    const novemberDetail = await this.biasRepo.saveSchoolDetail(c, {
      microplanning_id: microplanningId,
      school_id: data.school_id,
      required_service: data.november_service_point,
      required_service_days: data.november_service_days,
      available_vaccinator: data.november_vaccinator,
      schedule_month: "November",
    })

    return {
      message: "Bias estimation saved successfully",
      id: microplanningId,
      august_detail_id: Number(augustDetail.insertId),
      november_detail_id: Number(novemberDetail.insertId),
    }
  }

  async updateEstimation(
    c: Context,
    params: VillageIdParam,
    data: UpdateEstimationRequest,
    entityId: number
  ) {
    const currentYear = new Date().getFullYear()
    const nextYear = currentYear + 1
    const microplanningId = await this.targetsRepo.findOrCreateMicroplanning(
      c,
      entityId,
      nextYear
    )

    const existing = await this.nonBiasRepo.findByMicroplanningAndVillage(
      c,
      microplanningId,
      params.village_id
    )

    if (!existing) {
      throw new NotFoundError(
        c.var.t("validator.not_exist", {
          field: c.var.t("target_estimation_non_bias.label.village_id"),
        })
      )
    }

    await this.nonBiasRepo.updateVillageDetail(c, existing.id, {
      outreach_service_percentage: data.service_percentage_outreach,
      facility_service_percentage: data.service_percentage_facility,
      required_monthly_outreach_service: data.required_monthly_outreach,
      required_monthly_facility_service: data.required_monthly_facility,
      available_outreach_service: data.available_service_outreach,
      available_facillity_service: data.available_service_facility,
      additional_outreach_service: data.required_additional_outreach,
      additional_facility_service: data.required_additional_facility,
      health_worker_ideal_needs: data.ideal_needs,
      available_worker: data.available_worker,
      gap_health_worker: data.gap_worker,
    })

    return {
      message: "Estimation updated successfully",
      id: microplanningId,
      village_detail_id: existing.id,
    }
  }

  async updateEstimationBias(
    c: Context,
    params: SchoolIdParam,
    data: UpdateEstimationBiasRequest,
    entityId: number
  ) {
    const currentYear = new Date().getFullYear()
    const nextYear = currentYear + 1
    const microplanningId = await this.targetsRepo.findOrCreateMicroplanning(
      c,
      entityId,
      nextYear
    )

    const existingDetails = await this.biasRepo.findByMicroplanningAndSchool(
      c,
      microplanningId,
      params.school_id
    )

    if (!existingDetails || existingDetails.length === 0) {
      throw new NotFoundError(
        c.var.t("validator.not_exist", {
          field: c.var.t("target_estimation_bias.label.school_id"),
        })
      )
    }

    const augustRecord = existingDetails.find(
      (d) => d.schedule_month === "August"
    )
    const novemberRecord = existingDetails.find(
      (d) => d.schedule_month === "November"
    )

    const updateResults: Array<{ month: string; detail_id: number }> = []

    if (augustRecord) {
      await this.biasRepo.updateSchoolDetail(c, augustRecord.id, {
        required_service: data.august_service_point,
        required_service_days: data.august_service_days,
        available_vaccinator: data.august_vaccinator,
      })
      updateResults.push({ month: "August", detail_id: augustRecord.id })
    }

    if (novemberRecord) {
      await this.biasRepo.updateSchoolDetail(c, novemberRecord.id, {
        required_service: data.november_service_point,
        required_service_days: data.november_service_days,
        available_vaccinator: data.november_vaccinator,
      })
      updateResults.push({ month: "November", detail_id: novemberRecord.id })
    }

    return {
      message: "Bias estimation updated successfully",
      id: microplanningId,
      updated_details: updateResults,
    }
  }

  async getImmunizationServiceDashboard(
    c: Context,
    param: GlobalCategoryRequestDTO,
    subDistrictId: number,
    entityId: number
  ) {
    const currentYear = new Date().getFullYear()
    const nextYear = currentYear + 1
    const microplanningId = await this.targetsRepo.findOrCreateMicroplanning(
      c,
      entityId,
      nextYear
    )

    if (param.category === "bias") {
      return this.#getBiasDashboard(c, subDistrictId, microplanningId)
    }
    return this.#getNonBiasDashboard(c, subDistrictId, microplanningId)
  }

  async getCommunityHealthWorkerSummary(
    c: Context,
    subDistrictId: number
  ): Promise<CommunityHealthWorkerSummary> {
    const rawData = await this.nonBiasRepo.getWorkerDataBySubDistrict(
      c,
      subDistrictId
    )

    let sumIdeal = 0,
      sumAvailable = 0,
      sumGap = 0

    const villages = rawData.map((v) => {
      const ideal = v.health_worker_ideal_needs ?? 0
      const available = v.available_worker ?? 0
      const gap = v.gap_health_worker ?? 0

      sumIdeal += ideal
      sumAvailable += available
      sumGap += gap

      return {
        village_id: v.village_id,
        village_name: VILLAGE_LABEL + " " + v.village_name.toUpperCase(),
        data: [
          {
            label: "Ideal Needs",
            type: "number",
            count: ideal,
          },
          {
            label: "Available Community Health Worker",
            type: "number",
            count: available,
          },
          {
            label: "Gap of Community Health Worker",
            type: "number",
            count: gap,
          },
        ],
      }
    })

    return {
      aggregate_of_all_villages: `Aggregate of all villages under this health facility`,
      summary: [
        {
          label: "Ideal Needs",
          type: "number",
          count: sumIdeal,
        },
        {
          label: "Available Community Health Worker",
          type: "number",
          count: sumAvailable,
        },
        {
          label: "Gap of Community Health Worker",
          type: "number",
          count: sumGap,
        },
      ],
      community_health_worker_by_village: villages,
    }
  }

  async getDataChecker(
    c: Context,
    category: string,
    subDistrictId: number,
    entityId: number,
    keyword?: string
  ): Promise<EntityListResponse | SchoolDataResponse> {
    const currentYear = new Date().getFullYear()
    const nextYear = currentYear + 1
    const microplanningId = await this.targetsRepo.findOrCreateMicroplanning(
      c,
      entityId,
      nextYear
    )

    if (category === "bias") {
      return this.#checkSchoolData(c, subDistrictId, microplanningId, keyword)
    }
    return this.#checkVillageData(c, subDistrictId, microplanningId, keyword)
  }

  async getInjectionDashboard(
    c: Context,
    category: string,
    subDistrictId: number
  ): Promise<InjectionDashboardSummary> {
    const entityId = c.var.userEntity.global_id
    if (!entityId) {
      throw new ValidationError("Entity not found")
    }
    const currentYear = new Date().getFullYear()
    const nextYear = currentYear + 1

    const microplanningId = await this.targetsRepo.findOrCreateMicroplanning(
      c,
      entityId,
      nextYear
    )
    if (category === "bias") {
      return this.#getInjectionDashboardBias(c, subDistrictId, microplanningId)
    }
    return this.#getInjectionDashboardNonBias(c, subDistrictId, microplanningId)
  }
}
