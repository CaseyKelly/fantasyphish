import { z } from "zod"

export const submitScoreSchema = z.object({
  score: z.number().int().min(0).max(100_000),
})
