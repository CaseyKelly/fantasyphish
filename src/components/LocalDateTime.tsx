"use client"

import { useSyncExternalStore } from "react"

interface LocalDateTimeProps {
  iso: string
  className?: string
}

function subscribe() {
  return () => {}
}

function formatLocal(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })
}

/**
 * Renders a timestamp in the viewer's own browser timezone. The server has
 * no way to know that timezone ahead of time, so the server snapshot is a
 * blank placeholder and the real value appears once the client hydrates.
 */
export function LocalDateTime({ iso, className }: LocalDateTimeProps) {
  const formatted = useSyncExternalStore(
    subscribe,
    () => formatLocal(iso),
    () => ""
  )

  return <span className={className}>{formatted}</span>
}
