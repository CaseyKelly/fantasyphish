interface DonutLogoProps {
  size?: "sm" | "md" | "lg" | "xl"
  className?: string
}

const sizes = {
  sm: "w-6 h-6",
  md: "w-8 h-8",
  lg: "w-10 h-10",
  xl: "w-16 h-16",
}

export function DonutLogo({ size = "md", className = "" }: DonutLogoProps) {
  return (
    <svg
      viewBox="0 0 120 120"
      className={`${sizes[size]} ${className}`}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Outer circle (donut) - thicker stroke */}
      <circle
        cx="60"
        cy="60"
        r="40"
        stroke="#c23a3a"
        strokeWidth="24"
        fill="none"
      />
    </svg>
  )
}

export function DonutLogoWithText({
  size = "md",
  className = "",
}: DonutLogoProps) {
  return (
    <div className={`flex items-center space-x-2 ${className}`}>
      <DonutLogo size={size} />
      <span className="font-bold text-white">FantasyPhish</span>
    </div>
  )
}
