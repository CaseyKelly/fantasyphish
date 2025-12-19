"use client"

import { SessionProvider } from "next-auth/react"
import { Toaster } from "sonner"
import { ReactNode } from "react"

export function Providers({ children }: { children: ReactNode }) {
  return (
    <SessionProvider>
      {children}
      <Toaster
        position="top-center"
        toastOptions={{
          style: {
            background: "#1e3340",
            border: "1px solid #3d5a6c",
            color: "#f1f5f9",
          },
        }}
      />
    </SessionProvider>
  )
}
