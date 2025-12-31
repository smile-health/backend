import { BadRequestError } from "@smile/lib/error.js"
import { createMiddleware } from "hono/factory"

export class ExcelMiddleware {
  handleExport = (extension: string = "xlsx") =>
    createMiddleware(async (c, next) => {
      await next()

      const file = c.var.file
      if (!file) {
        throw new BadRequestError("failed to generate file")
      }

      const filename = c.var.file.filename
      const buffer = c.var.file.buffer

      c.res.headers.set(
        "Content-Disposition",
        `attachment; filename="${filename}.${extension}"`
      )
      c.res.headers.set("Access-Control-Expose-Headers", "Filename")
      c.res.headers.set("Filename", `${filename}.${extension}`)
      c.res.headers.set(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      )

      // Return the readable stream as the response
      return new Response(buffer, {
        headers: c.res.headers,
      })
    })
}
