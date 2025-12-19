// Test phish.net API with proper env loading
import { config } from "dotenv"
import { resolve } from "path"

// Load environment variables like Next.js does
config({ path: resolve(process.cwd(), ".env.local") })
config({ path: resolve(process.cwd(), ".env") })

console.log("🔍 Environment check:")
console.log("  PHISHNET_API_KEY loaded:", !!process.env.PHISHNET_API_KEY)
console.log(
  "  PHISHNET_API_KEY length:",
  process.env.PHISHNET_API_KEY?.length || 0
)

async function testPhishNet() {
  // Just test one date and log the raw API response
  const date = "2024-07-19"

  try {
    console.log(`\n🧪 Testing ${date} with full API debugging...`)

    // Test the raw API call
    const PHISHNET_API_BASE = "https://api.phish.net/v5"
    const endpoint = `/setlists/showdate/${date}`
    const apiKey = process.env.PHISHNET_API_KEY
    const url = `${PHISHNET_API_BASE}${endpoint}?apikey=${apiKey}`

    console.log(`  Calling URL: ${PHISHNET_API_BASE}${endpoint}?apikey=***`)

    const response = await fetch(url)
    console.log(`  Response status: ${response.status}`)

    const json = await response.json()
    console.log(`  Raw JSON response:`)
    console.log(JSON.stringify(json, null, 2))

    if (json.data) {
      console.log(
        `  Data type: ${Array.isArray(json.data) ? "array" : typeof json.data}`
      )
      console.log(
        `  Data length: ${Array.isArray(json.data) ? json.data.length : "N/A"}`
      )
    }
  } catch (error) {
    console.log(`  ❌ Error: ${error.message}`)
  }
}

testPhishNet()
