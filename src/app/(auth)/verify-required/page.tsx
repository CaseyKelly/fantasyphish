import { Suspense } from "react"
import VerifyRequiredClient from "./VerifyRequiredClient"
import { LoadingDonut } from "@/components/LoadingDonut"

export const metadata = {
  title: "Email Verification Required - FantasyPhish",
  description: "Verify your email to continue",
}

function LoadingFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12 bg-[#2d4654]">
      <LoadingDonut size="lg" label="Loading…" />
    </div>
  )
}

export default function VerifyRequiredPage() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <VerifyRequiredClient />
    </Suspense>
  )
}
