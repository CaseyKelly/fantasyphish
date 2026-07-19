// Quick sanity check for the demo override (branch-only, not committed to main).
import { applyShowDemoOverride } from "../src/lib/demo-leaderboard-override"
import type { LeaderboardEntry, LeaderboardPick } from "../src/lib/leaderboard"

const show = {
  showDate: new Date("2026-07-18"),
  venue: "Merriweather Post Pavilion",
  city: "Columbia",
  state: "MD",
}

function picks(hits: number): LeaderboardPick[] {
  const p: LeaderboardPick[] = [
    {
      songName: "Tweezer",
      pickType: "OPENER",
      wasPlayed: false,
      pointsEarned: 0,
    },
  ]
  for (let i = 0; i < 11; i++)
    p.push({
      songName: `Song ${i}`,
      pickType: "REGULAR",
      wasPlayed: i < hits,
      pointsEarned: i < hits ? 1 : 0,
    })
  p.push({
    songName: "Slave",
    pickType: "ENCORE",
    wasPlayed: false,
    pointsEarned: 0,
  })
  return p
}

function entry(username: string, pts: number, rank: number): LeaderboardEntry {
  return {
    userId: username,
    username,
    totalPoints: pts,
    showsPlayed: 1,
    avgPoints: pts,
    accuracy: Math.round((pts / 13) * 100),
    rank,
    picksByShow: [{ show, totalPoints: pts, picks: picks(pts) }],
  }
}

const input = [
  entry("dmurphy185", 3, 1),
  entry("Veggie_Stick", 3, 1),
  entry("bucknlucy21", 3, 1),
  entry("PiperMaMa", 3, 1),
  entry("chalupa", 2, 5),
  entry("Phluffhead01", 2, 5),
  entry("Funky20", 1, 14),
]

const out = applyShowDemoOverride(input)
for (const e of out) {
  console.log(
    `#${e.rank} ${e.username} — ${e.totalPoints} pts (avg ${e.avgPoints}, acc ${e.accuracy}%)`
  )
}
const funky = out.find((e) => e.username === "Funky20")!
console.log(
  "Funky20 hits:",
  funky.picksByShow[0].picks
    .filter((p) => p.wasPlayed)
    .map((p) => `${p.songName} [${p.pickType} +${p.pointsEarned}]`)
    .join(", ")
)
console.log(
  "Funky20 show total:",
  funky.picksByShow[0].totalPoints,
  "| picks count:",
  funky.picksByShow[0].picks.length
)
