import { z } from "zod"

export const registerSchema = z.object({
  email: z.string().email("Invalid email address"),
  username: z
    .string()
    .min(3, "Username must be at least 3 characters")
    .max(20, "Username must be at most 20 characters")
    .regex(
      /^[a-zA-Z0-9_]+$/,
      "Username can only contain letters, numbers, and underscores"
    ),
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
