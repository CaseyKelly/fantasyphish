/**
 * Delete all archived Neon branches to reduce branch-hours costs
 *
 * This script will:
 * 1. List all branches
 * 2. Filter for archived preview branches
 * 3. Delete them to save on branch-hours charges
 *
 * Usage: npx tsx scripts/cleanup-neon-branches.ts [--dry-run]
 */

import { exec } from "child_process"
import { promisify } from "util"
import { config } from "dotenv"

// Load environment variables from .env.local
config({ path: ".env.local" })
config({ path: ".env" })

const execAsync = promisify(exec)

interface Branch {
  id: string
  name: string
  current_state: string
  created_at: string
}

async function listAllBranches(): Promise<Branch[]> {
  const projectId = process.env.NEON_PROJECT_ID
  if (!projectId) {
    console.error("❌ NEON_PROJECT_ID is not set in your .env.local")
    process.exit(1)
  }

  try {
    const { stdout } = await execAsync(
      `neonctl branches list --project-id ${projectId} --output json`
    )
    return JSON.parse(stdout) as Branch[]
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    console.error("❌ Failed to list branches:", errorMessage)
    process.exit(1)
  }
}

async function deleteBranch(
  branchId: string,
  branchName: string
): Promise<boolean> {
  const projectId = process.env.NEON_PROJECT_ID
  if (!projectId) {
    console.error("❌ NEON_PROJECT_ID is not set")
    return false
  }

  try {
    await execAsync(
      `neonctl branches delete ${branchId} --project-id ${projectId}`
    )
    return true
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    console.error(`   ✗ Failed to delete ${branchName}:`, errorMessage)
    return false
  }
}

async function main() {
  const isDryRun = process.argv.includes("--dry-run")
  const isNonInteractive =
    process.argv.includes("--non-interactive") || process.env.CI === "true"

  console.log("🧹 Cleaning up Neon branches...\n")

  if (isDryRun) {
    console.log("🔍 DRY RUN MODE - No branches will be deleted\n")
  }

  // Get all branches
  const allBranches = await listAllBranches()

  // Filter for branches to delete:
  // - Archived branches
  // - Preview branches (exclude main, dev, test)
  const protectedBranches = ["main", "dev", "test"]

  const branchesToDelete = allBranches.filter((b) => {
    const isArchived = b.current_state === "archived"
    const isPreview = b.name.startsWith("preview/")
    const isProtected = protectedBranches.includes(b.name)

    return (isArchived || isPreview) && !isProtected
  })

  console.log(`📊 Branch Summary:`)
  console.log(`   Total branches: ${allBranches.length}`)
  console.log(
    `   Archived branches: ${allBranches.filter((b) => b.current_state === "archived").length}`
  )
  console.log(
    `   Preview branches: ${allBranches.filter((b) => b.name.startsWith("preview/")).length}`
  )
  console.log(`   Branches to delete: ${branchesToDelete.length}`)
  console.log()

  if (branchesToDelete.length === 0) {
    console.log("✅ No branches to delete!")
    return
  }

  console.log(`🗑️  Branches marked for deletion:`)
  branchesToDelete.forEach((b) => {
    const status = b.current_state === "archived" ? "📦 archived" : "🔄 active"
    console.log(`   ${status} - ${b.name}`)
  })
  console.log()

  if (isDryRun) {
    console.log(
      "✅ Dry run complete. Run without --dry-run to actually delete branches."
    )
    return
  }

  // Confirm deletion (skip in CI/non-interactive mode)
  if (!isNonInteractive) {
    console.log("⚠️  This will permanently delete these branches.")
    console.log("Press Ctrl+C to cancel, or wait 5 seconds to continue...\n")
    await new Promise((resolve) => setTimeout(resolve, 5000))
  } else {
    console.log("⚠️  Running in non-interactive mode (CI detected)")
    console.log("Proceeding with branch deletion...\n")
  }

  // Delete branches
  console.log("🗑️  Deleting branches...\n")

  let deleted = 0
  let failed = 0

  for (const branch of branchesToDelete) {
    const status = branch.current_state === "archived" ? "📦" : "🔄"
    process.stdout.write(`   ${status} Deleting ${branch.name}... `)

    const success = await deleteBranch(branch.id, branch.name)
    if (success) {
      console.log("✓")
      deleted++
    } else {
      console.log("✗")
      failed++
    }
  }

  console.log()
  console.log("📊 Cleanup Summary:")
  console.log(`   ✓ Deleted: ${deleted}`)
  console.log(`   ✗ Failed: ${failed}`)
  console.log()

  if (deleted > 0) {
    console.log("💰 Cost Savings:")
    console.log(
      `   This should significantly reduce your branch-hours charges.`
    )
    console.log(
      `   Previously you had ~${branchesToDelete.length} branches accumulating hours.`
    )
    console.log()
  }

  console.log("✅ Cleanup complete!")
  console.log()
  console.log("📝 Recommendations:")
  console.log(
    "   1. Configure Vercel to auto-delete preview branches when PRs close"
  )
  console.log("   2. Periodically run this script to clean up stale branches")
  console.log("   3. Keep only 'main' and 'dev' branches long-term")
}

main().catch((error) => {
  console.error("Error running script:", error)
  process.exit(1)
})
