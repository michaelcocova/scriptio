import { spawn } from 'node:child_process'

export async function runCommands(command: string | string[]): Promise<void> {
  const list = typeof command === 'string' ? [command] : command
  await Promise.all(list.map(runOne))
}

function runOne(command: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, {
      shell: true,
      stdio: 'inherit',
    })

    child.on('error', reject)
    child.on('close', (code, signal) => {
      if (code === 0) {
        resolve()
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
