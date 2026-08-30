export type StepValue = string | boolean | string[]
export type StepParam = string | string[]

export interface StepBase {
  condition?: (values: Record<string, StepValue>) => boolean
  key: string
  message: string
  param?: StepParam
}

export interface SelectStep extends StepBase {
  options: Array<{ label: string, value: string }>
  type: 'select'
}

export interface ConfirmStep extends StepBase {
  type: 'confirm'
}

export interface AutocompleteStep extends StepBase {
  options: Array<{ label: string, value: string }>
  type: 'autocomplete'
}

export interface MultiselectStep extends StepBase {
  options: Array<{ label: string, value: string }>
  type: 'multiselect'
}

export interface AutocompleteMultiselectStep extends StepBase {
  options: Array<{ label: string, value: string }>
  type: 'autocompleteMultiselect'
}

export interface TextStep extends StepBase {
  type: 'text'
}

export type Step
  = | AutocompleteMultiselectStep
    | AutocompleteStep
    | ConfirmStep
    | MultiselectStep
    | SelectStep
    | TextStep

export type Run = (command: string | string[]) => Promise<void>

export interface CommandContext {
  run: Run
  values: Record<string, StepValue>
}

export type Command = (context: CommandContext) => void | Promise<void>

export interface Hooks {
  error?: (error: unknown, context: Pick<CommandContext, 'values'>) => void | Promise<void>
  finally?: (context: Pick<CommandContext, 'values'>) => void | Promise<void>
  success?: (context: Pick<CommandContext, 'values'>) => void | Promise<void>
}

export interface ScriptCliConfig {
  commands: Record<string, Command>
  defaultValues?: Record<string, StepValue>
  hooks?: Hooks
  steps: Step[]
}
