import { env } from "@/config/env.js"
import { createMinioClient, MinioClientWithMonitoring, ConnectionStatus } from "@smile/lib/minio.js"

export type { ConnectionStatus, MinioClientWithMonitoring };

const minioClient: MinioClientWithMonitoring | undefined = (() => {
  try {
    if (!env.MINIO_ENDPOINT || !env.MINIO_ACCESS_KEY || !env.MINIO_SECRET_KEY) {
      console.log("❌ [CORE-MINIO] MinIO client incomplete requirement - failed initialization")
      return undefined
    }

    const config = {
      endPoint: env.MINIO_ENDPOINT,
      region: env.MINIO_REGION || "ap-southeast-3",
      useSSL: env.MINIO_USE_SSL || false,
      accessKey: env.MINIO_ACCESS_KEY,
      secretKey: env.MINIO_SECRET_KEY,
      ...(env.MINIO_PORT && { port: env.MINIO_PORT })
    };

    return createMinioClient(config);
  } catch (error) {
    console.log(`❌ [CORE-MINIO] MinIO client failed initialization: ${error}`)
    return undefined
  }
})()

// Export monitoring functions
export function getConnectionStatus(): ConnectionStatus {
  return minioClient?.getConnectionStatus() || 'disconnected';
}

export async function healthCheck(): Promise<boolean> {
  if (!minioClient) {
    return false;
  }
  return await minioClient.healthCheck();
}

export default minioClient
