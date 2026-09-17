---
layout: home
hero:
  name: Scriptio
  text: 用 TypeScript 管理项目脚本
  tagline: 配置脚本、生成组合、匹配环境变量，然后直接执行。
  actions:
    - theme: brand
      text: 快速开始
      link: /guide/getting-started
    - theme: alt
      text: 完整示例
      link: /guide/examples
features:
  - title: 普通脚本即可开始
    details: scripts 中的名称对应一条命令，直接支持 TypeScript 配置。
  - title: Matrix 生成组合
    details: 每个名称只展开自身变量，支持 command 函数和 template 字符串。
  - title: 环境变量按规则匹配
    details: 成熟 Glob 匹配、包含与排除、按声明顺序覆盖，undefined 删除继承值。
  - title: 两种执行方式
    details: 无参数时搜索选择，也可直接输入 scriptio build:test:sso。
  - title: 保留原始终端体验
    details: 命令继承终端输入输出，保留颜色、进度条和交互能力。
  - title: 与构建工具无关
    details: Turbo、Vite、pnpm 和其他工具都是普通命令，核心只负责执行。
---

<section id="playground">
  <h2>在线体验</h2>
  <CliPlayground />
</section>
