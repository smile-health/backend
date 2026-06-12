import { Context } from "hono";
import { HTTPException } from "hono/http-exception";

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

// Simple in-memory rate limiter
// For production, replace with Redis-based implementation using @smile-health/lib/cache
class InMemoryRateLimiter {
  private store: Map<string, RateLimitEntry> = new Map();
  private cleanupInterval: ReturnType<typeof setInterval>;

  constructor() {
    // Clean up expired entries every 5 minutes
    this.cleanupInterval = setInterval(() => {
      const now = Date.now();
      for (const [key, entry] of this.store.entries()) {
        if (entry.resetAt <= now) {
          this.store.delete(key);
        }
      }
    }, 5 * 60 * 1000);

    // Allow the process to exit even if this interval is active
    if (this.cleanupInterval.unref) {
      this.cleanupInterval.unref();
    }
  }

  check(key: string, maxRequests: number, windowMs: number): {
    allowed: boolean;
    remaining: number;
    resetAt: number;
  } {
    const now = Date.now();
    const entry = this.store.get(key);

    if (!entry || entry.resetAt <= now) {
      // New window
      this.store.set(key, {
        count: 1,
        resetAt: now + windowMs,
      });
      return {
        allowed: true,
        remaining: maxRequests - 1,
        resetAt: now + windowMs,
      };
    }

    entry.count++;

    if (entry.count > maxRequests) {
      return {
        allowed: false,
        remaining: 0,
        resetAt: entry.resetAt,
      };
    }

    return {
      allowed: true,
      remaining: maxRequests - entry.count,
      resetAt: entry.resetAt,
    };
  }
}

const rateLimiter = new InMemoryRateLimiter();

// Configuration
const EMAIL_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const EMAIL_MAX_REQUESTS = 3; // 3 requests per email per window
const IP_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const IP_MAX_REQUESTS = 10; // 10 requests per IP per window

export interface RateLimitConfig {
  emailWindowMs?: number;
  emailMaxRequests?: number;
  ipWindowMs?: number;
  ipMaxRequests?: number;
}

export function createForgotPasswordRateLimiter(config?: RateLimitConfig) {
  const emailWindowMs = config?.emailWindowMs ?? EMAIL_WINDOW_MS;
  const emailMaxRequests = config?.emailMaxRequests ?? EMAIL_MAX_REQUESTS;
  const ipWindowMs = config?.ipWindowMs ?? IP_WINDOW_MS;
  const ipMaxRequests = config?.ipMaxRequests ?? IP_MAX_REQUESTS;

  return async function forgotPasswordRateLimiter(c: Context, next: () => Promise<void>) {
    // Get the email from the request body
    let email: string | undefined;
    try {
      const body = await c.req.json();
      email = body?.email;
    } catch {
      // If we can't parse the body, let the validation layer handle it
      await next();
      return;
    }

    if (!email) {
      await next();
      return;
    }

    // Get client IP
    const ip =
      c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ||
      c.req.header("x-real-ip") ||
      "unknown";

    // Check per-email rate limit
    const emailKey = `forgot-password:email:${email.toLowerCase()}`;
    const emailResult = rateLimiter.check(emailKey, emailMaxRequests, emailWindowMs);

    if (!emailResult.allowed) {
      const retryAfter = Math.ceil((emailResult.resetAt - Date.now()) / 1000);
      c.res.headers.set("Retry-After", String(retryAfter));
      c.res.headers.set("X-RateLimit-Limit", String(emailMaxRequests));
      c.res.headers.set("X-RateLimit-Reset", String(Math.ceil(emailResult.resetAt / 1000)));
      throw new HTTPException(429, {
        message: `Too many password reset requests for this email. Please try again in ${Math.ceil(retryAfter / 60)} minutes.`,
      });
    }

    // Check per-IP rate limit
    const ipKey = `forgot-password:ip:${ip}`;
    const ipResult = rateLimiter.check(ipKey, ipMaxRequests, ipWindowMs);

    if (!ipResult.allowed) {
      const retryAfter = Math.ceil((ipResult.resetAt - Date.now()) / 1000);
      c.res.headers.set("Retry-After", String(retryAfter));
      c.res.headers.set("X-RateLimit-Limit", String(ipMaxRequests));
      c.res.headers.set("X-RateLimit-Reset", String(Math.ceil(ipResult.resetAt / 1000)));
      throw new HTTPException(429, {
        message: "Too many password reset requests. Please try again later.",
      });
    }

    await next();
  };
}
