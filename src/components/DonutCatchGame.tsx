"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import { useSession } from "next-auth/react"

const CANVAS_WIDTH = 360
const CANVAS_HEIGHT = 480
const BASKET_WIDTH = 70
const BASKET_HEIGHT = 14
const DONUT_RADIUS = 16
const STARTING_LIVES = 3
const BEST_SCORE_KEY = "fantasyphish_donut_catch_best"

type GameState = "idle" | "playing" | "gameover"

interface Donut {
  x: number
  y: number
  speed: number
  spin: number
}

interface LeaderboardEntry {
  username: string
  score: number
}

export function DonutCatchGame() {
  const { data: session, status } = useSession()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rafRef = useRef<number | null>(null)

  const basketXRef = useRef(CANVAS_WIDTH / 2 - BASKET_WIDTH / 2)
  const targetXRef = useRef(CANVAS_WIDTH / 2 - BASKET_WIDTH / 2)
  const donutsRef = useRef<Donut[]>([])
  const scoreRef = useRef(0)
  const livesRef = useRef(STARTING_LIVES)
  const spawnTimerRef = useRef(0)
  const lastTimeRef = useRef<number | null>(null)
  const gameStateRef = useRef<GameState>("idle")
  const keysRef = useRef<{ left: boolean; right: boolean }>({
    left: false,
    right: false,
  })
  const sessionStatusRef = useRef(status)

  const [gameState, setGameState] = useState<GameState>("idle")
  const [score, setScore] = useState(0)
  const [lives, setLives] = useState(STARTING_LIVES)
  const [best, setBest] = useState(() => {
    if (typeof window === "undefined") return 0
    return parseInt(window.localStorage.getItem(BEST_SCORE_KEY) || "0", 10) || 0
  })
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([])
  const [justBeatBest, setJustBeatBest] = useState(false)

  useEffect(() => {
    sessionStatusRef.current = status
  }, [status])

  const refreshLeaderboard = async () => {
    try {
      const res = await fetch("/api/easter-egg/score")
      if (!res.ok) return
      const data = await res.json()
      setLeaderboard(Array.isArray(data.leaderboard) ? data.leaderboard : [])
      if (typeof data.yourBest === "number") {
        setBest((prev) => Math.max(prev, data.yourBest))
      }
    } catch {
      // The leaderboard is a nice-to-have; ignore network errors.
    }
  }

  useEffect(() => {
    async function load() {
      await refreshLeaderboard()
    }
    load()
  }, [])

  const startGame = useCallback(() => {
    donutsRef.current = []
    scoreRef.current = 0
    livesRef.current = STARTING_LIVES
    spawnTimerRef.current = 0
    lastTimeRef.current = null
    basketXRef.current = CANVAS_WIDTH / 2 - BASKET_WIDTH / 2
    targetXRef.current = basketXRef.current
    setScore(0)
    setLives(STARTING_LIVES)
    setJustBeatBest(false)
    gameStateRef.current = "playing"
    setGameState("playing")
  }, [])

  const endGame = useCallback(() => {
    gameStateRef.current = "gameover"
    setGameState("gameover")
    const finalScore = scoreRef.current

    setBest((prevBest) => {
      if (finalScore > prevBest) {
        window.localStorage.setItem(BEST_SCORE_KEY, String(finalScore))
        return finalScore
      }
      return prevBest
    })

    if (sessionStatusRef.current === "authenticated" && finalScore > 0) {
      fetch("/api/easter-egg/score", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ score: finalScore }),
      })
        .then(async (res) => {
          if (!res.ok) return
          const data = await res.json()
          if (data.isNewBest) setJustBeatBest(true)
          await refreshLeaderboard()
        })
        .catch(() => {})
    }
  }, [])

  // Keyboard controls
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") keysRef.current.left = true
      if (e.key === "ArrowRight") keysRef.current.right = true
      if (e.key === " " && gameStateRef.current !== "playing") {
        e.preventDefault()
        startGame()
      }
    }
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") keysRef.current.left = false
      if (e.key === "ArrowRight") keysRef.current.right = false
    }
    window.addEventListener("keydown", handleKeyDown)
    window.addEventListener("keyup", handleKeyUp)
    return () => {
      window.removeEventListener("keydown", handleKeyDown)
      window.removeEventListener("keyup", handleKeyUp)
    }
  }, [startGame])

  // Pointer controls
  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const scaleX = CANVAS_WIDTH / rect.width
    const x = (e.clientX - rect.left) * scaleX
    targetXRef.current = Math.min(
      Math.max(x - BASKET_WIDTH / 2, 0),
      CANVAS_WIDTH - BASKET_WIDTH
    )
  }

  const handlePointerDown = () => {
    if (gameStateRef.current !== "playing") startGame()
  }

  // Main game loop
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    const drawDonut = (d: Donut) => {
      ctx.save()
      ctx.translate(d.x, d.y)
      ctx.rotate(d.spin)
      ctx.beginPath()
      ctx.arc(0, 0, DONUT_RADIUS, 0, Math.PI * 2)
      ctx.strokeStyle = "#c23a3a"
      ctx.lineWidth = DONUT_RADIUS * 0.55
      ctx.stroke()
      ctx.restore()
    }

    const drawBasket = () => {
      ctx.fillStyle = "#f4c542"
      ctx.beginPath()
      const x = basketXRef.current
      const y = CANVAS_HEIGHT - 30
      ctx.moveTo(x, y)
      ctx.lineTo(x + BASKET_WIDTH, y)
      ctx.lineTo(x + BASKET_WIDTH - 8, y + BASKET_HEIGHT)
      ctx.lineTo(x + 8, y + BASKET_HEIGHT)
      ctx.closePath()
      ctx.fill()
    }

    const tick = (time: number) => {
      if (lastTimeRef.current === null) lastTimeRef.current = time
      const dt = Math.min((time - lastTimeRef.current) / 1000, 0.05)
      lastTimeRef.current = time

      ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)

      if (gameStateRef.current === "playing") {
        // Move basket toward keyboard/pointer target
        const speed = 420
        if (keysRef.current.left)
          targetXRef.current = Math.max(targetXRef.current - speed * dt, 0)
        if (keysRef.current.right)
          targetXRef.current = Math.min(
            targetXRef.current + speed * dt,
            CANVAS_WIDTH - BASKET_WIDTH
          )
        basketXRef.current +=
          (targetXRef.current - basketXRef.current) * Math.min(dt * 12, 1)

        // Spawn donuts, ramping difficulty with score
        spawnTimerRef.current -= dt
        const spawnInterval = Math.max(1.1 - scoreRef.current * 0.02, 0.4)
        if (spawnTimerRef.current <= 0) {
          spawnTimerRef.current = spawnInterval
          donutsRef.current.push({
            x: DONUT_RADIUS + Math.random() * (CANVAS_WIDTH - DONUT_RADIUS * 2),
            y: -DONUT_RADIUS,
            speed: 90 + Math.random() * 40 + scoreRef.current * 4,
            spin: Math.random() * Math.PI,
          })
        }

        // Update donuts
        const basketY = CANVAS_HEIGHT - 30
        const remaining: Donut[] = []
        for (const d of donutsRef.current) {
          d.y += d.speed * dt
          d.spin += dt * 2

          const caught =
            d.y + DONUT_RADIUS >= basketY &&
            d.y - DONUT_RADIUS <= basketY + BASKET_HEIGHT &&
            d.x >= basketXRef.current - DONUT_RADIUS * 0.3 &&
            d.x <= basketXRef.current + BASKET_WIDTH + DONUT_RADIUS * 0.3

          if (caught) {
            scoreRef.current += 1
            setScore(scoreRef.current)
            continue
          }

          if (d.y - DONUT_RADIUS > CANVAS_HEIGHT) {
            livesRef.current -= 1
            setLives(livesRef.current)
            if (livesRef.current <= 0) {
              endGame()
            }
            continue
          }

          remaining.push(d)
        }
        donutsRef.current = remaining
      }

      // Draw
      for (const d of donutsRef.current) drawDonut(d)
      drawBasket()

      rafRef.current = requestAnimationFrame(tick)
    }

    rafRef.current = requestAnimationFrame(tick)
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [endGame])

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="flex items-center justify-between w-full max-w-[360px] text-sm text-gray-300 px-1">
        <span>
          Score: <span className="text-white font-semibold">{score}</span>
        </span>
        <span>
          Lives:{" "}
          <span className="text-white font-semibold">
            {"🍩".repeat(Math.max(lives, 0))}
          </span>
        </span>
        <span>
          Best: <span className="text-white font-semibold">{best}</span>
        </span>
      </div>

      <div className="relative">
        <canvas
          ref={canvasRef}
          width={CANVAS_WIDTH}
          height={CANVAS_HEIGHT}
          onPointerMove={handlePointerMove}
          onPointerDown={handlePointerDown}
          className="rounded-lg bg-[#1e3340] border border-[#3d5a6c]/50 touch-none max-w-full"
        />

        {gameState !== "playing" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-[#1e3340]/90 rounded-lg text-center px-6">
            {gameState === "gameover" ? (
              <>
                <p className="text-lg font-bold text-white">
                  Show&apos;s over!
                </p>
                <p className="text-gray-300 text-sm">
                  You caught {score} donut{score === 1 ? "" : "s"}
                </p>
                {justBeatBest && (
                  <p className="text-sm font-semibold text-[#f4c542]">
                    🎉 New high score!
                  </p>
                )}
              </>
            ) : (
              <>
                <p className="text-lg font-bold text-white">Donut Catch</p>
                <p className="text-gray-300 text-sm max-w-[240px]">
                  Move under the falling donuts. Arrow keys, drag, or tap to
                  play.
                </p>
              </>
            )}
            <button
              onClick={startGame}
              className="px-4 py-2 bg-[#c23a3a] hover:bg-[#d64545] text-white text-sm font-medium rounded-lg transition-colors"
            >
              {gameState === "gameover" ? "Play Again" : "Start"}
            </button>
          </div>
        )}
      </div>

      <div className="w-full max-w-[360px] bg-[#1e3340] border border-[#3d5a6c]/50 rounded-lg p-3">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold text-white">🏆 High Scores</h3>
          {status === "unauthenticated" && (
            <span className="text-xs text-gray-400">
              Log in to save your score
            </span>
          )}
        </div>
        {leaderboard.length === 0 ? (
          <p className="text-xs text-gray-400">No scores yet — be the first!</p>
        ) : (
          <ol className="space-y-1 text-sm max-h-32 overflow-y-auto">
            {leaderboard.map((entry, i) => (
              <li
                key={`${entry.username}-${i}`}
                className={`flex items-center justify-between px-2 py-1 rounded ${
                  session?.user?.username === entry.username
                    ? "bg-[#c23a3a]/20 text-white"
                    : "text-gray-300"
                }`}
              >
                <span>
                  <span className="text-gray-500 mr-2">{i + 1}.</span>
                  {entry.username}
                </span>
                <span className="font-semibold">{entry.score}</span>
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  )
}
