import type {
  EnvContext,
  MatrixOptions,
  MatrixValues,
  ScriptConfig,
  ScriptEnv,
  ScriptEnvConfig,
  ScriptioConfig,
  ScriptMap,
} from '../src/index'
import { describe, expect, expectTypeOf, it } from 'vitest'
import { parseArgs } from '../src/args'
import { resolveEnv } from '../src/env'
import * as api from '../src/index'
import { defineConfig, defineEnv, defineScripts } from '../src/index'
import { mergeScripts } from '../src/scripts'

describe('v1 public API', () => {
  it('只导出必要运行时 API；defineConfig 不执行脚本', () => {
    expect(Object.keys(api).sort()).toEqual(['defineConfig', 'defineEnv', 'defineScripts'])
    const config = { scripts: { build: 'never-execute-this' } }
    expect(defineConfig(config)).toBe(config)
  })
  it('导出配置文件需要显式标注的类型', () => {
    type RuntimeKeys = keyof typeof api
    expectTypeOf<RuntimeKeys>().toEqualTypeOf<'defineConfig' | 'defineEnv' | 'defineScripts'>()

    const env: ScriptEnv = { NODE_ENV: 'test' }
    const envConfig: ScriptEnvConfig = { 'build:*': env }
    const scripts: ScriptConfig = { build: 'vite build' }
    const config: ScriptioConfig = { env: envConfig, scripts }
    expect(defineConfig(config)).toBe(config)

    expectTypeOf<EnvContext['env']>().parameter(0).toEqualTypeOf<string>()
  })
  it('按声明顺序合并 maps，后者覆盖前者', () => {
    const maps: ScriptMap[] = [{ build: 'build', lint: 'old' }, { lint: 'new' }]
    expect(mergeScripts(maps)).toEqual({ build: 'build', lint: 'new' })
    expect(defineScripts(() => maps)).toEqual(mergeScripts(maps))
    expect(() => mergeScripts({ build: 1 } as never)).toThrow('string')
    expect(() => defineScripts(() => ({ build: 'x' }) as never)).toThrow('数组')
  })
  it('支持与 Object 原型同名的 scripts', () => {
    expect(Reflect.get(mergeScripts(JSON.parse('{"__proto__":"ok","constructor":"ctor"}')), '__proto__')).toBe('ok')
  })
})

describe('matrix', () => {
  it('为不同 matrix 保留同名组，覆盖时替换完整脚本定义', () => {
    const scripts = defineScripts(({ matrix }) => [
      matrix({ group: 'dev', name: 'dev:{app}', template: 'dev {app}', values: { app: ['sso'] } }),
      matrix({ group: 'dev', name: 'dev:{env}', template: 'dev {env}', values: { env: ['test'] } }),
      { 'dev:test': { command: 'custom', group: 'tools', label: '自定义' } },
    ])
    expect(scripts).toEqual({
      'dev:sso': { command: 'dev sso', group: 'dev' },
      'dev:test': { command: 'custom', group: 'tools', label: '自定义' },
    })
    expect(mergeScripts([scripts, { 'dev:test': 'plain' }])['dev:test']).toBe('plain')
  })
  it('展开 name 函数，推导字面量类型，并支持 label 函数', () => {
    const calls: unknown[] = []
    const scripts = defineScripts(({ matrix }) => [
      matrix({
        command: (context) => {
          expectTypeOf(context.app).toEqualTypeOf<'admin' | 'sso'>()
          expectTypeOf(context.env).toEqualTypeOf<'dev' | 'test'>()
          calls.push(context)
          return `build ${context.env} ${context.app}`
        },
        label: values => `${values.env} / ${values.app}`,
        name: values => `build:${values.env}:${values.app}`,
        // env 放在 app 前面，用声明顺序验证 matrix 的生成顺序。
        values: {
          env: ['dev', 'test'],
          // eslint-disable-next-line perfectionist/sort-objects
          app: ['admin', 'sso'],
        },
      }),
    ])
    expect(Object.keys(scripts)).toEqual([
      'build:dev:admin',
      'build:dev:sso',
      'build:test:admin',
      'build:test:sso',
    ])
    expect(calls).toHaveLength(4)
    expect(calls[0]).toEqual({ app: 'admin', env: 'dev' })
    expect(scripts['build:test:sso']).toEqual({ command: 'build test sso', label: 'test / sso' })
  })
  it('替换 template 和重复占位符，允许 maps 之间覆盖', () => {
    expect(defineScripts(({ matrix }) => [
      matrix({ name: '{env}:{env}', template: 'echo {env} {env}', values: { env: ['test'] } }),
      { 'test:test': 'override' },
    ])).toEqual({ 'test:test': 'override' })
    expect(defineScripts(({ matrix }) => [
      matrix({ name: 'build:{env}:{app}', template: 'build {env} --app {app}', values: { app: ['sso'], env: ['test'] } }),
    ])['build:test:sso']).toBe('build test --app sso')
  })
  it.each([
    [{ group: '', name: 'build:{env}', template: 'echo ok', values: { env: ['test'] } }, 'group'],
    [{ name: '', template: 'echo ok', values: { env: ['test'] } }, 'name'],
    [{ name: 'build:{missing}', template: 'echo ok', values: { env: ['test'] } }, '不存在 Matrix Variable'],
    [{ name: 'build:{env}', template: 'echo {missing}', values: { env: ['test'] } }, '不存在 Matrix Variable'],
    [{ name: 'build:{env}', template: 'echo ok', values: {} }, 'values 不能为空'],
    [{ name: 'build:{env}', template: 'echo ok', values: { env: [] } }, '非空字符串数组'],
    [{ name: 'build', template: 'echo ok', values: { env: ['test', 'pre'] } }, '重复生成'],
    [{ name: () => 'build', template: 'echo ok', values: { env: ['test', 'pre'] } }, '重复生成'],
    [{ name: 'build:{env', template: 'echo ok', values: { env: ['test'] } }, '非法 Template'],
    [{ name: 'build:$' + '{env}', template: 'echo ok', values: { env: ['test'] } }, '非法 Template'],
    [{ name: 'build:{env}', template: 'echo $' + '{env}', values: { env: ['test'] } }, '非法 Template'],
    [{ command: (): string => 'ok', name: 'build:{env}', template: 'echo ok', values: { env: ['test'] } }, '只能提供'],
    [{ name: 'build:{env}', values: { env: ['test'] } }, '只能提供'],
    [{ command: (): number => 1, name: 'build:{env}', values: { env: ['test'] } }, 'string'],
  ])('拒绝非法 matrix：%j', (options, message) => {
    expect(() => defineScripts(({ matrix }) => [matrix(options as MatrixOptions<MatrixValues>)])).toThrow(message)
  })
  it('typeScript 约束 command/template XOR', () => {
    const values = { env: ['test'] } as const
    // @ts-expect-error 两者同时存在必须报错
    const both: MatrixOptions<typeof values> = { command: () => 'x', name: '{env}', template: 'x', values }
    // @ts-expect-error 两者都不提供必须报错
    const neither: MatrixOptions<typeof values> = { name: '{env}', values }
    expect(both).toBeDefined()
    expect(neither).toBeDefined()
  })
})

describe('env', () => {
  it('defineEnv 支持 env 和 each，并保留 each value 类型', () => {
    const envs = ['dev', 'test'] as const
    const config = defineEnv(({ each, env }) => [
      env('start', {
        NODE_ENV: 'development',
      }),

      each(envs, 'start:{env}', (value) => {
        expectTypeOf(value).toEqualTypeOf<'dev' | 'test'>()
        return {
          NODE_ENV: value === 'dev' ? 'development' : value,
        }
      }),

      env('build:*', {
        NODE_OPTIONS: '--max-old-space-size=8192',
      }),
    ])

    expect(config).toEqual({
      'build:*': {
        NODE_OPTIONS: '--max-old-space-size=8192',
      },
      'start': {
        NODE_ENV: 'development',
      },
      'start:dev': {
        NODE_ENV: 'development',
      },
      'start:test': {
        NODE_ENV: 'test',
      },
    })
  })

  it('拒绝非法 defineEnv 配置', () => {
    expect(() => defineEnv(() => ({ start: { NODE_ENV: 'development' } }) as never)).toThrow('数组')
    expect(() => defineEnv(({ env }) => [env('', { NODE_ENV: 'development' })])).toThrow('pattern')
    expect(() => defineEnv(({ env }) => [env('start', { NODE_ENV: 1 } as never)])).toThrow('变量值')
    expect(() => defineEnv(({ each }) => [each([], 'start:{env}', () => ({ NODE_ENV: 'development' }))])).toThrow('非空字符串数组')
    expect(() => defineEnv(({ each }) => [each(['dev'], 'start', () => ({ NODE_ENV: 'development' }))])).toThrow('{env}')
  })

  it.each(['build:test', 'build:test:sso', 'build:release', 'build:release:website', 'build:dev', 'build:six'])('匹配 %s', (name) => {
    expect(resolveEnv(name, { 'build:*,!build:packages': { NODE_OPTIONS: '8192' } }, {})).toEqual({ NODE_OPTIONS: '8192' })
  })
  it.each(['build:packages', 'dev'])('排除 %s', (name) => {
    expect(resolveEnv(name, { 'build:*,!build:packages': { NODE_OPTIONS: '8192' } }, {})).toEqual({})
  })
  it('保持声明顺序并删除 undefined 环境变量', () => {
    const rules = Object.fromEntries([
      ['*', { DEBUG: 'true', NODE_ENV: 'development' }],
      ['build:*', { NODE_OPTIONS: '8192' }],
      ['build:release', { DEBUG: undefined, INHERITED: undefined, NODE_ENV: 'production' }],
    ])
    const base = { INHERITED: 'old', KEEP: 'yes' }
    expect(resolveEnv('build:release', rules, base)).toEqual({ KEEP: 'yes', NODE_ENV: 'production', NODE_OPTIONS: '8192' })
    expect(base.INHERITED).toBe('old')
  })
  it.each([
    ['build:{dev,test},!build:dev', 'build:test', true],
    ['build:{dev,test},!build:dev', 'build:dev', false],
    ['!build:packages', 'dev', true],
    ['!build:packages', 'build:packages', false],
    ['dev,build:test', 'build:test', true],
    ['build:te?t', 'build:test', true],
    ['build:[abc]', 'build:b', true],
    ['build:[,a],dev', 'build:,', true],
    ['build:**', 'build:test:sso', true],
    ['build:@(test|release)', 'build:release', true],
    ['!(dev)', 'build:test', true],
    ['build:test\\,sso,dev', 'build:test,sso', true],
  ])('支持 glob/composition %s', (rule, name, matched) => {
    expect(resolveEnv(name, { [rule]: { MATCHED: 'yes' } }, {})).toEqual(matched ? { MATCHED: 'yes' } : {})
  })
  it('精确匹配不误命中，拒绝空 pattern', () => {
    expect(resolveEnv('build:test:sso', { 'build:test': { EXACT: 'yes' } }, {})).toEqual({})
    expect(() => resolveEnv('build', { 'build,,dev': {} }, {})).toThrow('非法 env Pattern')
  })
})

describe('cLI 参数', () => {
  it('支持两种入口及自定义配置', () => {
    expect(parseArgs([])).toEqual({ help: false })
    expect(parseArgs(['build:test'])).toEqual({ help: false, script: 'build:test' })
    expect(parseArgs(['--config=custom.ts', 'build:test:sso'])).toEqual({ config: 'custom.ts', help: false, script: 'build:test:sso' })
    expect(parseArgs(['build:test', '-C', 'custom.ts']).config).toBe('custom.ts')
    expect(parseArgs(['--', '-custom']).script).toBe('-custom')
  })
  it.each([['--config'], ['--config='], ['--config', '--help'], ['--wrong'], ['one', 'two']])('拒绝非法参数 %j', (...argv) => {
    expect(() => parseArgs(argv)).toThrow()
  })
})
