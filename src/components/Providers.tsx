"use client"

import { SessionProvider } from "next-auth/react"
import { Toaster } from "sonner"
import { ReactNode } from "react"
import { SerwistProvider } from "@serwist/turbopack/react"
import { EasterEgg } from "@/components/EasterEgg"
import { ScrollToTop } from "@/components/ScrollToTop"
import { ServiceWorkerUpdater } from "@/components/ServiceWorkerUpdater"
import { ClearAppBadge } from "@/components/ClearAppBadge"

export function Providers({ children }: { children: ReactNode }) {
  return (
    <SerwistProvider
      swUrl="/serwist/sw.js"
      disable={process.env.NODE_ENV === "development"}
    >
      <ServiceWorkerUpdater />
      <ClearAppBadge />
      <SessionProvider>
        <ScrollToTop />
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
        <EasterEgg />
      </SessionProvider>
    </SerwistProvider>
  )
}
