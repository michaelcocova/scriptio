# 配置与环境变量

Scriptio 默认读取当前工作目录下的 `scriptio.config.ts`。配置文件需要默认导出 `defineConfig()` 包裹的对象。

```ts
import { defineConfig, defineEnv, defineScripts } from "scriptio";

export default defineConfig({
  env: defineEnv(({ env }) => [
    env("build:*", {
      NODE_OPTIONS: "--max-old-space-size=8192",
    }),
  ]),

  scripts: {
    build: "vite build",
    lint: "eslint .",
  },
});
```

## scripts

`scripts` 是必填项。它可以是一个 `ScriptMap`，也可以是多个 `ScriptMap` 组成的数组。

```ts
export default defineConfig({
  scripts: {
    build: "vite build",
    lint: "eslint .",
  },
});
```

脚本值可以是字符串，也可以是对象：

```ts
{
  'build:packages': {
    command: 'turbo run build:pk --filter="./packages/*"',
    group: 'build',
    label: '构建组件包',
  },
}
```

对象字段：

| 字段      | 必填 | 说明                                        |
| --------- | ---- | ------------------------------------------- |
| `command` | 是   | 要执行的命令字符串。                        |
| `group`   | 否   | 交互选择和 `scriptio view` 使用的显式分组。 |
| `label`   | 否   | 展示名称；执行和 env 匹配仍然使用脚本原名。 |

## defineScripts

`defineScripts()` 用来组合普通 map 和 matrix 生成结果。

```ts
scripts: defineScripts(({ matrix }) => [
  matrix({
    command: ({ env }) => `vite build --mode ${env}`,
    group: "build",
    name: "build:{env}",
    values: {
      env: ["test", "release"] as const,
    },
  }),

  {
    lint: "eslint .",
  },
]);
```

数组按声明顺序合并。后面的同名脚本会覆盖前面的完整定义，包括 `command`、`group`、`label`。

## 显式分组与标签

Scriptio 只认显式 `group`，不会按冒号自动分组。

```ts
scripts: defineScripts(({ matrix }) => [
  matrix({
    command: ({ env }) => `turbo run build:${env}`,
    group: "build",
    name: "build:{env}",
    values: {
      env: ["test", "release"] as const,
    },
  }),

  {
    "build:packages": {
      command: "turbo run build:pk",
      group: "build",
      label: "构建组件包",
    },
    lint: "eslint .",
  },
]);
```

`scriptio view` 会显示：

```text
scripts
├── build
│   ├── build:test  turbo run build:test
│   ├── build:release  turbo run build:release
│   └── 构建组件包 (build:packages)  turbo run build:pk
└── lint  eslint .
```

分组位置由该组第一次出现的位置决定，组内保持最终脚本声明顺序。`label` 只影响展示，直接执行仍然使用脚本名：

```bash
scriptio build:packages
```

## env

`env` 是可选项，用于按脚本名注入环境变量。

推荐使用 `defineEnv()`：

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
    "start:test": "vite --mode test",
    "build:test": "vite build --mode test",
  },
});
```

`env(pattern, variables)` 声明一条规则。`each(values, pattern, callback)` 会把 `pattern` 中的 `{env}` 替换为 `values` 中的每个值，callback 参数保留字面量类型。

也可以直接写对象：

```ts
env: {
  'build:*': {
    NODE_OPTIONS: '--max-old-space-size=8192',
  },
}
```

## Env pattern

Env rule 使用 `picomatch` 匹配脚本名。

```ts
env: defineEnv(({ env }) => [
  env("build:*,!build:packages", {
    NODE_OPTIONS: "--max-old-space-size=8192",
  }),
]);
```

上面的规则会匹配：

```text
build:test
build:test:sso
build:release
```

不会匹配：

```text
build:packages
start
```

语法说明：

- `*`、`**`、`?`、`[]`、`{}`、extglob 由 `picomatch` 处理。
- 逗号用于组合多个 pattern。
- `!` 前缀表示排除。
- 只有 exclude 时，例如 `!build:packages`，表示匹配除 `build:packages` 外的脚本。
- 逗号只在顶层分割；花括号、字符类、extglob 内部的逗号不会被拆开。

## Env merge

多个 env rule 可以同时命中。Scriptio 会从当前 `process.env` 开始，按声明顺序覆盖变量。

```ts
env: defineEnv(({ env }) => [
  env("*", {
    NODE_ENV: "development",
  }),

  env("build:*", {
    NODE_OPTIONS: "--max-old-space-size=8192",
  }),

  env("build:release", {
    NODE_ENV: "production",
  }),
]);
```

执行 `build:release` 时，最终环境包含：

```ts
{
  NODE_ENV: 'production',
  NODE_OPTIONS: '--max-old-space-size=8192',
}
```

如果某个变量被设置为 `undefined`，它会从最终环境中删除：

```ts
env: defineEnv(({ env }) => [
  env("*", {
    DEBUG: "true",
  }),

  env("build:release", {
    DEBUG: undefined,
  }),
]);
```

这不会产生 `DEBUG=undefined`。

## TypeScript 类型

常用类型都从 `scriptio` 入口导出：

```ts
import type {
  EnvContext,
  MatrixOptions,
  ScriptEnvConfig,
  ScriptioConfig,
  ScriptMap,
} from "scriptio";
```

例如显式标注 env：

```ts
import type { ScriptEnvConfig } from "scriptio";

const envConfig: ScriptEnvConfig = {
  "build:*": {
    NODE_OPTIONS: "--max-old-space-size=8192",
  },
};
```
