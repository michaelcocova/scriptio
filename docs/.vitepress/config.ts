import process from 'node:process'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vitepress'

// GitHub Pages 部署在仓库子路径时通过 DOCS_BASE 指定，例如 /scriptio/
const base = process.env.DOCS_BASE ?? '/'

export default defineConfig({
  base,
  cleanUrls: true,
  description: 'Scriptio 轻量 TypeScript Script Runner',
  head: [
    ['link', {
      href: `${base}favicon.svg`,
      rel: 'icon',
      type: 'image/svg+xml',
    }],
  ],
  lang: 'zh-CN',
  lastUpdated: true,
  srcDir: 'src',
  themeConfig: {
    docFooter: {
      next: '下一页',
      prev: '上一页',
    },
    editLink: {
      pattern: 'https://github.com/michaelcocova/scriptio/edit/main/docs/src/:path',
      text: '在 GitHub 上编辑此页',
    },
    footer: {
      copyright: 'Copyright © 2026 Michael Cocova',
      message: 'MIT License',
    },
    lastUpdated: {
      text: '最后更新',
    },
    nav: [
      {
        link: '/',
        text: '首页',
      },
      {
        link: '/guide/introduction',
        text: '为什么用',
      },
      {
        link: '/guide/getting-started',
        text: '快速开始',
      },
      {
        link: '/guide/usage',
        text: '使用',
      },
      {
        link: '/playground',
        text: 'Playground',
      },
    ],
    outline: {
      label: '本页目录',
      level: [2, 3],
    },
    search: {
      options: {
        provider: 'local',
        translations: {
          button: {
            buttonAriaLabel: '搜索文档',
            buttonText: '搜索文档',
          },
          modal: {
            backButtonTitle: '返回',
            displayDetails: '显示详细列表',
            emptyStateText: '未找到相关结果',
            footer: {
              closeKeyAriaLabel: '关闭',
              navigateDownKeyAriaLabel: '向下导航',
              navigateKeyAriaLabel: '导航',
              navigateUpKeyAriaLabel: '向上导航',
              selectKeyAriaLabel: '选择',
            },
            inputPlaceholder: '输入关键词搜索',
            noResultsText: '没有找到相关结果',
            resetButtonTitle: '清除搜索',
          },
        },
      },
    },
    sidebar: [
      {
        items: [
          {
            link: '/guide/introduction',
            text: '为什么用 Scriptio',
          },
          {
            link: '/guide/getting-started',
            text: '快速开始',
          },
          {
            link: '/guide/usage',
            text: '使用',
          },
          {
            link: '/guide/configuration',
            text: '配置',
          },
          {
            link: '/guide/steps',
            text: 'Matrix 脚本生成',
          },
          {
            link: '/guide/cli',
            text: 'CLI 与参数',
          },
          {
            link: '/guide/api',
            text: 'API 参考',
          },
          {
            link: '/guide/examples',
            text: '完整示例',
          },
        ],
        text: '指南',
      },
    ],
    sidebarMenuLabel: '菜单',
    socialLinks: [
      {
        icon: 'github',
        link: 'https://github.com/michaelcocova/scriptio',
      },
    ],
  },
  title: 'Scriptio',
  vite: {
    plugins: [tailwindcss()],
  },
})
