import type { ScriptCliConfig } from '../src/types'
import { mkdirSync, mkdtempSync, readFileSync, realpathSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import process from 'node:process'
import { pathToFileURL } from 'node:url'
import { autocomplete, autocompleteMultiselect, confirm, multiselect, select, text } from '@clack/prompts'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { buildArgs, parseArgs } from '../src/args'
import { loadConfig } from '../src/config'
import { main } from '../src/index'
import { isCliEntry } from '../src/is-cli-entry'
import { runCommands } from '../src/runner'

const originalIsTTY = process.stdout.isTTY

vi.mock('@clack/prompts', () => ({
  autocomplete: vi.fn(),
  autocompleteMultiselect: vi.fn(),
  cancel: vi.fn(),
  confirm: vi.fn(),
  intro: vi.fn(),
  isCancel: vi.fn(() => false),
  log: {
    error: vi.fn(),
    info: vi.fn(),
    message: vi.fn(),
    step: vi.fn(),
    success: vi.fn(),
    warn: vi.fn(),
  },
  multiselect: vi.fn(),
  outro: vi.fn(),
  select: vi.fn(),
  text: vi.fn(),
}))

afterEach(() => {
  vi.restoreAllMocks()
  Object.defineProperty(process.stdout, 'isTTY', {
    configurable: true,
    value: originalIsTTY,
  })
})

describe('scriptio', () => {
  it('loads scriptio.config.ts by default', async () => {
    const cwd = createTempDir()
    writeFileSync(
      join(cwd, 'scriptio.config.ts'),
      `${defineConfigImport()}
export default defineConfig({
  commands: {
    build: async () => {},
  },
  steps: [
    {
      key: 'mode',
      message: 'mode',
      options: [{ label: 'build', value: 'build' }],
      type: 'select',
    },
  ],
})
`,
    )

    const config = await loadConfig(cwd)

    expect(Object.keys(config.commands)).toEqual(['build'])
    expect(config.steps).toHaveLength(1)
  })

  it('rejects config without commands', async () => {
    const cwd = createTempDir()
    writeFileSync(
      join(cwd, 'scriptio.config.ts'),
      `${defineConfigImport()}
export default defineConfig({
  handle: async () => {},
  steps: [
    {
      key: 'mode',
      message: 'mode',
      options: [{ label: 'build', value: 'build' }],
      type: 'select',
    },
  ],
})
`,
    )

    await expect(loadConfig(cwd)).rejects.toThrow('必须通过 defineConfig 导出 steps 和 commands')
  })

  it('rejects config with empty steps', async () => {
    const cwd = createTempDir()
    writeFileSync(
      join(cwd, 'scriptio.config.ts'),
      `${defineConfigImport()}
export default defineConfig({
  commands: {
    build: async () => {},
  },
  steps: [],
})
`,
    )

    await expect(loadConfig(cwd)).rejects.toThrow('必须通过 defineConfig 导出 steps 和 commands')
  })

  it('prints help without requiring a config file', async () => {
    const cwd = createTempDir()
    const stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true)
    vi.spyOn(process, 'cwd').mockReturnValue(cwd)

    const code = await main(['--help'])

    expect(code).toBe(0)
    expect(stdoutSpy).toHaveBeenCalled()
    expect(stdoutSpy.mock.calls[0]?.[0]).toContain('Usage: scriptio [OPTION]...')
    expect(stdoutSpy.mock.calls[0]?.[0]).toContain('Run project tasks defined in scriptio.config.ts.')
    expect(stdoutSpy.mock.calls[0]?.[0]).toContain('Options:')
    expect(stdoutSpy.mock.calls[0]?.[0]).toContain('Step Options:')
    expect(stdoutSpy.mock.calls[0]?.[0]).toContain('display this help message')
  })

  it('parses select params with equals syntax without skipping later args', () => {
    const config: ScriptCliConfig = {
      commands: {},
      steps: [
        {
          key: 'mode',
          message: 'mode',
          options: [{
            label: 'build',
            value: 'build',
          }],
          param: ['--mode', '-M'],
          type: 'select',
        },
        {
          key: 'app',
          message: 'app',
          options: [{
            label: 'web',
            value: 'web',
          }],
          param: ['--app', '-A'],
          type: 'select',
        },
      ],
    }

    const parsed = parseArgs(['-M=build', '-A=web'], config)

    expect(parsed.values).toEqual({
      app: 'web',
      mode: 'build',
    })
  })

  it('matches symlinked bin entries by real path', () => {
    const dir = createTempDir()
    const real = join(dir, 'index.mjs')
    const link = join(dir, 'node_modules', 'scriptio', 'index.mjs')
    mkdirSync(dirname(link), {
      recursive: true,
    })
    writeFileSync(real, '')
    symlinkSync(real, link)

    const moduleUrl = pathToFileURL(realpathSync(real)).href

    expect(isCliEntry(link, moduleUrl)).toBe(true)
    expect(isCliEntry(link, pathToFileURL(join(dir, 'other.mjs')).href)).toBe(false)
  })

  it('builds args with the first param as the primary output flag', () => {
    const config: ScriptCliConfig = {
      commands: {},
      steps: [
        {
          key: 'mode',
          message: 'mode',
          options: [{
            label: 'build',
            value: 'build',
          }],
          param: ['--mode', '-M'],
          type: 'select',
        },
        {
          key: 'deploy',
          message: 'deploy',
          param: ['--deploy', '-D'],
          type: 'confirm',
        },
      ],
    }

    expect(buildArgs(config, {
      deploy: true,
      mode: 'build',
    })).toEqual(['--mode', 'build', '--deploy'])
  })

  it('parses repeated multiselect params and builds args', () => {
    const config: ScriptCliConfig = {
      commands: {},
      steps: [
        {
          key: 'apps',
          message: 'apps',
          options: [
            {
              label: 'www',
              value: 'www',
            },
            {
              label: 'client',
              value: 'client',
            },
          ],
          param: ['--apps', '-A'],
          type: 'multiselect',
        },
      ],
    }

    expect(parseArgs(['--apps', 'www', '--apps', 'client'], config).values).toEqual({
      apps: ['www', 'client'],
    })
    expect(buildArgs(config, {
      apps: ['www', 'client'],
    })).toEqual(['--apps', 'www', '--apps', 'client'])
  })

  it('parses text and searchable params', () => {
    const config: ScriptCliConfig = {
      commands: {},
      steps: [
        {
          key: 'tag',
          message: 'tag',
          param: '--tag',
          type: 'text',
        },
        {
          key: 'env',
          message: 'env',
          options: [{
            label: 'staging',
            value: 'staging',
          }],
          param: '--env',
          type: 'autocomplete',
        },
        {
          key: 'apps',
          message: 'apps',
          options: [{
            label: 'www',
            value: 'www',
          }],
          param: '--apps',
          type: 'autocompleteMultiselect',
        },
      ],
    }

    expect(parseArgs(['--tag', 'v1', '--env', 'staging', '--apps', 'www'], config).values).toEqual({
      apps: ['www'],
      env: 'staging',
      tag: 'v1',
    })
  })

  it('parses values for every step type', () => {
    const config: ScriptCliConfig = {
      commands: {},
      steps: [
        {
          key: 'mode',
          message: 'mode',
          options: [{ label: 'dev', value: 'dev' }],
          param: '--mode',
          type: 'select',
        },
        {
          key: 'env',
          message: 'env',
          options: [{ label: 'staging', value: 'staging' }],
          param: '--env',
          type: 'autocomplete',
        },
        {
          key: 'apps',
          message: 'apps',
          options: [
            { label: 'web', value: 'web' },
            { label: 'client', value: 'client' },
          ],
          param: '--apps',
          type: 'multiselect',
        },
        {
          key: 'tags',
          message: 'tags',
          options: [
            { label: 'a', value: 'a' },
            { label: 'b', value: 'b' },
          ],
          param: '--tags',
          type: 'autocompleteMultiselect',
        },
        {
          key: 'tag',
          message: 'tag',
          param: '--tag',
          type: 'text',
        },
        {
          key: 'deploy',
          message: 'deploy',
          param: '--deploy',
          type: 'confirm',
        },
      ],
    }

    const parsed = parseArgs([
      '--mode',
      'dev',
      '--env=staging',
      '--apps',
      'web',
      '--apps',
      'client',
      '--tags=a',
      '--tags=b',
      '--tag',
      'v1',
      '--deploy=false',
    ], config)

    expect(parsed.values).toEqual({
      apps: ['web', 'client'],
      deploy: false,
      env: 'staging',
      mode: 'dev',
      tag: 'v1',
      tags: ['a', 'b'],
    })
    expect(buildArgs(config, parsed.values)).toEqual([
      '--mode',
      'dev',
      '--env',
      'staging',
      '--apps',
      'web',
      '--apps',
      'client',
      '--tags',
      'a',
      '--tags',
      'b',
      '--tag',
      'v1',
    ])
  })

  it('keeps --config out of parsed step values', () => {
    const config: ScriptCliConfig = {
      commands: {},
      steps: [
        {
          key: 'mode',
          message: 'mode',
          options: [{ label: 'dev', value: 'dev' }],
          param: '--mode',
          type: 'select',
        },
      ],
    }

    const parsed = parseArgs(['-C', './custom.config.ts', '--mode', 'dev'], config)

    expect(parsed.config).toBe('./custom.config.ts')
    expect(parsed.values).toEqual({
      mode: 'dev',
    })
  })

  it('skips conditional steps in non-interactive mode', async () => {
    const cwd = createTempDir()
    const output = join(cwd, 'out.json')
    writeFileSync(
      join(cwd, 'scriptio.config.ts'),
      `${defineConfigImport()}
import { writeFileSync } from 'node:fs'

export default defineConfig({
  commands: {
    build: async ({ values }) => {
      writeFileSync(${JSON.stringify(output)}, JSON.stringify(values))
    },
    dev: async ({ values }) => {
      writeFileSync(${JSON.stringify(output)}, JSON.stringify(values))
    },
  },
  steps: [
    {
      key: 'mode',
      type: 'select',
      message: 'mode',
      param: '--mode',
      options: [
        { value: 'dev', label: 'dev' },
        { value: 'build', label: 'build' },
      ],
    },
    {
      key: 'clean',
      type: 'confirm',
      message: 'clean',
      param: '--clean',
      condition: values => values.mode === 'build',
    },
  ],
})
`,
    )
    vi.spyOn(process, 'cwd').mockReturnValue(cwd)
    Object.defineProperty(process.stdout, 'isTTY', {
      configurable: true,
      value: false,
    })

    const code = await main(['--mode', 'dev'])

    expect(code).toBe(0)
    expect(JSON.parse(readFileSync(output, 'utf-8'))).toEqual({
      mode: 'dev',
    })

    const buildCode = await main(['--mode', 'build'])

    expect(buildCode).toBe(0)
    expect(JSON.parse(readFileSync(output, 'utf-8'))).toEqual({
      clean: false,
      mode: 'build',
    })
  })

  it('asks conditional steps and multiselect in interactive mode', async () => {
    const cwd = createTempDir()
    const output = join(cwd, 'out.json')
    writeFileSync(
      join(cwd, 'scriptio.config.ts'),
      `${defineConfigImport()}
import { writeFileSync } from 'node:fs'

export default defineConfig({
  commands: {
    build: async ({ values }) => {
      writeFileSync(${JSON.stringify(output)}, JSON.stringify(values))
    },
    dev: async ({ values }) => {
      writeFileSync(${JSON.stringify(output)}, JSON.stringify(values))
    },
  },
  steps: [
    {
      key: 'mode',
      type: 'select',
      message: 'mode',
      param: '--mode',
      options: [
        { value: 'dev', label: 'dev' },
        { value: 'build', label: 'build' },
      ],
    },
    {
      key: 'apps',
      type: 'multiselect',
      message: 'apps',
      param: '--apps',
      options: [
        { value: 'www', label: 'www' },
        { value: 'client', label: 'client' },
      ],
    },
    {
      key: 'clean',
      type: 'confirm',
      message: 'clean',
      param: '--clean',
      condition: values => values.mode === 'build',
    },
  ],
})
`,
    )
    vi.spyOn(process, 'cwd').mockReturnValue(cwd)
    Object.defineProperty(process.stdout, 'isTTY', {
      configurable: true,
      value: true,
    })

    vi.mocked(select).mockResolvedValueOnce('dev')
    vi.mocked(multiselect).mockResolvedValueOnce(['www', 'client'])

    const code = await main([])

    expect(code).toBe(0)
    expect(confirm).not.toHaveBeenCalled()

    vi.mocked(select).mockResolvedValueOnce('build')
    vi.mocked(multiselect).mockResolvedValueOnce(['client'])
    vi.mocked(confirm).mockResolvedValueOnce(false)

    const buildCode = await main([])

    expect(buildCode).toBe(0)
    expect(confirm).toHaveBeenCalledTimes(1)
    expect(JSON.parse(readFileSync(output, 'utf-8'))).toEqual({
      apps: ['client'],
      clean: false,
      mode: 'build',
    })
  })

  it('asks for every step type in interactive mode', async () => {
    const cwd = createTempDir()
    const output = join(cwd, 'out.json')
    writeFileSync(
      join(cwd, 'scriptio.config.ts'),
      `${defineConfigImport()}
import { writeFileSync } from 'node:fs'

export default defineConfig({
  commands: {
    dev: async ({ values }) => {
      writeFileSync(${JSON.stringify(output)}, JSON.stringify(values))
    },
  },
  steps: [
    {
      key: 'mode',
      type: 'select',
      message: 'mode',
      param: '--mode',
      options: [{ label: 'dev', value: 'dev' }],
    },
    {
      key: 'env',
      type: 'autocomplete',
      message: 'env',
      param: '--env',
      options: [{ label: 'staging', value: 'staging' }],
    },
    {
      key: 'apps',
      type: 'multiselect',
      message: 'apps',
      param: '--apps',
      options: [
        { label: 'web', value: 'web' },
        { label: 'client', value: 'client' },
      ],
    },
    {
      key: 'tags',
      type: 'autocompleteMultiselect',
      message: 'tags',
      param: '--tags',
      options: [
        { label: 'a', value: 'a' },
        { label: 'b', value: 'b' },
      ],
    },
    {
      key: 'tag',
      type: 'text',
      message: 'tag',
      param: '--tag',
    },
    {
      key: 'deploy',
      type: 'confirm',
      message: 'deploy',
      param: '--deploy',
    },
  ],
})
`,
    )
    vi.spyOn(process, 'cwd').mockReturnValue(cwd)
    vi.spyOn(console, 'log').mockImplementation(() => {})
    Object.defineProperty(process.stdout, 'isTTY', {
      configurable: true,
      value: true,
    })
    vi.mocked(select).mockResolvedValueOnce('dev')
    vi.mocked(autocomplete).mockResolvedValueOnce('staging')
    vi.mocked(multiselect).mockResolvedValueOnce(['web', 'client'])
    vi.mocked(autocompleteMultiselect).mockResolvedValueOnce(['a', 'b'])
    vi.mocked(text).mockResolvedValueOnce('v1')
    vi.mocked(confirm).mockResolvedValueOnce(true)

    const code = await main([])

    expect(code).toBe(0)
    expect(JSON.parse(readFileSync(output, 'utf-8'))).toEqual({
      apps: ['web', 'client'],
      deploy: true,
      env: 'staging',
      mode: 'dev',
      tag: 'v1',
      tags: ['a', 'b'],
    })
  })

  it('uses defaultValues in non-interactive mode', async () => {
    const cwd = createTempDir()
    const output = join(cwd, 'out.json')
    writeFileSync(
      join(cwd, 'scriptio.config.ts'),
      `${defineConfigImport()}
import { writeFileSync } from 'node:fs'

export default defineConfig({
  commands: {
    build: async ({ values }) => {
      writeFileSync(${JSON.stringify(output)}, JSON.stringify(values))
    },
  },
  steps: [
    {
      key: 'mode',
      type: 'select',
      message: 'mode',
      param: ['--mode', '-M'],
      options: [{ value: 'build', label: 'build' }],
    },
    {
      key: 'app',
      type: 'select',
      message: 'app',
      param: ['--app', '-A'],
      options: [{ value: 'web', label: 'web' }],
    },
    {
      key: 'deploy',
      type: 'confirm',
      message: 'deploy',
      param: ['--deploy', '-D'],
    },
  ],
  defaultValues: {
    app: 'web',
  },
})
`,
    )
    vi.spyOn(process, 'cwd').mockReturnValue(cwd)
    vi.spyOn(console, 'log').mockImplementation(() => {})
    Object.defineProperty(process.stdout, 'isTTY', {
      configurable: true,
      value: false,
    })

    const code = await main(['--mode', 'build'])

    expect(code).toBe(0)
    expect(JSON.parse(readFileSync(output, 'utf-8'))).toEqual({
      app: 'web',
      deploy: false,
      mode: 'build',
    })
  })

  it('uses defaultValues for every step type in non-interactive mode', async () => {
    const cwd = createTempDir()
    const output = join(cwd, 'out.json')
    writeFileSync(
      join(cwd, 'scriptio.config.ts'),
      `${defineConfigImport()}
import { writeFileSync } from 'node:fs'

export default defineConfig({
  commands: {
    build: async ({ values }) => {
      writeFileSync(${JSON.stringify(output)}, JSON.stringify(values))
    },
  },
  defaultValues: {
    apps: ['client'],
    deploy: true,
    env: 'staging',
    mode: 'build',
    tag: 'v1',
    tags: ['a'],
  },
  steps: [
    {
      key: 'mode',
      type: 'select',
      message: 'mode',
      param: '--mode',
      options: [{ label: 'build', value: 'build' }],
    },
    {
      key: 'env',
      type: 'autocomplete',
      message: 'env',
      param: '--env',
      options: [{ label: 'staging', value: 'staging' }],
    },
    {
      key: 'apps',
      type: 'multiselect',
      message: 'apps',
      param: '--apps',
      options: [
        { label: 'web', value: 'web' },
        { label: 'client', value: 'client' },
      ],
    },
    {
      key: 'tags',
      type: 'autocompleteMultiselect',
      message: 'tags',
      param: '--tags',
      options: [
        { label: 'a', value: 'a' },
        { label: 'b', value: 'b' },
      ],
    },
    {
      key: 'tag',
      type: 'text',
      message: 'tag',
      param: '--tag',
    },
    {
      key: 'deploy',
      type: 'confirm',
      message: 'deploy',
      param: '--deploy',
    },
  ],
})
`,
    )
    vi.spyOn(process, 'cwd').mockReturnValue(cwd)
    vi.spyOn(console, 'log').mockImplementation(() => {})
    Object.defineProperty(process.stdout, 'isTTY', {
      configurable: true,
      value: false,
    })

    const code = await main(['--mode', 'build'])

    expect(code).toBe(0)
    expect(JSON.parse(readFileSync(output, 'utf-8'))).toEqual({
      apps: ['client'],
      deploy: true,
      env: 'staging',
      mode: 'build',
      tag: 'v1',
      tags: ['a'],
    })
  })

  it('fails when the first step value has no matching command', async () => {
    const cwd = createTempDir()
    writeFileSync(
      join(cwd, 'scriptio.config.ts'),
      `${defineConfigImport()}
export default defineConfig({
  commands: {
    dev: async () => {},
  },
  steps: [
    {
      key: 'mode',
      type: 'select',
      message: 'mode',
      param: '--mode',
      options: [{ value: 'build', label: 'build' }],
    },
  ],
})
`,
    )
    vi.spyOn(process, 'cwd').mockReturnValue(cwd)
    Object.defineProperty(process.stdout, 'isTTY', {
      configurable: true,
      value: false,
    })

    await expect(main(['--mode', 'build'])).rejects.toThrow('未找到命令：build')
  })

  it('runs success and finally hooks after a successful command', async () => {
    const cwd = createTempDir()
    const successFile = join(cwd, 'success.json')
    const finallyFile = join(cwd, 'finally.json')
    writeFileSync(
      join(cwd, 'scriptio.config.ts'),
      `${defineConfigImport()}
import { writeFileSync } from 'node:fs'

export default defineConfig({
  commands: {
    build: async () => {},
  },
  hooks: {
    finally: async ({ values }) => {
      writeFileSync(${JSON.stringify(finallyFile)}, JSON.stringify(values))
    },
    success: async ({ values }) => {
      writeFileSync(${JSON.stringify(successFile)}, JSON.stringify(values))
    },
  },
  steps: [
    {
      key: 'mode',
      type: 'select',
      message: 'mode',
      param: '--mode',
      options: [{ value: 'build', label: 'build' }],
    },
  ],
})
`,
    )
    vi.spyOn(process, 'cwd').mockReturnValue(cwd)
    vi.spyOn(console, 'log').mockImplementation(() => {})
    Object.defineProperty(process.stdout, 'isTTY', {
      configurable: true,
      value: false,
    })

    const code = await main(['--mode', 'build'])

    expect(code).toBe(0)
    expect(JSON.parse(readFileSync(successFile, 'utf-8'))).toEqual({
      mode: 'build',
    })
    expect(JSON.parse(readFileSync(finallyFile, 'utf-8'))).toEqual({
      mode: 'build',
    })
  })

  it('runs error and finally hooks when a command fails', async () => {
    const cwd = createTempDir()
    const errorFile = join(cwd, 'error.json')
    const finallyFile = join(cwd, 'finally.json')
    writeFileSync(
      join(cwd, 'scriptio.config.ts'),
      `${defineConfigImport()}
import { writeFileSync } from 'node:fs'

export default defineConfig({
  commands: {
    build: async () => {
      throw new Error('build failed')
    },
  },
  hooks: {
    error: async (error, { values }) => {
      writeFileSync(${JSON.stringify(errorFile)}, JSON.stringify({ error: String(error), values }))
    },
    finally: async ({ values }) => {
      writeFileSync(${JSON.stringify(finallyFile)}, JSON.stringify(values))
    },
  },
  steps: [
    {
      key: 'mode',
      type: 'select',
      message: 'mode',
      param: '--mode',
      options: [{ value: 'build', label: 'build' }],
    },
  ],
})
`,
    )
    vi.spyOn(process, 'cwd').mockReturnValue(cwd)
    vi.spyOn(console, 'log').mockImplementation(() => {})
    Object.defineProperty(process.stdout, 'isTTY', {
      configurable: true,
      value: false,
    })

    const code = await main(['--mode', 'build'])

    expect(code).toBe(1)
    expect(JSON.parse(readFileSync(errorFile, 'utf-8'))).toEqual({
      error: 'Error: build failed',
      values: {
        mode: 'build',
      },
    })
    expect(JSON.parse(readFileSync(finallyFile, 'utf-8'))).toEqual({
      mode: 'build',
    })
  })

  it('runs array commands and rejects when a command fails', async () => {
    const dir = createTempDir()
    const first = join(dir, 'first.txt')
    const second = join(dir, 'second.txt')

    await runCommands([
      `node -e 'require("node:fs").writeFileSync(${JSON.stringify(first)}, "first")'`,
      `node -e 'require("node:fs").writeFileSync(${JSON.stringify(second)}, "second")'`,
    ])

    expect(readFileSync(first, 'utf-8')).toBe('first')
    expect(readFileSync(second, 'utf-8')).toBe('second')
    await expect(runCommands('command-that-does-not-exist-12345')).rejects.toThrow('命令执行失败')
  })

  it('runs a single string command', async () => {
    const dir = createTempDir()
    const file = join(dir, 'single.txt')

    await runCommands(`node -e 'require("node:fs").writeFileSync(${JSON.stringify(file)}, "ok")'`)

    expect(readFileSync(file, 'utf-8')).toBe('ok')
  })

  it('propagates the non-zero exit code from a failed command', async () => {
    await expect(runCommands(`node -e 'process.exit(7)'`)).rejects.toMatchObject({
      exitCode: 7,
    })
  })
})

function createTempDir(): string {
  return mkdtempSync(join(tmpdir(), 'scriptio-'))
}

function defineConfigImport(): string {
  return `import { defineConfig } from ${JSON.stringify(resolve(process.cwd(), 'src/index.ts'))}`
}
