import env from "@/config/env.js"
import { Context } from "hono"

export class FallbackModule {
  async fallback(c: Context) {
    const headers = c.req.header()
    const queryString = new URLSearchParams(c.req.query()).toString()

    // Forward the request to the old app
    const cleanedPath = c.req.path.replace(
      /(\/fallback|\/platform|\/platform\/fallback)/g,
      ""
    )
    let url = `${env.FALLBACK_SERVER_URL}${cleanedPath}?${queryString}`
    if (cleanedPath.includes("warehouse-report")) {
      // Use fallback warehouse report URL from environment or default to FALLBACK_SERVER_URL
      const fallbackWarehouseReportUrl =
        (env as any).FALLBACK_WAREHOUSE_REPORT_URL || env.FALLBACK_SERVER_URL
      url = `${fallbackWarehouseReportUrl}${cleanedPath}?${queryString}`
    }
    console.log("------------url-------------", cleanedPath, url)

    // Filter out undefined headers to satisfy HeadersInit type
    const fetchHeaders: Record<string, string> = {}
    if (headers["authorization"])
      fetchHeaders.authorization = headers["authorization"]
    if (headers["content-type"])
      fetchHeaders["content-type"] = headers["content-type"]

    return await fetch(url, {
      method: c.req.method,
      headers: fetchHeaders,
      body: c.req.method !== "GET" ? await c.req.text() : null,
    })
  }
}
