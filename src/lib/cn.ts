import { twMerge } from "tailwind-merge"

/**
 * Joins class names and resolves Tailwind conflicts so a caller's override
 * wins (e.g. `p-0` passed to a component whose defaults are `px-4 py-3`).
 * Plain string concatenation can't do this: Tailwind v4 orders `px-*`/`py-*`
 * after `p-*` in the stylesheet, so the component default silently wins.
 */
export function cn(
  ...classes: Array<string | false | null | undefined>
): string {
  return twMerge(classes.filter(Boolean).join(" "))
}
