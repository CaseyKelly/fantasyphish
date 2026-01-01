/**
 * Retry utility for database operations to handle intermittent connection issues
 * Common with serverless functions and Neon connection pooler
 */

export async function withRetry<T>(
  operation: () => Promise<T>,
  options: {
    maxRetries?: number
    delayMs?: number
    operationName?: string
  } = {}
): Promise<T> {
  const {
    maxRetries = 3,
    delayMs = 1000,
    operationName = "operation",
  } = options
  let lastError: Error | undefined

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation()
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))

      // Check if it's a connection error that should be retried
      const isConnectionError =
        lastError.message.includes("Can't reach database server") ||
        lastError.message.includes("Connection") ||
        lastError.message.includes("P1001") ||
        lastError.message.includes("ECONNREFUSED") ||
        lastError.message.includes("ETIMEDOUT") ||
        lastError.message.includes("Error in PostgreSQL connection")

      if (!isConnectionError || attempt === maxRetries) {
        throw lastError
      }

      console.log(
        `[DB Retry] ${operationName} failed on attempt ${attempt}/${maxRetries}: ${lastError.message}`
      )
      console.log(`[DB Retry] Retrying in ${delayMs}ms...`)

      await new Promise((resolve) => setTimeout(resolve, delayMs))
    }
  }

  throw lastError
}
