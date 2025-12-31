import { Hono } from "hono"
import { StatusCodes } from "http-status-codes"
import { BaseController } from "../base.controller.js"
import { IntegrationModule } from "./integration.module.js"
import {
  GetStockOpnamesQueries,
  GetTransactionQueries,
} from "./integration.schema.js"

/**
 * Controller for handling integration-related routes and operations.
 * Transactions include stock opname
 */
export class IntegrationController extends BaseController {
  constructor(private module: IntegrationModule) {
    super()
  }

  getRoutes(): Hono {
    const router = new Hono()
    router.get(
      "/stock-opnames",
      async (c, next) => {
        const programId = c.req.header("x-program-id")
        const programUsers = c.var.programIdUser

        if (programUsers.includes(Number(programId)) === false) {
          return c.json(
            {
              message: "Access denied: Invalid program ID",
            },
            StatusCodes.FORBIDDEN
          )
        }
        await next()
      },

      this.validateRequest("query", GetStockOpnamesQueries),
      async (c) => {
        const params = c.req.valid("query")
        const opnames = await this.module.getStockOpnameNew(c, {
          ...params,
          program_id: c.get("programId"),
        })
        return c.json(opnames)
      }
    )

    router.get(
      "/transactions",
      async (c, next) => {
        const programId = c.req.header("x-program-id")
        const programUsers = c.var.programIdUser

        if (programUsers.includes(Number(programId)) === false) {
          return c.json(
            {
              message: "Access denied: Invalid program ID",
            },
            StatusCodes.FORBIDDEN
          )
        }
        await next()
      },

      this.validateRequest("query", GetTransactionQueries),
      async (c) => {
        try {
          const params = c.req.valid("query")
          let result = await this.module.getTransactionNew(c, {
            ...params,
            program_id: c.get("programId"),
          })

          return c.json(result, StatusCodes.OK)
        } catch (error) {
          console.log(error)
        }
      }
    )

    return router
  }
}
