import { PaginatedResponse } from "@smile/lib/types/paginate.js"
import { Context } from "hono"
import { ProtocolRepository } from "./protocol.repository.js"
import {
  GetProtocolQueries,
  GetVaccineSequenceQueries,
  ProtocolMaterialActivityBody,
  StatusProtocolBody,
} from "./protocol.schema.js"

export class ProtocolModule {
  constructor(private readonly protocolRepo: ProtocolRepository) {}

  async list(c: Context, param: GetProtocolQueries) {
    const [listProtocols, totalProtocol] = await Promise.all([
      this.protocolRepo.getListProtocol(c, c.get("programId"), param),
      this.protocolRepo.getTotalCountProtocol(c, c.get("programId"), param),
    ])

    return new PaginatedResponse(param, listProtocols, totalProtocol)
  }

  async listVaccineSequence(
    c: Context,
    protocolId: number,
    param: GetVaccineSequenceQueries
  ) {
    return await this.protocolRepo.getVaccineSequences(c, protocolId, param)
  }

  async setProtocolMaterialActivities(
    c: Context,
    body: ProtocolMaterialActivityBody
  ) {
    const userId = Number(c.var.userId)
    return await this.protocolRepo.setProtocolToMaterialActivities(c, body, userId)
  }

  async getMaterialActivitiesByProtocolId(
    c: Context,
    protocolId: number,
    params: GetProtocolQueries
  ) {
    const { data, total } =
      await this.protocolRepo.getMaterialActivitiesByProtocolId(
        c,
        c.get("programId"),
        protocolId,
        params
      )
    const result = new PaginatedResponse(params, data, total)
    const firstData = result.data[0]
    return {
      protocol_id: firstData?.protocol_id,
      protocol_name: firstData?.protocol_name,
      ...result,
    }
  }

  async deleteProtocolFromMaterialActivities(c: Context, id: number) {
    const userId = c.var.userId
    const resp = await this.protocolRepo.deleteProtocolFromMaterialActivity(
      c,
      id,
      Number(userId)
    )

    return {
      success: true,
      message: `Protocol on material activity has deleted`,
      result: resp
    }
  }

  async updateStatusProtocol(c: Context, id: number, body: StatusProtocolBody) {
    const { status } = body
    const resp = await this.protocolRepo.updateStatusProtocol(c, id, status)
    return {
      success: true,
      message: `Protocol has been ${status === 1 ? "activated" : "deactivated"}`,
      result: resp,
    }
  }
}
