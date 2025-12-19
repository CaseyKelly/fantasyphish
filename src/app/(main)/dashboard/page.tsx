import { auth } from "@/lib/auth";
import { Music, Sparkles, Clock } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { DonutLogo } from "@/components/DonutLogo";

export default async function PicksPage() {
  const session = await auth();
  if (!session?.user?.id) return null;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-white">Make Your Picks</h1>
        <p className="text-slate-400 mt-1">
          Select your songs for the next show
        </p>
      </div>

      {/* Coming Soon Content */}
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

            {/* Coming Soon Message */}
            <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
              Coming Soon
            </h2>
            
            <div className="flex items-center justify-center space-x-2 text-lg text-gray-300 mb-8">
              <Music className="h-5 w-5" />
              <p>Pick selection is being built</p>
            </div>

            <p className="text-base text-gray-400 max-w-xl mx-auto mb-12 leading-relaxed">
              We&apos;re building the pick selection interface. Soon you&apos;ll be able to choose 
              your opener, encore, and 11 regular songs for upcoming shows.
            </p>

            {/* Status Box */}
            <div className="inline-flex items-center space-x-3 px-6 py-4 bg-[#3d5a6c]/30 rounded-xl border border-[#3d5a6c]/50">
              <Clock className="h-5 w-5 text-[#c23a3a]" />
              <span className="text-gray-300 font-medium">
                In development
              </span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
