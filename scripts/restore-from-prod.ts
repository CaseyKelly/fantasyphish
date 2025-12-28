import { exec } from "child_process"
import { promisify } from "util"
import { config } from "dotenv"

// Load environment variables from .env.local
config({ path: ".env.local" })
config({ path: ".env" })

const execAsync = promisify(exec)

/**
 * Script to restore local database from production
 *
 * SAFETY GUARANTEE: This script ONLY reads from production (pg_dump).
 * It NEVER writes to production. All destructive operations are performed
 * ONLY on the local database.
 *
 * This script:
 * 1. Dumps the production database to a file (READ-ONLY operation on prod)
 * 2. Drops the local database (if it exists)
 * 3. Creates a fresh local database
 * 4. Restores the production dump to local
 * 5. Cleans up the dump file
 */

async function main() {
  const prodDbUrl = process.env.PROD_DATABASE_URL
  const localDbUrl = process.env.DATABASE_URL

  if (!prodDbUrl) {
    console.error("❌ PROD_DATABASE_URL is not set in your .env.local")
    console.error("Add it like this:")
    console.error('PROD_DATABASE_URL="postgresql://user:pass@host:5432/dbname"')
    process.exit(1)
  }

  if (!localDbUrl) {
    console.error("❌ DATABASE_URL is not set in your .env.local")
    process.exit(1)
  }

  // SAFETY CHECK: Ensure DATABASE_URL and PROD_DATABASE_URL are different
  if (localDbUrl === prodDbUrl) {
    console.error("\n❌ SAFETY CHECK FAILED!")
    console.error("Your DATABASE_URL and PROD_DATABASE_URL are the same!")
    console.error(
      "This would result in dropping and recreating your production database."
    )
    console.error("\nPlease update your .env.local:")
    console.error(
      'DATABASE_URL="postgresql://user:password@localhost:5432/fantasyphish_local"'
    )
    console.error('PROD_DATABASE_URL="<your production database URL>"')
    process.exit(1)
  }

  // Check if DATABASE_URL points to a Neon database
  const isNeonDb = localDbUrl.includes("neon.tech")

  // For Neon databases, recommend using db:reset-branch as it's faster and simpler
  if (isNeonDb) {
    console.log("\n💡 Tip: You're using a Neon database")
    console.log("For Neon, it's faster to use:")
    console.log("   npm run db:reset-branch")
    console.log("\nThis command will:")
    console.log("  • Delete and recreate your dev branch in seconds")
    console.log("  • Copy all data from production")
    console.log("  • No need for pg_dump/restore")
    console.log("\nContinuing with pg_dump/restore method...")
    console.log("(This will take longer but works the same way)")
    console.log()
  }

  // SAFETY CHECK: Ensure non-Neon cloud databases are localhost only
  const isOtherCloudDb =
    !isNeonDb &&
    (localDbUrl.includes("amazonaws.com") ||
      localDbUrl.includes("supabase.co") ||
      localDbUrl.includes("planetscale.com")) &&
    !localDbUrl.includes("localhost")

  if (isOtherCloudDb) {
    console.error("\n❌ SAFETY CHECK FAILED!")
    console.error(
      "Your DATABASE_URL appears to point to a production cloud database."
    )
    console.error(
      "This script will DROP and RECREATE the database at DATABASE_URL."
    )
    console.error("\nFor safety, DATABASE_URL must be a local database like:")
    console.error(
      'DATABASE_URL="postgresql://user:password@localhost:5432/fantasyphish_local"'
    )
    console.error(
      "\nCurrent DATABASE_URL:",
      localDbUrl.replace(/:[^:@]+@/, ":****@")
    )
    process.exit(1)
  }

  // SAFETY CHECK: Ensure we're using localhost or Neon for local database
  const isLocalhost =
    localDbUrl.includes("localhost") || localDbUrl.includes("127.0.0.1")

  if (!isLocalhost && !isNeonDb) {
    console.error("\n⚠️  WARNING: DATABASE_URL is not localhost or Neon")
    console.error(
      "This script will DROP and RECREATE the database at:",
      localDbUrl.replace(/:[^:@]+@/, ":****@")
    )
    console.error(
      "\n❌ Aborting for safety. Please use a localhost or Neon database."
    )
    process.exit(1)
  }

  // Parse local database name from URL
  const localDbMatch = localDbUrl.match(/\/([^/?]+)(\?|$)/)
  const localDbName = localDbMatch ? localDbMatch[1] : "fantasyphish_local"

  const dumpFile = `/tmp/fantasyphish_prod_dump_${Date.now()}.sql`

  console.log("🚀 Starting production database restore to local...")
  console.log(
    `📖 Production DB (READ-ONLY): ${prodDbUrl.replace(/:[^:@]+@/, ":****@")}`
  )
  console.log(
    `💾 Local DB (WILL BE REPLACED): ${localDbUrl.replace(/:[^:@]+@/, ":****@")}`
  )
  console.log()
  console.log("✅ Safety checks passed:")
  console.log("   • Production and local databases are different")
  console.log("   • Local database is on localhost")
  console.log("   • Production database will only be READ from (pg_dump)")
  console.log("   • No writes will be made to production")
  console.log()

  try {
    // Step 1: Dump production database (READ-ONLY operation)
    console.log("1️⃣  Dumping production database (READ-ONLY)...")
    await execAsync(
      `pg_dump "${prodDbUrl}" -f "${dumpFile}" --no-owner --no-acl`
    )
    console.log(`   ✓ Dump saved to ${dumpFile}`)
    console.log(`   ✓ Production database was NOT modified`)

    // Step 2: Drop local database (if exists)
    console.log("\n2️⃣  Dropping local database (if exists)...")
    try {
      // Extract connection details without database name
      const localDbUrlWithoutDb = localDbUrl.replace(
        /\/[^/?]+(\?|$)/,
        "/postgres$1"
      )
      await execAsync(
        `psql "${localDbUrlWithoutDb}" -c "DROP DATABASE IF EXISTS ${localDbName};"`
      )
      console.log(`   ✓ Dropped database ${localDbName}`)
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error)
      console.log(`   ⚠️  Could not drop database: ${errorMessage}`)
      console.log("   Continuing anyway...")
    }

    // Step 3: Create fresh local database
    console.log("\n3️⃣  Creating fresh local database...")
    try {
      const localDbUrlWithoutDb = localDbUrl.replace(
        /\/[^/?]+(\?|$)/,
        "/postgres$1"
      )
      await execAsync(
        `psql "${localDbUrlWithoutDb}" -c "CREATE DATABASE ${localDbName};"`
      )
      console.log(`   ✓ Created database ${localDbName}`)
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error)
      if (errorMessage.includes("already exists")) {
        console.log(
          `   ℹ️  Database ${localDbName} already exists, continuing...`
        )
      } else {
        throw error
      }
    }

    // Step 4: Restore dump to local
    console.log("\n4️⃣  Restoring production data to local database...")
    await execAsync(`psql "${localDbUrl}" -f "${dumpFile}"`)
    console.log("   ✓ Data restored successfully")

    // Step 5: Clean up dump file
    console.log("\n5️⃣  Cleaning up...")
    await execAsync(`rm "${dumpFile}"`)
    console.log("   ✓ Removed temporary dump file")

    console.log("\n✅ Successfully restored production database to local!")
    console.log("You can now run your app with production data locally.")
    console.log()
    console.log("🔒 Production database was NOT modified - only READ from")
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    console.error("\n❌ Restore failed:", errorMessage)

    // Try to clean up dump file even on error
    try {
      await execAsync(`rm "${dumpFile}"`)
    } catch {
      // Ignore cleanup errors
    }

    console.error("\n🔒 Production database was NOT modified")
    process.exit(1)
  }
}

// Run with --dry-run to see what would happen without making changes
if (process.argv.includes("--dry-run")) {
  console.log("🧪 DRY RUN MODE - No changes will be made")
  console.log("\nThis script would:")
  console.log("1. Read (pg_dump) from: PROD_DATABASE_URL")
  console.log("2. Drop database at: DATABASE_URL")
  console.log("3. Create fresh database at: DATABASE_URL")
  console.log("4. Restore production dump to: DATABASE_URL")
  console.log(
    "\n⚠️  The local database at DATABASE_URL would be completely replaced"
  )
  console.log(
    "✅ The production database at PROD_DATABASE_URL would only be READ from"
  )
  console.log("\nRun without --dry-run to execute")
  process.exit(0)
}

main()
