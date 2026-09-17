import process from 'node:process'
import { parseArgs } from './args'
import { loadConfig } from './config'
import { resolveEnv } from './env'
import { renderScriptTree } from './presentation'
import { selectScript } from './prompts'
import { runScript } from './runner'

export async function main(argv = process.argv.slice(2)): Promise<number> {
  const input = parseArgs(argv)
  const cwd = process.cwd()
  if (input.help) {
    process.stdout.write(await renderHelp(cwd, input.config, process.stdout.isTTY && !process.env.NO_COLOR))
    return 0
  }
  const config = await loadConfig(cwd, input.config)
  if (input.script === 'view') {
    process.stdout.write(renderScriptTree(config.scripts, {
      colors: process.stdout.isTTY && !process.env.NO_COLOR,
    }))
    return 0
  }
  let script = input.script
  if (script === undefined) {
    if (Object.keys(config.scripts).length === 0) {
      throw new Error('配置中没有可执行的 Script')
    }
    if (!process.stdin.isTTY || !process.stdout.isTTY) {
      throw new Error('非交互环境请指定 Script，例如 scriptio build:test')
    }
    script = await selectScript(config.scripts)
    if (script === undefined)
      return 130
  }
  if (!Object.hasOwn(config.scripts, script)) {
    throw new Error(`Unknown script "${script}".`)
  }
  return runScript(config.scripts[script].command, cwd, resolveEnv(script, config.env))
}

async function renderHelp(cwd: string, config: string | undefined, colors: boolean): Promise<string> {
  const lines = [
    'Usage: scriptio [script] [options]',
    '',
    '无参数时交互选择 Script；也可直接执行 scriptio build:test:sso。',
    '',
    'Commands:',
    '  scriptio view     按分组树形查看全部脚本和命令，不执行脚本',
    '',
    'Options:',
    '  -C, --config PATH  指定配置文件（默认 scriptio.config.ts）',
    '  -h, --help         显示帮助',
    '',
  ]
  try {
    const loaded = await loadConfig(cwd, config)
    if (Object.keys(loaded.scripts).length > 0) {
      lines.push('Available scripts:')
      lines.push(renderScriptTree(loaded.scripts, { colors }).replace(/^scripts\n/, ''))
    }
  } catch {}
  return lines.join('\n')
}
