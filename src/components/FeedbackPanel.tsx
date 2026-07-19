import { Lightbulb, Mail } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"

interface FeedbackPanelProps {
  variant?: "card" | "strip"
  className?: string
}

const FEEDBACK_MAILTO =
  "mailto:chalupa@fantasyphish.com?subject=Idea%20to%20make%20FantasyPhish%20better"

export function FeedbackPanel({
  variant = "card",
  className = "",
}: FeedbackPanelProps) {
  if (variant === "strip") {
    return (
      <div
        className={`flex flex-col items-center gap-2 rounded-lg border border-[#4a6b7d]/50 bg-[#233d4d]/60 px-4 py-2.5 text-sm sm:flex-row ${className}`}
      >
        <Lightbulb className="h-4 w-4 flex-shrink-0 text-[#d64545]" />
        <span className="text-center text-gray-400 sm:text-left">
          <span className="font-medium text-gray-200">Got an idea?</span> Tell
          Chalupa what would make this site better.
        </span>
        <a
          href={FEEDBACK_MAILTO}
          className="font-semibold text-[#c23a3a] transition-colors hover:text-[#d64545] sm:ml-auto"
        >
          Send an email →
        </a>
      </div>
    )
  }

  return (
    <Card className={`relative overflow-hidden ${className}`}>
      <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full border border-[#d64545]/40 bg-[#c23a3a]/15 text-[#d64545]">
          <Lightbulb className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="font-display text-base text-white">
            Got an idea to make the site better?
          </h3>
          <p className="text-sm text-gray-400">
            Broken scoring, a missing stat, a page that&apos;s confusing —
            Chalupa reads every email.
          </p>
        </div>
        <a
          href={FEEDBACK_MAILTO}
          className="inline-flex flex-shrink-0 items-center justify-center gap-2 rounded-lg bg-[#c23a3a] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#d64545] focus:outline-none focus:ring-2 focus:ring-[#c23a3a] focus:ring-offset-2 focus:ring-offset-[#233d4d] sm:w-auto"
        >
          <Mail className="h-4 w-4" />
          Email Chalupa
        </a>
      </CardContent>
    </Card>
  )
}
