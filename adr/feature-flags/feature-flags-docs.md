# Simple Feature Flags Implementation

## Overview

This document describes the "ultra-simple" feature flags implementation that provides a lightweight, context-based approach to feature flag management across services with real-time webhook support.

## Architecture

The simple feature flags system consists of:

1. **Middleware**: Injects feature flag functions into the Hono context
2. **Context Integration**: Feature flag functions available via `c.get()`
3. **GrowthBook Integration**: Backend powered by GrowthBook for flag management
4. **Webhook Support**: Real-time feature flag updates via GrowthBook webhooks
5. **Manual Refresh**: API endpoints for manual feature flag refresh

## Usage

### 1. Environment Configuration

Set up your environment variables:

```bash
# .env
GROWTHBOOK_API_HOST=https://cdn.growthbook.io
GROWTHBOOK_CLIENT_KEY=your_growthbook_client_key_here
GROWTHBOOK_WEBHOOK_SECRET=your_webhook_secret_here
```

### 2. Setup Middleware

Add the feature flags middleware to your service's wire configuration:

```typescript
// apps/warehouse-service/src/wire.ts
import { featureFlagsMiddleware } from "@smile-health/lib/feature-flags/middleware.js";

// Apply middleware to your app
warehouseApp.use("*", featureFlagsMiddleware);
```

### 3. Using Feature Flags in Controllers/Modules

#### Check if Feature is Enabled

```typescript
// Simple boolean check
export class UserActivityModule {
  async getDashboardData(c: Context) {
    const featureEnabled = c.get("feature-enabled");

    const isDashboardEnabled = featureEnabled("dashboard-customer", false);

    if (!isDashboardEnabled) {
      return c.json({ message: "Feature not available" }, 403);
    }

    // Feature is enabled, proceed with logic
    return await this.fetchDashboardData(c);
  }
}
```

#### Get Feature Configuration

```typescript
// Get feature configuration object
export class UserActivityModule {
  async getCustomerConfig(c: Context) {
    const featureFlags = c.get("feature-flags");

    const config = featureFlags("dashboard-customer-config", {
      maxItems: 10,
      enableAdvanced: false,
    });

    return await this.processWithConfig(c, config);
  }
}
```

#### Advanced Usage with Type Safety

```typescript
interface DashboardConfig {
  maxItems: number;
  enableAdvanced: boolean;
  theme: "light" | "dark";
}

export class UserActivityModule {
  async getTypedConfig(c: Context) {
    const featureFlags = c.get("feature-flags");

    const config = featureFlags("dashboard-config", {
      maxItems: 10,
      enableAdvanced: false,
      theme: "light" as const,
    }) as DashboardConfig;

    return config;
  }
}
```

### 4. Setup Webhook Endpoints (Optional but Recommended)

Add webhook endpoints for real-time feature flag updates:

```typescript
// apps/warehouse-service/src/wire.ts
import {
  createWebhookHandler,
  createRefreshHandler,
} from "@smile-health/lib/feature-flags";

// Webhook endpoint for GrowthBook
warehouseApp.post("/webhooks/growthbook", createWebhookHandler());

// Manual refresh endpoint (optional)
warehouseApp.post("/admin/feature-flags/refresh", createRefreshHandler());
```

### 5. Configure GrowthBook Webhook

In your GrowthBook dashboard:

1. Go to **Settings** → **Webhooks**
2. Add a new webhook with:
   - **URL**: `https://your-domain.com/webhooks/growthbook`
   - **Secret**: Same value as `GROWTHBOOK_WEBHOOK_SECRET`
   - **Events**: Select feature and experiment events you want to track

## Real-time Behavior

### Without Webhooks

- Feature flags are loaded once at application startup
- Changes in GrowthBook dashboard require application restart to take effect
- Suitable for features that don't need immediate updates

### With Webhooks (Recommended)

- Feature flags are automatically refreshed when changes occur in GrowthBook
- Near real-time updates (typically within seconds)
- Secure signature verification prevents unauthorized updates
- Automatic refresh on these events:
  - `feature.created`, `feature.updated`, `feature.deleted`
  - `experiment.created`, `experiment.updated`, `experiment.deleted`
  - `experiment.started`, `experiment.stopped`

### Manual Refresh

- Use the `/admin/feature-flags/refresh` endpoint to manually trigger updates
- Useful for testing or emergency feature flag changes
- Returns confirmation with timestamp

## Benefits

- **Simple Integration**: Easy to add to existing Hono applications
- **Type Safety**: Full TypeScript support with proper typing
- **Performance**: Synchronous feature flag checks after initial load
- **Flexibility**: Support for both boolean flags and complex feature values
- **User Context**: Automatic user attribute mapping from request context
- **Real-time webhook support**: Feature flags update automatically when changed in GrowthBook

## Implementation

### Core Components

#### 1. Feature Flags Middleware

Location: `packages/lib/feature-flags/middleware.ts`

```typescript
import { MiddlewareHandler } from "hono";
import { growthbook } from "./growthbook.js";

export const featureFlagsMiddleware: MiddlewareHandler = async (c, next) => {
  // Set feature flag functions in context
  c.set("feature-flags", <T>(flagKey: string, defaultValue?: T): T => {
    return growthbook.getFeatureValue(flagKey, defaultValue);
  });

  c.set(
    "feature-enabled",
    (flagKey: string, defaultValue: boolean = false): boolean => {
      return growthbook.isOn(flagKey) ?? defaultValue;
    }
  );

  await next();
};
```

#### 2. GrowthBook Integration

Location: `packages/lib/feature-flags/growthbook.ts`

```typescript
import { GrowthBook } from "@growthbook/growthbook";

export interface GrowthBookConfig {
  apiHost?: string;
  clientKey?: string;
  environment?: string;
  enableDevMode?: boolean;
  trackingCallback?: (experiment: any, result: any) => void;
  webhookSecret?: string;
}

export class GrowthBookService {
  private static instance: GrowthBookService;
  private growthBook: GrowthBook;
  private initializationPromise: Promise<void> | null = null;
  private webhookSecret?: string;

  private constructor(config: GrowthBookConfig = {}) {
    this.webhookSecret =
      config.webhookSecret || process.env.GROWTHBOOK_WEBHOOK_SECRET;

    this.growthBook = new GrowthBook({
      apiHost:
        config.apiHost ||
        process.env.GROWTHBOOK_API_HOST ||
        "https://cdn.growthbook.io",
      clientKey: config.clientKey || process.env.GROWTHBOOK_CLIENT_KEY || "",
      enableDevMode:
        config.enableDevMode || process.env.NODE_ENV === "development",
      trackingCallback: config.trackingCallback,
      attributes: {
        environment:
          config.environment || process.env.ENVIRONMENT || "development",
      },
    });

    // Auto-initialize on creation
    this.autoInitialize();
  }

  static getInstance(config?: GrowthBookConfig): GrowthBookService {
    if (!GrowthBookService.instance) {
      GrowthBookService.instance = new GrowthBookService(config);
    }
    return GrowthBookService.instance;
  }

  /**
   * Manually refresh feature flags from GrowthBook API
   * Useful for webhook handlers or manual refresh endpoints
   */
  async refreshFeatures(): Promise<void> {
    try {
      await this.growthBook.loadFeatures();
      console.log("Feature flags refreshed successfully");
    } catch (error) {
      console.error("Failed to refresh feature flags:", error);
      throw error;
    }
  }

  isFeatureEnabledSync(
    featureKey: string,
    defaultValue: boolean = false
  ): boolean {
    return this.growthBook.isOn(featureKey) ?? defaultValue;
  }

  getFeatureValueSync<T>(featureKey: string, defaultValue: T): T {
    return this.growthBook.getFeatureValue(featureKey, defaultValue);
  }
}
```

#### 3. Webhook Handler

Location: `packages/lib/feature-flags/webhook.ts`

```typescript
import { Context } from "hono";
import { createHmac, timingSafeEqual } from "crypto";
import { GrowthBookService } from "./growthbook.js";

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
        const signature =
          c.req.header("x-growthbook-signature") ||
          c.req.header("x-hub-signature-256") ||
          "";

        if (!verifyWebhookSignature(rawBody, signature, webhookSecret)) {
          console.warn("Invalid webhook signature received");
          return c.json({ error: "Invalid signature" }, 401);
        }
      }

      // Parse and process webhook payload
      const payload = JSON.parse(rawBody);

      // Refresh feature flags for relevant events
      const refreshEvents = [
        "feature.created",
        "feature.updated",
        "feature.deleted",
        "experiment.created",
        "experiment.updated",
        "experiment.deleted",
        "experiment.started",
        "experiment.stopped",
      ];

      if (refreshEvents.includes(payload.event?.type)) {
        await growthBookService.refreshFeatures();
        console.log(
          `Feature flags refreshed due to ${payload.event.type} event`
        );
      }

      return c.json({
        success: true,
        message: "Webhook processed successfully",
        refreshed: refreshEvents.includes(payload.event?.type),
      });
    } catch (error) {
      console.error("Webhook processing error:", error);
      return c.json({ error: "Internal server error" }, 500);
    }
  };
}

/**
 * Simple endpoint to manually refresh feature flags
 */
export function createRefreshHandler() {
  return async (c: Context) => {
    try {
      const growthBookService = GrowthBookService.getInstance();
      await growthBookService.refreshFeatures();

      return c.json({
        success: true,
        message: "Feature flags refreshed successfully",
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error("Manual refresh error:", error);
      return c.json({ error: "Failed to refresh feature flags" }, 500);
    }
  };
}
```

#### 4. Context Type Definitions

Location: `packages/lib/types/context.ts`

```typescript
export interface IContextVariableMap<T = any> {
  trx: Transaction<T>;
  t: TFunction;
  // Common properties
  programId?: number;
  language?: string;
  deviceId?: number;
  roleId?: number;
  file?: FileResponse;
  // Feature flag functions
  "feature-flags": <T>(flagKey: string, defaultValue?: T) => T;
  "feature-enabled": (flagKey: string, defaultValue?: boolean) => boolean;
}
```

## Best Practices

### 1. Naming Conventions

Use kebab-case for feature flag keys:

- ✅ `dashboard-customer`
- ✅ `advanced-analytics`
- ✅ `new-ui-components`
- ❌ `dashboardCustomer`
- ❌ `DASHBOARD_CUSTOMER`

### 2. Default Values

Always provide sensible default values:

```typescript
// Good: Provides safe default
const featureFlag = c.get("feature-enabled");
const isEnabled = featureFlag("new-feature", false);

// Good: Provides default configuration
const config = c.get("feature-flags", "feature-config", {
  timeout: 5000,
  retries: 3,
});
```

### 3. Error Handling

Handle feature flag failures gracefully:

```typescript
export class SomeModule {
  async processWithFeature(c: Context) {
    try {
      const isEnabled = c.get("feature-enabled", "experimental-feature", false);

      if (isEnabled) {
        return await this.experimentalLogic(c);
      }

      return await this.standardLogic(c);
    } catch (error) {
      // Fallback to standard logic if feature flag fails
      console.warn("Feature flag check failed, using standard logic:", error);
      return await this.standardLogic(c);
    }
  }
}
```

### 4. Testing

Mock feature flags in tests:

```typescript
// In your test files
const mockContext = {
  get: vi.fn((key: string, flagKey: string, defaultValue: any) => {
    if (key === "feature-enabled" && flagKey === "test-feature") {
      return true;
    }
    return defaultValue;
  }),
};
```

## Migration from Old System

### Before (Complex System)

```typescript
// Old approach
const isEnabled = await this.featureFlags.isDashboardCustomerEnabled(c);
const config = await this.featureFlags.getDashboardCustomerConfig(c);
```

### After (Simple System)

```typescript
// New approach
const isEnabled = c.get("feature-enabled", "dashboard-customer", false);
const config = c.get("feature-flags", "dashboard-customer-config", {});
```

## Services Using Feature Flags

Currently implemented in:

- **Warehouse Service**: Full implementation with middleware and usage
- **Core Service**: Context interface only (ready for implementation)
- **Main Service**: Context interface only (ready for implementation)
- **Platform Service**: Context interface only (ready for implementation)

## Troubleshooting

### Common Issues

1. **Feature flags not working**
   - Ensure middleware is properly registered
   - Check GrowthBook client key is set
   - Verify feature exists in GrowthBook dashboard

2. **TypeScript errors**
   - Ensure context types are properly imported
   - Check that service extends `IContextVariableMap`

3. **Default values not working**
   - Always provide default values as second parameter
   - Ensure GrowthBook connection is established

### Debug Mode

Enable debug mode in development:

```typescript
// In growthbook.ts
export const growthbook = new GrowthBook({
  apiHost: "https://cdn.growthbook.io",
  clientKey: process.env.GROWTHBOOK_CLIENT_KEY || "",
  enableDevMode: true, // Enable for debugging
});
```

## Future Enhancements

1. **User Targeting**: Add user context for personalized feature flags
2. **A/B Testing**: Implement experiment tracking
3. **Analytics**: Add feature usage analytics
4. **Caching**: Implement local caching for better performance

## Related Documentation

- [GrowthBook Documentation](https://docs.growthbook.io/)
- [Hono Context Documentation](https://hono.dev/api/context)
- [Service Architecture](./diagrams/warehouse-service-components.md)
