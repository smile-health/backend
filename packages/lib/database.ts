import { Dialect, Kysely, ParseJSONResultsPlugin, Transaction } from "kysely";

export class TransactionManager<DB> {
  constructor(private db: Kysely<DB>) {}

  async transaction<T>(callback: (trx: Transaction<DB>) => Promise<T>) {
    return this.db.transaction().execute(callback);
  }

  getDB() {
    return this.db;
  }
}

export class DatabaseManager<DB> {
  db: Kysely<DB>;

  constructor(dialect: Dialect, debug: boolean) {
    this.db = new Kysely<DB>({
      dialect,
      plugins: [new ParseJSONResultsPlugin()],
      log: debug ? ["query", "error"] : [],
    });
  }

  getDB() {
    return this.db;
  }
}
