import { Context } from "hono"
import { LocationRepository } from "@/modules/location/location.repository.js"
import {
  GetIdentityAndAddressResponseDTO,
  LocationDetailsResponse,
} from "@/modules/targets/targets.schema.js"
import { USER_GENDER } from "../constants/gender.js"

export async function getIdentityAndAddressByNIK(
  c: Context,
  nik: string,
  locationRepository: LocationRepository
): Promise<GetIdentityAndAddressResponseDTO> {
  const subdistrictId = parseInt(nik.substring(0, 6))
  const dayOfBirth = parseInt(nik.substring(6, 8))
  const monthOfBirth = parseInt(nik.substring(8, 10))
  const yearOfBirth = parseInt(nik.substring(10, 12))

  const gender = dayOfBirth > 40 ? USER_GENDER.FEMALE : USER_GENDER.MALE
  const actualDay = dayOfBirth > 40 ? dayOfBirth - 40 : dayOfBirth

  const fullYear = yearOfBirth < 50 ? 2000 + yearOfBirth : 1900 + yearOfBirth
  const dateOfBirth = `${fullYear}-${String(monthOfBirth).padStart(2, "0")}-${String(actualDay).padStart(2, "0")}`

  const locationDetails = (await locationRepository.getDetails(
    c,
    subdistrictId
  )) as LocationDetailsResponse

  return {
    day_of_birth: dayOfBirth,
    month_of_birth: monthOfBirth,
    year_of_birth: yearOfBirth,
    actual_day: actualDay,
    full_year: fullYear,
    gender,
    date_of_birth: dateOfBirth,
    province: locationDetails.province?.name || "",
    province_id: locationDetails.province?.id,
    city: locationDetails.regency?.name || "",
    city_id: locationDetails.regency?.id,
    district: locationDetails.subdistrict?.name || "",
    district_id: locationDetails.subdistrict?.id,
  }
}
