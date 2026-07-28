"use client"

import type { CSSProperties } from "react"

interface LoadingDonutProps {
  size?: "xs" | "sm" | "md" | "lg" | "xl"
  color?: string
  className?: string
}

const sizes: Record<NonNullable<LoadingDonutProps["size"]>, number> = {
  xs: 16,
  sm: 32,
  md: 48,
  lg: 64,
  xl: 96,
}

export function LoadingDonut({
  size = "lg",
  color = "#c23a3a",
  className = "",
}: LoadingDonutProps) {
  const dimension = sizes[size]

  return (
    <span
      className={`fp-spinner ${className}`}
      style={
        {
          width: dimension,
          height: dimension,
          color,
          "--fp-size": `${dimension}px`,
        } as CSSProperties
      }
    >
      <span className="fp-orbit fp-orbit-a">
        <span className="fp-track">
          <svg viewBox="0 0 120 120" fill="none">
            <circle
              cx="60"
              cy="60"
              r="40"
              stroke="currentColor"
              strokeWidth="24"
            />
          </svg>
        </span>
      </span>
      <span className="fp-orbit fp-orbit-b">
        <span className="fp-track">
          <svg viewBox="0 0 120 120" fill="none">
            <circle
              cx="60"
              cy="60"
              r="40"
              stroke="currentColor"
              strokeWidth="24"
            />
          </svg>
        </span>
      </span>

      <style jsx>{`
        .fp-spinner {
          position: relative;
          display: inline-block;
        }

        .fp-orbit {
          position: absolute;
          inset: 0;
          animation: fp-weave-a 1.6s linear infinite;
        }

        .fp-orbit-b {
          animation-name: fp-weave-b;
        }

        /* z-index swap right where the two tracks cross in the middle
           (25% / 75%) so the rings pass over/under each other */
        @keyframes fp-weave-a {
          0%,
          24.9% {
            z-index: 2;
          }
          25%,
          74.9% {
            z-index: 1;
          }
          75%,
          100% {
            z-index: 2;
          }
        }

        @keyframes fp-weave-b {
          0%,
          24.9% {
            z-index: 1;
          }
          25%,
          74.9% {
            z-index: 2;
          }
          75%,
          100% {
            z-index: 1;
          }
        }

        .fp-track {
          position: absolute;
          top: 50%;
          left: 50%;
          width: calc(var(--fp-size) * 0.6);
          height: calc(var(--fp-size) * 0.6);
          margin: calc(var(--fp-size) * -0.3) 0 0 calc(var(--fp-size) * -0.3);
          animation: fp-slide-a 1.6s linear infinite;
        }

        .fp-orbit-b .fp-track {
          animation-name: fp-slide-b;
        }

        .fp-track svg {
          display: block;
          width: 100%;
          height: 100%;
        }

        /* pure left-right travel, no vertical component */
        @keyframes fp-slide-a {
          0% {
            transform: translateX(calc(var(--fp-size) * -0.22));
          }
          50% {
            transform: translateX(calc(var(--fp-size) * 0.22));
          }
          100% {
            transform: translateX(calc(var(--fp-size) * -0.22));
          }
        }

        @keyframes fp-slide-b {
          0% {
            transform: translateX(calc(var(--fp-size) * 0.22));
          }
          50% {
            transform: translateX(calc(var(--fp-size) * -0.22));
          }
          100% {
            transform: translateX(calc(var(--fp-size) * 0.22));
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .fp-orbit,
          .fp-track {
            animation: none !important;
          }
          .fp-orbit-a .fp-track {
            transform: translateX(calc(var(--fp-size) * -0.22));
          }
          .fp-orbit-b .fp-track {
            transform: translateX(calc(var(--fp-size) * 0.22));
          }
        }
      `}</style>
    </span>
  )
}
