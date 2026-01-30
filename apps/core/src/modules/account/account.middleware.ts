import { AccountRepository } from "@/modules/account/account.repository.js"
import { zValidator } from "@hono/zod-validator"
import {
  ValidationError
} from "@smile-health/lib/error.js"
import { LoginSchema } from "./account.schema.js"

export class AccountMiddleware {
  constructor(private readonly repository: AccountRepository) {}

  public validateSchema = zValidator("json", LoginSchema, (result) => {
    if (!result.success) {
      throw new ValidationError(result.error.issues[0]?.message)
    }
  }) 
}
