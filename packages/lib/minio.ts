import { Client } from "minio";

export interface MinioConfig {
  endPoint: string;
  port?: number;
  region: string;
  useSSL: boolean;
  accessKey: string;
  secretKey: string;
}

export type ConnectionStatus =
  | "disconnected"
  | "connecting"
  | "connected"
  | "error";

export interface MinioClientWithMonitoring extends Client {
  getConnectionStatus(): ConnectionStatus;
  healthCheck(): Promise<boolean>;
}

let connectionStatus: ConnectionStatus = "disconnected";
let connectionError: Error | null = null;

export function createMinioClient(
  config: MinioConfig
): MinioClientWithMonitoring | undefined {
  let client: Client | undefined = undefined;

  try {
    connectionStatus = "connecting";
    console.log(
      `🔌 [MINIO] Initializing MinIO client for endpoint: ${config.endPoint}`
    );

    if (config.endPoint && config.accessKey && config.secretKey) {
      if (config.port) {
        client = new Client({
          endPoint: config.endPoint,
          port: config.port,
          useSSL: config.useSSL,
          accessKey: config.accessKey,
          secretKey: config.secretKey,
          region: config.region,
          partSize: 100 * 1024 * 1024, // 100MB - set above 50MB threshold to avoid multipart upload issues
          pathStyle: true, // Force path-style requests to avoid subdomain issues
        });
      } else {
        client = new Client({
          endPoint: config.endPoint,
          useSSL: config.useSSL,
          accessKey: config.accessKey,
          secretKey: config.secretKey,
          region: config.region,
          partSize: 100 * 1024 * 1024, // 100MB - set above 50MB threshold to avoid multipart upload issues
          pathStyle: true, // Force path-style requests to avoid subdomain issues
        });
      }

      connectionStatus = "connected";
      connectionError = null;
      console.log(`✅ [MINIO] MinIO client initialized successfully`);
    } else {
      connectionStatus = "error";
      connectionError = new Error("Incomplete MinIO configuration");
      console.log(
        "❌ [MINIO] MinIO client incomplete requirement - failed initialization"
      );
    }
  } catch (error) {
    connectionStatus = "error";
    connectionError = error instanceof Error ? error : new Error(String(error));
    console.log(`❌ [MINIO] MinIO client failed initialization: ${error}`);
  }

  if (!client) {
    return undefined;
  }

  // Extend the client with monitoring capabilities
  const monitoredClient = client as MinioClientWithMonitoring;

  monitoredClient.getConnectionStatus = () => connectionStatus;

  monitoredClient.healthCheck = async (): Promise<boolean> => {
    try {
      // Test connection by listing buckets (minimal operation)
      await client!.listBuckets();
      connectionStatus = "connected";
      connectionError = null;
      return true;
    } catch (error) {
      connectionStatus = "error";
      connectionError =
        error instanceof Error ? error : new Error(String(error));
      console.log(`❌ [MINIO] Health check failed: ${error}`);
      return false;
    }
  };

  return monitoredClient;
}

export function createMinioClientFromEnv():
  | MinioClientWithMonitoring
  | undefined {
  const env = process.env;

  if (!env.MINIO_ENDPOINT || !env.MINIO_ACCESS_KEY || !env.MINIO_SECRET_KEY) {
    console.log(
      "❌ [MINIO] MinIO client incomplete environment variables - failed initialization"
    );
    return undefined;
  }

  const config: MinioConfig = {
    endPoint: env.MINIO_ENDPOINT,
    useSSL: env.MINIO_USE_SSL === "true",
    accessKey: env.MINIO_ACCESS_KEY,
    secretKey: env.MINIO_SECRET_KEY,
    region: env.MINIO_REGION ?? "ap-southeast-3",
  };

  if (env.MINIO_PORT) {
    config.port = parseInt(env.MINIO_PORT, 10);
  }

  return createMinioClient(config);
}

// Helper functions for monitoring
export function getMinioConnectionStatus(): ConnectionStatus {
  return connectionStatus;
}

export function getMinioConnectionError(): Error | null {
  return connectionError;
}
