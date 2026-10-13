"use client"

import { useEffect, useState } from "react"
import { toast } from "sonner"
import { CheckCircle, Vote } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { LoadingDonut } from "@/components/LoadingDonut"
import type { PollDefinition, PollResults } from "@/lib/polls"

interface FormatPollProps {
  poll: PollDefinition
}

interface PollResponse {
  userVote: string | null
  results: PollResults | null
  error?: string
}

export function FormatPoll({ poll }: FormatPollProps) {
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [selected, setSelected] = useState<string | null>(null)
  const [userVote, setUserVote] = useState<string | null>(null)
  const [results, setResults] = useState<PollResults | null>(null)

  useEffect(() => {
    fetch(`/api/polls/${poll.slug}`, { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data: PollResponse | null) => {
        if (data?.userVote && data.results) {
          setUserVote(data.userVote)
          setResults(data.results)
        }
      })
      .catch((error) => console.error("Error fetching poll:", error))
      .finally(() => setLoading(false))
  }, [poll.slug])

  const submitVote = async () => {
    if (!selected) return
    setSubmitting(true)
    try {
      const res = await fetch(`/api/polls/${poll.slug}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ option: selected }),
      })
      const data: PollResponse = await res.json()

      // 409 means this user already voted (e.g. in another tab) - the
      // response still carries their vote and the results to show.
      if ((res.ok || res.status === 409) && data.userVote && data.results) {
        setUserVote(data.userVote)
        setResults(data.results)
        if (res.ok) toast.success("Thanks for voting!")
      } else {
        toast.error(data.error || "Failed to submit vote")
      }
    } catch (error) {
      console.error("Error submitting vote:", error)
      toast.error("Failed to submit vote")
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <LoadingDonut size="xl" />
      </div>
    )
  }

  return (
    <Card className="max-w-2xl mx-auto w-full bg-gradient-to-br from-[#1e3340] to-[#2d4654] border-[#3d5a6c]/50">
      <CardContent className="py-10 px-6 sm:px-10">
        <div className="flex justify-center mb-6">
          <div className="bg-gradient-to-br from-[#c23a3a] to-[#d64545] p-4 rounded-full">
            <Vote aria-hidden="true" className="h-8 w-8 text-white" />
          </div>
        </div>

        <h2 className="text-2xl sm:text-3xl font-bold font-display text-white text-center mb-4">
          {poll.question}
        </h2>
        <p className="text-gray-400 text-center leading-relaxed mb-8">
          {poll.description}
        </p>

        {userVote && results ? (
          <div className="space-y-4">
            {results.options.map((option) => {
              const isUserVote = option.id === userVote
              return (
                <div key={option.id}>
                  <div className="flex items-center justify-between text-sm mb-1.5">
                    <span className="flex items-center gap-2 text-white font-medium">
                      {option.label}
                      {isUserVote && (
                        <span className="inline-flex items-center gap-1 text-xs text-green-400">
                          <CheckCircle
                            aria-hidden="true"
                            className="h-3.5 w-3.5"
                          />
                          Your vote
                        </span>
                      )}
                    </span>
                    <span className="text-gray-300">
                      {option.percent}% ({option.votes})
                    </span>
                  </div>
                  <div
                    className="h-3 rounded-full bg-[#3d5a6c]/40 overflow-hidden"
                    role="progressbar"
                    aria-label={`${option.label}: ${option.percent}%`}
                    aria-valuenow={option.percent}
                    aria-valuemin={0}
                    aria-valuemax={100}
                  >
                    <div
                      className={`h-full rounded-full ${isUserVote ? "bg-[#c23a3a]" : "bg-[#4a6b7d]"}`}
                      style={{ width: `${option.percent}%` }}
                    />
                  </div>
                </div>
              )
            })}
            <p className="text-center text-sm text-gray-500 pt-2">
              {results.totalVotes} {results.totalVotes === 1 ? "vote" : "votes"}{" "}
              so far. Thanks for weighing in! Check back before the next show to
              make your picks.
            </p>
          </div>
        ) : (
          <fieldset className="space-y-3">
            <legend className="sr-only">{poll.question}</legend>
            {poll.options.map((option) => (
              <label
                key={option.id}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg border cursor-pointer transition-colors ${
                  selected === option.id
                    ? "bg-[#c23a3a]/15 border-[#c23a3a]"
                    : "bg-[#3d5a6c]/30 border-[#3d5a6c]/50 hover:bg-[#3d5a6c]/50"
                }`}
              >
                <input
                  type="radio"
                  name={`poll-${poll.slug}`}
                  value={option.id}
                  checked={selected === option.id}
                  onChange={() => setSelected(option.id)}
                  className="accent-[#c23a3a] h-4 w-4"
                />
                <span className="text-white">{option.label}</span>
              </label>
            ))}
            <Button
              onClick={submitVote}
              disabled={!selected}
              isLoading={submitting}
              className="w-full mt-4"
            >
              Submit Vote
            </Button>
          </fieldset>
        )}
      </CardContent>
    </Card>
  )
}
