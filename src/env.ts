import type { EnvContext, ScriptEnv, ScriptEnvConfig, UserConfig } from './types'
import process from 'node:process'
import picomatch from 'picomatch'

export function defineEnv(callback: (context: EnvContext) => ScriptEnvConfig[]): ScriptEnvConfig {
  const configs = callback({ each, env })
  if (!Array.isArray(configs)) {
    throw new TypeError('defineEnv callback 必须返回 Env Map 数组')
  }
  return mergeEnv(configs)
}

export function mergeEnv(input: ScriptEnvConfig | ScriptEnvConfig[]): ScriptEnvConfig {
  const result: ScriptEnvConfig = Object.create(null)
  for (const config of Array.isArray(input) ? input : [input]) {
    if (!config || typeof config !== 'object' || Array.isArray(config)) {
      throw new Error('env 必须是 Env Map 或 Env Map 数组')
    }
    for (const [pattern, variables] of Object.entries(config)) {
      validateEnvRule(pattern, variables)
      result[pattern] = variables
    }
  }
  return result
}

function env(pattern: string, variables: ScriptEnv): ScriptEnvConfig {
  validateEnvRule(pattern, variables)
  return { [pattern]: variables }
}

function each<const V extends readonly string[]>(
  values: V,
  pattern: string,
  variables: (value: V[number]) => ScriptEnv,
): ScriptEnvConfig {
  if (!Array.isArray(values) || values.length === 0 || values.some(value => typeof value !== 'string' || !value.length)) {
    throw new Error('env each values 必须是非空字符串数组')
  }
  if (typeof pattern !== 'string' || !pattern.trim() || !pattern.includes('{env}')) {
    throw new Error('env each pattern 必须包含 {env}')
  }
  if (typeof variables !== 'function') {
    throw new TypeError('env each callback 必须是函数')
  }

  const result: ScriptEnvConfig = Object.create(null)
  for (const value of values) {
    const rule = pattern.replaceAll('{env}', value)
    const ruleVariables = variables(value)
    validateEnvRule(rule, ruleVariables)
    if (Object.hasOwn(result, rule)) {
      throw new Error(`env each 重复生成 Pattern "${rule}"`)
    }
    result[rule] = ruleVariables
  }
  return result
}

function validateEnvRule(pattern: string, variables: unknown): asserts variables is ScriptEnv {
  if (typeof pattern !== 'string' || !pattern.trim()) {
    throw new Error('env pattern 必须是非空 string')
  }
  if (!variables || typeof variables !== 'object' || Array.isArray(variables)) {
    throw new Error(`env "${pattern}" 必须是环境变量对象`)
  }
  for (const [key, value] of Object.entries(variables)) {
    if (!key || (value !== undefined && typeof value !== 'string')) {
      throw new Error(`env "${pattern}" 的变量值必须是 string 或 undefined`)
    }
  }
}

// 只拆顶层逗号；花括号、字符类及 extglob 内的逗号交给 picomatch。
function splitPatterns(rule: string): string[] {
  const patterns: string[] = []
  const stack: string[] = []
  let start = 0
  for (let i = 0; i < rule.length; i++) {
    const char = rule[i]
    if (char === '\\') {
      i++
    } else if (stack.at(-1) === ']') {
      if (char === ']')
        stack.pop()
    } else if ('[{('.includes(char)) {
      stack.push(({ '(': ')', '[': ']', '{': '}' })[char]!)
    } else if (char === stack.at(-1)) {
      stack.pop()
    } else if (char === ',' && stack.length === 0) {
      patterns.push(rule.slice(start, i).trim())
      start = i + 1
    }
  }
  patterns.push(rule.slice(start).trim())
  if (patterns.some(pattern => !pattern || pattern === '!')) {
    throw new Error(`非法 env Pattern：${rule}`)
  }
  return patterns
}

export function resolveEnv(script: string, rules: UserConfig['env'], base: ScriptEnv = process.env): ScriptEnv {
  const env = { ...base }
  for (const [rule, variables] of Object.entries(rules ?? {})) {
    const includes: string[] = []
    const excludes: string[] = []
    for (const pattern of splitPatterns(rule)) {
      if (pattern.startsWith('!') && !pattern.startsWith('!(')) {
        excludes.push(pattern.slice(1))
      } else {
        includes.push(pattern)
      }
    }
    const matches = (pattern: string) => picomatch(pattern, { dot: true, nonegate: true })(script)
    if ((includes.length === 0 || includes.some(matches)) && !excludes.some(matches)) {
      // 不可排序规则：声明顺序决定覆盖结果，undefined 也会覆盖继承值。
      Object.assign(env, variables)
    }
  }
  for (const key of Object.keys(env)) {
    if (env[key] === undefined)
      delete env[key]
  }
  return env
}
