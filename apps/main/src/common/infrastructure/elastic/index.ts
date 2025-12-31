import { Client } from "@elastic/elasticsearch"
import { env } from "process"

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

let connectionStatus: ConnectionStatus = 'disconnected';
let connectionError: Error | null = null;

try {
  connectionStatus = 'connecting';
  console.log(`🔌 [ELASTICSEARCH] Initializing Elasticsearch client for host: ${env.ES_HOST}`);
  
  if (!env.ES_HOST) {
    connectionStatus = 'error';
    connectionError = new Error('ES_HOST environment variable not configured');
    console.log('❌ [ELASTICSEARCH] ES_HOST environment variable not configured');
  } else {
    connectionStatus = 'connected';
    connectionError = null;
    console.log('✅ [ELASTICSEARCH] Elasticsearch client initialized successfully');
  }
} catch (error) {
  connectionStatus = 'error';
  connectionError = error instanceof Error ? error : new Error(String(error));
  console.log(`❌ [ELASTICSEARCH] Elasticsearch client failed initialization: ${error}`);
}

export const client = new Client({
  node: env.ES_HOST,
  auth: {
    username: env.ES_USERNAME ?? "",
    password: env.ES_PASSWORD ?? "",
  },
});

// Monitoring functions
export function getConnectionStatus(): ConnectionStatus {
  return connectionStatus;
}

export function getConnectionError(): Error | null {
  return connectionError;
}

export async function healthCheck(): Promise<boolean> {
  try {
    const response = await client.ping();
    connectionStatus = 'connected';
    connectionError = null;
    return response.statusCode === 200;
  } catch (error) {
    connectionStatus = 'error';
    connectionError = error instanceof Error ? error : new Error(String(error));
    console.log(`❌ [ELASTICSEARCH] Health check failed: ${error}`);
    return false;
  }
}
