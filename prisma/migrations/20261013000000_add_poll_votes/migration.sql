-- CreateTable
CREATE TABLE "PollVote" (
    "id" TEXT NOT NULL,
    "pollSlug" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "option" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PollVote_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PollVote_pollSlug_idx" ON "PollVote"("pollSlug");

-- CreateIndex
CREATE UNIQUE INDEX "PollVote_pollSlug_userId_key" ON "PollVote"("pollSlug", "userId");

-- AddForeignKey
ALTER TABLE "PollVote" ADD CONSTRAINT "PollVote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
