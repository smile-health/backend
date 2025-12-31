import amqp from "amqplib";

export interface Event {
  topic: string;
  payload: object;
}

export type GetConnection = () => Promise<amqp.Connection>;
