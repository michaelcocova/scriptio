import type { ResolvedScriptMap } from '../src/types'
import { expect, it } from 'vitest'
import { groupScripts, renderScriptTree } from '../src/presentation'

it('同名组合并，组名和脚本名可相同，冒号不产生隐式层级', () => {
  const scripts: ResolvedScriptMap = Object.fromEntries([
    ['dev:sso', { command: 'one', group: 'dev' }],
    ['dev', { command: 'two' }],
    ['dev:docs', { command: 'three' }],
    ['dev:test', { command: 'four', group: 'dev' }],
    ['task', { command: 'five', group: 'tools:checks' }],
  ])
  expect(groupScripts(scripts).map(entry => [entry.type, entry.name])).toEqual([
    ['group', 'dev'],
    ['script', 'dev'],
    ['script', 'dev:docs'],
    ['group', 'tools:checks'],
  ])
  expect(renderScriptTree(scripts)).toBe([
    'scripts',
    '├── dev',
    '│   ├── dev:sso  one',
    '│   └── dev:test  four',
    '├── dev  two',
    '├── dev:docs  three',
    '└── tools:checks',
    '    └── task  five',
    '',
  ].join('\n'))
})

it('树形保留标签、完整命令及多行命令的对齐', () => {
  expect(renderScriptTree({
    task: { command: 'echo first\necho second', group: 'tools', label: '多行' },
  })).toBe('scripts\n└── tools\n    └── 多行 (task)  echo first\n        echo second\n')
  expect(renderScriptTree({})).toBe('配置中没有可查看的 Script\n')
})

it('树形输出可将脚本名和命令渲染成不同颜色', () => {
  expect(renderScriptTree({
    'build:packages': { command: 'turbo run build:pk --filter="./packages-next/*"', group: 'build', label: '构建组件包' },
  }, { colors: true })).toBe([
    'scripts',
    '\x1B[90m└── \x1B[39m\x1B[1m\x1B[34mbuild\x1B[39m\x1B[22m',
    '\x1B[90m    └── \x1B[39m\x1B[1m构建组件包\x1B[22m \x1B[36m(build:packages)\x1B[39m  \x1B[90mturbo run build:pk --filter="./packages-next/*"\x1B[39m',
    '',
  ].join('\n'))
})
