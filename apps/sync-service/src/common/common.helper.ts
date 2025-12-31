type Headers = Record<string, string | undefined>

export function filterHeaders(headers: Headers) {
  const allowedHeaders = ["authorization", "content-type"]
  const filteredHeaders: Record<string, string> = {}

  for (const key of allowedHeaders) {
    const value =
      headers[key] || headers[key.toLowerCase()] || headers[key.toUpperCase()]
    if (value) {
      filteredHeaders[key] = value
    }
  }

  return filteredHeaders
}
