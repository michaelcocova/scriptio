const config = {
  // 提交消息生成后立即校验，强制约束为 Conventional Commits 风格。
  'commit-msg': 'npx --no -- commitlint --edit $1',

  // 提交前仅处理已暂存文件，保证提交反馈足够快。
  'pre-commit': 'npx lint-staged --config lint-staged.config.mjs',
}

export default config
