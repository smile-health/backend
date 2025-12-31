/* eslint-disable @typescript-eslint/no-explicit-any */
export interface ManufactureDTO {
  id: number
  global_id: number
  name: string
  type: number
  reference_id: string
  description: string
  contact_name: string
  phone_number: string
  email: string
  address: string
  status: number
  programs: {
    program_id: number
    manufacture_id: number
  }[]
}

export type UpsertManufactureIncomingMessage = {
  headers: any
  payload: ManufactureDTO
}

export type ManufactureGatewayResponse = {
  id: number
  name: string
}

export type UpdateManufactureStatusIncomingMessage = {
  headers: any
  payload: {
    id: number
    program_id: number
    status: number
  }
}

export type DeleteManufactureIncomingMessage = {
  headers: any
  payload: {
    id: number
    program_id: number
  }
}

// map platform manufacture type to existing manufacture type
export const MAP_MANUFACTURE_TYPE = {
  1: {
    3: 1, // Vaksin
    4: 2, // Kulkas
    5: 3, // Logger
  },
  2: {
    3: 1, // Vaksin
    4: 2, // Kulkas
    5: 2, // Logger
  },
}
