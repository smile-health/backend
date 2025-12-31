import { Context } from "hono"
import { TargetEstimationBiasRepository } from "../target-estimation-bias/target-estimation-bias.repository.js"
import {
  BiasCalculateDetailQueryDTO,
  BiasCalculateDetailResponse,
  RecalculateEstimationDTO,
  RecalculateEstimationResponse,
  SaveBiasImmunizationLogisticsDTO,
  SaveImmunizationAchievementDTO,
  SaveImmunizationDataResponse,
  SchoolListResponse,
  UpdateBiasImmunizationLogisticsDTO,
} from "./bias-immunization-logistics.schema.js"
import {
  PERCENTAGE_100,
  PERCENTAGE_50,
  SCHOOL_TARGET_GROUPS,
  SCHOOL_TARGET_LABELS,
} from "@/common/constants/target.js"
import { MaterialRepository } from "../material/material.repository.js"
import {
  safeDiv,
  calcVialNeedNoBuffer,
} from "../immunization-logistics/immunization-logistics.formula.js"
import { BiasImmunizationLogisticsRepository } from "./bias-immunization-logistics.repository.js"
import { TargetsRepository } from "../targets/targets.repository.js"
import { ValidationError } from "@smile/lib/error.js"
import { StockRepository } from "../stock/stock.repository.js"
import { MaterialTargetsRepository } from "../material-targets/material-targets.repository.js"

export class BiasImmunizationLogisticsModule {
  constructor(
    private readonly biasRepo: TargetEstimationBiasRepository,
    private readonly materialRepo: MaterialRepository,
    private readonly materialTargetsRepo: MaterialTargetsRepository,
    private readonly logisticsRepo: BiasImmunizationLogisticsRepository,
    private readonly targetsRepo: TargetsRepository,
    private readonly stockRepo: StockRepository
  ) {}

  async #getMaterialIds(
    c: Context,
    type: "primary" | "additional",
    category: "bias" | "non_bias"
  ): Promise<{
    materialIds: number[]
    codeToIdMap: Map<string, number>
    idToCodeMap: Map<number, string>
    idToNameMap: Map<number, string>
  }> {
    const materialTargets = await this.materialRepo.findMaterialsFromTargets(
      c,
      type,
      category
    )

    const materialIds = materialTargets.map((m) => m.material_id)
    const rawMaterials = await this.materialRepo.findWsMaterialsByIds(
      c,
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

  #extractSchoolGrades(countMap: Map<number, number>) {
    const targetGroupId11 = 10
    return {
      grade1: countMap.get(4) ?? 0,
      grade2: countMap.get(5) ?? 0,
      grade5Female: countMap.get(7) ?? 0,
      grade5Male: countMap.get(targetGroupId11) ?? 0,
    }
  }

  #buildTargetItems(gradeCounts: {
    grade1: number
    grade2: number
    grade5Female: number
    grade5Male: number
  }) {
    return [
      {
        id: 4,
        name: SCHOOL_TARGET_LABELS[4],
        value: gradeCounts.grade1,
      },
      {
        id: 5,
        name: SCHOOL_TARGET_LABELS[5],
        value: gradeCounts.grade2,
      },
      {
        id: 7,
        name: SCHOOL_TARGET_LABELS[7],
        targets: [
          {
            name: "Td @10 ds (Male & Female)",
            value: gradeCounts.grade5Female + gradeCounts.grade5Male,
          },
          {
            name: "HPV @1 DS (Female)",
            value: gradeCounts.grade5Female,
          },
        ],
      },
    ]
  }

  async #fetchCommonData(c: Context, schoolId: number, materialIds: number[]) {
    const {
      global_id,
      sub_district_id,
      name: entityName,
    } = c.var.userEntity ?? {}
    if (!global_id) throw new ValidationError("Entity not found")

    const microplanningId = await this.targetsRepo.findOrCreateMicroplanning(
      c,
      global_id,
      new Date().getFullYear() + 1
    )

    const isOutOfSchool = schoolId === global_id

    const [materials, counts, schoolName] = await Promise.all([
      this.materialRepo.findWsMaterialsByIds(c, materialIds),
      isOutOfSchool
        ? this.biasRepo.getOutOfSchoolTargetCounts(
            c,
            Number(sub_district_id),
            SCHOOL_TARGET_GROUPS
          )
        : this.biasRepo.getTargetCountsByEntityId(
            c,
            schoolId,
            SCHOOL_TARGET_GROUPS,
            microplanningId
          ),
      isOutOfSchool
        ? Promise.resolve({ name: entityName })
        : this.biasRepo.getSchoolName(c, schoolId),
    ])

    const countMap = new Map(
      counts
        .filter((item) => item.target_group_id !== null)
        .map((item) => [item.target_group_id as number, Number(item.count)])
    )
    const gradeCounts = this.#extractSchoolGrades(countMap)

    return {
      global_id,
      microplanningId,
      materials,
      schoolName: schoolName?.name ?? entityName ?? "Unknown School",
      puskesmasId: global_id,
      puskesmasName: entityName ?? "",
      gradeCounts,
    }
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

  #buildVialNeedsResponse(
    vialNeeds: {
      vialNeedMR: number
      vialNeedDT: number
      vialNeedTd: number
      vialNeedHPV: number
    },
    stockData: Map<number, number>,
    materialIds: number[],
    idToNameMap: Map<number, string>,
    materialIdsMap: {
      mrId: number
      dtId: number
      tdId: number
      hpvId: number
    }
  ) {
    return materialIds.map((materialId) => {
      let vialNeed = 0

      if (materialId === materialIdsMap.mrId) {
        vialNeed = vialNeeds.vialNeedMR
      } else if (materialId === materialIdsMap.dtId) {
        vialNeed = vialNeeds.vialNeedDT
      } else if (materialId === materialIdsMap.tdId) {
        vialNeed = vialNeeds.vialNeedTd
      } else if (materialId === materialIdsMap.hpvId) {
        vialNeed = vialNeeds.vialNeedHPV
      }

      const availableStock = stockData.get(materialId) ?? 0
      const needsQty = vialNeed - availableStock

      return {
        id: materialId,
        name: idToNameMap.get(materialId) ?? "Unknown",
        min_stock: null,
        max_stock: vialNeed,
        available_stock: availableStock,
        request_qty: needsQty,
      }
    })
  }

  #buildAdsSbNeeds(
    vialNeeds: {
      vialNeedMR: number
      vialNeedDT: number
      vialNeedTd: number
      vialNeedHPV: number
      ipMR: number
      ipDT: number
      ipTd: number
      ipHPV: number
    },
    logisticIds: {
      ads5mlId: number
      ads05mlId: number
      sb25lId: number
      sb5lId: number
    },
    availableStock: {
      MR: number
      DT: number
      Td: number
      HPV: number
    },
    idToNameMap: Map<number, string>
  ) {
    const needsQtyMR = vialNeeds.vialNeedMR - availableStock.MR
    const needsQtyDT = vialNeeds.vialNeedDT - availableStock.DT
    const needsQtyTd = vialNeeds.vialNeedTd - availableStock.Td
    const needsQtyHPV = vialNeeds.vialNeedHPV - availableStock.HPV

    const augustADS5ML = Math.round(needsQtyMR)
    const augustADS05ML = Math.round(
      needsQtyMR * vialNeeds.ipMR + needsQtyHPV * vialNeeds.ipHPV
    )
    const augustSB25LTR = Math.ceil(
      (augustADS5ML + augustADS05ML) / PERCENTAGE_50
    )
    const augustSB5LTR = Math.ceil(
      (augustADS5ML + augustADS05ML) / PERCENTAGE_100
    )

    const novemberADS05ML = Math.round(
      needsQtyDT * vialNeeds.ipDT + needsQtyTd * vialNeeds.ipTd
    )
    const novemberSB25LTR = Math.ceil(novemberADS05ML / PERCENTAGE_50)
    const novemberSB5LTR = Math.ceil(novemberADS05ML / PERCENTAGE_100)

    return [
      {
        label: "August",
        targets: [
          {
            id: logisticIds.ads5mlId,
            name: idToNameMap.get(logisticIds.ads5mlId) ?? "ADS 5 ML",
            value: augustADS5ML,
          },
          {
            id: logisticIds.ads05mlId,
            name: idToNameMap.get(logisticIds.ads05mlId) ?? "ADS 0.5 ML",
            value: augustADS05ML,
          },
          {
            id: logisticIds.sb25lId,
            name: idToNameMap.get(logisticIds.sb25lId) ?? "SB 2.5 Ltr",
            value: augustSB25LTR,
          },
          {
            id: logisticIds.sb5lId,
            name: idToNameMap.get(logisticIds.sb5lId) ?? "SB 5 Ltr",
            value: augustSB5LTR,
          },
        ],
      },
      {
        label: "November",
        targets: [
          {
            id: logisticIds.ads05mlId,
            name: idToNameMap.get(logisticIds.ads05mlId) ?? "ADS 0.5 ML",
            value: novemberADS05ML,
          },
          {
            id: logisticIds.sb25lId,
            name: idToNameMap.get(logisticIds.sb25lId) ?? "SB 2.5 Ltr",
            value: novemberSB25LTR,
          },
          {
            id: logisticIds.sb5lId,
            name: idToNameMap.get(logisticIds.sb5lId) ?? "SB 5 Ltr",
            value: novemberSB5LTR,
          },
        ],
      },
    ]
  }

  #buildResponse(
    locationData: {
      schoolId: number
      schoolName: string
      puskesmasId: number
      puskesmasName: string
    },
    immunizationData: {
      absoluteImmunization: { id: number; name: string; value: number | null }[]
      targets: any[]
      vialsUsed: { id: number; name: string; value: number | null }[]
      utilizationRate: { id: number; name: string; value: number | null }[]
    },
    needsData: {
      vialNeeds: any[]
      adsSbNeeds: any[]
    }
  ): SaveImmunizationDataResponse {
    return {
      school_id: locationData.schoolId,
      school_name: locationData.schoolName,
      puskesmas_id: locationData.puskesmasId,
      puskesmas_name: locationData.puskesmasName,
      number_of_immunization: {
        title: "Number of Immunization Achievements (Previous Year)",
        name_label: "Material Name",
        value_label: "Number Of Doses",
        items: immunizationData.absoluteImmunization,
      },
      number_of_target: {
        title: "Number of Target",
        name_label: "Target",
        value_label: "Target Value",
        items: immunizationData.targets,
      },
      vaccine_vials_used: {
        title: "Number of Vaccine Vials Used",
        name_label: "Material Name",
        value_label: "Number Of Doses",
        items: immunizationData.vialsUsed,
      },
      vaccine_utilization_rate: {
        title: "Vaccine Utilization Rate (IP)",
        name_label: "Material Name",
        value_label: "Number Of Doses",
        items: immunizationData.utilizationRate,
      },
      vial_needs: {
        title: "Vial Needs",
        name_label: "Material Name",
        value_label: "Number Of Doses",
        items: needsData.vialNeeds,
      },
      ads_sb_needs: {
        title: "ADS & SB Needs",
        name_label: "Material Name",
        value_label: "Number Of Doses",
        items: needsData.adsSbNeeds,
      },
    }
  }

  #getBiasIds(primaryMaterials) {
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

    return {
      mrId,
      dtId,
      tdId,
      hpvId,
    }
  }

  #getLogisticsIds(logisticMaterials) {
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

    const ads005mlId = this.#findMaterialIdByCodeVariations(
      logisticMaterials.codeToIdMap,
      ["ADS 0.05 ml", "ADS 0,05 ml", "ADS 0.05 ML", "ADS 0,05 ML"]
    )

    return {
      ads5mlId,
      ads05mlId,
      sb25lId,
      sb5lId,
      ads005mlId,
    }
  }

  async #fetchMaterialTargetMaps(
    c: Context,
    primaryMaterialIds: number[],
    augustMaterialIds: number[],
    novemberMaterialIds: number[]
  ) {
    const [
      primaryAugustTargets,
      primaryNovemberTargets,
      augustAdditionalTargets,
      novemberAdditionalTargets,
    ] = await Promise.all([
      this.materialTargetsRepo.getMaterialTargetsByMaterialIdsAndMonth(
        c,
        primaryMaterialIds,
        "bias",
        "primary",
        "august"
      ),
      this.materialTargetsRepo.getMaterialTargetsByMaterialIdsAndMonth(
        c,
        primaryMaterialIds,
        "bias",
        "primary",
        "november"
      ),
      this.materialTargetsRepo.getMaterialTargetsByMaterialIdsAndMonth(
        c,
        augustMaterialIds,
        "bias",
        "additional",
        "august"
      ),
      this.materialTargetsRepo.getMaterialTargetsByMaterialIdsAndMonth(
        c,
        novemberMaterialIds,
        "bias",
        "additional",
        "november"
      ),
    ])

    return {
      primaryAugustTargetMap: new Map(
        primaryAugustTargets.map((t) => [t.material_id, t.id])
      ),
      primaryNovemberTargetMap: new Map(
        primaryNovemberTargets.map((t) => [t.material_id, t.id])
      ),
      augustAdditionalTargetMap: new Map(
        augustAdditionalTargets.map((t) => [t.material_id, t.id])
      ),
      novemberAdditionalTargetMap: new Map(
        novemberAdditionalTargets.map((t) => [t.material_id, t.id])
      ),
    }
  }

  #extractMaterialIdsFromBody(
    body: SaveBiasImmunizationLogisticsDTO | UpdateBiasImmunizationLogisticsDTO
  ) {
    const primaryMaterialIds = body.vial_needs.items.map((item) => item.id)
    const augustMaterialIds =
      body.ads_sb_needs.items
        .find((m) => m.label.toLowerCase() === "august")
        ?.targets.map((item) => item.id) ?? []
    const novemberMaterialIds =
      body.ads_sb_needs.items
        .find((m) => m.label.toLowerCase() === "november")
        ?.targets.map((item) => item.id) ?? []

    return { primaryMaterialIds, augustMaterialIds, novemberMaterialIds }
  }

  #validateMissingTargets(
    primaryMaterialIds: number[],
    primaryAugustTargetMap: Map<number, number>,
    primaryNovemberTargetMap: Map<number, number>
  ) {
    const missingPrimaryAugustTargets = primaryMaterialIds.filter(
      (id) => !primaryAugustTargetMap.has(id)
    )
    const missingPrimaryNovemberTargets = primaryMaterialIds.filter(
      (id) => !primaryNovemberTargetMap.has(id)
    )

    if (missingPrimaryAugustTargets.length > 0) {
      throw new ValidationError(
        `Material targets not found for primary material IDs in August: ${missingPrimaryAugustTargets.join(", ")}.`
      )
    }

    if (missingPrimaryNovemberTargets.length > 0) {
      throw new ValidationError(
        `Material targets not found for primary material IDs in November: ${missingPrimaryNovemberTargets.join(", ")}.`
      )
    }
  }

  async #saveVialNeedsForMonth(
    c: Context,
    materialTargetId: number,
    microplanningId: number,
    schoolId: number,
    vialData: {
      planningDetail: number | null
      availableStockDetail: number | null
      needsQtyDetail: number | null
      absoluteImmunizationValue: number | null
      vialsUsedValue: number | null
      utilizationRateValue: number | null
    }
  ) {
    const materialNeed = await this.logisticsRepo.saveMaterialNeed(c, {
      material_target_id: materialTargetId,
      microplanning_id: microplanningId,
      reference_type: "school",
      reference_id: schoolId,
      total_needs: vialData.planningDetail,
    })

    await this.logisticsRepo.saveMaterialNeedDetail(c, {
      material_need_id: materialNeed.id,
      absolute_number_of_routine_immunization:
        vialData.absoluteImmunizationValue,
      number_of_vials_used: vialData.vialsUsedValue,
      remaining_stock: vialData.availableStockDetail,
    })

    await this.logisticsRepo.saveMonthlyVaccineNeedDetail(c, {
      material_need_id: materialNeed.id,
      request_qty: vialData.needsQtyDetail,
    })

    if (
      vialData.utilizationRateValue !== null &&
      vialData.utilizationRateValue !== undefined
    ) {
      await this.logisticsRepo.saveVaccineUtilizationRate(c, {
        material_need_id: materialNeed.id,
        vaccine_utilization_rate: vialData.utilizationRateValue,
      })
    }
  }

  async #updateVialNeedsForMonth(
    c: Context,
    materialNeedId: number,
    vialData: {
      planningDetail: number | null
      availableStockDetail: number | null
      needsQtyDetail: number | null
      absoluteImmunizationValue: number | null
      vialsUsedValue: number | null
      utilizationRateValue: number | null
    }
  ) {
    await this.logisticsRepo.updateMaterialNeed(
      c,
      materialNeedId,
      vialData.planningDetail
    )

    await this.logisticsRepo.updateMaterialNeedDetail(c, materialNeedId, {
      absolute_number_of_routine_immunization:
        vialData.absoluteImmunizationValue,
      number_of_vials_used: vialData.vialsUsedValue,
      remaining_stock: vialData.availableStockDetail,
    })

    await this.logisticsRepo.updateMonthlyVaccineNeedDetail(c, materialNeedId, {
      request_qty: vialData.needsQtyDetail,
    })

    if (
      vialData.utilizationRateValue !== null &&
      vialData.utilizationRateValue !== undefined
    ) {
      await this.logisticsRepo.updateVaccineUtilizationRate(
        c,
        materialNeedId,
        vialData.utilizationRateValue
      )
    }
  }

  #extractVialDataFromBody(
    body: SaveBiasImmunizationLogisticsDTO | UpdateBiasImmunizationLogisticsDTO,
    vialNeedItem: {
      id: number
      max_stock: number | null
      available_stock: number | null
      request_qty: number | null
    }
  ) {
    return {
      planningDetail: vialNeedItem.max_stock ?? null,
      availableStockDetail: vialNeedItem.available_stock ?? null,
      needsQtyDetail: vialNeedItem.request_qty ?? null,
      absoluteImmunizationValue:
        body.number_of_immunization.items.find((i) => i.id === vialNeedItem.id)
          ?.value ?? null,
      vialsUsedValue:
        body.vaccine_vials_used.items.find((i) => i.id === vialNeedItem.id)
          ?.value ?? null,
      utilizationRateValue:
        body.vaccine_utilization_rate.items.find(
          (i) => i.id === vialNeedItem.id
        )?.value ?? null,
    }
  }

  async #processAdsSbNeedsForSave(
    c: Context,
    body: SaveBiasImmunizationLogisticsDTO,
    microplanningId: number,
    schoolId: number,
    augustAdditionalTargetMap: Map<number, number>,
    novemberAdditionalTargetMap: Map<number, number>
  ) {
    for (const monthData of body.ads_sb_needs.items) {
      const month = monthData.label.toLowerCase()
      const targetMap =
        month === "august"
          ? augustAdditionalTargetMap
          : novemberAdditionalTargetMap

      for (const item of monthData.targets) {
        const materialTargetId = targetMap.get(item.id)
        if (!materialTargetId) continue

        const materialNeed = await this.logisticsRepo.saveMaterialNeed(c, {
          material_target_id: materialTargetId,
          microplanning_id: microplanningId,
          reference_type: "school",
          reference_id: schoolId,
          total_needs: null,
        })

        await this.logisticsRepo.saveAdditionalNeed(c, {
          material_need_id: materialNeed.id,
          material_target_id: materialTargetId,
          total: item.value ?? null,
        })
      }
    }
  }

  async #processAdsSbNeedsForUpdate(
    c: Context,
    body: UpdateBiasImmunizationLogisticsDTO,
    existingDataMap: Map<number, number>,
    augustAdditionalTargetMap: Map<number, number>,
    novemberAdditionalTargetMap: Map<number, number>
  ) {
    for (const monthData of body.ads_sb_needs.items) {
      const month = monthData.label.toLowerCase()
      const targetMap =
        month === "august"
          ? augustAdditionalTargetMap
          : novemberAdditionalTargetMap

      for (const item of monthData.targets) {
        const materialTargetId = targetMap.get(item.id)
        if (!materialTargetId) continue

        const materialNeedId = existingDataMap.get(materialTargetId)
        if (!materialNeedId) continue

        await this.logisticsRepo.updateAdditionalNeed(c, materialNeedId, {
          total: item.value ?? null,
        })
      }
    }
  }

  async getCalculateDetail(
    c: Context,
    query: BiasCalculateDetailQueryDTO
  ): Promise<BiasCalculateDetailResponse> {
    const {
      global_id,
      sub_district_id,
      name: entityName,
    } = c.var.userEntity ?? {}
    if (!global_id) throw new ValidationError("Entity not found")

    const [primaryMaterials, logisticMaterials, microplanningId] =
      await Promise.all([
        this.#getMaterialIds(c, "primary", "bias"),
        this.#getMaterialIds(c, "additional", "bias"),
        this.targetsRepo.findOrCreateMicroplanning(
          c,
          global_id,
          new Date().getFullYear() + 1
        ),
      ])

    const { ads05mlId, sb25lId, sb5lId, ads005mlId } =
      this.#getLogisticsIds(logisticMaterials)

    const augustLogisticIds = logisticMaterials.materialIds.filter(
      (id) => id !== ads005mlId
    )
    const novemberLogisticIds = [ads05mlId, sb25lId, sb5lId]

    const isOutOfSchool = query.school_id === global_id

    const [counts, schoolName, existingData] = await Promise.all([
      isOutOfSchool
        ? this.biasRepo.getOutOfSchoolTargetCounts(
            c,
            Number(sub_district_id),
            SCHOOL_TARGET_GROUPS
          )
        : this.biasRepo.getTargetCountsByEntityId(
            c,
            query.school_id,
            SCHOOL_TARGET_GROUPS,
            microplanningId
          ),
      isOutOfSchool
        ? Promise.resolve({ name: entityName })
        : this.biasRepo.getSchoolName(c, query.school_id),
      this.logisticsRepo.getExistingMaterialNeeds(
        c,
        query.school_id,
        "school",
        microplanningId
      ),
    ])

    const countMap = new Map(
      counts
        .filter((item) => item.target_group_id !== null)
        .map((item) => [item.target_group_id as number, Number(item.count)])
    )
    const gradeCounts = this.#extractSchoolGrades(countMap)
    const targets = this.#buildTargetItems(gradeCounts)

    const existingDataMap = new Map(
      existingData.map((item) => [item.material_id, item])
    )

    const hasTotalNeeds = existingData.some(
      (item) => item.total_needs !== null && Number(item.total_needs) > 0
    )

    const transactionQtyMap = new Map<number, number>()
    if (!hasTotalNeeds) {
      const transactionData =
        await this.logisticsRepo.getTransactionQtyByEntity(c, global_id)
      transactionData.forEach((item) => {
        if (item.material_id) {
          transactionQtyMap.set(item.material_id, Number(item.qty) || 0)
        }
      })
    }

    const immunizations = primaryMaterials.materialIds.map((materialId) => {
      const existing = existingDataMap.get(materialId)

      let value: number | null = null
      if (
        existing?.absolute_number_of_routine_immunization !== null &&
        Number(existing?.absolute_number_of_routine_immunization) > 0
      ) {
        value = existing?.absolute_number_of_routine_immunization ?? 0
      } else {
        value = transactionQtyMap.get(materialId) ?? null
      }

      return {
        id: materialId,
        name: primaryMaterials.idToNameMap.get(materialId) ?? "Unknown",
        value: value,
      }
    })

    const vialsUsed = primaryMaterials.materialIds.map((materialId) => {
      const existing = existingDataMap.get(materialId)
      return {
        id: materialId,
        name: primaryMaterials.idToNameMap.get(materialId) ?? "Unknown",
        value: existing?.number_of_vials_used ?? null,
      }
    })

    const utilizationRate = primaryMaterials.materialIds.map((materialId) => {
      const existing = existingDataMap.get(materialId)
      return {
        id: materialId,
        name: primaryMaterials.idToNameMap.get(materialId) ?? "Unknown",
        value: existing?.vaccine_utilization_rate ?? null,
      }
    })

    const vialNeeds = primaryMaterials.materialIds.map((materialId) => {
      const existing = existingDataMap.get(materialId)

      if (
        existing &&
        existing.number_of_vials_used !== null &&
        existing.number_of_vials_used !== undefined
      ) {
        return {
          id: materialId,
          name: primaryMaterials.idToNameMap.get(materialId) ?? "Unknown",
          min_stock: null,
          max_stock: existing.total_needs,
          available_stock: existing.detail_remaining_stock ?? null,
          request_qty:
            (existing.total_needs ?? 0) -
            (existing.detail_remaining_stock ?? 0),
        }
      }

      return {
        id: materialId,
        name: primaryMaterials.idToNameMap.get(materialId) ?? "Unknown",
        min_stock: null,
        max_stock: null,
        available_stock: null,
        request_qty: null,
      }
    })

    const augustData = existingData.filter(
      (item) => item.type === "additional" && item.injection_month === "august"
    )
    const novemberData = existingData.filter(
      (item) =>
        item.type === "additional" && item.injection_month === "november"
    )

    const adsSbNeeds =
      augustData.length > 0 || novemberData.length > 0
        ? [
            {
              label: "August",
              targets: augustLogisticIds.map((materialId) => {
                const existing = augustData.find(
                  (item) => item.material_id === materialId
                )
                return {
                  id: materialId,
                  name:
                    logisticMaterials.idToNameMap.get(materialId) ?? "Unknown",
                  value: existing?.additional_total ?? null,
                }
              }),
            },
            {
              label: "November",
              targets: novemberLogisticIds.map((materialId) => {
                const existing = novemberData.find(
                  (item) => item.material_id === materialId
                )
                return {
                  id: materialId,
                  name:
                    logisticMaterials.idToNameMap.get(materialId) ?? "Unknown",
                  value: existing?.additional_total ?? null,
                }
              }),
            },
          ]
        : [
            {
              label: "August",
              targets: augustLogisticIds.map((materialId) => {
                return {
                  id: materialId,
                  name:
                    logisticMaterials.idToNameMap.get(materialId) ?? "Unknown",
                  value: null,
                }
              }),
            },
            {
              label: "November",
              targets: novemberLogisticIds.map((materialId) => {
                return {
                  id: materialId,
                  name:
                    logisticMaterials.idToNameMap.get(materialId) ?? "Unknown",
                  value: null,
                }
              }),
            },
          ]

    return {
      school_id: query.school_id,
      school_name:
        schoolName?.name ?? c.var.userEntity?.name ?? "Unknown School",
      puskesmas_id: c.var.userEntity?.global_id ?? 0,
      puskesmas_name: c.var.userEntity?.name ?? "",
      number_of_immunization: {
        title: "Number of Immunization Achievements (Previous Year)",
        name_label: "Material Name",
        value_label: "Number Of Doses",
        items: immunizations,
      },
      number_of_target: {
        title: "Number of Target",
        name_label: "Target",
        value_label: "Target Value",
        items: targets,
      },
      vaccine_vials_used: {
        title: "Number of Vaccine Vials Used",
        name_label: "Material Name",
        value_label: "Number Of Doses",
        items: vialsUsed,
      },
      vaccine_utilization_rate: {
        title: "Vaccine Utilization Rate (IP)",
        name_label: "Material Name",
        value_label: "Number Of Doses",
        items: utilizationRate,
      },
      vial_needs: {
        title: "Vial Needs",
        name_label: "Material Name",
        value_label: "Number Of Doses",
        items: vialNeeds,
      },
      ads_sb_needs: {
        title: "ADS & SB Needs",
        name_label: "Material Name",
        value_label: "Number Of Doses",
        items: adsSbNeeds,
      },
    }
  }

  async saveImmunizationData(
    c: Context,
    body: SaveImmunizationAchievementDTO
  ): Promise<SaveImmunizationDataResponse> {
    const [primaryMaterials, logisticMaterials] = await Promise.all([
      this.#getMaterialIds(c, "primary", "bias"),
      this.#getMaterialIds(c, "additional", "bias"),
    ])

    const { mrId, dtId, tdId, hpvId } = this.#getBiasIds(primaryMaterials)
    const { ads5mlId, ads05mlId, sb25lId, sb5lId } =
      this.#getLogisticsIds(logisticMaterials)

    const materialIdsMap = { mrId, dtId, tdId, hpvId }
    const logisticIds = { ads5mlId, ads05mlId, sb25lId, sb5lId }

    const materialIds = Object.keys(body.items).map((id) => parseInt(id))
    const commonData = await this.#fetchCommonData(
      c,
      body.school_id,
      materialIds
    )

    const materialMap = new Map(commonData.materials.map((m) => [m.id, m]))

    const stockData = await this.stockRepo.getStocksByEntityAndMaterials(
      c,
      commonData.global_id,
      primaryMaterials.materialIds
    )
    const stockMap = new Map(
      stockData
        .filter((s) => s.material_id !== null)
        .map((s) => [s.material_id as number, Number(s.total_qty)])
    )

    const availableStock = {
      MR: stockMap.get(mrId) ?? 0,
      DT: stockMap.get(dtId) ?? 0,
      Td: stockMap.get(tdId) ?? 0,
      HPV: stockMap.get(hpvId) ?? 0,
    }

    const absoluteImmunization = primaryMaterials.materialIds.map(
      (materialId) => ({
        id: materialId,
        name: primaryMaterials.idToNameMap.get(materialId) ?? "Unknown",
        value: body.items[materialId] ?? 0,
      })
    )

    const targets = this.#buildTargetItems(commonData.gradeCounts)

    const vialsUsed = primaryMaterials.materialIds.map((materialId) => {
      const inputValue = body.items[materialId] ?? 0
      const material = materialMap.get(materialId)
      const consumptionUnit =
        material?.consumption_unit_per_distribution_unit ?? 1
      const calculatedValue =
        inputValue > 0 ? Math.round(inputValue / consumptionUnit) : 0

      return {
        id: materialId,
        name: primaryMaterials.idToNameMap.get(materialId) ?? "Unknown",
        value: calculatedValue,
      }
    })

    const utilizationRate = primaryMaterials.materialIds.map((materialId) => {
      const absolute = body.items[materialId] ?? 0
      const vialUsed = vialsUsed.find((v) => v.id === materialId)?.value ?? 0
      const rate = vialUsed > 0 ? Math.ceil(safeDiv(absolute, vialUsed)) : 0

      return {
        id: materialId,
        name: primaryMaterials.idToNameMap.get(materialId) ?? "Unknown",
        value: rate,
      }
    })

    const vialNeedsCalculated = this.#calculateVialNeeds(
      commonData.gradeCounts,
      utilizationRate,
      materialIdsMap
    )
    const vialNeedsItems = this.#buildVialNeedsResponse(
      vialNeedsCalculated,
      stockMap,
      primaryMaterials.materialIds,
      primaryMaterials.idToNameMap,
      materialIdsMap
    )
    const adsSbNeeds = this.#buildAdsSbNeeds(
      vialNeedsCalculated,
      logisticIds,
      availableStock,
      logisticMaterials.idToNameMap
    )

    return this.#buildResponse(
      {
        schoolId: body.school_id,
        schoolName: commonData.schoolName,
        puskesmasId: commonData.puskesmasId,
        puskesmasName: commonData.puskesmasName,
      },
      {
        absoluteImmunization,
        targets,
        vialsUsed,
        utilizationRate,
      },
      {
        vialNeeds: vialNeedsItems,
        adsSbNeeds,
      }
    )
  }

  async recalculateEstimation(
    c: Context,
    body: RecalculateEstimationDTO
  ): Promise<RecalculateEstimationResponse> {
    const [primaryMaterials, logisticMaterials] = await Promise.all([
      this.#getMaterialIds(c, "primary", "bias"),
      this.#getMaterialIds(c, "additional", "bias"),
    ])

    const { mrId, dtId, tdId, hpvId } = this.#getBiasIds(primaryMaterials)
    const { ads5mlId, ads05mlId, sb25lId, sb5lId } =
      this.#getLogisticsIds(logisticMaterials)
    const materialIdsMap = { mrId, dtId, tdId, hpvId }
    const logisticIds = { ads5mlId, ads05mlId, sb25lId, sb5lId }

    const materialIds = Object.keys(body.items).map((id) => parseInt(id))
    const commonData = await this.#fetchCommonData(
      c,
      body.school_id,
      materialIds
    )

    const stockData = await this.stockRepo.getStocksByEntityAndMaterials(
      c,
      commonData.global_id,
      primaryMaterials.materialIds
    )

    const stockMap = new Map(
      stockData
        .filter((s) => s.material_id !== null)
        .map((s) => [s.material_id as number, Number(s.total_qty)])
    )

    const availableStock = {
      MR: stockMap.get(mrId) ?? 0,
      DT: stockMap.get(dtId) ?? 0,
      Td: stockMap.get(tdId) ?? 0,
      HPV: stockMap.get(hpvId) ?? 0,
    }

    const absoluteImmunization = primaryMaterials.materialIds.map(
      (materialId) => ({
        id: materialId,
        name: primaryMaterials.idToNameMap.get(materialId) ?? "Unknown",
        value: body.items[materialId] ?? 0,
      })
    )

    const targets = this.#buildTargetItems(commonData.gradeCounts)

    const vialsUsed = primaryMaterials.materialIds.map((materialId) => ({
      id: materialId,
      name: primaryMaterials.idToNameMap.get(materialId) ?? "Unknown",
      value: body.vials_used[materialId] ?? 0,
    }))

    const utilizationRate = primaryMaterials.materialIds.map((materialId) => {
      const absolute = body.items[materialId] ?? 0
      const vialUsed = body.vials_used[materialId] ?? 0
      const rate =
        vialUsed > 0
          ? Math.round(safeDiv(absolute, vialUsed) * PERCENTAGE_100) /
            PERCENTAGE_100
          : 0

      return {
        id: materialId,
        name: primaryMaterials.idToNameMap.get(materialId) ?? "Unknown",
        value: rate,
      }
    })

    const vialNeedsCalculated = this.#calculateVialNeeds(
      commonData.gradeCounts,
      utilizationRate,
      materialIdsMap
    )
    const vialNeedsItems = this.#buildVialNeedsResponse(
      vialNeedsCalculated,
      stockMap,
      primaryMaterials.materialIds,
      primaryMaterials.idToNameMap,
      materialIdsMap
    )
    const adsSbNeeds = this.#buildAdsSbNeeds(
      vialNeedsCalculated,
      logisticIds,
      availableStock,
      logisticMaterials.idToNameMap
    )

    return this.#buildResponse(
      {
        schoolId: body.school_id,
        schoolName: commonData.schoolName,
        puskesmasId: commonData.puskesmasId,
        puskesmasName: commonData.puskesmasName,
      },
      {
        absoluteImmunization,
        targets,
        vialsUsed,
        utilizationRate,
      },
      {
        vialNeeds: vialNeedsItems,
        adsSbNeeds,
      }
    )
  }

  async saveBiasImmunizationLogistics(
    c: Context,
    body: SaveBiasImmunizationLogisticsDTO
  ) {
    const entityId = c.var.userEntity?.global_id
    if (!entityId) {
      throw new ValidationError("Entity not found")
    }

    const nextYear = new Date().getFullYear() + 1
    const microplanningId = await this.targetsRepo.findOrCreateMicroplanning(
      c,
      entityId,
      nextYear
    )

    const { primaryMaterialIds, augustMaterialIds, novemberMaterialIds } =
      this.#extractMaterialIdsFromBody(body)

    const {
      primaryAugustTargetMap,
      primaryNovemberTargetMap,
      augustAdditionalTargetMap,
      novemberAdditionalTargetMap,
    } = await this.#fetchMaterialTargetMaps(
      c,
      primaryMaterialIds,
      augustMaterialIds,
      novemberMaterialIds
    )

    const allTargetIds = [
      ...primaryAugustTargetMap.values(),
      ...primaryNovemberTargetMap.values(),
      ...augustAdditionalTargetMap.values(),
      ...novemberAdditionalTargetMap.values(),
    ]

    const existingData = await this.logisticsRepo.checkExistingData(
      c,
      body.school_id,
      "school",
      microplanningId,
      allTargetIds
    )

    if (existingData.length > 0) {
      throw new ValidationError(
        `Data for school_id ${body.school_id} and year ${nextYear} already exists.`
      )
    }

    this.#validateMissingTargets(
      primaryMaterialIds,
      primaryAugustTargetMap,
      primaryNovemberTargetMap
    )

    await this.#processVialNeedsForSave(
      c,
      body,
      microplanningId,
      primaryAugustTargetMap,
      primaryNovemberTargetMap
    )

    await this.#processAdsSbNeedsForSave(
      c,
      body,
      microplanningId,
      body.school_id,
      augustAdditionalTargetMap,
      novemberAdditionalTargetMap
    )

    return {
      success: true,
      message: "Bias immunization logistics data saved successfully",
    }
  }

  async #processVialNeedsForSave(
    c: Context,
    body: SaveBiasImmunizationLogisticsDTO,
    microplanningId: number,
    primaryAugustTargetMap: Map<number, number>,
    primaryNovemberTargetMap: Map<number, number>
  ) {
    for (const vialNeedItem of body.vial_needs.items) {
      const vialData = this.#extractVialDataFromBody(body, vialNeedItem)

      for (const monthMap of [
        primaryAugustTargetMap,
        primaryNovemberTargetMap,
      ]) {
        const materialTargetId = monthMap.get(vialNeedItem.id)
        if (!materialTargetId) continue

        await this.#saveVialNeedsForMonth(
          c,
          materialTargetId,
          microplanningId,
          body.school_id,
          vialData
        )
      }
    }
  }

  async getDataChecker(
    c: Context,
    subDistrictId: number,
    keyword?: string
  ): Promise<SchoolListResponse> {
    const entityId = c.var.userEntity?.global_id
    if (!entityId) throw new ValidationError("Entity not found")

    const microplanningId = await this.targetsRepo.findOrCreateMicroplanning(
      c,
      entityId,
      new Date().getFullYear() + 1
    )

    const [outOfSchoolMaterialNeeds, rawData] = await Promise.all([
      this.logisticsRepo.checkExistingDataByReference(
        c,
        entityId,
        "school",
        microplanningId
      ),
      this.logisticsRepo.getSchoolsBySubDistrictWithMaterialNeeds(
        c,
        subDistrictId,
        microplanningId,
        keyword
      ),
    ])

    const outOfSchoolHasData = outOfSchoolMaterialNeeds.length > 0

    const outOfSchoolEntities = [
      {
        id: entityId,
        name: "Children Not in School",
        has_data: outOfSchoolHasData,
      },
    ]

    let dataCount = 0
    const entities = rawData.map((school) => {
      const hasData = school.material_need_id !== null
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

  async updateBiasImmunizationLogistics(
    c: Context,
    schoolId: number,
    body: UpdateBiasImmunizationLogisticsDTO
  ) {
    const entityId = c.var.userEntity?.global_id
    if (!entityId) {
      throw new ValidationError("Entity not found")
    }

    const nextYear = new Date().getFullYear() + 1
    const microplanningId = await this.targetsRepo.findOrCreateMicroplanning(
      c,
      entityId,
      nextYear
    )

    const { primaryMaterialIds, augustMaterialIds, novemberMaterialIds } =
      this.#extractMaterialIdsFromBody(body)

    const {
      primaryAugustTargetMap,
      primaryNovemberTargetMap,
      augustAdditionalTargetMap,
      novemberAdditionalTargetMap,
    } = await this.#fetchMaterialTargetMaps(
      c,
      primaryMaterialIds,
      augustMaterialIds,
      novemberMaterialIds
    )

    const allTargetIds = [
      ...primaryAugustTargetMap.values(),
      ...primaryNovemberTargetMap.values(),
      ...augustAdditionalTargetMap.values(),
      ...novemberAdditionalTargetMap.values(),
    ]

    const existingData = await this.logisticsRepo.checkExistingData(
      c,
      schoolId,
      "school",
      microplanningId,
      allTargetIds
    )

    if (existingData.length === 0) {
      throw new ValidationError(
        `No existing data found for school_id ${schoolId} and year ${nextYear}.`
      )
    }

    const existingDataMap = new Map(
      existingData.map((item) => [item.material_target_id, item.id])
    )

    await this.#processVialNeedsForUpdate(
      c,
      body,
      existingDataMap,
      primaryAugustTargetMap,
      primaryNovemberTargetMap
    )

    await this.#processAdsSbNeedsForUpdate(
      c,
      body,
      existingDataMap,
      augustAdditionalTargetMap,
      novemberAdditionalTargetMap
    )

    return {
      success: true,
      message: "Bias immunization logistics data updated successfully",
    }
  }

  async #processVialNeedsForUpdate(
    c: Context,
    body: UpdateBiasImmunizationLogisticsDTO,
    existingDataMap: Map<number, number>,
    primaryAugustTargetMap: Map<number, number>,
    primaryNovemberTargetMap: Map<number, number>
  ) {
    for (const vialNeedItem of body.vial_needs.items) {
      const vialData = this.#extractVialDataFromBody(body, vialNeedItem)

      for (const monthMap of [
        primaryAugustTargetMap,
        primaryNovemberTargetMap,
      ]) {
        const materialTargetId = monthMap.get(vialNeedItem.id)
        if (!materialTargetId) continue

        const materialNeedId = existingDataMap.get(materialTargetId)
        if (!materialNeedId) continue

        await this.#updateVialNeedsForMonth(c, materialNeedId, vialData)
      }
    }
  }
}
