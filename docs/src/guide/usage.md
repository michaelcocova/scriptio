# 使用

Scriptio 的使用方式分为三类：交互选择、直接执行、查看脚本树。

## 交互选择

```bash
scriptio
```

在真实 TTY 中，Scriptio 会打开脚本选择器。可以输入脚本名搜索，方向键选择，Enter 执行，Ctrl+C 取消。

设置 `group` 后，会先选择分组，再选择分组内脚本；未分组脚本直接出现在顶层。

非交互环境中不能省略脚本名。例如 CI 中应该写：

```bash
scriptio build:test
```

## 直接执行

```bash
scriptio build:test
scriptio build:test:sso
scriptio lint
```

脚本名必须与最终生成的 key 完全一致。找不到脚本时会输出：

```text
Unknown script "build:foo".
```

并返回非零退出码。

## 查看脚本树

```bash
scriptio view
```

`view` 会加载配置、展开 matrix、应用覆盖规则，然后打印最终脚本树。它不会执行脚本。

如果配置中也有名为 `view` 的脚本，`scriptio view` 仍然优先执行内置查看命令。要执行同名脚本，可以无参数进入交互选择。

## 指定配置文件

默认加载当前工作目录下的 `scriptio.config.ts`。可以通过 `-C` 或 `--config` 指定其他文件：

```bash
scriptio -C ./configs/project.ts build:test
scriptio --config ./configs/project.ts view
scriptio --config=./configs/project.ts --help
```

配置文件会通过 `jiti` 加载，可以直接写 TypeScript，不需要手动编译成 JavaScript。

## 与 package.json 配合

最简单的入口是：

```json
{
  "scripts": {
    "start": "scriptio"
  }
}
```

然后用 pnpm 把参数传给 Scriptio：

```bash
pnpm start build:test
pnpm start view
```

在 monorepo 子项目中也可以只保留这个入口：

```json
{
  "name": "@onecells/admin",
  "scripts": {
    "start": "scriptio"
  }
}
```

根项目可以通过 filter 调用子项目：

```bash
pnpm --filter=@onecells/admin start build:test
pnpm -r --filter="./apps/*" start build:test
```

注意 `pnpm run --filter=@onecells/admin scriptio build:test` 会把 `scriptio` 当成 package script 名，不适合只保留 `start` 的写法。

## 环境变量注入

Scriptio 会在执行脚本前按脚本名计算 env，并通过子进程环境变量传入。命令中不用写 `cross-env`：

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

## 终端体验

Scriptio 执行命令时继承标准输入输出，保留底层工具的颜色、spinner、进度条、交互提示和 stderr。子命令退出码会作为 Scriptio 的退出码。

命令由系统 shell 执行，因此命令字符串本身仍然需要兼容目标系统。Scriptio 解决的是脚本组织、选择和环境变量注入，不会把 POSIX shell 语法自动转换成 Windows 语法。
