import { z } from "zod"

export const submitPicksSchema = z.object({
  showId: z.string(),
  picks: z.array(
    z.object({
      songId: z.string(),
      pickType: z.enum(["OPENER", "ENCORE", "REGULAR"]),
    })
  ),
})
