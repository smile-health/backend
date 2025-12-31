import { CronJob } from "cron";
import { TransactionManager } from "../database.js";
import i18n from "../i18n.js";
import { Context, CustomContext } from "../types/context.js";

export type Handler<DB> = (c: Context<DB>) => Promise<void>;

export class Cron<DB> {
  private jobs: CronJob[] = [];

  constructor(private trxManager: TransactionManager<DB>) {
    this.jobs = [];
  }

  route(schedule: string, handler: Handler<DB>) {
    const job = new CronJob(schedule, async () => {
      await this.trxManager.transaction(async (trx) => {
        const c = new CustomContext({ trx, t: i18n.t });
        await handler(c);
      });
    });

    this.jobs.push(job);
  }

  start() {
    console.log("Cron is started");
    this.jobs.forEach((job) => job.start());
  }
}
