import type { ScriptCliConfig } from './types'
import { existsSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { createJiti } from 'jiti'

export function defineConfig<T extends ScriptCliConfig>(config: T): T {
  return config
}

const configNames = ['scriptio.config.ts', 'scriptio.config.mts', 'scriptio.config.js']

export async function loadConfig(cwd: string, configArg?: string): Promise<ScriptCliConfig> {
  const file = configArg
    ? resolve(cwd, configArg)
    : configNames.map(name => join(cwd, name)).find(existsSync)
  if (!file || !existsSync(file)) {
    throw new Error(
      configArg
        ? `未找到配置文件：${file}`
        : '未找到配置文件，请在项目根目录创建 scriptio.config.ts 或通过 --config 指定',
    )
  }

  const jiti = createJiti(import.meta.url)
  const config = await jiti.import(file, {
    default: true,
  })
  if (
    !config
    || typeof config !== 'object'
    || !Array.isArray((config as ScriptCliConfig).steps)
    || typeof (config as ScriptCliConfig).handle !== 'function'
  ) {
    throw new Error(`${file} 必须通过 defineConfig 导出 steps 和 handle`)
  }
  return config as ScriptCliConfig
}
