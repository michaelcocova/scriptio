import type { RunOptions, RunResult } from './types'
import { spawn } from 'node:child_process'
import process from 'node:process'

export async function runCommands(
  commands: string | string[],
  options: RunOptions = {
  },
): Promise<RunResult[]> {
  const list = typeof commands === 'string' ? [commands] : commands
  if (options.parallel) {
    return Promise.all(list.map(command => runOne(command, options)))
  }

  const results: RunResult[] = []
  for (const command of list) {
    results.push(await runOne(command, options))
  }
  return results
}

function runOne(command: string, options: RunOptions): Promise<RunResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, {
      cwd: options.cwd ?? process.cwd(),
      env: {
        ...process.env,
        ...options.env,
      },
      shell: options.shell ?? true,
      stdio: 'inherit',
    })
    const timer = options.timeout
      ? setTimeout(() => child.kill('SIGTERM'), options.timeout)
      : undefined

    child.on('error', reject)
    child.on('close', (code, signal) => {
      if (timer) {
        clearTimeout(timer)
      }
      if (code === 0) {
        resolve({
          command,
          exitCode: 0,
          signal,
        })
        return
      }
      const error = new Error(
        `命令执行失败：${command} (exit code ${code ?? signal ?? 'unknown'})`,
      ) as Error & { exitCode?: number }
      error.exitCode = code ?? 1
      reject(error)
    })
  })
}
