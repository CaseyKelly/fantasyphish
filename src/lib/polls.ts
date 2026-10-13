export interface PollOption {
  id: string
  label: string
}

export interface PollDefinition {
  slug: string
  question: string
  description: string
  options: PollOption[]
}

export interface PollOptionResult extends PollOption {
  votes: number
  percent: number
}

export interface PollResults {
  totalVotes: number
  options: PollOptionResult[]
}

export const SET2_OPENER_POLL: PollDefinition = {
  slug: "set2-opener-format",
  question: "Should we add a Set 2 Opener pick?",
  description:
    "You'd still make 13 picks, but one of them would be a Set 2 Opener worth 3 points: Opener (3), Set 2 Opener (3), Encore (3), and 10 regular picks (1 each), for a max of 19 points per show.",
  options: [
    { id: "yes", label: "Yes, add a Set 2 Opener pick" },
    { id: "no", label: "No, keep the current format" },
  ],
}

const POLLS: Record<string, PollDefinition> = {
  [SET2_OPENER_POLL.slug]: SET2_OPENER_POLL,
}

export function getPoll(slug: string): PollDefinition | null {
  return POLLS[slug] ?? null
}

export function isValidPollOption(
  poll: PollDefinition,
  option: string
): boolean {
  return poll.options.some((o) => o.id === option)
}

// Turns raw per-option vote counts into display-ready results. Options with
// no votes still appear (at 0%), and counts for option ids no longer in the
// poll definition are ignored so a renamed option can't skew the total.
export function summarizePollVotes(
  poll: PollDefinition,
  counts: Array<{ option: string; count: number }>
): PollResults {
  const countByOption = new Map(counts.map((c) => [c.option, c.count]))
  const options = poll.options.map((o) => ({
    ...o,
    votes: countByOption.get(o.id) ?? 0,
  }))
  const totalVotes = options.reduce((sum, o) => sum + o.votes, 0)

  return {
    totalVotes,
    options: options.map((o) => ({
      ...o,
      percent: totalVotes === 0 ? 0 : Math.round((o.votes / totalVotes) * 100),
    })),
  }
}
