import { z } from 'zod'

export function formatZodErrors(error: z.ZodError): Record<string, string> {
  const result: Record<string, string> = {}
  for (const issue of error.issues) {
    const key = issue.path.length > 0 ? String(issue.path[0]) : '_root'
    if (!result[key]) {
      result[key] = issue.message
    }
  }
  return result
}
