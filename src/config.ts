import type { ResolvedScriptMap, UserConfig } from './types'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { createJiti } from 'jiti'
import { mergeScripts } from './scripts'

export function defineConfig<T extends UserConfig>(config: T): T {
  return config
}

export async function loadConfig(cwd: string, configArg?: string): Promise<Omit<UserConfig, 'scripts'> & { scripts: ResolvedScriptMap }> {
  const file = resolve(cwd, configArg ?? 'scriptio.config.ts')
  if (!existsSync(file)) {
    throw new Error(`未找到配置文件：${file}`)
  }
  try {
    const jiti = createJiti(import.meta.url, { moduleCache: false })
    const config = await jiti.import<UserConfig>(file, { default: true })
    if (!config || typeof config !== 'object') {
      throw new Error('必须默认导出包含 scripts 的配置对象')
    }
    // 仅在加载边界统一字符串和对象写法，执行与展示共用相同的最终定义。
    const scripts = Object.fromEntries(Object.entries(mergeScripts(config.scripts)).map(([name, script]) => [
      name,
      typeof script === 'string' ? { command: script } : script,
    ]))
    if (config.env !== undefined) {
      if (!config.env || typeof config.env !== 'object' || Array.isArray(config.env)) {
        throw new Error('env 必须是环境变量规则对象')
      }
      for (const [rule, env] of Object.entries(config.env)) {
        if (!rule.trim() || !env || typeof env !== 'object' || Array.isArray(env)
          || Object.values(env).some(value => value !== undefined && typeof value !== 'string')) {
          throw new Error(`非法 env 规则：${rule}`)
        }
      }
    }
    return { env: config.env, scripts }
  } catch (error) {
    throw new Error(`加载配置失败：${file}\n${error instanceof Error ? error.message : String(error)}`, { cause: error })
  }
}
