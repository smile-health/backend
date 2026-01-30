import { USER_ROLE } from "@/common/constants/role.js"
import { RoleMiddleware } from "@/common/middlewares/role-validation.middleware.js"
import { Hono } from "hono"
import { BaseController } from "@smile-health/lib/base/controller.js"
import { StatusCodes } from "http-status-codes"
import { DEVICE_TYPE } from "@/common/constants/headers.js"
import { DownloadReportModule } from "./download-report.module.js"
import { codeParamSchema } from "./download-report.schema.js"
import fs from "fs"
import { Readable } from "stream"

export class DownloadReportController extends BaseController {
  constructor(
    private readonly module: DownloadReportModule,
    private readonly roleMiddleware: RoleMiddleware
  ) {
    super("download_report")
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

    router.get("/list", async (c) => {
      const response = await this.module.list(c)
      return c.json(response, StatusCodes.OK)
    })

    router.get(
      "/code/:code",
      this.validateRequest("param", codeParamSchema),
      this.validateRequest(
        "query",
        codeParamSchema.pick({ month: true, year: true })
      ),
      async (c) => {
        const pathParam = c.req.valid("param")
        const queryParam = c.req.valid("query")
        const param = { ...pathParam, ...queryParam }

        // bisa return {status, filePath} atau {status, buffer, filename}
        const result = await this.module.downloadByCode(c, param)

        if (!result.status) {
          return c.json(
            { message: c.var.t("validator.not_found", { field: "file" }) },
            StatusCodes.NOT_FOUND
          )
        }

        let fileStream: ReadableStream<Uint8Array>
        const filename = `${result.filename || "download"}.zip`

        if ("filePath" in result) {
          // === CASE LOCAL FILE ===
          const nodeStream = fs.createReadStream(result.filePath!)

          // hapus file setelah stream selesai
          nodeStream.on("close", () => {
            fs.unlink(result.filePath!, (err) => {
              if (err) {
                console.error("Gagal hapus file:", err)
              } else {
                console.log("File dihapus:", result.filePath)
              }
            })
          })

          fileStream = Readable.toWeb(nodeStream)
        } else if ("buffer" in result) {
          // === CASE MINIO (Buffer) ===
          // convert Buffer → Web ReadableStream
          const nodeStream = Readable.from(result.buffer!)
          fileStream = Readable.toWeb(nodeStream)
        } else {
          return c.json(
            { message: c.var.t("validator.not_found", { field: "file" }) },
            StatusCodes.NOT_FOUND
          )
        }

        // set headers
        c.res.headers.set(
          "Content-Disposition",
          `attachment; filename="${filename}"`
        )
        c.res.headers.set("Access-Control-Expose-Headers", "Filename")
        c.res.headers.set("Filename", filename)
        c.res.headers.set("Content-Type", "application/zip")

        return new Response(fileStream, { headers: c.res.headers })
      }
    )

    return router
  }
}
