// Each browser's wording for a fetch that failed at the network layer (dropped
// connection, device asleep, tab backgrounded mid-request) rather than an
// HTTP error or a bug in our code. Safari: "Load failed", Chrome: "Failed to
// fetch", Firefox: "NetworkError when attempting to fetch resource."
const NETWORK_ERROR_MESSAGES = [
  /^Load failed$/,
  /^Failed to fetch$/,
  /^NetworkError when attempting to fetch resource\.?$/,
]

export function isTransientNetworkError(error: unknown): boolean {
  return (
    error instanceof TypeError &&
    NETWORK_ERROR_MESSAGES.some((pattern) => pattern.test(error.message))
  )
}
