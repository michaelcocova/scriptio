# 为什么用 Scriptio

Scriptio 解决的不是“怎么运行一个命令”，而是“命令变多之后，怎么让团队仍然知道该运行哪个命令”。

一个项目刚开始时，`package.json` 里通常只有几条脚本：

```json
{
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "lint": "eslint ."
  }
}
```

等项目变成多应用、多环境、多包之后，脚本很快会膨胀：

```json
{
  "scripts": {
    "dev": "turbo watch dev --filter=./apps/*",
    "dev:test": "turbo watch dev:test --filter=./apps/*",
    "dev:test:sso": "turbo watch dev:test --filter=@onecells/sso",
    "build:test": "cross-env NODE_OPTIONS=--max-old-space-size=8192 turbo run build:test --filter=./apps/*",
    "build:test:sso": "cross-env NODE_OPTIONS=--max-old-space-size=8192 turbo run build:test --filter=@onecells/sso"
  }
}
```

真正麻烦的地方不只是行数多，而是这些脚本有规律却无法复用：环境要同步、应用要同步、命令前缀要同步、环境变量也要同步。新增一个应用或环境时，经常需要改很多行。

Scriptio 把这些规律放回 TypeScript：

```ts
const apps = ["admin", "sso"] as const;
const envs = ["test", "release"] as const;

matrix({
  command: ({ app, env }) => `turbo run build:${env} --filter=@onecells/${app}`,
  name: "build:{env}:{app}",
  values: {
    app: apps,
    env: envs,
  },
});
```

这样脚本名仍然清楚：

```bash
scriptio build:test:sso
```

但维护方式从“复制一堆字符串”变成“维护一份矩阵”。

## 3 分钟开始

安装：

```bash
pnpm add -D scriptio
```

`package.json` 只保留一个入口：

```json
{
  "scripts": {
    "start": "scriptio"
  }
}
```

创建 `scriptio.config.ts`：

```ts
import { defineConfig, defineScripts } from "scriptio";

const envs = ["dev", "test", "release"] as const;

export default defineConfig({
  scripts: defineScripts(({ matrix }) => [
    {
      start: "vite --mode development",
    },

    matrix({
      command: ({ env }) => `vite build --mode ${env}`,
      group: "build",
      name: "build:{env}",
      values: {
        env: envs,
      },
    }),
  ]),
});
```

执行：

```bash
pnpm start              # 交互选择
pnpm start build:test   # 直接执行
pnpm start view         # 查看生成的脚本树
```

## 为什么不是继续写 package.json scripts

`package.json scripts` 很适合少量命令，但它不是一个脚本生成器。脚本一旦出现规律，就会遇到这些问题：

- **重复命令难维护**：`build:test:*` 和 `build:release:*` 大部分内容相同，只是环境不同。
- **新增环境容易漏**：加一个 `pre` 环境，常常要补全全部应用的脚本。
- **命令列表不好读**：几十个脚本平铺在 package.json 里，新人很难判断该执行哪一个。
- **环境变量散落在命令里**：`cross-env NODE_OPTIONS=...` 到处复制，修改时容易不一致。
- **本地和 CI 体验割裂**：本地想搜索选择，CI 又需要稳定的直接命令。

Scriptio 的目标是保留脚本名的可读性，同时让脚本来源变成可维护的配置。

## Scriptio 做了什么

Scriptio 的执行流程很简单：

```text
加载 scriptio.config.ts
→ 生成最终 scripts
→ 按脚本名匹配 env 规则
→ 选择或直接执行脚本
→ 把 command 交给系统 shell
```

它提供几件小而明确的能力：

- 用 `defineScripts()` 组合多个脚本 map。
- 用 `matrix()` 生成环境、应用、包的组合脚本。
- 用 `group` 和 `label` 让交互选择和 `scriptio view` 更好读。
- 用 `defineEnv()` 按脚本名注入环境变量，命令里不用写 `cross-env`。
- 在 TTY 中搜索选择，在 CI 中直接执行同一个脚本名。

## 它不做什么

Scriptio 不理解你的业务模型，也不替代构建工具。

- Turbo、Vite、Nuxt、pnpm、eslint 都只是命令字符串。
- Scriptio 不做任务依赖图，不做构建缓存，不实现 workspace 模型。
- Scriptio 不自动推断应用、环境或包名。

这意味着你可以把它放进不同类型的项目里：普通 Vite 项目、Nuxt 项目、Turbo monorepo、pnpm workspace 都可以。你控制命令内容，Scriptio 只负责组织和执行。

## 适合使用的场景

- 单项目里想用 TypeScript 管理脚本。
- Monorepo 里想生成 `build:test:admin` 这类矩阵脚本。
- 子项目只想保留一个 `"start": "scriptio"` 入口。
- 需要通过 glob 规则给部分脚本注入环境变量。
- 想在 TTY 中搜索选择脚本，同时保留 `scriptio build:test` 这样的直接调用。
