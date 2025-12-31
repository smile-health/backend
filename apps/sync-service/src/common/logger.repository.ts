/* eslint-disable @typescript-eslint/no-explicit-any */
import { CustomContext } from "@smile/lib/types/context.js"
import { AxiosError } from "axios"
import { DB } from "./infrastructure/database/types/db.js"

export async function logError<T>(c: CustomContext<DB>, error: T) {
  const errorStr = JSON.stringify(
    error instanceof AxiosError ? formatAxiosError(error) : error
  )
  await c.var.trx.insertInto("logger").values({ text: errorStr }).execute()
}

function formatAxiosError(error: AxiosError) {
  let parsedData: any = error.config?.data

  try {
    if (typeof error.config?.data === "string") {
      parsedData = JSON.parse(error.config.data)
    }
  } catch {
    // leave parsedData as-is if JSON parsing fails
  }

  return {
    message: error.message,
    request: error.config
      ? {
          method: error.config.method,
          url: error.config.url,
          headers: error.config.headers,
          data: maskSensitiveData(parsedData),
        }
      : undefined,
    response: error.response
      ? {
          status: error.response.status,
          statusText: error.response.statusText,
          headers: error.response.headers,
          data: error.response.data,
        }
      : undefined,
  }
}

function maskSensitiveData(
  data: any,
  fieldsToMask: string[] = ["password", "new_password", "password_confirmation"]
): any {
  if (typeof data !== "object" || data === null) return data

  const masked = { ...data }
  for (const field of fieldsToMask) {
    if (field in masked) {
      masked[field] = "[MASKED]"
    }
  }

  return masked
}
