# 配置

配置由 `defineConfig` 定义，包含 `commands`、`defaultValues`、`hooks` 和 `steps`。

```ts
import { defineConfig } from "scriptio";

export default defineConfig({
  commands: {
    build: async ({ run, values }) => {
      await run(`pnpm build:${values.env}`);
    },

    dev: async ({ run }) => {
      await run("pnpm dev");
    },
  },

  defaultValues: {
    env: "local",
    mode: "dev",
  },

  hooks: {
    error: async (error, { values }) => {
      // 执行失败
      console.error(error);
    },

    finally: async ({ values }) => {
      // 始终执行
    },

    success: async ({ values }) => {
      // 执行成功
    },
  },

  steps: [
    // ...
  ],
});
```

## steps

`steps` 定义参数收集流程，按数组顺序依次执行。

| 字段        | 说明                                                                                  |
| ----------- | ------------------------------------------------------------------------------------- |
| `key`       | 必填，结果保存到 `values[key]`                                                        |
| `type`      | `select`、`confirm`、`multiselect`、`autocomplete`、`autocompleteMultiselect`、`text` |
| `message`   | 交互提示文案                                                                          |
| `param`     | 对应的 CLI 参数，例如 `--env` 或 `['--env', '-E']`                                    |
| `options`   | 选项类步骤的可选项                                                                    |
| `condition` | 可选函数，返回 `false` 时跳过该步骤                                                   |

步骤类型详见[步骤类型](/guide/steps)。

## 第一个 step 与 commands 关联

`commands` 的 key 使用第一个 step 的 value 匹配：

```ts
steps: [
  {
    key: "mode",
    options: [
      { label: "开发", value: "dev" },
      { label: "构建", value: "build" },
    ],
    type: "select",
  },
];
```

对应：

```ts
const commands = {
  build: async ({ run }) => {},
  dev: async ({ run }) => {},
};
```

执行 `--mode build` 时，Scriptio 自动调用 `commands.build`。第一个 step 决定“做什么”，后面的 step 决定“怎么做”。

## defaultValues

为步骤提供默认值：

```ts
const config = defineConfig({
  defaultValues: {
    app: "all",
    env: "local",
    mode: "dev",
  },
  // ...
});
```

交互模式下默认值会作为默认选择；非交互模式下可作为缺省参数。

默认值必须符合对应步骤的合法值。多选步骤的默认值是数组：

```ts
const config = defineConfig({
  defaultValues: {
    apps: ["www", "client"],
  },
  // ...
});
```

## commands

`commands` 是任务执行入口：

```ts
const commands = {
  build: async ({ run, values }) => {
    await run(`pnpm build:${values.env}`);
  },
};
```

每个 command 接收：

```ts
interface CommandContext {
  run: Run;
  values: Record<string, StepValue>;
}
```

- `run(string)` 串行执行一个命令
- `run(string[])` 并行执行一组命令
- `values` 是所有步骤的最终结果

如果 `commands` 中不存在与第一个 step 的 value 对应的 key，CLI 会报错退出。

## 生命周期

配置支持三个生命周期钩子：

```ts
export default defineConfig({
  hooks: {
    error: async (error, { values }) => {
      // 执行失败
      console.error(error);
    },

    finally: async ({ values }) => {
      // 始终执行
    },

    success: async ({ values }) => {
      // 执行成功
    },
  },
  // ...
});
```

执行流程：

```text
加载配置
  ↓
解析参数
  ↓
执行 commands[values.mode]
  ↓
success / error
  ↓
finally
```

## 参数优先级

交互模式下，参数按照以下优先级处理：

```text
CLI 参数
  ↓
上次选择
  ↓
defaultValues
  ↓
初始值
```

`confirm` 的初始值是 `false`，多选步骤的初始值是空数组，选择类步骤的初始值是第一个选项。

## 状态记忆

交互式运行时，Scriptio 会保存最近一次选择到：

```text
node_modules/.scriptio/last_state.json
```

下次执行时自动作为默认值。如果保存的值在当前配置中已不存在，会自动回退到合法默认值。

## 相关文章

- [步骤类型](/guide/steps)：查看六种输入类型与条件步骤
- [使用](/guide/usage)：本地与流水线用法
