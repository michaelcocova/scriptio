# 步骤类型

每个 step 用于收集一个参数。步骤类型由 `type` 字段决定。

第一个 step 的 value 会作为 `commands` 的 key，参数收集完成后 Scriptio 根据它自动路由到对应 command。

## 通用字段

| 字段        | 说明                                          |
| ----------- | --------------------------------------------- |
| `key`       | 结果保存到 `values[key]`                      |
| `message`   | 交互提示文案                                  |
| `param`     | CLI 参数，例如 `--mode` 或 `['--mode', '-M']` |
| `condition` | 可选函数，返回 `false` 时跳过该步骤           |

## select

从固定选项中选择一个值：

```ts
const step = {
  key: "env",
  message: "选择环境",
  options: [
    { label: "本地环境", value: "local" },
    { label: "测试环境", value: "staging" },
    { label: "生产环境", value: "production" },
  ],
  param: ["--env", "-E"],
  type: "select",
};
```

结果：

```ts
const env = values.env; // "staging"
```

## confirm

获取布尔值：

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
const deploy = values.deploy; // true | false
```

命令行中不带值传入即表示 `true`：

```bash
pnpm scriptio --deploy
```

## multiselect

从选项中选择多个值，结果为数组：

```ts
const step = {
  key: "apps",
  message: "选择应用",
  options: [
    { label: "官网", value: "www" },
    { label: "客户端", value: "client" },
    { label: "API", value: "server" },
  ],
  param: ["--apps", "-A"],
  type: "multiselect",
};
```

结果：

```ts
const apps = values.apps; // ["www", "client"]
```

命令行中重复传入参数：

```bash
pnpm scriptio --apps www --apps client
```

## autocomplete

可搜索单选，适合选项较多的场景：

```ts
const step = {
  key: "framework",
  message: "选择框架",
  options: [
    { label: "Next.js", value: "next" },
    { label: "Nuxt", value: "nuxt" },
    { label: "SvelteKit", value: "sveltekit" },
  ],
  param: ["--framework", "-F"],
  type: "autocomplete",
};
```

交互时可以输入关键字过滤选项，结果为单个字符串。

## autocompleteMultiselect

可搜索多选，配置与 `multiselect` 相同：

```ts
const step = {
  key: "apps",
  message: "选择应用",
  options: [
    // ...
  ],
  param: ["--apps", "-A"],
  type: "autocompleteMultiselect",
};
```

交互时支持输入过滤和空格多选，返回值和命令行传参方式与 `multiselect` 一致。

## text

自由文本输入，不需要 `options`：

```ts
const step = {
  key: "tag",
  message: "发布版本号",
  param: ["--tag", "-T"],
  type: "text",
};
```

结果：

```ts
const tag = values.tag; // "v1.0.0"
```

## 条件步骤

`condition` 接收当前已解析的 `values`，返回 `false` 时跳过该步骤，不询问、也不出现在 `values` 中：

```ts
const step = {
  condition: (values) => values.mode === "clean",
  key: "confirmClean",
  message: "确认清理构建产物？",
  param: ["--clean", "-L"],
  type: "confirm",
};
```

条件按 `steps` 顺序判断，只能读取排在它前面的步骤的值：

```bash
pnpm scriptio --mode dev
```

不会询问 `confirmClean`，最终 `values` 中也没有 `confirmClean`。

## param 别名

`param` 支持字符串或数组。数组第一项是最终生成 `args` 时使用的主参数，所有项都会参与命令行解析：

```ts
const step = {
  key: "mode",
  message: "选择任务",
  options: [
    // ...
  ],
  param: ["--mode", "-M"],
  type: "select",
};
```

下面两种写法等价：

```bash
pnpm scriptio --mode build
pnpm scriptio -M build
```

## 相关文章

- [配置](/guide/configuration)：了解 commands、defaultValues 与生命周期
- [完整示例](/guide/examples)：查看组合使用方式
