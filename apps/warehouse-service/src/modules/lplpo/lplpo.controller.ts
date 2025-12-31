import { BaseController } from "@smile/lib/base/controller.js"
import { LplpoModule } from "./lplpo.module.js"
import { StatusCodes } from "http-status-codes"
import { Hono } from "hono"
import { redis } from "@/common/infrastructure/redis.js"
import { RoleMiddleware } from "@/common/middlewares/role-validation.middleware.js"
import { USER_ROLE } from "@/common/constants/role.js"
import { DEVICE_TYPE } from "@/common/constants/headers.js"
import moment from "moment"
import {
  LplpoQueryParamsExportSchema,
  LplpoQueryParamsSchema,
} from "./lplpo.schema.js"
import { LplpoExcel } from "./lplpo.excel.js"

export class LplpoController extends BaseController {
  constructor(
    private module: LplpoModule,
    private readonly roleMiddleware: RoleMiddleware
  ) {
    super()
  }
  getRoutes(): Hono {
    const router = new Hono()

    router.use(
      this.roleMiddleware.allowWithDeviceType([
        [USER_ROLE.SUPERADMIN, DEVICE_TYPE.web],
        [USER_ROLE.ADMIN, DEVICE_TYPE.web],
        [USER_ROLE.MANAGER, DEVICE_TYPE.web],
      ])
    )

    router.get(
      "/lplpo",
      this.validateRequest("query", LplpoQueryParamsSchema),
      async (c) => {
        const page = c.req.query("page") || 1
        const limit = c.req.query("paginate") || 10

        const lplpoRepository = await this.module.getLplpoRepository(
          c,
          Number(page),
          Number(limit),
          c.req.valid("query")
        )
        let response = lplpoRepository

        // Group data by parent_material_id and sum quantities
        const groupedData = response.reduce((acc: any, item: any) => {
          const key = item.parent_material_id

          if (!acc[key]) {
            // Initialize group with first item's data
            acc[key] = {
              program_id: item.program_id,
              transactions_activity_id: item.transactions_activity_id,
              transactions_activity_name: item.transactions_activity_name,
              province_id: item.province_id,
              province_name: item.province_name,
              regency_id: item.regency_id,
              regency_name: item.regency_name,
              entity_id: item.entity_id,
              entities_name: item.entities_name,
              date: item.date,
              parent_material_id: item.parent_material_id,
              parent_material_name: item.parent_material_name,
              dmm_unit_of_consumption_name: item.dmm_unit_of_consumption_name,
              // Sum quantities
              opening_qty: 0,
              received_qty: 0,
              consumption_qty: 0,
              closing_qty: 0,
              // Initialize budget source flags
              budget_source: {
                apbd_1: 0,
                apbd_2: 0,
                apbn: 0,
                dak: 0,
                other: 0,
              },
              // Keep track of all budget sources for debugging
              budget_sources_found: new Set(),
              // Keep track of batches for reference
              batches: [],
            }
          }

          // Sum the quantities
          acc[key].opening_qty += Number(item.opening_qty) || 0
          acc[key].received_qty += Number(item.received_qty) || 0
          acc[key].consumption_qty += Number(item.consumption_qty) || 0
          acc[key].closing_qty += Number(item.closing_qty) || 0

          // Track and aggregate budget sources from all items
          if (item.budget_source_name) {
            acc[key].budget_sources_found.add(item.budget_source_name)

            // Set budget source flags based on current item
            if (item.budget_source_name === "APBD-I") {
              acc[key].budget_source.apbd_1 = 1
            } else if (item.budget_source_name === "APBD-II") {
              acc[key].budget_source.apbd_2 = 1
            } else if (item.budget_source_name === "APBN") {
              acc[key].budget_source.apbn = 1
            } else if (item.budget_source_name === "DAK") {
              acc[key].budget_source.dak = 1
            } else if (
              item.budget_source_name !== "" &&
              item.budget_source_name !== null &&
              item.budget_source_name !== undefined
            ) {
              // Any other non-empty budget source
              acc[key].budget_source.other = 1
            }
          }

          // Add batch info if needed for reference
          // if (item.batches_code) {
          //   acc[key].batches.push({
          //     code: item.batches_code,
          //     expired_date: item.expired_date,
          //   })
          // }

          return acc
        }, {})

        // Convert grouped object to array
        const groupedArray = Object.values(groupedData)

        // Clean up and add debugging
        let debugCount = 0
        groupedArray.forEach((item: any) => {
          // Convert Set to Array for logging and remove it from final data
          const budgetSourcesFound = Array.from(item.budget_sources_found)
          delete item.budget_sources_found

          // Log budget sources found for this material (only for first few items)
          if (debugCount < 5) {
            console.log(
              `Material ${item.parent_material_id} (${item.parent_material_name}):`,
              {
                budget_sources_found: budgetSourcesFound,
                budget_source_flags: item.budget_source,
              }
            )
            debugCount++
          }
        })

        console.log("LPLPO Grouped Data:", groupedArray.length)
        console.log("Sample grouped item:", groupedArray[0])

        // Transform data to match required response format
        let transformedData = groupedArray.map((item: any, index: number) => ({
          number: index + 1 + (Number(page) - 1) * Number(limit),
          province_name: item.province_name || null,
          regency_name: item.regency_name || null,
          sub_district_name: null, // Not available in current data
          entity_name: item.entities_name || null,
          id: item.parent_material_id,
          parent_material_id: item.parent_material_id,
          kfa_code: null, // Not available in current data structure
          name: item.parent_material_name || null,
          unit: item.dmm_unit_of_consumption_name || null,
          opening_qty: item.opening_qty || 0,
          received_qty: item.received_qty || 0,
          ordered_qty: 0, // Not available in current data
          issues_qty: item.consumption_qty || 0,
          closing_qty: item.closing_qty || 0,
          budget_source: {
            apbd_1: item.budget_source.apbd_1,
            apbd_2: item.budget_source.apbd_2,
            apbn: item.budget_source.apbn,
            dak: item.budget_source.dak,
            other: item.budget_source.other,
          },
          information: null,
        }))

        let parentMaterialByEntity =
          await this.module.getParentMaterialByEntity(
            c,
            c.req.valid("query").entity_id,
            "parent"
          )

        let parentMaterialExisting = transformedData.map(
          (d) => d.parent_material_id
        )

        parentMaterialByEntity = parentMaterialByEntity.filter(
          (item) => !parentMaterialExisting.includes(item.parent_material_id)
        )

        parentMaterialByEntity = parentMaterialByEntity.map(
          (item: any, index: number) => ({
            number:
              transformedData.length +
              index +
              1 +
              (Number(page) - 1) * Number(limit),
            province_name: item.province_name || null,
            regency_name: item.regency_name || null,
            sub_district_name: null, // Not available in current data
            entity_name: item.entities_name || null,
            id: item.parent_material_id,
            parent_material_id: item.parent_material_id,
            kfa_code: null, // Not available in current data structure
            name: item.parent_material_name || null,
            unit: item.dmm_unit_of_consumption_name || null,
            opening_qty: 0,
            received_qty: 0,
            ordered_qty: 0, // Not available in current data
            issues_qty: 0,
            closing_qty: 0,
            budget_source: {
              apbd_1: 0,
              apbd_2: 0,
              apbn: 0,
              dak: 0,
              other: 0,
            },
            information: null,
          })
        )

        transformedData.push(...parentMaterialByEntity)

        transformedData = transformedData.sort((a, b) =>
          a.name.localeCompare(b.name)
        )

        const totalData = transformedData.length
        const totalPages = Math.ceil(totalData / Number(limit))
        const currentPage = Number(page)
        const startIndex = (currentPage - 1) * Number(limit)
        const endIndex = startIndex + Number(limit)
        const limitedResponse = transformedData.slice(startIndex, endIndex)

        // Update numbering for paginated results
        const paginatedData = limitedResponse.map(
          (item: any, index: number) => ({
            ...item,
            number: index + 1 + startIndex,
          })
        )

        const responseData = {
          last_updated: moment().format("YYYY-MM-DD HH:mm:ss"),
          data: paginatedData,
          page: currentPage,
          total_item: totalData,
          total_page: totalPages,
          list_pagination: [10, 25, 50, 100],
        }

        return c.json(responseData, StatusCodes.OK)
      }
    )

    router.get(
      "/lplpo/export",
      this.validateRequest("query", LplpoQueryParamsExportSchema),
      async (c) => {
        const queryParams = c.req.valid("query")
        const result = await this.module.exportReport(c, {
          ...queryParams,
          programId: String(c.var?.programId),
        })
        return c.json(result, StatusCodes.OK)
      }
    )

    router.get(
      "/lplpo/export/all",
      this.validateRequest("query", LplpoQueryParamsExportSchema),
      async (c) => {
        const queryParams = c.req.valid("query")

        const result = await this.module.exportAllReport(c, {
          ...queryParams,
          programId: String(c.var?.programId),
        })

        return c.json(result, StatusCodes.OK)
      }
    )

    return router
  }
}
