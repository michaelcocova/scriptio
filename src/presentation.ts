import type { ResolvedScriptMap } from './types'

export interface ScriptEntry {
  command: string
  label?: string
  name: string
  type: 'script'
}

export interface ScriptGroup {
  children: ScriptEntry[]
  name: string
  type: 'group'
}

export interface RenderScriptTreeOptions {
  colors?: boolean
}

const ansi = {
  blue: ['\x1B[34m', '\x1B[39m'],
  bold: ['\x1B[1m', '\x1B[22m'],
  cyan: ['\x1B[36m', '\x1B[39m'],
  gray: ['\x1B[90m', '\x1B[39m'],
} as const

function color(text: string, enabled: boolean, ...codes: Array<readonly [string, string]>): string {
  if (!enabled)
    return text
  return `${codes.map(code => code[0]).join('')}${text}${[...codes].reverse().map(code => code[1]).join('')}`
}

export function groupScripts(scripts: ResolvedScriptMap): (ScriptEntry | ScriptGroup)[] {
  const entries: (ScriptEntry | ScriptGroup)[] = []
  const groups = new Map<string, ScriptGroup>()
  // 只认显式 group；同名组合并到首次出现的位置，组内保持最终脚本的声明顺序。
  for (const [name, definition] of Object.entries(scripts)) {
    const script: ScriptEntry = { command: definition.command, label: definition.label, name, type: 'script' }
    if (definition.group === undefined) {
      entries.push(script)
      continue
    }
    let group = groups.get(definition.group)
    if (!group) {
      group = { children: [], name: definition.group, type: 'group' }
      groups.set(definition.group, group)
      entries.push(group)
    }
    group.children.push(script)
  }
  return entries
}

export function scriptLabel(script: ScriptEntry): string {
  return script.label === undefined ? script.name : `${script.label} (${script.name})`
}

function coloredScriptLabel(script: ScriptEntry, colors: boolean): string {
  if (script.label === undefined)
    return color(script.name, colors, ansi.bold, ansi.cyan)
  return [
    color(script.label, colors, ansi.bold),
    color(`(${script.name})`, colors, ansi.cyan),
  ].join(' ')
}

export function renderScriptTree(scripts: ResolvedScriptMap, options: RenderScriptTreeOptions = {}): string {
  const entries = groupScripts(scripts)
  if (entries.length === 0)
    return '配置中没有可查看的 Script\n'
  const colors = options.colors === true
  const lines = ['scripts']
  const appendScript = (script: ScriptEntry, prefix: string, last: boolean): void => {
    const continuation = `${prefix}${last ? '    ' : '│   '}`
    const commandLines = script.command.split(/\r?\n/)
    const branch = `${prefix}${last ? '└── ' : '├── '}`
    lines.push(`${color(branch, colors, ansi.gray)}${coloredScriptLabel(script, colors)}  ${color(commandLines[0], colors, ansi.gray)}`)
    for (const command of commandLines.slice(1)) {
      lines.push(`${color(continuation, colors, ansi.gray)}${color(command, colors, ansi.gray)}`)
    }
  }
  entries.forEach((entry, index) => {
    const last = index === entries.length - 1
    if (entry.type === 'script') {
      appendScript(entry, '', last)
    } else {
      lines.push(`${color(last ? '└── ' : '├── ', colors, ansi.gray)}${color(entry.name, colors, ansi.bold, ansi.blue)}`)
      entry.children.forEach((script, childIndex) => {
        appendScript(script, last ? '    ' : '│   ', childIndex === entry.children.length - 1)
      })
    }
  })
  return `${lines.join('\n')}\n`
}
