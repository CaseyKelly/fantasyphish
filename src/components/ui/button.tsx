import { forwardRef, ButtonHTMLAttributes } from "react"

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "outline" | "ghost" | "danger"
  size?: "sm" | "md" | "lg"
  isLoading?: boolean
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      children,
      variant = "primary",
      size = "md",
      isLoading = false,
      disabled,
      className = "",
      ...props
    },
    ref
  ) => {
    const baseStyles =
      "inline-flex items-center justify-center font-semibold rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-[#2d4654] disabled:opacity-50 disabled:cursor-not-allowed"

    const variants = {
      primary:
        "bg-[#c23a3a] hover:bg-[#d64545] text-white focus:ring-[#c23a3a]",
      secondary:
        "bg-[#3d5a6c] hover:bg-[#4a6b7d] text-white focus:ring-[#3d5a6c]",
      outline:
        "border-2 border-[#4a6b7d] hover:border-[#5a7b8d] text-gray-200 hover:bg-[#3d5a6c]/50 focus:ring-[#4a6b7d]",
      ghost:
        "text-gray-300 hover:text-white hover:bg-[#3d5a6c]/50 focus:ring-[#3d5a6c]",
      danger: "bg-[#a32e2e] hover:bg-[#c23a3a] text-white focus:ring-[#a32e2e]",
    }

    const sizes = {
      sm: "px-3 py-1.5 text-sm",
      md: "px-4 py-2 text-base",
      lg: "px-6 py-3 text-lg",
    }

    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${className}`}
        {...props}
      >
        {isLoading ? (
          <>
            <svg
              className="animate-spin -ml-1 mr-2 h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
            Loading...
          </>
        ) : (
          children
        )}
      </button>
    )
  }
)

Button.displayName = "Button"
