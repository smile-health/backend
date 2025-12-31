import { LOCATION } from "@/common/constants/location.js"

export const LEVEL_MAP: Record<string, number> = {
  province: LOCATION.PROVINCE,
  city: LOCATION.REGENCY,
  district: LOCATION.SUBDISTRICT,
  village: LOCATION.VILLAGE,
}

export type LocationType = "province" | "city" | "district" | "village"

export const TARGET_LOCATION_COLUMNS: Record<LocationType, string> = {
  province: "residence_province_id",
  city: "residence_regency_id",
  district: "residence_subdistrict_id",
  village: "residence_village_id",
}

export const PATIENT_LOCATION_COLUMNS: Record<LocationType, string> = {
  province: "residential_province_id",
  city: "residential_regency_id",
  district: "residential_subdistrict_id",
  village: "residential_village_id",
}
