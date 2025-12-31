export type OrderCommentIncomingMessage = {
  headers: any
  payload: {
    id: number
    order_id: number
    user_id: number
    order_status_id: number
    comment?: null | string
    program_id: number
  }
}
