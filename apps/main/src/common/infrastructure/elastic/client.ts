import bodybuilder, { Bodybuilder } from "bodybuilder"
import { client } from "./index.js"

type WhereOperator =
  | "="
  | "!="
  | ">"
  | ">="
  | "<"
  | "<="
  | "in"
  | "not in"
  | "exists"
  | "not exists"

export class ElasticSearchQuery<DB> {
  private query: Bodybuilder
  private page: number = 0
  private from: number = 0
  private size: number = 10
  private sortField?: string
  private sortOrder: "asc" | "desc" = "asc"
  private index?: keyof DB
  private readonly maxResultWindow: number = 10000

  constructor() {
    this.query = bodybuilder()
  }

  /** Set index like `selectFrom()` in Kysely */
  selectFrom<K extends keyof DB>(index: K) {
    this.index = index
    return this
  }

  /** Kysely-like where() method */
  where<K extends keyof DB, C extends keyof DB[K]>(
    column: C,
    operator: WhereOperator,
    value?: any
  ) {
    const field = column as string
    switch (operator) {
      case "=":
        this.query = this.query.query("term", field, value)
        break
      case "!=":
        this.query = this.query.notQuery("term", field, value)
        break
      case ">":
        this.query = this.query.query("range", field, { gt: value })
        break
      case ">=":
        this.query = this.query.query("range", field, { gte: value })
        break
      case "<":
        this.query = this.query.query("range", field, { lt: value })
        break
      case "<=":
        this.query = this.query.query("range", field, { lte: value })
        break
      case "in":
        this.query = this.query.query("terms", field, value)
        break
      case "not in":
        this.query = this.query.notQuery("terms", field, value)
        break
      case "exists":
        this.query = this.query.query("exists", "field", field)
        break
      case "not exists":
        this.query = this.query.notQuery("exists", "field", field)
        break
      default:
        throw new Error(`Unsupported operator: ${operator}`)
    }
    return this
  }

  /** Pagination */
  paginate(page: number, size: number) {
    this.page = page
    this.size = size
    this.from = (page - 1) * size

    if (this.from >= this.maxResultWindow) {
      this.from = 0
    }

    return this
  }

  /** Sorting */
  orderBy<K extends keyof DB, C extends keyof DB[K]>(
    column: C,
    order: "asc" | "desc" = "asc"
  ) {
    this.sortField = column as string
    this.sortOrder = order
    return this
  }

  insertInto<K extends keyof DB>(index: K) {
    return new ElasticInserter<DB, K>(index)
  }

  /** Conditional query ($if like in Kysely) */
  $if(condition: boolean, callback: (query: this) => this) {
    return condition ? callback(this) : this
  }

  /** Execute search */
  async execute<T = any>(lastHitSortValue: any): Promise<any> {
    if (!this.index) {
      throw new Error("Index must be specified using selectFrom()")
    }

    const esQuery = this.query.build()
    const sortField = this.sortField ?? "created_at"
    let sortOrder = this.sortOrder || "asc"

    if (this.page > Math.floor(this.maxResultWindow / this.size)) {
      sortOrder = "desc"
    }

    const sort = [`${sortField}:${sortOrder}`]
    const searchParams: any = {
      index: `${process.env.ES_INDEX_PREFIX}_${String(this.index)}`,
      body: esQuery,
      sort: sort,
      size: this.size,
      track_total_hits: true,
    }

    if (this.from < this.maxResultWindow && lastHitSortValue.length == 0) {
      // console.log("Normal Pagination")
      searchParams.from = this.from
    } else if (lastHitSortValue.length > 0) {
      // console.log("Deep Pagination")
      searchParams.body.search_after = [lastHitSortValue]
    }
    // console.log("Execute:", JSON.stringify(searchParams, null, 2))

    try {
      const result = await client.search(searchParams)
      const hits = result.body.hits.hits
      const total = result.body.hits.total.value
      const invalidPage = this.page > Math.ceil(total / this.size)

      return {
        data: invalidPage
          ? []
          : hits
              .map((hit) => hit._source as T)
              .sort((a, b) => (a[sortField] > b[sortField] ? 1 : -1)),
        total: invalidPage ? 0 : result.body.hits.total.value,
        lastSortValue: hits.length
          ? hits[hits.length - 1].sort
          : lastHitSortValue,
      }
    } catch (error) {
      console.error("Elasticsearch error:", error.meta?.body?.error || error)
    }
  }
}

class ElasticInserter<DB, K extends keyof DB> {
  private id?: string

  constructor(private readonly index: K) {}

  withId(id: string) {
    this.id = id
    return this
  }

  /**
   * Inserts a document to the Elasticsearch index.
   * @param data Document data to be inserted. The type of the data must match the index mapping.
   * @returns The response body from Elasticsearch.
   */
  async values(data: DB[K]) {
    const result = await client.index({
      index: `${process.env.ES_INDEX_PREFIX}_${String(this.index)}`,
      id: this.id,
      body: data as object,
      refresh: "wait_for",
    })
    return result.body
  }
}
