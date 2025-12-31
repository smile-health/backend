import { Context, Next } from 'hono';
import { GrowthBookService } from './growthbook.js';

/**
 * Hono middleware that adds feature flags to the context
 * Usage: c.get("feature-flags", "flag.name", defaultValue)
 */
export function featureFlagsMiddleware() {
  return async (c: Context, next: Next) => {
    const growthBook = GrowthBookService.getInstance();
    
    // Set user attributes automatically from context
    const user = c.get('user');
    if (user) {
      growthBook.setAttributes({
        userId: user.id,
        userRole: user.role,
        environment: process.env.NODE_ENV || 'development',
        ...user, // Include all user properties
      });
    }

    // Add feature flags helper to context
    c.set('feature-flags', (flagKey: string, defaultValue: any = false) => {
      return growthBook.getFeatureValueSync(flagKey, defaultValue);
    });

    // Also add a boolean-specific helper
    c.set('feature-enabled', (flagKey: string, defaultValue: boolean = false) => {
      return growthBook.isFeatureEnabledSync(flagKey, defaultValue);
    });

    await next();
  };
}

/**
 * Type augmentation for Hono context to include feature flags
 */
declare module 'hono' {
  interface ContextVariableMap {
    'feature-flags': <T>(flagKey: string, defaultValue?: T) => T;
    'feature-enabled': (flagKey: string, defaultValue?: boolean) => boolean;
  }
}