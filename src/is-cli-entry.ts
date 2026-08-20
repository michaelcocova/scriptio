import { existsSync, realpathSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

export function isCliEntry(entry: string | undefined, moduleUrl: string): boolean {
  if (!entry || !existsSync(entry)) {
    return false
  }
  return realpathSync(entry) === fileURLToPath(moduleUrl)
}
