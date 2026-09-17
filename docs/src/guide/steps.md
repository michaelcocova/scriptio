# Matrix 脚本生成

`matrix()` 用来根据 `values` 生成重复脚本。它适合处理“环境 × 应用”“环境 × 包”这类组合。

## 基本用法

```ts
const apps = ["admin", "sso"] as const;
const envs = ["test", "release"] as const;

matrix({
  command: ({ app, env }) => `turbo run build:${env} --filter=@onecells/${app}`,
  group: "build",
  name: "build:{env}:{app}",
  values: {
    app: apps,
    env: envs,
  },
});
```

生成：

```text
build:test:admin
build:test:sso
build:release:admin
build:release:sso
```

生成顺序遵循 `values` 中 key 的声明顺序。上面先遍历 `app`，再遍历 `env`；如果希望先按环境排列，把 `env` 写在前面。

## name 和 label

`name` 和 `label` 都可以是字符串或函数。函数参数从 `values` 推导字面量类型。

```ts
matrix({
  command: ({ app, env }) => `turbo run build:${env} --filter=@onecells/${app}`,
  label: (values) => `${values.env} / ${values.app}`,
  name: (values) => `build:${values.env}:${values.app}`,
  values: {
    env: ["test", "release"] as const,
    app: ["admin", "sso"] as const,
  },
});
```

在这个例子里：

```ts
values.env; // 'test' | 'release'
values.app; // 'admin' | 'sso'
```

`label` 只影响展示。脚本执行和 env 匹配仍使用 `name` 生成的脚本名。

## command 和 template

复杂命令使用 `command` 函数：

```ts
matrix({
  command: ({ app, env }) => {
    const filter = app === "all" ? "./apps/*" : `@onecells/${app}`;
    return `turbo run build:${env} --filter=${filter}`;
  },
  name: "build:{env}:{app}",
  values: {
    app: ["admin", "sso"] as const,
    env: ["test", "release"] as const,
  },
});
```

简单替换可以用 `template`：

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

`command` 和 `template` 必须二选一。

## 占位符规则

字符串占位符统一使用 `{variable}`：

```text
build:{env}:{app}
```

不支持 JavaScript 模板字符串形式：

```text
${env}
```

`name`、`label`、`template` 中引用的变量必须存在于 `values`。

## 全部应用和单应用

如果需要同时生成全部应用和单应用脚本，建议拆成两个 `matrix()`，这样脚本名和命令都更清楚。

```ts
matrix({
  command: ({ env }) => `turbo run build:${env} --filter="./apps/*"`,
  group: "build",
  name: "build:{env}",
  values: {
    env: ["test", "release"] as const,
  },
});

matrix({
  command: ({ app, env }) => `turbo run build:${env} --filter=@onecells/${app}`,
  group: "build",
  name: "build:{env}:{app}",
  values: {
    app: ["admin", "sso"] as const,
    env: ["test", "release"] as const,
  },
});
```

## 校验行为

`matrix()` 会在配置加载时校验：

- `name` 必须是非空字符串或返回非空字符串的函数。
- `label` 如果存在，也必须是非空字符串或返回非空字符串的函数。
- `values` 必须是非空对象，每个 value 必须是非空字符串数组。
- `command` 和 `template` 必须二选一。
- 字符串占位符必须合法，且必须存在于 `values`。
- 单个 `matrix()` 生成重复脚本名会报错。
- `command`、`name`、`label` 函数必须返回字符串。
