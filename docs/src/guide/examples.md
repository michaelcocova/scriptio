# 完整示例

这个示例演示一个 `@onecells` monorepo：

- 应用：admin、studio、sso、site、mobile
- 开发环境：test、integration、qa、uat、staging、preproduction、demo
- 构建环境：development、test、integration、qa、uat、staging、preproduction、demo

开发脚本使用 `dev` 前缀，构建脚本使用 `build` 前缀。每个环境都有“全部应用”和“单应用”两种脚本。

根项目和每个子项目都只保留一个 package script 入口，由 Scriptio 接管具体命令：

```json
{
  "scripts": {
    "start": "pnpm scriptio"
  }
}
```

```ts
import { defineConfig, defineEnv, defineScripts } from "scriptio";

// 所有参与矩阵生成的应用。使用 as const 后，matrix 的 app 参数会推导为字面量联合类型。
const apps = ["admin", "studio", "sso", "site", "mobile"] as const;

// dev 环境不包含 development，因为裸 dev 就代表本地 development。
const devEnvs = [
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
      // 默认 dev：启动所有应用的本地 development watch。
      dev: {
        command: 'turbo watch dev --filter="./apps/*"',
        group: "dev",
        label: "启动全部应用开发环境",
      },
    },

    // dev:admin / dev:sso / ...
    // 只启动单个应用的本地 development watch。
    matrix({
      command: ({ app }) => `turbo watch dev --filter=${appFilter(app)}`,
      group: "dev",
      label: "启动{app}开发环境",
      name: "dev:{app}",
      values: {
        app: apps,
      },
    }),

    // dev:test / dev:qa / ...
    // 启动某个环境下的全部应用。
    matrix({
      command: ({ env }) => `turbo watch dev:${env} --filter="./apps/*"`,
      group: "dev",
      label: "启动全部应用{env}环境",
      name: "dev:{env}",
      values: {
        env: devEnvs,
      },
    }),

    // dev:test:admin / dev:qa:sso / ...
    // 启动某个环境下的单个应用。
    matrix({
      command: ({ app, env }) =>
        `turbo watch dev:${env} --filter=${appFilter(app)}`,
      group: "dev",
      label: "启动{app}{env}环境",
      name: "dev:{env}:{app}",
      values: {
        app: apps,
        env: devEnvs,
      },
    }),

    // build:test / build:release / ...
    // 构建某个环境下的全部应用。
    matrix({
      command: ({ env }) => `turbo run build:${env} --filter="./apps/*"`,
      group: "build",
      label: "构建全部应用{env}环境",
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
      label: "构建{app}{env}环境",
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
      "dev:docs": "turbo watch dev --filter=@onecells/docs-next",
      "dev:packages": 'turbo watch build:pk --filter="./packages-next/*"',
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

输出会按显式 `group` 分组

```text
scripts
├── dev
│   ├── dev  turbo watch dev --filter="./apps/*"
│   ├── dev:admin  turbo watch dev --filter=@onecells/admin
│   ├── dev:studio  turbo watch dev --filter=@onecells/studio
│   ├── dev:sso  turbo watch dev --filter=@onecells/sso
│   ├── dev:site  turbo watch dev --filter=@onecells/site
│   ├── dev:mobile  turbo watch dev --filter=@onecells/mobile
│   ├── dev:test  turbo watch dev:test --filter="./apps/*"
│   ├── dev:integration  turbo watch dev:integration --filter="./apps/*"
│   ├── dev:qa  turbo watch dev:qa --filter="./apps/*"
│   ├── dev:uat  turbo watch dev:uat --filter="./apps/*"
│   ├── dev:staging  turbo watch dev:staging --filter="./apps/*"
│   ├── dev:preproduction  turbo watch dev:preproduction --filter="./apps/*"
│   ├── dev:demo  turbo watch dev:demo --filter="./apps/*"
│   ├── dev:test:admin  turbo watch dev:test --filter=@onecells/admin
│   ├── dev:integration:admin  turbo watch dev:integration --filter=@onecells/admin
│   ├── dev:qa:admin  turbo watch dev:qa --filter=@onecells/admin
│   ├── dev:uat:admin  turbo watch dev:uat --filter=@onecells/admin
│   ├── dev:staging:admin  turbo watch dev:staging --filter=@onecells/admin
│   ├── dev:preproduction:admin  turbo watch dev:preproduction --filter=@onecells/admin
│   ├── dev:demo:admin  turbo watch dev:demo --filter=@onecells/admin
│   ├── dev:test:studio  turbo watch dev:test --filter=@onecells/studio
│   ├── dev:integration:studio  turbo watch dev:integration --filter=@onecells/studio
│   ├── dev:qa:studio  turbo watch dev:qa --filter=@onecells/studio
│   ├── dev:uat:studio  turbo watch dev:uat --filter=@onecells/studio
│   ├── dev:staging:studio  turbo watch dev:staging --filter=@onecells/studio
│   ├── dev:preproduction:studio  turbo watch dev:preproduction --filter=@onecells/studio
│   ├── dev:demo:studio  turbo watch dev:demo --filter=@onecells/studio
│   ├── dev:test:sso  turbo watch dev:test --filter=@onecells/sso
│   ├── dev:integration:sso  turbo watch dev:integration --filter=@onecells/sso
│   ├── dev:qa:sso  turbo watch dev:qa --filter=@onecells/sso
│   ├── dev:uat:sso  turbo watch dev:uat --filter=@onecells/sso
│   ├── dev:staging:sso  turbo watch dev:staging --filter=@onecells/sso
│   ├── dev:preproduction:sso  turbo watch dev:preproduction --filter=@onecells/sso
│   ├── dev:demo:sso  turbo watch dev:demo --filter=@onecells/sso
│   ├── dev:test:site  turbo watch dev:test --filter=@onecells/site
│   ├── dev:integration:site  turbo watch dev:integration --filter=@onecells/site
│   ├── dev:qa:site  turbo watch dev:qa --filter=@onecells/site
│   ├── dev:uat:site  turbo watch dev:uat --filter=@onecells/site
│   ├── dev:staging:site  turbo watch dev:staging --filter=@onecells/site
│   ├── dev:preproduction:site  turbo watch dev:preproduction --filter=@onecells/site
│   ├── dev:demo:site  turbo watch dev:demo --filter=@onecells/site
│   ├── dev:test:mobile  turbo watch dev:test --filter=@onecells/mobile
│   ├── dev:integration:mobile  turbo watch dev:integration --filter=@onecells/mobile
│   ├── dev:qa:mobile  turbo watch dev:qa --filter=@onecells/mobile
│   ├── dev:uat:mobile  turbo watch dev:uat --filter=@onecells/mobile
│   ├── dev:staging:mobile  turbo watch dev:staging --filter=@onecells/mobile
│   ├── dev:preproduction:mobile  turbo watch dev:preproduction --filter=@onecells/mobile
│   └── dev:demo:mobile  turbo watch dev:demo --filter=@onecells/mobile
├── build
│   ├── build:development  turbo run build:development --filter="./apps/*"
│   ├── build:test  turbo run build:test --filter="./apps/*"
│   ├── build:integration  turbo run build:integration --filter="./apps/*"
│   ├── build:qa  turbo run build:qa --filter="./apps/*"
│   ├── build:uat  turbo run build:uat --filter="./apps/*"
│   ├── build:staging  turbo run build:staging --filter="./apps/*"
│   ├── build:preproduction  turbo run build:preproduction --filter="./apps/*"
│   ├── build:demo  turbo run build:demo --filter="./apps/*"
│   ├── build:development:admin  turbo run build:development --filter=@onecells/admin
│   ├── build:test:admin  turbo run build:test --filter=@onecells/admin
│   ├── build:integration:admin  turbo run build:integration --filter=@onecells/admin
│   ├── build:qa:admin  turbo run build:qa --filter=@onecells/admin
│   ├── build:uat:admin  turbo run build:uat --filter=@onecells/admin
│   ├── build:staging:admin  turbo run build:staging --filter=@onecells/admin
│   ├── build:preproduction:admin  turbo run build:preproduction --filter=@onecells/admin
│   ├── build:demo:admin  turbo run build:demo --filter=@onecells/admin
│   ├── build:development:studio  turbo run build:development --filter=@onecells/studio
│   ├── build:test:studio  turbo run build:test --filter=@onecells/studio
│   ├── build:integration:studio  turbo run build:integration --filter=@onecells/studio
│   ├── build:qa:studio  turbo run build:qa --filter=@onecells/studio
│   ├── build:uat:studio  turbo run build:uat --filter=@onecells/studio
│   ├── build:staging:studio  turbo run build:staging --filter=@onecells/studio
│   ├── build:preproduction:studio  turbo run build:preproduction --filter=@onecells/studio
│   ├── build:demo:studio  turbo run build:demo --filter=@onecells/studio
│   ├── build:development:sso  turbo run build:development --filter=@onecells/sso
│   ├── build:test:sso  turbo run build:test --filter=@onecells/sso
│   ├── build:integration:sso  turbo run build:integration --filter=@onecells/sso
│   ├── build:qa:sso  turbo run build:qa --filter=@onecells/sso
│   ├── build:uat:sso  turbo run build:uat --filter=@onecells/sso
│   ├── build:staging:sso  turbo run build:staging --filter=@onecells/sso
│   ├── build:preproduction:sso  turbo run build:preproduction --filter=@onecells/sso
│   ├── build:demo:sso  turbo run build:demo --filter=@onecells/sso
│   ├── build:development:site  turbo run build:development --filter=@onecells/site
│   ├── build:test:site  turbo run build:test --filter=@onecells/site
│   ├── build:integration:site  turbo run build:integration --filter=@onecells/site
│   ├── build:qa:site  turbo run build:qa --filter=@onecells/site
│   ├── build:uat:site  turbo run build:uat --filter=@onecells/site
│   ├── build:staging:site  turbo run build:staging --filter=@onecells/site
│   ├── build:preproduction:site  turbo run build:preproduction --filter=@onecells/site
│   ├── build:demo:site  turbo run build:demo --filter=@onecells/site
│   ├── build:development:mobile  turbo run build:development --filter=@onecells/mobile
│   ├── build:test:mobile  turbo run build:test --filter=@onecells/mobile
│   ├── build:integration:mobile  turbo run build:integration --filter=@onecells/mobile
│   ├── build:qa:mobile  turbo run build:qa --filter=@onecells/mobile
│   ├── build:uat:mobile  turbo run build:uat --filter=@onecells/mobile
│   ├── build:staging:mobile  turbo run build:staging --filter=@onecells/mobile
│   ├── build:preproduction:mobile  turbo run build:preproduction --filter=@onecells/mobile
│   ├── build:demo:mobile  turbo run build:demo --filter=@onecells/mobile
│   └── 构建组件包 (build:packages)  turbo run build:pk --filter="./packages-next/*"
├── 添加组件 (add:widget)  pnpm dlx shadcn-vue@2.0.1 add
├── clean
│   ├── clean  rimraf 'apps/*/{node_modules,dist}' && rimraf {node_modules,dist}
│   ├── clean:cache  rimraf apps/*/node_modules/.vite
│   └── clean:out  rimraf 'apps/*/{dist,.output}' && rimraf ./dist
├── commit  git add . && git-cz
├── dev:docs  turbo watch dev --filter=@onecells/docs-next
├── dev:packages  turbo watch build:pk --filter="./packages-next/*"
├── format  prettier --write src/
├── lint  eslint . --fix --cache
└── prepare  husky
```

## 执行示例

```bash
scriptio dev
scriptio dev:test:sso
scriptio build:test
scriptio build:test:sso
scriptio build:packages
```

这些命令依赖示例工作区中的业务工具和包名。本仓库只包含 Scriptio，本示例里的业务命令不会在文档构建时执行。
