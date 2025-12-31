import amqp from "amqplib";
import { logger } from "../logger.js";
import { GetConnection } from "./type.js";
import { Context } from "hono";

export class Publisher {
  private channel: amqp.Channel | undefined = undefined;
  private assertedExchanges: Map<string, string> = new Map();
  private readonly maxChunkSize = 1048576 - 8192; // 1MB - 8KB overhead

  constructor(private getConnection: GetConnection) {}

  private async getChannel(): Promise<amqp.Channel> {
    if (this.channel) {
      return this.channel;
    }
    const connection = await this.getConnection();
    this.channel = await connection.createChannel();

    this.channel.on("error", (err) => {
      logger.error(`Connection error: ${err}`);
      this.channel = null;
    });

    this.channel.on("close", () => {
      logger.info("RabbitMQ: Connection closed");
      this.channel = null;
    });

    return this.channel;
  }

  private async assertExchange(
    exchange: string,
    type: string = "fanout"
  ): Promise<void> {
    const existingType = this.assertedExchanges.get(exchange);
    if (existingType === type) {
      return; // Exchange already asserted with the same type
    }
    const channel = await this.getChannel();
    await channel.assertExchange(exchange, type, { durable: true });
    this.assertedExchanges.set(exchange, type);
  }

  public async publish<T>(
    exchange: string,
    message: T,
    type: string = "fanout"
  ): Promise<void> {
    await this.assertExchange(exchange, type);
    const channel = await this.getChannel();
    try {
      const messageBuffer = Buffer.from(JSON.stringify(message));
      
      // Validate message size against frame limit (1MB - some overhead for headers)
      const maxMessageSize = 4194304 - 8192; // 1MB - 8KB overhead
      if (messageBuffer.length > maxMessageSize) {
        throw new Error(`Message size (${messageBuffer.length} bytes) exceeds maximum frame size (${maxMessageSize} bytes). Consider splitting the message or reducing payload size.`);
      }

      channel.publish(exchange, "", messageBuffer, {
        persistent: true,
      });
      logger.info(`Message published to exchange: ${exchange}`);
    } catch (error) {
      // Handle frame size exceeded errors specifically
      if (error instanceof Error && error.message.includes('frame size exceeds')) {
        const enhancedError = new Error(`RabbitMQ frame size exceeded: ${error.message}. Consider reducing message payload size or implementing message chunking.`);
        logger.error(`Frame size error in publish: ${enhancedError.message}`);
        throw enhancedError;
      }
      logger.error(`Failed to publish message: ${error}`);
      throw error;
    }
  }

  public async close(): Promise<void> {
    if (this.channel) {
      await this.channel.close();
      this.channel = undefined;
    }
    this.assertedExchanges.clear();
  }

  public async publishNotification<T>(c: Context, worker: string, payload: T) {
    const channel = await this.getChannel();
    try {
      channel.assertQueue(worker, { durable: true });
      const messageBuffer = Buffer.from(JSON.stringify(payload));
      
      // Validate message size against frame limit (1MB - some overhead for headers)
      const maxMessageSize = 4194304 - 8192; // 1MB - 8KB overhead
      if (messageBuffer.length > maxMessageSize) {
        throw new Error(`Message size (${messageBuffer.length} bytes) exceeds maximum frame size (${maxMessageSize} bytes). Consider splitting the message or reducing payload size.`);
      }

      const result = channel.sendToQueue(worker, messageBuffer);
      console.log(result);
      console.log(" [x] Sent %s", worker, payload);
    } catch (error) {
      // Handle frame size exceeded errors specifically
      if (error instanceof Error && error.message.includes('frame size exceeds')) {
        const enhancedError = new Error(`RabbitMQ frame size exceeded: ${error.message}. Consider reducing message payload size or implementing message chunking.`);
        logger.error(`Frame size error in publishNotification: ${enhancedError.message}`);
        throw enhancedError;
      }
      logger.error(`Failed to publish message: ${error}`);
      throw error;
    }
  }

  private chunkMessage(message: any): { chunks: string[], messageId: string, totalChunks: number } {
    const messageString = JSON.stringify(message);
    const messageBuffer = Buffer.from(messageString);
    
    if (messageBuffer.length <= this.maxChunkSize) {
      return {
        chunks: [messageString],
        messageId: Math.random().toString(36).substring(2, 15),
        totalChunks: 1
      };
    }
    
    const chunks: string[] = [];
    const messageId = Math.random().toString(36).substring(2, 15);
    let offset = 0;
    
    while (offset < messageBuffer.length) {
      const chunkSize = Math.min(this.maxChunkSize, messageBuffer.length - offset);
      const chunk = messageBuffer.subarray(offset, offset + chunkSize).toString();
      chunks.push(chunk);
      offset += chunkSize;
    }
    
    return {
      chunks,
      messageId,
      totalChunks: chunks.length
    };
  }

  public async publishLargeMessage<T>(
    exchange: string,
    message: T,
    routingKey: string = "",
    type: string = "fanout"
  ): Promise<void> {
    const { chunks, messageId, totalChunks } = this.chunkMessage(message);
    
    if (totalChunks === 1) {
      // Single message, use regular publish
      await this.publish(exchange, message, type);
      return;
    }
    
    // Publish chunks with metadata
    for (let i = 0; i < chunks.length; i++) {
      const chunkMessage = {
        messageId,
        chunkIndex: i,
        totalChunks,
        data: chunks[i],
        isChunked: true
      };
      
      await this.publish(exchange, chunkMessage, type);
      logger.info(`Published chunk ${i + 1}/${totalChunks} for message ${messageId}`);
    }
  }

  public setMessage(c: Context, data: string) {
    const splitIndex = data.indexOf(", {");
    if (splitIndex === -1) return c.var.t(data) || data;

    const label = data.slice(0, splitIndex).trim();
    const jsonString = data.slice(splitIndex + 2).trim();

    try {
      const json = JSON.parse(jsonString);
      const t = c.var.t;

      const transformed = Object.fromEntries(
        Object.entries(json).map(([k, v]) => [
          k,
          typeof v === "string" ? t(v) : v,
        ])
      );

      return t(label, transformed);
    } catch (e) {
      return data;
    }
  }
}
