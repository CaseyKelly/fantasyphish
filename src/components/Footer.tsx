import { FeedbackPanel } from "@/components/FeedbackPanel"

export function Footer() {
  return (
    <footer className="border-t border-[#3d5a6c]/50 py-8 bg-[#1e3340] relative z-10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-3">
        <FeedbackPanel />
        <p className="text-center text-sm text-gray-400 sm:text-left">
          Setlist data provided by{" "}
          <a
            href="https://phish.net"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[#c23a3a] hover:text-[#d64545]"
          >
            phish.net
          </a>
        </p>
      </div>
    </footer>
  )
}
