interface FeedbackPanelProps {
  className?: string
}

const FEEDBACK_MAILTO =
  "mailto:chalupa@fantasyphish.com?subject=Idea%20to%20make%20FantasyPhish%20better"

export function FeedbackPanel({ className = "" }: FeedbackPanelProps) {
  return (
    <p
      className={`text-center text-xs text-gray-400 sm:text-left ${className}`}
    >
      Got an idea to make the site better?{" "}
      <a
        href={FEEDBACK_MAILTO}
        className="font-medium text-red-400 underline transition-colors hover:text-[#d64545]"
      >
        Email Chalupa
      </a>
    </p>
  )
}
