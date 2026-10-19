import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import {
  readPickDraft,
  writePickDraft,
  clearPickDraft,
  type PickDraft,
} from "./pickDraft"

const KEY = "fp:draft-picks:v1:user-1:show-1"
const valid = new Set(["s1", "s2", "s3"])

function makeStorage() {
  const store = new Map<string, string>()
  return {
    getItem: vi.fn((k: string) => store.get(k) ?? null),
    setItem: vi.fn((k: string, v: string) => void store.set(k, v)),
    removeItem: vi.fn((k: string) => void store.delete(k)),
    store,
  }
}

let storage: ReturnType<typeof makeStorage>

beforeEach(() => {
  storage = makeStorage()
  vi.stubGlobal("window", { localStorage: storage })
  vi.spyOn(console, "warn").mockImplementation(() => {})
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

const draft: PickDraft = {
  openerPicks: [
    { songId: "s1", songName: "Tweezer", pickType: "OPENER", openerSet: 1 },
  ],
  encorePick: { songId: "s2", songName: "Harpua", pickType: "ENCORE" },
  regularPicks: [{ songId: "s3", songName: "Fee", pickType: "REGULAR" }],
}

describe("server-side (no window)", () => {
  it("all helpers no-op", () => {
    vi.unstubAllGlobals()
    expect(readPickDraft("user-1", "show-1", valid, 1)).toBeNull()
    writePickDraft("user-1", "show-1", draft)
    clearPickDraft("user-1", "show-1")
    expect(storage.setItem).not.toHaveBeenCalled()
    expect(storage.removeItem).not.toHaveBeenCalled()
  })
})

describe("writePickDraft / readPickDraft", () => {
  it("round-trips a draft", () => {
    writePickDraft("user-1", "show-1", draft)
    expect(storage.store.has(KEY)).toBe(true)
    expect(readPickDraft("user-1", "show-1", valid, 1)).toEqual(draft)
  })

  it("removes the key when the draft is empty", () => {
    storage.store.set(KEY, "x")
    writePickDraft("user-1", "show-1", {
      openerPicks: [null],
      encorePick: null,
      regularPicks: [],
    })
    expect(storage.store.has(KEY)).toBe(false)
  })

  it("drops picks for songs that no longer exist or are malformed", () => {
    storage.store.set(
      KEY,
      JSON.stringify({
        openerPick: { songId: "gone", songName: "X", pickType: "OPENER" },
        encorePick: { songId: "s2", songName: "Harpua", pickType: "BOGUS" },
        regularPicks: [
          draft.regularPicks[0],
          { songId: "gone", songName: "Y", pickType: "REGULAR" },
          null,
          { songId: 5 },
        ],
      })
    )
    expect(readPickDraft("user-1", "show-1", valid, 1)).toEqual({
      openerPicks: [null],
      encorePick: null,
      regularPicks: [draft.regularPicks[0]],
    })
  })

  it("restores a pre-set-openers draft's single opener as the Set 1 opener", () => {
    storage.store.set(
      KEY,
      JSON.stringify({
        openerPick: { songId: "s1", songName: "Tweezer", pickType: "OPENER" },
        encorePick: null,
        regularPicks: [],
      })
    )
    expect(readPickDraft("user-1", "show-1", valid, 2)).toEqual({
      openerPicks: [
        { songId: "s1", songName: "Tweezer", pickType: "OPENER", openerSet: 1 },
        null,
      ],
      encorePick: null,
      regularPicks: [],
    })
  })

  it("returns null when nothing survives validation", () => {
    storage.store.set(KEY, JSON.stringify({ regularPicks: "nope" }))
    expect(readPickDraft("user-1", "show-1", valid, 1)).toBeNull()
  })

  it("returns null for missing, non-object, or corrupt data", () => {
    expect(readPickDraft("user-1", "show-1", valid, 1)).toBeNull()
    storage.store.set(KEY, "42")
    expect(readPickDraft("user-1", "show-1", valid, 1)).toBeNull()
    storage.store.set(KEY, "{not json")
    expect(readPickDraft("user-1", "show-1", valid, 1)).toBeNull()
    expect(console.warn).toHaveBeenCalled()
  })

  it("swallows storage errors on write and clear", () => {
    storage.setItem.mockImplementation(() => {
      throw new Error("quota")
    })
    storage.removeItem.mockImplementation(() => {
      throw new Error("denied")
    })
    expect(() => writePickDraft("user-1", "show-1", draft)).not.toThrow()
    expect(() => clearPickDraft("user-1", "show-1")).not.toThrow()
    expect(console.warn).toHaveBeenCalledTimes(2)
  })

  it("clearPickDraft removes the key", () => {
    storage.store.set(KEY, "x")
    clearPickDraft("user-1", "show-1")
    expect(storage.store.has(KEY)).toBe(false)
  })
})
