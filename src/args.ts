export interface ParsedArgs {
  config?: string
  help: boolean
  script?: string
}

export function parseArgs(argv: string[]): ParsedArgs {
  const result: ParsedArgs = { help: false }
  let positional = false
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i]
    if (!positional && token === '--') {
      positional = true
    } else if (!positional && (token === '-h' || token === '--help')) {
      result.help = true
    } else if (!positional && (token === '-C' || token === '--config' || token.startsWith('--config='))) {
      const value = token.startsWith('--config=') ? token.slice(9) : argv[++i]
      if (!value || value.startsWith('-')) {
        throw new Error('参数 --config 需要配置文件路径')
      }
      result.config = value
    } else if (!positional && token.startsWith('-')) {
      throw new Error(`无法识别的参数：${token}`)
    } else if (result.script !== undefined) {
      throw new Error('一次只能执行一个 Script')
    } else {
      result.script = token
    }
  }
  return result
}
