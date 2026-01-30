import { Context } from "hono"
import { TargetEstimationNonBiasRepository } from "../target-estimation-non-bias/target-estimation-non-bias.repository.js"
import {
  NonBiasCalculateDetailQueryDTO,
  NonBiasCalculateDetailResponse,
  RecalculateVillageEstimationDTO,
  RecalculateVillageEstimationResponse,
  SaveVillageImmunizationAchievementDTO,
  SaveVillageImmunizationDataResponse,
  UpdateNonBiasImmunizationLogisticsDTO,
  VillageListResponse,
} from "./non-bias-immunization-logistics.schema.js"
import {
  PERCENTAGE_100,
  PERCENTAGE_50,
  VILLAGE_LABEL,
  VILLAGE_TARGET_GROUPS,
  VILLAGE_TARGET_LABELS,
} from "@/common/constants/target.js"
import { MaterialRepository } from "../material/material.repository.js"
import {
  safeDiv,
  calcVialNeed,
  calcVialNeedNoBuffer,
} from "../immunization-logistics/immunization-logistics.formula.js"
import { NonBiasImmunizationLogisticsRepository } from "./non-bias-immunization-logistics.repository.js"
import { TargetsRepository } from "../targets/targets.repository.js"
import { ValidationError } from "@smile-health/lib/error.js"
import { StockRepository } from "../stock/stock.repository.js"
import { MaterialTargetsRepository } from "../material-targets/material-targets.repository.js"

export class NonBiasImmunizationLogisticsModule {
  constructor(
    private readonly nonBiasRepo: TargetEstimationNonBiasRepository,
    private readonly materialRepo: MaterialRepository,
    private readonly materialTargetsRepo: MaterialTargetsRepository,
    private readonly logisticsRepo: NonBiasImmunizationLogisticsRepository,
    private readonly targetsRepo: TargetsRepository,
    private readonly stockRepo: StockRepository
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

  #extractVillageTargets(countMap: Map<number, number>) {
    return {
      bbl: countMap.get(1) ?? 0,
      si: countMap.get(2) ?? 0,
      baduta: countMap.get(3) ?? 0,
      wus: countMap.get(9) ?? 0,
    }
  }

  #buildTargetItems(targetCounts: {
    bbl: number
    si: number
    baduta: number
    wus: number
  }) {
    return [
      { id: 1, name: VILLAGE_TARGET_LABELS[1], value: targetCounts.bbl },
      { id: 2, name: VILLAGE_TARGET_LABELS[2], value: targetCounts.si },
      { id: 3, name: VILLAGE_TARGET_LABELS[3], value: targetCounts.baduta },
      { id: 9, name: VILLAGE_TARGET_LABELS[9], value: targetCounts.wus },
    ]
  }

  async #fetchCommonData(c: Context, villageId: number, materialIds: number[]) {
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

    const [materials, counts, villageName] = await Promise.all([
      this.materialRepo.findWsMaterialsByIds(c, materialIds),
      this.nonBiasRepo.getTargetCountsByVillageId(
        c,
        villageId,
        VILLAGE_TARGET_GROUPS,
        microplanningId
      ),
      this.nonBiasRepo.getLocationName(c, villageId),
    ])

    const countMap = new Map(
      counts
        .filter((item) => item.target_group_id !== null)
        .map((item) => [item.target_group_id as number, Number(item.count)])
    )
    const targetCounts = this.#extractVillageTargets(countMap)

    return {
      entityId,
      microplanningId,
      materials,
      villageName: VILLAGE_LABEL + " " + villageName?.name || "Unknown Village",
      puskesmasId: entityId,
      puskesmasName: c.var.userEntity?.name ?? "",
      targetCounts,
    }
  }

  #calculateVialNeeds(
    targetCounts: { bbl: number; si: number; baduta: number; wus: number },
    utilizationRates: { id: number; value: number | null }[],
    materialIdsMap: {
      hb0Id: number
      bcgId: number
      polioId: number
      ipvId: number
      pcvId: number
      dptId: number
      mrId: number
      rotavirusId: number
      tdId: number
    }
  ) {
    const ipHB0 = Number(
      utilizationRates.find((r) => r.id === materialIdsMap.hb0Id)?.value ?? 0
    )
    const ipBCG = Number(
      utilizationRates.find((r) => r.id === materialIdsMap.bcgId)?.value ?? 0
    )
    const ipPolio = Number(
      utilizationRates.find((r) => r.id === materialIdsMap.polioId)?.value ?? 0
    )
    const ipIPV = Number(
      utilizationRates.find((r) => r.id === materialIdsMap.ipvId)?.value ?? 0
    )
    const ipPCV = Number(
      utilizationRates.find((r) => r.id === materialIdsMap.pcvId)?.value ?? 0
    )
    const ipDPT = Number(
      utilizationRates.find((r) => r.id === materialIdsMap.dptId)?.value ?? 0
    )
    const ipMR = Number(
      utilizationRates.find((r) => r.id === materialIdsMap.mrId)?.value ?? 0
    )
    const ipRotavirus = Number(
      utilizationRates.find((r) => r.id === materialIdsMap.rotavirusId)
        ?.value ?? 0
    )
    const ipTd = Number(
      utilizationRates.find((r) => r.id === materialIdsMap.tdId)?.value ?? 0
    )

    const vialNeedHB0 = calcVialNeedNoBuffer(targetCounts.bbl, ipHB0)
    const vialNeedBCG = calcVialNeedNoBuffer(targetCounts.bbl, ipBCG)
    const vialNeedPolio = calcVialNeed(
      targetCounts.si + targetCounts.baduta,
      ipPolio
    )
    const vialNeedIPV = calcVialNeed(targetCounts.si * 2, ipIPV)
    const vialNeedPCV = calcVialNeed(
      targetCounts.si * 2 + targetCounts.baduta,
      ipPCV
    )
    const vialNeedDPT = calcVialNeed(
      targetCounts.si * 3 + targetCounts.baduta,
      ipDPT
    )
    const vialNeedMR = calcVialNeed(targetCounts.si + targetCounts.baduta, ipMR)
    const vialNeedRotavirus = calcVialNeed(targetCounts.si * 3, ipRotavirus)
    const vialNeedTd = calcVialNeed(targetCounts.wus * 0.1, ipTd)

    return {
      vialNeedHB0,
      vialNeedBCG,
      vialNeedPolio,
      vialNeedIPV,
      vialNeedPCV,
      vialNeedDPT,
      vialNeedMR,
      vialNeedRotavirus,
      vialNeedTd,
      ipHB0,
      ipBCG,
      ipPolio,
      ipIPV,
      ipPCV,
      ipDPT,
      ipMR,
      ipRotavirus,
      ipTd,
    }
  }

  #getNonBiasMaterialIds(primaryMaterials: {
    codeToIdMap: Map<string, number>
  }) {
    const hb0Id = this.#findMaterialIdByCodeVariations(
      primaryMaterials.codeToIdMap,
      ["Hep B", "Hep B @1 ds", "VAKSIN HEPATITIS B", "VAKSIN HEPATITIS-B BAYI"]
    )
    const bcgId = this.#findMaterialIdByCodeVariations(
      primaryMaterials.codeToIdMap,
      [
        "BCG",
        "BCG @20 ds",
        "VAKSIN MYCOBACTERIUM BOVIS",
        "VAKSIN BCG BAYI IMPOR",
      ]
    )
    const polioId = this.#findMaterialIdByCodeVariations(
      primaryMaterials.codeToIdMap,
      [
        "Polio",
        "Polio @10 ds",
        "Polio @10 ds (1 to 4)",
        "VAKSIN POLIOMYELITIS",
        "VAKSIN POLIO / BOPV 10 DS",
      ]
    )
    const ipvId = this.#findMaterialIdByCodeVariations(
      primaryMaterials.codeToIdMap,
      ["IPV", "IPV @5 ds", "IPV @5 ds (1 to 2)", "VAKSIN IPV 5 DS"]
    )
    const pcvId = this.#findMaterialIdByCodeVariations(
      primaryMaterials.codeToIdMap,
      ["PCV MDV", "PCV MDV @4 ds", "PCV MDV @4 ds (Pfizer)"]
    )
    const dptId = this.#findMaterialIdByCodeVariations(
      primaryMaterials.codeToIdMap,
      [
        "DPT-HB-Hib",
        "DPT-HB-Hib @5 ds",
        "DPT-HB-Hib @5 ds (1 to 4)",
        "VAKSIN DTP HB HIB 5 DS",
      ]
    )
    const mrId = this.#findMaterialIdByCodeVariations(
      primaryMaterials.codeToIdMap,
      [
        "MR",
        "MR @10 ds",
        "MR 1 @10 ds and MR 2 @10 ds",
        "VAKSIN MEASLES RUBELLA (MR) 10 DS/ PARTNERSHIP",
      ]
    )
    const rotavirusId = this.#findMaterialIdByCodeVariations(
      primaryMaterials.codeToIdMap,
      [
        "ROTAVAC",
        "ROTAVIRUS",
        "ROTAVAC ROTAVIRUS @5 ds",
        "ROTAVAC ROTAVIRUS @5 ds (1 to 3)",
        "Vaksin Rotavac 5 Ds",
      ]
    )
    const tdId = this.#findMaterialIdByCodeVariations(
      primaryMaterials.codeToIdMap,
      ["Td", "Td @10 ds", "VAKSIN TD 10 DS"]
    )

    return {
      hb0Id,
      bcgId,
      polioId,
      ipvId,
      pcvId,
      dptId,
      mrId,
      rotavirusId,
      tdId,
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
    const ads005mlId = this.#findMaterialIdByCodeVariations(
      logisticMaterials.codeToIdMap,
      ["ADS 0.05 ml", "ADS 0,05 ml", "ADS 0.05 ML", "ADS 0,05 ML"]
    )
    const sb25lId = this.#findMaterialIdByCodeVariations(
      logisticMaterials.codeToIdMap,
      ["SB 2.5 ltr", "SB 2.5 Ltr", "SB 2,5 ltr", "SB 2,5 Ltr", "SB 2.5 liter"]
    )
    const sb5lId = this.#findMaterialIdByCodeVariations(
      logisticMaterials.codeToIdMap,
      ["SB 5 ltr", "SB 5 Ltr", "SB 5 liter"]
    )

    return {
      ads5mlId,
      ads05mlId,
      ads005mlId,
      sb25lId,
      sb5lId,
    }
  }

  #buildProjectedYearlyNeeds(
    vialNeeds: {
      vialNeedHB0: number
      vialNeedBCG: number
      vialNeedPolio: number
      vialNeedIPV: number
      vialNeedPCV: number
      vialNeedDPT: number
      vialNeedMR: number
      vialNeedRotavirus: number
      vialNeedTd: number
    },
    biasMaterialIds: number[],
    biasMaterialNameMap: Map<number, string>,
    materialIdsMap: {
      hb0Id: number
      bcgId: number
      polioId: number
      ipvId: number
      pcvId: number
      dptId: number
      mrId: number
      rotavirusId: number
      tdId: number
    }
  ) {
    return biasMaterialIds.map((materialId) => {
      let vialNeedValue = 0

      if (materialId === materialIdsMap.hb0Id) {
        vialNeedValue = vialNeeds.vialNeedHB0
      } else if (materialId === materialIdsMap.bcgId) {
        vialNeedValue = vialNeeds.vialNeedBCG
      } else if (materialId === materialIdsMap.polioId) {
        vialNeedValue = vialNeeds.vialNeedPolio
      } else if (materialId === materialIdsMap.ipvId) {
        vialNeedValue = vialNeeds.vialNeedIPV
      } else if (materialId === materialIdsMap.pcvId) {
        vialNeedValue = vialNeeds.vialNeedPCV
      } else if (materialId === materialIdsMap.dptId) {
        vialNeedValue = vialNeeds.vialNeedDPT
      } else if (materialId === materialIdsMap.mrId) {
        vialNeedValue = vialNeeds.vialNeedMR
      } else if (materialId === materialIdsMap.rotavirusId) {
        vialNeedValue = vialNeeds.vialNeedRotavirus
      } else if (materialId === materialIdsMap.tdId) {
        vialNeedValue = vialNeeds.vialNeedTd
      }

      return {
        id: materialId,
        name: biasMaterialNameMap.get(materialId) ?? "Unknown",
        value: vialNeedValue,
      }
    })
  }

  #buildProjectedMonthlyNeeds(
    projected1Year: { id: number; name: string; value: number }[],
    stockData: Map<number, number>
  ) {
    return projected1Year.map((item) => {
      const monthly = item.value / 12
      const minStock = Math.ceil(monthly * 0.25)
      const maxStock = Math.ceil(monthly * 1.25)
      const availableStock = stockData.get(item.id) ?? 0
      const requestQty = maxStock - availableStock

      return {
        id: item.id,
        name: item.name,
        min_stock: minStock,
        max_stock: maxStock,
        available_stock: availableStock,
        request_qty: requestQty,
      }
    })
  }

  #buildLogisticsNeeds(
    vialNeeds: {
      vialNeedBCG: number
      vialNeedMR: number
      vialNeedIPV: number
      vialNeedPCV: number
      vialNeedDPT: number
      vialNeedTd: number
      ipBCG: number
      ipIPV: number
      ipPCV: number
      ipDPT: number
      ipMR: number
      ipTd: number
    },
    logisticMaterialIds: number[],
    logisticMaterialNameMap: Map<number, string>,
    logisticIdsMap: {
      ads5mlId: number
      ads05mlId: number
      ads005mlId: number
      sb25lId: number
      sb5lId: number
    },
    logisticsStockMap: Map<number, number>
  ) {
    const adsYearly5ML = Math.round(
      vialNeeds.vialNeedBCG + vialNeeds.vialNeedMR
    )
    const adsYearly05ML = Math.round(
      vialNeeds.vialNeedIPV * vialNeeds.ipIPV +
        vialNeeds.vialNeedPCV * vialNeeds.ipPCV +
        vialNeeds.vialNeedDPT * vialNeeds.ipDPT +
        vialNeeds.vialNeedMR * vialNeeds.ipMR +
        vialNeeds.vialNeedTd * vialNeeds.ipTd
    )
    const adsYearly005ML = Math.round(vialNeeds.vialNeedBCG * vialNeeds.ipBCG)
    const sbYearly25LTR = Math.round(
      (adsYearly5ML + adsYearly05ML + adsYearly005ML) / PERCENTAGE_50
    )
    const sbYearly5LTR = Math.round(
      (adsYearly5ML + adsYearly05ML + adsYearly005ML) / PERCENTAGE_100
    )

    const projectedYearlyLogistics = logisticMaterialIds.map((materialId) => {
      let logisticValue = 0

      if (materialId === logisticIdsMap.ads5mlId) {
        logisticValue = adsYearly5ML
      } else if (materialId === logisticIdsMap.ads05mlId) {
        logisticValue = adsYearly05ML
      } else if (materialId === logisticIdsMap.ads005mlId) {
        logisticValue = adsYearly005ML
      } else if (materialId === logisticIdsMap.sb25lId) {
        logisticValue = sbYearly25LTR
      } else if (materialId === logisticIdsMap.sb5lId) {
        logisticValue = sbYearly5LTR
      }

      return {
        id: materialId,
        name: logisticMaterialNameMap.get(materialId) ?? "Unknown",
        value: logisticValue,
      }
    })

    const projectedMonthlyLogistics = projectedYearlyLogistics.map((item) => {
      const calcBasedOnVaccine = Math.round((item.value / 12) * 1.25) + 1
      const availableStock = logisticsStockMap.get(item.id) ?? 0
      const requestQty = calcBasedOnVaccine - availableStock

      return {
        id: item.id,
        name: item.name,
        calculation_based_on_vaccine_needs: calcBasedOnVaccine,
        available_stock: availableStock,
        request_qty: requestQty,
      }
    })

    return { projectedYearlyLogistics, projectedMonthlyLogistics }
  }

  #buildResponse(
    locationData: {
      villageId: number
      villageName: string
      puskesmasId: number
      puskesmasName: string
    },
    vaccineData: {
      absoluteImmunization: { id: number; name: string; value: number | null }[]
      targets: { id: number; name: string; value: number }[]
      vialsUsed: { id: number; name: string; value: number | null }[]
      utilizationRate: { id: number; name: string; value: number | null }[]
    },
    projectedVaccineNeeds: {
      yearly: { id: number; name: string; value: number }[]
      monthly: any[]
    },
    projectedLogisticsNeeds: {
      yearly: any[]
      monthly: any[]
    }
  ): SaveVillageImmunizationDataResponse {
    return {
      village_id: locationData.villageId,
      village_name: locationData.villageName,
      puskesmas_id: locationData.puskesmasId,
      puskesmas_name: locationData.puskesmasName,
      absolute_immunization: {
        title: "Absolute Number of Routine Immunization (Previous Year)",
        name_label: "Material Name",
        value_label: "Number Of Doses",
        items: vaccineData.absoluteImmunization,
      },
      number_of_target: {
        title: "Number of Target",
        name_label: "Target",
        value_label: "Target Value",
        items: vaccineData.targets,
      },
      vaccine_vials_used: {
        title: "Number of Vaccine Vials Used (Previous Year)",
        name_label: "Material Name",
        value_label: "Number Of Doses",
        items: vaccineData.vialsUsed,
      },
      vaccine_utilization_rate: {
        title: "Vaccine Utilization Rate (IP)",
        name_label: "Material Name",
        value_label: "Number Of Doses",
        items: vaccineData.utilizationRate,
      },
      projected_yearly_needs: {
        title: "Projected 1-Year Vaccine Needs",
        name_label: "Material Name",
        value_label: "Number Of Doses",
        items: projectedVaccineNeeds.yearly,
      },
      projected_monthly_vaccine_needs: {
        title: "Projected Monthly Vaccine Needs",
        name_label: "Material Name",
        value_label: "Number Of Doses",
        items: projectedVaccineNeeds.monthly,
      },
      projected_yearly_immunization_logistics_needs: {
        title: "Projected Yearly Immunization Logistics Needs",
        name_label: "Material Name",
        value_label: "Number Of Doses",
        items: projectedLogisticsNeeds.yearly,
      },
      projected_monthly_immunization_logistics_needs: {
        title: "Projected Monthly Immunization Logistics Needs",
        name_label: "Material Name",
        value_label: "Number Of Doses",
        items: projectedLogisticsNeeds.monthly,
      },
    }
  }

  async getCalculateDetail(
    c: Context,
    query: NonBiasCalculateDetailQueryDTO
  ): Promise<NonBiasCalculateDetailResponse> {
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

    const [counts, location, existingData, biasMaterials, logisticMaterials] =
      await Promise.all([
        this.nonBiasRepo.getTargetCountsByVillageId(
          c,
          query.village_id,
          VILLAGE_TARGET_GROUPS,
          microplanningId
        ),
        this.nonBiasRepo.getLocationName(c, query.village_id),
        this.logisticsRepo.getExistingMaterialNeeds(
          c,
          query.village_id,
          "village",
          microplanningId
        ),
        this.materialRepo.findMaterialsFromTargets(c, "primary", "non_bias"),
        this.materialRepo.findMaterialsFromTargets(c, "additional", "non_bias"),
      ])

    const biasMaterialNameMap = new Map<number, string>()
    biasMaterials.forEach((m) => {
      biasMaterialNameMap.set(m.material_id, m.name)
    })

    const biasMaterialIds = biasMaterials.map((m) => m.material_id)

    const logisticMaterialNameMap = new Map<number, string>()
    logisticMaterials.forEach((m) => {
      logisticMaterialNameMap.set(m.material_id, m.name)
    })
    const logisticMaterialIds = logisticMaterials.map((m) => m.material_id)

    const countMap = new Map(
      counts
        .filter((item) => item.target_group_id !== null)
        .map((item) => [item.target_group_id as number, Number(item.count)])
    )
    const targetCounts = this.#extractVillageTargets(countMap)
    const targets = this.#buildTargetItems(targetCounts)

    const existingDataMap = new Map(
      existingData.map((item) => [item.material_id, item])
    )

    const hasTotalNeeds = existingData.some(
      (item) => item.total_needs !== null && Number(item.total_needs) > 0
    )

    const transactionQtyMap = new Map<number, number>()
    if (!hasTotalNeeds) {
      const transactionData =
        await this.logisticsRepo.getTransactionQtyByEntity(c, entityId)

      transactionData.forEach((item) => {
        if (item.material_id) {
          transactionQtyMap.set(item.material_id, Number(item.qty) || 0)
        }
      })
    }

    const immunizations = biasMaterialIds.map((materialId) => {
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
        name: biasMaterialNameMap.get(materialId) ?? "Unknown",
        value: value,
      }
    })

    const vialsUsed = biasMaterialIds.map((materialId) => {
      const existing = existingDataMap.get(materialId)
      return {
        id: materialId,
        name: biasMaterialNameMap.get(materialId) ?? "Unknown",
        value: existing?.number_of_vials_used ?? null,
      }
    })

    const utilizationRate = biasMaterialIds.map((materialId) => {
      const existing = existingDataMap.get(materialId)
      return {
        id: materialId,
        name: biasMaterialNameMap.get(materialId) ?? "Unknown",
        value: existing?.vaccine_utilization_rate ?? null,
      }
    })

    const vialNeeds = biasMaterialIds.map((materialId) => {
      const existing = existingDataMap.get(materialId)
      return {
        id: materialId,
        name: biasMaterialNameMap.get(materialId) ?? "Unknown",
        value: existing?.total_needs ?? null,
      }
    })

    const projectedMonthly = biasMaterialIds.map((materialId) => {
      const existing = existingDataMap.get(materialId)
      return {
        id: materialId,
        name: biasMaterialNameMap.get(materialId) ?? "Unknown",
        min_stock: existing?.min_stock ?? null,
        max_stock: existing?.max_stock ?? null,
        available_stock: existing?.detail_remaining_stock ?? null,
        request_qty: existing?.request_qty ?? null,
      }
    })

    const yearlyLogisticsNeeds = logisticMaterialIds.map((materialId) => {
      const existing = existingDataMap.get(materialId)
      return {
        id: materialId,
        name: logisticMaterialNameMap.get(materialId) ?? "Unknown",
        value: existing?.total_needs ?? null,
      }
    })

    const monthlyLogisticsNeeds = logisticMaterialIds.map((materialId) => {
      const existing = existingDataMap.get(materialId)
      let request_qty: number | null = null

      if (
        existing?.additional_total != null &&
        existing?.additional_remaining_stock != null
      ) {
        request_qty =
          existing.additional_total - existing.additional_remaining_stock
      }
      return {
        id: materialId,
        name: logisticMaterialNameMap.get(materialId) ?? "Unknown",
        calculation_based_on_vaccine_needs: existing?.additional_total ?? null,
        available_stock: existing?.additional_remaining_stock ?? null,
        request_qty: request_qty ?? null,
      }
    })

    return {
      village_id: query.village_id,
      village_name: VILLAGE_LABEL + " " + location?.name || "Unknown Village",
      puskesmas_id: c.var.userEntity?.global_id,
      puskesmas_name: c.var.userEntity?.name ?? "",
      absolute_immunization: {
        title: "Absolute Number of Routine Immunization (Previous Year)",
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
        title: "Number of Vaccine Vials Used (Previous Year)",
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
      projected_yearly_needs: {
        title: "Projected 1-Year Vaccine Needs",
        name_label: "Material Name",
        value_label: "Number Of Doses",
        items: vialNeeds,
      },
      projected_monthly_vaccine_needs: {
        title: "Projected Monthly Vaccine Needs",
        name_label: "Material Name",
        value_label: "Number Of Doses",
        items: projectedMonthly,
      },
      projected_yearly_immunization_logistics_needs: {
        title: "Projected Yearly Immunization Logistics Needs",
        name_label: "Material Name",
        value_label: "Number Of Doses",
        items: yearlyLogisticsNeeds,
      },
      projected_monthly_immunization_logistics_needs: {
        title: "Projected Monthly Immunization Logistics Needs",
        name_label: "Material Name",
        value_label: "Number Of Doses",
        items: monthlyLogisticsNeeds,
      },
    }
  }

  async saveVillageImmunizationData(
    c: Context,
    body: SaveVillageImmunizationAchievementDTO
  ): Promise<SaveVillageImmunizationDataResponse> {
    const [primaryMaterials, logisticMaterials] = await Promise.all([
      this.#getMaterialIds(c, "primary", "non_bias"),
      this.#getMaterialIds(c, "additional", "non_bias"),
    ])

    const {
      hb0Id,
      bcgId,
      polioId,
      ipvId,
      pcvId,
      dptId,
      mrId,
      rotavirusId,
      tdId,
    } = this.#getNonBiasMaterialIds(primaryMaterials)

    const materialIdsMap = {
      hb0Id,
      bcgId,
      polioId,
      ipvId,
      pcvId,
      dptId,
      mrId,
      rotavirusId,
      tdId,
    }

    const materialIds = Object.keys(body.items).map((id) => parseInt(id))
    const commonData = await this.#fetchCommonData(
      c,
      body.village_id,
      materialIds
    )

    const materialMap = new Map(commonData.materials.map((m) => [m.id, m]))

    const stockData = await this.stockRepo.getStocksByEntityAndMaterials(
      c,
      commonData.entityId,
      primaryMaterials.materialIds
    )

    const stockMap = new Map(
      stockData
        .filter((s) => s.material_id !== null)
        .map((s) => [s.material_id as number, Number(s.total_qty)])
    )

    const absoluteImmunization = primaryMaterials.materialIds.map(
      (materialId) => ({
        id: materialId,
        name: primaryMaterials.idToNameMap.get(materialId) ?? "Unknown",
        value: body.items[materialId] ?? 0,
      })
    )

    const targets = this.#buildTargetItems(commonData.targetCounts)

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
      const rate =
        vialUsed > 0 ? Math.round(safeDiv(absolute, vialUsed) * 10) / 10 : 0

      return {
        id: materialId,
        name: primaryMaterials.idToNameMap.get(materialId) ?? "Unknown",
        value: rate,
      }
    })

    const vialNeedsCalculated = this.#calculateVialNeeds(
      commonData.targetCounts,
      utilizationRate,
      materialIdsMap
    )

    const projected1Year = this.#buildProjectedYearlyNeeds(
      vialNeedsCalculated,
      primaryMaterials.materialIds,
      primaryMaterials.idToNameMap,
      materialIdsMap
    )

    const projectedMonthly = this.#buildProjectedMonthlyNeeds(
      projected1Year,
      stockMap
    )

    const { ads5mlId, ads05mlId, ads005mlId, sb25lId, sb5lId } =
      this.#getLogisticsIds(logisticMaterials)

    const logisticIdsMap = {
      ads5mlId,
      ads05mlId,
      ads005mlId,
      sb25lId,
      sb5lId,
    }

    const logisticsStockData =
      await this.stockRepo.getStocksByEntityAndMaterials(
        c,
        commonData.entityId,
        logisticMaterials.materialIds
      )

    const logisticsStockMap = new Map(
      logisticsStockData
        .filter((s) => s.material_id !== null)
        .map((s) => [s.material_id as number, Number(s.total_qty)])
    )

    const { projectedYearlyLogistics, projectedMonthlyLogistics } =
      this.#buildLogisticsNeeds(
        vialNeedsCalculated,
        logisticMaterials.materialIds,
        logisticMaterials.idToNameMap,
        logisticIdsMap,
        logisticsStockMap
      )

    return this.#buildResponse(
      {
        villageId: body.village_id,
        villageName: commonData.villageName,
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
        yearly: projected1Year,
        monthly: projectedMonthly,
      },
      {
        yearly: projectedYearlyLogistics,
        monthly: projectedMonthlyLogistics,
      }
    )
  }

  async recalculateVillageEstimation(
    c: Context,
    body: RecalculateVillageEstimationDTO
  ): Promise<RecalculateVillageEstimationResponse> {
    const [primaryMaterials, logisticMaterials] = await Promise.all([
      this.#getMaterialIds(c, "primary", "non_bias"),
      this.#getMaterialIds(c, "additional", "non_bias"),
    ])

    const {
      hb0Id,
      bcgId,
      polioId,
      ipvId,
      pcvId,
      dptId,
      mrId,
      rotavirusId,
      tdId,
    } = this.#getNonBiasMaterialIds(primaryMaterials)

    const materialIdsMap = {
      hb0Id,
      bcgId,
      polioId,
      ipvId,
      pcvId,
      dptId,
      mrId,
      rotavirusId,
      tdId,
    }

    const materialIds = Object.keys(body.items).map((id) => parseInt(id))
    const commonData = await this.#fetchCommonData(
      c,
      body.village_id,
      materialIds
    )

    const stockData = await this.stockRepo.getStocksByEntityAndMaterials(
      c,
      commonData.entityId,
      primaryMaterials.materialIds
    )
    const stockMap = new Map(
      stockData
        .filter((s) => s.material_id !== null)
        .map((s) => [s.material_id as number, Number(s.total_qty)])
    )

    const absoluteImmunization = primaryMaterials.materialIds.map(
      (materialId) => ({
        id: materialId,
        name: primaryMaterials.idToNameMap.get(materialId) ?? "Unknown",
        value: body.items[materialId] ?? 0,
      })
    )

    const targets = this.#buildTargetItems(commonData.targetCounts)

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
      commonData.targetCounts,
      utilizationRate,
      materialIdsMap
    )
    const projected1Year = this.#buildProjectedYearlyNeeds(
      vialNeedsCalculated,
      primaryMaterials.materialIds,
      primaryMaterials.idToNameMap,
      materialIdsMap
    )
    const projectedMonthly = this.#buildProjectedMonthlyNeeds(
      projected1Year,
      stockMap
    )

    const { ads5mlId, ads05mlId, ads005mlId, sb25lId, sb5lId } =
      this.#getLogisticsIds(logisticMaterials)

    const logisticIdsMap = {
      ads5mlId,
      ads05mlId,
      ads005mlId,
      sb25lId,
      sb5lId,
    }

    const logisticsStockData =
      await this.stockRepo.getStocksByEntityAndMaterials(
        c,
        commonData.entityId,
        logisticMaterials.materialIds
      )

    const logisticsStockMap = new Map(
      logisticsStockData
        .filter((s) => s.material_id !== null)
        .map((s) => [s.material_id as number, Number(s.total_qty)])
    )

    const { projectedYearlyLogistics, projectedMonthlyLogistics } =
      this.#buildLogisticsNeeds(
        vialNeedsCalculated,
        logisticMaterials.materialIds,
        logisticMaterials.idToNameMap,
        logisticIdsMap,
        logisticsStockMap
      )

    return this.#buildResponse(
      {
        villageId: body.village_id,
        villageName: commonData.villageName,
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
        yearly: projected1Year,
        monthly: projectedMonthly,
      },
      {
        yearly: projectedYearlyLogistics,
        monthly: projectedMonthlyLogistics,
      }
    )
  }

  async saveNonBiasImmunizationLogistics(
    c: Context,
    body: SaveVillageImmunizationDataResponse
  ) {
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

    const primaryMaterialIds = body.projected_monthly_vaccine_needs.items.map(
      (item) => item.id
    )

    const additionalMaterialIds =
      body.projected_monthly_immunization_logistics_needs.items.map(
        (item) => item.id
      )

    const [primaryTargets, additionalTargets] = await Promise.all([
      this.materialTargetsRepo.getMaterialTargetsByMaterialIds(
        c,
        primaryMaterialIds,
        "non_bias",
        "primary"
      ),
      this.materialTargetsRepo.getMaterialTargetsByMaterialIds(
        c,
        additionalMaterialIds,
        "non_bias",
        "additional"
      ),
    ])

    const primaryTargetMap = new Map(
      primaryTargets.map((t) => [t.material_id, t.id])
    )
    const additionalTargetMap = new Map(
      additionalTargets.map((t) => [t.material_id, t.id])
    )

    const allTargetIds = [
      ...primaryTargets.map((t) => t.id),
      ...additionalTargets.map((t) => t.id),
    ]

    const existingData = await this.logisticsRepo.checkExistingData(
      c,
      body.village_id,
      "village",
      microplanningId,
      allTargetIds
    )

    if (existingData.length > 0) {
      throw new ValidationError(
        `Data for village_id ${body.village_id} and microplanning_id ${microplanningId} already exists.`
      )
    }

    const missingPrimaryTargets = primaryMaterialIds.filter(
      (id) => !primaryTargetMap.has(id)
    )
    if (missingPrimaryTargets.length > 0) {
      throw new ValidationError(
        `Material targets not found for primary material IDs: ${missingPrimaryTargets.join(", ")}.`
      )
    }

    const missingAdditionalTargets = additionalMaterialIds.filter(
      (id) => !additionalTargetMap.has(id)
    )
    if (missingAdditionalTargets.length > 0) {
      throw new ValidationError(
        `Material targets not found for additional material IDs: ${missingAdditionalTargets.join(", ")}.`
      )
    }

    for (const item of body.projected_monthly_vaccine_needs.items) {
      const materialTargetId = primaryTargetMap.get(item.id)
      if (!materialTargetId) {
        continue
      }

      const materialNeed = await this.logisticsRepo.saveMaterialNeed(c, {
        material_target_id: materialTargetId,
        microplanning_id: microplanningId,
        reference_id: body.village_id,
        reference_type: "village",
        total_needs: Math.round(
          body.projected_yearly_needs.items.find((i) => i.id === item.id)
            ?.value ?? 0
        ),
      })

      await this.logisticsRepo.saveMaterialNeedDetail(c, {
        material_need_id: materialNeed.id,
        absolute_number_of_routine_immunization: Math.round(
          body.absolute_immunization.items.find((i) => i.id === item.id)
            ?.value ?? 0
        ),
        number_of_vials_used: Math.round(
          body.vaccine_vials_used.items.find((i) => i.id === item.id)?.value ??
            0
        ),
        remaining_stock: item.available_stock,
      })

      await this.logisticsRepo.saveMonthlyVaccineNeedDetail(c, {
        material_need_id: materialNeed.id,
        min_stock: item.min_stock,
        max_stock: item.max_stock,
        request_qty: item.request_qty,
      })

      const utilizationRateValue =
        body.vaccine_utilization_rate.items.find((i) => i.id === item.id)
          ?.value ?? null
      if (utilizationRateValue !== null) {
        await this.logisticsRepo.saveVaccineUtilizationRate(c, {
          material_need_id: materialNeed.id,
          vaccine_utilization_rate: utilizationRateValue,
        })
      }
    }

    for (const item of body.projected_monthly_immunization_logistics_needs
      .items) {
      const materialTargetId = additionalTargetMap.get(item.id)
      if (!materialTargetId) {
        continue
      }

      const materialNeed = await this.logisticsRepo.saveMaterialNeed(c, {
        material_target_id: materialTargetId,
        microplanning_id: microplanningId,
        reference_id: body.village_id,
        reference_type: "village",
        total_needs: Math.round(
          body.projected_yearly_immunization_logistics_needs.items.find(
            (i) => i.id === item.id
          )?.value ?? 0
        ),
      })

      await this.logisticsRepo.saveAdditionalNeed(c, {
        material_need_id: materialNeed.id,
        material_target_id: materialTargetId,
        remaining_stock: item.available_stock,
        total: item.calculation_based_on_vaccine_needs,
      })
    }

    return {
      success: true,
      message: "Non-bias immunization logistics data saved successfully",
    }
  }

  async getDataChecker(
    c: Context,
    subDistrictId: number,
    keyword?: string
  ): Promise<VillageListResponse> {
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

    const rawData =
      await this.logisticsRepo.getVillagesBySubDistrictWithMaterialNeeds(
        c,
        subDistrictId,
        microplanningId,
        keyword
      )

    let dataCount = 0
    const entities = rawData.map((village) => {
      const hasData = village.material_need_id !== null
      if (hasData) dataCount++

      return {
        id: village.village_id,
        name: VILLAGE_LABEL + ` ${(village.village_name ?? "").toUpperCase()}`,
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

  async updateNonBiasImmunizationLogistics(
    c: Context,
    villageId: number,
    body: UpdateNonBiasImmunizationLogisticsDTO
  ) {
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

    const primaryMaterialIds = body.projected_monthly_vaccine_needs.items.map(
      (item) => item.id
    )

    const additionalMaterialIds =
      body.projected_monthly_immunization_logistics_needs.items.map(
        (item) => item.id
      )

    const [primaryTargets, additionalTargets] = await Promise.all([
      this.materialTargetsRepo.getMaterialTargetsByMaterialIds(
        c,
        primaryMaterialIds,
        "non_bias",
        "primary"
      ),
      this.materialTargetsRepo.getMaterialTargetsByMaterialIds(
        c,
        additionalMaterialIds,
        "non_bias",
        "additional"
      ),
    ])

    const primaryTargetMap = new Map(
      primaryTargets.map((t) => [t.material_id, t.id])
    )
    const additionalTargetMap = new Map(
      additionalTargets.map((t) => [t.material_id, t.id])
    )

    const allTargetIds = [
      ...primaryTargets.map((t) => t.id),
      ...additionalTargets.map((t) => t.id),
    ]

    const existingData = await this.logisticsRepo.checkExistingData(
      c,
      villageId,
      "village",
      microplanningId,
      allTargetIds
    )

    if (existingData.length === 0) {
      throw new ValidationError(
        `No existing data found for village_id ${villageId} and year ${nextYear}.`
      )
    }

    const existingDataMap = new Map(
      existingData.map((item) => [item.material_target_id, item.id])
    )

    for (const item of body.projected_monthly_vaccine_needs.items) {
      const materialTargetId = primaryTargetMap.get(item.id)
      if (!materialTargetId) {
        continue
      }

      const materialNeedId = existingDataMap.get(materialTargetId)
      if (!materialNeedId) {
        continue
      }

      await this.logisticsRepo.updateMaterialNeed(
        c,
        materialNeedId,
        Math.round(
          body.projected_yearly_needs.items.find((i) => i.id === item.id)
            ?.value ?? 0
        )
      )

      await this.logisticsRepo.updateMaterialNeedDetail(c, materialNeedId, {
        absolute_number_of_routine_immunization: Math.round(
          body.absolute_immunization.items.find((i) => i.id === item.id)
            ?.value ?? 0
        ),
        number_of_vials_used: Math.round(
          body.vaccine_vials_used.items.find((i) => i.id === item.id)?.value ??
            0
        ),
        remaining_stock: item.available_stock,
      })

      await this.logisticsRepo.updateMonthlyVaccineNeedDetail(
        c,
        materialNeedId,
        {
          min_stock: item.min_stock,
          max_stock: item.max_stock,
          request_qty: item.request_qty,
        }
      )

      const utilizationRateValue =
        body.vaccine_utilization_rate.items.find((i) => i.id === item.id)
          ?.value ?? null
      if (utilizationRateValue !== null) {
        await this.logisticsRepo.updateVaccineUtilizationRate(
          c,
          materialNeedId,
          utilizationRateValue
        )
      }
    }

    for (const item of body.projected_monthly_immunization_logistics_needs
      .items) {
      const materialTargetId = additionalTargetMap.get(item.id)
      if (!materialTargetId) {
        continue
      }

      const materialNeedId = existingDataMap.get(materialTargetId)
      if (!materialNeedId) {
        continue
      }

      await this.logisticsRepo.updateMaterialNeed(
        c,
        materialNeedId,
        Math.round(
          body.projected_yearly_immunization_logistics_needs.items.find(
            (i) => i.id === item.id
          )?.value ?? 0
        )
      )

      await this.logisticsRepo.updateAdditionalNeed(c, materialNeedId, {
        remaining_stock: item.available_stock,
        total: item.calculation_based_on_vaccine_needs,
      })
    }

    return {
      success: true,
      message: "Non-bias immunization logistics data updated successfully",
    }
  }
}
