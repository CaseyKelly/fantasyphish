import { forwardRef, ButtonHTMLAttributes } from "react"
import { LoadingDonut } from "@/components/LoadingDonut"
import { cn } from "@/lib/cn"

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "outline" | "ghost" | "danger" | "success"
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
      "inline-flex items-center justify-center font-semibold rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-[#2d4654] disabled:cursor-not-allowed"

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
      success:
        "bg-green-600 hover:bg-green-700 text-white focus:ring-green-600",
    }

    // A washed-out colored button (the old opacity-50) still reads as
    // clickable, especially the green success variant; use one neutral
    // style for every variant so "not yet" is unambiguous
    const disabledStyles =
      "disabled:bg-[#3d5a6c]/60 disabled:border-transparent disabled:text-slate-400 disabled:shadow-none"

    const sizes = {
      sm: "px-3 py-1.5 text-sm",
      md: "px-4 py-2 text-base",
      lg: "px-6 py-3 text-lg",
    }

    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        className={cn(
          baseStyles,
          variants[variant],
          sizes[size],
          // While loading, keep the variant color so it reads as "working"
          isLoading ? "disabled:opacity-75" : disabledStyles,
          className
        )}
        {...props}
      >
        {isLoading ? (
          <>
            <LoadingDonut
              size="xs"
              color="currentColor"
              className="-ml-1 mr-2"
            />
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
