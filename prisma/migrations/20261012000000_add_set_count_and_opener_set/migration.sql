-- AlterTable
ALTER TABLE "Pick" ADD COLUMN "openerSet" INTEGER;

-- AlterTable
ALTER TABLE "Show" ADD COLUMN "setCount" INTEGER NOT NULL DEFAULT 2;

-- Every opener pick made before this migration was a Set 1 opener.
UPDATE "Pick" SET "openerSet" = 1 WHERE "pickType" = 'OPENER';

-- Shows that already have picks (or are finished) were played under the
-- old one-opener rules, so keep them at one set. Upcoming shows with no
-- submissions yet pick up the new two-set default.
UPDATE "Show" SET "setCount" = 1
WHERE "isComplete" = true
   OR EXISTS (SELECT 1 FROM "Submission" s WHERE s."showId" = "Show"."id");
