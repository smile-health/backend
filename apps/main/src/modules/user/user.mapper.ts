export type UserBasicInfo = {
  id: number
  username: string | null
  firstname: string | null
  lastname: string | null
  fullname: string
}

export type UserBasicInfoMap = Record<number, UserBasicInfo>
