import { auth } from "@/lib/auth"
import { Sparkles, Calendar, MapPin } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { DonutLogo } from "@/components/DonutLogo"

export default async function PicksPage() {
  const session = await auth()
  if (!session?.user?.id) return null

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-white">Make Your Picks</h1>
        <p className="text-slate-400 mt-1">
          Select your songs for the next show
        </p>
      </div>

      {/* Empty State - Picks Not Open Yet */}
      <div className="min-h-[60vh] flex items-center justify-center px-4">
        <Card className="max-w-2xl w-full bg-gradient-to-br from-[#1e3340] to-[#2d4654] border-[#3d5a6c]/50">
          <CardContent className="py-16 px-8 text-center">
            {/* Animated Donut Logo */}
            <div className="mb-8 flex justify-center">
              <div className="relative">
                <DonutLogo size="xl" />
                <div className="absolute -top-2 -right-2">
                  <Sparkles className="h-6 w-6 text-[#c23a3a] animate-pulse" />
                </div>
              </div>
            </div>

            {/* Main Message */}
            <h2 className="text-3xl sm:text-4xl font-bold text-white mb-6">
              Picks Opening Soon!
            </h2>

            <p className="text-base text-gray-400 max-w-xl mx-auto mb-8 leading-relaxed">
              Check back before the first show to make your picks! Choose your
              opener, encore, and 11 regular songs to compete for glory.
            </p>

            {/* Event Details */}
            <div className="space-y-3 mb-12">
              <div className="flex items-center justify-center space-x-2 text-gray-300">
                <MapPin className="h-5 w-5 text-[#c23a3a]" />
                <span className="font-medium">Madison Square Garden</span>
              </div>
              <div className="flex items-center justify-center space-x-2 text-gray-300">
                <Calendar className="h-5 w-5 text-[#c23a3a]" />
                <span>New Year&apos;s Eve Run 2025-2026</span>
              </div>
            </div>

            {/* Status Box */}
            <div className="inline-flex items-center space-x-3 px-6 py-4 bg-[#3d5a6c]/30 rounded-xl border border-[#3d5a6c]/50">
              <Sparkles className="h-5 w-5 text-[#c23a3a] animate-pulse" />
              <span className="text-gray-300 font-medium">
                Picks open before first show
              </span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
