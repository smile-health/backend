import { zValidator } from "@hono/zod-validator"
import { EntityTagPageableRequest } from "./entity-tag.schema.js"

export class EntityTagMiddleware {
  

  queryValidation = zValidator("query", EntityTagPageableRequest)
}
