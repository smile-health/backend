import { createRoute } from "@hono/zod-openapi"
import { DisposalCancellationRequestSchema } from "./wms.schema.js"

const tags = ["WMS Integration"]

export const disposalCancellationRoute = createRoute({
  method: "post",
  path: "/wms/disposal/cancellation",
  summary: "Cancel Disposal Instruction",
  description: "Cancel a disposal instruction in WMS integration",
  tags: tags,
  security: [{ Bearer: [] }],
  request: {
    body: {
      content: {
        "application/json": {
          schema: DisposalCancellationRequestSchema,
          example: {
            bast_no: "BAST-ABC/001-08/09/2025",
            comment: "Uji coba batalkan Instruction Disposal"
          },
        },
      },
    },
  },
  responses: {
    204: {
      description: "Success - No Content",
    },
  },
})
