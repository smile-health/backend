type Role = {
  id: number
  createdBy: string
  updatedBy: string
  name: string
  type: string
  description: string | null
  regionId: number
}

type Pagination = {
  total: number
  pages: number
  currentPage: number
  perPage: number
}

type DataWrapper = {
  data: Role[]
  pagination: Pagination
}

export type GetRolesResponse = {
  status: "success" | "error"
  data: DataWrapper
}

export interface AssetInfo {
  id: number
  healthcareFacilityId: number
  assetTypeName: string
  assetWorkingStatusName: string
  status: number
  createdAt: string // ISO Date format, e.g., "2025-10-30"
  updatedAt: string // ISO Date format
  create: boolean
}
