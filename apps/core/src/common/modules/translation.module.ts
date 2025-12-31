import { Context } from "hono"
export class TranslationModule {
  constructor() {}

  public setMessage(c: Context, data: string) {
    const splitIndex = data.indexOf(", {")
    if (splitIndex === -1) return c.var.t(data) || data

    const label = data.slice(0, splitIndex).trim()
    const jsonString = data.slice(splitIndex + 2).trim()

    try {
      const json = JSON.parse(jsonString)
      const t = c.var.t

      const transformed = Object.fromEntries(
        Object.entries(json).map(([k, v]) => [
          k,
          typeof v === "string" ? t(v) : v,
        ])
      )

      return t(label, transformed)
    } catch (e) {
      return data
    }
  }
}
