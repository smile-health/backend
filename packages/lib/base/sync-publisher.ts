import { Publisher } from "../rabbitmq/publisher.js";

export abstract class SyncPublisher {
  constructor(
    protected readonly publisher: Publisher,
    protected syncServiceFlag: boolean = true
  ) {}

  async publish<T>(topic: string, message: T): Promise<void | null> {
    if (!this.syncServiceFlag) {
      console.log("Sync is disabled");
      return null;
    }

    return await this.publisher.publish(topic, message);
  }
}
