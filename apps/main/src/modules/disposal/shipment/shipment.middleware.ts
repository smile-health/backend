import { ValidationError, NotFoundError } from "@smile-health/lib/error.js"
import { Context } from "hono"
import { createMiddleware } from "hono/factory"
import { z } from "zod"
import { DisposalShipmentRepository } from "./shipment.repository.js"
import {
  CreateShipmentRequest,
  CreateShipmentRequestSchema,
  AcceptShipmentRequest,
  AcceptShipmentRequestSchema,
  CancelShipmentRequest,
  CancelShipmentRequestSchema,
  CommentShipmentRequest,
  CommentShipmentRequestSchema,
  GetShipmentQueries,
} from "./shipment.schema.js"

export class DisposalShipmentMiddleware {
  private repo: DisposalShipmentRepository

  constructor() {
    this.repo = new DisposalShipmentRepository()
  }

  // Validate query parameters for GET requests
  validateGetShipmentQueries = createMiddleware(async (c, next) => {
    try {
      const query = c.req.query()
      // Basic validation for now - can be enhanced later
      await next()
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new ValidationError("Invalid query parameters")
      }
      throw error
    }
  })

  // Validate query parameters for GET requests
  validateGetCountsQueries = createMiddleware(async (c, next) => {
    try {
      const query = c.req.query()
      // Basic validation for now - can be enhanced later
      await next()
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new ValidationError("Invalid query parameters")
      }
      throw error
    }
  })

  // Validate shipment ID parameter
  validateShipmentId = createMiddleware(async (c, next) => {
    const disposalId = c.req.param("disposalId")
    const id = Number(disposalId)
    
    if (isNaN(id) || id <= 0) {
      throw new ValidationError("Invalid shipment ID")
    }
    
    await next()
  })

  // Validate comment shipment request
  validateCommentShipmentRequest = createMiddleware(async (c, next) => {
    try {

      const body = await c.req.json()
      CommentShipmentRequestSchema.parse(body)
      await next()
    } catch (error) {
      if (error instanceof z.ZodError) {
        console.error("Validation error:", error.errors)
        throw new ValidationError("Invalid create shipment request")
      }
      throw error
    }
  })

  // Validate create shipment request
  validateCreateShipmentRequest = createMiddleware(async (c, next) => {
    try {

      const body = await c.req.json()
      CreateShipmentRequestSchema.parse(body)
      await next()
    } catch (error) {
      if (error instanceof z.ZodError) {
        console.error("Validation error:", error.errors)
        throw new ValidationError("Invalid create shipment request")
      }
      throw error
    }
  })

  // Validate accept shipment request
  validateAcceptShipmentRequest = createMiddleware(async (c, next) => {
    try {
      const body = await c.req.json()
      AcceptShipmentRequestSchema.parse(body)
      await next()
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new ValidationError("Invalid accept shipment request")
      }
      throw error
    }
  })

  // Validate cancel shipment request
  validateCancelShipmentRequest = createMiddleware(async (c, next) => {
    try {
      const body = await c.req.json()
      CancelShipmentRequestSchema.parse(body)
      await next()
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new ValidationError("Invalid cancel shipment request")
      }
      throw error
    }
  })

  // Validate date range for list queries
  validateDateRange = createMiddleware(async (c, next) => {
    const { from_date, to_date } = c.req.query()
    if (from_date && to_date && new Date(from_date) > new Date(to_date)) {
      throw new ValidationError("Invalid Date Range")
    }
    await next()
  })

  // Middleware for detail endpoint (check existence)
  validateShipmentExists = createMiddleware(async (c, next) => {
    const disposalId = c.req.param("disposalId")
    const id = Number(disposalId)
    
    if (id) {
      const exists = await this.repo.findOne(c, { id })
      if (!exists) {
        throw new NotFoundError("Disposal Shipment not found")
      }
    }
    await next()
  })
}
