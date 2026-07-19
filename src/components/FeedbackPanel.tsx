import { Lightbulb } from "lucide-react"

interface FeedbackPanelProps {
  className?: string
}

const FEEDBACK_MAILTO =
  "mailto:chalupa@fantasyphish.com?subject=Idea%20to%20make%20FantasyPhish%20better"

export function FeedbackPanel({ className = "" }: FeedbackPanelProps) {
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
