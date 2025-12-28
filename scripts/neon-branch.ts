import { exec } from "child_process"
import { promisify } from "util"
import { config } from "dotenv"

// Load environment variables from .env.local
config({ path: ".env.local" })
config({ path: ".env" })

const execAsync = promisify(exec)

/**
 * Script to manage Neon database branches for local development
 *
 * Commands:
 * - create: Create a new development branch
 * - reset: Reset (delete and recreate) the development branch
 * - list: List all branches
 */

const BRANCH_NAME = "dev"

async function getBranches(): Promise<string[]> {
  const projectId = process.env.NEON_PROJECT_ID
  if (!projectId) {
    console.error("❌ NEON_PROJECT_ID is not set in your .env.local")
    process.exit(1)
  }

  try {
    const { stdout } = await execAsync(
      `neonctl branches list --project-id ${projectId} --output json`
    )
    const branches = JSON.parse(stdout) as Array<{ name: string }>
    return branches.map((b) => b.name)
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    console.error("❌ Failed to list branches:", errorMessage)
    process.exit(1)
  }
}

async function createBranch(): Promise<void> {
  const projectId = process.env.NEON_PROJECT_ID
  if (!projectId) {
    console.error("❌ NEON_PROJECT_ID is not set in your .env.local")
    process.exit(1)
  }

  console.log(`🌱 Creating Neon branch '${BRANCH_NAME}'...`)

  try {
    // Check if branch already exists
    const branches = await getBranches()
    if (branches.includes(BRANCH_NAME)) {
      console.log(`ℹ️  Branch '${BRANCH_NAME}' already exists`)
      console.log("Use 'npm run db:reset-branch' to reset it")
      return
    }

    // Create branch from main
    const { stdout } = await execAsync(
      `neonctl branches create --project-id ${projectId} --name ${BRANCH_NAME} --output json`
    )
    const branchInfo = JSON.parse(stdout)

    // Extract connection URI from the response
    const connectionUri = branchInfo.connection_uris?.[0]?.connection_uri
    const poolerHost =
      branchInfo.connection_uris?.[0]?.connection_parameters?.pooler_host

    console.log(`✅ Branch '${BRANCH_NAME}' created successfully!`)

    if (connectionUri) {
      // Use pooler host if available for better connection pooling
      let finalUri = connectionUri
      if (poolerHost) {
        finalUri = connectionUri.replace(
          /ep-[^.]+\./,
          `${poolerHost.split(".")[0]}.`
        )
      }

      console.log("\nConnection string:")
      console.log(finalUri)
      console.log("\nAdd this to your .env.local:")
      console.log(`DATABASE_URL="${finalUri}"`)
    } else {
      console.log("\n⚠️  Could not extract connection URI from response")
      console.log("Get it manually with:")
      console.log(
        `neonctl connection-string ${BRANCH_NAME} --project-id ${projectId}`
      )
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    console.error("❌ Failed to create branch:", errorMessage)
    process.exit(1)
  }
}

async function deleteBranch(): Promise<void> {
  const projectId = process.env.NEON_PROJECT_ID
  if (!projectId) {
    console.error("❌ NEON_PROJECT_ID is not set in your .env.local")
    process.exit(1)
  }

  console.log(`🗑️  Deleting Neon branch '${BRANCH_NAME}'...`)

  try {
    // Check if branch exists
    const branches = await getBranches()
    if (!branches.includes(BRANCH_NAME)) {
      console.log(`ℹ️  Branch '${BRANCH_NAME}' does not exist`)
      return
    }

    await execAsync(
      `neonctl branches delete ${BRANCH_NAME} --project-id ${projectId}`
    )
    console.log(`✅ Branch '${BRANCH_NAME}' deleted`)
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    console.error("❌ Failed to delete branch:", errorMessage)
    process.exit(1)
  }
}

async function resetBranch(): Promise<void> {
  console.log(`🔄 Resetting Neon branch '${BRANCH_NAME}'...`)
  console.log("This will delete the branch and recreate it from main")
  console.log()

  await deleteBranch()
  await createBranch()

  console.log("\n✅ Branch reset complete!")
  console.log(
    "Your development database now has a fresh copy of production data"
  )
}

async function listBranches(): Promise<void> {
  const projectId = process.env.NEON_PROJECT_ID
  if (!projectId) {
    console.error("❌ NEON_PROJECT_ID is not set in your .env.local")
    process.exit(1)
  }

  console.log("📋 Neon branches:")

  try {
    const { stdout } = await execAsync(
      `neonctl branches list --project-id ${projectId}`
    )
    console.log(stdout)
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    console.error("❌ Failed to list branches:", errorMessage)
    process.exit(1)
  }
}

async function main() {
  const command = process.argv[2] || "create"

  switch (command) {
    case "create":
      await createBranch()
      break
    case "reset":
      await resetBranch()
      break
    case "delete":
      await deleteBranch()
      break
    case "list":
      await listBranches()
      break
    default:
      console.error(`Unknown command: ${command}`)
      console.error("Usage: npm run db:branch [create|reset|delete|list]")
      process.exit(1)
  }
}

main()
