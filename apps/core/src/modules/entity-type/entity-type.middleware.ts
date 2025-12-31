import { zValidator } from "@hono/zod-validator"
import { EntityTypePageableRequest } from "./entity-type.schema.js"

export class EntityTypeMiddleware {
  

  queryValidation = zValidator("query", EntityTypePageableRequest)
}
