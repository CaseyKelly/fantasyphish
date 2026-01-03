import { forwardRef, InputHTMLAttributes } from "react"

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, className = "", id, ...props }, ref) => {
    const inputId = id || label?.toLowerCase().replace(/\s+/g, "-")

    return (
      <div className="w-full">
        {label && (
          <label
            htmlFor={inputId}
            className="block text-sm font-medium text-gray-300 mb-1.5"
          >
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          className={`
            w-full px-4 py-2.5 
            bg-[#233d4d] border-2 border-[#4a6b7d] 
            rounded-lg text-white placeholder-gray-500
            focus:outline-none focus:ring-2 focus:ring-[#c23a3a] focus:border-transparent
            disabled:opacity-50 disabled:cursor-not-allowed
            transition-all duration-200
            ${error ? "border-[#c23a3a] focus:ring-[#c23a3a]" : ""}
            ${className}
          `}
          {...props}
        />
        {error && <p className="mt-1.5 text-sm text-[#d64545]">{error}</p>}
      </div>
    )
  }
)

Input.displayName = "Input"
