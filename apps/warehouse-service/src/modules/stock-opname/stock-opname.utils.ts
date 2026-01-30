import { round } from "@smile-health/lib/utils.js"
import {
  StockOpnameComplianceItemDTO,
  StockOpnameResultItemDTO,
  StockOpnameMaterialItemDTO,
  MaterialItem,
  StockOpnameComplianceSummaryResponse,
  StockOpnameComplianceResponse,
  StockOpnameResultSummaryResponse,
  StockOpnameResultResponse,
  StockOpnameMaterialResponse,
} from "./stock-opname.schema.js"
import { Context } from "hono"
import {
  MaterialDTO,
  SoMaterialDenomItemDTO,
} from "../material/material.schema.js"
import { Column, Filter } from "@smile-health/lib/excel/types.js"
import { ExcelExportOption } from "@/common/types/excel.js"
import { LocationItemDTO } from "../location/location.schema.js"

export function getTotalSoSummary<T>(
  soSummaryData: T[],
  property: string
): number {
  const totalQty =
    soSummaryData && soSummaryData.length > 0
      ? soSummaryData
          .map((item) => item[property] as number)
          .reduce((prev, next) => prev + next, 0)
      : 0

  return totalQty
}

export function buildSoComplianceResponseData(
  c: Context,
  stockOpnameCompliance: StockOpnameComplianceItemDTO | undefined,
  totalStockOpnameCompliance: StockOpnameComplianceItemDTO | undefined,
  location: Omit<LocationItemDTO, "type">,
  index: number
) {
  const entityTotal = totalStockOpnameCompliance
    ? totalStockOpnameCompliance.count
    : 0
  const done = stockOpnameCompliance ? stockOpnameCompliance.count : 0
  const notYet = Math.abs(entityTotal - done)
  const donePercentage = entityTotal ? round((done / entityTotal) * 100) : 0
  const notYetPercentage = entityTotal ? round((notYet / entityTotal) * 100) : 0

  return {
    row: index + 1,
    entity: {
      id: location.id,
      name: location.name,
    },
    province_name: location.province_name,
    regency_name: location.regency_name,
    entity_tag_name: c.var.t(`entity_tag.label.${location.entity_tag_name}`),
    entity_total: entityTotal,
    done,
    not_yet: notYet,
    entity_total_percentage: 100,
    done_percentage: donePercentage,
    not_yet_percentage: notYetPercentage,
  }
}

export function buildSoResultResponseData(
  c: Context,
  resultStockOpname: StockOpnameResultItemDTO | undefined,
  index: number
) {
  return {
    row: index + 1,
    entity: {
      id: resultStockOpname?.location_id ?? 0,
      name: resultStockOpname?.entity_name ?? "",
    },
    province_name: resultStockOpname?.province_name ?? "",
    regency_name: resultStockOpname?.regency_name ?? "",
    entity_tag_name:
      c.var.t(`entity_tag.label.${resultStockOpname?.entity_tag_name}`) ?? "",
    stock: resultStockOpname?.stock ?? 0,
    exp_stock: resultStockOpname?.exp_stock ?? 0,
    stock_in_transit: resultStockOpname?.stock_in_transit ?? 0,
    real_stock: resultStockOpname?.real_stock ?? 0,
    difference: resultStockOpname?.difference ?? 0,
    difference_percentage: round(resultStockOpname?.difference_percentage ?? 0),
  }
}

export function setValueSOMaterial(
  dataSO: Record<string, StockOpnameMaterialItemDTO> | undefined,
  materialId: number,
  keyValue: "smile_qty" | "real_qty"
): number | "-" {
  if (!dataSO) return "-"
  if (!dataSO[materialId]) return "-"
  return dataSO[materialId][keyValue]
}

export function buildSoMaterialResponseData(
  c: Context,
  stockOpnameMaterialData: Record<string, StockOpnameMaterialItemDTO>,
  materials: MaterialDTO,
  materialDenom: SoMaterialDenomItemDTO | undefined,
  location: Omit<LocationItemDTO, "type">,
  index: number
) {
  let soEntityMaterialNumerator = 0
  const soEntityMaterials: MaterialItem[] = []

  materials.forEach((material) => {
    const smile_stock = setValueSOMaterial(
      stockOpnameMaterialData,
      material.id,
      "smile_qty"
    )
    const real_stock = setValueSOMaterial(
      stockOpnameMaterialData,
      material.id,
      "real_qty"
    )

    if (
      material.is_stock_opname_mandatory &&
      smile_stock !== "-" &&
      real_stock !== "-"
    ) {
      soEntityMaterialNumerator += 1
    }

    soEntityMaterials.push({
      id: material.id,
      name: material.name,
      smile_stock,
      real_stock,
      is_different: smile_stock !== real_stock,
    })
  })

  return {
    row: index + 1,
    entity: {
      id: location.id,
      name: location.name,
    },
    province_name: location?.province_name ?? "",
    regency_name: location?.regency_name ?? "",
    entity_tag_name:
      c.var.t(`entity_tag.label.${location?.entity_tag_name}`) ?? "",
    materials: soEntityMaterials,
    opname_recap: `${soEntityMaterialNumerator} / ${materialDenom?.total_material_denom ?? 0}`,
  }
}

export function buildSoComplianceExportOptions(
  c: Context,
  filters: Filter[],
  stockOpnameComplianceSummary: StockOpnameComplianceSummaryResponse,
  stockOpnameCompliance: StockOpnameComplianceResponse
) {
  const mainColumns: Column[] = [
    {
      key: "entity_tag",
      header: c.var.t("common.entity_tag"),
      width: 20,
    },
    {
      key: "not_yet",
      header: c.var.t("stock_opname.label.not_yet"),
      width: 20,
    },
    {
      key: "not_yet_percentage",
      header: `% ${c.var.t("stock_opname.label.not_yet")}`,
      width: 20,
    },
    {
      key: "done",
      header: c.var.t("stock_opname.label.done"),
      width: 20,
    },
    {
      key: "done_percentage",
      header: `% ${c.var.t("stock_opname.label.done")}`,
      width: 20,
    },
    {
      key: "entity_total",
      header: c.var.t("stock_opname.label.entity_total"),
      width: 20,
    },
  ]

  const summaryColumns: Column[] = [
    { key: "no", header: "No.", width: 20 },
    ...mainColumns,
  ]

  const summaryData = stockOpnameComplianceSummary.data.map((item, index) => {
    return {
      no: index + 1,
      ...item,
      entity_tag: item.entity_tag.name,
    }
  })

  const summaryOption: ExcelExportOption = {
    sheetName: c.var.t("common.summary"),
    titleBar: `${c.var.t("common.summary")} ${c.var.t("stock_opname.sheet.title.compliance")}`,
    filters,
    columns: summaryColumns,
    data: summaryData,
  }

  const columns: Column[] = [
    { key: "no", header: "No.", width: 20 },
    {
      key: "province",
      header: c.var.t("common.province"),
      width: 20,
    },
    {
      key: "regency",
      header: c.var.t("common.regency"),
      width: 20,
    },
    {
      key: "entity_id",
      header: c.var.t("common.entity_id"),
      width: 20,
    },
    {
      key: "entity",
      header: c.var.t("common.entity"),
      width: 20,
    },
    ...mainColumns,
  ]

  const data = stockOpnameCompliance.data.map((item, index) => {
    return {
      no: index + 1,
      ...item,
      entity_tag: item.entity_tag_name,
      entity_id: item.entity.id,
      entity: item.entity.name,
      province: item.province_name,
      regency: item.regency_name,
    }
  })

  const option: ExcelExportOption = {
    sheetName: c.var.t("common.data_table"),
    titleBar: `${c.var.t("common.data_table")} ${c.var.t("stock_opname.sheet.title.compliance")}`,
    filters,
    columns: columns,
    data: data,
  }

  return [summaryOption, option]
}

export function buildSoResultExportOptions(
  c: Context,
  filters,
  stockOpnameResultSummary: StockOpnameResultSummaryResponse,
  stockOpnameResult: StockOpnameResultResponse
) {
  const mainColumns: Column[] = [
    {
      key: "entity_tag",
      header: c.var.t("common.entity_tag"),
      width: 20,
    },
    {
      key: "stock",
      header: c.var.t("stock_opname.label.stock"),
      width: 20,
    },
    {
      key: "exp_stock",
      header: c.var.t("stock_opname.label.exp_stock"),
      width: 20,
    },
    {
      key: "stock_in_transit",
      header: c.var.t("stock_opname.label.stock_in_transit"),
      width: 20,
    },
    {
      key: "real_stock",
      header: c.var.t("stock_opname.label.real_stock"),
      width: 20,
    },
    {
      key: "difference",
      header: c.var.t("stock_opname.label.difference"),
      width: 20,
    },
    {
      key: "difference_percentage",
      header: c.var.t("stock_opname.label.difference_percentage"),
      width: 28,
    },
  ]

  const summaryColumns: Column[] = [
    { key: "no", header: "No.", width: 20 },
    ...mainColumns,
  ]

  const summaryData = stockOpnameResultSummary.data.map((item, index) => {
    return {
      no: index + 1,
      ...item,
      entity_tag: item.entity_tag.name,
    }
  })

  const summaryOption: ExcelExportOption = {
    sheetName: c.var.t("common.summary"),
    titleBar: `${c.var.t("common.summary")} ${c.var.t("stock_opname.sheet.title.result")}`,
    filters,
    columns: summaryColumns,
    data: summaryData,
  }

  const columns: Column[] = [
    { key: "no", header: "No.", width: 20 },
    {
      key: "province",
      header: c.var.t("common.province"),
      width: 20,
    },
    {
      key: "regency",
      header: c.var.t("common.regency"),
      width: 20,
    },
    {
      key: "entity_id",
      header: c.var.t("common.entity_id"),
      width: 20,
    },
    {
      key: "entity",
      header: c.var.t("common.entity"),
      width: 20,
    },
    ...mainColumns,
  ]

  const data = stockOpnameResult.data.map((item, index) => {
    return {
      no: index + 1,
      ...item,
      entity_tag: item.entity_tag_name,
      entity_id: item.entity.id,
      entity: item.entity.name,
      province: item.province_name,
      regency: item.regency_name,
    }
  })

  const option: ExcelExportOption = {
    sheetName: c.var.t("common.data_table"),
    titleBar: `${c.var.t("common.data_table")} ${c.var.t("stock_opname.sheet.title.result")}`,
    filters,
    columns: columns,
    data: data,
  }

  return [summaryOption, option]
}

export function buildSoMaterialExportOptions(
  c: Context,
  filters,
  stockOpnameMaterial: StockOpnameMaterialResponse
) {
  const mainColumns: Column[] = [
    { key: "no", header: "No.", width: 20, color: "008080" },
    {
      key: "province",
      header: c.var.t("common.province"),
      width: 20,
      color: "008080",
    },
    {
      key: "regency",
      header: c.var.t("common.regency"),
      width: 20,
      color: "008080",
    },
    {
      key: "entity_id",
      header: c.var.t("common.entity_id"),
      width: 20,
      color: "008080",
    },
    {
      key: "entity",
      header: c.var.t("common.entity"),
      width: 20,
      color: "008080",
    },
    {
      key: "entity_tag",
      header: c.var.t("common.entity_tag"),
      width: 20,
      color: "008080",
    },
  ]

  const materialColumns: Column[] = stockOpnameMaterial.materials.map(
    (material) => {
      return {
        key: material.id.toString(),
        header: material.name,
        width: 20,
        color: "008080",
      }
    }
  )

  const stockColumns = [
    ...mainColumns,
    {
      key: "material",
      header: c.var.t("common.material"),
      width: 20,
      color: "008080",
      children: materialColumns,
    },
  ]

  const smileStockData = stockOpnameMaterial.data.map((item, index) => {
    const smileStock = {
      no: index + 1,
      province: item.province_name,
      regency: item.regency_name,
      entity_id: item.entity.id,
      entity: item.entity.name,
      entity_tag: item.entity_tag_name,
    }

    item.materials.forEach((material) => {
      smileStock[material.id] = material.smile_stock
    })

    return smileStock
  })

  const smileStockOption: ExcelExportOption = {
    sheetName: c.var.t("stock_opname.sheet.title.material.smile_stock"),
    titleBar: c.var.t("stock_opname.sheet.title.material.smile_stock"),
    columns: stockColumns,
    filters,
    data: smileStockData,
  }

  const realStockData = stockOpnameMaterial.data.map((item, index) => {
    const realStock = {
      no: index + 1,
      province: item.province_name,
      regency: item.regency_name,
      entity_id: item.entity.id,
      entity: item.entity.name,
      entity_tag: item.entity_tag_name,
    }

    item.materials.forEach((material) => {
      realStock[material.id] = material.real_stock
    })

    return realStock
  })

  const realStockOption: ExcelExportOption = {
    sheetName: c.var.t("stock_opname.sheet.title.material.real_stock"),
    titleBar: c.var.t("stock_opname.sheet.title.material.real_stock"),
    columns: stockColumns,
    filters,
    data: realStockData,
  }

  const materialStockColumns: Column[] = stockOpnameMaterial.materials.map(
    (material) => {
      return {
        key: material.id.toString(),
        header: material.name,
        width: 20,
        color: "008080",
        children: [
          {
            key: `${material.id}-smile_stock`,
            header: "Smile",
            width: 10,
            color: "008080",
          },
          {
            key: `${material.id}-real_stock`,
            header: c.var.t("common.real"),
            width: 10,
            color: "008080",
          },
        ],
      }
    }
  )

  const recapColumns: Column[] = [
    ...mainColumns,
    {
      key: "material",
      header: c.var.t("common.material"),
      width: 20,
      color: "008080",
      children: materialStockColumns,
    },
  ]

  recapColumns.push({
    key: "opname_recap",
    header: c.var.t("stock_opname.label.opname_recap"),
    width: 20,
    color: "008080",
  })

  const recapData = stockOpnameMaterial.data.map((item, index) => {
    const recapStock = {
      no: index + 1,
      province: item.province_name,
      regency: item.regency_name,
      entity_id: item.entity.id,
      entity: item.entity.name,
      entity_tag: item.entity_tag_name,
      opname_recap: item.opname_recap,
    }

    item.materials.forEach((material) => {
      recapStock[`${material.id}-smile_stock`] = material.smile_stock
      recapStock[`${material.id}-real_stock`] = material.real_stock
    })

    return recapStock
  })

  const recapOption: ExcelExportOption = {
    sheetName: c.var.t("stock_opname.sheet.title.material.recap_all"),
    titleBar: c.var.t("stock_opname.sheet.title.material.recap_all"),
    columns: recapColumns,
    filters,
    data: recapData,
  }

  return [smileStockOption, realStockOption, recapOption]
}
