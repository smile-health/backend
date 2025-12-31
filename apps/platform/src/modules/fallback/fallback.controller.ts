import { FallbackModule } from "./fallback.module.js"
import { Context } from "hono"
import { StatusCode } from "hono/utils/http-status"

export class FallbackController {
  constructor(private module: FallbackModule) {}

  public handle = async (c: Context) => {
    const resp = await this.module.fallback(c)
    const rawResp = await resp.text()
    return c.body(rawResp, resp.status as StatusCode, {
      "Content-Type": "application/json",
    })
  }
}
