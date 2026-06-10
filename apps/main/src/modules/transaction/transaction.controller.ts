import { DEVICE_TYPE } from "@/common/constants/device.js"
import { USER_ROLE } from "@/common/constants/user.js"
import { RoleMiddleware } from "@/common/middlewares/role-validation.middleware.js"
import { TransactionsMiddleware } from "@/modules/transaction/transaction.middleware.js"
import { BaseController } from "@smile-health/lib/base/controller.js"
import { Hono } from "hono"
import { StatusCodes } from "http-status-codes"
import { TransactionModule } from "./transaction.module.js"
import {
  SubmitReturnOfHealthFacilitiesTrxSchema,
  TransactionListConsumptionSchema,
  TransactionListPaginatedRequestSchema,
  TransactionListCursorPaginatedRequestSchema,
  TransactionReasonPaginatedRequestSchema,
  TransactionTypePaginatedRequestSchema,
} from "./transaction.schema.js"
import { DeduplicationMiddleware } from "@/common/middlewares/dedup.middleware.js"

export class TransactionController extends BaseController {
  constructor(
    private readonly module: TransactionModule,
    private readonly middleware: TransactionsMiddleware,
    private readonly roleMiddleware: RoleMiddleware,
    private readonly dedupMiddleware: DeduplicationMiddleware
  ) {
    super("transaction")
  }

  getRoutes(): Hono {
    const router = new Hono()

    router.use(
      this.roleMiddleware.allowWithDeviceType([
        [USER_ROLE.SUPERADMIN, DEVICE_TYPE.web],
        [USER_ROLE.ADMIN, DEVICE_TYPE.web],
        [USER_ROLE.MANAGER, DEVICE_TYPE.web],
        [USER_ROLE.MANAGER, DEVICE_TYPE.mobile],
        [USER_ROLE.OPERATOR, DEVICE_TYPE.mobile],
      ])
    )

    router.post(
      "/add-stock",
      this.middleware.logErrors,
      this.validateRequest("json", this.middleware.addRemoveDiscardStock),
      this.dedupMiddleware.middleware,
      async (c) => {
        const body = c.req.valid("json")
        await this.module.addStock(c, body)
        return c.body(null, StatusCodes.NO_CONTENT)
      }
    )

    router.post(
      "/remove-stock",
      this.middleware.logErrors,
      this.validateRequest("json", this.middleware.addRemoveDiscardStock),
      this.dedupMiddleware.middleware,
      async (c) => {
        const body = c.req.valid("json")
        await this.module.removeStock(c, body)
        return c.body(null, StatusCodes.NO_CONTENT)
      }
    )

    router.post(
      "/discard-stock",
      this.middleware.logErrors,
      this.validateRequest("json", this.middleware.addRemoveDiscardStock),
      this.dedupMiddleware.middleware,
      async (c) => {
        const body = c.req.valid("json")
        await this.module.discardStock(c, body)
        return c.body(null, StatusCodes.NO_CONTENT)
      }
    )

    // router.post(
    //   "/consumption",
    //   this.middleware.logErrors,
    //   this.validateRequest("json", this.middleware.consumption),
    //   async (c) => {
    //     const body = c.req.valid("json")
    //     await this.module.consumption(c, body)
    //     return c.body(null, StatusCodes.NO_CONTENT)
    //   }
    // )

    router.post(
      "/cancelation-discard",
      this.middleware.logErrors,
      this.validateRequest("json", this.middleware.cancelationDiscard),
      this.dedupMiddleware.middleware,
      async (c) => {
        const body = c.req.valid("json")
        await this.module.cancelationDiscard(c, body)
        return c.body(null, StatusCodes.NO_CONTENT)
      }
    )

    router.get(
      "/type",
      this.validateRequest("query", TransactionTypePaginatedRequestSchema),
      async (c) => {
        const query = c.req.valid("query")
        const response = await this.module.getTransactionType(c, query)
        return c.json(response, StatusCodes.OK)
      }
    )

    router.get(
      "/reason",
      this.validateRequest("query", TransactionReasonPaginatedRequestSchema),
      async (c) => {
        const query = c.req.valid("query")
        const response = await this.module.getTransactionReason(c, query)
        return c.json(response, StatusCodes.OK)
      }
    )

    router.get(
      "/",
      this.validateRequest("query", TransactionListPaginatedRequestSchema),
      async (c) => {
        const query = c.req.valid("query")
        const response = await this.module.getTransactionList(c, query)
        return c.json(response, StatusCodes.OK)
      }
    )

    router.get(
      "/cursor",
      this.validateRequest(
        "query",
        TransactionListCursorPaginatedRequestSchema
      ),
      async (c) => {
        const query = c.req.valid("query")
        const response = await this.module.getTransactionListCursor(c, query)
        return c.json(response, StatusCodes.OK)
      }
    )

    router.get(
      "/xls",
      this.validateRequest("query", TransactionListPaginatedRequestSchema),
      async (c) => {
        const query = c.req.valid("query")
        const response = await this.module.exportExcel(c, query)
        return c.json(response, StatusCodes.OK)
      }
    )

    router.get(
      "/discard",
      this.validateRequest("query", this.middleware.listDiscard),
      async (c) => {
        const query = c.req.valid("query")
        const response = await this.module.getTransactionListDiscard(c, query)
        return c.json(response, StatusCodes.OK)
      }
    )

    router.post(
      "/return-of-health-facitilies",
      this.validateRequest(
        "json",
        SubmitReturnOfHealthFacilitiesTrxSchema,
        this.middleware.submitReturnOfHealth
      ),
      this.dedupMiddleware.middleware,
      async (c) => {
        const body = c.req.valid("json")
        await this.module.returnOfHealthFacilities(c, body)
        return c.body(null, StatusCodes.CREATED)
      }
    )

    router.get(
      "/consumptions",
      this.middleware.validateDateRange,
      this.validateRequest("query", TransactionListConsumptionSchema),
      async (c) => {
        const query = c.req.valid("query")
        const response = await this.module.listConsumption(c, query)
        return c.json(response, StatusCodes.OK)
      }
    )

    router.get(
      "/return-of-health-facilities",
      this.middleware.validateDateRange,
      this.validateRequest("query", TransactionListConsumptionSchema),
      async (c) => {
        const query = c.req.valid("query")
        const response = await this.module.listConsumption(c, query, true)
        return c.json(response, StatusCodes.OK)
      }
    )

    return router
  }
}
