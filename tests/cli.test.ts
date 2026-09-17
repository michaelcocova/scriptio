import { spawn, spawnSync } from 'node:child_process'
import { chmodSync, existsSync, mkdirSync, readFileSync, symlinkSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import process from 'node:process'
import { pathToFileURL } from 'node:url'
import { describe, expect, it } from 'vitest'
import { loadConfig } from '../src/config'
import { isCliEntry } from '../src/is-cli-entry'
import { cli, fixture, nodeCommand, project } from './helpers'

const importAPI = `import { defineConfig, defineScripts } from ${JSON.stringify(cli)}\n`

function run(cwd: string, args: string[] = []) {
  return spawnSync(process.execPath, [cli, ...args], { cwd, encoding: 'utf8', timeout: 10000 })
}

describe('真实 CLI / TypeScript 配置', () => {
  it('查看所有生成和覆盖后的命令，不执行脚本，支持自定义配置', () => {
    const cwd = fixture('throw new Error("必须使用指定配置")')
    writeFileSync(join(cwd, 'custom.ts'), importAPI + [
      'export default defineConfig({ scripts: defineScripts(({ matrix }) => [',
      'matrix({ group: "build", name: "build:{env}", values: { env: ["test"] }, template: "node fail.cjs {env}" }),',
      'matrix({ group: "build", name: "build:{env}:{app}", values: { env: ["test"], app: ["sso"] }, template: "node fail.cjs {env}" }),',
      '{ "build:test:sso": { group: "release", label: "单点登录", command: "node fail.cjs sso" }, lint: "node fail.cjs lint", view: "node fail.cjs view" },',
      ']) })',
    ].join('\n'))
    writeFileSync(join(cwd, 'fail.cjs'), 'require("node:fs").writeFileSync("executed", "yes"); process.exit(7)')
    const result = run(cwd, ['view', '--config', 'custom.ts'])
    expect(result.status, result.stderr).toBe(0)
    expect(result.stdout).toBe([
      'scripts',
      '├── build',
      '│   └── build:test  node fail.cjs test',
      '├── release',
      '│   └── 单点登录 (build:test:sso)  node fail.cjs sso',
      '├── lint  node fail.cjs lint',
      '└── view  node fail.cjs view',
      '',
    ].join('\n'))
    expect(existsSync(join(cwd, 'executed'))).toBe(false)
  })

  it('查看空配置给出提示，加载失败仍返回非零退出码', () => {
    const empty = run(fixture('export default { scripts: {} }'), ['view'])
    expect(empty.status).toBe(0)
    expect(empty.stdout).toContain('没有可查看的 Script')
    const invalid = run(fixture('throw new Error("view-config-error")'), ['view'])
    expect(invalid.status).toBe(1)
    expect(invalid.stderr).toContain('view-config-error')
  })

  it('rEADME 推荐配置生成精确的全部应用和单应用命令', async () => {
    // README 示例独立加载，避免开发者调整本地配置后导致固定断言失效。
    const readme = readFileSync(join(project, 'README.md'), 'utf8')
    const example = readme.split('## 完整示例')[1].split('```ts\n')[1].split('```')[0]
    const cwd = fixture(example.replace('from \'scriptio\'', `from ${JSON.stringify(cli)}`))
    const { scripts } = await loadConfig(cwd)
    expect(scripts['build:test'].command).toBe('turbo run build:test --filter="./apps/*"')
    expect(scripts['build:test:sso'].command).toBe('turbo run build:test --filter=@onecells/sso')
    expect(scripts['dev:sso'].command).toBe('turbo watch dev --filter=@onecells/sso')
  })

  it('直接调用时能够找到项目本地 bin', () => {
    const cwd = fixture('export default { scripts: { local: "scriptio-local-check" } }')
    const binDir = join(cwd, 'node_modules', '.bin')
    mkdirSync(binDir, { recursive: true })
    const windows = process.platform === 'win32'
    const bin = join(binDir, `scriptio-local-check${windows ? '.cmd' : ''}`)
    writeFileSync(bin, windows ? '@echo local-bin-ok\r\n' : '#!/bin/sh\necho local-bin-ok\n')
    if (!windows)
      chmodSync(bin, 0o755)
    const result = run(cwd, ['local'])
    expect(result.status, result.stderr).toBe(0)
    expect(result.stdout.trim()).toBe('local-bin-ok')
  })

  it('执行两个 build 名称，保留 stdout/stderr/ANSI/回车，注入及删除 env', async () => {
    const cwd = fixture(importAPI + [
      'const apps = [\'sso\', \'admin\'] as const',
      'export default defineConfig({',
      'env: { \'*\': { REMOVE_ME: \'old\' }, \'build:*,!build:packages\': { NODE_OPTIONS: \'--max-old-space-size=8192\', KEEP: \'space value\', REMOVE_ME: undefined } },',
      'scripts: defineScripts(({ matrix }) => [',
      'matrix({',
      'group: "build",',
      'name: \'build:{env}\',',
      'values: { env: [\'test\'] },',
      'command: ({ env }) => \'node child.mjs \' + env + \' all\',',
      '}),',
      'matrix({',
      'group: "build",',
      'name: \'build:{env}:{app}\',',
      'values: { app: apps, env: [\'test\'] },',
      'command: ({ app, env }) => \'node child.mjs \' + env + \' \' + app,',
      '}), { "build:test:sso": { group: "tools", label: "单点登录", command: "node child.mjs test sso" } }]),',
      '})',
    ].join('\n'))
    writeFileSync(join(cwd, 'child.mjs'), [
      'import process from \'node:process\'',
      'process.stdout.write(\'\\x1b[32mprogress\\rready\\x1b[0m\\n\')',
      'process.stderr.write(\'stderr-line\\n\')',
      'console.log(JSON.stringify({ args: process.argv.slice(2), options: process.env.NODE_OPTIONS, keep: process.env.KEEP, removed: \'REMOVE_ME\' in process.env }))',
    ].join('\n'))
    for (const [name, app] of [['build:test', 'all'], ['build:test:sso', 'sso']]) {
      const result = run(cwd, [name])
      expect(result.status, result.stderr).toBe(0)
      expect(result.stdout).toContain('\x1B[32mprogress\rready\x1B[0m')
      expect(result.stderr).toBe('stderr-line\n')
      expect(JSON.parse(result.stdout.trim().split('\n').at(-1)!)).toEqual({
        args: ['test', app],
        keep: 'space value',
        options: '--max-old-space-size=8192',
        removed: false,
      })
    }
    expect(Object.keys((await loadConfig(cwd)).scripts)).toHaveLength(3)
    expect(existsSync(join(cwd, '.scriptio'))).toBe(false)
  })

  it('执行普通 maps，传递非零退出码及 shell 语法', () => {
    const cwd = fixture('export default { scripts: [{ plain: "node ok.cjs && node fail.cjs" }] }')
    writeFileSync(join(cwd, 'ok.cjs'), 'console.log("ordinary-script")')
    writeFileSync(join(cwd, 'fail.cjs'), 'process.exit(7)')
    const result = run(cwd, ['plain'])
    expect(result.stdout).toBe('ordinary-script\n')
    expect(result.status).toBe(7)
  })

  it('未知脚本包括原型属性均失败；无 TTY 不隐式执行', () => {
    const cwd = fixture('export default { scripts: { build: "node -v" } }')
    for (const name of ['build:foo', 'toString', 'constructor']) {
      const result = run(cwd, [name])
      expect(result.status).toBe(1)
      expect(result.stderr).toContain(`Unknown script "${name}".`)
    }
    const result = run(cwd)
    expect(result.stderr).toContain('非交互环境请指定 Script')
    expect(result.status).toBe(1)
  })

  it('帮助无需配置，配置错误包含文件和原因', async () => {
    const cwd = fixture('throw new Error("configuration-boom")')
    const help = run(cwd, ['--help'])
    expect(help.status).toBe(0)
    expect(help.stdout).toContain('scriptio [script]')
    expect(help.stdout).not.toContain('Available scripts:')
    const result = run(cwd, ['build'])
    expect(result.status).toBe(1)
    expect(result.stderr).toContain(join(cwd, 'scriptio.config.ts'))
    expect(result.stderr).toContain('configuration-boom')
    await expect(loadConfig(cwd, 'missing.ts')).rejects.toThrow('missing.ts')
    writeFileSync(join(cwd, 'custom.ts'), 'export default { scripts: { build: "node -v" } }')
    expect(run(cwd, ['build', '--config', 'custom.ts']).status).toBe(0)
  })

  it('帮助在配置可用时列出生成的 scripts', () => {
    const cwd = fixture(importAPI + [
      'export default defineConfig({ scripts: defineScripts(({ matrix }) => [',
      'matrix({ group: "build", name: "build:{env}", values: { env: ["test"] }, template: "node build.cjs {env}" }),',
      '{ "build:packages": { command: "node packages.cjs", group: "build", label: "构建组件包" }, lint: "eslint ." },',
      ']) })',
    ].join('\n'))
    const result = run(cwd, ['--help'])
    expect(result.status, result.stderr).toBe(0)
    expect(result.stdout).toContain('Available scripts:')
    expect(result.stdout).toContain('├── build')
    expect(result.stdout).toContain('│   ├── build:test  node build.cjs test')
    expect(result.stdout).toContain('│   └── 构建组件包 (build:packages)  node packages.cjs')
    expect(result.stdout).toContain('└── lint  eslint .')
  })

  it.each([
    ['export default {}', 'scripts'],
    ['export default { scripts: { build: () => "wrong" } }', 'string'],
    ['export default { scripts: {}, env: { "*": { KEY: 42 } } }', 'env'],
    ['export default { scripts: { build: { command: "echo ok", group: true } } }', 'group'],
    ['export default { scripts: { build: { command: "echo ok", label: "" } } }', 'label'],
    ['export default { scripts: { build: { label: "构建" } } }', 'string'],
  ])('拒绝非法配置', async (config, message) => {
    await expect(loadConfig(fixture(config))).rejects.toThrow(message)
  })

  it.skipIf(process.platform === 'win32')('从符号链接启动 CLI', () => {
    const cwd = fixture('export default { scripts: { build: "node -v" } }')
    const bin = join(cwd, 'scriptio')
    symlinkSync(cli, bin)
    expect(isCliEntry(bin, pathToFileURL(cli).href)).toBe(true)
    expect(isCliEntry(undefined, pathToFileURL(cli).href)).toBe(false)
    const result = spawnSync(process.execPath, [bin, 'build'], { cwd, encoding: 'utf8' })
    expect(result.status, result.stderr).toBe(0)
    expect(result.stdout).toMatch(/^v\d/)
  })
})

describe.skipIf(process.platform === 'win32')('pOSIX 进程生命周期', () => {
  it.each(['SIGINT', 'SIGTERM'] as const)('转发 %s 并清理拒绝退出的孙进程', async (signal) => {
    const cwd = fixture('')
    writeFileSync(join(cwd, 'stubborn.cjs'), [
      'const fs = require(\'node:fs\')',
      'process.on(\'SIGINT\', () => fs.writeFileSync(\'received-SIGINT\', \'yes\'))',
      'process.on(\'SIGTERM\', () => fs.writeFileSync(\'received-SIGTERM\', \'yes\'))',
      'fs.writeFileSync(\'descendant.pid\', String(process.pid))',
      'setInterval(() => {}, 1000)',
    ].join('\n'))
    writeFileSync(join(cwd, 'parent.cjs'), [
      'const { spawn } = require(\'node:child_process\')',
      'spawn(process.execPath, [\'stubborn.cjs\'], { stdio: \'inherit\' })',
      'setInterval(() => {}, 1000)',
    ].join('\n'))
    writeFileSync(join(cwd, 'scriptio.config.ts'), `export default { scripts: { dev: ${JSON.stringify(nodeCommand('parent.cjs'))} } }`)
    const child = spawn(process.execPath, [cli, 'dev'], { cwd, stdio: 'ignore' })
    const closed = new Promise<number | null>((resolve, reject) => {
      child.once('error', reject)
      child.once('close', code => resolve(code))
    })
    let pid: number | undefined
    try {
      await expect.poll(() => existsSync(join(cwd, 'descendant.pid')), { timeout: 5000 }).toBe(true)
      pid = Number(readFileSync(join(cwd, 'descendant.pid'), 'utf8'))
      child.kill(signal)
      expect(await closed).toBe(signal === 'SIGINT' ? 130 : 143)
      expect(existsSync(join(cwd, `received-${signal}`))).toBe(true)
      await expect.poll(() => {
        try {
          process.kill(pid!, 0)
          return true
        } catch {
          return false
        }
      }, { timeout: 5000 }).toBe(false)
    } finally {
      child.kill('SIGKILL')
      if (pid) {
        try {
          process.kill(pid, 'SIGKILL')
        } catch {}
      }
    }
  }, 15000)
})
