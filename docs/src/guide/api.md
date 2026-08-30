# API 参考

## CommandContext

`commands` 的每个 command 接收一个上下文对象：

```ts
interface CommandContext {
  run: Run;
  values: Record<string, StepValue>;
}
```

`values` 是所有步骤的最终结果。

## commands 自动路由

`commands` 的 key 与第一个 step 的 value 对应：

```ts
commands[values.mode];
```

例如第一个 step 是 `mode`，选择 `build` 时 Scriptio 会自动执行 `commands.build`，不需要手写 `if` 分发。

如果 `commands` 中不存在对应的 key，CLI 会直接报错退出。

## run

`run` 是推荐的外部命令执行器：

```ts
type Run = (command: string | string[]) => Promise<void>;
```

单个字符串表示串行执行：

```ts
await run("pnpm build");
```

字符串数组表示并行执行：

```ts
await run(["pnpm -F web build", "pnpm -F docs build"]);
```

V2 不再提供 `parallel` 选项，执行方式直接由参数类型表达。

命令失败时抛出错误，错误对象包含：

```ts
error.exitCode;
```

## 生命周期钩子

生命周期统一放在 `hooks` 下：

```ts
export default defineConfig({
  commands: {
    build: async ({ run }) => {
      await run("pnpm build");
    },
  },

  hooks: {
    error: async (error, { values }) => {
      // 执行失败时调用
      console.error(error);
    },

    finally: async ({ values }) => {
      // 无论成功失败都调用
    },

    success: async ({ values }) => {
      // 仅成功时调用
    },
  },
});
```

## 相关文章

- [配置](/guide/configuration)：commands 与生命周期
- [CLI 与参数](/guide/cli)：命令行入口
