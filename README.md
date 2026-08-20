# Scriptio

`scriptio` 是一个项目级通用任务 CLI。

它不关心项目业务，只负责加载项目根目录的 `scriptio.config.ts`，根据 `steps` 收集参数，再将最终结果交给 `handle` 执行。

它适用于将项目中分散的 `dev`、`build`、`deploy`、`clean` 等命令统一到一个交互式入口，同时支持命令行参数和 CI 非交互执行。

## 使用

先在项目中安装：

```bash
pnpm add -D scriptio
```

如果项目根目录使用默认配置文件 `scriptio.config.ts`，可以直接执行：

```bash
pnpm scriptio
```

如果配置文件不在默认位置，再显式指定：

```bash
pnpm scriptio --config ./configs/project.config.ts
```

## 使用场景

以一个名为 `my-app` 的 monorepo 为例：

```text
my-app/
├── apps/
│   ├── web/
│   ├── docs/
│   └── admin/
├── packages/
└── scriptio.config.ts
```

项目需要支持：

- 本地开发
- 构建
- 部署
- 清理

同时存在：

- 多个应用
- 多个部署环境

### 以前

通常会在 `package.json` 中维护大量组合命令：

```json
{
  "scripts": {
    "dev": "pnpm --filter \"./apps/*\" --parallel dev",
    "dev:web": "pnpm -F web dev",
    "dev:docs": "pnpm -F docs dev",
    "dev:admin": "pnpm -F admin dev",

    "build:staging": "pnpm --filter \"./apps/*\" build:staging",
    "build:staging:web": "pnpm -F web build:staging",
    "build:staging:docs": "pnpm -F docs build:staging",
    "build:staging:admin": "pnpm -F admin build:staging",

    "build:production": "pnpm --filter \"./apps/*\" build:production",
    "build:production:web": "pnpm -F web build:production",
    "build:production:docs": "pnpm -F docs build:production",
    "build:production:admin": "pnpm -F admin build:production",

    "deploy:staging": "node scripts/deploy.mjs --env staging",
    "deploy:production": "node scripts/deploy.mjs --env production",

    "clean": "rimraf 'apps/*/{node_modules,dist}' && rimraf {node_modules,dist}"
  }
}
```

随着应用和环境增加，脚本数量会不断增长。

常见问题：

- 命令数量越来越多
- `任务 × 应用 × 环境` 产生大量组合
- 命令名称需要记忆
- 环境参数容易写错
- 新成员不知道应该执行哪个命令
- 交互选择需要额外开发
- 本地和 CI 通常需要维护不同的调用方式
- 默认值和上次选择需要自己实现

### 之后

使用一个 `scriptio.config.ts` 描述任务和参数：

```ts
import { defineConfig } from "scriptio";

export default defineConfig({
  defaultValues: {
    app: "all",
    confirmDeploy: false,
    env: "local",
    mode: "dev",
  },

  handle: async ({ run, values }) => {
    if (values.mode === "clean") {
      await run("pnpm clean");
      return;
    }

    if (values.mode === "dev") {
      if (values.app === "all") {
        await run('pnpm --filter "./apps/*" --parallel dev');
      } else {
        await run(`pnpm -F ${values.app} dev`);
      }

      return;
    }

    if (values.mode === "build") {
      if (values.app === "all") {
        await run(
          `pnpm --filter "./apps/*" --workspace-concurrency=2 build:${values.env}`,
        );
      } else {
        await run(`pnpm -F ${values.app} build:${values.env}`);
      }

      return;
    }

    if (values.mode === "deploy" && values.confirmDeploy) {
      await run(`node scripts/deploy.mjs --env ${values.env}`);
    }
  },

  steps: [
    {
      key: "mode",
      message: "选择任务",
      options: [
        {
          label: "本地开发",
          value: "dev",
        },
        {
          label: "构建",
          value: "build",
        },
        {
          label: "部署",
          value: "deploy",
        },
        {
          label: "清理",
          value: "clean",
        },
      ],
      param: ["--mode", "-M"],
      type: "select",
    },

    {
      key: "app",
      message: "选择应用",
      options: [
        {
          label: "全部应用",
          value: "all",
        },
        {
          label: "Web",
          value: "web",
        },
        {
          label: "Docs",
          value: "docs",
        },
        {
          label: "Admin",
          value: "admin",
        },
      ],
      param: ["--app", "-A"],
      type: "select",
    },

    {
      key: "env",
      message: "选择环境",
      options: [
        {
          label: "本地环境",
          value: "local",
        },
        {
          label: "测试环境",
          value: "staging",
        },
        {
          label: "生产环境",
          value: "production",
        },
      ],
      param: ["--env", "-E"],
      type: "select",
    },

    {
      key: "confirmDeploy",
      message: "确认部署？",
      param: ["--deploy", "-D"],
      type: "confirm",
    },
  ],
});
```

之后只需要：

```bash
pnpm scriptio
```

或者直接传入参数：

```bash
pnpm scriptio --mode build --app web --env staging
```

也可以使用短别名：

```bash
pnpm scriptio -M build -A web -E staging
```

## 交互模式

直接运行：

```bash
pnpm scriptio
```

CLI 根据 `scriptio.config.ts` 中的 `steps` 自动进行交互。

例如：

```text
? 选择任务
❯ 本地开发
  构建
  部署
  清理

? 选择应用
❯ 全部应用
  Web
  Docs
  Admin

? 选择环境
❯ 本地环境
  测试环境
  生产环境
```

用户完成选择后，CLI 会得到最终结果：

```ts
const values = {
  app: "web",
  confirmDeploy: false,
  env: "staging",
  mode: "build",
};
```

然后将结果交给：

```ts
handle({
  args: _args,
  run: _run,
  spawn: _spawn,
  values: _values,
});
```

## 非交互模式

当所有 step 都能通过命令行参数或 `defaultValues` 得到结果时，CLI 会跳过交互，直接执行 `handle`。

例如：

```bash
pnpm scriptio --mode build --app web --env staging
```

直接执行 Web 的 staging 构建。

构建全部应用：

```bash
pnpm scriptio --mode build --app all --env production
```

部署：

```bash
pnpm scriptio --mode deploy --env production --deploy
```

清理：

```bash
pnpm scriptio --mode clean
```

这种模式适合 CI。

## 命令行参数

### 内置参数

| 参数                     | 说明         |
| ------------------------ | ------------ |
| `-C` / `--config <path>` | 指定配置文件 |
| `-h` / `--help`          | 显示帮助     |

默认配置文件：

```text
scriptio.config.ts
```

例如：

```bash
pnpm scriptio --config ./configs/project.ci.config.ts
```

### Step 参数

每个 step 可以通过 `param` 定义对应的 CLI 参数。

`param` 支持两种写法：

```ts
type StepParam = string | string[];
```

- `string`: 只定义一个参数，例如 `--env`
- `string[]`: 定义一个主参数和多个别名，例如 `['--mode', '-M']`

当 `param` 是数组时：

- 第一项作为最终生成 `args` 时使用的主参数
- 所有项都会参与命令行解析
- 建议避免与内置参数冲突，例如 `-C` 和 `-h`

例如：

```ts
const step = {
  key: "env",
  message: "选择环境",
  options: [
    {
      label: "测试环境",
      value: "staging",
    },
    {
      label: "生产环境",
      value: "production",
    },
  ],
  param: ["--env", "-E"],
  type: "select",
};
```

CLI 会自动支持：

```bash
--env staging
```

以及：

```bash
-E staging
```

因此参数不需要在 CLI 中单独注册。

## 配置文件

项目根目录创建：

```text
scriptio.config.ts
```

最简单的配置：

```ts
import { defineConfig } from "scriptio";

export default defineConfig({
  defaultValues: {
    clean: false,
    mode: "dev",
  },

  handle: async ({ run, values }) => {
    if (values.clean) {
      await run("pnpm clean");
    }
  },

  steps: [
    {
      key: "mode",
      message: "选择执行模式",
      options: [
        {
          label: "开发",
          value: "dev",
        },
        {
          label: "构建",
          value: "build",
        },
      ],
      param: ["--mode", "-M"],
      type: "select",
    },

    {
      key: "clean",
      message: "是否清理",
      param: ["--clean", "-L"],
      type: "confirm",
    },
  ],
});
```

## 配置结构

配置主要由以下部分组成：

```ts
const config = defineConfig({
  steps,
  defaultValues,
  handle,
  success,
  error,
  finally: finallyHook,
});
```

### steps

`steps` 定义参数收集流程。

每个 step 包含：

| 字段      | 说明                                               |
| --------- | -------------------------------------------------- |
| `key`     | 必填，结果保存到 `values[key]`                     |
| `type`    | `select` 或 `confirm`                              |
| `message` | 交互提示文案                                       |
| `param`   | 对应的 CLI 参数，例如 `--env` 或 `['--env', '-E']` |
| `options` | `select` 类型的可选项                              |

### select

`select` 用于从固定选项中选择一个值。

```ts
const step = {
  key: "env",
  message: "选择环境",
  options: [
    {
      label: "本地环境",
      value: "local",
    },
    {
      label: "测试环境",
      value: "staging",
    },
    {
      label: "生产环境",
      value: "production",
    },
  ],
  param: ["--env", "-E"],
  type: "select",
};
```

结果：

```ts
const env = values.env;
```

默认类型为：

```ts
type EnvValue = string;
```

### confirm

`confirm` 用于获取布尔值。

```ts
const step = {
  key: "deploy",
  message: "确认部署？",
  param: ["--deploy", "-D"],
  type: "confirm",
};
```

结果：

```ts
const deploy = values.deploy;
```

类型为：

```ts
type DeployValue = boolean;
```

命令行中：

```bash
pnpm scriptio --deploy
```

表示：

```ts
deploy === true;
```

## defaultValues

`defaultValues` 用于为 step 提供默认值。

```ts
const defaultValues = {
  app: "all",
  env: "local",
  mode: "dev",
};
```

交互模式下，默认值会作为默认选择。

默认值也可以被命令行参数覆盖：

```bash
pnpm scriptio --mode build
```

最终：

```ts
values.mode === "build";
```

默认值必须符合对应 step 的合法值。

例如：

```ts
const options = [
  {
    label: "测试环境",
    value: "staging",
  },
  {
    label: "生产环境",
    value: "production",
  },
];
```

则：

```ts
const defaultValues = {
  env: "development",
};
```

不是有效配置。

## 参数优先级

交互模式下，参数按照以下优先级处理：

```text
CLI 参数
    ↓
上次选择
    ↓
defaultValues
    ↓
第一个可用选项
```

例如：

```ts
const defaultValues = {
  env: "staging",
};
```

如果上一次选择的是：

```text
production
```

再次执行：

```bash
pnpm scriptio
```

默认选择 `production`。

如果通过：

```bash
pnpm scriptio --env local
```

则直接使用 `local`。

## CI / 非交互模式

在没有 TTY 的环境中，CLI 不会等待用户输入。

例如：

```bash
pnpm scriptio --mode build --app web --env production
```

可以直接执行。

如果缺少必要参数：

```bash
pnpm scriptio --mode build
```

而 CLI 又无法通过 `defaultValues` 或交互获得剩余参数时，会直接报错退出。

这样可以避免 CI 因等待输入而永久阻塞。

CI 不依赖上一次交互状态。

## handle

`handle` 负责真正执行项目任务。

```ts
handle: async ({ args: _args, run: _run, spawn: _spawn, values: _values }) => {
  // 执行任务
};
```

### values

所有 step 的最终值。

例如：

```ts
const values = {
  app: "web",
  env: "production",
  mode: "build",
};
```

### args

根据 step 的 `param` 生成的参数结果。

例如：

```ts
const args = ["--mode", "build", "--app", "web", "--env", "production"];
```

具体参数结构由 CLI 实现决定。

### run

推荐使用的命令执行器。

```ts
await run("pnpm build");
```

### spawn

底层进程执行接口。

用于需要直接控制 Node.js `child_process` 的场景。

## run

`run` 是执行外部命令的主要 API。

### 单个命令

```ts
await run("pnpm build");
```

### 顺序执行

```ts
await run(["pnpm lint", "pnpm test", "pnpm build"]);
```

默认按照顺序执行：

```text
pnpm lint
    ↓
pnpm test
    ↓
pnpm build
```

前一个命令失败后，后续命令不会继续执行。

### 并行执行

```ts
await run(["pnpm lint", "pnpm test"], {
  parallel: true,
});
```

两个命令会同时执行。

### 执行选项

```ts
await run("pnpm build", {
  cwd: "apps/web",

  env: {
    NODE_OPTIONS: "--max-old-space-size=8192",
  },

  timeout: 60_000,
});
```

支持：

| 参数       | 说明         |
| ---------- | ------------ |
| `cwd`      | 命令工作目录 |
| `env`      | 额外环境变量 |
| `timeout`  | 超时时间     |
| `parallel` | 是否并行执行 |

当命令返回非零退出码时，`run` 会抛出错误。

错误对象包含：

```ts
error.exitCode;
```

## spawn

`spawn` 是底层进程执行接口。

一般情况下优先使用：

```ts
run();
```

只有在需要直接操作 Node.js child process 时使用：

```ts
spawn();
```

例如：

- 自定义 stdio
- 获取 child process
- 监听进程事件
- 自定义进程生命周期
- 特殊进程控制

## 生命周期

配置可以定义三个生命周期：

```ts
export default defineConfig({
  // ...

  error: async (_error) => {
    // 执行失败
  },

  finally: async () => {
    // 始终执行
  },

  handle: async ({ run: _run, values: _values }) => {
    // 执行任务
  },

  success: async () => {
    // 执行成功
  },
});
```

执行流程：

```text
加载配置
    ↓
解析参数
    ↓
执行 handle
    ↓
success / error
    ↓
finally
```

`success` 只在任务成功时执行。

`error` 只在任务失败时执行。

`finally` 无论任务成功还是失败都会执行。

## 状态记忆

交互式运行时，`scriptio` 会保存最近一次选择。

默认保存位置：

```text
node_modules/.scriptio/last_state.json
```

例如：

```json
{
  "values": {
    "mode": "build",
    "app": "web",
    "env": "staging"
  }
}
```

下次执行：

```bash
pnpm scriptio
```

CLI 会自动使用上次选择作为默认值。

如果之前保存的值已经不存在于当前配置中，则该值会失效，并回退到当前配置中的有效默认值。

状态文件位于 `node_modules` 中，因此不需要加入 Git。

## 配置多个入口

除了默认的：

```text
scriptio.config.ts
```

还可以通过 `--config` 使用其他配置。

例如：

```text
configs/
├── project.config.ts
├── project.ci.config.ts
└── project.release.config.ts
```

执行：

```bash
pnpm scriptio --config ./configs/project.ci.config.ts
```

或者：

```bash
pnpm scriptio --config ./configs/project.release.config.ts
```

这样可以针对不同场景使用不同的任务配置。

## 典型使用方式

### 本地开发

```bash
pnpm scriptio
```

交互选择：

```text
任务 → 本地开发
应用 → Web
```

### 构建测试环境

```bash
pnpm scriptio --mode build --app web --env staging
```

### 构建生产环境

```bash
pnpm scriptio --mode build --app all --env production
```

### 部署生产环境

```bash
pnpm scriptio --mode deploy --env production --deploy
```

### 清理项目

```bash
pnpm scriptio --mode clean
```

### CI

```bash
pnpm scriptio \
  --mode build \
  --app all \
  --env production
```

CI 不需要启动交互界面。

## 设计原则

`scriptio` 不理解项目业务。

它不知道：

```text
dev
build
deploy
clean
web
docs
admin
staging
production
```

这些内容全部属于项目配置。

`scriptio` 只负责：

```text
配置加载
    ↓
Step 定义
    ↓
参数解析
    ↓
交互输入
    ↓
状态记忆
    ↓
参数校验
    ↓
任务执行
    ↓
生命周期
```

因此同一个 `scriptio` 可以用于不同技术栈和不同类型的项目。

例如：

```text
Vite
Nuxt
Next.js
NestJS
Node.js
Monorepo
```

都可以通过 `scriptio.config.ts` 定义自己的任务。

## 最终结构

项目最终只需要提供：

```text
my-app/
├── scriptio.config.ts
├── package.json
└── ...
```

其中：

`package.json` 负责项目基础脚本和依赖。

`scriptio.config.ts` 负责项目任务、参数和执行逻辑。

`scriptio` 负责统一提供交互式和非交互式任务入口。

最终：

```text
                    scriptio
                        │
                        ▼
              scriptio.config.ts
                        │
                        ▼
                      steps
                        │
          ┌─────────────┴─────────────┐
          ▼                           ▼
      Interactive                   CLI
          │                           │
          └─────────────┬─────────────┘
                        ▼
                  resolved values
                        │
                        ▼
                      handle
                        │
                 ┌──────┴──────┐
                 ▼             ▼
                run          spawn
                 │             │
                 └──────┬──────┘
                        ▼
                    task result
                        │
                 ┌──────┼──────┐
                 ▼      ▼      ▼
              success  error  finally
```

`scriptio` 的核心目标是：

> **用一份项目配置统一描述任务、参数和执行逻辑，让交互式操作与 CI 执行共享同一套任务入口。**
