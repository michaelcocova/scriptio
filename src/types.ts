export interface ScriptDefinition {
  command: string
  group?: string
  label?: string
}

export type ScriptCommand = string | ScriptDefinition
export type ScriptMap = Record<string, ScriptCommand>
export type ResolvedScriptMap = Record<string, ScriptDefinition>
export type ScriptEnv = Record<string, string | undefined>
export type ScriptEnvConfig = Record<string, ScriptEnv>
export type ScriptConfig = ScriptMap | ScriptMap[]

export interface UserConfig {
  env?: ScriptEnvConfig
  scripts: ScriptConfig
}

export type ScriptioConfig = UserConfig

export type MatrixValues = Record<string, readonly string[]>
export type MatrixContext<V extends MatrixValues> = {
  [K in keyof V]: V[K][number]
}

export type MaybeFn<T, V extends MatrixValues> = T | ((values: MatrixContext<V>) => T)

export type MatrixOptions<V extends MatrixValues> = {
  group?: string
  label?: MaybeFn<string, V>
  name: MaybeFn<string, V>
  values: V
} & (
  | { command: (context: MatrixContext<V>) => string, template?: never }
  | { command?: never, template: string }
)

export interface ScriptsContext {
  matrix: <const V extends MatrixValues>(options: MatrixOptions<V>) => ScriptMap
}

export interface EnvContext {
  each: <const V extends readonly string[]>(
    values: V,
    pattern: string,
    variables: (value: V[number]) => ScriptEnv,
  ) => ScriptEnvConfig
  env: (pattern: string, variables: ScriptEnv) => ScriptEnvConfig
}
