import { LOCATION } from "@/common/constants/location.js"
import { EntityTagModule } from "@/modules/entity-tag/entity-tag.module.js"
import { EntityModule } from "@/modules/entity/entity.module.js"
import { GetEntitiesQueries } from "@/modules/entity/entity.schema.js"
import { MasterModule } from "@/modules/master/master.module.js"
import { z } from "@hono/zod-openapi"
import { AuthKeycloakService } from "@smile/lib/api/auth.service.js"
import { Context } from "hono"
import { IntegrationRepository } from "../integration.repository.js"
import { CommonRepository } from "./common.repository.js"
import {
  commonGetEntitiesRoute,
  commonGetEntityTagsRoute,
  commonGetProvincesRoute,
  commonGetRegenciesRoute,
  commonGetSubdistrictsRoute,
} from "./common.routes.js"
import { LoginRequestSchema } from "./common.schema.js"

export class CommonModule {
  constructor(
    protected readonly integrationRepo: IntegrationRepository,
    protected readonly authRepo: AuthKeycloakService,
    protected readonly entityRepo: EntityModule,
    protected readonly entityTagRepo: EntityTagModule,
    protected readonly locationRepo: MasterModule,
    protected readonly commonRepo: CommonRepository
  ) {}

  async login(c: Context, req: z.infer<typeof LoginRequestSchema>) {
    const loginResp = await this.authRepo.login(req.username, req.password)
    const userInfoResp = await this.authRepo.validateToken(
      loginResp.authDetails.access_token
    )

    const userInfo = userInfoResp.userInfo
    const now = new Date().toISOString()

    const userDetails = await this.commonRepo.findUserWithDetails(
      c,
      userInfo.appUserId
    )

    const entity = userDetails?.entity_id
      ? {
          id: userDetails.entity_id,
          name: userDetails.entity_name || "",
          address: userDetails.entity_address,
          type: userDetails.entity_type || 0,
          province_id: userDetails.entity_province_id,
          regency_id: userDetails.entity_regency_id,
          sub_district_id: userDetails.entity_sub_district_id,
          village_id: userDetails.entity_village_id,
          province: userDetails.province_id
            ? {
                id: userDetails.province_id,
                name: userDetails.province_name || "",
              }
            : null,
          regency: userDetails.regency_id
            ? {
                id: userDetails.regency_id,
                name: userDetails.regency_name || "",
              }
            : null,
          sub_district: userDetails.sub_district_id
            ? {
                id: userDetails.sub_district_id,
                name: userDetails.sub_district_name || "",
              }
            : null,
          village: userDetails.village_id
            ? {
                id: userDetails.village_id,
                name: userDetails.village_name || "",
              }
            : null,
        }
      : null

    const manufacture = userDetails?.manufacture_id
      ? {
          id: userDetails.manufacture_id,
          name: userDetails.manufacture_name || "",
          reference_id: userDetails.manufacture_reference_id,
          description: userDetails.manufacture_description,
          contact_name: userDetails.manufacture_contact_name,
          phone_number: userDetails.manufacture_phone_number,
          email: userDetails.manufacture_email,
          address: userDetails.manufacture_address,
          status: userDetails.manufacture_status,
          type: userDetails.manufacture_type || 0,
          is_asset: 0,
        }
      : null

    return {
      id: userDetails?.id?.toString() || null,
      username: userInfo.preferred_username,
      email: userInfo.email,
      firstname: userInfo.given_name || "",
      lastname: userInfo.family_name || "",
      gender: userDetails?.gender?.toString() || null,
      date_of_birth: userDetails?.date_of_birth?.toISOString() || null,
      role: Object.values(userInfo.resource_access)[0].roles[0],
      token_login: loginResp.authDetails.access_token,
      village_id: userDetails?.village_id || null,
      entity_id: userDetails?.entity_id?.toString() || null,
      timezone_id: userDetails?.timezone_id?.toString() || null,
      status: userDetails?.status || 0,
      view_only: userDetails?.view_only || 0,
      change_password: userDetails?.change_password || 0,
      entity: entity,
      manufacture: manufacture,
      last_login: now,
      updated_at: now,
    }
  }

  async getProvinces(
    c: Context,
    query: z.infer<typeof commonGetProvincesRoute.request.query>
  ) {
    const { page, paginate } = query
    const provinces = await this.locationRepo.getLocations(c, {
      page: page ? Number(page) : 1,
      paginate: paginate ? Number(paginate) : 10,
      offset: 0,
      level: LOCATION.PROVINCE,
      parent_id: [],
    })

    return {
      total: provinces.total_item,
      page: provinces.page,
      perPage: provinces.item_per_page,
      list: provinces.data.map((p) => ({
        id: p.id,
        name: p.name,
        created_at: p.created_at?.toISOString() || null,
        updated_at: p.updated_at?.toISOString() || null,
        deleted_at: null,
      })),
    }
  }

  async getRegencies(
    c: Context,
    query: z.infer<typeof commonGetRegenciesRoute.request.query>
  ) {
    const { page, paginate, province_id } = query
    const regencies = await this.locationRepo.getLocations(c, {
      page: page ? Number(page) : 1,
      paginate: paginate ? Number(paginate) : 10,
      offset: 0,
      level: LOCATION.REGENCY,
      parent_id: [province_id],
    })

    return {
      total: regencies.total_item,
      page: regencies.page,
      perPage: regencies.item_per_page,
      list: regencies.data.map((r) => ({
        id: r.id,
        name: r.name,
        province_id: r.parent_id,
        created_at: r.created_at?.toISOString() || null,
        updated_at: r.updated_at?.toISOString() || null,
        deleted_at: null,
        provinceId: r.parent_id,
      })),
    }
  }

  async getSubdistricts(
    c: Context,
    query: z.infer<typeof commonGetSubdistrictsRoute.request.query>
  ) {
    const { page, paginate, regency_id } = query
    const subdistricts = await this.locationRepo.getLocations(c, {
      page: page ? Number(page) : 1,
      paginate: paginate ? Number(paginate) : 10,
      offset: 0,
      level: LOCATION.SUBDISTRICT,
      parent_id: [regency_id],
    })

    return {
      total: subdistricts.total_item,
      page: subdistricts.page,
      perPage: subdistricts.item_per_page,
      list: subdistricts.data.map((s) => ({
        id: s.id,
        name: s.name,
        regency_id: s.parent_id,
        created_at: s.created_at?.toISOString() || null,
        updated_at: s.updated_at?.toISOString() || null,
        deleted_at: null,
        regencyId: s.parent_id,
      })),
    }
  }

  async getEntities(
    c: Context,
    query: z.infer<typeof commonGetEntitiesRoute.request.query>
  ) {
    const {
      keyword,
      type,
      page,
      paginate,
      province_id,
      regency_id,
      sub_district_id,
      is_vendor,
      entity_tag,
    } = query

    const entities = await this.entityRepo.list(c, {
      keyword,
      type: type ? Number(type) : undefined,
      page: page ? Number(page) : 1,
      paginate: paginate ? Number(paginate) : 10,
      offset: 0,
      province_ids: province_id ? province_id.split(",") : undefined,
      regency_ids: regency_id ? regency_id.split(",") : undefined,
      sub_district_ids: sub_district_id
        ? sub_district_id.split(",")
        : undefined,
      entity_tag_ids: entity_tag ? entity_tag.split(",") : undefined,
      is_vendor: is_vendor ? Number(is_vendor) : undefined,
    } as GetEntitiesQueries)

    return {
      total: entities.total_item,
      page: entities.page,
      perPage: entities.item_per_page,
      list: entities.data.map((e) => {
        const province = e.locations?.find((loc) => loc.level === 0)
        const regency = e.locations?.find((loc) => loc.level === 1)
        const sub_district = e.locations?.find((loc) => loc.level === 2)
        const village = e.locations?.find((loc) => loc.level === 3)

        return {
          type_label: e.entity_type?.[0]?.name || null,
          id: e.id,
          name: e.name,
          address: null,
          code: e.code,
          type: e.type,
          status: e.status,
          created_at: null,
          updated_at: null,
          province_id: province?.id?.toString() || null,
          regency_id: regency?.id?.toString() || null,
          village_id: village?.id?.toString() || null,
          sub_district_id: sub_district?.id?.toString() || null,
          lat: null,
          lng: null,
          postal_code: null,
          is_vendor: e.is_vendor,
          bpom_key: null,
          is_puskesmas: e.is_puskesmas,
          rutin_join_date: null,
          is_ayosehat: null,
          entity_tags: e.entity_tag
            ? [{ id: e.entity_tag.id, title: e.entity_tag.title }]
            : [],
          province: province
            ? { id: province.id.toString(), name: province.name }
            : null,
          regency: regency
            ? { id: regency.id.toString(), name: regency.name }
            : null,
          sub_district: sub_district
            ? { id: sub_district.id.toString(), name: sub_district.name }
            : null,
          village: village
            ? { id: village.id.toString(), name: village.name }
            : null,
        }
      }),
    }
  }

  async getEntityTags(
    c: Context,
    query: z.infer<typeof commonGetEntityTagsRoute.request.query>
  ) {
    const { page, paginate } = query
    const entityTags = await this.entityTagRepo.getEntityTags(c, {
      page: page ? Number(page) : 1,
      paginate: paginate ? Number(paginate) : 100,
      offset: 0,
    })

    return {
      total: entityTags.total_item,
      page: entityTags.page,
      perPage: entityTags.item_per_page,
      list: entityTags.data.map((tag) => ({
        id: tag.id,
        title: tag.title,
        created_at: null,
        updated_at: null,
        deleted_at: null,
      })),
    }
  }
}
