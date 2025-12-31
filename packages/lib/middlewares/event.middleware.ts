import { Publisher } from "@smile/lib/rabbitmq/publisher.js";
import { Context, Next } from "hono";
import { Event } from "../rabbitmq/type.js";

export class EventMiddleware {
  constructor(private publisher: Publisher) {}

  public handle = async (c: Context, next: Next) => {
    await next();

    const events: Event[] = c.var.events ?? [];
    if (!c.var.error && events.length > 0) {
      console.log("publishing events");
      for (const event of events) {
        await this.publisher.publish(event.topic, event.payload);
      }
    }
  };
}
