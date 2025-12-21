import { NextRequest, NextResponse } from "next/server"

interface RateLimitConfig {
  windowMs: number // Time window in milliseconds
  max: number // Max requests per window
  message?: string // Custom error message
  skipSuccessfulRequests?: boolean // Don't count successful requests
  keyGenerator?: (req: NextRequest) => string // Custom key generator
}

// In-memory store for development (replace with Redis/KV in production)
const rateLimitStore = new Map<string, { count: number; resetTime: number }>()

// Clean up expired entries periodically
declare global {
  var rateLimitCleanup: NodeJS.Timeout | undefined
}

if (typeof globalThis !== "undefined" && !globalThis.rateLimitCleanup) {
  globalThis.rateLimitCleanup = setInterval(() => {
    const now = Date.now()
    for (const [key, value] of rateLimitStore.entries()) {
      if (value.resetTime < now) {
        rateLimitStore.delete(key)
      }
    }
  }, 60000) // Clean up every minute
}

export function rateLimit(config: RateLimitConfig) {
  const {
    windowMs = 60000, // 1 minute default
    max = 10, // 10 requests default
    message = "Too many requests, please try again later.",
    skipSuccessfulRequests = false,
    keyGenerator = (req) => {
      // Default: use IP address or fallback to a general key
      const forwarded = req.headers.get("x-forwarded-for")
      const ip = forwarded ? forwarded.split(",")[0] : "unknown"
      return ip
    },
  } = config

  return async function rateLimitMiddleware(
    req: NextRequest,
    handler: (req: NextRequest) => Promise<NextResponse>
  ): Promise<NextResponse> {
    const key = keyGenerator(req)
    const now = Date.now()
    const resetTime = now + windowMs

    // Get or create rate limit entry
    let entry = rateLimitStore.get(key)

    if (!entry || entry.resetTime < now) {
      // Create new entry or reset expired one
      entry = { count: 1, resetTime }
      rateLimitStore.set(key, entry)
    } else {
      // Increment counter
      entry.count++
    }

    // Check if limit exceeded
    if (entry.count > max) {
      return NextResponse.json(
        { error: message },
        {
          status: 429,
          headers: {
            "X-RateLimit-Limit": max.toString(),
            "X-RateLimit-Remaining": "0",
            "X-RateLimit-Reset": new Date(entry.resetTime).toISOString(),
            "Retry-After": Math.ceil((entry.resetTime - now) / 1000).toString(),
          },
        }
      )
    }

    // Process request
    const response = await handler(req)

    // Add rate limit headers
    response.headers.set("X-RateLimit-Limit", max.toString())
    response.headers.set(
      "X-RateLimit-Remaining",
      Math.max(0, max - entry.count).toString()
    )
    response.headers.set(
      "X-RateLimit-Reset",
      new Date(entry.resetTime).toISOString()
    )

    // If skipSuccessfulRequests is true and request was successful, decrement counter
    if (skipSuccessfulRequests && response.status < 400 && entry.count > 0) {
      entry.count--
    }

    return response
  }
}

// Preset configurations for different endpoint types
export const rateLimits = {
  // Strict rate limit for auth endpoints
  auth: rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // 5 requests per 15 minutes
    message: "Too many authentication attempts. Please try again later.",
  }),

  // Moderate rate limit for general API endpoints
  api: rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 30, // 30 requests per minute
    message: "Too many API requests. Please slow down.",
  }),

  // Strict rate limit for admin endpoints
  admin: rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 10, // 10 requests per minute
    message: "Admin endpoint rate limit exceeded.",
  }),

  // Very strict for email sending
  email: rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 3, // 3 emails per hour
    message: "Email sending limit exceeded. Please try again later.",
  }),

  // Custom rate limiter with IP + user ID
  userSpecific: (userId?: string) =>
    rateLimit({
      windowMs: 60 * 1000,
      max: 20,
      keyGenerator: (req) => {
        const forwarded = req.headers.get("x-forwarded-for")
        const ip = forwarded ? forwarded.split(",")[0] : "unknown"
        return userId ? `${ip}:${userId}` : ip
      },
    }),
}

// Helper to apply rate limiting to an API route
export function withRateLimit(
  handler: (req: NextRequest) => Promise<NextResponse>,
  limiter = rateLimits.api
) {
  return (req: NextRequest) => limiter(req, handler)
}
