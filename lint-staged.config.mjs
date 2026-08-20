/**
 * 仅处理已暂存文件，避免在提交前扫描整个仓库。
 * 当前只做格式化，保证提交内容的基本一致性。
 */
const config = {
  '*.{json,md,yml,yaml}': ['prettier --write'],
  '*.{ts,js,vue,mjs,cjs}': ['eslint --fix'],
}

export default config
