import type { Option } from '@clack/prompts'
import type { ScriptEntry, ScriptGroup } from './presentation'
import type { ResolvedScriptMap } from './types'
import { autocomplete, cancel, isCancel } from '@clack/prompts'
import { groupScripts, scriptLabel } from './presentation'

type Selection = ScriptEntry | ScriptGroup | { type: 'back' }

export async function selectScript(scripts: ResolvedScriptMap): Promise<string | undefined> {
  const entries = groupScripts(scripts)
  let current: ScriptGroup | undefined
  while (true) {
    const options = (current ? current.children : entries).map<Option<Selection>>((entry) => {
      if (entry.type === 'group')
        return { hint: `${entry.children.length} 个脚本`, label: entry.name, value: entry }
      return { hint: entry.command, label: scriptLabel(entry), value: entry }
    })
    if (current)
      options.push({ hint: '', label: '← 返回上一级', value: { type: 'back' } })

    const result = await autocomplete({
      maxItems: 8,
      message: current ? `选择 ${current.name} 组内的 Script` : '选择要执行的 Script',
      options,
      placeholder: '输入脚本名或标签搜索',
    })
    if (isCancel(result)) {
      cancel('已取消执行')
      return undefined
    }
    if (result.type === 'script')
      return result.name
    current = result.type === 'group' ? result : undefined
  }
}
