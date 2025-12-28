import { exec } from "child_process"
import { promisify } from "util"
import { readFile, writeFile } from "fs/promises"
import { config } from "dotenv"

// Load environment variables from .env.local
config({ path: ".env.local" })

const execAsync = promisify(exec)

const BRANCH_NAME = "dev"
const ENV_FILE_PATH = ".env.local"

async function updateEnvFile() {
  const projectId = process.env.NEON_PROJECT_ID
  if (!projectId) {
    console.error("❌ NEON_PROJECT_ID is not set in your .env.local")
    process.exit(1)
  }

  try {
    // Get the connection string for the dev branch
    console.log(`🔍 Getting connection string for '${BRANCH_NAME}' branch...`)
    const { stdout } = await execAsync(
      `neonctl connection-string ${BRANCH_NAME} --project-id ${projectId}`
    )
    const newConnectionString = stdout.trim()

    if (!newConnectionString) {
      console.error(
        `❌ Could not get connection string for branch '${BRANCH_NAME}'`
      )
      console.error("Make sure the branch exists:")
      console.error("   npm run db:create-branch")
      process.exit(1)
    }

    console.log(`✅ Got connection string`)
    console.log()

    // Read the current .env.local file
    let envContent = ""
    try {
      envContent = await readFile(ENV_FILE_PATH, "utf-8")
    } catch (error) {
      console.error(`❌ Could not read ${ENV_FILE_PATH}`)
      console.error("Make sure the file exists")
      process.exit(1)
    }

    // Update DATABASE_URL in the env file
    const lines = envContent.split("\n")
    let updated = false
    const updatedLines = lines.map((line) => {
      // Match DATABASE_URL= (but not PROD_DATABASE_URL or TEST_DATABASE_URL)
      if (line.match(/^DATABASE_URL=/)) {
        updated = true
        return `DATABASE_URL="${newConnectionString}"`
      }
      return line
    })

    if (!updated) {
      console.error(`❌ DATABASE_URL not found in ${ENV_FILE_PATH}`)
      console.error("\nAdd this line to your .env.local:")
      console.error(`DATABASE_URL="${newConnectionString}"`)
      process.exit(1)
    }

    // Write the updated content back
    await writeFile(ENV_FILE_PATH, updatedLines.join("\n"), "utf-8")

    console.log(`✅ Updated ${ENV_FILE_PATH}`)
    console.log()
    console.log("DATABASE_URL is now set to:")
    console.log(`  ${newConnectionString.replace(/:[^:@]+@/, ":****@")}`)
    console.log()
    console.log(
      "🔄 Remember to restart your dev server for changes to take effect!"
    )
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    console.error("❌ Failed to update env file:", errorMessage)
    process.exit(1)
  }
}

updateEnvFile()
