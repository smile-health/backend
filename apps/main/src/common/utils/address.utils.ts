import { LocationDetailsResponse } from "@/modules/targets/targets.schema.js"

export interface AddressDetails {
  province_id: number
  province: string
  city_id: number
  city: string
  district_id: number
  district: string
  village_id: number
  village: string
  postal_code: number
}

export const buildAddressFromLocation = (
  location: LocationDetailsResponse,
  postalCode: number,
  addVillagePrefix = true
): AddressDetails => {
  return {
    province_id: location.province.id,
    province: location.province.name,
    city_id: location.regency.id,
    city: location.regency.name,
    district_id: location.subdistrict.id,
    district: location.subdistrict.name,
    village_id: location.village.id,
    village: addVillagePrefix
      ? `DESA ${location.village.name}`
      : location.village.name,
    postal_code: postalCode,
  }
}

export const getLocationDetailsFromVillageId = (villageId: number) => {
  const provinceId = parseInt(villageId.toString().substring(0, 2))
  const regencyId = parseInt(villageId.toString().substring(0, 4))
  const subdistrictId = parseInt(villageId.toString().substring(0, 6))

  return { provinceId, regencyId, subdistrictId }
}
