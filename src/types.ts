import type { spawn } from 'node:child_process'

export type StepValue = string | boolean
export type StepParam = string | string[]

export interface StepBase {
  key: string
  message: string
  param?: StepParam
}

export interface SelectStep extends StepBase {
  options: Array<{ label: string, value: string }>
  type: 'select'
}

export interface ConfirmStep extends StepBase {
  type: 'confirm'
}

export type Step = SelectStep | ConfirmStep

export interface RunOptions {
  cwd?: string
  env?: Record<string, string>
  parallel?: boolean
  shell?: boolean
  timeout?: number
}

export interface RunResult {
  command: string
  exitCode: number
  signal: NodeJS.Signals | null
}

export interface HandleContext {
  args: string[]
  run: (commands: string | string[], options?: RunOptions) => Promise<RunResult[]>
  spawn: typeof spawn
  values: Record<string, StepValue>
}

export interface ScriptCliConfig {
  defaultValues?: Record<string, StepValue>
  error?: (error: unknown, context: HandleContext) => void | Promise<void>
  finally?: (context: HandleContext) => void | Promise<void>
  handle:
    | ((context: HandleContext) => void | string | string[] | Promise<void | string | string[]>)
  steps: Step[]
  success?: (context: HandleContext) => void | Promise<void>
}
