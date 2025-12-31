export type RequestLog = {
  method: string
  url: string
  body?: object
}

export type ResponseLog = {
  status?: number
  body?: string
  error?: Error
}

export type Result = {
  request: RequestLog
  response: ResponseLog
}

export type ClientConfig = {
  endpoints: object
  credentials: object
}
