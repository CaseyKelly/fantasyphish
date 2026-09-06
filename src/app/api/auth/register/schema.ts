import { z } from "zod"
import { usernameSchema } from "@/lib/username"

export const registerSchema = z.object({
  email: z.string().email("Invalid email address"),
  username: usernameSchema,
  password: z.string().min(8, "Password must be at least 8 characters"),
  showId: z.string().optional(),
  picks: z
    .array(
      z.object({
        songId: z.string(),
        pickType: z.enum(["OPENER", "ENCORE", "REGULAR"]),
      })
    )
    .optional(),
})
