import { Transaction } from "kysely";
import { env } from "process";
import { TransactionManager } from "../database.js";
import { RetriableError } from "../error.js";
import i18n from "../i18n.js";
import { logger } from "../logger.js";
import { Context, CustomContext } from "../types/context.js";
import { GetConnection } from "./type.js";

export type Handler<DB> = (c: Context<DB>, msg: string | null) => Promise<void>;

export class Consumer<DB> {
  private routeMap: { [topic: string]: Handler<DB> };

  constructor(
    private getConnection: GetConnection,
    private trxManager: TransactionManager<DB>,
    private queueName = env.RABBITMQ_QUEUE_NAME ?? `${env.APP_NAME}-queue`,
    private noAck = true,
    private useTrx = false
  ) {
    this.routeMap = {};
  }

  route(topic: string, handler: Handler<DB>) {
    this.routeMap[topic] = handler;
  }

  async start() {
    for (const topic in this.routeMap) {
      this.startWorker(topic);
    }
  }

  private async startWorker(topic: string) {
    try {
      const connection = await this.getConnection();
      const channel = await connection.createChannel();
      const queueName = `${topic}-${this.queueName}`;

      await channel.assertExchange(topic, "fanout", {
        durable: true,
      });
      await channel.assertQueue(queueName, { durable: true });
      await channel.bindQueue(queueName, topic, "");

      channel.consume(
        queueName,
        async (msg) => {
          if (msg === null || !this.routeMap[topic]) {
            return;
          }

          try {
            if (this.useTrx) {
              await this.trxManager.transaction(async (trx) => {
                const c = new CustomContext({ trx, t: i18n.t });
                if (this.routeMap[topic])
                  await this.routeMap[topic](c, msg.content.toString());
              });
            } else {
              const c = new CustomContext({
                trx: this.trxManager.getDB() as Transaction<DB>,
                t: i18n.t,
              });
              if (this.routeMap[topic])
                await this.routeMap[topic](c, msg.content.toString());
            }

            if (!this.noAck) channel.ack(msg);
          } catch (error) {
            console.error("Error callback routeMap");
            logger.error(error);

            const isRetriable = error instanceof RetriableError;

            if (!this.noAck) channel.nack(msg, false, isRetriable);
          }
        },
        {
          noAck: this.noAck,
        }
      );

      // Handle channel close/error events
      channel.on("close", () => {
        console.log("Channel closed, restarting worker...");
        setTimeout(() => this.startWorker(topic), 5000); // Retry after 5 seconds
      });

      channel.on("error", (err) => {
        console.error("Channel error:", err);
        setTimeout(() => this.startWorker(topic), 5000); // Retry after 5 seconds
      });

      console.info(`[${this.queueName}] ${topic} worker started`);
    } catch (error) {
      console.error(`Failed to start ${topic} worker`, error);
      // process.exit(1);
      setTimeout(() => this.startWorker(topic), 5000); // Retry after 5 seconds
    }
  }
}
