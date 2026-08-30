# 为什么用 Scriptio

## Scriptio 是什么

Scriptio 是一个项目级通用任务 CLI。它不关心项目业务，只负责加载项目根目录的 `scriptio.config.ts`，根据 `steps` 收集参数，再按第一个 step 的 value 自动路由到 `commands` 执行。

交互选择、命令行传参和 CI 执行共用同一份配置。

## 常见痛点

项目里最常用的命令，往往不是一条 `pnpm dev` 或 `pnpm build`，而是“某个任务 + 某个应用 + 某个环境”的组合。把这些组合直接维护在 `package.json` 里，会出现几个常见问题：

- **脚本数量爆炸**：任务 × 应用 × 环境会产生大量组合命令，例如 `build:web:staging`、`build:docs:production`
- **命令需要记忆**：脚本越多，越难记住该执行哪一个，新成员上手成本也越高
- **交互选择要重复开发**：本地想要“选任务、选应用、选环境”的交互，需要额外开发一套界面
- **本地和 CI 各写一套**：本地用交互，CI 用参数，两套调用方式和参数定义容易不一致
- **默认值和上次选择要自己实现**：记忆上次选择、设置默认值，需要自己在脚本里处理
- **参数容易写错**：环境名、应用名拼错，往往要等执行后才发现

## 适用场景

Scriptio 适合以下项目：

- Monorepo：turbo、pnpm workspace 等，应用和包数量多
- 多应用、多环境：需要把任务分发到不同应用或环境
- 重复操作：构建、部署、代码检查、清理等固定流程
- 团队统一入口：希望新成员只通过一个命令完成常见任务

## 什么时候不需要

如果项目只有一个固定命令，例如只有 `npm run build`，直接使用 npm scripts 就够了，不需要额外引入 CLI。

如果任务流程复杂到需要专门编排系统，Scriptio 也不适合；它更适合“参数收集 + 命令分发”这一类任务。

## 使用前后对比

以前，`package.json` 需要维护大量组合命令：

```json
{
  "scripts": {
    "dev": "pnpm --filter \"./apps/*\" --parallel dev",
    "dev:web": "pnpm -F web dev",
    "dev:docs": "pnpm -F docs dev",
    "build:staging:web": "pnpm -F web build:staging",
    "build:production:web": "pnpm -F web build:production"
  }
}
```

使用 Scriptio 后，只需要一份配置和一个入口：

```bash
pnpm scriptio
```

```bash
pnpm scriptio --mode build --app web --env production
```

任务、应用和环境由 `steps` 描述，执行逻辑按第一个 step 的 value 自动路由到 `commands`，交互与非交互共享同一份配置。

普通项目与流水线的具体用法见[使用](/guide/usage)。

## 相关文章

- [使用](/guide/usage)：普通项目与流水线用法
- [完整示例](/guide/examples)：查看完整配置
