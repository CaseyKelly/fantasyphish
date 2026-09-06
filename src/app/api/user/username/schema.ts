import { z } from "zod"
import { usernameSchema } from "@/lib/username"

export const updateUsernameSchema = z.object({
  username: usernameSchema,
})
