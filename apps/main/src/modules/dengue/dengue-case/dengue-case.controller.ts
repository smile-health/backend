import { BaseController } from "@smile/lib/base/controller.js"
import { DengueCaseModule } from "./dengue-case.module.js"
import { DengueCaseMiddleware } from "./dengue-case.middleware.js"
import { Hono } from "hono"
import { StatusCodes } from "http-status-codes"
import { ExcelMiddleware } from "@smile/lib/middlewares/excel.middleware.js"
import { DengueCaseTemplate } from "./dengue-case.excel.js"

export class DengueCaseController extends BaseController {
  constructor(
    private readonly module: DengueCaseModule,
    private readonly middleware: DengueCaseMiddleware,
    private readonly excelMiddleware: ExcelMiddleware
  ) {
    super()
  }

  getRoutes(): Hono {
    const router = new Hono()

    router.get(
      "/nik/:nik",
      this.validateRequest("param", this.middleware.validateNIK),
      async (c) => {
        const param = c.req.valid("param")
        const response = await this.module.getDetailIdentity(c, param.nik)

        return c.json(response, StatusCodes.OK)
      }
    )

    router.get(
      "/equipments",
      this.validateRequest("query", this.middleware.validateEquipments),
      async (c) => {
        const query = c.req.valid("query")
        const response = await this.module.listEquipment(c, query)

        return c.json(response, StatusCodes.OK)
      }
    )

    router.get("/clinical_diagnosis", async (c) => {
      const response = await this.module.listClinicalDiagnosis(c)

      return c.json({ data: response }, StatusCodes.OK)
    })

    router.get("/last_status", async (c) => {
      const response = await this.module.listLastStatus(c)

      return c.json({ data: response }, StatusCodes.OK)
    })

    router.get("/vector_control", async (c) => {
      const response = await this.module.listVectorControl(c)

      return c.json({ data: response }, StatusCodes.OK)
    })

    router.get("/examination_method", async (c) => {
      const response = await this.module.listExaminationMethod(c)

      return c.json({ data: response }, StatusCodes.OK)
    })

    router.get("/examination_result", async (c) => {
      const response = await this.module.listExaminationResult(c)

      return c.json({ data: response }, StatusCodes.OK)
    })

    router.get(
      "/laboratory",
      this.validateRequest("query", this.middleware.validateLaboratory),
      async (c) => {
        const query = c.req.valid("query")
        const response = await this.module.listLaboratory(c, query)

        return c.json(response, StatusCodes.OK)
      }
    )

    router.get(
      "/reagents",
      this.validateRequest("query", this.middleware.validateReagents),
      async (c) => {
        const query = c.req.valid("query")
        const response = await this.module.listReagent(c, query)

        return c.json(response, StatusCodes.OK)
      }
    )

    router.get("/symptoms", async (c) => {
      const response = await this.module.listSymptoms(c)

      return c.json({ data: response }, StatusCodes.OK)
    })

    router.get("/specimen_type", async (c) => {
      const response = await this.module.listSpecimenType(c)

      return c.json({ data: response }, StatusCodes.OK)
    })

    router.get(
      "/xls-template",
      async (c) => {
        const file = await this.module.template(c)

        const base64 = Buffer.from(file.buffer).toString('base64')

        return c.json({
          filename: file.filename,
          base64: base64,
          mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        })
      }
    )

    router.get(
      "/xls",
      this.validateRequest("query", this.middleware.list),
      this.middleware.checkDataBeforeExport,
      async (c) => {
        const query = c.req.valid("query")
        const file = await this.module.exportCaseReport(c, query)

        const base64 = Buffer.from(file.buffer).toString('base64')

        return c.json({
          filename: file.filename,
          base64: base64,
          mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        })
      },
    )

    router.post(
      "/xls",
      this.excelMiddleware.validateFileMiddleware,
      this.validateExcelRequest(
        this.middleware.import,
        new DengueCaseTemplate(),
        this.middleware.validateImport
      ),
      async (c) => {
        const rows = c.req.valid("json")
        const result = await this.module.import(c, rows)

        return c.json(
          {
            status: true,
            message: `Successfully imported ${result.processed} records, failed imported ${result.duplicates} ${result.duplicates > 0 ? `on lines ${result.duplicate_rows.map((item) => `${item}`).join(", ")}` : ""}`,
            data: {
              total_rows: result.total_rows,
              processed: result.processed,
              duplicates: result.duplicates,
              duplicate_rows: result.duplicate_rows
            }
          },
          StatusCodes.OK
        )
      }
    )

    router.get(
      "/patients/records/:id",
      this.validateRequest("param", this.middleware.validatePatientId),
      this.validateRequest("query", this.middleware.validateRecords),
      async (c) => {
        const param = c.req.valid("param")
        const query = c.req.valid("query")
        const response = await this.module.getDetailReport(c, Number(param.id), query)

        return c.json(response, StatusCodes.OK)
      }
    )

    router.get(
      "/patients/:id",
      this.validateRequest("param", this.middleware.validateDengueId),
      async (c) => {
        const param = c.req.valid("param")
        const response = await this.module.getDetailPatient(c, Number(param.id))

        return c.json(response, StatusCodes.OK)
      }
    )

    router.get(
      "/patients",
      this.validateRequest("query", this.middleware.validatePatients),
      async (c) => {
        const query = c.req.valid("query")
        const response = await this.module.getPatients(c, query)

        return c.json(response, StatusCodes.OK)
      }
    )

    router.put(
      "/:id",
      this.validateRequest("param", this.middleware.validateDengueId),
      this.validateRequest("json", this.middleware.update),
      async (c) => {
        const param = c.req.valid("param")
        const body = c.req.valid("json")
        await this.module.updateCaseReport(c, Number(param.id), body)

        return c.json(
          {
            status: true,
            message: "Dengue case report updated successfully",
            data: [],
          },
          StatusCodes.OK
        )
      }
    )

    router.post(
      "/",
      this.validateRequest("json", this.middleware.create),
      async (c) => {
        const body = c.req.valid("json")
        await this.module.insertCaseRepot(c, body)

        return c.json(
          {
            status: true,
            message: "Dengue case report created successfully",
            data: [],
          },
          StatusCodes.CREATED
        )
      }
    )

    router.get(
      "/",
      this.validateRequest("query", this.middleware.list),
      async (c) => {
        const query = c.req.valid("query")
        const response = await this.module.list(c, query)

        return c.json(response, StatusCodes.OK)
      }
    )

    router.get(
      "/:id",
      this.validateRequest("param", this.middleware.validateDengueId),
      async (c) => {
        const param = c.req.valid("param")
        const response = await this.module.getDetailCaseReport(c, Number(param.id))

        return c.json(response, StatusCodes.OK)
      }
    )

    return router
  }
}
