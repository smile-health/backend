import { expect } from "chai"
import { describe, it, beforeAll } from "vitest"
import axios, { AxiosError } from "axios"
import { StatusCodes } from "http-status-codes"

import { BASE_URL, BASE_HEADERS, login } from "../../utils/global-setup.js"

interface StockChartResponse {
  date: string
  chart: {
    labels: string[]
    datasets: Array<{
      label: string
      data: number[]
      backgroundColor: string
    }>
  }
}

interface StockListResponse {
  date: string
  list: Array<{
    id: string
    name: string
    value: number
  }>
}

describe("Stock Monitoring API HTTP Integration Tests", () => {
  const baseUrl = `${BASE_URL}/warehouse-report/monitoring`
  let authHeaders: typeof BASE_HEADERS

  // Common query parameters for all stock monitoring endpoints
  const commonParams = {
    information_type: "1", // 1: On Hand Stock, 2: In Transit
    from: "2025-01-01",
    to: "2025-05-01",
    program_id: 1,
    activity_ids: "1,2,3",
    material_ids: "45,55,120",
    entity_tag_ids: "13,10,9",
    province_id: "33",
    regency_id: "3301",
    material_type_ids: "2,4,5",
    material_level_id: "2", // 2: KFA 92/Template, 3: KFA 93/Variant
    page: "1",
    paginate: "10",
    start_expired_date: "2025-01-01 00:00:00",
    end_expired_date: "2025-05-01 00:00:00",
    sort_by_id: "1", // 0: ASC, 1: DESC
  }

  beforeAll(async () => {
    const authToken = await login()
    authHeaders = {
      ...BASE_HEADERS,
      Authorization: authToken,
    }
  })

  it("GET /stock/chart → 200 JSON", async () => {
    let response
    try {
      response = await axios.get<StockChartResponse>(`${baseUrl}/stock/chart`, {
        headers: authHeaders,
        params: commonParams,
      })
      console.log("Stock chart data:", {
        date: response.data.date,
        chartLabels: response.data.chart.labels,
        datasets: response.data.chart.datasets.map((d) => d.label),
      })
    } catch (err) {
      const error = err as AxiosError
      console.log(error.response)

      console.error(
        "Failed to get stock chart:",
        error.response?.data || error.message
      )
      throw error
    }

    expect(response.status).to.equal(StatusCodes.OK)
    expect(response.data.date).to.be.a("string")
    expect(response.data.chart).to.be.an("object")
    expect(response.data.chart.labels).to.be.an("array")
    expect(response.data.chart.datasets).to.be.an("array")
  })

  it("GET /stock/province → 200 JSON", async () => {
    let response
    try {
      response = await axios.get<StockListResponse>(
        `${baseUrl}/stock/province`,
        {
          headers: authHeaders,
          params: commonParams,
        }
      )
      console.log("Province stock data:", {
        date: response.data.date,
        itemCount: response.data.list.length,
      })
    } catch (err) {
      const error = err as AxiosError
      console.error(
        "Failed to get province stock:",
        error.response?.data || error.message
      )
      throw error
    }

    expect(response.status).to.equal(StatusCodes.OK)
    expect(response.data.date).to.be.a("string")
    expect(response.data.list).to.be.an("array")
  })

  it("GET /stock/regency → 200 JSON", async () => {
    let response
    try {
      response = await axios.get<StockListResponse>(
        `${baseUrl}/stock/regency`,
        {
          headers: authHeaders,
          params: commonParams,
        }
      )
      console.log("Regency stock data:", {
        date: response.data.date,
        itemCount: response.data.list.length,
      })
    } catch (err) {
      const error = err as AxiosError
      console.error(
        "Failed to get regency stock:",
        error.response?.data || error.message
      )
      throw error
    }

    expect(response.status).to.equal(StatusCodes.OK)
    expect(response.data.date).to.be.a("string")
    expect(response.data.list).to.be.an("array")
  })

  it("GET /stock/entity → 200 JSON", async () => {
    let response
    try {
      response = await axios.get<StockListResponse>(`${baseUrl}/stock/entity`, {
        headers: authHeaders,
        params: commonParams,
      })
      console.log("Entity stock data:", {
        date: response.data.date,
        itemCount: response.data.list.length,
      })
    } catch (err) {
      const error = err as AxiosError
      console.error(
        "Failed to get entity stock:",
        error.response?.data || error.message
      )
      throw error
    }

    expect(response.status).to.equal(StatusCodes.OK)
    expect(response.data.date).to.be.a("string")
    expect(response.data.list).to.be.an("array")
  })

  it("GET /stock/entity-stock → 200 JSON", async () => {
    let response
    try {
      response = await axios.get<StockListResponse>(
        `${baseUrl}/stock/entity-stock`,
        {
          headers: authHeaders,
          params: commonParams,
        }
      )
      console.log("Entity-stock data:", {
        date: response.data.date,
        itemCount: response.data.list.length,
      })
    } catch (err) {
      const error = err as AxiosError
      console.error(
        "Failed to get entity-stock:",
        error.response?.data || error.message
      )
      throw error
    }

    expect(response.status).to.equal(StatusCodes.OK)
    expect(response.data.date).to.be.a("string")
    expect(response.data.list).to.be.an("array")
  })

  it("GET /stock/material-entity → 200 JSON", async () => {
    let response
    try {
      response = await axios.get<StockListResponse>(
        `${baseUrl}/stock/material-entity`,
        {
          headers: authHeaders,
          params: commonParams,
        }
      )
      console.log("Material-entity data:", {
        date: response.data.date,
        itemCount: response.data.list.length,
      })
    } catch (err) {
      const error = err as AxiosError
      console.error(
        "Failed to get material-entity:",
        error.response?.data || error.message
      )
      throw error
    }

    expect(response.status).to.equal(StatusCodes.OK)
    expect(response.data.date).to.be.a("string")
    expect(response.data.list).to.be.an("array")
  })

  it("should return 403 for unauthorized roles", async () => {
    let response
    try {
      await axios.get(`${baseUrl}/stock/chart`, {
        headers: {
          Authorization: "Bearer invalid",
          "Content-Type": "application/json",
        },
        params: commonParams,
      })
    } catch (err) {
      const error = err as AxiosError
      response = error.response
      console.log("Unauthorized access response:", {
        status: response?.status,
        data: response?.data,
      })
    }

    expect(response?.status).to.equal(StatusCodes.FORBIDDEN)
    expect(response?.data).to.have.property("message")
  })
})
