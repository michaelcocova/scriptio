<script setup lang="ts">
import type { Terminal } from '@xterm/xterm'
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { defineScripts } from '../../../../src/scripts'
import '@xterm/xterm/css/xterm.css'

const host = ref<HTMLDivElement>()
const ready = ref(false)
const scripts = defineScripts(({ matrix }) => [
  matrix({
    command: ({ env }) => `turbo run build:${env} --filter="./apps/*"`,
    name: 'build:{env}',
    values: { env: ['test', 'release'] },
  }),
  matrix({
    command: ({ app, env }) => `turbo run build:${env} --filter=@ffy/${app}`,
    name: 'build:{env}:{app}',
    values: {
      env: ['test', 'release'],
      // eslint-disable-next-line perfectionist/sort-objects
      app: ['admin', 'sso', 'console', 'website'],
    },
  }),
  { dev: 'vite', lint: 'eslint .' },
])
const commands = ['scriptio', 'scriptio build:test', 'scriptio build:test:sso', 'scriptio --help']
let terminal: Terminal | undefined
let observer: ResizeObserver | undefined
let disposed = false
let input = ''
let selecting = false
let cursor = 0

onMounted(async () => {
  const [{ Terminal }, { FitAddon }] = await Promise.all([import('@xterm/xterm'), import('@xterm/addon-fit')])
  if (disposed || !host.value)
    return
  const fit = new FitAddon()
  terminal = new Terminal({
    convertEol: true,
    cursorBlink: true,
    fontSize: 13,
    theme: { background: '#0b0f14', foreground: '#d4d4d8' },
  })
  terminal.loadAddon(fit)
  terminal.open(host.value)
  fit.fit()
  observer = new ResizeObserver(() => fit.fit())
  observer.observe(host.value)
  terminal.onData(onData)
  ready.value = true
  terminal.writeln('Scriptio V1 浏览器演示（模拟输出，不执行系统命令）')
  prompt()
})

onBeforeUnmount(() => {
  disposed = true
  observer?.disconnect()
  terminal?.dispose()
})

function matches(): string[] {
  return Object.keys(scripts).filter(name => name.includes(input))
}

function prompt(): void {
  input = ''
  selecting = false
  cursor = 0
  terminal?.write('\r\n\x1b[32m$ \x1b[0m')
}

function selection(): void {
  const names = matches()
  cursor = Math.max(0, Math.min(cursor, names.length - 1))
  terminal?.write(`\r\x1b[2K搜索: ${input}  → ${names[cursor] ?? '无匹配项'}`)
}

function execute(name: string): void {
  terminal?.writeln('')
  if (!Object.hasOwn(scripts, name)) {
    terminal?.writeln(`Unknown script "${name}".`)
    terminal?.writeln('退出码：1')
  } else {
    if (name.startsWith('build:'))
      terminal?.writeln('env: NODE_OPTIONS=--max-old-space-size=8192')
    terminal?.writeln(`$ ${scripts[name]}`)
    terminal?.writeln('\x1b[32m模拟执行完成，退出码：0\x1b[0m')
  }
  prompt()
}

function submit(): void {
  const command = input.trim().replace(/^pnpm\s+/, '')
  terminal?.writeln('')
  if (command === 'scriptio') {
    selecting = true
    input = ''
    cursor = 0
    terminal?.writeln('输入名称搜索，↑↓ 选择，Enter 执行，Ctrl+C 取消')
    selection()
  } else if (command === 'scriptio --help' || command === 'help') {
    terminal?.writeln('Usage: scriptio [script] [options]')
    terminal?.writeln('  -C, --config PATH  指定配置文件')
    terminal?.writeln('  -h, --help         显示帮助')
    prompt()
  } else if (command.startsWith('scriptio ')) {
    execute(command.slice(9).trim())
  } else {
    terminal?.writeln('请输入 scriptio、scriptio <script> 或 help')
    prompt()
  }
}

function onData(data: string): void {
  if (selecting && (data === '\x1b[A' || data === '\x1b[B')) {
    const count = matches().length
    if (count)
      cursor = (cursor + (data === '\x1b[A' ? -1 : 1) + count) % count
    selection()
    return
  }
  if (data.startsWith('\x1b'))
    return
  for (const char of data) {
    if (char === '\x03') {
      terminal?.writeln('^C\r\n已取消执行，退出码：130')
      prompt()
    } else if (char === '\r') {
      if (selecting) {
        const name = matches()[cursor]
        if (name)
          execute(name)
      } else {
        submit()
      }
    } else if (char === '\x7f') {
      input = input.slice(0, -1)
      cursor = 0
      if (selecting)
        selection()
      else terminal?.write(`\r\x1b[2K\x1b[32m$ \x1b[0m${input}`)
    } else if (char >= ' ') {
      input += char
      cursor = 0
      if (selecting)
        selection()
      else terminal?.write(char)
    }
  }
}

function runExample(command: string): void {
  if (!terminal)
    return
  terminal.write(`\r\n$ ${command}`)
  selecting = false
  input = command
  submit()
  terminal.focus()
}
</script>

<template>
  <div class="mx-auto mt-8 w-full max-w-4xl overflow-hidden rounded-2xl bg-gray-950 shadow-xl">
    <div class="flex flex-wrap gap-2 border-b border-white/10 p-3">
      <button
        v-for="command in commands" :key="command"
        :disabled="!ready"
        type="button"
        class="rounded-lg border border-white/15 px-3 py-2 font-mono text-xs text-zinc-200 hover:bg-white/10 disabled:opacity-40"
        @click="runExample(command)"
      >
        {{ command }}
      </button>
    </div>
    <div ref="host" class="terminal-host" aria-label="Scriptio 终端演示" />
  </div>
</template>

<style scoped>
.terminal-host {
  height: 26rem;
  padding: 1rem;
  background: #0b0f14;
}
:deep(.xterm) {
  height: 100%;
}
</style>
