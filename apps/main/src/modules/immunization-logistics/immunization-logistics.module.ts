import { Context } from "hono"
import {
  AbsoluteNumberofRoutineImmunization,
  NumberVaccineVialsUsed,
  VaccineVialsUsedBySchool,
  NumberOfVaccineUtilizationRate,
  VaccineUtilizationRateBias,
  ProjectedOneYearVaccine,
  ProjectedMonthlyVaccine,
  DetailMonthlyProjectedVaccine,
  ImmunizationLogisticsNeed,
  DetailMonthlyVaccineLogistic,
  ImmunizationAchievementsSummary,
  VialNeedsBySchool,
  DetailVialNeedsBySchool,
  AdsSbNeeds,
} from "./immunization-logistics.schema.js"
import { TargetEstimationNonBiasRepository } from "../target-estimation-non-bias/target-estimation-non-bias.repository.js"
import { MaterialRepository } from "../material/material.repository.js"
import { ImmunizationLogisticsRepository } from "./immunization-logistics.repository.js"
import { TargetsRepository } from "../targets/targets.repository.js"
import { VILLAGE_LABEL } from "@/common/constants/target.js"

export class ImmunizationLogisticsModule {
  constructor(
    private readonly nonBiasRepo: TargetEstimationNonBiasRepository,
    private readonly materialRepo: MaterialRepository,
    private readonly immunizationLogisticsRepo: ImmunizationLogisticsRepository,
    private readonly targetsRepo: TargetsRepository
  ) {}

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

  async getNumberOfRoutineImmunization(
    c: Context,
    subDistrictId: number,
    entityId: number
  ): Promise<AbsoluteNumberofRoutineImmunization> {
    const currentYear = new Date().getFullYear()
    const nextYear = currentYear + 1
    const microplanningId = await this.targetsRepo.findOrCreateMicroplanning(
      c,
      entityId,
      nextYear
    )

    const villages = await this.nonBiasRepo.getVillagesBySubDistrict(
      c,
      subDistrictId,
      microplanningId
    )

    const dbData = await this.immunizationLogisticsRepo.getVillageMaterialData(
      c,
      subDistrictId,
      microplanningId
    )

    const materialTargets = await this.materialRepo.findMaterialsFromTargets(
      c,
      "primary",
      "non_bias"
    )

    const materialIds = materialTargets.map((m) => m.material_id)
    const rawMaterial = await this.materialRepo.findWsMaterialsByIds(
      c,
      materialIds
    )

    const materialNameMap = new Map<number, string>()
    materialTargets.forEach((m) => {
      materialNameMap.set(m.material_id, m.name)
    })

    const villageDataMap = new Map<number, Map<number, number>>()
    const materialSummary = new Map<number, number>()

    for (const row of dbData) {
      if (!villageDataMap.has(row.village_id)) {
        villageDataMap.set(row.village_id, new Map())
      }

      if (
        row.material_id &&
        row.absolute_number_of_routine_immunization !== null
      ) {
        villageDataMap
          .get(row.village_id)!
          .set(row.material_id, row.absolute_number_of_routine_immunization)

        const current = materialSummary.get(row.material_id) ?? 0
        materialSummary.set(
          row.material_id,
          current + row.absolute_number_of_routine_immunization
        )
      }
    }

    const summary = rawMaterial.map((m) => ({
      label: materialNameMap.get(m.id) ?? "",
      type: "number",
      count: materialSummary.get(m.id) ?? 0,
    }))

    const entities = villages.map((v) => {
      const materials = villageDataMap.get(v.village_id) ?? new Map()
      return {
        id: v.village_id,
        label: VILLAGE_LABEL + " " + v.village_name.toUpperCase(),
        data: rawMaterial.map((m) => ({
          label: materialNameMap.get(m.id) ?? "",
          type: "number",
          count: materials.get(m.id) ?? 0,
        })),
      }
    })

    return {
      summary,
      absolute_number_of_routine_immunization_by_villages: {
        data: entities,
      },
    }
  }

  async getVaccineVialsUsedBySchool(
    c: Context,
    subDistrictId: number,
    entityId: number
  ): Promise<VaccineVialsUsedBySchool> {
    const currentYear = new Date().getFullYear()
    const nextYear = currentYear + 1
    const microplanningId = await this.targetsRepo.findOrCreateMicroplanning(
      c,
      entityId,
      nextYear
    )

    const materialTargets = await this.materialRepo.findMaterialsFromTargets(
      c,
      "primary",
      "bias"
    )

    const materialIds = materialTargets.map((m) => m.material_id)
    const rawMaterials = await this.materialRepo.findWsMaterialsByIds(
      c,
      materialIds
    )

    const materialCodeToIdMap = new Map<string, number>()
    rawMaterials.forEach((m) => {
      materialCodeToIdMap.set(m.code, m.id)
    })

    const mrId = this.#findMaterialIdByCodeVariations(materialCodeToIdMap, [
      "MR",
      "MR @10 ds",
      "MR 1 @10 ds and MR 2 @10 ds",
      "VAKSIN MEASLES RUBELLA (MR) 10 DS/ PARTNERSHIP",
    ])
    const dtId = this.#findMaterialIdByCodeVariations(materialCodeToIdMap, [
      "DT",
      "DT @10 ds",
      "VAKSIN DT 10 DS",
    ])
    const tdId = this.#findMaterialIdByCodeVariations(materialCodeToIdMap, [
      "Td",
      "Td @10 ds",
      "VAKSIN TD 10 DS",
    ])
    const hpvId = this.#findMaterialIdByCodeVariations(materialCodeToIdMap, [
      "HPV",
      "HPV @1 DS",
      "HPV NusaGard",
    ])

    const [schools, materialNeedsData, outOfSchoolMaterialData] =
      await Promise.all([
        this.immunizationLogisticsRepo.getSchoolsBySubDistrict(
          c,
          subDistrictId,
          microplanningId
        ),
        this.immunizationLogisticsRepo.getSchoolMaterialNeedsDetails(
          c,
          subDistrictId,
          microplanningId,
          entityId
        ),
        this.immunizationLogisticsRepo.getOutOfSchoolMaterialNeedsDetails(
          c,
          subDistrictId,
          microplanningId
        ),
      ])

    const materialDataMap = new Map<number, Map<number, number>>()

    for (const row of materialNeedsData) {
      if (!row.school_id || !row.material_id) continue

      if (!materialDataMap.has(row.school_id)) {
        materialDataMap.set(row.school_id, new Map())
      }

      const vialsUsed = Number(row.number_of_vials_used || 0)
      materialDataMap.get(row.school_id)!.set(row.material_id, vialsUsed)
    }

    const outOfSchoolMaterialMap = new Map<number, number>()
    for (const row of outOfSchoolMaterialData) {
      if (!row.material_id) continue
      const vialsUsed = Number(row.number_of_vials_used || 0)
      outOfSchoolMaterialMap.set(row.material_id, vialsUsed)
    }

    const outOfSchoolMrVials = outOfSchoolMaterialMap.get(mrId) ?? 0
    const outOfSchoolDtVials = outOfSchoolMaterialMap.get(dtId) ?? 0
    const outOfSchoolTdVials = outOfSchoolMaterialMap.get(tdId) ?? 0
    const outOfSchoolHpvVials = outOfSchoolMaterialMap.get(hpvId) ?? 0

    const schoolsData: Array<{
      id: number
      label: string
      data: Array<{ label: string; type: string; count: number }>
    }> = []
    const aggregatedCounts = {
      mr: 0,
      dt: 0,
      td: 0,
      hpv: 0,
    }

    for (const school of schools) {
      const materials = materialDataMap.get(school.school_id) ?? new Map()

      const mrVials = materials.get(mrId) ?? 0
      const dtVials = materials.get(dtId) ?? 0
      const tdVials = materials.get(tdId) ?? 0
      const hpvVials = materials.get(hpvId) ?? 0

      aggregatedCounts.mr += mrVials
      aggregatedCounts.dt += dtVials
      aggregatedCounts.td += tdVials
      aggregatedCounts.hpv += hpvVials

      schoolsData.push({
        id: school.school_id,
        label: school.school_name ?? "",
        data: [
          {
            label: "MR (Grade 1)",
            type: "number",
            count: mrVials,
          },
          {
            label: "DT (Grade 1)",
            type: "number",
            count: dtVials,
          },
          {
            label: "Td @10 ds (Grade 2 & 5)",
            type: "number",
            count: tdVials,
          },
          {
            label: "HPV @1 DS (Grade 5)",
            type: "number",
            count: hpvVials,
          },
        ],
      })
    }

    const outOfSchoolData = {
      id: 0,
      label: "Children Not in School",
      data: [
        {
          label: "MR (Grade 1)",
          type: "number",
          count: outOfSchoolMrVials,
        },
        {
          label: "DT (Grade 1)",
          type: "number",
          count: outOfSchoolDtVials,
        },
        {
          label: "Td @10 ds (Grade 2 & 5)",
          type: "number",
          count: outOfSchoolTdVials,
        },
        {
          label: "HPV @1 DS (Grade 5)",
          type: "number",
          count: outOfSchoolHpvVials,
        },
      ],
    }

    return {
      summary: [
        {
          label: "MR (Grade 1)",
          type: "number",
          count: aggregatedCounts.mr + outOfSchoolMrVials,
        },
        {
          label: "DT (Grade 1)",
          type: "number",
          count: aggregatedCounts.dt + outOfSchoolDtVials,
        },
        {
          label: "Td @10 ds (Grade 2 & 5)",
          type: "number",
          count: aggregatedCounts.td + outOfSchoolTdVials,
        },
        {
          label: "HPV @1 DS (Grade 5)",
          type: "number",
          count: aggregatedCounts.hpv + outOfSchoolHpvVials,
        },
      ],
      vaccine_vials_used_by_school: {
        data_out_of_school: [outOfSchoolData],
        data: schoolsData,
      },
    }
  }

  async getNumberVaccineVialsUsed(
    c: Context,
    subDistrictId: number,
    entityId: number
  ): Promise<NumberVaccineVialsUsed> {
    const currentYear = new Date().getFullYear()
    const nextYear = currentYear + 1
    const microplanningId = await this.targetsRepo.findOrCreateMicroplanning(
      c,
      entityId,
      nextYear
    )

    const villages = await this.nonBiasRepo.getVillagesBySubDistrict(
      c,
      subDistrictId,
      microplanningId
    )

    const dbData = await this.immunizationLogisticsRepo.getVillageMaterialData(
      c,
      subDistrictId,
      microplanningId
    )

    const materialTargets = await this.materialRepo.findMaterialsFromTargets(
      c,
      "primary",
      "non_bias"
    )

    const materialIds = materialTargets.map((m) => m.material_id)
    const rawMaterial = await this.materialRepo.findWsMaterialsByIds(
      c,
      materialIds
    )

    const materialNameMap = new Map<number, string>()
    materialTargets.forEach((m) => {
      materialNameMap.set(m.material_id, m.name)
    })

    const villageDataMap = new Map<number, Map<number, number>>()
    const materialSummary = new Map<number, number>()

    for (const row of dbData) {
      if (!villageDataMap.has(row.village_id)) {
        villageDataMap.set(row.village_id, new Map())
      }

      if (row.material_id && row.number_of_vials_used !== null) {
        villageDataMap
          .get(row.village_id)!
          .set(row.material_id, row.number_of_vials_used)

        const current = materialSummary.get(row.material_id) ?? 0
        materialSummary.set(row.material_id, current + row.number_of_vials_used)
      }
    }

    const summary = rawMaterial.map((m) => ({
      label: materialNameMap.get(m.id) ?? "",
      type: "number",
      count: materialSummary.get(m.id) ?? 0,
    }))

    const entities = villages.map((v) => {
      const materials = villageDataMap.get(v.village_id) ?? new Map()
      return {
        id: v.village_id,
        label: VILLAGE_LABEL + " " + v.village_name.toUpperCase(),
        data: rawMaterial.map((m) => ({
          label: materialNameMap.get(m.id) ?? "",
          type: "number",
          count: materials.get(m.id) ?? 0,
        })),
      }
    })
    return {
      summary,
      number_vaccine_vials_used_by_villages: {
        data: entities,
      },
    }
  }

  async getVaccineUtilizationRate(
    c: Context,
    subDistrictId: number,
    entityId: number,
    category?: "bias" | "non-bias"
  ): Promise<NumberOfVaccineUtilizationRate | VaccineUtilizationRateBias> {
    const currentYear = new Date().getFullYear()
    const nextYear = currentYear + 1
    const microplanningId = await this.targetsRepo.findOrCreateMicroplanning(
      c,
      entityId,
      nextYear
    )

    if (category === "bias") {
      const dbData =
        await this.immunizationLogisticsRepo.getSchoolVaccineUtilizationRate(
          c,
          subDistrictId,
          microplanningId,
          entityId
        )

      const materialTargets = await this.materialRepo.findMaterialsFromTargets(
        c,
        "primary",
        "bias"
      )

      const materialIds = materialTargets.map((m) => m.material_id)
      const rawMaterial = await this.materialRepo.findWsMaterialsByIds(
        c,
        materialIds
      )

      const materialNameMap = new Map<number, string>()
      materialTargets.forEach((m) => {
        materialNameMap.set(m.material_id, m.name)
      })

      const materialSummary = new Map<number, { sum: number; count: number }>()

      for (const row of dbData) {
        if (row.material_id && row.vaccine_utilization_rate !== null) {
          const current = materialSummary.get(row.material_id) ?? {
            sum: 0,
            count: 0,
          }
          materialSummary.set(row.material_id, {
            sum: current.sum + row.vaccine_utilization_rate,
            count: current.count + 1,
          })
        }
      }

      const summary = rawMaterial.map((m) => {
        const data = materialSummary.get(m.id)
        return {
          label: materialNameMap.get(m.id) ?? "",
          type: "number",
          count: data ? parseFloat((data.sum / data.count).toFixed(1)) : 0,
        }
      })

      return {
        summary,
      }
    }

    const dbData =
      await this.immunizationLogisticsRepo.getVillageVaccineUtilizationRate(
        c,
        subDistrictId,
        microplanningId
      )

    const materialTargets = await this.materialRepo.findMaterialsFromTargets(
      c,
      "primary",
      "non_bias"
    )

    const materialIds = materialTargets.map((m) => m.material_id)
    const rawMaterial = await this.materialRepo.findWsMaterialsByIds(
      c,
      materialIds
    )

    const materialNameMap = new Map<number, string>()
    materialTargets.forEach((m) => {
      materialNameMap.set(m.material_id, m.name)
    })

    const materialSummary = new Map<number, { sum: number; count: number }>()

    for (const row of dbData) {
      if (row.material_id && row.vaccine_utilization_rate !== null) {
        const current = materialSummary.get(row.material_id) ?? {
          sum: 0,
          count: 0,
        }
        materialSummary.set(row.material_id, {
          sum: current.sum + row.vaccine_utilization_rate,
          count: current.count + 1,
        })
      }
    }

    const summary = rawMaterial.map((m) => {
      const data = materialSummary.get(m.id)
      return {
        label: materialNameMap.get(m.id) ?? "",
        type: "number",
        count: data ? parseFloat((data.sum / data.count).toFixed(1)) : 0,
      }
    })

    return {
      summary,
    }
  }

  async getNumberOfProjectedOneYearVaccine(
    c: Context,
    subDistrictId: number,
    entityId: number
  ): Promise<ProjectedOneYearVaccine> {
    const currentYear = new Date().getFullYear()
    const nextYear = currentYear + 1
    const microplanningId = await this.targetsRepo.findOrCreateMicroplanning(
      c,
      entityId,
      nextYear
    )

    const villages = await this.nonBiasRepo.getVillagesBySubDistrict(
      c,
      subDistrictId,
      microplanningId
    )

    const dbData = await this.immunizationLogisticsRepo.getVillageMaterialData(
      c,
      subDistrictId,
      microplanningId
    )

    const materialTargets = await this.materialRepo.findMaterialsFromTargets(
      c,
      "primary",
      "non_bias"
    )

    const materialIds = materialTargets.map((m) => m.material_id)
    const rawMaterial = await this.materialRepo.findWsMaterialsByIds(
      c,
      materialIds
    )

    const materialNameMap = new Map<number, string>()
    materialTargets.forEach((m) => {
      materialNameMap.set(m.material_id, m.name)
    })

    const villageDataMap = new Map<number, Map<number, number>>()
    const materialSummary = new Map<number, number>()

    for (const row of dbData) {
      if (!villageDataMap.has(row.village_id)) {
        villageDataMap.set(row.village_id, new Map())
      }

      if (row.material_id && row.total_needs !== null) {
        villageDataMap
          .get(row.village_id)!
          .set(row.material_id, row.total_needs)

        const current = materialSummary.get(row.material_id) ?? 0
        materialSummary.set(row.material_id, current + row.total_needs)
      }
    }

    const summary = rawMaterial.map((m) => ({
      label: materialNameMap.get(m.id) ?? "",
      type: "number",
      count: materialSummary.get(m.id) ?? 0,
    }))

    const entities = villages.map((v) => {
      const materials = villageDataMap.get(v.village_id) ?? new Map()
      return {
        id: v.village_id,
        label: VILLAGE_LABEL + " " + v.village_name.toUpperCase(),
        data: rawMaterial.map((m) => ({
          label: materialNameMap.get(m.id) ?? "",
          type: "number",
          count: materials.get(m.id) ?? 0,
        })),
      }
    })

    return {
      summary,
      projected_one_year_vaccine: {
        data: entities,
      },
    }
  }

  async getNumberOfProjectedMonthlyVaccine(
    c: Context,
    subDistrictId: number,
    entityId: number
  ): Promise<ProjectedMonthlyVaccine> {
    const currentYear = new Date().getFullYear()
    const nextYear = currentYear + 1
    const microplanningId = await this.targetsRepo.findOrCreateMicroplanning(
      c,
      entityId,
      nextYear
    )

    const villages = await this.nonBiasRepo.getVillagesBySubDistrict(
      c,
      subDistrictId,
      microplanningId
    )

    const dbData =
      await this.immunizationLogisticsRepo.getVillageMonthlyVaccineData(
        c,
        subDistrictId,
        microplanningId
      )

    const materialTargets = await this.materialRepo.findMaterialsFromTargets(
      c,
      "primary",
      "non_bias"
    )

    const materialIds = materialTargets.map((m) => m.material_id)
    const rawMaterial = await this.materialRepo.findWsMaterialsByIds(
      c,
      materialIds
    )

    const materialNameMap = new Map<number, string>()
    materialTargets.forEach((m) => {
      materialNameMap.set(m.material_id, m.name)
    })

    const villageDataMap = new Map<
      number,
      Map<number, { request_qty: number }>
    >()
    const materialSummary = new Map<number, number>()

    for (const row of dbData) {
      if (!villageDataMap.has(row.village_id)) {
        villageDataMap.set(row.village_id, new Map())
      }

      if (row.material_id && row.request_qty !== null) {
        villageDataMap.get(row.village_id)!.set(row.material_id, {
          request_qty: row.request_qty,
        })

        const current = materialSummary.get(row.material_id) ?? 0
        materialSummary.set(row.material_id, current + row.request_qty)
      }
    }

    const summary = rawMaterial.map((m) => ({
      label: materialNameMap.get(m.id) ?? "",
      type: "number",
      count: materialSummary.get(m.id) ?? 0,
    }))

    const entities = villages.map((v) => {
      const materials = villageDataMap.get(v.village_id) ?? new Map()
      return {
        id: v.village_id,
        label: VILLAGE_LABEL + " " + v.village_name.toUpperCase(),
        data: rawMaterial.map((m) => ({
          label: materialNameMap.get(m.id) ?? "",
          type: "number",
          count: materials.get(m.id)?.request_qty ?? 0,
        })),
      }
    })

    return {
      summary,
      projected_monthly_vaccine: {
        data: entities,
      },
    }
  }

  async getDetailMonthlyVaccine(
    c: Context,
    villageId: number,
    entityId: number
  ): Promise<DetailMonthlyProjectedVaccine> {
    const currentYear = new Date().getFullYear()
    const nextYear = currentYear + 1
    const microplanningId = await this.targetsRepo.findOrCreateMicroplanning(
      c,
      entityId,
      nextYear
    )

    const village = await this.nonBiasRepo.getLocationName(c, villageId)

    const dbData =
      await this.immunizationLogisticsRepo.getVillageVaccineDetailData(
        c,
        villageId,
        microplanningId
      )

    const materialTargets = await this.materialRepo.findMaterialsFromTargets(
      c,
      "primary",
      "non_bias"
    )

    const materialIds = materialTargets.map((m) => m.material_id)
    const rawMaterial = await this.materialRepo.findWsMaterialsByIds(
      c,
      materialIds
    )

    const materialNameMap = new Map<number, string>()
    materialTargets.forEach((m) => {
      materialNameMap.set(m.material_id, m.name)
    })

    const materialDataMap = new Map<
      number,
      {
        min_stock: number
        max_stock: number
        remaining_stock: number
        request_qty: number
      }
    >()

    for (const row of dbData) {
      if (row.material_id) {
        materialDataMap.set(row.material_id, {
          min_stock: row.min_stock ?? 0,
          max_stock: row.max_stock ?? 0,
          remaining_stock: row.remaining_stock ?? 0,
          request_qty: row.request_qty ?? 0,
        })
      }
    }

    const vaccines = rawMaterial.map((v) => {
      const data = materialDataMap.get(v.id)
      return {
        label: materialNameMap.get(v.id) ?? "",
        id: v.id,
        data: [
          {
            label: "Min Stock",
            type: "number",
            count: data?.min_stock ?? 0,
          },
          {
            label: "Max Stock",
            type: "number",
            count: data?.max_stock ?? 0,
          },
          {
            label: "Available Stock",
            type: "number",
            count: data?.remaining_stock ?? 0,
          },
          {
            label: "Request Qty",
            type: "number",
            count: data?.request_qty ?? 0,
          },
        ],
      }
    })

    return {
      id: villageId,
      label: village?.name
        ? VILLAGE_LABEL + " " + village.name.toUpperCase()
        : "UNKNOWN",
      data: vaccines,
    }
  }

  async getMonthlyImmunizationLogisticsNeed(
    c: Context,
    subDistrictId: number,
    entityId: number
  ): Promise<ImmunizationLogisticsNeed> {
    const currentYear = new Date().getFullYear()
    const nextYear = currentYear + 1
    const microplanningId = await this.targetsRepo.findOrCreateMicroplanning(
      c,
      entityId,
      nextYear
    )

    const villages = await this.nonBiasRepo.getVillagesBySubDistrict(
      c,
      subDistrictId,
      microplanningId
    )

    const dbData =
      await this.immunizationLogisticsRepo.getVillageAdditionalNeedsData(
        c,
        subDistrictId,
        microplanningId
      )

    const materialTargets = await this.materialRepo.findMaterialsFromTargets(
      c,
      "additional",
      "non_bias"
    )

    const materialIds = materialTargets.map((m) => m.material_id)
    const rawMaterial = await this.materialRepo.findWsMaterialsByIds(
      c,
      materialIds
    )

    const materialNameMap = new Map<number, string>()
    materialTargets.forEach((m) => {
      materialNameMap.set(m.material_id, m.name)
    })

    const villageDataMap = new Map<
      number,
      Map<number, { total: number; remaining_stock: number }>
    >()
    const materialSummary = new Map<number, number>()

    for (const row of dbData) {
      if (!villageDataMap.has(row.village_id)) {
        villageDataMap.set(row.village_id, new Map())
      }

      if (
        row.material_id &&
        row.total !== null &&
        row.remaining_stock !== null
      ) {
        const requestQty = row.total - row.remaining_stock
        villageDataMap.get(row.village_id)!.set(row.material_id, {
          total: row.total,
          remaining_stock: row.remaining_stock,
        })

        const current = materialSummary.get(row.material_id) ?? 0
        materialSummary.set(row.material_id, current + requestQty)
      }
    }

    const summary = rawMaterial.map((m) => ({
      label: materialNameMap.get(m.id) ?? "",
      type: "number",
      count: materialSummary.get(m.id) ?? 0,
    }))

    const entities = villages.map((v) => {
      const materials = villageDataMap.get(v.village_id) ?? new Map()
      return {
        id: v.village_id,
        label: VILLAGE_LABEL + " " + v.village_name.toUpperCase(),
        data: rawMaterial.map((m) => {
          const data = materials.get(m.id)
          const requestQty = data ? data.total - data.remaining_stock : 0
          return {
            label: materialNameMap.get(m.id) ?? "",
            type: "number",
            count: requestQty,
          }
        }),
      }
    })

    return {
      summary,
      immunization_logistics_need: {
        data: entities,
      },
    }
  }

  async getDetailMonthlyImmunization(
    c: Context,
    villageId: number,
    entityId: number
  ): Promise<DetailMonthlyVaccineLogistic> {
    const currentYear = new Date().getFullYear()
    const nextYear = currentYear + 1
    const microplanningId = await this.targetsRepo.findOrCreateMicroplanning(
      c,
      entityId,
      nextYear
    )

    const village = await this.nonBiasRepo.getLocationName(c, villageId)

    const dbData =
      await this.immunizationLogisticsRepo.getVillageLogisticsDetailData(
        c,
        villageId,
        microplanningId
      )

    const materialTargets = await this.materialRepo.findMaterialsFromTargets(
      c,
      "additional",
      "non_bias"
    )

    const materialIds = materialTargets.map((m) => m.material_id)
    const rawMaterial = await this.materialRepo.findWsMaterialsByIds(
      c,
      materialIds
    )

    const materialNameMap = new Map<number, string>()
    materialTargets.forEach((m) => {
      materialNameMap.set(m.material_id, m.name)
    })

    const materialDataMap = new Map<
      number,
      {
        total: number
        remaining_stock: number
      }
    >()

    for (const row of dbData) {
      if (row.material_id) {
        materialDataMap.set(row.material_id, {
          total: row.total ?? 0,
          remaining_stock: row.remaining_stock ?? 0,
        })
      }
    }

    const logistics = rawMaterial.map((v) => {
      const data = materialDataMap.get(v.id)
      const requestQty = data ? data.total - data.remaining_stock : 0
      return {
        label: materialNameMap.get(v.id) ?? "",
        id: v.id,
        data: [
          {
            label: "Calculation Based on Vaccine Needs",
            type: "number",
            count: data?.total ?? 0,
          },
          {
            label: "Available Stock",
            type: "number",
            count: data?.remaining_stock ?? 0,
          },
          {
            label: "Request Qty",
            type: "number",
            count: requestQty,
          },
        ],
      }
    })

    return {
      id: villageId,
      label: village?.name
        ? VILLAGE_LABEL + " " + village.name.toUpperCase()
        : "UNKNOWN",
      data: logistics,
    }
  }

  async getImmunizationAchievements(
    c: Context,
    subDistrictId: number,
    entityId: number
  ): Promise<ImmunizationAchievementsSummary> {
    const currentYear = new Date().getFullYear()
    const nextYear = currentYear + 1
    const microplanningId = await this.targetsRepo.findOrCreateMicroplanning(
      c,
      entityId,
      nextYear
    )

    const materialTargets = await this.materialRepo.findMaterialsFromTargets(
      c,
      "primary",
      "bias"
    )

    const materialIds = materialTargets.map((m) => m.material_id)
    const rawMaterials = await this.materialRepo.findWsMaterialsByIds(
      c,
      materialIds
    )

    const materialCodeToIdMap = new Map<string, number>()
    rawMaterials.forEach((m) => {
      materialCodeToIdMap.set(m.code, m.id)
    })

    const mrId = this.#findMaterialIdByCodeVariations(materialCodeToIdMap, [
      "MR",
      "MR @10 ds",
      "MR 1 @10 ds and MR 2 @10 ds",
      "VAKSIN MEASLES RUBELLA (MR) 10 DS/ PARTNERSHIP",
    ])
    const dtId = this.#findMaterialIdByCodeVariations(materialCodeToIdMap, [
      "DT",
      "DT @10 ds",
      "VAKSIN DT 10 DS",
    ])
    const tdId = this.#findMaterialIdByCodeVariations(materialCodeToIdMap, [
      "Td",
      "Td @10 ds",
      "VAKSIN TD 10 DS",
    ])
    const hpvId = this.#findMaterialIdByCodeVariations(materialCodeToIdMap, [
      "HPV",
      "HPV @1 DS",
      "HPV NusaGard",
    ])

    const [schools, materialNeedsData, outOfSchoolMaterialData] =
      await Promise.all([
        this.immunizationLogisticsRepo.getSchoolsBySubDistrict(
          c,
          subDistrictId,
          microplanningId
        ),
        this.immunizationLogisticsRepo.getSchoolMaterialNeedsDetails(
          c,
          subDistrictId,
          microplanningId,
          entityId
        ),
        this.immunizationLogisticsRepo.getOutOfSchoolMaterialNeedsDetails(
          c,
          subDistrictId,
          microplanningId
        ),
      ])

    const materialDataMap = new Map<number, Map<number, number>>()

    for (const row of materialNeedsData) {
      if (!row.school_id || !row.material_id) continue

      if (!materialDataMap.has(row.school_id)) {
        materialDataMap.set(row.school_id, new Map())
      }

      const absoluteImmunization = Number(
        row.absolute_number_of_routine_immunization || 0
      )
      materialDataMap
        .get(row.school_id)!
        .set(row.material_id, absoluteImmunization)
    }

    const outOfSchoolMaterialMap = new Map<number, number>()
    for (const row of outOfSchoolMaterialData) {
      if (!row.material_id) continue
      const absoluteImmunization = Number(
        row.absolute_number_of_routine_immunization || 0
      )
      outOfSchoolMaterialMap.set(row.material_id, absoluteImmunization)
    }

    const outOfSchoolMrCount = outOfSchoolMaterialMap.get(mrId) ?? 0
    const outOfSchoolDtCount = outOfSchoolMaterialMap.get(dtId) ?? 0
    const outOfSchoolTdCount = outOfSchoolMaterialMap.get(tdId) ?? 0
    const outOfSchoolHpvCount = outOfSchoolMaterialMap.get(hpvId) ?? 0

    const schoolsData: Array<{
      id: number
      label: string
      data: Array<{ label: string; type: string; count: number }>
    }> = []
    const aggregatedCounts = {
      mr: 0,
      dt: 0,
      td: 0,
      hpv: 0,
    }

    for (const school of schools) {
      const materials = materialDataMap.get(school.school_id) ?? new Map()

      const mrCount = materials.get(mrId) ?? 0
      const dtCount = materials.get(dtId) ?? 0
      const tdCount = materials.get(tdId) ?? 0
      const hpvCount = materials.get(hpvId) ?? 0

      aggregatedCounts.mr += mrCount
      aggregatedCounts.dt += dtCount
      aggregatedCounts.td += tdCount
      aggregatedCounts.hpv += hpvCount

      schoolsData.push({
        id: school.school_id,
        label: school.school_name ?? "",
        data: [
          {
            label: "MR (Grade 1)",
            type: "number",
            count: mrCount,
          },
          {
            label: "DT (Grade 1)",
            type: "number",
            count: dtCount,
          },
          {
            label: "Td @10 ds (Grade 2 & 5)",
            type: "number",
            count: tdCount,
          },
          {
            label: "HPV @1 DS (Grade 5)",
            type: "number",
            count: hpvCount,
          },
        ],
      })
    }

    const outOfSchoolData = {
      id: 0,
      label: "Children Not in School",
      data: [
        {
          label: "MR (Grade 1)",
          type: "number",
          count: outOfSchoolMrCount,
        },
        {
          label: "DT (Grade 1)",
          type: "number",
          count: outOfSchoolDtCount,
        },
        {
          label: "Td @10 ds (Grade 2 & 5)",
          type: "number",
          count: outOfSchoolTdCount,
        },
        {
          label: "HPV @1 DS (Grade 5)",
          type: "number",
          count: outOfSchoolHpvCount,
        },
      ],
    }

    return {
      summary: [
        {
          label: "MR (Grade 1)",
          type: "number",
          count: aggregatedCounts.mr + outOfSchoolMrCount,
        },
        {
          label: "DT (Grade 1)",
          type: "number",
          count: aggregatedCounts.dt + outOfSchoolDtCount,
        },
        {
          label: "Td @10 ds (Grade 2 & 5)",
          type: "number",
          count: aggregatedCounts.td + outOfSchoolTdCount,
        },
        {
          label: "HPV @1 DS (Grade 5)",
          type: "number",
          count: aggregatedCounts.hpv + outOfSchoolHpvCount,
        },
      ],
      achievements_by_school: {
        data_out_of_school: [outOfSchoolData],
        data: schoolsData,
      },
    }
  }

  async getVialNeedsBySchool(
    c: Context,
    subDistrictId: number,
    entityId: number
  ): Promise<VialNeedsBySchool> {
    const currentYear = new Date().getFullYear()
    const nextYear = currentYear + 1
    const microplanningId = await this.targetsRepo.findOrCreateMicroplanning(
      c,
      entityId,
      nextYear
    )

    const materialTargets = await this.materialRepo.findMaterialsFromTargets(
      c,
      "primary",
      "bias"
    )

    const materialIds = materialTargets.map((m) => m.material_id)
    const rawMaterials = await this.materialRepo.findWsMaterialsByIds(
      c,
      materialIds
    )

    const materialCodeToIdMap = new Map<string, number>()
    rawMaterials.forEach((m) => {
      materialCodeToIdMap.set(m.code, m.id)
    })

    const mrId = this.#findMaterialIdByCodeVariations(materialCodeToIdMap, [
      "MR",
      "MR @10 ds",
      "MR 1 @10 ds and MR 2 @10 ds",
      "VAKSIN MEASLES RUBELLA (MR) 10 DS/ PARTNERSHIP",
    ])
    const dtId = this.#findMaterialIdByCodeVariations(materialCodeToIdMap, [
      "DT",
      "DT @10 ds",
      "VAKSIN DT 10 DS",
    ])
    const tdId = this.#findMaterialIdByCodeVariations(materialCodeToIdMap, [
      "Td",
      "Td @10 ds",
      "VAKSIN TD 10 DS",
    ])
    const hpvId = this.#findMaterialIdByCodeVariations(materialCodeToIdMap, [
      "HPV",
      "HPV @1 DS",
      "HPV NusaGard",
    ])

    const [schools, vialNeedsData, outOfSchoolVialNeedsData] =
      await Promise.all([
        this.immunizationLogisticsRepo.getSchoolsBySubDistrict(
          c,
          subDistrictId,
          microplanningId
        ),
        this.immunizationLogisticsRepo.getSchoolVialNeedsData(
          c,
          subDistrictId,
          microplanningId,
          entityId
        ),
        this.immunizationLogisticsRepo.getOutOfSchoolVialNeedsData(
          c,
          subDistrictId,
          microplanningId
        ),
      ])

    const vialDataMap = new Map<
      number,
      Map<
        number,
        { planning: number; available_stock: number; request_qty: number }
      >
    >()

    for (const row of vialNeedsData) {
      if (!row.school_id || !row.material_id) continue

      if (!vialDataMap.has(row.school_id)) {
        vialDataMap.set(row.school_id, new Map())
      }

      vialDataMap.get(row.school_id)!.set(row.material_id, {
        planning: Number(row.planning || 0),
        available_stock: Number(row.available_stock || 0),
        request_qty: Number(row.request_qty || 0),
      })
    }

    const outOfSchoolVialMap = new Map<
      number,
      { planning: number; available_stock: number; request_qty: number }
    >()
    for (const row of outOfSchoolVialNeedsData) {
      if (!row.material_id) continue
      outOfSchoolVialMap.set(row.material_id, {
        planning: Number(row.planning || 0),
        available_stock: Number(row.available_stock || 0),
        request_qty: Number(row.request_qty || 0),
      })
    }

    const outOfSchoolMrData = outOfSchoolVialMap.get(mrId)
    const outOfSchoolDtData = outOfSchoolVialMap.get(dtId)
    const outOfSchoolTdData = outOfSchoolVialMap.get(tdId)
    const outOfSchoolHpvData = outOfSchoolVialMap.get(hpvId)

    const outOfSchoolMrNeeds = outOfSchoolMrData?.request_qty ?? 0
    const outOfSchoolDtNeeds = outOfSchoolDtData?.request_qty ?? 0
    const outOfSchoolTdNeeds = outOfSchoolTdData?.request_qty ?? 0
    const outOfSchoolHpvNeeds = outOfSchoolHpvData?.request_qty ?? 0

    const schoolsData: Array<{
      id: number
      label: string
      data: Array<{ label: string; type: string; count: number }>
    }> = []
    const aggregatedCounts = {
      mr: 0,
      dt: 0,
      td: 0,
      hpv: 0,
    }

    for (const school of schools) {
      const materials = vialDataMap.get(school.school_id) ?? new Map()

      const mrData = materials.get(mrId)
      const dtData = materials.get(dtId)
      const tdData = materials.get(tdId)
      const hpvData = materials.get(hpvId)

      const mrNeeds = mrData?.request_qty ?? 0
      const dtNeeds = dtData?.request_qty ?? 0
      const tdNeeds = tdData?.request_qty ?? 0
      const hpvNeeds = hpvData?.request_qty ?? 0

      aggregatedCounts.mr += mrNeeds
      aggregatedCounts.dt += dtNeeds
      aggregatedCounts.td += tdNeeds
      aggregatedCounts.hpv += hpvNeeds

      schoolsData.push({
        id: school.school_id,
        label: school.school_name ?? "",
        data: [
          {
            label: "MR (Grade 1)",
            type: "number",
            count: mrNeeds,
          },
          {
            label: "DT (Grade 1)",
            type: "number",
            count: dtNeeds,
          },
          {
            label: "Td @10 ds (Grade 2 & 5)",
            type: "number",
            count: tdNeeds,
          },
          {
            label: "HPV @1 DS (Grade 5)",
            type: "number",
            count: hpvNeeds,
          },
        ],
      })
    }

    const outOfSchoolData = {
      id: c.var.userEntity.global_id,
      label: "Children Not in School",
      data: [
        {
          label: "MR (Grade 1)",
          type: "number",
          count: outOfSchoolMrNeeds,
        },
        {
          label: "DT (Grade 1)",
          type: "number",
          count: outOfSchoolDtNeeds,
        },
        {
          label: "Td @10 ds (Grade 2 & 5)",
          type: "number",
          count: outOfSchoolTdNeeds,
        },
        {
          label: "HPV @1 DS (Grade 5)",
          type: "number",
          count: outOfSchoolHpvNeeds,
        },
      ],
    }

    return {
      summary: [
        {
          label: "MR (Grade 1)",
          type: "number",
          count: aggregatedCounts.mr + outOfSchoolMrNeeds,
        },
        {
          label: "DT (Grade 1)",
          type: "number",
          count: aggregatedCounts.dt + outOfSchoolDtNeeds,
        },
        {
          label: "Td @10 ds (Grade 2 & 5)",
          type: "number",
          count: aggregatedCounts.td + outOfSchoolTdNeeds,
        },
        {
          label: "HPV @1 DS (Grade 5)",
          type: "number",
          count: aggregatedCounts.hpv + outOfSchoolHpvNeeds,
        },
      ],
      vial_needs_by_school: {
        data_out_of_school: [outOfSchoolData],
        data: schoolsData,
      },
    }
  }

  async getDetailVialNeedsBySchool(
    c: Context,
    schoolId: number,
    entityId: number
  ): Promise<DetailVialNeedsBySchool> {
    const currentYear = new Date().getFullYear()
    const nextYear = currentYear + 1
    const microplanningId = await this.targetsRepo.findOrCreateMicroplanning(
      c,
      entityId,
      nextYear
    )

    const materialTargets = await this.materialRepo.findMaterialsFromTargets(
      c,
      "primary",
      "bias"
    )

    const materialIds = materialTargets.map((m) => m.material_id)
    const rawMaterials = await this.materialRepo.findWsMaterialsByIds(
      c,
      materialIds
    )

    const materialCodeToIdMap = new Map<string, number>()
    rawMaterials.forEach((m) => {
      materialCodeToIdMap.set(m.code, m.id)
    })

    const mrId = this.#findMaterialIdByCodeVariations(materialCodeToIdMap, [
      "MR",
      "MR @10 ds",
      "MR 1 @10 ds and MR 2 @10 ds",
      "VAKSIN MEASLES RUBELLA (MR) 10 DS/ PARTNERSHIP",
    ])
    const dtId = this.#findMaterialIdByCodeVariations(materialCodeToIdMap, [
      "DT",
      "DT @10 ds",
      "VAKSIN DT 10 DS",
    ])
    const tdId = this.#findMaterialIdByCodeVariations(materialCodeToIdMap, [
      "Td",
      "Td @10 ds",
      "VAKSIN TD 10 DS",
    ])
    const hpvId = this.#findMaterialIdByCodeVariations(materialCodeToIdMap, [
      "HPV",
      "HPV @1 DS",
      "HPV NusaGard",
    ])

    const [vialNeedsData, school] = await Promise.all([
      this.immunizationLogisticsRepo.getSchoolDetailVialNeedsData(
        c,
        schoolId,
        microplanningId
      ),
      this.immunizationLogisticsRepo.getSchoolsBySubDistrict(
        c,
        Number(c.var?.userEntity?.sub_district_id || 0),
        microplanningId
      ),
    ])

    const schoolData = school.find((s) => s.school_id === schoolId)

    const materialMap = new Map<
      number,
      { planning: number; available_stock: number; request_qty: number }
    >()

    for (const row of vialNeedsData) {
      if (!row.material_id) continue
      materialMap.set(row.material_id, {
        planning: Number(row.planning || 0),
        available_stock: Number(row.available_stock || 0),
        request_qty: Number(row.request_qty || 0),
      })
    }

    const mrData = materialMap.get(mrId)
    const dtData = materialMap.get(dtId)
    const tdData = materialMap.get(tdId)
    const hpvData = materialMap.get(hpvId)

    return {
      id: schoolId,
      label: schoolData?.school_name ?? c.var?.userEntity?.name ?? "School",
      data: [
        {
          label: "Grade 1",
          data: [
            {
              label: "MR",
              data: [
                {
                  label: "Planning",
                  type: "number",
                  count: mrData?.planning ?? 0,
                },
                {
                  label: "Available Stock",
                  type: "number",
                  count: mrData?.available_stock ?? 0,
                },
                {
                  label: "Needs Qty",
                  type: "number",
                  count: mrData?.request_qty ?? 0,
                },
              ],
            },
            {
              label: "DT",
              data: [
                {
                  label: "Planning",
                  type: "number",
                  count: dtData?.planning ?? 0,
                },
                {
                  label: "Available Stock",
                  type: "number",
                  count: dtData?.available_stock ?? 0,
                },
                {
                  label: "Needs Qty",
                  type: "number",
                  count: dtData?.request_qty ?? 0,
                },
              ],
            },
          ],
        },
        {
          label: "Grade 2 & 5",
          data: [
            {
              label: "Td @10 ds",
              data: [
                {
                  label: "Planning",
                  type: "number",
                  count: tdData?.planning ?? 0,
                },
                {
                  label: "Available Stock",
                  type: "number",
                  count: tdData?.available_stock ?? 0,
                },
                {
                  label: "Needs Qty",
                  type: "number",
                  count: tdData?.request_qty ?? 0,
                },
              ],
            },
          ],
        },
        {
          label: "Grade 5",
          data: [
            {
              label: "HPV @1 DS",
              data: [
                {
                  label: "Planning",
                  type: "number",
                  count: hpvData?.planning ?? 0,
                },
                {
                  label: "Available Stock",
                  type: "number",
                  count: hpvData?.available_stock ?? 0,
                },
                {
                  label: "Needs Qty",
                  type: "number",
                  count: hpvData?.request_qty ?? 0,
                },
              ],
            },
          ],
        },
      ],
    }
  }

  async getVaccineLogisticsSummary(
    c: Context,
    subDistrictId: number,
    entityId: number
  ): Promise<AdsSbNeeds> {
    const currentYear = new Date().getFullYear()
    const nextYear = currentYear + 1
    const microplanningId = await this.targetsRepo.findOrCreateMicroplanning(
      c,
      entityId,
      nextYear
    )

    const materialTargets = await this.materialRepo.findMaterialsFromTargets(
      c,
      "additional",
      "bias"
    )

    const materialIds = materialTargets.map((m) => m.material_id)
    const rawMaterials = await this.materialRepo.findWsMaterialsByIds(
      c,
      materialIds
    )

    const materialCodeToIdMap = new Map<string, number>()
    rawMaterials.forEach((m) => {
      materialCodeToIdMap.set(m.code, m.id)
    })

    const ads5mlId = this.#findMaterialIdByCodeVariations(materialCodeToIdMap, [
      "ADS 5 ml",
      "ADS 5 ML",
      "ADS 5ml",
    ])
    const ads05mlId = this.#findMaterialIdByCodeVariations(
      materialCodeToIdMap,
      ["ADS 0.5 ml", "ADS 0,5 ml", "ADS 0.5 ML", "ADS 0,5 ML"]
    )
    const sb25lId = this.#findMaterialIdByCodeVariations(materialCodeToIdMap, [
      "SB 2.5 ltr",
      "SB 2.5 Ltr",
      "SB 2,5 ltr",
      "SB 2,5 Ltr",
      "SB 2.5 liter",
    ])
    const sb5lId = this.#findMaterialIdByCodeVariations(materialCodeToIdMap, [
      "SB 5 ltr",
      "SB 5 Ltr",
      "SB 5 liter",
    ])

    const [schools, logisticsData, outOfSchoolLogisticsData] =
      await Promise.all([
        this.immunizationLogisticsRepo.getSchoolsBySubDistrict(
          c,
          subDistrictId,
          microplanningId
        ),
        this.immunizationLogisticsRepo.getSchoolLogisticsData(
          c,
          subDistrictId,
          microplanningId,
          entityId
        ),
        this.immunizationLogisticsRepo.getOutOfSchoolLogisticsData(
          c,
          subDistrictId,
          microplanningId
        ),
      ])

    const logisticsDataMap = new Map<
      number,
      {
        august: Map<number, number>
        november: Map<number, number>
      }
    >()

    for (const row of logisticsData) {
      if (!row.school_id || !row.material_id) continue

      if (!logisticsDataMap.has(row.school_id)) {
        logisticsDataMap.set(row.school_id, {
          august: new Map(),
          november: new Map(),
        })
      }

      const schoolLogistics = logisticsDataMap.get(row.school_id)!
      const total = Number(row.total || 0)
      const month = (row.injection_month ?? "").toLowerCase()

      if (month === "august") {
        schoolLogistics.august.set(row.material_id, total)
      } else if (month === "november") {
        schoolLogistics.november.set(row.material_id, total)
      }
    }

    const outOfSchoolLogisticsMap = {
      august: new Map<number, number>(),
      november: new Map<number, number>(),
    }

    for (const row of outOfSchoolLogisticsData) {
      if (!row.material_id) continue
      const total = Number(row.total || 0)
      const month = (row.injection_month ?? "").toLowerCase()

      if (month === "august") {
        outOfSchoolLogisticsMap.august.set(row.material_id, total)
      } else if (month === "november") {
        outOfSchoolLogisticsMap.november.set(row.material_id, total)
      }
    }

    const outOfSchoolAugustAds5ml =
      outOfSchoolLogisticsMap.august.get(ads5mlId) ?? 0
    const outOfSchoolAugustAds05ml =
      outOfSchoolLogisticsMap.august.get(ads05mlId) ?? 0
    const outOfSchoolAugustSb25l =
      outOfSchoolLogisticsMap.august.get(sb25lId) ?? 0
    const outOfSchoolAugustSb5l =
      outOfSchoolLogisticsMap.august.get(sb5lId) ?? 0
    const outOfSchoolNovemberAds05ml =
      outOfSchoolLogisticsMap.november.get(ads05mlId) ?? 0
    const outOfSchoolNovemberSb25l =
      outOfSchoolLogisticsMap.november.get(sb25lId) ?? 0
    const outOfSchoolNovemberSb5l =
      outOfSchoolLogisticsMap.november.get(sb5lId) ?? 0

    const schoolsData: Array<{
      id: number
      label: string
      data: Array<{
        label: string
        data: Array<{ label: string; type: string; count: number }>
      }>
    }> = []

    const aggregatedCounts = {
      august_ads_5ml: 0,
      august_ads_05ml: 0,
      august_sb_25l: 0,
      august_sb_5l: 0,
      november_ads_5ml: 0,
      november_ads_05ml: 0,
      november_sb_25l: 0,
      november_sb_5l: 0,
    }

    for (const school of schools) {
      const logistics = logisticsDataMap.get(school.school_id)

      const augustAds5ml = logistics?.august.get(ads5mlId) ?? 0
      const augustAds05ml = logistics?.august.get(ads05mlId) ?? 0
      const augustSb25l = logistics?.august.get(sb25lId) ?? 0
      const augustSb5l = logistics?.august.get(sb5lId) ?? 0
      const novemberAds05ml = logistics?.november.get(ads05mlId) ?? 0
      const novemberSb25l = logistics?.november.get(sb25lId) ?? 0
      const novemberSb5l = logistics?.november.get(sb5lId) ?? 0

      aggregatedCounts.august_ads_5ml += augustAds5ml
      aggregatedCounts.august_ads_05ml += augustAds05ml
      aggregatedCounts.august_sb_25l += augustSb25l
      aggregatedCounts.august_sb_5l += augustSb5l
      aggregatedCounts.november_ads_05ml += novemberAds05ml
      aggregatedCounts.november_sb_25l += novemberSb25l
      aggregatedCounts.november_sb_5l += novemberSb5l

      schoolsData.push({
        id: school.school_id,
        label: school.school_name ?? "",
        data: [
          {
            label: "August",
            data: [
              {
                label: "ADS 5 ml",
                type: "number",
                count: augustAds5ml,
              },
              {
                label: "ADS 0.5 ml",
                type: "number",
                count: augustAds05ml,
              },
              {
                label: "SB 2.5 ltr",
                type: "number",
                count: augustSb25l,
              },
              {
                label: "SB 5 ltr",
                type: "number",
                count: augustSb5l,
              },
            ],
          },
          {
            label: "November",
            data: [
              {
                label: "ADS 0.5 ml",
                type: "number",
                count: novemberAds05ml,
              },
              {
                label: "SB 2.5 ltr",
                type: "number",
                count: novemberSb25l,
              },
              {
                label: "SB 5 ltr",
                type: "number",
                count: novemberSb5l,
              },
            ],
          },
        ],
      })
    }

    const outOfSchoolData = {
      id: c.var.userEntity.global_id,
      label: "Children Not in School",
      data: [
        {
          label: "August",
          data: [
            {
              label: "ADS 5 ml",
              type: "number",
              count: outOfSchoolAugustAds5ml,
            },
            {
              label: "ADS 0.5 ml",
              type: "number",
              count: outOfSchoolAugustAds05ml,
            },
            {
              label: "SB 2.5 ltr",
              type: "number",
              count: outOfSchoolAugustSb25l,
            },
            {
              label: "SB 5 ltr",
              type: "number",
              count: outOfSchoolAugustSb5l,
            },
          ],
        },
        {
          label: "November",
          data: [
            {
              label: "ADS 0.5 ml",
              type: "number",
              count: outOfSchoolNovemberAds05ml,
            },
            {
              label: "SB 2.5 ltr",
              type: "number",
              count: outOfSchoolNovemberSb25l,
            },
            {
              label: "SB 5 ltr",
              type: "number",
              count: outOfSchoolNovemberSb5l,
            },
          ],
        },
      ],
    }

    return {
      summary: [
        {
          label: "August",
          data: [
            {
              label: "ADS 5 ml",
              type: "number",
              count: aggregatedCounts.august_ads_5ml + outOfSchoolAugustAds5ml,
            },
            {
              label: "ADS 0.5 ml",
              type: "number",
              count:
                aggregatedCounts.august_ads_05ml + outOfSchoolAugustAds05ml,
            },
            {
              label: "SB 2.5 ltr",
              type: "number",
              count: aggregatedCounts.august_sb_25l + outOfSchoolAugustSb25l,
            },
            {
              label: "SB 5 ltr",
              type: "number",
              count: aggregatedCounts.august_sb_5l + outOfSchoolAugustSb5l,
            },
          ],
        },
        {
          label: "November",
          data: [
            {
              label: "ADS 0.5 ml",
              type: "number",
              count:
                aggregatedCounts.november_ads_05ml + outOfSchoolNovemberAds05ml,
            },
            {
              label: "SB 2.5 ltr",
              type: "number",
              count:
                aggregatedCounts.november_sb_25l + outOfSchoolNovemberSb25l,
            },
            {
              label: "SB 5 ltr",
              type: "number",
              count: aggregatedCounts.november_sb_5l + outOfSchoolNovemberSb5l,
            },
          ],
        },
      ],
      ads_sb_needs: {
        data_out_of_school: [outOfSchoolData],
        data: schoolsData,
      },
    }
  }
}
