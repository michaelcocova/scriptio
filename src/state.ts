import type { StepValue } from './types'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

const stateDir = '.scriptio'
const stateName = 'last_state.json'

export function loadState(cwd: string): Record<string, StepValue> {
  try {
    const raw = JSON.parse(
      readFileSync(join(cwd, 'node_modules', stateDir, stateName), 'utf-8'),
    ) as { values?: Record<string, StepValue> }
    return raw.values && typeof raw.values === 'object'
      ? raw.values
      : {
        }
  } catch {
    return {
    }
  }
}

export function saveState(cwd: string, values: Record<string, StepValue>) {
  try {
    const file = join(cwd, 'node_modules', stateDir, stateName)
    mkdirSync(dirname(file), {
      recursive: true,
    })
    writeFileSync(file, `${JSON.stringify({
      values,
    }, null, 2)}\n`)
  } catch (error) {
    console.warn(`保存 scriptio 状态失败：${(error as Error).message}`)
  }
}
