import { UserBasicInfoMap } from "../user/user.mapper.js"
import { ExportRow } from "./material-ratio.excel.repository.js"
import { MaterialRatioRow } from "./material-ratio.repository.js"

export function toResponse(row: MaterialRatioRow, userMap: UserBasicInfoMap) {
  return {
    id: row.id,
    from_material: {
      id: row.from_material_id,
      name: row.from_material_name,
    },
    from_subtype: row.from_subtype_id
      ? {
          id: row.from_subtype_id,
          name: row.from_subtype_name,
        }
      : null,
    from_material_qty: row.from_material_qty,
    to_material: {
      id: row.to_material_id,
      name: row.to_material_name,
    },
    to_subtype: row.to_subtype_id
      ? {
          id: row.to_subtype_id,
          name: row.to_subtype_name,
        }
      : null,
    to_material_qty: row.to_material_qty,
    user_updated_at: row.updated_at,
    user_updated_by: row.updated_by ? (userMap[row.updated_by] ?? null) : null,
  }
}

export function toExport(row: ExportRow, userMap: UserBasicInfoMap) {
  const updatedBy = row.updated_by == null ? null : userMap[row.updated_by]
  return [
    row.from_subtype_name ?? "",
    row.from_material_name ?? "",
    Number(row.from_material_qty ?? 0),
    row.to_subtype_name ?? "",
    row.to_material_name ?? "",
    Number(row.to_material_qty ?? 0),
    updatedBy?.firstname ?? updatedBy?.fullname ?? "",
  ]
}
