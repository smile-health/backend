import { Hono } from "hono"
import { DisposalShipmentController } from "./shipment.controller.js"
import { DisposalShipmentMiddleware } from "./shipment.middleware.js"
import { DisposalShipmentRepository } from "./shipment.repository.js"

// Note: This routes file is imported by wire.ts where proper dependency injection happens
// For now, create instances here but in production this should be handled by wire.ts
const shipmentRoutes = new Hono()
const controller = new DisposalShipmentController()
const middleware = new DisposalShipmentMiddleware()

// GET /disposal/shipment - List disposal shipments
shipmentRoutes.get(
  "/",
  middleware.validateGetShipmentQueries,
  async (c) => controller.getShipmentList(c)
)

shipmentRoutes.get(
  "/counts",
  middleware.validateGetCountsQueries,
  async (c) => controller.getCountStatusShipment(c)
)


// GET /disposal/shipment/xls - Export disposal shipments
shipmentRoutes.get(
  "/xls",
  middleware.validateGetShipmentQueries,
  async (c) => controller.exportShipmentList(c)
)

// POST /disposal/shipment - Create disposal shipment
shipmentRoutes.post(
  "/",
  middleware.validateCreateShipmentRequest,
  async (c) => controller.createShipment(c)
)

// GET /disposal/shipment/:disposalId - Get disposal shipment detail
shipmentRoutes.get(
  "/:disposalId",
  middleware.validateShipmentId,
  async (c) => controller.getShipmentDetail(c)
)

// GET /disposal/shipment/:disposalId/download - Download memorandum
shipmentRoutes.get(
  "/:disposalId/download",
  middleware.validateShipmentId,
  async (c) => controller.downloadMemorandum(c)
)

// PUT /disposal/shipment/:disposalId/comment - Comment disposal shipment
shipmentRoutes.post(
  "/:disposalId/comment",
  middleware.validateShipmentId,
  middleware.validateCommentShipmentRequest,
  async (c) => controller.commentShipment(c)
)

// PUT /disposal/shipment/:disposalId/accept - Accept disposal shipment
shipmentRoutes.put(
  "/:disposalId/accept",
  middleware.validateShipmentId,
  middleware.validateAcceptShipmentRequest,
  async (c) => controller.acceptShipment(c)
)

// PUT /disposal/shipment/:disposalId/cancel - Cancel disposal shipment
shipmentRoutes.put(
  "/:disposalId/cancel",
  middleware.validateShipmentId,
  middleware.validateCancelShipmentRequest,
  async (c) => controller.cancelShipment(c)
)

export { shipmentRoutes }
