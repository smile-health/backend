import { createMiddleware } from "hono/factory"
import { datamart } from "../infrastructure/database/datamart.js"
import { slave } from "../infrastructure/database/slave.js"
import { risingwave } from "../infrastructure/database/risingwave.js"

export class CommonMiddleware {
  loadSlaveDB = createMiddleware(async (c, next) => {
    c.set("slave", slave)
    if (datamart) c.set("datamart", datamart)
    if (risingwave) c.set("risingwave", risingwave)

    return next()
  })

  loadProgramId = createMiddleware(async (c, next) => {
    const authHeader = c.req.header("Authorization")
    const token = authHeader?.split(" ")[1]

    if (!token) {
      return c.json({ message: c.var.t("auth.unauthorized") }, 401)
    }

    const programId = c.req.header("x-program-id")
    if (!programId) {
      const error = {
        message: c.var.t("auth.invalid_program"),
        type: "invalid_program",
      }
      return c.json(error, 403)
    }

    c.set("programId", Number(programId))

    return next()
  })
}
