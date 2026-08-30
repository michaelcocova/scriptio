<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import '@xterm/xterm/css/xterm.css'

interface ChoiceOption {
  label: string
  value: string
}

interface StepDef {
  aliases: string[]
  condition?: (values: Choices) => boolean
  key: string
  message: string
  options?: ChoiceOption[]
  param: string
  type: 'autocomplete' | 'autocompleteMultiselect' | 'confirm' | 'multiselect' | 'select' | 'text'
}

interface InteractiveState {
  cursor: number
  filter: string
  selected: string[]
  stepIndex: number
}

type ChoiceValue = boolean | string | string[]
type Choices = Record<string, ChoiceValue>
type CommandTabKey = 'args' | 'build' | 'clean' | 'deploy' | 'help' | 'interactive' | 'test'

const steps: StepDef[] = [
  {
    aliases: ['--mode', '-M'],
    key: 'mode',
    message: '选择任务',
    options: [
      {
        label: '本地开发',
        value: 'dev',
      },
      {
        label: '类型检查',
        value: 'typecheck',
      },
      {
        label: '运行测试',
        value: 'test',
      },
      {
        label: '构建',
        value: 'build',
      },
      {
        label: '部署',
        value: 'deploy',
      },
      {
        label: '清理',
        value: 'clean',
      },
    ],
    param: '--mode',
    type: 'select',
  },
  {
    aliases: ['--apps', '-A'],
    key: 'apps',
    message: '选择应用（空格多选）',
    options: [
      {
        label: '全部应用',
        value: 'all',
      },
      {
        label: '官网 (www)',
        value: 'www',
      },
      {
        label: '用户前端 (client)',
        value: 'client',
      },
      {
        label: 'API 服务 (server)',
        value: 'server',
      },
      {
        label: 'Admin',
        value: 'admin',
      },
      {
        label: '文档站 (docs)',
        value: 'docs',
      },
    ],
    param: '--apps',
    type: 'multiselect',
  },
  {
    aliases: ['--services', '-S'],
    key: 'services',
    message: '选择服务（可搜索，空格多选）',
    options: [
      {
        label: 'Web 服务',
        value: 'web',
      },
      {
        label: 'API 服务',
        value: 'api',
      },
      {
        label: 'Worker 任务',
        value: 'worker',
      },
      {
        label: '定时任务',
        value: 'scheduler',
      },
    ],
    param: '--services',
    type: 'autocompleteMultiselect',
  },
  {
    aliases: ['--env', '-E'],
    key: 'env',
    message: '选择环境（可搜索）',
    options: [
      {
        label: '本地环境',
        value: 'local',
      },
      {
        label: '测试环境',
        value: 'staging',
      },
      {
        label: '生产环境',
        value: 'production',
      },
    ],
    param: '--env',
    type: 'autocomplete',
  },
  {
    aliases: ['--tag', '-T'],
    condition: values => values.mode === 'deploy',
    key: 'tag',
    message: '发布版本号',
    param: '--tag',
    type: 'text',
  },
  {
    aliases: ['--deploy', '-D'],
    condition: values => values.mode === 'deploy',
    key: 'deploy',
    message: '确认部署？',
    param: '--deploy',
    type: 'confirm',
  },
  {
    aliases: ['--clean', '-L'],
    condition: values => values.mode === 'clean',
    key: 'confirmClean',
    message: '确认清理构建产物？',
    param: '--clean',
    type: 'confirm',
  },
]

const commandTabs: Array<{ key: CommandTabKey, label: string }> = [
  {
    key: 'interactive',
    label: '交互模式',
  },
  {
    key: 'build',
    label: '构建',
  },
  {
    key: 'test',
    label: '测试',
  },
  {
    key: 'deploy',
    label: '部署',
  },
  {
    key: 'clean',
    label: '清理',
  },
  {
    key: 'args',
    label: '直接传参',
  },
  {
    key: 'help',
    label: '帮助',
  },
]

const presetCommands: Record<CommandTabKey, string> = {
  args: 'pnpm scriptio --mode build --apps www --apps client --services web --services api --env production --deploy=false --clean=false',
  build: 'pnpm scriptio --mode build',
  clean: 'pnpm scriptio --mode clean',
  deploy: 'pnpm scriptio --mode deploy',
  help: 'scriptio --help',
  interactive: 'pnpm scriptio',
  test: 'pnpm scriptio --mode test',
}

const availableCommands = [
  'scriptio',
  'pnpm scriptio',
  'scriptio --help',
  'help / clear',
]

const host = ref<HTMLDivElement | null>(null)
const busy = ref(false)
const activeTab = ref<CommandTabKey>('interactive')
let term: import('@xterm/xterm').Terminal | null = null
let fitAddon: import('@xterm/addon-fit').FitAddon | null = null
let input = ''
let interactive: InteractiveState | null = null
let choices: Choices = defaultChoices()

onMounted(async () => {
  if (!host.value)
    return

  const {
    Terminal,
  } = await import('@xterm/xterm')
  const {
    FitAddon,
  } = await import('@xterm/addon-fit')

  term = new Terminal({
    convertEol: true,
    cursorBlink: true,
    cursorStyle: 'block',
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
    fontSize: 13,
    lineHeight: 1.45,
    scrollback: 300,
    theme: {
      background: '#0b0f14',
      black: '#18181b',
      blue: '#38bdf8',
      brightBlack: '#71717a',
      brightBlue: '#7dd3fc',
      brightCyan: '#67e8f9',
      brightGreen: '#6ee7b7',
      brightMagenta: '#f0abfc',
      brightRed: '#fca5a5',
      brightWhite: '#fafafa',
      brightYellow: '#fde047',
      cursor: '#34d399',
      cursorAccent: '#0b0f14',
      cyan: '#22d3ee',
      foreground: '#d4d4d8',
      green: '#34d399',
      magenta: '#e879f9',
      red: '#f87171',
      selectionBackground: '#22d3ee33',
      white: '#e4e4e7',
      yellow: '#fbbf24',
    },
  })
  fitAddon = new FitAddon()
  term.loadAddon(fitAddon)
  term.open(host.value)
  term.onData(handleData)
  writeWelcome()
  printPrompt()
  requestAnimationFrame(fit)
  window.addEventListener('resize', fit)
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', fit)
  term?.dispose()
})

function switchTab(tabKey: CommandTabKey) {
  if (busy.value)
    return
  resetTerminal()
  activeTab.value = tabKey
  term?.writeln(`\x1b[90m# 示例：${presetCommands[tabKey]}\x1b[0m`)
  printPrompt()
}

function resetTerminal() {
  input = ''
  interactive = null
  choices = defaultChoices()
  term?.reset()
  writeWelcome()
}

function writeWelcome() {
  term?.writeln('\x1b[32mscriptio\x1b[0m \x1b[90m0.0.1-beta.2 playground\x1b[0m')
}

function handleData(data: string) {
  if (busy.value || !term)
    return
  if (interactive) {
    handleInteractiveKey(data)
    return
  }
  if (data === '\r') {
    term.write('\r\n')
    const raw = input
    input = ''
    void processCommand(raw)
    return
  }
  if (data === '\x7f') {
    if (input.length > 0) {
      input = input.slice(0, -1)
      term.write('\b \b')
    }
    return
  }
  if (data === '\x03') {
    term.write('^C\r\n')
    input = ''
    printPrompt()
    return
  }
  if (data === '\x0c') {
    term.clear()
    printPrompt()
    return
  }
  if (data.startsWith('\x1b'))
    return
  input += data
  term.write(data)
}

function handleInteractiveKey(data: string) {
  if (!term || !interactive)
    return
  if (data === '\r') {
    selectCurrent()
    return
  }
  if (data === '\x1b[A' || data === '\x1b[D') {
    moveCursor(-1)
    return
  }
  if (data === '\x1b[B' || data === '\x1b[C') {
    moveCursor(1)
    return
  }
  if (data === '\x03') {
    term.write('\r\n')
    term.writeln('\x1b[90m已取消\x1b[0m')
    interactive = null
    printPrompt()
    return
  }
  if (data === '\x7f') {
    if (interactive.filter.length > 0) {
      interactive.filter = interactive.filter.slice(0, -1)
      interactive.cursor = 0
      rerenderPrompt()
    }
    return
  }

  const step = steps[interactive.stepIndex]
  if (step.type === 'confirm') {
    if (data === 'y' || data === 'Y') {
      selectValue(true)
      return
    }
    if (data === 'n' || data === 'N')
      selectValue(false)
    return
  }
  if (step.type === 'text') {
    interactive.filter += data
    rerenderPrompt()
    return
  }
  if (step.type === 'multiselect' || step.type === 'autocompleteMultiselect') {
    if (data === ' ') {
      toggleSelected()
      return
    }
  }
  if (step.type === 'autocomplete' || step.type === 'autocompleteMultiselect') {
    interactive.filter += data
    interactive.cursor = 0
    rerenderPrompt()
  }
}

function moveCursor(delta: number) {
  if (!term || !interactive)
    return
  const step = steps[interactive.stepIndex]
  const count = optionCount(step)
  interactive.cursor = (interactive.cursor + delta + count) % count
  rerenderPrompt()
}

function selectCurrent() {
  if (!interactive)
    return
  const step = steps[interactive.stepIndex]
  if (step.type === 'confirm') {
    selectValue(interactive.cursor === 0)
  } else if (step.type === 'text') {
    selectValue(interactive.filter)
  } else if (step.type === 'multiselect' || step.type === 'autocompleteMultiselect') {
    selectValue([...interactive.selected])
  } else {
    const options = visibleOptions(step)
    selectValue(options[interactive.cursor]?.value ?? interactive.filter)
  }
}

function selectValue(value: ChoiceValue) {
  if (!term || !interactive)
    return
  const step = steps[interactive.stepIndex]
  choices[step.key] = value
  const answer = formatAnswer(step, value)
  term.write(`\x1b[${promptLineCount()}A\x1b[J`)
  term.writeln(`\x1b[32m✔\x1b[0m ${step.message} ${answer}`)

  const next = nextStepIndex(interactive.stepIndex)
  if (next < steps.length) {
    interactive.stepIndex = next
    interactive.cursor = 0
    interactive.filter = ''
    interactive.selected = initialSelected(steps[next])
    renderPrompt()
    return
  }
  interactive = null
  void runTask()
}

function renderPrompt() {
  if (!term || !interactive)
    return
  const step = steps[interactive.stepIndex]
  term.writeln(`\x1b[36m?\x1b[0m ${step.message}`)
  if (step.type === 'text') {
    term.writeln(`\x1b[32m❯\x1b[0m ${interactive.filter || '\x1b[90m输入后回车\x1b[0m'}`)
    return
  }
  if (step.type === 'confirm') {
    const yes = interactive.cursor === 0
    const no = interactive.cursor === 1
    term.writeln(`${yes ? '\x1b[32m❯\x1b[0m' : ' '} ${yes ? '\x1b[97m' : '\x1b[90m'}是\x1b[0m`)
    term.writeln(`${no ? '\x1b[32m❯\x1b[0m' : ' '} ${no ? '\x1b[97m' : '\x1b[90m'}否\x1b[0m`)
    return
  }

  const multi = step.type === 'multiselect' || step.type === 'autocompleteMultiselect'
  if (step.type === 'autocomplete' || step.type === 'autocompleteMultiselect') {
    term.writeln(`\x1b[90m搜索：\x1b[0m${interactive.filter || '\x1b[90m输入过滤\x1b[0m'} ${multi ? '\x1b[90m空格多选\x1b[0m' : ''}`)
  }
  for (const [index, option] of visibleOptions(step).entries()) {
    const pointer = index === interactive.cursor ? '\x1b[32m❯\x1b[0m' : ' '
    const highlight = index === interactive.cursor ? '\x1b[97m' : '\x1b[90m'
    const checkbox = multi
      ? interactive.selected.includes(option.value) ? '\x1b[32m◉\x1b[0m' : '\x1b[90m○\x1b[0m'
      : ''
    term.writeln(`${pointer} ${checkbox} ${highlight}${option.label}\x1b[0m \x1b[90m${option.value}\x1b[0m`)
  }
}

function promptLineCount(): number {
  if (!interactive)
    return 0
  const step = steps[interactive.stepIndex]
  if (step.type === 'confirm')
    return 3
  if (step.type === 'text')
    return 2
  const base = step.type === 'autocomplete' || step.type === 'autocompleteMultiselect' ? 2 : 1
  return visibleOptions(step).length + base
}

function shouldAsk(step: StepDef): boolean {
  return !step.condition || step.condition(choices)
}

function nextStepIndex(from: number): number {
  let index = from + 1
  while (index < steps.length && !shouldAsk(steps[index]))
    index++
  return index
}

function visibleOptions(step: StepDef): ChoiceOption[] {
  const filter = interactive?.filter.toLowerCase() ?? ''
  return (step.options ?? []).filter(option =>
    option.label.toLowerCase().includes(filter)
    || option.value.toLowerCase().includes(filter),
  )
}

function optionCount(step: StepDef): number {
  return step.type === 'confirm' ? 2 : Math.max(visibleOptions(step).length, 1)
}

function initialSelected(step: StepDef): string[] {
  const value = defaultChoices()[step.key]
  return Array.isArray(value) ? [...value] : []
}

function toggleSelected() {
  if (!interactive)
    return
  const step = steps[interactive.stepIndex]
  const option = visibleOptions(step)[interactive.cursor]
  if (!option)
    return
  const selected = interactive.selected
  const index = selected.indexOf(option.value)
  if (index === -1)
    selected.push(option.value)
  else
    selected.splice(index, 1)
  rerenderPrompt()
}

function rerenderPrompt() {
  if (!term || !interactive)
    return
  term.write(`\x1b[${promptLineCount()}A\x1b[J`)
  renderPrompt()
}

function formatAnswer(step: StepDef, value: ChoiceValue): string {
  if (step.type === 'confirm')
    return value ? '是' : '否'
  if (Array.isArray(value)) {
    if (value.length === 0)
      return '未选择'
    return value
      .map(item => step.options?.find(option => option.value === item)?.label ?? item)
      .join(', ')
  }
  return step.options?.find(option => option.value === value)?.label ?? String(value)
}

async function processCommand(raw: string) {
  const trimmed = raw.trim()
  if (!trimmed) {
    printPrompt()
    return
  }
  if (trimmed === 'clear' || trimmed === 'cls') {
    term?.clear()
    printPrompt()
    return
  }
  if (trimmed === 'help') {
    printHelp()
    printPrompt()
    return
  }

  const parts = trimmed.split(/\s+/)
  let args: string[]
  if (parts[0] === 'pnpm' && parts[1] === 'scriptio') {
    args = parts.slice(2)
  } else if (parts[0] === 'scriptio') {
    args = parts.slice(1)
  } else {
    term?.writeln(`\x1b[31mcommand not found: ${parts[0]}\x1b[0m`)
    printPrompt()
    return
  }

  if (args.includes('--help') || args.includes('-h')) {
    printHelp()
    printPrompt()
    return
  }

  let provided: Choices
  try {
    provided = parseArgs(args)
  } catch (error) {
    term?.writeln(`\x1b[31m${error instanceof Error ? error.message : String(error)}\x1b[0m`)
    printPrompt()
    return
  }

  choices = {
    ...defaultChoices(),
    ...provided,
  }
  const firstMissing = steps.findIndex(step => shouldAsk(step) && !(step.key in provided))
  if (firstMissing !== -1) {
    interactive = {
      cursor: 0,
      filter: '',
      selected: initialSelected(steps[firstMissing]),
      stepIndex: firstMissing,
    }
    renderPrompt()
    return
  }

  busy.value = true
  await runTask()
  busy.value = false
  printPrompt()
}

function parseArgs(args: string[]): Choices {
  const values: Choices = {
  }
  for (let i = 0; i < args.length; i++) {
    const token = args[i]
    if (token === '-C' || token === '--config') {
      if (!args[i + 1])
        throw new Error('参数 --config 需要值')
      i++
      continue
    }
    if (token.startsWith('--config='))
      continue

    const eq = token.indexOf('=')
    const flag = eq === -1 ? token : token.slice(0, eq)
    const step = steps.find(item => item.aliases.includes(flag))
    if (!step)
      throw new Error(`无法识别的参数：${flag}`)

    if (step.type === 'confirm') {
      const raw = eq === -1 ? undefined : token.slice(eq + 1)
      if (raw !== undefined && raw !== 'true' && raw !== 'false')
        throw new Error(`参数 ${flag} 只接受 true / false`)
      values[step.key] = raw === undefined ? true : raw === 'true'
      continue
    }

    if (step.type === 'text') {
      const value = eq === -1 ? args[i + 1] : token.slice(eq + 1)
      if (value === undefined)
        throw new Error(`参数 ${flag} 的值无效：${value ?? '(缺失)'}`)
      values[step.key] = value
      if (eq === -1)
        i++
      continue
    }

    if (step.type === 'multiselect' || step.type === 'autocompleteMultiselect') {
      const value = eq === -1 ? args[i + 1] : token.slice(eq + 1)
      if (!value || !step.options?.some(option => option.value === value))
        throw new Error(`参数 ${flag} 的值无效：${value ?? '(缺失)'}`)
      const current = Array.isArray(values[step.key]) ? values[step.key] : []
      // @ts-ignore
      values[step.key] = [...current, value]
      if (eq === -1)
        i++
      continue
    }

    const value = eq === -1 ? args[i + 1] : token.slice(eq + 1)
    if (!value || !step.options?.some(option => option.value === value))
      throw new Error(`参数 ${flag} 的值无效：${value ?? '(缺失)'}`)
    values[step.key] = value
    if (eq === -1)
      i++
  }
  return values
}

async function runTask() {
  if (!term)
    return
  const args = buildArgs()
  term.writeln(`\x1b[36m参数：\x1b[0m${args || '(无)'}`)
  await wait(220)
  term.writeln('\x1b[33m执行任务\x1b[0m')

  for (const line of resolveHandleLines()) {
    await wait(200)
    term.writeln(`\x1b[90m  ${line}\x1b[0m`)
  }

  await wait(240)
  if (choices.mode === 'deploy' && !choices.deploy) {
    term.writeln('\x1b[33m未确认部署，已跳过\x1b[0m')
    await wait(160)
  }
  if (choices.mode === 'clean' && !choices.confirmClean) {
    term.writeln('\x1b[33m未确认清理，已跳过\x1b[0m')
    await wait(160)
  }
  term.writeln(`\x1b[36m[scriptio] ${choices.mode} 完成\x1b[0m`)
  term.writeln(`\x1b[90m[scriptio] ${choices.mode} 结束\x1b[0m`)
  term.writeln('\x1b[32m执行成功\x1b[0m')
}

function resolveHandleLines(): string[] {
  const apps = Array.isArray(choices.apps) ? choices.apps : []
  const services = Array.isArray(choices.services) ? choices.services : []
  const appFilter = apps.includes('all')
    ? '--filter "./apps/*"'
    : apps.map(app => `--filter ${app}`).join(' ')
  const serviceFilter = services.includes('all')
    ? '--filter "./services/*"'
    : services.map(service => `--filter ${service}`).join(' ')
  switch (choices.mode) {
    case 'dev':
      return [`pnpm turbo run dev ${appFilter} ${serviceFilter}`]
    case 'typecheck':
      return [
        `pnpm turbo run typecheck ${appFilter} ${serviceFilter}`,
      ]
    case 'test':
      return [`pnpm turbo run test ${appFilter} ${serviceFilter}`]
    case 'build':
      return [`pnpm turbo run build:${String(choices.env)} ${appFilter} ${serviceFilter}`]
    case 'deploy':
      return choices.deploy
        ? [`node scripts/deploy.mjs --apps ${apps.join(',')} --services ${services.join(',')} --env ${String(choices.env)} --tag ${String(choices.tag)}`]
        : []
    case 'clean':
      return choices.confirmClean
        ? [`pnpm turbo run clean ${appFilter} ${serviceFilter}`]
        : []
    default:
      return []
  }
}

function buildArgs(): string {
  return steps.flatMap((step) => {
    const value = choices[step.key]
    if (step.type === 'confirm')
      return value ? [step.param] : []
    if (Array.isArray(value))
      return value.flatMap(item => [step.param, item])
    if (value === undefined || value === '')
      return []
    return [step.param, String(value)]
  }).join(' ')
}

function printHelp() {
  if (!term)
    return
  term.writeln('\x1b[1mUsage:\x1b[0m scriptio [OPTION]...')
  term.writeln('\x1b[90mRun project tasks defined in scriptio.config.ts.\x1b[0m')
  term.writeln('\x1b[90mWhen running in TTY, the CLI will start in interactive mode.\x1b[0m')
  term.writeln('')
  term.writeln('\x1b[1mOptions:\x1b[0m')
  term.writeln('  \x1b[36m-C, --config PATH\x1b[0m  use a specific config file')
  term.writeln('  \x1b[36m-h, --help\x1b[0m        display this help message')
  term.writeln('')
  term.writeln('\x1b[1mStep Options:\x1b[0m')
  for (const step of steps) {
    const flag = step.type === 'confirm'
      ? step.aliases.join(', ')
      : `${step.aliases.join(', ')} VALUE`
    term.writeln(`  \x1b[36m${flag}\x1b[0m  ${step.message}`)
  }
  term.writeln('')
  term.writeln('\x1b[1mPlayground Commands:\x1b[0m')
  term.writeln('  \x1b[36mscriptio\x1b[0m                    start interactive CLI')
  term.writeln('  \x1b[36mpnpm scriptio\x1b[0m               run through pnpm')
  term.writeln('  \x1b[36mscriptio --mode ...\x1b[0m         run with step options')
  term.writeln('  \x1b[36mhelp\x1b[0m / \x1b[36mclear\x1b[0m               show help / clear terminal')
}

function printPrompt() {
  term?.write('\x1b[32m$ \x1b[0m')
}

function clearScreen() {
  if (interactive) {
    interactive = null
  }
  term?.clear()
  printPrompt()
}

function fit() {
  fitAddon?.fit()
}

function wait(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function defaultChoices(): Choices {
  return {
    apps: ['all'],
    confirmClean: false,
    deploy: false,
    env: 'local',
    mode: 'dev',
    services: ['web'],
    tag: '',
  }
}
</script>

<template>
  <div class="flex flex-col items-stretch space-y-6 mt-8 max-w-4xl w-4/5 mx-auto">
    <div class="overflow-hidden rounded-2xl bg-gray-950 shadow-2xl shadow-black/50 ring-1 ring-white/10">
      <div class="flex items-center gap-2 border-b border-white/10 bg-white/[0.02] px-4 py-2.5">
        <div class="flex gap-1.5">
          <span class="size-3 rounded-full bg-red-500/90" />
          <span class="size-3 rounded-full bg-yellow-500/90" />
          <span class="size-3 rounded-full bg-green-500/90" />
        </div>
        <span class="ml-2 font-mono text-xs text-zinc-400">scriptio</span>
        <div class="ml-auto flex items-center gap-2">
          <span class="size-1.5 rounded-full" :class="busy ? 'bg-amber-400' : 'bg-emerald-400'" />
          <button
            type="button"
            class="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-zinc-400 transition hover:bg-white/10 hover:text-zinc-200"
            @click="clearScreen"
          >
            清屏
          </button>
        </div>
      </div>

      <div class="flex flex-wrap items-center gap-1.5 border-b border-white/10 bg-white/[0.02] px-3 py-2">
        <button
          v-for="tab in commandTabs" :key="tab.key" type="button" :aria-pressed="activeTab === tab.key"
          :disabled="busy"
          class="rounded-full px-3 py-1 text-xs transition disabled:cursor-not-allowed disabled:opacity-50" :class="activeTab === tab.key
            ? 'bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-400/30'
            : 'text-zinc-400 hover:bg-white/5 hover:text-zinc-200'" @click="switchTab(tab.key)"
        >
          {{ tab.label }}
        </button>
      </div>
      <div ref="host" class="terminal-host" />
    </div>
    <dl class="flex flex-col items-start gap-1 px-1 font-mono text-xs">
      <dt class="mb-2">
        <h3>可用命令</h3>
      </dt>
      <dd v-for="(command, i) in availableCommands" :key="command" class="flex items-center gap-1 text-zinc-500">
        <span>{{ i + 1 }}.</span>
        <code class="select-all">{{ command }}</code>
      </dd>
    </dl>
  </div>
</template>

<style scoped>
.terminal-host {
  height: 26rem;
  padding: 0.75rem 0.875rem;
  background: #0b0f14;
}

:deep(.xterm) {
  height: 100%;
}

:deep(.xterm .xterm-viewport) {
  background: transparent;
}

:deep(.xterm .xterm-screen) {
  background: transparent;
}

@media (max-width: 640px) {
  .terminal-host {
    height: 22rem;
  }
}
</style>
