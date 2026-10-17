import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import {
  getUpcomingShows,
  getRecentShows,
  getSetlist,
  getAllSongs,
  getShowsByYear,
  hasShowStarted,
} from "./phishnet"

const fetchMock = vi.fn()

function jsonResponse(body: unknown, init: { ok?: boolean } = {}): Response {
  return {
    ok: init.ok ?? true,
    status: init.ok === false ? 500 : 200,
    statusText: init.ok === false ? "Server Error" : "OK",
    json: async () => body,
  } as Response
}

function apiData(data: unknown): Response {
  return jsonResponse({ error: false, error_message: "", data })
}

const song = {
  songid: 1,
  song: "Tweezer",
  slug: "tweezer",
  position: 1,
  set: "1",
  isjam: 0,
  isreprise: 0,
  transition: "",
  footnote: "",
  showid: 99,
  showdate: "2025-07-04",
  venue: "MSG",
  city: "New York",
  state: "NY",
  country: "USA",
  setlistnotes: "notes",
  tourname: "Summer Tour",
  tourid: 7,
}

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock)
  vi.stubEnv("PHISHNET_API_KEY", "test-key")
  vi.spyOn(console, "error").mockImplementation(() => {})
  vi.spyOn(console, "log").mockImplementation(() => {})
  fetchMock.mockReset()
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
})

describe("fetchPhishNet (via public helpers)", () => {
  it("appends the API key and uses a 5 minute revalidate by default", async () => {
    fetchMock.mockResolvedValue(apiData([]))
    await getUpcomingShows()
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.phish.net/v5/shows/upcoming?apikey=test-key",
      { cache: undefined, next: { revalidate: 300 } }
    )
  })

  it("returns [] when the API key is missing", async () => {
    vi.stubEnv("PHISHNET_API_KEY", "")
    expect(await getUpcomingShows()).toEqual([])
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("returns [] on a non-OK HTTP response", async () => {
    fetchMock.mockResolvedValue(jsonResponse({}, { ok: false }))
    expect(await getAllSongs()).toEqual([])
  })

  it("returns [] when phish.net reports an error in the body", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ error: true, error_message: "bad key", data: null })
    )
    expect(await getShowsByYear(2025)).toEqual([])
  })
})

describe("list endpoints", () => {
  it("getUpcomingShows returns data, or [] for a null payload", async () => {
    fetchMock.mockResolvedValueOnce(apiData([{ showid: 1 }]))
    expect(await getUpcomingShows()).toEqual([{ showid: 1 }])
    fetchMock.mockResolvedValueOnce(apiData(null))
    expect(await getUpcomingShows()).toEqual([])
  })

  it("getRecentShows slices to the limit", async () => {
    fetchMock.mockResolvedValue(
      apiData([{ showid: 1 }, { showid: 2 }, { showid: 3 }])
    )
    expect(await getRecentShows(2)).toEqual([{ showid: 1 }, { showid: 2 }])
  })

  it("getRecentShows handles null data and fetch failures", async () => {
    fetchMock.mockResolvedValueOnce(apiData(null))
    expect(await getRecentShows()).toEqual([])
    fetchMock.mockRejectedValueOnce(new Error("network"))
    expect(await getRecentShows()).toEqual([])
  })

  it("getAllSongs returns songs, or [] for a null payload", async () => {
    fetchMock.mockResolvedValueOnce(apiData([{ songid: 1 }]))
    expect(await getAllSongs()).toEqual([{ songid: 1 }])
    fetchMock.mockResolvedValueOnce(apiData(null))
    expect(await getAllSongs()).toEqual([])
  })

  it("getShowsByYear hits the year endpoint", async () => {
    fetchMock.mockResolvedValueOnce(apiData([{ showid: 5 }]))
    expect(await getShowsByYear(2024)).toEqual([{ showid: 5 }])
    expect(fetchMock.mock.calls[0][0]).toContain("/shows/year/2024")
    fetchMock.mockResolvedValueOnce(apiData(null))
    expect(await getShowsByYear(2024)).toEqual([])
  })

  it("getUpcomingShows returns [] when fetch throws", async () => {
    fetchMock.mockRejectedValue(new Error("down"))
    expect(await getUpcomingShows()).toEqual([])
  })
})

describe("getSetlist", () => {
  it("builds a setlist object from the first song's show metadata", async () => {
    fetchMock.mockResolvedValue(apiData([song, { ...song, position: 2 }]))
    const setlist = await getSetlist("2025-07-04")
    expect(setlist).toMatchObject({
      showid: 99,
      showdate: "2025-07-04",
      venue: "MSG",
      tour_name: "Summer Tour",
      tourid: 7,
    })
    expect(setlist?.songs).toHaveLength(2)
  })

  it("defaults tour_name to an empty string", async () => {
    fetchMock.mockResolvedValue(apiData([{ ...song, tourname: "" }]))
    expect((await getSetlist("2025-07-04"))?.tour_name).toBe("")
  })

  it("passes cache: no-store when noCache is set", async () => {
    fetchMock.mockResolvedValue(apiData([song]))
    await getSetlist("2025-07-04", { noCache: true })
    expect(fetchMock.mock.calls[0][1]).toEqual({
      cache: "no-store",
      next: undefined,
    })
  })

  it("returns null for an empty setlist", async () => {
    fetchMock.mockResolvedValue(apiData([]))
    expect(await getSetlist("2025-07-04")).toBeNull()
  })

  it("returns null when the request fails", async () => {
    fetchMock.mockRejectedValue(new Error("down"))
    expect(await getSetlist("2025-07-04")).toBeNull()
  })
})

describe("hasShowStarted", () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it("returns true from time-based locking without hitting the API", async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2025-07-06T12:00:00Z"))
    expect(await hasShowStarted("2025-07-04", "America/New_York")).toBe(true)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("falls back to the setlist when the show hasn't locked yet", async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2025-07-01T12:00:00Z"))
    fetchMock.mockResolvedValue(apiData([song]))
    expect(await hasShowStarted("2025-07-04", null, "NY")).toBe(true)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it("returns false with no timezone info and no setlist", async () => {
    fetchMock.mockResolvedValue(apiData([]))
    expect(await hasShowStarted("2025-07-04")).toBe(false)
  })
})
