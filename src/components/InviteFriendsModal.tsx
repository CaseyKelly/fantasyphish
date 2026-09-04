"use client"

import { useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import { Mail, MessageCircle, Copy, Share2, X, Check } from "lucide-react"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { useFocusTrap } from "@/hooks/useFocusTrap"

interface InviteFriendsModalProps {
  onClose: () => void
}

function getInviteUrl(): string {
  const base =
    process.env.NEXT_PUBLIC_APP_URL ||
    (typeof window !== "undefined" ? window.location.origin : "")
  return `${base}/register`
}

const INVITE_MESSAGE =
  "Join me on FantasyPhish! Pick 13 songs before each Phish show and compete for the win:"

export function InviteFriendsModal({ onClose }: InviteFriendsModalProps) {
  const modalRef = useRef<HTMLDivElement>(null)
  const copiedTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [copied, setCopied] = useState(false)

  useFocusTrap(modalRef, true, onClose)

  useEffect(() => {
    return () => {
      if (copiedTimeoutRef.current) clearTimeout(copiedTimeoutRef.current)
    }
  }, [])

  const inviteUrl = getInviteUrl()
  const fullMessage = `${INVITE_MESSAGE} ${inviteUrl}`

  const canShare =
    typeof navigator !== "undefined" && typeof navigator.share === "function"

  const handleTextInvite = () => {
    window.location.href = `sms:?body=${encodeURIComponent(fullMessage)}`
  }

  const handleEmailInvite = () => {
    const subject = "Join me on FantasyPhish!"
    window.location.href = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(fullMessage)}`
  }

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(fullMessage)
      setCopied(true)
      toast.success("Invite link copied!")
      if (copiedTimeoutRef.current) clearTimeout(copiedTimeoutRef.current)
      copiedTimeoutRef.current = setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error("Couldn't copy the link")
    }
  }

  const handleNativeShare = async () => {
    try {
      await navigator.share({
        title: "Join me on FantasyPhish!",
        text: INVITE_MESSAGE,
        url: inviteUrl,
      })
    } catch {
      // User cancelled the share sheet or it failed silently - no action needed
    }
  }

  return (
    <div
      ref={modalRef}
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
    >
      <Card
        role="dialog"
        aria-modal="true"
        aria-labelledby="invite-friends-modal-title"
        className="w-full max-w-md bg-[#1e3340] border-[#3d5a6c]"
      >
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <h2
                id="invite-friends-modal-title"
                className="text-lg font-bold text-white"
              >
                Invite Friends
              </h2>
              <p className="text-sm text-gray-400">
                Get your friends picking songs with you
              </p>
            </div>
            <button
              onClick={onClose}
              aria-label="Close"
              className="text-gray-400 hover:text-white transition-colors"
            >
              <X aria-hidden="true" className="h-6 w-6" />
            </button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <button
              onClick={handleTextInvite}
              className="flex w-full items-center gap-3 rounded-lg border-2 border-[#4a6b7d]/60 px-4 py-3 text-left text-gray-200 transition-colors hover:border-[#5a7b8d] hover:bg-[#3d5a6c]/50"
            >
              <MessageCircle
                aria-hidden="true"
                className="h-5 w-5 flex-shrink-0 text-[#d64545]"
              />
              <span className="font-medium">Text a Friend</span>
            </button>
            <button
              onClick={handleEmailInvite}
              className="flex w-full items-center gap-3 rounded-lg border-2 border-[#4a6b7d]/60 px-4 py-3 text-left text-gray-200 transition-colors hover:border-[#5a7b8d] hover:bg-[#3d5a6c]/50"
            >
              <Mail
                aria-hidden="true"
                className="h-5 w-5 flex-shrink-0 text-[#d64545]"
              />
              <span className="font-medium">Email a Friend</span>
            </button>
            <button
              onClick={handleCopyLink}
              className="flex w-full items-center gap-3 rounded-lg border-2 border-[#4a6b7d]/60 px-4 py-3 text-left text-gray-200 transition-colors hover:border-[#5a7b8d] hover:bg-[#3d5a6c]/50"
            >
              {copied ? (
                <Check
                  aria-hidden="true"
                  className="h-5 w-5 flex-shrink-0 text-green-500"
                />
              ) : (
                <Copy
                  aria-hidden="true"
                  className="h-5 w-5 flex-shrink-0 text-[#d64545]"
                />
              )}
              <span className="font-medium">
                {copied ? "Copied!" : "Copy Invite Link"}
              </span>
            </button>
            {canShare && (
              <button
                onClick={handleNativeShare}
                className="flex w-full items-center gap-3 rounded-lg border-2 border-[#4a6b7d]/60 px-4 py-3 text-left text-gray-200 transition-colors hover:border-[#5a7b8d] hover:bg-[#3d5a6c]/50"
              >
                <Share2
                  aria-hidden="true"
                  className="h-5 w-5 flex-shrink-0 text-[#d64545]"
                />
                <span className="font-medium">More Sharing Options</span>
              </button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
