import type { MatrixContext, MatrixOptions, MatrixValues, ScriptMap, ScriptsContext } from './types'

export function defineScripts(callback: (context: ScriptsContext) => ScriptMap[]): ScriptMap {
  const maps = callback({ matrix })
  if (!Array.isArray(maps)) {
    throw new TypeError('defineScripts callback 必须返回 Script Map 数组')
  }
  return mergeScripts(maps)
}

export function mergeScripts(input: ScriptMap | ScriptMap[]): ScriptMap {
  const result: ScriptMap = Object.create(null)
  for (const map of Array.isArray(input) ? input : [input]) {
    if (!map || typeof map !== 'object' || Array.isArray(map)) {
      throw new Error('scripts 必须是 Script Map 或 Script Map 数组')
    }
    for (const [name, command] of Object.entries(map)) {
      const definition = typeof command === 'string' ? { command } : command
      if (!name.trim() || !definition || typeof definition !== 'object' || Array.isArray(definition)
        || typeof definition.command !== 'string' || !definition.command.trim()) {
        throw new Error(`Script "${name}" 必须具有非空名称和 string command`)
      }
      for (const key of ['group', 'label'] as const) {
        if (definition[key] !== undefined && (typeof definition[key] !== 'string' || !definition[key].trim())) {
          throw new Error(`Script "${name}" 的 ${key} 必须是非空 string`)
        }
      }
      result[name] = command
    }
  }
  return result
}

function placeholders(template: string): string[] {
  if (typeof template !== 'string' || !template.trim() || /\$\{/.test(template)) {
    throw new Error(`非法 Template：${String(template)}，请使用 {variable}`)
  }
  const keys = [...template.matchAll(/\{([A-Z_]\w*)\}/gi)].map(match => match[1])
  if (/[{}]/.test(template.replace(/\{([A-Z_]\w*)\}/gi, ''))) {
    throw new Error(`非法 Template：${template}`)
  }
  return [...new Set(keys)]
}

function matrix<const V extends MatrixValues>(options: MatrixOptions<V>): ScriptMap {
  const { command, group, label, name, template, values } = options
  if (group !== undefined && (typeof group !== 'string' || !group.trim())) {
    throw new Error('matrix group 必须是非空 string')
  }
  if (!validMaybeString(name)) {
    throw new Error('matrix name 必须是非空 string 或返回非空 string 的函数')
  }
  if (label !== undefined && !validMaybeString(label)) {
    throw new Error('matrix label 必须是非空 string 或返回非空 string 的函数')
  }
  if (('command' in options) === ('template' in options)
    || (command !== undefined ? typeof command !== 'function' : typeof template !== 'string')) {
    throw new Error('matrix 必须且只能提供 command 或 template')
  }
  if (!values || typeof values !== 'object' || Array.isArray(values) || Object.keys(values).length === 0) {
    throw new Error('matrix values 不能为空')
  }
  for (const [key, items] of Object.entries(values)) {
    if (!/^[A-Z_]\w*$/i.test(key) || !Array.isArray(items) || items.length === 0
      || items.some(item => typeof item !== 'string' || !item.length)) {
      throw new Error(`matrix values.${key} 必须是非空字符串数组，变量名必须是合法标识符`)
    }
  }
  const nameKeys = typeof name === 'string' ? placeholders(name) : []
  const labelKeys = typeof label === 'string' ? placeholders(label) : []
  const commandKeys = template === undefined ? [] : placeholders(template)
  for (const key of [...nameKeys, ...labelKeys, ...commandKeys]) {
    if (!Object.hasOwn(values, key)) {
      throw new Error(`不存在 Matrix Variable "${key}"`)
    }
  }
  const scripts: ScriptMap = Object.create(null)
  const keys = Object.keys(values) as Array<keyof V & string>
  const context = Object.create(null) as MatrixContext<V>
  const expand = (index: number): void => {
    if (index < keys.length) {
      const key = keys[index]
      for (const value of values[key]) {
        Reflect.set(context, key, value)
        expand(index + 1)
      }
      return
    }
    const current = { ...context }
    const script = resolveMaybe(name, current, 'name')
    if (Object.hasOwn(scripts, script)) {
      throw new Error(`matrix 重复生成 Script Name "${script}"`)
    }
    const output = command ? command(current) : replaceTemplate(template!, current)
    if (typeof output !== 'string' || !output.trim()) {
      throw new Error(`matrix command 必须返回非空 string：${script}`)
    }
    const resolvedLabel = label === undefined ? undefined : resolveMaybe(label, current, 'label')
    if (group === undefined && resolvedLabel === undefined) {
      scripts[script] = output
    } else {
      scripts[script] = { command: output, ...(group === undefined ? {} : { group }), ...(resolvedLabel === undefined ? {} : { label: resolvedLabel }) }
    }
  }
  expand(0)
  return scripts
}

function validMaybeString<V extends MatrixValues>(value: unknown): value is MatrixOptions<V>['name'] {
  return typeof value === 'function' || (typeof value === 'string' && value.trim().length > 0)
}

function replaceTemplate<V extends MatrixValues>(template: string, context: MatrixContext<V>): string {
  return template.replace(/\{([A-Z_]\w*)\}/gi, (_, key: string) => String(context[key]))
}

function resolveMaybe<V extends MatrixValues>(
  value: string | ((context: MatrixContext<V>) => string),
  context: MatrixContext<V>,
  key: 'label' | 'name',
): string {
  const resolved = typeof value === 'function' ? value(context) : replaceTemplate(value, context)
  if (typeof resolved !== 'string' || !resolved.trim()) {
    throw new Error(`matrix ${key} 必须返回非空 string`)
  }
  return resolved
}
