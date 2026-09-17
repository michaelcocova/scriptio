import type { ResolvedScriptMap } from '../src/types'
import process from 'node:process'
import { autocomplete, isCancel } from '@clack/prompts'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { main } from '../src/cli'
import { selectScript } from '../src/prompts'
import { runScript } from '../src/runner'
import { fixture } from './helpers'

vi.mock('@clack/prompts', () => ({ autocomplete: vi.fn(), cancel: vi.fn(), isCancel: vi.fn() }))
vi.mock('../src/runner', () => ({ runScript: vi.fn().mockResolvedValue(0) }))

beforeEach(() => {
  vi.mocked(autocomplete).mockReset()
  vi.mocked(runScript).mockClear()
  vi.mocked(isCancel).mockImplementation((value): value is symbol => typeof value === 'symbol')
})

function choose(...labels: string[]): void {
  for (const label of labels) {
    vi.mocked(autocomplete).mockImplementationOnce(async ({ options }) => {
      if (typeof options === 'function')
        throw new Error('预期静态分组选项')
      const option = options.find(option => option.label === label)
      expect(option, `缺少选项：${label}`).toBeDefined()
      return option!.value
    })
  }
}

it.each([false, true])('字符串和对象脚本均能交互、直接执行并取消（group=%s）', async (grouped) => {
  const stdin = Object.getOwnPropertyDescriptor(process.stdin, 'isTTY')
  const stdout = Object.getOwnPropertyDescriptor(process.stdout, 'isTTY')
  Object.defineProperty(process.stdin, 'isTTY', { configurable: true, value: true })
  Object.defineProperty(process.stdout, 'isTTY', { configurable: true, value: true })
  try {
    const scripts = grouped
      ? { 'build:test': { command: 'echo all', group: 'build' }, 'build:test:sso': { command: 'echo sso', group: 'build', label: '单点登录' } }
      : { 'build:test': 'echo all', 'build:test:sso': 'echo sso' }
    const cwd = fixture(`export default ${JSON.stringify({ scripts })}`)
    vi.spyOn(process, 'cwd').mockReturnValue(cwd)
    if (grouped)
      choose('build', '单点登录 (build:test:sso)')
    else choose('build:test:sso')
    expect(await main([])).toBe(0)
    expect(runScript).toHaveBeenCalledWith('echo sso', cwd, expect.any(Object))
    vi.mocked(autocomplete).mockClear()
    expect(await main(['build:test'])).toBe(0)
    expect(runScript).toHaveBeenLastCalledWith('echo all', cwd, expect.any(Object))
    expect(autocomplete).not.toHaveBeenCalled()
    vi.mocked(autocomplete).mockResolvedValueOnce(Symbol('cancel'))
    vi.mocked(runScript).mockClear()
    expect(await main([])).toBe(130)
    expect(runScript).not.toHaveBeenCalled()
  } finally {
    vi.restoreAllMocks()
    if (stdin)
      Object.defineProperty(process.stdin, 'isTTY', stdin)
    else Reflect.deleteProperty(process.stdin, 'isTTY')
    if (stdout)
      Object.defineProperty(process.stdout, 'isTTY', stdout)
    else Reflect.deleteProperty(process.stdout, 'isTTY')
  }
})

describe('显式分组', () => {
  const scripts: ResolvedScriptMap = Object.fromEntries([
    ['dev', { command: 'echo default', group: 'dev' }],
    ['dev:test', { command: 'echo all', group: 'dev' }],
    ['dev:test:sso', { command: 'echo sso', group: 'dev', label: '单点登录' }],
    ['dev:docs', { command: 'echo docs' }],
    ['build:packages', { command: 'echo packages', group: 'build', label: '构建组件包' }],
    ['lint', { command: 'echo lint' }],
  ])

  it('首层只显示显式组与未分组脚本，组内直接显示脚本', async () => {
    choose('dev', '单点登录 (dev:test:sso)')
    expect(await selectScript(scripts)).toBe('dev:test:sso')
    const menus = vi.mocked(autocomplete).mock.calls.map(([{ options }]) => {
      if (typeof options === 'function')
        throw new Error('预期静态分组选项')
      return options.map(option => option.label)
    })
    expect(menus).toEqual([
      ['dev', 'dev:docs', 'build', 'lint'],
      ['dev', 'dev:test', '单点登录 (dev:test:sso)', '← 返回上一级'],
    ])
  })

  it.each([
    [['dev', 'dev'], 'dev'],
    [['dev', 'dev:test'], 'dev:test'],
    [['build', '构建组件包 (build:packages)'], 'build:packages'],
    [['dev', '← 返回上一级', 'lint'], 'lint'],
    [['dev:docs'], 'dev:docs'],
  ])('选择路径 %j 对应原始脚本名', async (path, script) => {
    choose(...path)
    expect(await selectScript(scripts)).toBe(script)
  })

  it('组内可取消，不执行任何脚本', async () => {
    choose('dev')
    vi.mocked(autocomplete).mockResolvedValueOnce(Symbol('cancel'))
    expect(await selectScript(scripts)).toBeUndefined()
    expect(autocomplete).toHaveBeenCalledTimes(2)
  })
})
