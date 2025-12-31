import { Context } from "hono"

export const MATERIAL_LEVEL = {
  INGREDIENT: 1,
  TEMPLATE: 2,
  VARIANT: 3,
  PACKAGING: 4,
}

// The value needs to be refactored when template implements another languages
export const getTranslateMaterialColumnsExcel = (c: Context) => {
  return {
    name: c.var.t("material.label.name"),
    description: c.var.t("material.label.description"),
    code: c.var.t("material.label.code"),
    hierarchy_code: c.var.t("material.label.hierarchy_code"),
    material_parent_codes: c.var.t("material.label.parent_hierarchy_code"),
    unit_of_consumption_id: c.var.t("material.label.unit_of_consumption"),
    unit_of_distribution_id: c.var.t("material.label.unit_of_distribution"),
    consumption_unit_per_distribution_unit: c.var.t(
      "material.label.consumption_unit_per_distribution_unit"
    ),
    is_temperature_sensitive: c.var.t(
      "material.label.is_temperature_sensitive"
    ),
    min_temperature: c.var.t("material.label.min_temperature"),
    max_temperature: c.var.t("material.label.max_temperature"),
    material_type_id: c.var.t("material.label.material_type"),
    material_subtype_id: c.var.t("material.label.material_subtype"),
    program_ids: c.var.t("common.program"),
    is_managed_in_batch: c.var.t("material.label.is_managed_in_batch"),
    min_retail_price: c.var.t("material.label.min_retail_price"),
    max_retail_price: c.var.t("material.label.max_retail_price"),
    is_stock_opname_mandatory: c.var.t(
      "material.label.is_stock_opname_mandatory"
    ),
  }
}

export const getTranslateMaterialVolumeColumnsExcel = (c: Context) => {
  return {
    material_id: c.var.t("material-volume.label.material_id"),
    manufacture_id: c.var.t("material-volume.label.manufacture_id"),
    unit_per_box: c.var.t("material-volume.label.unit_per_box"),
    box_length: c.var.t("material-volume.label.box_length"),
    box_width: c.var.t("material-volume.label.box_width"),
    box_height: c.var.t("material-volume.label.box_height"),
  }
}

export const ROW_SHEET_MATERIAL = 10
