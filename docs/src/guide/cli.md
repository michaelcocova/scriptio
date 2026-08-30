# CLI 与参数

## 基本用法

```bash
pnpm scriptio
```

命令格式：

```text
scriptio [OPTION]...
```

## 内置参数

| 参数                     | 说明         |
| ------------------------ | ------------ |
| `-C` / `--config <path>` | 指定配置文件 |
| `-h` / `--help`          | 显示帮助     |

默认配置文件：

```text
scriptio.config.ts
```

也可以指定其他位置：

```bash
pnpm scriptio --config ./configs/project.ci.config.ts
```

## Step 参数

每个 step 的 `param` 会自动参与命令行解析：

```bash
pnpm scriptio --mode build --env production
```

短别名：

```bash
pnpm scriptio -M build -E production
```

多选步骤重复传入：

```bash
pnpm scriptio --apps www --apps client
```

布尔参数不带值即表示 `true`：

```bash
pnpm scriptio --deploy
```

## 交互模式

在 TTY 环境中直接运行：

```bash
pnpm scriptio
```

CLI 根据 `steps` 依次提问。条件步骤只有条件成立时才会出现。

## 非交互模式

所有步骤都能通过命令行参数或 `defaultValues` 得到结果时，CLI 会跳过交互直接执行：

```bash
pnpm scriptio --mode build --apps www --apps client --env production
```

如果没有 TTY 且参数不足，CLI 会直接报错退出，避免 CI 因等待输入而阻塞。

CI 环境不依赖上一次交互状态。

## 帮助输出

```bash
pnpm scriptio --help
```

帮助信息包含内置参数和每个 step 对应的参数说明。

## 相关文章

- [使用](/guide/usage)：普通项目与流水线用法
- [配置](/guide/configuration)：defaultValues 与参数优先级
