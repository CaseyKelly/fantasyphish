import { ReactNode, HTMLAttributes } from "react"
import { cn } from "@/lib/cn"

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
      className={cn(
        "bg-[#233d4d]/90 border-2 border-[#4a6b7d]/60 rounded-xl",
        blur && "backdrop-blur-sm",
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
}

export function CardHeader({ children, className = "", ...props }: CardProps) {
  return (
    <div
      className={cn(
        "px-4 py-3 border-b-2 border-[#4a6b7d]/60 sm:px-6",
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
}

export function CardContent({ children, className = "", ...props }: CardProps) {
  return (
    <div className={cn("px-4 py-4 sm:px-6", className)} {...props}>
      {children}
    </div>
  )
}

export function CardFooter({ children, className = "", ...props }: CardProps) {
  return (
    <div
      className={cn(
        "px-4 py-3 border-t border-[#3d5a6c]/50 sm:px-6",
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
}
