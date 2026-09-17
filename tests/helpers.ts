import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import process from 'node:process'

export const project = resolve(import.meta.dirname, '..')
export const cli = join(project, 'dist/index.mjs')

export function fixture(config: string): string {
  // 测试文件限定在当前项目 .temp 内，不触碰业务工程。
  mkdirSync(join(project, '.temp'), { recursive: true })
  const cwd = mkdtempSync(join(project, '.temp/test-'))
  writeFileSync(join(cwd, 'scriptio.config.ts'), config)
  return cwd
}

export function nodeCommand(file: string): string {
  return `${JSON.stringify(process.execPath)} ${JSON.stringify(file)}`
}
