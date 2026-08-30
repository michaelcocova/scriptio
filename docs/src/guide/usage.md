# 使用

## 普通项目

### 交互运行

```bash
pnpm scriptio
```

终端会按 `steps` 顺序提问：选择任务、选择应用、选择环境。条件步骤只在对应任务出现，例如选择“清理”时才会询问“确认清理构建产物？”。

上次选择会自动保存到状态文件，下次交互直接作为默认值。

### 直接传参

```bash
pnpm scriptio --mode build --app web --env production
```

短别名：

```bash
pnpm scriptio -M build -A web -E production
```

参数不齐时，剩余步骤仍会交互询问。多选配置重复传参：

```bash
pnpm scriptio --mode build --apps admin --apps console --env production
```

### 常见场景

| 场景     | 命令                                                    |
| -------- | ------------------------------------------------------- |
| 本地开发 | `pnpm scriptio`                                         |
| 手动构建 | `pnpm scriptio --mode build --app web --env production` |
| 清理产物 | `pnpm scriptio --mode clean --clean`                    |

## 流水线

### 非交互执行

CI 环境没有 TTY，Scriptio 不会等待输入。所有参数通过命令行或 `defaultValues` 提供，缺少参数时直接报错退出，避免流水线因等待输入而挂住。

### GitLab CI 示例

每个应用一个 job，环境名直接用 CI 变量：

```yaml
build_admin:
  stage: Build Apps
  script:
    - pnpm scriptio --mode build --app admin --env $BRANCH_NAME

build_console:
  stage: Build Apps
  script:
    - pnpm scriptio --mode build --app console --env $BRANCH_NAME
```

不需要为每个分支、每个应用维护 `build:dev:admin`、`build:release:console` 这类组合脚本。

如果构建共享包，也可以一个 job 传多个应用：

```yaml
build_shared:
  stage: Build Apps
  script:
    - pnpm scriptio --mode build --apps admin --apps console --apps sso --apps website --env $BRANCH_NAME
```

Docker 构建、kubectl 部署等仍然按项目流水线组织，Scriptio 只负责参数收集和命令组装。

### commands 组装

实际命令在 `commands` 中根据 `values` 组装，逻辑只写一次：

```ts
function turboCommand(values: Record<string, unknown>) {
  const mode = String(values.mode);
  const app = String(values.app);
  const env = String(values.env);
  return `pnpm turbo run ${mode} --filter=@pg/${app} --env=${env}`;
}

export default defineConfig({
  commands: {
    build: async ({ run, values }) => {
      await run(turboCommand(values));
    },

    dev: async ({ run, values }) => {
      await run(turboCommand(values));
    },
  },
});
```

本地交互、命令行传参和流水线共用同一份配置和同一套组装逻辑。执行 `--mode build` 时，Scriptio 自动调用 `commands.build`。

## 对比

| 场景      | 命令                                                        | 特点                       |
| --------- | ----------------------------------------------------------- | -------------------------- |
| 本地开发  | `pnpm scriptio`                                             | 交互选择，自动记忆上次选择 |
| 手动构建  | `pnpm scriptio --mode build --app web --env production`     | 一条命令，参数可见         |
| CI 流水线 | `pnpm scriptio --mode build --app admin --env $BRANCH_NAME` | 非交互，环境变量传参       |

## 相关文章

- [完整示例](/guide/examples)：查看完整配置与命令示例
- [CLI 与参数](/guide/cli)：查看参数与别名
- [配置](/guide/configuration)：了解 commands 与生命周期
