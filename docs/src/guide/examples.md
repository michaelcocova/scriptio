# 完整示例

这个示例演示一个 `@onecells` monorepo：

- 应用：admin、studio、sso、site、mobile
- 开发环境：test、integration、qa、uat、staging、preproduction、demo
- 构建环境：development、test、integration、qa、uat、staging、preproduction、demo

开发脚本使用 `start` 前缀，构建脚本使用 `build` 前缀。每个环境都有“全部应用”和“单应用”两种脚本。

```ts
import { defineConfig, defineEnv, defineScripts } from "scriptio";

// 所有参与矩阵生成的应用。使用 as const 后，matrix 的 app 参数会推导为字面量联合类型。
const apps = ["admin", "studio", "sso", "site", "mobile"] as const;

// start 环境不包含 development，因为裸 start 就代表本地 development。
const startEnvs = [
  "test",
  "integration",
  "qa",
  "uat",
  "staging",
  "preproduction",
  "demo",
] as const;

// build 显式包含 development，方便 CI 或发布流程直接执行 build:development。
const buildEnvs = [
  "development",
  "test",
  "integration",
  "qa",
  "uat",
  "staging",
  "preproduction",
  "demo",
] as const;

function appFilter(app: string): string {
  return `@onecells/${app}`;
}

export default defineConfig({
  env: defineEnv(({ env }) => [
    // 给所有 build 脚本注入内存参数，但排除 build:packages。
    // 环境变量通过子进程 env 注入，命令里不需要写 cross-env。
    env("build:*,!build:packages", {
      NODE_OPTIONS: "--max-old-space-size=8192",
    }),
  ]),

  scripts: defineScripts(({ matrix }) => [
    {
      // 默认 start：启动所有应用的本地 development watch。
      start: {
        command: 'turbo watch dev --filter="./apps/*"',
        group: "start",
      },
    },

    // start:admin / start:sso / ...
    // 只启动单个应用的本地 development watch。
    matrix({
      command: ({ app }) => `turbo watch dev --filter=${appFilter(app)}`,
      group: "start",
      name: "start:{app}",
      values: {
        app: apps,
      },
    }),

    // start:test / start:qa / ...
    // 启动某个环境下的全部应用。
    matrix({
      command: ({ env }) => `turbo watch dev:${env} --filter="./apps/*"`,
      group: "start",
      name: "start:{env}",
      values: {
        env: startEnvs,
      },
    }),

    // start:test:admin / start:qa:sso / ...
    // 启动某个环境下的单个应用。
    matrix({
      command: ({ app, env }) =>
        `turbo watch dev:${env} --filter=${appFilter(app)}`,
      group: "start",
      name: "start:{env}:{app}",
      values: {
        app: apps,
        env: startEnvs,
      },
    }),

    // build:test / build:release / ...
    // 构建某个环境下的全部应用。
    matrix({
      command: ({ env }) => `turbo run build:${env} --filter="./apps/*"`,
      group: "build",
      name: "build:{env}",
      values: {
        env: buildEnvs,
      },
    }),

    // build:test:admin / build:release:sso / ...
    // 构建某个环境下的单个应用。
    matrix({
      command: ({ app, env }) =>
        `turbo run build:${env} --filter=${appFilter(app)}`,
      group: "build",
      name: "build:{env}:{app}",
      values: {
        app: apps,
        env: buildEnvs,
      },
    }),

    {
      "add:widget": {
        command: "pnpm dlx shadcn-vue@2.0.1 add",
        label: "添加组件",
      },
      "build:packages": {
        command: 'turbo run build:pk --filter="./packages-next/*"',
        group: "build",
        label: "构建组件包",
      },
      clean: {
        command:
          "rimraf 'apps/*/{node_modules,dist}' && rimraf {node_modules,dist}",
        group: "clean",
      },
      "clean:cache": {
        command: "rimraf apps/*/node_modules/.vite",
        group: "clean",
      },
      "clean:out": {
        command: "rimraf 'apps/*/{dist,.output}' && rimraf ./dist",
        group: "clean",
      },
      commit: "git add . && git-cz",
      "start:docs": "turbo watch dev --filter=@onecells/docs-next",
      "start:packages": 'turbo watch build:pk --filter="./packages-next/*"',
      format: "prettier --write src/",
      lint: "eslint . --fix --cache",
      prepare: "husky",
    },
  ]),
});
```

## 查看脚本

```bash
scriptio view
```

输出会按显式 `group` 分组。下面截取部分结果：

```text
scripts
├── start
│   ├── start  turbo watch dev --filter="./apps/*"
│   ├── start:admin  turbo watch dev --filter=@onecells/admin
│   ├── start:sso  turbo watch dev --filter=@onecells/sso
│   ├── start:test  turbo watch dev:test --filter="./apps/*"
│   └── start:test:sso  turbo watch dev:test --filter=@onecells/sso
├── build
│   ├── build:development  turbo run build:development --filter="./apps/*"
│   ├── build:development:admin  turbo run build:development --filter=@onecells/admin
│   ├── build:test  turbo run build:test --filter="./apps/*"
│   ├── build:test:sso  turbo run build:test --filter=@onecells/sso
│   └── 构建组件包 (build:packages)  turbo run build:pk --filter="./packages-next/*"
├── 添加组件 (add:widget)  pnpm dlx shadcn-vue@2.0.1 add
├── clean
│   ├── clean  rimraf 'apps/*/{node_modules,dist}' && rimraf {node_modules,dist}
│   ├── clean:cache  rimraf apps/*/node_modules/.vite
│   └── clean:out  rimraf 'apps/*/{dist,.output}' && rimraf ./dist
├── commit  git add . && git-cz
├── start:docs  turbo watch dev --filter=@onecells/docs-next
├── start:packages  turbo watch build:pk --filter="./packages-next/*"
├── format  prettier --write src/
├── lint  eslint . --fix --cache
└── prepare  husky
```

## 执行示例

```bash
scriptio start
scriptio start:test:sso
scriptio build:test
scriptio build:test:sso
scriptio build:packages
```

这些命令依赖示例工作区中的业务工具和包名。本仓库只包含 Scriptio，本示例里的业务命令不会在文档构建时执行。
