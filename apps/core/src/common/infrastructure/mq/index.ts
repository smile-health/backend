import amqp from "amqplib"
import env from "@/config/env.js"
import { logger } from "@smile-health/lib/logger"

let connection: amqp.Connection | undefined
let connectionStatus: 'disconnected' | 'connecting' | 'connected' | 'error' = 'disconnected'
let lastConnectionAttempt: Date | null = null
let connectionError: Error | null = null

export async function getConnection() {
  if (connection && connectionStatus === 'connected') {
    console.log(
      `♻️ [CORE-MQ] Reusing existing RabbitMQ connection to ${env.RABBITMQ_HOST}:${env.RABBITMQ_PORT}${env.RABBITMQ_VHOST !== '/' ? env.RABBITMQ_VHOST : ''}`
    )
    return connection
  }

  if (connectionStatus === 'connecting') {
    console.log(`⏳ [CORE-MQ] Connection attempt already in progress...`)
    // Wait for existing connection attempt
    while (connectionStatus === 'connecting') {
      await new Promise(resolve => setTimeout(resolve, 100))
    }
    if (connection && connectionStatus === 'connected') {
      return connection
    }
  }

  connectionStatus = 'connecting'
  lastConnectionAttempt = new Date()
  connectionError = null

  console.log(
    `🔌 [CORE-MQ] Attempting to connect to RabbitMQ at ${env.RABBITMQ_PROTOCOL}://${env.RABBITMQ_HOST}:${env.RABBITMQ_PORT}${env.RABBITMQ_VHOST !== '/' ? env.RABBITMQ_VHOST : ''}...`
  )

  try {
    const connectionPromise = amqp.connect({
      protocol: env.RABBITMQ_PROTOCOL,
      hostname: env.RABBITMQ_HOST,
      port: env.RABBITMQ_PORT,
      username: env.RABBITMQ_USERNAME,
      password: env.RABBITMQ_PASSWORD,
      heartbeat: 60,
      frameMax: 4194304, // 1MB frame size (default is 131072 bytes)
    })

    // Add timeout to the connection attempt
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(
          new Error(
            `⏰ [CORE-MQ] RabbitMQ connection TIMEOUT to ${env.RABBITMQ_HOST}:${env.RABBITMQ_PORT}${env.RABBITMQ_VHOST !== '/' ? env.RABBITMQ_VHOST : ''} after 30 seconds`
          )
        )
      }, 30000)
    })

    connection = await Promise.race([connectionPromise, timeoutPromise])
    connectionStatus = 'connected'

    console.log(
      `✅ [CORE-MQ] RabbitMQ connection established to ${env.RABBITMQ_HOST}:${env.RABBITMQ_PORT}${env.RABBITMQ_VHOST !== '/' ? env.RABBITMQ_VHOST : ''}`
    )

    // Add error handlers
    connection.on("error", (err) => {
      connectionStatus = 'error'
      connectionError = err
      logger.error(
        `❌ [CORE-MQ] RabbitMQ connection error to ${env.RABBITMQ_HOST}:${env.RABBITMQ_PORT}${env.RABBITMQ_VHOST !== '/' ? env.RABBITMQ_VHOST : ''}: ${err}`
      )
      connection = undefined
    })

    connection.on("close", () => {
      connectionStatus = 'disconnected'
      console.log(
        `🔌 [CORE-MQ] RabbitMQ connection closed to ${env.RABBITMQ_HOST}:${env.RABBITMQ_PORT}${env.RABBITMQ_VHOST !== '/' ? env.RABBITMQ_VHOST : ''}`
      )
      connection = undefined
    })

    return connection
  } catch (error) {
    connectionStatus = 'error'
    connectionError = error as Error
    logger.error(
      `❌ [CORE-MQ] Failed to connect to RabbitMQ at ${env.RABBITMQ_HOST}:${env.RABBITMQ_PORT}${env.RABBITMQ_VHOST !== '/' ? env.RABBITMQ_VHOST : ''}: ${error}`
    )
    throw error
  }
}

export function getConnectionStatus() {
  return {
    status: connectionStatus,
    lastAttempt: lastConnectionAttempt,
    error: connectionError,
    isConnected: connectionStatus === 'connected' && !!connection,
    host: `${env.RABBITMQ_HOST}:${env.RABBITMQ_PORT}`,
    service: 'core'
  }
}

export async function healthCheck() {
  const status = getConnectionStatus()
  if (!status.isConnected) {
    return {
      healthy: false,
      service: 'rabbitmq',
      status: status.status,
      error: status.error?.message
    }
  }

  try {
    // Test connection by creating a channel
    const channel = await connection!.createChannel()
    await channel.close()
    return {
      healthy: true,
      service: 'rabbitmq',
      status: 'connected'
    }
  } catch (error) {
    return {
      healthy: false,
      service: 'rabbitmq',
      status: 'error',
      error: (error as Error).message
    }
  }
}
