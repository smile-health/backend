import { Context } from "hono"
import { EntityRepository } from "../entity/entity.repository.js"
import { RegionRepository } from "../region/region.repository.js"
import { LocationDTO, LocationQueryParams } from "./location.schema.js"
import { ENTITY_TAG, ENTITY_TYPE } from "@/common/constants/entity.js"

export class LocationModule {
  constructor(
    private readonly regionRepository: RegionRepository,
    private readonly entityRepository: EntityRepository
  ) {}

  async getLocations(
    c: Context,
    queryParams: LocationQueryParams,
    download: boolean = false
  ) {
    const {
      province_ids,
      regency_ids,
      entity_ids,
      entity_tag_ids,
      province_id,
      regency_id,
      entity_id,
      entity_tag_id,
    } = queryParams

    let locations: LocationDTO
    let total: number

    if (
      entity_ids ||
      entity_tag_ids ||
      (province_ids && regency_ids) ||
      entity_id ||
      entity_tag_id ||
      (province_id && regency_id)
    ) {
      const { records, count } = await this.entityRepository.fetchEntities(
        c,
        queryParams,
        {
          is_paginate: !download,
        }
      )
      locations = records
      total = count
    } else if ((province_ids && !regency_ids) || (province_id && !regency_id)) {
      const { records, count } = await this.regionRepository.fetchRegencies(
        c,
        queryParams,
        {
          is_paginate: !download,
        }
      )
      locations = records
      total = count
    } else {
      const { records, count } = await this.regionRepository.fetchProvinces(
        c,
        queryParams,
        {
          is_paginate: !download,
        }
      )
      locations = records
      total = count
    }

    return { records: locations, count: total }
  }

  async getParentLocations(
    c: Context,
    queryParams: LocationQueryParams,
    download: boolean = false
  ) {
    const { province_ids, regency_ids } = queryParams

    if (province_ids && regency_ids) {
      queryParams.entity_type_id = ENTITY_TYPE.REGENCY
      queryParams.entity_tag_ids = [ENTITY_TAG.CITY_DISTRICT_HEALTH_OFFICE]
    } else if (province_ids && !regency_ids) {
      queryParams.entity_type_id = ENTITY_TYPE.PROVINCE
      queryParams.entity_tag_ids = [ENTITY_TAG.PROVINCE_HEALTH_OFFICE]
    } else {
      queryParams.entity_type_id = ENTITY_TYPE.CENTER
      queryParams.entity_tag_ids = [ENTITY_TAG.MAIN_SUPPLIER]
    }

    const { records, count } = await this.entityRepository.fetchEntities(
      c,
      queryParams,
      {
        is_paginate: !download,
      }
    )

    return { records, count }
  }
}
