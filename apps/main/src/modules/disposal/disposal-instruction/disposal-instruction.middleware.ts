import { ValidationError } from "@smile/lib/error.js"
import { createMiddleware } from "hono/factory"
import { z } from "zod"
import { Context } from "hono"
import {
  CreateDisposalInstructionSchema,
  DisposalInstructionListPaginatedRequestSchema,
  DisposalInstructionIdParamsSchema,
} from "./disposal-instruction.schema.js"
import { DisposalInstructionRepository } from "./disposal-instruction.repository.js"
import { IntegrationRepository } from "../integration/integration.repository.js"

export class DisposalInstructionMiddleware {
  constructor(
    private readonly repository: DisposalInstructionRepository,
    private readonly integrationRepo: IntegrationRepository
  ) {}

  validateCreateRequest = createMiddleware(async (c: Context, next) => {
    try {
      const body = await c.req.json()
      const programId = c.var.programId
      if (!programId) {
        const error = new ValidationError("Unprocessable Data")
        c.set("errors", {
          program_id: [c.var.t("disposal_instruction.error.missing_program_id")],
        })
        throw error
      }

      const programIdNum = Number(programId)
      if (isNaN(programIdNum) || programIdNum <= 0) {
        const error = new ValidationError("Unprocessable Data")
        c.set("errors", {
          program_id: [c.var.t("disposal_instruction.error.missing_program_id")],
        })
        throw error
      }

      CreateDisposalInstructionSchema.parse(body)

      if (body.customer_id) {
        const entityId = Number(body.customer_id)
        const entityExistsInProgram =
          await this.repository.checkEntityInProgram(c, entityId, programIdNum)
        if (!entityExistsInProgram) {
          const error = new ValidationError("Unprocessable Data")
          c.set("errors", {
            customer_id: [
              c.var.t("disposal_instruction.error.entity_not_in_program", { entityId }),
            ],
          })
          throw error
        }

        const client = await this.integrationRepo.getClientByEntityId(
          c,
          entityId
        )
        if (!client) {
          const error = new ValidationError("Unprocessable Data")
          c.set("errors", {
            customer_id: [
              c.var.t("disposal_instruction.error.entity_not_in_wms", { entityId }),
            ],
          })
          throw error
        }
      }

      if (body.disposal_comments && body.disposal_comments.length > 255) {
        const error = new ValidationError("Unprocessable Data")
        c.set("errors", {
          disposal_comments: ["Comment cannot exceed 255 characters"],
        })
        throw error
      }

      if (body.bast_no) {
        if (body.bast_no.length > 255) {
          const error = new ValidationError("Unprocessable Data")
          c.set("errors", {
            bast_no: [c.var.t("disposal_instruction.error.bast_no_too_long")],
          })
          throw error
        }

        const existingInstruction = await this.repository.findByReportNumber(
          c,
          body.bast_no
        )
        if (existingInstruction) {
          const error = new ValidationError("Unprocessable Data")
          c.set("errors", {
            bast_no: [
              c.var.t("disposal_instruction.error.already_exists", { reportNumber: body.bast_no }),
            ],
          })
          throw error
        }
      }

      if (body.disposal_items && Array.isArray(body.disposal_items)) {
        if (body.disposal_items.length === 0) {
          const error = new ValidationError("Unprocessable Data")
          c.set("errors", {
            disposal_items: [c.var.t("disposal_instruction.error.no_disposal_items")],
          })
          throw error
        }

        const itemErrors = {}

        for (const [index, item] of body.disposal_items.entries()) {
          const itemIndex = index + 1
          const itemKey = `disposal_items[${index}]`

          if (!item.material_id) {
            itemErrors[`${itemKey}.material_id`] = [
              `Disposal item ${itemIndex}: ${c.var.t("validator.required", { field: "material_id" })}`,
            ]
          }

          if (
            !item.stocks ||
            !Array.isArray(item.stocks) ||
            item.stocks.length === 0
          ) {
            itemErrors[`${itemKey}.stocks`] = [
              `Disposal item ${itemIndex}: at least one stock is required`,
            ]
            continue
          }

          for (const [stockIndex, stock] of item.stocks.entries()) {
            const stockKey = `${itemKey}.stocks[${stockIndex}]`


            if (
              !stock.disposal_stocks ||
              !Array.isArray(stock.disposal_stocks) ||
              stock.disposal_stocks.length === 0
            ) {
              itemErrors[`${stockKey}.disposal_stocks`] = [
                `Disposal item ${itemIndex}, stock ${stockIndex + 1}: ${c.var.t("disposal_instruction.error.no_disposal_stocks")}`,
              ]
              continue
            }

            for (const [
              dsIndex,
              disposalStock,
            ] of stock.disposal_stocks.entries()) {
              const dsKey = `${stockKey}.disposal_stocks[${dsIndex}]`

              if (!disposalStock.disposal_stock_id) {
                itemErrors[`${dsKey}.disposal_stock_id`] = [
                  `Disposal item ${itemIndex}, stock ${stockIndex + 1}, disposal stock ${dsIndex + 1}: ${c.var.t("disposal_instruction.error.missing_disposal_stock_id")}`,
                ]
              }

              if (
                !disposalStock.transaction_reasons ||
                !disposalStock.transaction_reasons.id
              ) {
                itemErrors[`${dsKey}.transaction_reasons.id`] = [
                  `Disposal item ${itemIndex}, stock ${stockIndex + 1}, disposal stock ${dsIndex + 1}: ${c.var.t("disposal_instruction.error.missing_transaction_reason_id")}`,
                ]
              }

              if (
                disposalStock.discard_qty !== undefined &&
                disposalStock.discard_qty < 0
              ) {
                itemErrors[`${dsKey}.discard_qty`] = [
                  `Disposal item ${itemIndex}, stock ${stockIndex + 1}, disposal stock ${dsIndex + 1}: ${c.var.t("disposal_instruction.error.negative_discard_qty")}`,
                ]
              }

              if (
                disposalStock.received_qty !== undefined &&
                disposalStock.received_qty < 0
              ) {
                itemErrors[`${dsKey}.received_qty`] = [
                  `Disposal item ${itemIndex}, stock ${stockIndex + 1}, disposal stock ${dsIndex + 1}: ${c.var.t("disposal_instruction.error.negative_received_qty")}`,
                ]
              }

              if (
                (disposalStock.discard_qty === undefined ||
                  disposalStock.discard_qty === null ||
                  disposalStock.discard_qty === 0) &&
                (disposalStock.received_qty === undefined ||
                  disposalStock.received_qty === null ||
                  disposalStock.received_qty === 0)
              ) {
                itemErrors[`${dsKey}.discard_qty`] = [
                  `Disposal item ${itemIndex}, stock ${stockIndex + 1}, disposal stock ${dsIndex + 1}: ${c.var.t("disposal_instruction.error.missing_discard_or_received_qty")}`,
                ]
                itemErrors[`${dsKey}.received_qty`] = [
                  `Disposal item ${itemIndex}, stock ${stockIndex + 1}, disposal stock ${dsIndex + 1}: ${c.var.t("disposal_instruction.error.missing_discard_or_received_qty")}`,
                ]
              }
            }
          }
        }

        if (Object.keys(itemErrors).length > 0) {
          const error = new ValidationError("Unprocessable Data")
          c.set("errors", itemErrors)
          throw error
        }
      }

      if (!body.activity_id) {
        const error = new ValidationError("Unprocessable Data")
        c.set("errors", {
          activity_id: [c.var.t("disposal_instruction.error.missing_activity_id")],
        })
        throw error
      }

      if (!body.customer_id) {
        const error = new ValidationError("Unprocessable Data")
        c.set("errors", {
          customer_id: [c.var.t("disposal_instruction.error.missing_customer_id")],
        })
        throw error
      }

      if (!body.instruction_type_id) {
        const error = new ValidationError("Unprocessable Data")
        c.set("errors", {
          instruction_type_id: [c.var.t("disposal_instruction.error.missing_instruction_type_id")],
        })
        throw error
      }

      await next()
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw error
      }
      throw error
    }
  })

  validateListRequest = createMiddleware(async (c: Context, next) => {
    try {
      const body = await c.req.json()

      if (!body.comment) {
        const error = new ValidationError("Unprocessable Data")
        c.set("errors", {
          comment: ["Comment is required"],
        })
        throw error
      }

      if (body.comment.length > 255) {
        const error = new ValidationError("Unprocessable Data")
        c.set("errors", {
          comment: ["Comment cannot exceed 255 characters"],
        })
        throw error
      }

      const programId = c.var.programId
      if (!programId) {
        const error = new ValidationError("Unprocessable Data")
        c.set("errors", {
          program_id: ["program id is required"],
        })
        throw error
      }

      const programIdNum = Number(programId)
      if (isNaN(programIdNum) || programIdNum <= 0) {
        const error = new ValidationError("Unprocessable Data")
        c.set("errors", {
          program_id: ["program id must be a positive number"],
        })
        throw error
      }

      const query = c.req.query()
      DisposalInstructionListPaginatedRequestSchema.parse(query)
      await next()
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw error
      }
      throw error
    }
  })

  validateInstructionId = createMiddleware(async (c: Context, next) => {
    try {
      const programId = c.var.programId
      if (!programId) {
        const error = new ValidationError("Unprocessable Data")
        c.set("errors", {
          program_id: [c.var.t("disposal_instruction.error.missing_program_id")],
        })
        throw error
      }

      const programIdNum = Number(programId)
      if (isNaN(programIdNum) || programIdNum <= 0) {
        const error = new ValidationError("Unprocessable Data")
        c.set("errors", {
          program_id: [c.var.t("disposal_instruction.error.invalid_program_id")],
        })
        throw error
      }

      const params = c.req.param()
      DisposalInstructionIdParamsSchema.parse(params)
      await next()
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw error
      }
      throw error
    }
  })

  checkInstructionExists = createMiddleware(async (c: Context, next) => {
    const programId = c.var.programId
    if (!programId) {
      const error = new ValidationError("Unprocessable Data")
      c.set("errors", {
        program_id: [c.var.t("disposal_instruction.error.missing_program_id")],
      })
      throw error
    }

    const programIdNum = Number(programId)
    if (isNaN(programIdNum) || programIdNum <= 0) {
      const error = new ValidationError("Unprocessable Data")
      c.set("errors", {
        program_id: [c.var.t("disposal_instruction.error.invalid_program_id")],
      })
      throw error
    }

    const { id } = c.req.param()
    const instructionId = Number(id)

    if (instructionId) {
      const instruction = await this.repository.findById(c, instructionId)
      if (!instruction) {
        const error = new ValidationError(
          c.var.t("disposal_instruction.error.not_found")
        )
        throw error
      }
    }

    await next()
  })
}
