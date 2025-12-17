import { ReactNode, HTMLAttributes } from "react";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  className?: string;
}

export function Card({ children, className = "", ...props }: CardProps) {
  return (
    <div
      className={`bg-[#1e3340]/80 backdrop-blur-sm border border-[#3d5a6c]/50 rounded-xl ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardHeader({ children, className = "", ...props }: CardProps) {
  return (
    <div className={`px-4 py-3 border-b border-[#3d5a6c]/50 sm:px-6 ${className}`} {...props}>
      {children}
    </div>
  );
}

export function CardContent({ children, className = "", ...props }: CardProps) {
  return <div className={`px-4 py-4 sm:px-6 ${className}`} {...props}>{children}</div>;
}

export function CardFooter({ children, className = "", ...props }: CardProps) {
  return (
    <div
      className={`px-4 py-3 border-t border-[#3d5a6c]/50 sm:px-6 ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}
