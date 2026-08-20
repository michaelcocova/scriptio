import type { ScriptCliConfig, Step, StepValue } from './types'

export interface ParsedArgs {
  config?: string
  help: boolean
  values: Record<string, StepValue>
}

export function parseArgs(argv: string[], config: ScriptCliConfig): ParsedArgs {
  const aliases = new Map<string, Step>()
  for (const step of config.steps) {
    aliases.set(step.key, step)
    for (const param of getStepParams(step)) {
      aliases.set(param.replace(/^-+/, ''), step)
    }
  }

  const values: Record<string, StepValue> = {
  }
  let help = false
  let configPath: string | undefined

  for (let i = 0; i < argv.length; i++) {
    const token = argv[i]
    if (token === '-C' || token === '--config') {
      configPath = argv[i + 1]
      if (!configPath) {
        throw new Error('参数 --config 需要值')
      }
      i++
      continue
    }
    if (token.startsWith('--config=')) {
      configPath = token.slice('--config='.length)
      continue
    }
    if (token === '--help' || token === '-h') {
      help = true
      continue
    }
    if (!token.startsWith('-')) {
      throw new Error(`无法识别的参数：${token}`)
    }

    const eq = token.indexOf('=')
    const name = eq === -1
      ? token.replace(/^-+/, '')
      : token.slice(0, eq).replace(/^-+/, '')
    const step = aliases.get(name)
    if (!step) {
      throw new Error(`无法识别的参数：${token.startsWith('--') ? `--${name}` : `-${name}`}`)
    }

    if (step.type === 'confirm') {
      const raw = eq === -1 ? undefined : token.slice(eq + 1)
      if (raw !== undefined && raw !== 'true' && raw !== 'false') {
        throw new Error(`参数 --${name} 只接受 true / false`)
      }
      values[step.key] = raw === undefined ? true : raw === 'true'
      continue
    }

    const value = eq === -1 ? argv[i + 1] : token.slice(eq + 1)
    if (value === undefined || !step.options.some(option => option.value === value)) {
      throw new Error(`参数 --${name} 的值无效：${value ?? '(缺失)'}`)
    }
    values[step.key] = value
    if (eq === -1) {
      i++
    }
  }

  return {
    config: configPath,
    help,
    values,
  }
}

export function extractConfigArg(argv: string[]): string | undefined {
  let config: string | undefined
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i]
    if (token === '-C' || token === '--config') {
      config = argv[i + 1]
      i++
    } else if (token.startsWith('--config=')) {
      config = token.slice('--config='.length)
    }
  }
  return config
}

export function buildArgs(
  config: ScriptCliConfig,
  values: Record<string, StepValue>,
): string[] {
  const args: string[] = []
  for (const step of config.steps) {
    const param = getPrimaryParam(step)
    if (!param) {
      continue
    }
    const value = values[step.key]
    if (typeof value === 'boolean') {
      if (value) {
        args.push(param)
      }
    } else {
      args.push(param, value)
    }
  }
  return args
}

export function getPrimaryParam(step: Step): string | undefined {
  if (!step.param) {
    return undefined
  }
  return Array.isArray(step.param) ? step.param[0] : step.param
}

export function getStepParams(step: Step): string[] {
  if (!step.param) {
    return []
  }
  return Array.isArray(step.param) ? step.param : [step.param]
}
