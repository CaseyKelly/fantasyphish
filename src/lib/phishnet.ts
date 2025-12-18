const PHISHNET_API_BASE = "https://api.phish.net/v5";

interface PhishNetResponse<T> {
  error: boolean;
  error_message: string;
  data: T;
}

interface PhishNetShow {
  showid: number;
  showdate: string;
  venue: string;
  city: string;
  state: string;
  country: string;
  setlistnotes: string;
  tour_name: string;
  tourid: number;
}

interface PhishNetSetlistSong {
  songid: number;
  song: string;
  slug: string;
  position: number;
  set: string;
  isjam: number;
  isreprise: number;
  transition: string;
  footnote: string;
}

interface PhishNetSetlist {
  showid: number;
  showdate: string;
  venue: string;
  city: string;
  state: string;
  country: string;
  setlistnotes: string;
  tour_name: string;
  tourid: number;
  songs: PhishNetSetlistSong[];
}

interface PhishNetSong {
  songid: number;
  song: string;
  slug: string;
  artist: string;
  debut: string;
  last_played: string;
  times_played: number;
  gap: number;
}

async function fetchPhishNet<T>(endpoint: string): Promise<T> {
  const apiKey = process.env.PHISHNET_API_KEY;
  if (!apiKey) {
    throw new Error("PHISHNET_API_KEY is not configured");
  }

  const url = `${PHISHNET_API_BASE}${endpoint}?apikey=${apiKey}`;
  const response = await fetch(url, {
    next: { revalidate: 300 }, // Cache for 5 minutes
  });

  if (!response.ok) {
    throw new Error(`phish.net API error: ${response.status} ${response.statusText}`);
  }

  const json: PhishNetResponse<T> = await response.json();

  if (json.error) {
    throw new Error(`phish.net API error: ${json.error_message}`);
  }

  return json.data;
}

export async function getUpcomingShows(): Promise<PhishNetShow[]> {
  try {
    const shows = await fetchPhishNet<PhishNetShow[]>("/shows/upcoming");
    return shows || [];
  } catch (error) {
    console.error("Error fetching upcoming shows:", error);
    return [];
  }
}

export async function getRecentShows(limit: number = 10): Promise<PhishNetShow[]> {
  try {
    const shows = await fetchPhishNet<PhishNetShow[]>("/shows/recent");
    return (shows || []).slice(0, limit);
  } catch (error) {
    console.error("Error fetching recent shows:", error);
    return [];
  }
}

export async function getSetlist(showDate: string): Promise<PhishNetSetlist | null> {
  try {
    // Format: YYYY-MM-DD
    const setlists = await fetchPhishNet<PhishNetSetlist[]>(`/setlists/showdate/${showDate}`);
    if (setlists && setlists.length > 0) {
      return setlists[0];
    }
    return null;
  } catch (error) {
    console.error(`Error fetching setlist for ${showDate}:`, error);
    return null;
  }
}

export async function getAllSongs(): Promise<PhishNetSong[]> {
  try {
    const songs = await fetchPhishNet<PhishNetSong[]>("/songs");
    return songs || [];
  } catch (error) {
    console.error("Error fetching songs:", error);
    return [];
  }
}

export async function getShowsByYear(year: number): Promise<PhishNetShow[]> {
  try {
    const shows = await fetchPhishNet<PhishNetShow[]>(`/shows/year/${year}`);
    return shows || [];
  } catch (error) {
    console.error(`Error fetching shows for year ${year}:`, error);
    return [];
  }
}

// Helper to check if a show has started (has at least one song in setlist)
export async function hasShowStarted(showDate: string): Promise<boolean> {
  const setlist = await getSetlist(showDate);
  return setlist !== null && setlist.songs && setlist.songs.length > 0;
}

// Helper to check if a show is complete (has encore)
export function isShowComplete(setlist: PhishNetSetlist | null): boolean {
  if (!setlist || !setlist.songs || setlist.songs.length === 0) {
    return false;
  }
  // Check if there's an encore set
  return setlist.songs.some((song) => song.set.toLowerCase() === "e");
}

// Parse setlist into structured format for scoring
export interface ParsedSetlist {
  opener: string | null;
  encoreSongs: string[];
  allSongs: string[];
  setsBySong: Record<string, string>;
}

export function parseSetlist(setlist: PhishNetSetlist | null): ParsedSetlist {
  const result: ParsedSetlist = {
    opener: null,
    encoreSongs: [],
    allSongs: [],
    setsBySong: {},
  };

  if (!setlist || !setlist.songs || setlist.songs.length === 0) {
    return result;
  }

  // Sort by position to ensure correct order
  const sortedSongs = [...setlist.songs].sort((a, b) => {
    // Sort by set first, then by position
    const setOrder: Record<string, number> = { "1": 1, "2": 2, "3": 3, e: 4 };
    const aSetOrder = setOrder[a.set.toLowerCase()] || 5;
    const bSetOrder = setOrder[b.set.toLowerCase()] || 5;
    if (aSetOrder !== bSetOrder) return aSetOrder - bSetOrder;
    return a.position - b.position;
  });

  // Find opener (first song of set 1)
  const set1Songs = sortedSongs.filter((s) => s.set === "1");
  if (set1Songs.length > 0) {
    result.opener = set1Songs[0].song;
  }

  // Find encore songs
  result.encoreSongs = sortedSongs
    .filter((s) => s.set.toLowerCase() === "e")
    .map((s) => s.song);

  // All songs played
  result.allSongs = sortedSongs.map((s) => s.song);

  // Map songs to their sets
  sortedSongs.forEach((s) => {
    result.setsBySong[s.song.toLowerCase()] = s.set;
  });

  return result;
}

// Normalize song name for comparison
export function normalizeSongName(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^\w\s]/g, "")
    .replace(/\s+/g, " ");
}

export type { PhishNetShow, PhishNetSetlist, PhishNetSetlistSong, PhishNetSong };
