import { GrowthBookConfig, GrowthBookService } from './growthbook.js';

export { featureFlagsMiddleware } from './middleware.js';
export { createWebhookHandler, createRefreshHandler } from './webhook.js';
export type { WebhookPayload } from './webhook.js';
export type { GrowthBookConfig } from './growthbook.js';

/**
 * Get GrowthBook instance with auto-initialization
 * No manual initialization required - it happens automatically
 */
export function getGrowthBook(config?: Partial<GrowthBookConfig>): GrowthBookService {
  const defaultConfig: GrowthBookConfig = {
    apiHost: process.env.GROWTHBOOK_API_HOST || 'https://cdn.growthbook.io',
    clientKey: process.env.GROWTHBOOK_CLIENT_KEY || '',
    environment: process.env.NODE_ENV || 'dev',
    enableDevMode: process.env.NODE_ENV === 'dev',
  };

  return GrowthBookService.getInstance({
    ...defaultConfig,
    ...config,
  });
}

// Keep the old function name for backward compatibility
export const initializeGrowthBook = getGrowthBook;