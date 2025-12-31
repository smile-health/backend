/* eslint-disable @typescript-eslint/no-explicit-any */
export type MaterialIncomingMessage = {
  headers: any
  payload: {
    id: number
    global_id: number
    program_id: number
    name: string
    description?: string
    material_level_id: number
    code: string
    hierarchy_code?: string
    unit_of_consumption_id: number
    unit_of_distribution_id: number
    consumption_unit_per_distribution_unit: number
    is_temperature_sensitive: boolean
    retail_price: number
    min_retail_price: number
    max_retail_price: number
    min_temperature?: number
    max_temperature?: number
    material_type_id?: number
    is_managed_in_batch: boolean
    status: boolean
    parent_id?: number
    material_companion?: number[]
    manufactures?: number[]
    activities?: number[]
    is_addremove?: number
    addremove?: {
      entity_types: number[]
      roles: number[]
    }
  }[]
}

export type MaterialOutgoingMessage = {
  id: number
  program_id: number
  name: string
  description?: string
  is_vaccine?: number
  code: string
  code_kfa?: string
  kfa_level_id: number
  unit: string
  unit_of_distribution: string
  pieces_per_unit: number
  temperature_sensitive: boolean
  temperature_min?: number
  temperature_max?: number
  min_retail_price: number
  max_retail_price: number
  managed_in_batch: boolean
  status: boolean
  parent_id?: number
  kfa?: {
    id: number
    code: number
  }
  material_companion?: number[]
  manufactures?: number[]
  activities?: number[]
  is_addremove?: number
  addremove?: {
    entity_types: number[]
    roles: number[]
  }
}

export type MaterialGatewayResponse = {
  id: number
  name: string
}
