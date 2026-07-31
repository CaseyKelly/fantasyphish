import { spawnSync } from "child_process"
import { PrismaClient } from "@prisma/client"

/**
 * Wraps `prisma migrate deploy` with one-shot recovery from the known Neon
 * pgbouncer issue where a prior manual migrate run against the pooled
 * connection string leaves an idle backend holding Prisma's migration
 * advisory lock forever (see CLAUDE.md). On a P1002 advisory-lock timeout,
 * this finds any *idle* backend holding that exact lock (a genuinely
 * in-progress migration would show as `active`, so idle-only avoids
 * terminating a real concurrent deploy), terminates it, and retries once.
 */

function runMigrateDeploy(): { status: number; output: string } {
  const result = spawnSync("npx", ["prisma", "migrate", "deploy"], {
    encoding: "utf-8",
  })
  const output = `${result.stdout ?? ""}${result.stderr ?? ""}`
  process.stdout.write(output)
  return { status: result.status ?? 1, output }
}

async function clearStaleAdvisoryLock(lockId: string): Promise<boolean> {
  const directUrl = process.env.DIRECT_URL || process.env.DATABASE_URL
  if (!directUrl) {
    console.error(
      "[migrate-deploy] No DIRECT_URL/DATABASE_URL set, cannot attempt lock recovery"
    )
    return false
  }

  const prisma = new PrismaClient({ datasourceUrl: directUrl })
  try {
    const holders = await prisma.$queryRawUnsafe<
      { pid: number; state: string | null }[]
    >(
      `SELECT psa.pid, psa.state
       FROM pg_locks pl
       JOIN pg_stat_activity psa ON pl.pid = psa.pid
       WHERE pl.locktype = 'advisory'
         AND (pl.classid::bigint << 32 | pl.objid::bigint) = $1::bigint
         AND psa.pid != pg_backend_pid()`,
      lockId
    )

    const idleHolders = holders.filter((row) => row.state === "idle")

    if (idleHolders.length === 0) {
      console.log(
        `[migrate-deploy] Advisory lock ${lockId} is held, but not by an idle ` +
          `backend — a migration may genuinely be in progress. Not terminating anything.`
      )
      return false
    }

    for (const holder of idleHolders) {
      console.log(
        `[migrate-deploy] Terminating stale idle backend pid=${holder.pid} ` +
          `holding advisory lock ${lockId}`
      )
      await prisma.$executeRawUnsafe(
        `SELECT pg_terminate_backend($1::int)`,
        holder.pid
      )
    }

    return true
  } finally {
    await prisma.$disconnect()
  }
}

async function main() {
  const first = runMigrateDeploy()
  if (first.status === 0) {
    process.exit(0)
  }

  const lockMatch = first.output.match(/P1002[\s\S]*?pg_advisory_lock\((\d+)\)/)
  if (!lockMatch) {
    // Not a stale-lock failure — surface the original error as-is.
    process.exit(first.status)
  }

  const lockId = lockMatch[1]
  console.log(
    `[migrate-deploy] Detected advisory lock timeout (lock ${lockId}). Checking for a stale holder...`
  )

  let cleared = false
  try {
    cleared = await clearStaleAdvisoryLock(lockId)
  } catch (error) {
    console.error(
      "[migrate-deploy] Lock recovery attempt itself failed:",
      error instanceof Error ? error.message : error
    )
  }

  if (!cleared) {
    process.exit(first.status)
  }

  console.log("[migrate-deploy] Retrying migrate deploy...")
  const second = runMigrateDeploy()
  process.exit(second.status)
}

main()
