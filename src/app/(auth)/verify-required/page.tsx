import { Suspense } from "react"
import VerifyRequiredClient from "./VerifyRequiredClient"

export const metadata = {
  title: "Email Verification Required - FantasyPhish",
  description: "Verify your email to continue",
}

export default function VerifyRequiredPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <VerifyRequiredClient />
    </Suspense>
  )
}
