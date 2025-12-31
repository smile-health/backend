import { Hono } from "hono"
import { stream } from "hono/streaming"
import { BaseController } from "../base.controller.js"
import { ExportHistoryModule } from "./export-history.module.js"
import {
  DownloadFileParams,
  GetExportHistoriesQueries,
} from "./export-history.schema.js"

export class ExportHistoryController extends BaseController {
  constructor(private readonly module: ExportHistoryModule) {
    super()
  }

  public getRoutes(): Hono {
    const app = new Hono()

    app.get(
      "/",
      this.validateRequest("query", GetExportHistoriesQueries),
      async (c) => {
        const params = c.req.valid("query")
        const result = await this.module.getAll(c, params)
        return c.json(result)
      }
    )

    app.get(
      "/:file/download",
      this.validateRequest("param", DownloadFileParams),
      async (c) => {
        const { file } = c.req.valid("param")
        const { stream: fileStream, filename } = await this.module.downloadFile(
          c,
          file
        )

        c.header("Content-Disposition", `attachment; filename="${filename}"`)
        c.header(
          "Content-Type",
          filename.endsWith(".zip")
            ? "application/zip"
            : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        )

        return stream(c, async (stream) => {
          for await (const chunk of fileStream) {
            await stream.write(chunk)
          }
        })
      }
    )

    return app
  }
}
