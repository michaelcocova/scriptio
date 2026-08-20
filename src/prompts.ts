import type { Step, StepValue } from './types'
import process from 'node:process'
import { cancel, confirm as clackConfirm, isCancel, select } from '@clack/prompts'

export async function askStep(step: Step, initial?: StepValue): Promise<StepValue> {
  if (step.type === 'confirm') {
    const result = await clackConfirm({
      initialValue: typeof initial === 'boolean' ? initial : undefined,
      message: step.message,
    })
    return resolve(result, step.key) as boolean
  }

  const result = await select({
    initialValue: typeof initial === 'string' ? initial : undefined,
    message: step.message,
    options: step.options,
  })
  return resolve(result, step.key) as string
}

function resolve(result: string | boolean | symbol, key: string): string | boolean {
  if (isCancel(result)) {
    cancel(`已取消 ${key}`)
    process.exit(0)
  }
  return result
}
