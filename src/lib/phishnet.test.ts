import { describe, it, expect } from "vitest"
import {
  normalizeSongName,
  parseSetlist,
  isShowComplete,
  stripSetlistHtml,
  extractTimezone,
  type PhishNetSetlist,
  type PhishNetSetlistSong,
  type PhishNetShow,
} from "./phishnet"

function makeSong(
  overrides: Partial<PhishNetSetlistSong>
): PhishNetSetlistSong {
  return {
    songid: 1,
    song: "Tweezer",
    slug: "tweezer",
    position: 1,
    set: "1",
    isjam: 0,
    isreprise: 0,
    transition: "",
    footnote: "",
    showid: 1,
    showdate: "2025-07-04",
    venue: "Test Venue",
    city: "Burlington",
    state: "VT",
    country: "USA",
    setlistnotes: "",
    tourname: "Summer Tour",
    tourid: 1,
    ...overrides,
  }
}

function makeSetlist(songs: PhishNetSetlistSong[]): PhishNetSetlist {
  return {
    showid: 1,
    showdate: "2025-07-04",
    venue: "Test Venue",
    city: "Burlington",
    state: "VT",
    country: "USA",
    setlistnotes: "",
    tour_name: "Summer Tour",
    tourid: 1,
    songs,
  }
}

describe("normalizeSongName", () => {
  it("strips punctuation", () => {
    expect(normalizeSongName("Tweezer's Reprise!")).toBe("tweezers reprise")
  })

  it("collapses internal whitespace and trims", () => {
    expect(normalizeSongName("  Harry   Hood  ")).toBe("harry hood")
  })

  it("lowercases", () => {
    expect(normalizeSongName("YEM")).toBe("yem")
  })

  it("normalizes differently-punctuated variants of the same name to equal strings", () => {
    expect(normalizeSongName("Tweezer's Reprise!")).toBe(
      normalizeSongName("tweezers reprise")
    )
  })
})

describe("parseSetlist", () => {
  it("returns a zeroed shape for a null setlist", () => {
    expect(parseSetlist(null)).toEqual({
      opener: null,
      encoreSongs: [],
      allSongs: [],
      setsBySong: {},
    })
  })

  it("returns a zeroed shape for an empty-songs setlist", () => {
    expect(parseSetlist(makeSetlist([]))).toEqual({
      opener: null,
      encoreSongs: [],
      allSongs: [],
      setsBySong: {},
    })
  })

  it("picks the opener as the lowest-position set-1 song, regardless of array order", () => {
    const setlist = makeSetlist([
      makeSong({ song: "Sample in a Jar", set: "1", position: 2 }),
      makeSong({ song: "Tweezer", set: "1", position: 1 }),
    ])
    expect(parseSetlist(setlist).opener).toBe("Tweezer")
  })

  it("detects encore songs case-insensitively on the set field", () => {
    const setlist = makeSetlist([
      makeSong({ song: "Tweezer", set: "1", position: 1 }),
      makeSong({ song: "Character Zero", set: "E", position: 1 }),
    ])
    expect(parseSetlist(setlist).encoreSongs).toEqual(["Character Zero"])
  })

  it("lowercases setsBySong keys", () => {
    const setlist = makeSetlist([makeSong({ song: "Harry Hood", set: "2" })])
    expect(parseSetlist(setlist).setsBySong).toEqual({ "harry hood": "2" })
  })

  it("collects all songs across sets in set/position order", () => {
    const setlist = makeSetlist([
      makeSong({ song: "Encore Song", set: "e", position: 1 }),
      makeSong({ song: "Set 2 Song", set: "2", position: 1 }),
      makeSong({ song: "Opener", set: "1", position: 1 }),
    ])
    expect(parseSetlist(setlist).allSongs).toEqual([
      "Opener",
      "Set 2 Song",
      "Encore Song",
    ])
  })
})

describe("isShowComplete", () => {
  it("is false for a null setlist", () => {
    expect(isShowComplete(null)).toBe(false)
  })

  it("is false for an empty-songs setlist", () => {
    expect(isShowComplete(makeSetlist([]))).toBe(false)
  })

  it("is false when there's no encore set yet", () => {
    expect(isShowComplete(makeSetlist([makeSong({ set: "2" })]))).toBe(false)
  })

  it("is true once an encore-set song exists", () => {
    expect(isShowComplete(makeSetlist([makeSong({ set: "e" })]))).toBe(true)
  })
})

describe("stripSetlistHtml", () => {
  it("returns an empty string for null/undefined/empty input", () => {
    expect(stripSetlistHtml(null)).toBe("")
    expect(stripSetlistHtml(undefined)).toBe("")
    expect(stripSetlistHtml("")).toBe("")
  })

  it("converts <p> paragraph breaks to blank lines", () => {
    expect(stripSetlistHtml("<p>First</p><p>Second</p>")).toBe(
      "First\n\nSecond"
    )
  })

  it("converts <br> to a newline", () => {
    expect(stripSetlistHtml("Line one<br>Line two")).toBe("Line one\nLine two")
  })

  it("converts a <sup> footnote marker into bracketed text", () => {
    expect(stripSetlistHtml("Tweezer<sup>1</sup>")).toBe("Tweezer [1]")
  })

  it("keeps link text but drops the href", () => {
    expect(
      stripSetlistHtml('<a href="https://evil.example/x">Harry Hood</a>')
    ).toBe("Harry Hood")
  })

  it("decodes all mapped HTML entities", () => {
    expect(
      stripSetlistHtml(
        "Rock &amp; Roll &lt;tag&gt; &quot;q&quot; &#39;a&#39; &apos;b&apos; a&nbsp;b"
      )
    ).toBe(`Rock & Roll <tag> "q" 'a' 'b' a b`)
  })

  it("collapses 3+ consecutive newlines to exactly 2", () => {
    expect(stripSetlistHtml("<p>A</p><p></p><p>B</p>")).toBe("A\n\nB")
  })

  it("trims leading/trailing whitespace", () => {
    expect(stripSetlistHtml("  <p>  Hello  </p>  ")).toBe("Hello")
  })
})

describe("extractTimezone", () => {
  it("delegates to getTimezoneForLocation using the show's state", () => {
    const show: PhishNetShow = {
      showid: 1,
      showdate: "2025-07-04",
      venue: "Test Venue",
      city: "Burlington",
      state: "VT",
      country: "USA",
      setlistnotes: "",
      tour_name: "Summer Tour",
      tourid: 1,
    }
    expect(extractTimezone(show)).toBe("America/New_York")
  })
})
