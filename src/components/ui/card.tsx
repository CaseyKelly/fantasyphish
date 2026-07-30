import { ReactNode, HTMLAttributes } from "react"

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode
  className?: string
  blur?: boolean
}

export function Card({
  children,
  className = "",
  blur = true,
  ...props
}: CardProps) {
  return (
    <div
      className={`bg-[#233d4d]/90 ${blur ? "backdrop-blur-sm" : ""} border-2 border-[#4a6b7d]/60 rounded-xl ${className}`}
      {...props}
    >
      {children}
    </div>
  )
}

export function CardHeader({ children, className = "", ...props }: CardProps) {
  return (
    <div
      className={`px-4 py-3 border-b-2 border-[#4a6b7d]/60 sm:px-6 ${className}`}
      {...props}
    >
      {children}
    </div>
  )
}

export function CardContent({ children, className = "", ...props }: CardProps) {
  return (
    <div className={`px-4 py-4 sm:px-6 ${className}`} {...props}>
      {children}
    </div>
  )
}

export function CardFooter({ children, className = "", ...props }: CardProps) {
  return (
    <div
      className={`px-4 py-3 border-t border-[#3d5a6c]/50 sm:px-6 ${className}`}
      {...props}
    >
      {children}
    </div>
  )
}
