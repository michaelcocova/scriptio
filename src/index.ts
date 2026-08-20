#!/usr/bin/env node
import type { HandleContext, ScriptCliConfig, Step, StepValue } from './types'
import { spawn } from 'node:child_process'
import process from 'node:process'
import { intro, log, outro } from '@clack/prompts'
import { bold, options as colorOptions, cyan, dim } from 'kolorist'
import { buildArgs, extractConfigArg, getPrimaryParam, getStepParams, parseArgs } from './args'
import { defineConfig, loadConfig } from './config'
import { isCliEntry } from './is-cli-entry'
import { askStep } from './prompts'
import { runCommands } from './runner'
import { loadState, saveState } from './state'

export { defineConfig }
export type { ConfirmStep, HandleContext, RunOptions, RunResult, ScriptCliConfig, SelectStep, Step, StepParam, StepValue } from './types'

export async function main(argv = process.argv.slice(2)): Promise<number> {
  const cwd = process.cwd()
  const configArg = extractConfigArg(argv)
  if (hasHelpFlag(argv)) {
    try {
      const config = await loadConfig(cwd, configArg)
      printHelp(config)
    } catch {
      printHelp()
    }
    return 0
  }

  const config = await loadConfig(cwd, configArg)
  const state = loadState(cwd)
  const input = parseArgs(argv, config)
  const values = await resolveValues(config, input.values, state)
  saveState(cwd, values)
  const args = buildArgs(config, values)
  const context: HandleContext = {
    args,
    run: runCommands,
    spawn,
    values,
  }

  intro('scriptio')
  log.info(`参数：${args.join(' ') || '(无)'}`)
  try {
    const result = await config.handle(context)
    if (typeof result === 'string' || Array.isArray(result)) {
      await runCommands(result)
    }
    await config.success?.(context)
    outro('执行成功')
    return 0
  } catch (error) {
    await config.error?.(error, context)
    outro('执行失败')
    return (error as { exitCode?: number }).exitCode ?? 1
  } finally {
    await config.finally?.(context)
  }
}

async function resolveValues(
  config: ScriptCliConfig,
  provided: Record<string, StepValue>,
  state: Record<string, StepValue>,
): Promise<Record<string, StepValue>> {
  const interactive = Boolean(process.stdout.isTTY)
  const availableState = interactive
    ? state
    : {
      }
  const values: Record<string, StepValue> = {
  }
  const missing: string[] = []
  for (const step of config.steps) {
    const value = provided[step.key]
      ?? stateValue(step, availableState[step.key], config.defaultValues?.[step.key])
      ?? initialValue(step)
    if (value === undefined) {
      missing.push(`--${flagName(step)}`)
      continue
    }
    Reflect.set(values, step.key, value)
  }
  if (!interactive && missing.length > 0) {
    throw new Error(`非交互环境缺少参数：${missing.join('、')}`)
  }
  if (!interactive) {
    return values
  }
  for (const step of config.steps) {
    if (provided[step.key] !== undefined)
      continue
    const value = await askStep(step, values[step.key])
    Reflect.set(values, step.key, value)
  }
  return values
}

function stateValue(
  step: Step,
  state?: StepValue,
  fallback?: StepValue,
): StepValue | undefined {
  const value = state ?? fallback
  if (value === undefined) {
    return undefined
  }
  if (step.type === 'confirm') {
    return typeof value === 'boolean' ? value : undefined
  }
  return typeof value === 'string' && step.options.some(option => option.value === value)
    ? value
    : undefined
}

function initialValue(step: Step): StepValue | undefined {
  if (step.type === 'confirm') {
    return false
  }
  return step.options[0]?.value
}

function printHelp(config?: ScriptCliConfig) {
  colorOptions.enabled = supportsColor()

  const stepLines = !config || config.steps.length === 0
    ? [`  ${dim('Available after loading scriptio.config.ts')}`]
    : config.steps.map(step => formatStepHelpLine(step))

  // prettier-ignore
  const helpMessage = [
    `${bold('Usage:')} scriptio [OPTION]...`,
    '',
    dim('Run project tasks defined in scriptio.config.ts.'),
    dim('When running in TTY, the CLI will start in interactive mode.'),
    '',
    bold('Options:'),
    formatHelpLine('-C, --config PATH', 'use a specific config file'),
    formatHelpLine('-h, --help', 'display this help message'),
    '',
    bold('Step Options:'),
    ...stepLines,
  ].join('\n')

  process.stdout.write(`${helpMessage}\n`)
}

function flagName(step: Step): string {
  return getPrimaryParam(step)?.replace(/^-+/, '') ?? step.key
}

function formatParamLabel(step: Step): string {
  const params = getStepParams(step)
  if (params.length === 0) {
    return `--${step.key}`
  }
  return params.join(', ')
}

function formatHelpLine(flag: string, description: string): string {
  return `  ${cyan(flag.padEnd(34))}${description}`
}

function formatStepHelpLine(step: Step): string {
  const flag = step.type === 'select'
    ? `${formatParamLabel(step)} VALUE`
    : formatParamLabel(step)

  return formatHelpLine(flag, step.message)
}

function hasHelpFlag(argv: string[]): boolean {
  return argv.includes('--help') || argv.includes('-h')
}

function supportsColor(): boolean {
  return Boolean(process.stdout.isTTY)
    && !('NO_COLOR' in process.env)
    && process.env.FORCE_COLOR !== '0'
}

// pnpm 的 bin 通过符号链接启动，argv[1] 与 import.meta.url 未必同路径，
// 这里统一按真实路径比较，避免 CLI 被静默跳过。
if (isCliEntry(process.argv[1], import.meta.url)) {
  main().then(
    (code) => {
      process.exit(code)
    },
    (error: unknown) => {
      console.error(error instanceof Error ? error.message : error)
      process.exit(1)
    },
  )
}
