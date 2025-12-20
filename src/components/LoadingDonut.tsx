interface LoadingDonutProps {
  size?: "sm" | "md" | "lg" | "xl"
  text?: string
}

export function LoadingDonut({ size = "lg", text }: LoadingDonutProps) {
  const dimensions = {
    sm: { outer: 32, inner: 16, stroke: 4 },
    md: { outer: 48, inner: 24, stroke: 6 },
    lg: { outer: 64, inner: 32, stroke: 8 },
    xl: { outer: 96, inner: 48, stroke: 12 },
  }

  const { outer, inner, stroke } = dimensions[size]
  const radius = (outer - stroke) / 2

  return (
    <div className="flex flex-col items-center justify-center gap-4">
      <div className="relative" style={{ width: outer, height: outer }}>
        {/* Spinning donut */}
        <svg
          className="animate-spin"
          width={outer}
          height={outer}
          viewBox={`0 0 ${outer} ${outer}`}
          style={{
            animation: "spin 1.5s linear infinite",
          }}
        >
          {/* Main donut ring */}
          <circle
            cx={outer / 2}
            cy={outer / 2}
            r={radius}
            stroke="#c23a3a"
            strokeWidth={stroke}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={`${Math.PI * radius * 1.5} ${Math.PI * radius * 0.5}`}
            className="opacity-100"
          />
          {/* Faded trail */}
          <circle
            cx={outer / 2}
            cy={outer / 2}
            r={radius}
            stroke="#c23a3a"
            strokeWidth={stroke}
            fill="none"
            strokeLinecap="round"
            className="opacity-20"
          />
        </svg>

        {/* Pulsing inner glow */}
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#c23a3a]/20 animate-pulse"
          style={{
            width: inner,
            height: inner,
            animation: "pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite",
          }}
        />
      </div>

      {text && (
        <p className="text-gray-400 text-sm sm:text-base animate-pulse">
          {text}
        </p>
      )}

      <style jsx>{`
        @keyframes spin {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }
      `}</style>
    </div>
  )
}
