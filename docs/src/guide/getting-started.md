# 快速开始

Scriptio 是一个项目级通用任务 CLI。它不关心项目业务，只负责加载项目根目录的 `scriptio.config.ts`，根据 `steps` 收集参数，再按第一个 step 的 value 自动路由到 `commands` 执行。

## 安装

```bash
pnpm add -D scriptio
```

## 创建配置

在项目根目录创建 `scriptio.config.ts`：

```ts
import { defineConfig } from "scriptio";

export default defineConfig({
  commands: {
    build: async ({ run }) => {
      await run("pnpm build");
    },

    clean: async ({ run }) => {
      await run("pnpm clean");
    },

    dev: async ({ run }) => {
      await run("pnpm dev");
    },
  },

  steps: [
    {
      key: "mode",
      message: "选择任务",
      options: [
        { label: "本地开发", value: "dev" },
        { label: "构建", value: "build" },
        { label: "清理", value: "clean" },
      ],
      param: ["--mode", "-M"],
      type: "select",
    },
  ],
});
```

## 运行

直接运行进入交互模式：

```bash
pnpm scriptio
```

也可以直接传参数，跳过交互：

```bash
pnpm scriptio --mode build
```

## 相关文章

- [配置结构](/guide/configuration)：了解 `steps`、`defaultValues`、生命周期
- [步骤类型](/guide/steps)：查看六种输入类型与条件步骤
- [完整示例](/guide/examples)：查看 Monorepo 场景配置
