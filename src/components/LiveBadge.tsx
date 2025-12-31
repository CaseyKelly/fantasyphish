export function LiveBadge() {
  return (
    <div className="mb-2">
      <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm bg-[#c23a3a]/20 text-[#c23a3a] border border-[#c23a3a]/30">
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#c23a3a] opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-[#c23a3a]"></span>
        </span>
        LIVE
      </span>
    </div>
  )
}
