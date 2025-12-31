import { Context, Next } from "hono";
import { TransactionManager } from "../database.js";

export class TransactionMiddleware<DB> {
  constructor(private trxManager: TransactionManager<DB>) {}

  public handle = async (c: Context, next: Next) => {
    await this.trxManager.transaction(async (trx) => {
      c.set("trx", trx);

      await next();
      if (c.error) {
        throw c.error;
      }
    });
  };
}
