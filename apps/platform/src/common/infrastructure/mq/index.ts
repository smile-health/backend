import amqp from "amqplib"
import env from "@/config/env.js"

let connection: amqp.Connection | undefined

export async function getConnection() {
  if (connection) {
    return connection
  }

  connection = await amqp.connect({
    protocol: env.RABBITMQ_PROTOCOL,
    hostname: env.RABBITMQ_HOST,
    port: env.RABBITMQ_PORT,
    username: env.RABBITMQ_USERNAME,
    password: env.RABBITMQ_PASSWORD,
    vhost: env.RABBITMQ_VHOST,
    frameMax: 1048576, // 1MB frame size
  })

  return connection
}
