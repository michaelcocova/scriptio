# 完整示例

下面的配置覆盖选择、可搜索、多选、文本输入和条件步骤，适用于 turbo 或 pnpm workspace 的 Monorepo。

```ts
import { defineConfig } from "scriptio";

const APP_PACKAGES = {
  admin: "@pg/admin",
  client: "@pg/client",
  docs: "@pg/docs",
  server: "@pg/server",
  www: "@pg/www",
} as const;

type AppName = keyof typeof APP_PACKAGES;

function taskCommand(task: string, apps: AppName[]) {
  const filters = apps.map((app) => `--filter=${APP_PACKAGES[app]}`).join(" ");
  return `pnpm turbo run ${task} ${filters}`;
}

function appsOf(values: Record<string, unknown>): AppName[] {
  return (Array.isArray(values.apps) ? values.apps : []) as AppName[];
}

export default defineConfig({
  commands: {
    build: async ({ run, values }) => {
      await run(taskCommand("build", appsOf(values)));
    },

    clean: async ({ run, values }) => {
      if (values.confirmClean) {
        await run("pnpm clean");
      }
    },

    deploy: async ({ run, values }) => {
      if (values.deploy) {
        await run(
          `node scripts/deploy.mjs --apps ${appsOf(values).join(",")} --env ${String(values.env)} --tag ${String(values.tag)}`,
        );
      }
    },

    dev: async ({ run, values }) => {
      await run(taskCommand("dev", appsOf(values)));
    },

    lint: async ({ run, values }) => {
      await run(taskCommand("lint", appsOf(values)));
    },
  },

  defaultValues: {
    apps: ["www", "client"],
    confirmClean: false,
    env: "local",
    mode: "dev",
  },

  steps: [
    {
      key: "mode",
      message: "选择任务",
      options: [
        { label: "本地开发", value: "dev" },
        { label: "构建", value: "build" },
        { label: "代码检查", value: "lint" },
        { label: "部署", value: "deploy" },
        { label: "清理构建产物", value: "clean" },
      ],
      param: ["--mode", "-M"],
      type: "select",
    },
    {
      key: "apps",
      message: "选择应用（可搜索，空格多选）",
      options: [
        { label: "官网 (www)", value: "www" },
        { label: "用户前端 (client)", value: "client" },
        { label: "API 服务 (server)", value: "server" },
        { label: "管理后台 (admin)", value: "admin" },
        { label: "文档站 (docs)", value: "docs" },
      ],
      param: ["--apps", "-A"],
      type: "autocompleteMultiselect",
    },
    {
      key: "env",
      message: "选择环境（可搜索）",
      options: [
        { label: "本地环境", value: "local" },
        { label: "测试环境", value: "staging" },
        { label: "生产环境", value: "production" },
      ],
      param: ["--env", "-E"],
      type: "autocomplete",
    },
    {
      condition: (values) => values.mode === "deploy",
      key: "tag",
      message: "发布版本号",
      param: ["--tag", "-T"],
      type: "text",
    },
    {
      condition: (values) => values.mode === "deploy",
      key: "deploy",
      message: "确认部署？",
      param: ["--deploy", "-D"],
      type: "confirm",
    },
    {
      condition: (values) => values.mode === "clean",
      key: "confirmClean",
      message: "确认清理构建产物？",
      param: ["--clean", "-L"],
      type: "confirm",
    },
  ],
});
```

## 交互运行

```bash
pnpm scriptio
```

选择 `deploy` 时，才会出现版本号和确认部署步骤；选择 `clean` 时，才会出现清理确认。

## 直接传参

```bash
pnpm scriptio --mode build --apps www --apps client --env production
```

```bash
pnpm scriptio --mode deploy --apps www --env production --tag v1.2.0 --deploy
```

```bash
pnpm scriptio --mode clean --clean
```

## 相关文章

- [使用](/guide/usage)：普通项目与流水线用法
- [步骤类型](/guide/steps)：了解每种输入类型
