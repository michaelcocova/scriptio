import type { Step, StepValue } from './types'
import process from 'node:process'
import { autocomplete, autocompleteMultiselect, cancel, confirm as clackConfirm, isCancel, multiselect, select, text } from '@clack/prompts'

export async function askStep(step: Step, initial?: StepValue): Promise<StepValue> {
  if (step.type === 'confirm') {
    const result = await clackConfirm({
      initialValue: typeof initial === 'boolean' ? initial : undefined,
      message: step.message,
    })
    return resolve(result, step.key) as boolean
  }

  if (step.type === 'text') {
    const result = await text({
      initialValue: typeof initial === 'string' ? initial : undefined,
      message: step.message,
    })
    return resolve(result, step.key) as string
  }

  if (step.type === 'multiselect' || step.type === 'autocompleteMultiselect') {
    const result = step.type === 'multiselect'
      ? await multiselect({
          initialValues: Array.isArray(initial) ? initial : undefined,
          message: step.message,
          options: step.options,
        })
      : await autocompleteMultiselect({
          initialValues: Array.isArray(initial) ? initial : undefined,
          message: step.message,
          options: step.options,
          placeholder: '输入以搜索...',
        })
    return resolve(result, step.key) as string[]
  }

  const result = step.type === 'autocomplete'
    ? await autocomplete({
        initialValue: typeof initial === 'string' ? initial : undefined,
        message: step.message,
        options: step.options,
        placeholder: '输入以搜索...',
      })
    : await select({
        initialValue: typeof initial === 'string' ? initial : undefined,
        message: step.message,
        options: step.options,
      })
  return resolve(result, step.key) as string
}

function resolve(result: string | boolean | string[] | symbol, key: string): string | boolean | string[] {
  if (isCancel(result)) {
    cancel(`已取消 ${key}`)
    process.exit(0)
  }
  return result
}
