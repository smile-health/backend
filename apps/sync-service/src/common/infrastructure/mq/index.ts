import * as amqp from "amqplib"
import env from "@/config/env.js"

let connection: amqp.Connection | undefined
let connectionStatus: 'disconnected' | 'connecting' | 'connected' | 'error' = 'disconnected'
let lastConnectionAttempt: Date | null = null
let connectionError: Error | null = null

export async function getConnection() {
  if (connection && connectionStatus === 'connected') {
    console.log(
      `♻️ [SYNC-MQ] Reusing existing RabbitMQ connection to ${env.RABBITMQ_HOST}:${env.RABBITMQ_PORT}`
    )
    return connection
  }

  if (connectionStatus === 'connecting') {
    console.log(`⏳ [SYNC-MQ] Connection attempt already in progress...`)
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
    `🔌 [SYNC-MQ] Attempting to connect to RabbitMQ at ${env.RABBITMQ_PROTOCOL}://${env.RABBITMQ_HOST}:${env.RABBITMQ_PORT}...`
  )

  try {
    const connectionUrl = `${env.RABBITMQ_PROTOCOL}://${env.RABBITMQ_USERNAME}:${encodeURIComponent(env.RABBITMQ_PASSWORD)}@${env.RABBITMQ_HOST}:${env.RABBITMQ_PORT}${env.RABBITMQ_VHOST !== '/' ? `/${encodeURIComponent(env.RABBITMQ_VHOST)}` : ''}`

    // Add timeout to the connection attempt
    const connectionPromise = amqp.connect(connectionUrl, {
      heartbeat: 60,
      timeout: 30000, // 30 second timeout
      frameMax: 1048576, // 1MB frame size (default is 131072 bytes)
    })

    // Race the connection against a timeout
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => {
        reject(
          new Error(
            `⏰ RabbitMQ connection TIMEOUT to ${env.RABBITMQ_HOST}:${env.RABBITMQ_PORT} after 30 seconds - Check if RabbitMQ server is running and accessible`
          )
        )
      }, 30000)
    })

    connection = (await Promise.race([
      connectionPromise,
      timeoutPromise,
    ])) as amqp.Connection
    
    connectionStatus = 'connected'

    console.log(
      `✅ [SYNC-MQ] RabbitMQ connection established to ${env.RABBITMQ_HOST}:${env.RABBITMQ_PORT}`
    )

    // Add error handlers
    connection.on("error", (err) => {
      connectionStatus = 'error'
      connectionError = err
      console.error(
        `❌ [SYNC-MQ] RabbitMQ connection error to ${env.RABBITMQ_HOST}:${env.RABBITMQ_PORT}:`,
        err.message
      )
      if (err.message.includes("ETIMEDOUT")) {
        console.error(
          `⏰ [SYNC-MQ] RabbitMQ ETIMEDOUT error - Connection to ${env.RABBITMQ_HOST}:${env.RABBITMQ_PORT} timed out`
        )
      }
      connection = undefined // Reset connection on error
    })

    connection.on("close", () => {
      connectionStatus = 'disconnected'
      console.log(
        `🔌 [SYNC-MQ] RabbitMQ connection closed to ${env.RABBITMQ_HOST}:${env.RABBITMQ_PORT}`
      )
      connection = undefined // Reset connection on close
    })

    return connection
  } catch (error) {
    connectionStatus = 'error'
    connectionError = error as Error
    console.error(
      `❌ [SYNC-MQ] Failed to connect to RabbitMQ at ${env.RABBITMQ_HOST}:${env.RABBITMQ_PORT}:`,
      (error as Error).message
    )

    if (
      error.message.includes("ETIMEDOUT") ||
      error.message.includes("timeout")
    ) {
      console.error(
        `⏰ [SYNC-MQ] RabbitMQ connection TIMEOUT - This is likely the source of your ETIMEDOUT error`
      )
      console.error(`🔍 Troubleshooting steps:`)
      console.error(
        `   1. Check if RabbitMQ is running: docker ps | grep rabbitmq`
      )
      console.error(
        `   2. Verify RabbitMQ port ${env.RABBITMQ_PORT} is accessible`
      )
      console.error(`   3. Check network connectivity to ${env.RABBITMQ_HOST}`)
      console.error(
        `   4. Verify RabbitMQ credentials: ${env.RABBITMQ_USERNAME}`
      )
      console.error(
        `   5. Check RabbitMQ vhost: ${env.RABBITMQ_VHOST}`
      )
    }

    if (error.message.includes("ECONNREFUSED")) {
      console.error(
        `🔒 [SYNC-MQ] RabbitMQ connection refused - Server may not be running on ${env.RABBITMQ_HOST}:${env.RABBITMQ_PORT}`
      )
    }

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
    service: 'sync'
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
