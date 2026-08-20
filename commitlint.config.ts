import type { UserConfig } from 'cz-git'

const configuration: UserConfig = {
  extends: ['@commitlint/config-conventional'],
  prompt: {
    aiNumber: 1,
    alias: {
      fd: 'docs: fix typos',
    },
    allowBreakingChanges: ['feat', 'fix'],
    allowCustomIssuePrefix: true,
    allowCustomScopes: true,
    allowEmptyIssuePrefix: true,
    allowEmptyScopes: true,
    breaklineChar: '|',
    breaklineNumber: 100,
    confirmColorize: true,
    customIssuePrefixAlias: 'custom',
    customIssuePrefixAlign: 'top',
    customScopesAlias: 'custom',
    customScopesAlign: 'bottom',
    defaultBody: '',
    defaultIssues: '',
    defaultScope: '',
    defaultSubject: '',
    emojiAlign: 'center',
    emptyIssuePrefixAlias: 'skip',
    emptyScopesAlias: 'empty',
    issuePrefixes: [
      {
        name: 'link:     链接 ISSUES 进行中',
        value: 'link',
      },
      {
        name: 'closed:   标记 ISSUES 已完成',
        value: 'closed',
      },
    ],
    markBreakingChangeMode: false,
    messages: {
      body: '填写更加详细的变更描述（可选）。使用 "|" 换行 :\n',
      breaking: '列举非兼容性重大的变更（可选）。使用 "|" 换行 :\n',
      confirmCommit: '是否提交或修改 commit ?',
      customFooterPrefix: '输入自定义 issue 前缀 :',
      customScope: '请输入自定义的提交范围 :',
      footer: '列举关联 issue（可选）例如: #31, #I3244 :\n',
      footerPrefixesSelect: '选择关联 issue 前缀（可选）:',
      scope: '选择一个提交范围（可选）:',
      subject: '填写简短精炼的变更描述 :\n',
      type: '选择你要提交的类型 :',
    },
    scopeOverrides: undefined,
    scopes: [
      {
        name: 'repo: 仓库',
        value: 'repo',
      },
      {
        name: 'core: 核心',
        value: 'core',
      },
      {
        name: 'operation: 操作',
        value: 'operation',
      },
      {
        name: 'themes: 主题',
        value: 'themes',
      },
      {
        name: 'vue: Vue 适配器',
        value: 'vue',
      },
      {
        name: 'docs: 文档',
        value: 'docs',
      },
      {
        name: 'release: 版本发布',
        value: 'release',
      },
    ],
    skipQuestions: [],
    themeColorCode: '',
    types: [
      {
        name: 'feat: 新增功能',
        value: 'feat',
      },
      {
        name: 'fix: 修复问题',
        value: 'fix',
      },
      {
        name: 'docs: 文档更新',
        value: 'docs',
      },
      {
        name: 'style: 代码格式',
        value: 'style',
      },
      {
        name: 'refactor: 代码重构',
        value: 'refactor',
      },
      {
        name: 'perf: 性能优化',
        value: 'perf',
      },
      {
        name: 'test: 测试相关',
        value: 'test',
      },
      {
        name: 'build: 构建相关',
        value: 'build',
      },
      {
        name: 'ci: 持续集成',
        value: 'ci',
      },
      {
        name: 'revert: 回退代码',
        value: 'revert',
      },
      {
        name: 'chore: 杂项修改',
        value: 'chore',
      },
    ],
    upperCaseSubject: false,
    useAI: false,
  },
  rules: {
    'subject-case': [0],
    'type-enum': [
      2,
      'always',
      [
        'feat',
        'fix',
        'perf',
        'style',
        'docs',
        'test',
        'refactor',
        'build',
        'ci',
        'init',
        'chore',
        'revert',
        'wip',
        'workflow',
        'types',
        'release',
      ],
    ],
  },
}

export default configuration
