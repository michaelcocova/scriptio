# CLI 与命令执行

## 用法

```bash
scriptio [script] [options]
```

常用命令：

```bash
scriptio
scriptio build:test
scriptio view
scriptio --help
scriptio -C ./custom.ts build:test
```

参数：

| 参数                | 说明                                               |
| ------------------- | -------------------------------------------------- |
| `script`            | 要执行的脚本名。省略时在 TTY 中交互选择。          |
| `view`              | 内置命令，打印最终脚本树，不执行脚本。             |
| `-C, --config PATH` | 指定配置文件，默认 `scriptio.config.ts`。          |
| `-h, --help`        | 显示帮助。配置可加载时会追加 `Available scripts`。 |

`--config` 可以写在脚本名前或后：

```bash
scriptio --config ./custom.ts build:test
scriptio build:test --config ./custom.ts
scriptio --config=./custom.ts build:test
```

`--` 会停止解析选项，后面的第一个 token 会被当作脚本名。

## 交互选择

无参数时，Scriptio 会加载配置并进入选择器。可以搜索脚本名、进入分组、返回上一级并执行脚本。

取消选择返回 `130`。

非交互环境中不能省略脚本名，否则会报错：

```text
非交互环境请指定 Script，例如 scriptio build:test
```

## view

```bash
scriptio view
```

`view` 会展示最终脚本树：

```text
scripts
├── build
│   ├── build:test  turbo run build:test --filter="./apps/*"
│   ├── build:test:sso  turbo run build:test --filter=@onecells/sso
│   └── 构建组件包 (build:packages)  turbo run build:pk --filter="./packages/*"
└── lint  eslint .
```

它会应用所有 matrix 展开、同名覆盖、group 和 label。`view` 不执行任何脚本，可以在 CI 中使用。

TTY 中默认启用颜色；设置 `NO_COLOR=1` 可关闭颜色。

## help

```bash
scriptio --help
```

帮助会显示基础用法、内置命令和参数。如果当前目录配置能成功加载，还会追加 `Available scripts`。如果配置不存在或配置有错，帮助仍会正常显示基础部分。

## 配置加载

默认加载当前工作目录下的：

```text
scriptio.config.ts
```

也可以指定路径：

```bash
scriptio -C ./configs/scriptio.admin.ts view
```

配置文件必须默认导出包含 `scripts` 的对象。加载失败时会输出配置文件路径和具体原因。

## 命令执行

Scriptio 使用 shell 执行最终命令，并继承标准输入输出：

- 保留 ANSI 颜色。
- 保留 spinner、progress、回车刷新等终端效果。
- 保留子命令的 stdout 和 stderr。
- 子命令退出码会作为 Scriptio 的退出码。

执行时会把当前目录和上级目录中的 `node_modules/.bin` 加入 PATH，方便直接调用项目本地 bin。

## 环境变量

Scriptio 不会把 env 规则拼进命令字符串，不会自动生成 `cross-env ...`。它会在执行子进程时传入合并后的 env。

```ts
env: defineEnv(({ env }) => [
  env("build:*", {
    NODE_OPTIONS: "--max-old-space-size=8192",
  }),
]);
```

```ts
scripts: {
  'build:test': 'vite build --mode test',
}
```

## 进程生命周期

POSIX 平台上，Scriptio 会在收到 `SIGINT` / `SIGTERM` 时转发给子进程组，并清理残留进程。Windows 上使用 `taskkill` 清理进程树。

这让长时间运行的 dev server 能在 Ctrl+C 时尽量干净退出。

## package.json 入口

推荐入口：

```json
{
  "scripts": {
    "start": "scriptio"
  }
}
```

执行：

```bash
pnpm start build:test
pnpm start view
```

Monorepo 子项目也可以使用同样入口：

```bash
pnpm --filter=@onecells/admin start build:test
pnpm -r --filter="./apps/*" start build:test
```
