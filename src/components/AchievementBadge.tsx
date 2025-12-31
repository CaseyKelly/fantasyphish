import * as LucideIcons from "lucide-react"

interface AchievementBadgeProps {
  icon: string
  name: string
}

export function AchievementBadge({ icon, name }: AchievementBadgeProps) {
  // Check if icon is a lucide icon name or emoji
  const isLucideIcon = icon in LucideIcons
  const LucideIcon = isLucideIcon
    ? (LucideIcons[icon as keyof typeof LucideIcons] as React.ComponentType<{
        className?: string
      }>)
    : null

  return (
    <div className="flex flex-col items-center space-y-2 p-4 bg-[#1e3340]/60 border border-[#3d5a6c]/50 rounded-lg hover:bg-[#1e3340]/80 hover:border-[#3d5a6c] transition-all duration-200">
      {/* Icon */}
      <div className="flex items-center justify-center w-16 h-16">
        {isLucideIcon && LucideIcon ? (
          <LucideIcon className="w-12 h-12 text-[#c23a3a]" />
        ) : (
          <span className="text-5xl">{icon}</span>
        )}
      </div>

      {/* Name */}
      <div className="text-center">
        <p className="text-sm font-semibold text-white">{name}</p>
      </div>
    </div>
  )
}
