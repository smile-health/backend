/* eslint-disable @typescript-eslint/no-explicit-any */
export type EntityIncomingMessage = {
  headers: any
  payload: {
    id: number
    global_id: number
    name: string
    code: string
    type: number
    is_vendor: number
    is_puskesmas: number
    is_ayosehat: number
    entity_tag_id: number
    province_id: string
    regency_id: string
    sub_district_id: string
    village_id: string
    postal_code: string
    address: string
    lat: string
    lng: string
    status: number
    program_id: number
    created_by: number
    updated_by: number
    activities: {
      activity_id: number
      start_date: Date | null | undefined
      end_date: Date | null | undefined
    }[]
  }[]
}

export type EntityOutgoingMessage = {
  name: string
  code: string
  type: number
  is_vendor: number
  is_puskesmas: number
  entity_tags: number[]
  province_id: string
  regency_id: string
  sub_district_id: string
  village_id: string
  postal_code: string
  address: string
  lat: string
  lng: string
  status: number
  activities_date?: {
    activity_id: number
    join_date?: string
    end_date?: string
  }[]
}

export type EntityGatewayResponse = {
  id: number
  name: string
}

export type EntityDTO = EntityIncomingMessage["payload"][0]
