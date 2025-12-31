import { createRoute } from "@hono/zod-openapi"
import { z } from "zod"
import {
  BudgetSourceQueryParamsSchema,
  EntitiesQueryParamsSchema,
  EntitiesResponseSchema,
  GetOrderDetailsSchema,
  GetOrdersQuerySchema,
  LoginRequestSchema,
  LoginResponseSchema,
  ManufacturesQueryParamsSchema,
  ManufacturesResponseSchema,
  MaterialsQueryParamsSchema,
  MaterialsResponseSchema,
  OrderIdParamSchema,
  OrderListItemSchema,
  PostOrderIntegrationSchema,
  PutOrderCancelIntegrationSchema,
  PutOrderConfirmIntegrationSchema,
  SmileOrderIdParamSchema,
} from "./siha.schemas.js"

const tags = ["SIHA/SITB Integration"]

export const createOrderRoute = createRoute({
  method: "post",
  path: "/v2/order/integration",
  summary: "Create Order Integration",
  description: "Create a new order integration",
  tags: tags,
  security: [{ Bearer: [] }],
  request: {
    body: {
      content: {
        "application/json": {
          schema: PostOrderIntegrationSchema,
          example: {
            type: 1,
            customer_id: 1000720789,
            vendor_id: 123456789,
            activity_code: "tbso",
            category: "ta_oat_so_pemesanan",
            key_ssl: "TBSO_2019000005750026",
            is_validate: 0,
            total_patients: 10,
            order_items: [
              {
                external_order_item_id: "1",
                ordered_qty: 10,
                kode_kfa: "92004603",
              },
            ],
          },
        },
      },
    },
  },
  responses: {
    204: {
      description: "Order created",
    },
    422: {
      description: "Invalid request body",
    },
  },
})

export const confirmOrderRoute = createRoute({
  method: "put",
  path: "/v2/order/{key_ssl}/confirm/integration",
  summary: "Confirm Order Integration",
  description: "Confirm an existing order integration",
  tags: tags,
  security: [{ Bearer: [] }],
  request: {
    params: OrderIdParamSchema,
    body: {
      content: {
        "application/json": {
          schema: PutOrderConfirmIntegrationSchema,
          example: {
            comment: "konfirmasi berdasarkan kasus",
            activity_code: "tbso",
            order_items: [
              {
                confirmed_qty: 10,
                kode_kfa: "92004603",
              },
            ],
          },
        },
      },
    },
  },
  responses: {
    204: {
      description: "Order confirmed",
    },
    422: {
      description: "Invalid request body",
    },
  },
})

export const cancelOrderRoute = createRoute({
  method: "put",
  path: "/v2/order/{key_ssl}/cancel/integration",
  summary: "Cancel Order Integration",
  description: "Cancel an existing order integration",
  tags: tags,
  security: [{ Bearer: [] }],
  request: {
    params: OrderIdParamSchema,
    body: {
      content: {
        "application/json": {
          schema: PutOrderCancelIntegrationSchema,
          example: {
            cancel_reason: "1",
            other_reason: "",
          },
        },
      },
    },
  },
  responses: {
    204: {
      description: "Order canceled",
    },
    422: {
      description: "Invalid request body",
    },
  },
})

export const getOrderStatusRoute = createRoute({
  method: "get",
  path: "/v2/order/{key_ssl}/integration",
  summary: "Get Order Integration",
  description: "Retrieve order integration details",
  tags: tags,
  security: [{ Bearer: [] }],
  request: {
    params: OrderIdParamSchema,
  },
  responses: {
    200: {
      description: "Order integration details",
      content: {
        "application/json": {
          schema: GetOrderDetailsSchema,
          example: {
            id: 184873,
            key_ssl: "TBSO_2019000005750013",
            confirmed_at: "2025-07-17T03:50:58.000Z",
            created_at: "2025-07-17T03:45:04.000Z",
            updated_at: "2025-07-17T03:50:58.000Z",
            activity: {
              id: 14,
              name: "TB - Program",
            },
            customer: {
              type_label: "Province",
              id: 824780,
              name: "DINKES PROV. JAWA BARAT",
              address:
                "Jl. Pasteur No.25, Pasir Kaliki, Kec. Cicendo, Kota Bandung, Jawa Barat 40171",
              code: "32",
              type: 1,
              status: 1,
              created_at: "2024-02-28T04:11:02.000Z",
              updated_at: "2025-07-11T15:02:48.000Z",
              province_id: "32",
              regency_id: "",
              village_id: "",
              sub_district_id: "",
              lat: "-6.95427777",
              lng: "107.590112",
              postal_code: "NULL",
              is_vendor: 1,
              is_puskesmas: 0,
              rutin_join_date: "2024-02-28T04:11:02.000Z",
              mapping_entity: {
                id_entitas_smile: 824780,
                id_satu_sehat: 1000720789,
              },
            },
            vendor: {
              type_label: "Primary Vendor",
              id: 824707,
              name: "Kemenkes RI",
              address: "Bandung",
              code: "00",
              type: 5,
              status: 1,
              created_at: "2024-02-28T04:11:02.000Z",
              updated_at: "2025-07-05T13:40:02.000Z",
              province_id: " ",
              regency_id: "",
              village_id: "",
              sub_district_id: "",
              lat: "",
              lng: "0",
              postal_code: "",
              is_vendor: 1,
              is_puskesmas: 0,
              rutin_join_date: "2024-02-28T04:11:02.000Z",
              mapping_entity: {
                id_entitas_smile: 824707,
                id_satu_sehat: 123456789,
              },
            },
            order_items: [
              {
                id: 289616,
                order_id: 184873,
                code_kfa_product_template: "92004603",
                qty: 10,
                recomended_stock: null,
                reason_id: null,
                other_reason: "",
                confirmed_qty: 10,
                created_at: "2025-07-17T03:45:04.000Z",
                name_kfa_product_template:
                  "Abacavir Sulfate 120 mg / Lamivudine 60 mg Tablet Dispersible",
                material_category: "medicine",
                children: [],
                stock_vendor: {
                  min: 0,
                  max: 0,
                  on_hand_stock: 1999990,
                  available_stock: 1999990,
                  allocated_stock: 0,
                },
                stock_customer: {
                  min: 0,
                  max: 0,
                  on_hand_stock: 10983520,
                  available_stock: 10980164,
                  allocated_stock: 3356,
                },
              },
            ],
          },
        },
      },
    },
  },
})

export const getOrderRoute = createRoute({
  method: "get",
  path: "/v2/order/{order_id}",
  summary: "Get Order Detail By SMILE Order Id",
  description: "Retrieve order details",
  tags: tags,
  security: [{ Bearer: [] }],
  request: {
    params: SmileOrderIdParamSchema,
  },
  responses: {
    200: {
      description: "Order details",
      content: {
        "application/json": {
          schema: GetOrderDetailsSchema,
          example: {
            id: 184873,
            key_ssl: "TBSO_2019000005750013",
            confirmed_at: "2025-07-17T03:50:58.000Z",
            created_at: "2025-07-17T03:45:04.000Z",
            updated_at: "2025-07-17T03:50:58.000Z",
            activity: {
              id: 14,
              name: "TB - Program",
            },
            customer: {
              type_label: "Province",
              id: 824780,
              name: "DINKES PROV. JAWA BARAT",
              address:
                "Jl. Pasteur No.25, Pasir Kaliki, Kec. Cicendo, Kota Bandung, Jawa Barat 40171",
              code: "32",
              type: 1,
              status: 1,
              created_at: "2024-02-28T04:11:02.000Z",
              updated_at: "2025-07-11T15:02:48.000Z",
              province_id: "32",
              regency_id: "",
              village_id: "",
              sub_district_id: "",
              lat: "-6.95427777",
              lng: "107.590112",
              postal_code: "NULL",
              is_vendor: 1,
              is_puskesmas: 0,
              rutin_join_date: "2024-02-28T04:11:02.000Z",
              mapping_entity: {
                id_entitas_smile: 824780,
                id_satu_sehat: 1000720789,
              },
            },
            vendor: {
              type_label: "Primary Vendor",
              id: 824707,
              name: "Kemenkes RI",
              address: "Bandung",
              code: "00",
              type: 5,
              status: 1,
              created_at: "2024-02-28T04:11:02.000Z",
              updated_at: "2025-07-05T13:40:02.000Z",
              province_id: " ",
              regency_id: "",
              village_id: "",
              sub_district_id: "",
              lat: "",
              lng: "0",
              postal_code: "",
              is_vendor: 1,
              is_puskesmas: 0,
              rutin_join_date: "2024-02-28T04:11:02.000Z",
              mapping_entity: {
                id_entitas_smile: 824707,
                id_satu_sehat: 123456789,
              },
            },
            order_items: [
              {
                id: 289616,
                order_id: 184873,
                code_kfa_product_template: "92004603",
                qty: 10,
                recomended_stock: null,
                reason_id: null,
                other_reason: "",
                confirmed_qty: 10,
                created_at: "2025-07-17T03:45:04.000Z",
                name_kfa_product_template:
                  "Abacavir Sulfate 120 mg / Lamivudine 60 mg Tablet Dispersible",
                material_category: "medicine",
                children: [],
                stock_vendor: {
                  min: 0,
                  max: 0,
                  on_hand_stock: 1999990,
                  available_stock: 1999990,
                  allocated_stock: 0,
                },
                stock_customer: {
                  min: 0,
                  max: 0,
                  on_hand_stock: 10983520,
                  available_stock: 10980164,
                  allocated_stock: 3356,
                },
              },
            ],
          },
        },
      },
    },
  },
})

// New route for GET /v2/orders
export const getOrdersRoute = createRoute({
  method: "get",
  path: "/v2/orders",
  summary: "Get Orders List",
  description: "Retrieve a paginated list of orders with filters",
  tags: tags,
  security: [{ Bearer: [] }],
  request: {
    query: GetOrdersQuerySchema,
  },
  responses: {
    200: {
      description: "Paginated list of orders",
      content: {
        "application/json": {
          schema: z.object({
            total: z.number(),
            page: z.string(),
            perPage: z.string(),
            list: z.array(OrderListItemSchema),
          }),
          example: {
            total: 22605,
            page: "1",
            perPage: "10",
            list: [
              {
                id: 208703,
                device_type: 1,
                customer_id: 22556,
                vendor_id: 18308,
                status: 5,
                type: 2,
                required_date: "2025-02-19T00:00:00.000Z",
                estimated_date: null,
                actual_shipment: "2025-02-17T06:54:52.000Z",
                purchase_ref: null,
                sales_ref: null,
                reason: null,
                cancel_reason: null,
                delivery_number: null,
                confirmed_at: "2025-02-19T06:54:33.000Z",
                shipped_at: "2025-02-19T06:54:52.000Z",
                fulfilled_at: "2025-02-19T00:00:00.000Z",
                cancelled_at: null,
                allocated_at: "2025-02-19T06:54:45.000Z",
                created_at: "2025-02-19T06:54:33.000Z",
                updated_at: "2025-02-19T07:31:42.000Z",
                is_allocated: 1,
                taken_by_customer: 0,
                other_reason: null,
                is_kpcpen: null,
                qty_kpcpen: null,
                master_order_id: null,
                easygo_no_do: null,
                biofarma_changed: null,
                service_type: null,
                no_document: null,
                released_date: null,
                notes: null,
                activity_id: 1,
                is_manual: null,
                no_po: null,
                created_by: 3199,
                customer: {
                  type_label: "FASKES",
                  id: 22556,
                  name: "PUSKESMAS PLAYEN  I",
                  address: "Sumberejo Desa Ngawu, Kec. Playen",
                  code: "1032332",
                  type: 3,
                  status: 1,
                  created_at: "2021-01-21T02:25:05.000Z",
                  updated_at: "2024-02-21T15:48:49.000Z",
                  deleted_at: null,
                  province_id: "34",
                  regency_id: "3403",
                  village_id: null,
                  sub_district_id: "340303",
                  lat: null,
                  lng: "107",
                  postal_code: null,
                  is_vendor: 1,
                  bpom_key: null,
                  is_puskesmas: 1,
                  rutin_join_date: "2023-01-01T00:00:00.000Z",
                  is_ayosehat: 0,
                  mapping_entity: {
                    id: 658,
                    id_entitas_smile: 22556,
                    id_pusdatin: null,
                    id_bpjs: null,
                    id_satu_sehat: 1000067187,
                  },
                },
                vendor: {
                  type_label: "KOTA",
                  id: 18308,
                  name: "DINKES KAB. GUNUNG KIDUL",
                  address: "-",
                  code: "3403",
                  type: 2,
                  status: 1,
                  created_at: "2021-01-19T03:43:38.000Z",
                  updated_at: "2024-06-13T11:35:56.000Z",
                  deleted_at: null,
                  province_id: "34",
                  regency_id: "3403",
                  village_id: null,
                  sub_district_id: null,
                  lat: "-7.9633865",
                  lng: "110.6030957",
                  postal_code: null,
                  is_vendor: 1,
                  bpom_key: null,
                  is_puskesmas: 0,
                  rutin_join_date: "2023-01-01T00:00:00.000Z",
                  is_ayosehat: 0,
                  mapping_entity: {
                    id: 237,
                    id_entitas_smile: 18308,
                    id_pusdatin: null,
                    id_bpjs: null,
                    id_satu_sehat: 1000723298,
                  },
                },
                activity: {
                  id: 1,
                  name: "Malaria - Rutin",
                },
                user_confirmed_by: {
                  id: 3199,
                  username: "d3403_far",
                  email: "logistikgnkidul1@email.com",
                  firstname: "DINKES KAB. GUNUNG KIDUL",
                  lastname: null,
                },
                user_shipped_by: {
                  id: 3199,
                  username: "d3403_far",
                  email: "logistikgnkidul1@email.com",
                  firstname: "DINKES KAB. GUNUNG KIDUL",
                  lastname: null,
                },
                user_fulfilled_by: {
                  id: 3274,
                  username: "p12031301_far",
                  email: "logistikgnkidul76@email.com",
                  firstname: "PUSKESMAS PLAYEN  I",
                  lastname: null,
                },
                user_cancelled_by: null,
                user_allocated_by: {
                  id: 3199,
                  username: "d3403_far",
                  email: "logistikgnkidul1@email.com",
                  firstname: "DINKES KAB. GUNUNG KIDUL",
                  lastname: null,
                },
                user_created_by: {
                  id: 3199,
                  username: "d3403_far",
                  email: "logistikgnkidul1@email.com",
                  firstname: "DINKES KAB. GUNUNG KIDUL",
                  lastname: null,
                },
                user_updated_by: {
                  id: 3274,
                  username: "p12031301_far",
                  email: "logistikgnkidul76@email.com",
                  firstname: "PUSKESMAS PLAYEN  I",
                  lastname: null,
                },
                user_deleted_by: null,
                order_items: [
                  {
                    id: 133240270,
                    qty: 10,
                    master_material_id: 42,
                    recommended_stock: null,
                    master_material: {
                      id: 42,
                      name: "Primaquine Phosphate 15 mg Tablet (PHAPROS)",
                      unit_of_distribution: "",
                      code: "93001605",
                      description: "92000624_Primaquine Phosphate 15 mg Tablet",
                      pieces_per_unit: 1,
                      unit: "Tablet",
                      temperature_sensitive: 0,
                      temperature_min: 0,
                      temperature_max: 0,
                      managed_in_batch: 1,
                      status: 1,
                      is_vaccine: 1,
                      is_stockcount: 0,
                      is_addremove: 1,
                      updated_at: "2024-07-17T23:23:20.000Z",
                      is_openvial: 0,
                      kfa_code: "93001605",
                      need_sequence: null,
                      parent_id: 511,
                      kfa_level_id: 3,
                      mapping_materials: [
                        {
                          id: 458,
                          id_material_smile: 42,
                          code_kfa_ingredients: "91000511",
                          code_kfa_product_template: "92000624",
                          code_kfa_product_variant: "93001605",
                          code_kfa_packaging: null,
                          code_sitb: null,
                          code_siha: null,
                          id_kfa: null,
                          code_biofarma: null,
                          code_bpom: null,
                          name_material_smile: null,
                          name_kfa_ingredients:
                            "Primaquine Phosphate 15 mg Tablet",
                          name_kfa_product_template:
                            "Primaquine Phosphate 15 mg Tablet",
                          name_kfa_product_variant:
                            "Primaquine Phosphate 15 mg Tablet (PHAPROS)",
                          name_kfa_packaging: null,
                          name_sitb: null,
                          name_siha: null,
                        },
                      ],
                    },
                    material_id: 42,
                  },
                ],
              },
            ],
          },
        },
      },
    },
  },
})

export const entitiesRoute = createRoute({
  method: "get",
  path: "/entities",
  summary: "Get Entities",
  description: "Retrieve entities with filtering options",
  tags: tags,
  security: [{ Bearer: [] }],
  request: {
    query: EntitiesQueryParamsSchema,
  },
  responses: {
    200: {
      description: "Entities list",
      content: {
        "application/json": {
          schema: EntitiesResponseSchema,
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

export const materialsRoute = createRoute({
  method: "get",
  path: "/v2/materials",
  summary: "Get Materials",
  description: "Retrieve materials with pagination",
  tags: tags,
  security: [{ Bearer: [] }],
  request: {
    query: MaterialsQueryParamsSchema,
  },
  responses: {
    200: {
      description: "Materials list",
      content: {
        "application/json": {
          schema: MaterialsResponseSchema,
          example: {
            total: 82,
            page: "1",
            perPage: "1",
            list: [
              {
                id: 56,
                name: "ADS 0.05 ml Kampanye (buah)",
                code: "ADS 0.05 ml Kampanye (buah)",
                description: "ADS 0.05 ml Kampanye (buah)",
                pieces_per_unit: 1,
                unit: "buah",
                temperature_sensitive: 0,
                temperature_min: 0,
                temperature_max: 0,
                managed_in_batch: 1,
                status: 1,
                is_vaccine: 1,
                is_stockcount: 0,
                bpom_code: null,
                is_addremove: 1,
                updated_at: "2022-02-23T10:49:51.000Z",
                material_tags: [
                  {
                    id: 1,
                    title: "Imunisasi Rutin",
                    is_ordered_sales: 1,
                    is_ordered_purchase: 1,
                  },
                ],
                manufactures: [
                  {
                    id: 1,
                    name: "Biofarma",
                  },
                  {
                    id: 6,
                    name: "Oneject",
                  },
                ],
                material_companion: [
                  {
                    id: 49,
                    name: "ADS 0.5 ml BIAS (buah)",
                  },
                ],
                user_created_by: {
                  id: 3,
                  username: "bantenprov",
                  email: "syahrulfirdaus@gmail.com",
                  firstname: "Syahrul",
                  lastname: "Firdaus",
                },
                user_updated_by: {
                  id: 47931,
                  username: "kaya",
                  email: "eko4@badr-interactive.com",
                  firstname: "kaya",
                  lastname: null,
                },
                user_deleted_by: null,
              },
            ],
          },
        },
      },
    },
  },
})

export const manufacturesRoute = createRoute({
  method: "get",
  path: "/manufactures",
  summary: "Get Manufactures",
  description: "Retrieve manufactures with pagination",
  tags: tags,
  security: [{ Bearer: [] }],
  request: {
    query: ManufacturesQueryParamsSchema,
  },
  responses: {
    200: {
      description: "Manufactures list",
      content: {
        "application/json": {
          schema: ManufacturesResponseSchema,
          example: {
            total: 346,
            page: 1,
            perPage: 10,
            list: [
              {
                id: 1,
                name: "Biofarma",
                reference_id: "Biofarma",
                description: null,
                contact_name: "Biofarma",
                phone_number: "081388934108",
                email: "admin@example.com",
                address: null,
                status: 1,
                type: 1,
                is_asset: 0,
                updated_at: "2024-12-23T08:09:17.000Z",
                updated_by: 3,
                materials: [],
                user_created_by: {
                  id: 17191,
                  username: "p1033009_mal",
                  email: "puskesmassugihwaras4@logistik-smile.id",
                  firstname: "User ATM",
                  lastname: "PUSKESMAS SUGIHWARAS",
                },
                user_updated_by: {
                  id: 3,
                  username: "admin02",
                  email: "admin@malaria.com",
                  firstname: "Admin",
                  lastname: "02",
                },
                user_deleted_by: null,
              },
              {
                id: 2,
                name: "Chengdu",
                reference_id: "Chengdu",
                description: null,
                contact_name: "Zuniar",
                phone_number: "081300000005",
                email: "zuniar@badr-interactive.com",
                address: "Rukan Graha Depok Mas",
                status: 1,
                type: 1,
                is_asset: 0,
                updated_at: "2024-12-26T04:04:01.000Z",
                updated_by: 2040,
                materials: [],
                user_created_by: {
                  id: 1,
                  username: "awwah",
                  email: "awwah@badr-interactive.com",
                  firstname: "Awwah (Badr)",
                  lastname: null,
                },
                user_updated_by: {
                  id: 2040,
                  username: "zun",
                  email: "zun@badr-interactive.com",
                  firstname: "zun",
                  lastname: null,
                },
                user_deleted_by: null,
              },
              {
                id: 3,
                name: "Industri Farmasi (UMUM)",
                reference_id: "PBF",
                description: null,
                contact_name: null,
                phone_number: "081300000001",
                email: null,
                address: null,
                status: 1,
                type: 1,
                is_asset: 0,
                updated_at: "2024-04-01T08:50:03.000Z",
                updated_by: 232,
                materials: [],
                user_created_by: {
                  id: 1,
                  username: "awwah",
                  email: "awwah@badr-interactive.com",
                  firstname: "Awwah (Badr)",
                  lastname: null,
                },
                user_updated_by: {
                  id: 232,
                  username: "febri",
                  email: "febri.syahputra@undp.org",
                  firstname: "Febri",
                  lastname: "Syahputra",
                },
                user_deleted_by: null,
              },
            ],
          },
        },
      },
    },
  },
})

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
          schema: LoginRequestSchema,
          example: {
            username: "sitb_demo_v5",
            password: "[REDACTED]",
          },
        },
      },
    },
  },
  responses: {
    200: {
      description: "User info",
      content: {
        "application/json": {
          schema: LoginResponseSchema,
          example: {
            id: 47732,
            username: "user_name",
            email: "user_name@gmail.com",
            firstname: "nama Awal",
            lastname: "Kemenkes RI",
            gender: 1,
            date_of_birth: null,
            role: 6,
            token_login:
              "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.PYeTxwEY2HRZER5U1O6OPENWa52Oa2BCtQoxxxxxxxxxx",
            village_id: null,
            entity_id: 1,
            timezone_id: null,
            status: 1,
            view_only: 1,
            change_password: 0,
            entity: {
              id: 1,
              name: "Kemenkes RI",
              address: "Bandung",
              type: 97,
              province_id: null,
              regency_id: null,
              sub_district_id: null,
              village_id: null,
              province: null,
              regency: null,
              sub_district: null,
              village: null,
            },
            last_login: "2021-03-22T10:36:38.000Z",
            updated_at: "2021-03-22T10:36:38.759Z",
          },
        },
      },
    },
  },
})

export const budgetSourcesRoute = createRoute({
  method: "get",
  path: "/budget-sources",
  summary: "Get Budget Sources",
  description: "Retrieve a paginated list of budget sources",
  tags: tags,
  security: [{ Bearer: [] }],
  request: {
    query: BudgetSourceQueryParamsSchema,
  },
  responses: {
    200: {
      description: "Paginated list of budget sources",
      content: {
        "application/json": {
          schema: z.object({
            total: z.number(),
            page: z.number(),
            perPage: z.number(),
            list: z.array(
              z.object({
                id: z.number(),
                name: z.string(),
                description: z.string().nullable(),
                status: z.number(),
                created_at: z.string().nullable(),
                updated_at: z.string().nullable(),
              })
            ),
          }),
          example: {
            total: 5,
            page: 1,
            perPage: 10,
            204: {
              description: "Order created",
            },
            422: {
              description: "Invalid request body",
            },
          },
        },
      },
    },
  },
})
