import { z } from "zod"

export const submitPicksSchema = z.object({
  showId: z.string(),
  picks: z.array(
    z.object({
      songId: z.string(),
      pickType: z.enum(["OPENER", "ENCORE", "REGULAR"]),
      openerSet: z.number().int().min(1).max(3).nullable().optional(),
    })
  ),
})
