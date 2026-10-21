import type { ScriptEnv } from './types'
import { execFileSync, spawn, spawnSync } from 'node:child_process'
import { constants } from 'node:os'
import { delimiter, dirname, join } from 'node:path'
import process from 'node:process'

interface ProcessInfo {
  pgid: number
  pid: number
  ppid: number
}

export function runScript(command: string, cwd: string, env: ScriptEnv): Promise<number> {
  // 直接调用全局 bin 时也能找到当前项目及工作区中的本地命令。
  const paths: string[] = []
  for (let dir = cwd; ; dir = dirname(dir)) {
    paths.push(join(dir, 'node_modules', '.bin'))
    if (dir === dirname(dir))
      break
  }
  const pathKey = process.platform === 'win32'
    ? Object.keys(env).find(key => key.toLowerCase() === 'path') ?? 'Path'
    : 'PATH'
  const childEnv = { ...env, [pathKey]: [...paths, env[pathKey] ?? ''].join(delimiter) }

  return new Promise((resolve, reject) => {
    const windows = process.platform === 'win32'
    const child = spawn(command, {
      cwd,
      detached: !windows,
      env: childEnv,
      shell: true,
      stdio: 'inherit',
    })
    let interrupted: NodeJS.Signals | undefined
    let timer: ReturnType<typeof setTimeout> | undefined
    let settled = false
    const processGroups = new Set<number>()

    const stopTree = (signal: NodeJS.Signals): void => {
      if (!child.pid)
        return
      if (windows) {
        // Windows 没有 POSIX 进程组，使用系统命令终止整棵子进程树。
        spawnSync('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore' })
      } else {
        // 嵌套 Scriptio 会各自创建 detached 进程组，仅杀外层进程组会留下 dev server。
        for (const group of findProcessGroups(child.pid))
          processGroups.add(group)
        processGroups.add(child.pid)
        const ownGroup = findProcessGroup(process.pid)
        for (const group of processGroups) {
          if (group <= 1 || group === ownGroup)
            continue
          try {
            process.kill(-group, signal)
          } catch (error) {
            if ((error as NodeJS.ErrnoException).code !== 'ESRCH')
              throw error
          }
        }
      }
    }
    const onExit = (): void => stopTree('SIGKILL')
    const finish = (code: number, error?: Error): void => {
      if (settled)
        return
      settled = true
      if (timer)
        clearTimeout(timer)
      stopTree('SIGKILL')
      process.off('SIGINT', onInterrupt)
      process.off('SIGTERM', onTerminate)
      process.off('exit', onExit)
      if (error)
        reject(error)
      else resolve(code)
    }
    const interrupt = (signal: NodeJS.Signals): void => {
      if (interrupted) {
        finish(128 + constants.signals[interrupted])
        return
      }
      interrupted = signal
      stopTree(signal)
      // 给开发服务短暂清理时间；即使 shell 先退出，也保证清理它创建的后代。
      timer = setTimeout(finish, 1000, 128 + constants.signals[signal])
    }
    function onInterrupt(): void {
      interrupt('SIGINT')
    }
    function onTerminate(): void {
      interrupt('SIGTERM')
    }
    process.on('SIGINT', onInterrupt)
    process.on('SIGTERM', onTerminate)
    process.on('exit', onExit)
    child.once('error', error => finish(1, error))
    child.once('close', (code, signal) => {
      if (!interrupted)
        finish(code ?? (signal ? 128 + constants.signals[signal] : 1))
    })
  })
}

function findProcessGroups(rootPid: number): number[] {
  const processes = readProcessTable()
  const byPid = new Map(processes.map(process => [process.pid, process]))
  const children = new Map<number, number[]>()
  const groups = new Set<number>()
  for (const process of processes) {
    const siblings = children.get(process.ppid) ?? []
    siblings.push(process.pid)
    children.set(process.ppid, siblings)
  }
  const pending = [rootPid]
  while (pending.length > 0) {
    const pid = pending.pop()!
    const process = byPid.get(pid)
    if (process)
      groups.add(process.pgid)
    pending.push(...children.get(pid) ?? [])
  }
  return [...groups]
}

function findProcessGroup(pid: number): number | undefined {
  return readProcessTable().find(process => process.pid === pid)?.pgid
}

function readProcessTable(): ProcessInfo[] {
  try {
    const output = execFileSync('ps', ['-eo', 'pid=,ppid=,pgid='], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    })
    return output.split('\n').flatMap((line): ProcessInfo[] => {
      const [pid, ppid, pgid] = line.trim().split(/\s+/).map(Number)
      return Number.isInteger(pid) && Number.isInteger(ppid) && Number.isInteger(pgid)
        ? [{ pgid, pid, ppid }]
        : []
    })
  } catch {
    return []
  }
}
