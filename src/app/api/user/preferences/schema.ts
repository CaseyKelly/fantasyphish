import { z } from "zod"

export const updatePreferencesSchema = z
  .object({
    emailPickReminders: z.boolean().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one preference is required",
  })
