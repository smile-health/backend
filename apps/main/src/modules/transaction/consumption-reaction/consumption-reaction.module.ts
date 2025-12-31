import { Context } from "hono"
import { ConsumptionReactionRepository } from "./consumption-reaction.repository.js"
import {
  ConsumptionReactionParamDTO,
  ConsumptionReactionRequestDTO,
} from "./consumption-reaction.schema.js"

export class ConsumptionReactionModule {
  constructor(private readonly repo: ConsumptionReactionRepository) {}

  async create(
    c: Context,
    params: ConsumptionReactionParamDTO,
    body: ConsumptionReactionRequestDTO
  ) {
    await this.repo.create(c, {
      consumption_id: params.id,
      reaction_id: body.reaction_id,
      other_reaction: body.other_reaction,
      actual_date: body.actual_date,
    })
  }
}
