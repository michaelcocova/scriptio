import type { StepValue } from './src/types'
import process from 'node:process'
import { defineConfig } from './src/index'
// 面向 monorepo 的示例配置：
// apps 下是 web / docs / admin 三个应用，packages 下是共享包。
export default defineConfig({
  commands: {
    build: async ({ run, values }) => {
      const nodeEnv = values.env === 'production' ? 'production' : 'development'
      await run(`NODE_ENV=${nodeEnv} pnpm ${appFilter(values.app)} build:${values.env}`)
    },

    clean: async ({ run }) => {
      await run([
        'pnpm --filter "./apps/*" clean',
        'pnpm --filter "./packages/*" clean',
      ])
    },

    deploy: async ({ run, values }) => {
      // 部署是高危操作，必须通过 confirm step 或 --deploy 显式确认。
      if (!values.deploy) {
        console.log('[scriptio] 未确认部署，已跳过')
        return
      }
      const apps = Array.isArray(values.app) ? values.app.join(',') : String(values.app)
      await run(`DEPLOY_TOKEN=${process.env.DEPLOY_TOKEN ?? ''} node scripts/deploy.mjs --app ${apps} --env ${values.env}`)
    },

    dev: async ({ run, values }) => {
      await run(`pnpm ${appFilter(values.app)} --parallel dev`)
    },

    test: async ({ run, values }) => {
      await run(`pnpm ${appFilter(values.app)} test --run`)
    },

    typecheck: async ({ run, values }) => {
      // 应用和共享包可以并行检查，互不依赖。
      await run([
        `pnpm ${appFilter(values.app)} typecheck`,
        'pnpm --filter "./packages/*" typecheck',
      ])
    },
  },

  defaultValues: {
    app: ['all'],
    deploy: false,
    env: 'local',
    mode: 'dev',
  },

  hooks: {
    error: async (error, { values }) => {
      console.error(`[scriptio] ${values.mode} 失败`, error)
    },

    finally: async ({ values }) => {
      console.log(`[scriptio] ${values.mode} 结束`)
    },

    success: async ({ values }) => {
      console.log(`[scriptio] ${values.mode} 完成`)
    },
  },

  steps: [
    {
      key: 'mode',
      message: '选择任务',
      options: [
        { label: '本地开发', value: 'dev' },
        { label: '类型检查', value: 'typecheck' },
        { label: '运行测试', value: 'test' },
        { label: '构建', value: 'build' },
        { label: '部署', value: 'deploy' },
        { label: '清理', value: 'clean' },
      ],
      param: ['--mode', '-M'],
      type: 'select',
    },
    {
      condition: values => values.mode !== 'clean',
      key: 'app',
      message: '选择应用',
      options: [
        { label: '全部应用', value: 'all' },
        { label: 'Web', value: 'web' },
        { label: 'Docs', value: 'docs' },
        { label: 'Admin', value: 'admin' },
      ],
      param: ['--app', '-A'],
      type: 'multiselect',
    },
    {
      condition: values => values.mode !== 'clean',
      key: 'env',
      message: '选择环境',
      options: [
        { label: '本地环境', value: 'local' },
        { label: '测试环境', value: 'staging' },
        { label: '生产环境', value: 'production' },
      ],
      param: ['--env', '-E'],
      type: 'select',
    },
    {
      condition: values => values.mode === 'deploy',
      key: 'deploy',
      message: '确认部署？',
      param: ['--deploy', '-D'],
      type: 'confirm',
    },
  ],
})

function appFilter(apps: StepValue): string {
  const selected = Array.isArray(apps) ? apps : [String(apps)]
  if (selected.includes('all')) {
    return '--filter "./apps/*"'
  }
  return selected.map(app => `--filter ${app}`).join(' ')
}
