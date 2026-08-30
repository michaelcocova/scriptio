---
layout: home

hero:
  name: Scriptio
  text: 项目级通用任务 CLI
  tagline: 用一份 scriptio.config.ts 描述任务、参数和交互，本地开发与 CI 使用同一入口。
  actions:
    - theme: brand
      text: 快速开始
      link: /guide/getting-started
    - theme: alt
      text: 查看示例
      link: /guide/examples

features:
  - title: 交互式任务入口
    details: 根据 steps 自动生成终端交互，支持选择、多选、可搜索和文本输入等输入类型。
  - title: 条件步骤
    details: 通过 condition 控制步骤是否出现，例如只在清理任务时确认清理。
  - title: 本地与 CI 同构
    details: 支持命令行参数、defaultValues 和状态记忆，非交互环境不会阻塞等待输入。
  - title: 可搜索多选
    details: 内置 multiselect 与 autocompleteMultiselect，选项再多也能快速定位。
  - title: 状态记忆
    details: 自动保存最近一次选择，下次交互直接使用上次结果作为默认值。
  - title: Monorepo 友好
    details: 不绑定业务，turbo、pnpm workspace 等 monorepo 任务都能统一管理。
---

## 为什么用 Scriptio

项目里最常用的命令，往往不是一条 `pnpm dev` 或 `pnpm build`，而是“某个任务 + 某个应用 + 某个环境”的组合。脚本数量会随着应用和环境增长而膨胀，交互、CI 和默认值还要各自维护。

Scriptio 用一份 `scriptio.config.ts` 描述任务和参数，让交互选择、命令行传参和 CI 执行共用同一个入口。

<section id="playground">
  <h2>在线体验</h2>
  <CliPlayground />
</section>
