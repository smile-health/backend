import { Context } from "hono"
import { QueryParams } from "../schemas/query-param.schema.js"
import { Filter } from "@smile-health/lib/excel/types.js"

export function getExportLocationFileName(
  c: Context,
  queryParams: QueryParams,
  filters: Filter[]
) {
  let locationLabel: string | undefined = ""

  if (queryParams.entity_id || queryParams.entity_ids) {
    locationLabel = filters.find(
      (filter) => filter.key === c.var.t("common.entity")
    )?.value
  } else if (queryParams.entity_tag_id || queryParams.entity_tag_ids) {
    locationLabel = filters.find(
      (filter) => filter.key === c.var.t("common.entity_tag")
    )?.value
  } else if (queryParams.regency_id || queryParams.regency_ids) {
    locationLabel = filters.find(
      (filter) => filter.key === c.var.t("common.regency")
    )?.value
  } else if (queryParams.province_id || queryParams.province_ids) {
    locationLabel = filters.find(
      (filter) => filter.key === c.var.t("common.province")
    )?.value
  } else {
    locationLabel = c.var.t("common.national")
  }

  return locationLabel
}
