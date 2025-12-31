import { createRoute } from "@hono/zod-openapi"
import { StatusCodes } from "http-status-codes"
import { z } from "zod"
import {
  IotHistoryRequestSchema,
  IotHistoryResponseSchema,
} from "./iot.schema.js"

const tags = ["IoT Integration"]

export const iotPushHistoriesRoute = createRoute({
  method: "post",
  path: "/v2/histories/push",
  summary: "Push IoT Histories",
  description: "Push IoT device history data",
  tags: tags,
  security: [{ Bearer: [] }],
  request: {
    body: {
      content: {
        "application/json": {
          schema: IotHistoryRequestSchema,
          example: [
            {
              device_id: "DXTLOG_F008D1D4BFCA",
              lat: "0",
              lon: "0",
              curr_temp: "-3",
              humidity: "60",
              actual_date: "2022-07-19 16:35:02",
              status_device: false,
              battery: 95,
              signal: 35,
              power: true,
            },
            {
              device_id: "DINKESKOTA001",
              lat: "1.2",
              lon: "-6",
              curr_temp: "5",
              humidity: "60",
              actual_date: "2021-08-17 01:02:40",
              status_device: true,
              battery: 95,
              signal: 35,
              power: true,
            },
          ],
        },
      },
    },
  },
  responses: {
    [StatusCodes.OK]: {
      description: "IoT Histories pushed successfully",
      content: {
        "application/json": {
          schema: IotHistoryResponseSchema,
          example: {
            data: [
              {
                device_id: "90090424663522350138",
                lat: "1",
                lon: "1",
                curr_temp: "8",
                message: "Success inserted",
                status: "Ok",
              },
              {
                device_id: "90090424663522350234",
                lat: "1",
                lon: "1",
                curr_temp: "7",
                message: "same data as the others",
                status: "Failed",
              },
            ],
            message: "Finish",
          },
        },
      },
    },
  },
})

export const iotWarehousePushHistoriesRoute = createRoute({
  method: "post",
  path: "/warehouse/histories/push",
  summary: "Push Warehouse IoT Histories",
  description:
    "Push IoT device history data for warehouse. Bettery and Signal defaults to 0 if not provided.",
  tags: tags,
  security: [{ Bearer: [] }],
  request: {
    body: {
      content: {
        "application/json": {
          schema: IotHistoryRequestSchema,
          example: [
            {
              device_id: "WAREHOUSE_LOGGER_001",
              lat: "0",
              lon: "0",
              curr_temp: "22",
              humidity: "60",
              actual_date: "2024-12-26 10:00:00",
              status_device: true,
              power: true,
            },
            {
              device_id: "WAREHOUSE_LOGGER_002",
              lat: "1.2",
              lon: "-6",
              curr_temp: "24",
              humidity: "55",
              actual_date: "2024-12-26 10:05:00",
              status_device: true,
              battery: 90,
              signal: 40,
              power: true,
            },
          ],
        },
      },
    },
  },
  responses: {
    [StatusCodes.OK]: {
      description: "Warehouse IoT Histories pushed successfully",
      content: {
        "application/json": {
          schema: IotHistoryResponseSchema,
          example: {
            data: [
              {
                device_id: "WAREHOUSE_LOGGER_001",
                lat: "0",
                lon: "0",
                curr_temp: "22",
                message: "Success inserted",
                status: "Ok",
              },
            ],
            message: "Finish",
          },
        },
      },
    },
  },
})

export const iotPostAssetsRoute = createRoute({
  method: "post",
  path: "/assets",
  summary: "Create Logger",
  description: "Create a new logger",
  tags: tags,
  security: [{ Bearer: [] }],
  request: {
    body: {
      content: {
        "application/json": {
          schema: z.object({
            type_id: z.number(),
            entity_id: z.number(),
            serial_number: z.string(),
            name: z.string(),
            prod_year: z.number(),
            model_id: z.number(),
            manufacture_id: z.number(),
            status: z.number(),
          }),
          example: {
            type_id: 7,
            entity_id: 31,
            serial_number: "SerialNumberHere",
            name: "nama asset",
            prod_year: 2000,
            model_id: 232,
            manufacture_id: 85,
            status: 1,
          },
        },
      },
    },
  },
  responses: {
    [StatusCodes.OK]: {
      description: "Asset created successfully",
      content: {
        "application/json": {
          schema: z.any(),
          example: {
            message: "Asset created successfully",
          },
        },
      },
    },
  },
})

export const iotGetAssetTypeRoute = createRoute({
  method: "get",
  path: "/asset-type",
  summary: "Get Asset Types",
  description: "Get a list of asset types",
  tags: tags,
  security: [{ Bearer: [] }],
  request: {
    query: z.object({
      page: z.string().optional(),
      paginate: z.string().optional(),
      keyword: z.string().optional(),
      asset_type_id: z.string().optional(),
    }),
  },
  responses: {
    [StatusCodes.OK]: {
      description: "Asset types retrieved successfully",
      content: {
        "application/json": {
          schema: z.any(),
          example: {
            total: 5,
            page: 1,
            perPage: 1000,
            list: [
              {
                id: 7,
                name: "Temperature Logger",
                created_at: "2021-05-07T02:50:17.000Z",
                updated_at: "2021-05-07T02:50:17.000Z",
              },
            ],
          },
        },
      },
    },
  },
})

export const iotGetAssetModelRoute = createRoute({
  method: "get",
  path: "/asset-model",
  summary: "Get Asset Models",
  description: "Get a list of asset models",
  tags: tags,
  security: [{ Bearer: [] }],
  request: {
    query: z.object({
      page: z.string().optional(),
      paginate: z.string().optional(),
      keyword: z.string().optional(),
    }),
  },
  responses: {
    [StatusCodes.OK]: {
      description: "Asset models retrieved successfully",
      content: {
        "application/json": {
          schema: z.any(),
          example: {
            total: 181,
            page: 1,
            perPage: "10",
            list: [
              {
                id: 3,
                name: "AB-600TC",
                capacity: 607,
                created_at: null,
                updated_at: null,
              },
            ],
          },
        },
      },
    },
  },
})

export const iotGetAssetsRoute = createRoute({
  method: "get",
  path: "/assets",
  summary: "Get Assets",
  description: "Get a list of assets",
  tags: tags,
  security: [{ Bearer: [] }],
  request: {
    query: z.object({
      page: z.string().optional(),
      paginate: z.string().optional(),
      manufacture_id: z.string().optional(),
    }),
  },
  responses: {
    [StatusCodes.OK]: {
      description: "Assets retrieved successfully",
      content: {
        "application/json": {
          schema: z.any(),
          example: {
            total: 44,
            perPage: 1,
            list: [
              {
                id: 4207,
                lat: 0,
                type_id: 1,
                min_temp: 2,
                max_temp: 8,
                lng: 0,
                created_at: "2021-04-26T23:41:24.000Z",
                updated_at: "2022-09-14T10:07:35.000Z",
                status: 1,
                serial_number: "80602900254422225365 ",
                prod_year: "2021",
                manufacture_id: 64,
                temp: "11",
                parent_id: null,
                working_status: "Working",
                budget_year: null,
                budget_src: null,
                entity: {
                  id: 11797,
                  name: "PUSKESMAS CISAUK",
                  address: "JL. RAYA LAPAN CISAUK",
                  code: "10050104",
                  village_id: null,
                  region_id: null,
                  province_id: "36",
                  regency_id: "3603",
                  sub_district_id: "360323",
                  created_by: 1,
                  updated_by: 1,
                  deleted_by: null,
                  type: 3,
                  created_at: "2031-12-20T15:00:00.000Z",
                  updated_at: "2021-01-11T10:18:28.000Z",
                  deleted_at: null,
                  province: {
                    id: "36",
                    name: "PROV. BANTEN",
                    created_at: "2020-12-02T09:43:31.000Z",
                    updated_at: "2020-12-02T09:43:31.000Z",
                    deleted_at: null,
                  },
                  regency: {
                    id: "3603",
                    name: "KAB. TANGERANG",
                    province_id: "36",
                    created_at: "2020-12-02T09:43:31.000Z",
                    updated_at: "2020-12-02T09:43:31.000Z",
                    deleted_at: null,
                    provinceId: "36",
                  },
                },
                asset_type: {
                  id: 1,
                  name: "ILR",
                  created_at: "2020-12-31T01:16:30.000Z",
                  updated_at: "2020-12-31T01:16:30.000Z",
                  deleted_at: null,
                  updated_by: null,
                  created_by: null,
                },
                asset_model: {
                  id: 1,
                  name: "BLF100AC",
                  capacity: 103,
                  updated_at: null,
                },
                manufacture: {
                  id: 64,
                  name: "Telkomsel IoT",
                  reference_id: "Tsel",
                  description: "",
                  contact_name: null,
                  phone_number: null,
                  email: "tsel@telkomsel.com",
                  address: null,
                  village_id: null,
                  created_by: 47403,
                  updated_by: 47403,
                  deleted_by: null,
                  created_at: "2021-03-30T13:07:48.000Z",
                  updated_at: "2021-04-23T09:48:22.000Z",
                  deleted_at: null,
                },
                childs: [],
                maintainers: null,
                created_by: null,
                updated_by: null,
                latest_log: null,
              },
            ],
          },
        },
      },
    },
  },
})
