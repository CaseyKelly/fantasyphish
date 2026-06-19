interface DonutLogoProps {
  size?: "sm" | "md" | "lg" | "xl" | "2xl"
  className?: string
  glow?: boolean
}

const sizes = {
  sm: "w-6 h-6",
  md: "w-8 h-8",
  lg: "w-10 h-10",
  xl: "w-16 h-16",
  "2xl": "w-32 h-32",
}

export function DonutLogo({
  size = "md",
  className = "",
  glow = false,
}: DonutLogoProps) {
  return (
    <svg
      viewBox="0 0 120 120"
      className={`${sizes[size]} ${glow ? "drop-shadow-[0_0_20px_rgba(194,58,58,0.5)]" : ""} ${className}`}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
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
      <span className="font-bold font-display text-white">FantasyPhish</span>
    </div>
  )
}
