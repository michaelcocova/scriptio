import {
  defineConfig,
  defineScripts,
} from './src/index'

const apps = [
  'admin',
  'sso',
  'console',
  'website',
] as const

const devEnvs = [
  'test',
  'pre',
  'six',
] as const

const buildEnvs = [
  'dev',
  'test',
  'pre',
  'six',
  'release',
] as const

export default defineConfig({
  env: {
    'build:*,!build:packages': {
      NODE_OPTIONS:
        '--max-old-space-size=8192',
    },
  },

  scripts: defineScripts(({ matrix }) => {
    return [
      {
        dev: {
          command: 'turbo watch dev --filter="./apps/*"',
          group: 'dev',
        },
      },

      matrix({
        command: ({ app }) => `turbo watch dev --filter=@ffy/${app}`,
        group: 'dev',
        name: 'dev:{app}',
        values: {
          app: apps,
        },
      }),

      matrix({
        command: ({ env }) => `turbo watch dev:${env} --filter="./apps/*"`,
        group: 'dev',
        name: 'dev:{env}',
        values: {
          env: devEnvs,
        },
      }),

      matrix({
        command: ({ app, env }) => `turbo watch dev:${env} --filter=@ffy/${app}`,
        group: 'dev',
        name: 'dev:{env}:{app}',
        // env 放在 app 前面，用声明顺序控制 view 的生成顺序。
        values: {
          env: devEnvs,
          // eslint-disable-next-line perfectionist/sort-objects
          app: apps,
        },
      }),

      matrix({
        command: ({ env }) => `turbo run build:${env} --filter="./apps/*"`,
        group: 'build',
        name: 'build:{env}',
        values: {
          env: buildEnvs,
        },
      }),

      matrix({
        command: ({ app, env }) => `turbo run build:${env} --filter=@ffy/${app}`,
        group: 'build',
        name: 'build:{env}:{app}',

        // env 放在 app 前面，用声明顺序控制 view 的生成顺序。
        values: {
          env: buildEnvs,
          // eslint-disable-next-line perfectionist/sort-objects
          app: apps,
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
          command: 'rimraf \'apps/*/{node_modules,dist}\' && rimraf {node_modules,dist}',
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
        'dev:docs': 'turbo watch dev --filter=@vmrack/docs-next',
        'dev:packages': 'turbo watch build:pk --filter="./packages-next/*"',
        'format': 'prettier --write src/',
        'lint': 'eslint . --fix --cache',
        'prepare': 'husky',
      },
    ]
  }),
})
