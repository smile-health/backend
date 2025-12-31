import { createRoute, z } from "@hono/zod-openapi"
import { StatusCodes } from "http-status-codes"
import { LoginRequestSchema } from "./common.schema"

const tags = ["IoT Integration", "WMS Integration"]

export const authLoginRoute = createRoute({
  method: "post",
  path: "/auth/login",
  summary: "User Login",
  description: "Authenticate user and return user info",
  tags: tags,
  request: {
    body: {
      content: {
        "application/json": {
          schema: LoginRequestSchema.openapi("LoginRequest"),
        },
      },
    },
  },
  responses: {
    [StatusCodes.OK]: {
      description: "Login successful",
      content: {
        "application/json": {
          schema: z.object({
            id: z.string().nullable(),
            username: z.string(),
            email: z.string(),
            firstname: z.string(),
            lastname: z.string(),
            gender: z.string().nullable(),
            date_of_birth: z.string().nullable(),
            role: z.string(),
            token_login: z.string(),
            village_id: z.string().nullable(),
            entity_id: z.string().nullable(),
            timezone_id: z.string().nullable(),
            status: z.number(),
            view_only: z.number(),
            change_password: z.number(),
            entity: z
              .object({
                id: z.number(),
                name: z.string(),
                address: z.string().nullable(),
                type: z.number(),
                province_id: z.string().nullable(),
                regency_id: z.string().nullable(),
                sub_district_id: z.string().nullable(),
                village_id: z.string().nullable(),
                province: z
                  .object({
                    id: z.string(),
                    name: z.string(),
                  })
                  .nullable(),
                regency: z
                  .object({
                    id: z.string(),
                    name: z.string(),
                  })
                  .nullable(),
                sub_district: z
                  .object({
                    id: z.string(),
                    name: z.string(),
                  })
                  .nullable(),
                village: z
                  .object({
                    id: z.string(),
                    name: z.string(),
                  })
                  .nullable(),
              })
              .nullable(),
            manufacture: z
              .object({
                id: z.number(),
                name: z.string(),
                reference_id: z.string().nullable(),
                description: z.string().nullable(),
                contact_name: z.string().nullable(),
                phone_number: z.string().nullable(),
                email: z.string().nullable(),
                address: z.string().nullable(),
                status: z.number().nullable(),
                type: z.number(),
                is_asset: z.number().nullable(),
              })
              .nullable(),
            last_login: z.string(),
            updated_at: z.string(),
          }),
        },
      },
    },
    [StatusCodes.UNAUTHORIZED]: {
      description: "Unauthorized",
    },
  },
})

export const commonGetEntitiesRoute = createRoute({
  method: "get",
  path: "/entities",
  summary: "Get Entities",
  description: "Get a list of entities",
  tags: tags,
  security: [{ Bearer: [] }],
  request: {
    query: z.object({
      keyword: z.string().optional(),
      type: z.string().optional(),
      page: z.string().optional(),
      paginate: z.string().optional(),
      province_id: z.string().optional(),
      regency_id: z.string().optional(),
      sub_district_id: z.string().optional(),
      is_vendor: z.string().optional(),
      entity_tag: z.string().optional(),
    }),
  },
  responses: {
    [StatusCodes.OK]: {
      description: "Entities retrieved successfully",
      content: {
        "application/json": {
          schema: z.any(),
          example: {
            total: 101,
            page: "1",
            perPage: "1",
            list: [
              {
                type_label: "FASKES",
                id: 21208,
                name: "PUSKESMAS CISARUA",
                address: "Jl. Raya Puncak Km 63, Kec. Cisarua",
                code: "10040101",
                type: 3,
                status: 1,
                created_at: "2021-01-21T02:22:43.000Z",
                updated_at: "2021-01-21T02:22:43.000Z",
                province_id: "32",
                regency_id: "3201",
                village_id: null,
                sub_district_id: "320125",
                lat: null,
                lng: "107",
                postal_code: null,
                is_vendor: 1,
                bpom_key: null,
                is_puskesmas: 1,
                rutin_join_date: null,
                is_ayosehat: 1,
                entity_tags: [
                  {
                    id: 9,
                    title: "Puskesmas",
                  },
                ],
                province: {
                  id: "32",
                  name: "PROV. JAWA BARAT",
                },
                regency: {
                  id: "3201",
                  name: "KAB. BOGOR",
                },
                sub_district: {
                  id: "320125",
                  name: "KEC. CISARUA",
                },
              },
            ],
          },
        },
      },
    },
  },
})

export const commonGetProvincesRoute = createRoute({
  method: "get",
  path: "/provinces",
  summary: "Get Provinces",
  description: "Get a list of provinces",
  tags: tags,
  security: [{ Bearer: [] }],
  request: {
    query: z.object({
      type: z.string().optional(),
      page: z.string().optional(),
      paginate: z.string().optional(),
    }),
  },
  responses: {
    [StatusCodes.OK]: {
      description: "Provinces retrieved successfully",
      content: {
        "application/json": {
          schema: z.any(),
          example: {
            total: 34,
            page: "1",
            perPage: "1",
            list: [
              {
                id: "11",
                name: "PROV. ACEH",
                created_at: "2020-12-02T09:43:31.000Z",
                updated_at: "2020-12-02T09:43:31.000Z",
                deleted_at: null,
              },
            ],
          },
        },
      },
    },
  },
})

export const commonGetRegenciesRoute = createRoute({
  method: "get",
  path: "/regencies",
  summary: "Get Regencies",
  description: "Get a list of regencies",
  tags: tags,
  security: [{ Bearer: [] }],
  request: {
    query: z.object({
      type: z.string().optional(),
      page: z.string().optional(),
      paginate: z.string().optional(),
      province_id: z.string().optional(),
    }),
  },
  responses: {
    [StatusCodes.OK]: {
      description: "Regencies retrieved successfully",
      content: {
        "application/json": {
          schema: z.any(),
          example: {
            total: 23,
            page: "1",
            perPage: "1",
            list: [
              {
                id: "1101",
                name: "KAB. ACEH SELATAN",
                province_id: "11",
                created_at: "2021-01-18T00:00:00.000Z",
                updated_at: "2021-01-18T00:00:00.000Z",
                deleted_at: null,
                provinceId: "11",
              },
            ],
          },
        },
      },
    },
  },
})

export const commonGetEntityTagsRoute = createRoute({
  method: "get",
  path: "/entity-tags",
  summary: "Get Entity Tags",
  description: "Get a list of entity tags",
  tags: tags,
  security: [{ Bearer: [] }],
  request: {
    query: z.object({
      page: z.string().optional(),
      paginate: z.string().optional(),
    }),
  },
  responses: {
    [StatusCodes.OK]: {
      description: "Entity tags retrieved successfully",
      content: {
        "application/json": {
          schema: z.any(),
          example: {
            total: 22,
            page: "1",
            perPage: "100",
            list: [
              {
                id: 1,
                title: "Penyedia Utama",
                created_at: "2021-01-02T02:32:26.000Z",
                updated_at: "2025-01-10T15:23:01.000Z",
                deleted_at: null,
              },
            ],
          },
        },
      },
    },
  },
})

export const commonGetSubdistrictsRoute = createRoute({
  method: "get",
  path: "/subdistricts",
  summary: "Get Subdistricts",
  description: "Get a list of subdistricts",
  tags: tags,
  security: [{ Bearer: [] }],
  request: {
    query: z.object({
      page: z.string().optional(),
      paginate: z.string().optional(),
      regency_id: z.string().optional(),
    }),
  },
  responses: {
    [StatusCodes.OK]: {
      description: "Subdistricts retrieved successfully",
      content: {
        "application/json": {
          schema: z.any(),
          example: {
            total: 7,
            page: "1",
            perPage: "1",
            list: [
              {
                id: "367401",
                name: "KEC. SERPONG",
                regency_id: "3674",
                created_at: "2021-01-26T08:19:00.000Z",
                updated_at: "2021-01-26T08:19:00.000Z",
                deleted_at: null,
                regencyId: "3674",
              },
            ],
          },
        },
      },
    },
  },
})
