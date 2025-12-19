import { getSetlist } from "./src/lib/phishnet.js"

async function testHistoricalDates() {
  try {
    // Test some known historical Phish show dates that should have setlist data
    const testDates = [
      "2024-07-19", // Summer 2024 tour
      "2024-04-20", // Spring 2024
      "2023-12-31", // NYE 2023
      "2023-08-05", // Summer 2023
      "2022-07-22", // Summer 2022
    ]

    console.log("🧪 Testing historical dates for setlist data...")

    for (const date of testDates) {
      try {
        console.log(`\nTesting ${date}...`)
        const setlist = await getSetlist(date)
        if (setlist?.songs?.length > 0) {
          console.log(`  ✅ Found setlist with ${setlist.songs.length} songs`)
          console.log(
            `  First few songs: ${setlist.songs
              .slice(0, 3)
              .map((s) => s.song)
              .join(", ")}`
          )
          if (setlist.songs.length >= 10) {
            console.log(`  🎯 Perfect for testing! Using this date.`)
            return date
          }
        } else {
          console.log(`  ❌ No songs found`)
        }
      } catch (error) {
        console.log(`  ❌ Error: ${error.message}`)
      }
    }

    console.log(
      "\n❌ Could not find a suitable historical date with setlist data"
    )
    return null
  } catch (error) {
    console.error("Error:", error)
    return null
  }
}

testHistoricalDates()
