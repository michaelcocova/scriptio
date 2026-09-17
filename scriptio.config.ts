import { defineConfig, defineEnv, defineScripts } from './src'

// 所有参与矩阵生成的应用。使用 as const 后，matrix 的 app 参数会推导为字面量联合类型。
const apps = ['admin', 'studio', 'sso', 'site', 'mobile'] as const

// dev 环境不包含 development，因为裸 dev 就代表本地 development。
const devEnvs = [
  'test',
  'integration',
  'qa',
  'uat',
  'staging',
  'preproduction',
  'demo',
] as const

// build 显式包含 development，方便 CI 或发布流程直接执行 build:development。
const buildEnvs = [
  'development',
  'test',
  'integration',
  'qa',
  'uat',
  'staging',
  'preproduction',
  'demo',
] as const

function appFilter(app: string): string {
  return `@onecells/${app}`
}

export default defineConfig({
  env: defineEnv(({ env }) => [
    // 给所有 build 脚本注入内存参数，但排除 build:packages。
    // 环境变量通过子进程 env 注入，命令里不需要写 cross-env。
    env('build:*,!build:packages', {
      NODE_OPTIONS: '--max-old-space-size=8192',
    }),
  ]),

  scripts: defineScripts(({ matrix }) => [
    {
      // 默认 dev：启动所有应用的本地 development watch。
      dev: {
        command: 'turbo watch dev --filter="./apps/*"',
        group: 'dev',
      },
    },

    // dev:admin / dev:sso / ...
    // 只启动单个应用的本地 development watch。
    matrix({
      command: ({ app }) => `turbo watch dev --filter=${appFilter(app)}`,
      group: 'dev',
      name: 'dev:{app}',
      values: {
        app: apps,
      },
    }),

    // dev:test / dev:qa / ...
    // 启动某个环境下的全部应用。
    matrix({
      command: ({ env }) => `turbo watch dev:${env} --filter="./apps/*"`,
      group: 'dev',
      name: 'dev:{env}',
      values: {
        env: devEnvs,
      },
    }),

    // dev:test:admin / dev:qa:sso / ...
    // 启动某个环境下的单个应用。
    matrix({
      command: ({ app, env }) =>
        `turbo watch dev:${env} --filter=${appFilter(app)}`,
      group: 'dev',
      name: 'dev:{env}:{app}',
      values: {
        app: apps,
        env: devEnvs,
      },
    }),

    // build:test / build:release / ...
    // 构建某个环境下的全部应用。
    matrix({
      command: ({ env }) => `turbo run build:${env} --filter="./apps/*"`,
      group: 'build',
      name: 'build:{env}',
      values: {
        env: buildEnvs,
      },
    }),

    // build:test:admin / build:release:sso / ...
    // 构建某个环境下的单个应用。
    matrix({
      command: ({ app, env }) =>
        `turbo run build:${env} --filter=${appFilter(app)}`,
      group: 'build',
      name: 'build:{env}:{app}',
      values: {
        app: apps,
        env: buildEnvs,
      },
    }),

    {
      'add:widget': {
        command: 'pnpm dlx shadcn-vue@2.0.1 add',
        label: '添加组件',
      },
      'build:packages': {
        command: 'turbo run build:pk --filter="./packages-next/*"',
        group: 'build',
        label: '构建组件包',
      },
      'clean': {
        command:
          'rimraf \'apps/*/{node_modules,dist}\' && rimraf {node_modules,dist}',
        group: 'clean',
      },
      'clean:cache': {
        command: 'rimraf apps/*/node_modules/.vite',
        group: 'clean',
      },
      'clean:out': {
        command: 'rimraf \'apps/*/{dist,.output}\' && rimraf ./dist',
        group: 'clean',
      },
      'commit': 'git add . && git-cz',
      'dev:docs': 'turbo watch dev --filter=@onecells/docs-next',
      'dev:packages': 'turbo watch build:pk --filter="./packages-next/*"',
      'format': 'prettier --write src/',
      'lint': 'eslint . --fix --cache',
      'prepare': 'husky',
    },
  ]),
})
