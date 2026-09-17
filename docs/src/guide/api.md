# API 参考

Scriptio 的运行时 API 只有三个：

```ts
import { defineConfig, defineEnv, defineScripts } from "scriptio";
```

类型也从 `scriptio` 入口导出。

## defineConfig

```ts
function defineConfig<T extends UserConfig>(config: T): T;
```

`defineConfig()` 返回传入的配置对象，用来保留 TypeScript 推导。它不会执行脚本，也不会读取文件。

```ts
export default defineConfig({
  scripts: {
    build: "vite build",
  },
});
```

## defineScripts

```ts
function defineScripts(
  callback: (context: ScriptsContext) => ScriptMap[],
): ScriptMap;
```

`defineScripts()` 接收回调，回调返回 `ScriptMap[]`。数组中的 map 会按声明顺序合并，后面的同名脚本覆盖前面的完整定义。

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

## matrix

`matrix()` 通过 `defineScripts()` 的 context 提供。

```ts
matrix<const V extends MatrixValues>(options: MatrixOptions<V>): ScriptMap
```

`MatrixOptions`：

```ts
type MatrixOptions<V extends MatrixValues> = {
  group?: string;
  label?: string | ((values: MatrixContext<V>) => string);
  name: string | ((values: MatrixContext<V>) => string);
  values: V;
} & (
  | { command: (context: MatrixContext<V>) => string; template?: never }
  | { command?: never; template: string }
);
```

说明：

- `values` 是变量来源，值必须是非空字符串数组。
- `name` 生成脚本名，必填。
- `label` 生成展示标签，可选。
- `group` 生成显式分组，可选。
- `command` 返回命令字符串。
- `template` 使用 `{variable}` 做字符串替换。
- `command` 和 `template` 必须二选一。

## defineEnv

```ts
function defineEnv(
  callback: (context: EnvContext) => ScriptEnvConfig[],
): ScriptEnvConfig;
```

`defineEnv()` 接收回调，回调返回 env map 数组。数组按声明顺序合并。

```ts
env: defineEnv(({ env, each }) => [
  env("start", {
    NODE_ENV: "development",
  }),

  each(["dev", "test"] as const, "start:{env}", (env) => ({
    NODE_ENV: env === "dev" ? "development" : env,
  })),
]);
```

`EnvContext`：

```ts
interface EnvContext {
  env: (pattern: string, variables: ScriptEnv) => ScriptEnvConfig;
  each: <const V extends readonly string[]>(
    values: V,
    pattern: string,
    variables: (value: V[number]) => ScriptEnv,
  ) => ScriptEnvConfig;
}
```

`each()` 会替换 pattern 中的 `{env}`。回调参数保留 `values` 的字面量类型。

## 类型

```ts
interface ScriptDefinition {
  command: string;
  group?: string;
  label?: string;
}

type ScriptCommand = string | ScriptDefinition;
type ScriptMap = Record<string, ScriptCommand>;
type ResolvedScriptMap = Record<string, ScriptDefinition>;
type ScriptEnv = Record<string, string | undefined>;
type ScriptEnvConfig = Record<string, ScriptEnv>;
type ScriptConfig = ScriptMap | ScriptMap[];
type ScriptioConfig = UserConfig;

type MatrixValues = Record<string, readonly string[]>;
type MatrixContext<V extends MatrixValues> = {
  [K in keyof V]: V[K][number];
};
type MaybeFn<T, V extends MatrixValues> = T | ((values: MatrixContext<V>) => T);

interface ScriptsContext {
  matrix: <const V extends MatrixValues>(
    options: MatrixOptions<V>,
  ) => ScriptMap;
}

interface UserConfig {
  env?: ScriptEnvConfig;
  scripts: ScriptConfig;
}
```

## 导入类型示例

```ts
import type { MatrixOptions, ScriptEnvConfig, ScriptioConfig } from "scriptio";

const env: ScriptEnvConfig = {
  "build:*": {
    NODE_OPTIONS: "--max-old-space-size=8192",
  },
};

const config: ScriptioConfig = {
  env,
  scripts: {
    build: "vite build",
  },
};
```
