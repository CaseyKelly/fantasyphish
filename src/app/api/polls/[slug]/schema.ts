import { z } from "zod"

export const pollVoteSchema = z.object({
  option: z.string().min(1, "Option is required"),
})
