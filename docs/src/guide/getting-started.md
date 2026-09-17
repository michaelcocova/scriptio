# 快速开始

## 安装

```bash
pnpm add -D scriptio
```

在 `package.json` 中添加入口：

```json
{
  "scripts": {
    "start": "scriptio"
  }
}
```

## 创建配置

在项目根目录创建 `scriptio.config.ts`：

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

## 运行

```bash
pnpm start
```

无参数时会在 TTY 中打开选择器。

也可以直接执行某个脚本：

```bash
pnpm start build:test
pnpm start lint
```

查看生成后的脚本树：

```bash
pnpm start view
```

输出类似：

```text
scripts
├── start
│   └── start  vite --mode development
├── build
│   ├── build:dev  vite build --mode dev
│   ├── build:test  vite build --mode test
│   └── build:release  vite build --mode release
├── lint  eslint .
└── preview  vite preview
```

如果你不想通过 `package.json` 入口，也可以直接执行：

```bash
pnpm scriptio build:test
pnpm scriptio view
```

## 下一步

- 想了解 CLI 参数和退出码，阅读[CLI 与命令执行](./cli)。
- 想了解 `group`、`label`、`defineEnv`，阅读[配置与环境变量](./configuration)。
- 想生成大量组合脚本，阅读[Matrix 脚本生成](./steps)。
- 想看 monorepo 写法，阅读[完整示例](./examples)。
