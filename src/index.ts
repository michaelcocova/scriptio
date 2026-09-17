#!/usr/bin/env node
import process from 'node:process'
import { main } from './cli'
import { isCliEntry } from './is-cli-entry'

export { defineConfig } from './config'
export { defineEnv } from './env'
export { defineScripts } from './scripts'
export type {
  EnvContext,
  MatrixContext,
  MatrixOptions,
  MatrixValues,
  MaybeFn,
  ResolvedScriptMap,
  ScriptCommand,
  ScriptConfig,
  ScriptDefinition,
  ScriptEnv,
  ScriptEnvConfig,
  ScriptioConfig,
  ScriptMap,
  ScriptsContext,
  UserConfig,
} from './types'

// 导入配置 API 不执行 CLI；符号链接安装的 bin 同样能够识别。
if (isCliEntry(process.argv[1], import.meta.url)) {
  main().then(
    (code) => {
      process.exitCode = code
    },
    (error: unknown) => {
      process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
      process.exitCode = 1
    },
  )
}
