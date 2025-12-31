import { SyncPublisher } from "@smile/lib/base/sync-publisher.js"
import { Publisher } from "@smile/lib/rabbitmq/publisher.js"
import { TOPIC } from "@smile/lib/rabbitmq/topic.js"
import { Context } from "hono"
import { MaterialRepository } from "../material/material.repository.js"
import { collect } from "@smile/lib/utils.js"
import { UserRepository } from "../user/user.repository.js"
import { EntityRepository } from "../entity/entity.repository.js"

interface Coldstorage {
  entity_id: number
  program_id: number
  material_ids: number[]
  is_immunization: boolean
  user_id: number
}

export class ColdstoragePublisher extends SyncPublisher {
  constructor(
    protected readonly publisher: Publisher,
    protected readonly materialRepo: MaterialRepository,
    protected readonly userRepo: UserRepository,
    protected readonly entityRepo: EntityRepository
  ) {
    super(publisher)
  }

  async processCreate(c: Context, data: Coldstorage): Promise<void> {
    if (!data.is_immunization) return

    const materialColdstorages =
      await this.materialRepo.findMaterialColdstorage(c, data.material_ids)
    const user = await this.userRepo.findOne(c, {
      id: data.user_id,
    })
    const entity = await this.entityRepo.findOne(c, {
      id: data.entity_id,
    })

    if (
      materialColdstorages &&
      materialColdstorages.length > 0 &&
      entity?.entity_tag_id !== 3
    ) {
      const materialIds = collect(materialColdstorages, "id")
      const payload = {
        entity_id: entity?.global_id,
        program_id: data.program_id,
        material_ids: materialIds,
        is_immunization: data.is_immunization,
        user_id: user?.global_id,
      }

      const message = {
        headers: c.req.header(),
        payload: payload,
      }

      await this.publish(TOPIC.CREATED_COLDSTORAGE, message)
    }
  }
}
