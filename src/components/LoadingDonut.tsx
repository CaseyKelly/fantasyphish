interface LoadingDonutProps {
  size?: "sm" | "md" | "lg" | "xl"
}

export function LoadingDonut({ size = "lg" }: LoadingDonutProps) {
  const dimensions = {
    sm: { outer: 32, stroke: 4 },
    md: { outer: 48, stroke: 6 },
    lg: { outer: 64, stroke: 8 },
    xl: { outer: 96, stroke: 12 },
  }

  const { outer, stroke } = dimensions[size]
  const radius = (outer - stroke) / 2
  const circumference = 2 * Math.PI * radius

  return (
    <div className="flex items-center justify-center">
      <svg
        width={outer}
        height={outer}
        viewBox={`0 0 ${outer} ${outer}`}
        className="animate-spin"
        style={{
          animation: "spin 2s linear infinite",
        }}
      >
        {/* Background ring */}
        <circle
          cx={outer / 2}
          cy={outer / 2}
          r={radius}
          stroke="#c23a3a"
          strokeWidth={stroke}
          fill="none"
          className="opacity-20"
        />

        {/* Animated ring segment with opacity pulse */}
        <circle
          cx={outer / 2}
          cy={outer / 2}
          r={radius}
          stroke="#c23a3a"
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${circumference * 0.75} ${circumference * 0.25}`}
          className="opacity-100"
          style={{
            animation: "pulse-opacity 1.5s ease-in-out infinite",
          }}
        />
      </svg>

      <style jsx>{`
        @keyframes spin {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }

        @keyframes pulse-opacity {
          0%,
          100% {
            opacity: 1;
          }
          50% {
            opacity: 0.4;
          }
        }
      `}</style>
    </div>
  )
}
