import { MaterialDTO } from "../material/material.schema.js"
import {
  MaterialQtyData,
  MaterialReportItem,
  PeriodicMaterialStockQueryParams,
} from "./periodic-material-stock.schema.js"

interface MaterialGroup {
  group: string
  numbering: boolean
  data: string[]
  child?: string[][]
}

interface MaterialPerTagType {
  [key: number]: MaterialGroup[]
}

const MaterialPerTag: MaterialPerTagType = {
  15: [
    {
      group: "Vaksin",
      numbering: true,
      data: [
        "ADS 0.05 ml",
        "ADS 0.5 ml",
        "AZ SPAIN COVID-19 (SINGAPORE)",
        "COVID-19 VACCINE ASTRAZENECA FRANCE (MFC-SPAIN) 10 DOSIS",
        "Alcohol Swab_Alcohol Swab",
        "ADS 5 ml",
        "Pelarut BCG Impor (Partnership)",
        "VAKSIN BCG BAYI IMPOR",
      ],
    },
    {
      group: "ADS/SPUIT",
      numbering: true,
      data: [
        "Coverall",
        "COVID-19 VACCINE ASTRAZENECA (PERANCIS) 1 VIAL @ 10 DOSIS, ISI 10 VIAL",
      ],
      child: [
        ["a. Bayi", "b. Bumil & WUS", "c. BIAS"],
        ["a. Bayi", "b. BIAS"],
      ],
    },
    {
      group: "Safety Box",
      numbering: true,
      data: [
        "COVID-19 VACCINE ASTRAZENECA (AUSTRALIA) 1 VIAL @ 10 DOSIS, ISI 10 VIAL",
        "COVID-19 VACCINE ASTRAZENECA (JAPAN) : EUA2155600243A1",
      ],
    },
  ],
  16: [
    {
      group: "Vaksin",
      numbering: true,
      data: [
        "VAKSIN DTP HB HIB 5 DS",
        "Sarung Tangan",
        "VAKSIN COVID-19 AZ BS KOREA",
        "SINOPHARM 1 VIAL @1 DS (HIBAH UEA)",
        "JE",
      ],
    },
    {
      group: "ADS/SPUIT",
      numbering: true,
      data: ["Dropper bOPV isi 10", "VAKSIN POLIO / BOPV 10 DS"],
      child: [["a. Bayi", "b. Bumil & WUS"], ["a. Bayi"]],
    },
    {
      group: "Safety Box",
      numbering: true,
      data: ["SB 5 liter", "SINOPHARM @2 DS (HIBAH REDCROSS CHINA)"],
    },
  ],
  18: [
    {
      group: "Vaksin",
      numbering: true,
      data: [
        "COVID-19 VACCINE ASTRAZENECA (UK) 8 DOSIS, 1 BOX ISI 10 VIAL",
        "COVID-19 VACCINE ASTRAZENECA (SPAIN) : EUA2159800143A1",
        "COVID-19 VACCINE ASTRAZENECA (NEW ZEALAND) 1 VIAL @ 10 DOSIS, ISI 10 VIAL",
        "COVID-19 VACCINE ASTRAZENECA FRANCE (MFC-UK) 8 DOSIS",
        "COVID-19 VACCINE ASTRAZENECA (JAPAN) : EUA2155600243A1 1 BOX ISI 2 VIAL",
      ],
    },
    {
      group: "ADS/SPUIT",
      numbering: true,
      data: [
        "SINOPHARM 1 VIAL @2 DS (HIBAH UEA)",
        "VAKSIN TD 10 DS",
        "COVID-19 VACCINE ASTRAZENECA JAPAN (VAXZEVRIA) 1 DUS ISI 1 VIAL @ 10 DOSIS",
      ],
    },
    {
      group: "Safety Box",
      numbering: true,
      data: [
        "VAKSIN CORONAVAC , 1 DOSIS PER VIAL , HIBAH GAVI",
        "VAKSIN CORONAVAC , 2 DOSIS PER VIAL , HIBAH RRT",
      ],
    },
  ],
  19: [
    {
      group: "Vaksin",
      numbering: true,
      data: [
        "JE Pelarut",
        "COVID-19 VACCINE PFIZER 1 VIAL @ 6 DOSIS",
        "Masker Medis",
        "Meningitis",
      ],
    },
    {
      group: "ADS/SPUIT",
      numbering: true,
      data: ["Meningitis Pelarut"],
    },
    {
      group: "Logistik",
      numbering: true,
      data: [
        "VAKSIN MEASLES RUBELLA (MR) 10 DS/ PARTNERSHIP",
        "Nacl 0,9% 10 ml",
        "PCV",
        "PCV MDV",
        "PFIZER 1 VIAL @ 6 DOSIS (BILATERAL)",
        "Pelarut MR (Partnership)",
      ],
    },
  ],
}

export function applyQtyData(
  queryParams: PeriodicMaterialStockQueryParams,
  materials: MaterialDTO,
  materialQtyData: MaterialQtyData[]
): MaterialReportItem[] {
  // If no activityId provided, return ungrouped list
  if (!queryParams.activity_id || !MaterialPerTag[queryParams.activity_id]) {
    return materials.map((material, index) => {
      const qty = materialQtyData.find((c) => c.material_id === material.id)

      return {
        id: material.id,
        name: material.name,
        opening_qty: qty?.opening_qty || 0,
        received_qty: qty?.received_qty || 0,
        ordered_qty: qty?.ordered_qty || 0,
        issues_qty: qty?.issues_qty || 0,
        discard_qty: qty?.discard_qty || 0,
        closing_qty: qty?.closing_qty || 0,
        vaccine_ip: qty?.vaccine_ip || "",
        scope_total: qty?.scope_total || "",
        number: index + 1,
      }
    })
  }

  // Hardcoded material list based on predefined conditions
  const vaccineMaterials = materials.filter(
    (material) => material.material_type_id === 2
  )
  const adsMaterials = materials.filter(
    (material) => material.name.search("ADS") !== -1
  )
  const safetyBoxMaterials = materials.filter(
    (material) =>
      material.material_type_id !== 2 && material.name.search("ADS") === -1
  )

  // Get the template for this activity
  const result: MaterialReportItem[] = []
  const template = MaterialPerTag[queryParams.activity_id]
  if (!template) {
    return []
  }

  // Process each group in the template
  template.forEach((groupConfig, groupIdx) => {
    const alphabetNumber = String.fromCharCode("A".charCodeAt(0) + groupIdx)

    // Add group header: A. Vaksin, B. ADS/SPUIT, etc.
    result.push({
      id: 0,
      name: groupConfig.group,
      number: alphabetNumber,
      opening_qty: 0,
      received_qty: 0,
      ordered_qty: 0,
      issues_qty: 0,
      discard_qty: 0,
      closing_qty: 0,
      vaccine_ip: "",
      scope_total: "",
    })

    // Add materials in this group with sequential numbering
    let itemNumber = 1
    let materialList: MaterialDTO = []
    if (groupConfig.group === "Vaksin") {
      materialList = vaccineMaterials
    } else if (groupConfig.group === "ADS/SPUIT") {
      materialList = adsMaterials
    } else if (groupConfig.group === "Safety Box") {
      materialList = safetyBoxMaterials
    }

    materialList.forEach((material) => {
      const qtyData = materialQtyData.find((c) => c.material_id === material.id)

      result.push({
        id: material.id,
        name: material.name,
        number: itemNumber++,
        opening_qty: qtyData?.opening_qty || 0,
        received_qty: qtyData?.received_qty || 0,
        ordered_qty: qtyData?.ordered_qty || 0,
        issues_qty: qtyData?.issues_qty || 0,
        discard_qty: qtyData?.discard_qty || 0,
        closing_qty: qtyData?.closing_qty || 0,
        vaccine_ip: qtyData?.vaccine_ip || "",
        scope_total: qtyData?.scope_total || "",
      })
    })
  })

  return result
}
