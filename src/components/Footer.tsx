export function Footer() {
  return (
    <footer className="border-t border-[#3d5a6c]/50 py-8 bg-[#1e3340] relative z-10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-sm text-gray-400">
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
          <p className="text-sm text-gray-500 flex items-end gap-2">
            <span className="pb-1">
              made by{" "}
              <a
                href="mailto:chalupa@fantasyphish.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#c23a3a] hover:text-[#d64545] transition-colors"
              >
                chalupa
              </a>
            </span>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="w-10 h-10"
            >
              <path
                d="M4 20C4 20 4 12 12 12C20 12 20 20 20 20H4Z"
                fill="currentColor"
                opacity="0.2"
              />
              <path d="M4 20C4 20 4 12 12 12C20 12 20 20 20 20" />
              <circle cx="8" cy="16" r="0.8" fill="currentColor" />
              <circle cx="12" cy="15" r="0.8" fill="currentColor" />
              <circle cx="16" cy="16" r="0.8" fill="currentColor" />
              <path d="M6 18L18 18" strokeWidth="1" />
            </svg>
          </p>
        </div>
      </div>
    </footer>
  )
}
