import { logger } from '../logger'

export const fetchData = async (
  url: string,
  options: RequestInit = {}
): Promise<any> => {
  try {
    const response = await fetch(`${url}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers ?? {}),
      },
    })

    const data: any = await response.json()

    if (!response.ok) {
      throw data?.message
    }

    logger.info(
      `Success Request: ${response.ok} - ${response.status} - ${JSON.stringify(data)}`
    )
    return {
      status: response.status,
      ...data,
    }
  } catch (error: any) {
    logger.error(`Failed Request: ${JSON.stringify(error)}`)
    throw error
  }
}
