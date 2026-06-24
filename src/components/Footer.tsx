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
            <img
              src="/smiley-taco.svg"
              alt="smiley taco"
              className="w-10 h-10"
            />
          </p>
        </div>
      </div>
    </footer>
  )
}
