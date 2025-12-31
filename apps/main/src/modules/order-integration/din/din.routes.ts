import { createRoute } from "@hono/zod-openapi"
import {
  CreateOrderResponseSchema,
  LoginRequestSchema,
  OrderDinRequestSchema,
} from "./din.schemas.js"

const tags = ["DIN Integration"]

export const postPickingOrderRoute = createRoute({
  method: "post",
  path: "/ssl/ifp/picking/order",
  summary: "Post Picking Order",
  description: "Create a new picking order in DIN integration",
  tags: tags,
  security: [{ Bearer: [] }],
  request: {
    body: {
      content: {
        "application/json": {
          schema: OrderDinRequestSchema,
          example: {
            key: "ec835359-5b65-4e28-9674-3727cc39a5cd",
            doc_num: "SJ/202207/00001",
            ref_num: "OT2-P2208-1295139",
            code: "ifp-out-dist",
            line: "smile",
            line_ref: "OT2-P2208-1295139",
            carrier_ref: "AWB12323450",
            carrier: "JNE",
            sumber_dana: "APBN", // (table view ws_budget_sources, column name)
            program: ["mr"], // kalau bisa ini ada
            biaya_transport: 500000,
            total_transaksi: 700000,
            status: "ship",
            pengirim: {
              type: "kemkes",
              kode: "123456789",
              nama: "Kemenkes RI",
              alamat: "Bandung",
              kodepos: "10410",
              provinsi: "Jakarta",
              provinsi_code: "31",
              kabkota: "Jakarta Pusat",
              kabkota_code: "3171",
              kecamatan: "Senen",
              kecamatan_code: "317104",
              kelurahan: "Senen",
              kelurahan_code: "3171041001",
            },
            penerima: {
              type: "kemkes",
              kode: "1000720789",
              nama: "RSPAD Gatot Subroto",
              alamat: "Jl. Abdul Rahman Saleh Raya No.24",
              kodepos: "10410",
              provinsi: "Jakarta",
              provinsi_code: "31",
              kabkota: "Jakarta Pusat",
              kabkota_code: "3171",
              kecamatan: "Senen",
              kecamatan_code: "317104",
              kelurahan: "Senen",
              kelurahan_code: "3171041001",
            },
            note: "Catatan",
            created_by: "DIN Admin",
            updated_by: "DIN Admin",
            created_at: "2022-07-30 01:24:53",
            updated_at: "2022-07-30 01:24:53",
            data: [
              {
                lot_no: "D098301", //column code (table ws_batch)
                tgl_kadaluarsa: "2022-07-30", //column expired_date (table ws_batch)
                tgl_produksi: "2022-07-30", //column expired_date (table ws_batch)
                product_name: "Aciclovir 200 mg Tablet (Kimia Farma)",
                kfa_code: "93001089", //column code (table materials)
                qty: 1000, //(table ws_stocks, intransit_qty -> vendor, unreceived_qty ->customer)
                unit: "Tablet", //column unit_of_distribution_id (table materials, berelasi dgn table material_units)
                unit_price: 200, // (table ws_stocks, column price), (table ws_purchase, column price)
                total_price: 200000, // (table ws_stocks, column price), (table ws_purchase, column price)
                note: "",
              },
              {
                lot_no: "WIWA-002-01",
                tgl_kadaluarsa: "2022-07-30",
                tgl_produksi: "2022-07-30",
                product_name: "93_WIWA|BATCH-02",
                kfa_code: "010",
                qty: 1000,
                unit: "Tablet",
                unit_price: 200,
                total_price: 200000,
                note: "",
              },
              {
                lot_no: "WIWA-002-02",
                tgl_kadaluarsa: "2022-07-30",
                tgl_produksi: "2022-07-30",
                product_name: "93_WIWA|BATCH-02",
                kfa_code: "010",
                qty: 1000,
                unit: "Tablet",
                unit_price: 200,
                total_price: 200000,
                note: "",
              },
              {
                lot_no: "",
                tgl_kadaluarsa: "2022-07-30",
                tgl_produksi: "2022-07-30",
                product_name: "93_WIWA|BATCH-02",
                kfa_code: "222",
                qty: 1000,
                unit: "Tablet",
                unit_price: 200,
                total_price: 200000,
                note: "",
              },
            ],
          },
        },
      },
    },
  },
  responses: {
    200: {
      description: "Success post data",
      content: {
        "application/json": {
          schema: CreateOrderResponseSchema,
          example: {
            success: true,
            code: 200,
            message: "Success post data",
          },
        },
      },
    },
  },
})

export const authLoginRoute = createRoute({
  method: "post",
  path: "/ifp/auth",
  summary: "User Login",
  description: "Authenticate user and return user info",
  tags: tags,
  request: {
    body: {
      content: {
        "application/x-www-form-urlencoded": {
          schema: LoginRequestSchema,
          example: {
            username: "dto_din",
            password: "[REDACTED]",
          },
        },
      },
    },
  },
  responses: {
    200: {
      description: "Success post data",
      content: {
        "application/json": {
          schema: {},
          example: {
            access_token: "access_token",
            token_type: "bearer",
            expires_in: 1440,
          },
        },
      },
    },
  },
})
