# Scriptio

Scriptio 是一个轻量的 TypeScript script runner，用来把分散在 `package.json scripts` 里的重复命令收敛到 `scriptio.config.ts`。它负责加载配置、生成脚本、注入环境变量、展示可执行脚本，并把最终命令交给系统 shell 执行。

适合这些场景：

- 一个项目里有很多 `dev`、`build`、`preview`、`lint` 命令。
- 需要为环境、应用、包生成组合脚本，例如 `build:test:sso`。
- 希望保留直接命令行执行，同时也能在 TTY 中搜索选择。
- 不想在命令字符串前面手写大量 `cross-env`。

Scriptio 不绑定 Turbo、Vite、pnpm、Monorepo 或任何业务模型。对 Scriptio 来说，`turbo run build`、`vite build`、`nuxt dev` 都只是普通命令。

## 安装

```bash
pnpm add -D scriptio
```

在 `package.json` 中保留一个入口即可：

```json
{
  "scripts": {
    "start": "scriptio"
  }
}
```

创建 `scriptio.config.ts`：

```ts
import { defineConfig, defineEnv, defineScripts } from "scriptio";

const envs = ["dev", "test", "release"] as const;

export default defineConfig({
  env: defineEnv(({ env, each }) => [
    env("start", {
      NODE_ENV: "development",
    }),

    each(envs, "build:{env}", (env) => ({
      NODE_ENV: env === "dev" ? "development" : env,
    })),

    env("build:*", {
      NODE_OPTIONS: "--max-old-space-size=8192",
    }),
  ]),

  scripts: defineScripts(({ matrix }) => [
    {
      start: {
        command: "vite --mode development",
        group: "start",
      },
    },

    matrix({
      command: ({ env }) => `vite build --mode ${env}`,
      group: "build",
      name: "build:{env}",
      values: {
        env: envs,
      },
    }),

    {
      lint: "eslint .",
      preview: "vite preview",
    },
  ]),
});
```

执行：

```bash
pnpm start
pnpm start build:test
pnpm start view
```

也可以直接执行 CLI：

```bash
pnpm scriptio build:test
pnpm scriptio view
```

## CLI

```bash
scriptio [script] [options]
```

常用命令：

```bash
scriptio                 # TTY 中交互选择脚本
scriptio build:test      # 直接执行脚本
scriptio view            # 查看最终脚本树，不执行命令
scriptio --help          # 查看帮助；配置可加载时会追加 Available scripts
scriptio -C ./custom.ts build:test
```

参数：

| 参数                | 说明                                                        |
| ------------------- | ----------------------------------------------------------- |
| `script`            | 要执行的脚本名，例如 `build:test:sso`。                     |
| `view`              | 内置查看命令，打印最终生成的脚本树。                        |
| `-C, --config PATH` | 指定配置文件，默认是当前工作目录下的 `scriptio.config.ts`。 |
| `-h, --help`        | 显示帮助。                                                  |

无参数时，Scriptio 会在真实 TTY 中打开选择器；在 CI 或管道等非交互环境中必须指定脚本名。`Ctrl+C` 取消选择时返回 `130`。

如果配置里也存在名为 `view` 的脚本，`scriptio view` 仍然优先执行内置查看命令；可以无参数进入交互选择后执行这个脚本。

## Public API

运行时 API 只有三个：

```ts
import { defineConfig, defineEnv, defineScripts } from "scriptio";
```

类型也从同一个入口导出：

```ts
import type {
  EnvContext,
  MatrixContext,
  MatrixOptions,
  MatrixValues,
  MaybeFn,
  ResolvedScriptMap,
  ScriptCommand,
  ScriptConfig,
  ScriptDefinition,
  ScriptEnv,
  ScriptEnvConfig,
  ScriptioConfig,
  ScriptMap,
  ScriptsContext,
  UserConfig,
} from "scriptio";
```

### defineConfig

`defineConfig()` 只负责保留配置类型推导，不会执行脚本。

```ts
export default defineConfig({
  scripts: {
    build: "vite build",
  },
});
```

配置结构：

```ts
interface ScriptDefinition {
  command: string;
  group?: string;
  label?: string;
}

type ScriptCommand = string | ScriptDefinition;
type ScriptMap = Record<string, ScriptCommand>;
type ScriptEnv = Record<string, string | undefined>;
type ScriptEnvConfig = Record<string, ScriptEnv>;
type ScriptConfig = ScriptMap | ScriptMap[];

interface UserConfig {
  env?: ScriptEnvConfig;
  scripts: ScriptConfig;
}
```

### defineScripts

`defineScripts()` 用来组合多个 `ScriptMap`，并在回调里提供 `matrix()`。

```ts
scripts: defineScripts(({ matrix }) => [
  matrix({
    command: ({ app, env }) =>
      `turbo run build:${env} --filter=@onecells/${app}`,
    group: "build",
    name: "build:{env}:{app}",
    values: {
      app: ["admin", "sso"] as const,
      env: ["test", "release"] as const,
    },
  }),

  {
    "build:packages": {
      command: 'turbo run build:pk --filter="./packages/*"',
      group: "build",
      label: "构建组件包",
    },
    lint: "eslint .",
  },
]);
```

多个 map 会按声明顺序合并，后面的同名脚本会覆盖前面的完整定义。

### matrix

`matrix()` 用于按 `values` 生成重复脚本。`values` 的字面量类型会传给 `name`、`label`、`command` 函数。

```ts
matrix({
  command: ({ app, env }) => `turbo run build:${env} --filter=@onecells/${app}`,
  label: ({ app, env }) => `${env} / ${app}`,
  name: ({ app, env }) => `build:${env}:${app}`,
  values: {
    app: ["admin", "sso"] as const,
    env: ["test", "release"] as const,
  },
});
```

也可以用 `template` 做简单字符串替换：

```ts
matrix({
  name: "build:{env}:{app}",
  template: "turbo run build:{env} --filter=@onecells/{app}",
  values: {
    app: ["admin", "sso"] as const,
    env: ["test", "release"] as const,
  },
});
```

规则：

- `name` 必填，可以是非空字符串或返回非空字符串的函数。
- `label` 可选，可以是字符串或函数；展示时显示为 `label (scriptName)`。
- `command` 和 `template` 必须二选一。
- 字符串占位符使用 `{env}`，不支持 `${env}`。
- 占位符变量必须存在于 `values`。
- 单个 `matrix()` 内生成重复脚本名会报错。
- 需要同时生成“全部应用”和“单应用”脚本时，拆成两个 `matrix()`。

### defineEnv

`defineEnv()` 用来组合环境变量规则。`env()` 声明单条规则，`each()` 按数组展开规则。

```ts
const envs = ["dev", "test", "release"] as const;

export default defineConfig({
  env: defineEnv(({ env, each }) => [
    env("start", {
      NODE_ENV: "development",
    }),

    each(envs, "start:{env}", (env) => ({
      NODE_ENV: env === "dev" ? "development" : env,
    })),

    env("build:*,!build:packages", {
      NODE_OPTIONS: "--max-old-space-size=8192",
    }),
  ]),

  scripts: {
    start: "vite --mode development",
    "build:test": "vite build --mode test",
  },
});
```

`each()` 当前按 `{env}` 占位符展开，回调参数会保留传入数组的字面量类型。

环境变量规则使用 `picomatch` 语法，支持 `*`、`**`、`?`、`[]`、`{}`、extglob 等。逗号用于组合多个 pattern，`!` 前缀表示排除：

```ts
env: defineEnv(({ env }) => [
  env("*", {
    NODE_ENV: "development",
  }),

  env("build:*,!build:packages", {
    NODE_OPTIONS: "--max-old-space-size=8192",
  }),

  env("build:release", {
    NODE_ENV: "production",
  }),
]);
```

多个规则同时命中时按声明顺序合并，后面的变量覆盖前面的变量。变量值为 `undefined` 时会从最终子进程环境中删除该变量。

Scriptio 通过子进程 `env` 注入环境变量，不会改写命令字符串，也不需要在命令里写 `cross-env`。

## 分组、标签和 view

脚本可以写成对象：

```ts
{
  'build:packages': {
    command: 'turbo run build:pk --filter="./packages/*"',
    group: 'build',
    label: '构建组件包',
  },
}
```

- `group` 控制交互选择和 `scriptio view` 的一级分组。
- `label` 控制展示名称，执行时仍然使用原脚本名。
- 冒号不会自动触发分组；只认显式 `group`。
- 同名脚本被覆盖时，旧的 `group` 和 `label` 也会被完整替换。

`scriptio view` 输出示例：

```text
scripts
├── build
│   ├── build:test  turbo run build:test --filter="./apps/*"
│   ├── build:test:sso  turbo run build:test --filter=@onecells/sso
│   └── 构建组件包 (build:packages)  turbo run build:pk --filter="./packages/*"
└── lint  eslint .
```

TTY 中会启用颜色：树形线条为灰色，分组名为加粗蓝色，脚本名和标签分开着色。设置 `NO_COLOR=1` 可关闭颜色。

## Monorepo 写法

根项目可以只保留一个入口：

```json
{
  "scripts": {
    "start": "scriptio"
  }
}
```

每个子项目也可以只保留一个入口：

```json
{
  "name": "@onecells/admin",
  "scripts": {
    "start": "scriptio"
  }
}
```

子项目自己的 `scriptio.config.ts` 直接写真实命令：

```ts
import { defineConfig, defineScripts } from "scriptio";

const envs = ["dev", "test", "release"] as const;

function mode(env: string): string {
  return env === "dev" ? "development" : env;
}

export default defineConfig({
  scripts: defineScripts(({ matrix }) => [
    {
      start: {
        command: "vite --mode development",
        group: "start",
      },
    },

    matrix({
      command: ({ env }) => `vite build --mode ${mode(env)}`,
      group: "build",
      name: "build:{env}",
      values: {
        env: envs,
      },
    }),

    {
      preview: "vite preview",
    },
  ]),
});
```

根项目通过 pnpm filter 调用子项目入口：

```bash
pnpm --filter=@onecells/admin start build:test
pnpm -r --filter="./apps/*" start build:test
```

根 `scriptio.config.ts` 也可以生成这些命令：

```ts
function appScript(app: string, script: string): string {
  return `pnpm --filter=@onecells/${app} start ${script}`;
}

matrix({
  command: ({ app, env }) => appScript(app, `build:${env}`),
  group: "build",
  name: "build:{env}:{app}",
  values: {
    app: ["admin", "sso"] as const,
    env: ["test", "release"] as const,
  },
});
```

## 命令执行行为

- 命令从当前工作目录执行。
- 执行时会把当前目录及上级目录的 `node_modules/.bin` 追加到 PATH，便于找到本地 bin。
- 命令通过系统 shell 执行，因此命令语法仍然需要兼容目标操作系统。
- `stdout`、`stderr`、颜色、spinner、进度条和交互输出会继承到底层命令。
- 子进程退出码会作为 Scriptio 的退出码。
- POSIX 平台会向进程组转发 `SIGINT` / `SIGTERM`；Windows 使用 `taskkill` 清理进程树。

## 完整示例

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
