// Test the updated getSetlist function
import { config } from "dotenv"
import { resolve } from "path"

// Load environment variables like Next.js does
config({ path: resolve(process.cwd(), ".env.local") })
config({ path: resolve(process.cwd(), ".env") })

import { getSetlist } from "./src/lib/phishnet.js"

async function testUpdatedGetSetlist() {
  try {
    console.log("🧪 Testing updated getSetlist function...")

    const setlist = await getSetlist("2024-07-19")

    if (setlist) {
      console.log("✅ Success! Setlist structure:")
      console.log(`  Show: ${setlist.showdate} - ${setlist.venue}`)
      console.log(`  Songs: ${setlist.songs.length}`)
      console.log(`  First 3 songs:`)
      setlist.songs.slice(0, 3).forEach((song, i) => {
        console.log(`    ${i + 1}. ${song.song} (${song.set})`)
      })

      if (setlist.songs.length >= 10) {
        console.log(
          `\n🎯 Perfect! This date has ${setlist.songs.length} songs and is suitable for testing!`
        )
      }
    } else {
      console.log("❌ No setlist returned")
    }
  } catch (error) {
    console.log("❌ Error:", error.message)
  }
}

testUpdatedGetSetlist()
