import axios from "axios"

export const BASE_URL_AUTH = "https://staging-api.smile-indonesia.id"
export const BASE_URL = "https://staging-api.smile-indonesia.id"
export const BASE_HEADER_AUTH = {
  Authorization: "",
  "Content-Type": "application/x-www-form-urlencoded",
  "Device-Type": "web",
}
export const BASE_HEADERS = {
  Authorization: "",
  "Content-Type": "application/json",
  "Device-Type": "web",
}

export async function login() {
  const LOGIN_URL = `${BASE_URL_AUTH}/auth/login`
  const DEFAULT_CREDS = {
    username: "arya",
    password: "Smile12*",
  }

  const response = await axios.post(LOGIN_URL, DEFAULT_CREDS, {
    headers: BASE_HEADER_AUTH,
  })

  return `Bearer ${response.data.authDetails.access_token}`
}

export async function setup() {
  const startTime = performance.now()

  BASE_HEADERS.Authorization = await login()
  BASE_HEADERS["Content-Type"] = "application/json"

  const timeTaken = performance.now() - startTime
  console.info(`setup took ${timeTaken.toFixed(0)} ms.`)
}

export async function teardown() {
  process.exit(0)
}
