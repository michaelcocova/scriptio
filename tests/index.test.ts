import type { ScriptCliConfig } from '../src/types'
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import process from 'node:process'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { buildArgs, parseArgs } from '../src/args'
import { loadConfig } from '../src/config'
import { main } from '../src/index'

const originalIsTTY = process.stdout.isTTY

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
  steps: [],
  handle: async () => {},
})
`,
    )

    const config = await loadConfig(cwd)

    expect(config.steps).toEqual([])
  })

  it('prints help without requiring a config file', async () => {
    const cwd = createTempDir()
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    vi.spyOn(process, 'cwd').mockReturnValue(cwd)

    const code = await main(['--help'])

    expect(code).toBe(0)
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('默认 scriptio.config.ts'))
  })

  it('parses select params with equals syntax without skipping later args', () => {
    const config: ScriptCliConfig = {
      handle: async () => {},
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

  it('builds args with the first param as the primary output flag', () => {
    const config: ScriptCliConfig = {
      handle: async () => {},
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

  it('uses defaultValues in non-interactive mode', async () => {
    const cwd = createTempDir()
    const output = join(cwd, 'out.json')
    writeFileSync(
      join(cwd, 'scriptio.config.ts'),
      `${defineConfigImport()}
import { writeFileSync } from 'node:fs'

export default defineConfig({
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
  handle: async ({ values }) => {
    writeFileSync(${JSON.stringify(output)}, JSON.stringify(values))
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
})

function createTempDir(): string {
  return mkdtempSync(join(tmpdir(), 'scriptio-'))
}

function defineConfigImport(): string {
  return `import { defineConfig } from ${JSON.stringify(resolve(process.cwd(), 'src/index.ts'))}`
}
