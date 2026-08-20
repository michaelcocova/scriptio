#!/usr/bin/env node
import type { HandleContext, ScriptCliConfig, Step, StepValue } from './types'
import { spawn } from 'node:child_process'
import process from 'node:process'
import { intro, log, outro } from '@clack/prompts'
import { buildArgs, extractConfigArg, getPrimaryParam, getStepParams, parseArgs } from './args'
import { defineConfig, loadConfig } from './config'
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
  const stepLines = config
    ? config.steps
        .map(step => `  ${formatParamLabel(step)} <${step.type === 'select' ? 'value' : 'true|false'}>  ${step.message}`)
        .join('\n')
    : '  (加载配置文件后显示 step 参数)'
  console.log(`用法：scriptio [参数]
步骤参数：
${stepLines}
通用选项：
  -C, --config <path>  指定配置文件（默认 scriptio.config.ts）
  -h, --help  显示帮助`)
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

function hasHelpFlag(argv: string[]): boolean {
  return argv.includes('--help') || argv.includes('-h')
}

if (import.meta.url === `file://${process.argv[1]}`) {
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
