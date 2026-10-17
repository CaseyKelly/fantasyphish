-- 20261012000000_add_set_count_and_opener_set was applied to production
-- early, by a preview build (see src/lib/migration-database-url.ts), while
-- production still ran the one-opener code. Picks made on production in
-- the meantime are one-opener submissions, so repeat that migration's
-- backfill here, where it runs right before the set-opener code ships.
-- Both updates are no-ops wherever there's nothing to fix.

-- Opener picks made without a set number were Set 1 openers.
UPDATE "Pick" SET "openerSet" = 1
WHERE "pickType" = 'OPENER' AND "openerSet" IS NULL;

-- A show whose submissions have fewer opener picks than its set count was
-- picked under the old rules, so put it back to one set.
UPDATE "Show" s SET "setCount" = 1
WHERE s."setCount" > 1
  AND EXISTS (
    SELECT 1 FROM "Submission" sub
    WHERE sub."showId" = s."id"
      AND (
        SELECT count(*) FROM "Pick" p
        WHERE p."submissionId" = sub."id" AND p."pickType" = 'OPENER'
      ) < s."setCount"
  );
