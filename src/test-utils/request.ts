import { NextRequest } from "next/server"

/**
 * Builds a NextRequest for calling route handlers directly in unit tests.
 * Objects passed as `body` are JSON-encoded; strings are sent as-is.
 */
export function makeRequest(
  path: string,
  init: {
    method?: string
    body?: unknown
    headers?: Record<string, string>
  } = {}
): NextRequest {
  const { method = "GET", body, headers = {} } = init
  return new NextRequest(new URL(path, "http://localhost:3000"), {
    method,
    headers:
      body !== undefined && typeof body !== "string"
        ? { "content-type": "application/json", ...headers }
        : headers,
    body:
      body === undefined
        ? undefined
        : typeof body === "string"
          ? body
          : JSON.stringify(body),
  })
}

/** The `{ params }` context object Next passes to dynamic route handlers. */
export function routeParams<T extends Record<string, string>>(
  params: T
): { params: Promise<T> } {
  return { params: Promise.resolve(params) }
}

/** A minimal NextAuth session for `vi.mocked(auth).mockResolvedValue(...)`. */
export function sessionFor(
  user: Partial<{
    id: string
    email: string
    username: string
    isAdmin: boolean
    isPrivateViewer: boolean
  }> = {},
  extra: Record<string, unknown> = {}
): never {
  return {
    user: {
      id: "user-1",
      email: "user@example.com",
      username: "user1",
      isAdmin: false,
      isPrivateViewer: false,
      ...user,
    },
    expires: "2099-01-01T00:00:00.000Z",
    ...extra,
  } as never
}
