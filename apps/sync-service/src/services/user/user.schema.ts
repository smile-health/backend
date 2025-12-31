/* eslint-disable @typescript-eslint/no-explicit-any */
export type UserDTO = {
  program_id: any
  id: number
  username: string
  email: string
  firstname: string
  lastname: string
  password: string
  date_of_birth: string
  gender: number
  mobile_phone: string
  address: string
  entity_id: number
  role: number
  village_id: string
  programs: ProgramDTO[]
  view_only: number
}

export type ProgramDTO = {
  user_id: number
  program_id: number
}

export type UpsertUserIncomingMessage = {
  headers: any
  payload: UserDTO
}

export type UpdateUserStatusIncomingMessage = {
  headers: any
  payload: {
    id: number
    program_id: number
    status: number
  }
}

export type DeleteUserIncomingMessage = {
  headers: any
  payload: {
    id: number
    program_id: number
  }
}

export type UpdatePasswordIncomingMessage = {
  headers: any
  payload: {
    id: number
    program_ids: number[]
    password: string
    new_password: string
  }
}
