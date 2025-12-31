import { Context } from 'hono';
import { createHmac, timingSafeEqual } from 'crypto';
import { GrowthBookService } from './growthbook.js';

export interface WebhookPayload {
  timestamp: number;
  event: {
    type: string;
    data: {
      feature?: {
        id: string;
        key: string;
      };
      experiment?: {
        id: string;
        key: string;
      };
    };
  };
}

/**
 * Verify webhook signature using HMAC-SHA256
 */
function verifyWebhookSignature(
  payload: string,
  signature: string,
  secret: string
): boolean {
  if (!signature || !secret) {
    return false;
  }

  // Remove 'sha256=' prefix if present
  const cleanSignature = signature.replace(/^sha256=/, '');
  
  // Create expected signature
  const expectedSignature = createHmac('sha256', secret)
    .update(payload, 'utf8')
    .digest('hex');

  // Use timing-safe comparison
  try {
    return timingSafeEqual(
      Buffer.from(cleanSignature, 'hex'),
      Buffer.from(expectedSignature, 'hex')
    );
  } catch {
    return false;
  }
}

/**
 * Hono middleware/handler for GrowthBook webhooks
 * This will automatically refresh feature flags when changes occur
 */
export function createWebhookHandler() {
  return async (c: Context) => {
    try {
      const growthBookService = GrowthBookService.getInstance();
      const webhookSecret = growthBookService.getWebhookSecret();

      // Get raw body for signature verification
      const rawBody = await c.req.text();
      
      // Verify webhook signature if secret is configured
      if (webhookSecret) {
        const signature = c.req.header('x-growthbook-signature') || 
                         c.req.header('x-hub-signature-256') || '';
        
        if (!verifyWebhookSignature(rawBody, signature, webhookSecret)) {
          console.warn('Invalid webhook signature received');
          return c.json({ error: 'Invalid signature' }, 401);
        }
      }

      // Parse webhook payload
      let payload: WebhookPayload;
      try {
        payload = JSON.parse(rawBody);
      } catch (error) {
        console.error('Invalid webhook payload:', error);
        return c.json({ error: 'Invalid JSON payload' }, 400);
      }

      // Log webhook event
      console.log('GrowthBook webhook received:', {
        type: payload.event?.type,
        timestamp: payload.timestamp,
        feature: payload.event?.data?.feature?.key,
        experiment: payload.event?.data?.experiment?.key,
      });

      // Refresh feature flags for relevant events
      const refreshEvents = [
        'feature.created',
        'feature.updated',
        'feature.deleted',
        'experiment.created',
        'experiment.updated',
        'experiment.deleted',
        'experiment.started',
        'experiment.stopped',
      ];

      if (refreshEvents.includes(payload.event?.type)) {
        await growthBookService.refreshFeatures();
        console.log(`Feature flags refreshed due to ${payload.event.type} event`);
      }

      return c.json({ 
        success: true, 
        message: 'Webhook processed successfully',
        refreshed: refreshEvents.includes(payload.event?.type)
      });

    } catch (error) {
      console.error('Webhook processing error:', error);
      return c.json({ 
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      }, 500);
    }
  };
}

/**
 * Simple endpoint to manually refresh feature flags
 * Useful for testing or manual operations
 */
export function createRefreshHandler() {
  return async (c: Context) => {
    try {
      const growthBookService = GrowthBookService.getInstance();
      await growthBookService.refreshFeatures();
      
      return c.json({ 
        success: true, 
        message: 'Feature flags refreshed successfully',
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Manual refresh error:', error);
      return c.json({ 
        error: 'Failed to refresh feature flags',
        message: error instanceof Error ? error.message : 'Unknown error'
      }, 500);
    }
  };
}