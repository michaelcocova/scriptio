import antfu from '@antfu/eslint-config'

export default antfu({
  formatters: true,
  vue: true,
}, {
  files: ['**/*.ts', '**/*.mjs', '**/*.json'],
  rules: {
    'no-console': 'warn',
    /**
     * 允许字符串中出现模板字符串占位符。
     */
    'no-template-curly-in-string': 'off',
    /**
     * 强制对象使用多行格式。
     */
    'object-curly-newline': [
      'error',
      {
        ExportDeclaration: 'never',
        ImportDeclaration: 'never',
        ObjectExpression: 'always',
        ObjectPattern: 'always',
      },
    ],
    /**
     * 自动排序 TypeScript enum 成员。
     */
    'perfectionist/sort-enums': [
      'error',
      {
        ignoreCase: false,
        order: 'asc',
        type: 'alphabetical',
      },
    ],
    /**
     * 自动排序 interface 属性。
     */
    'perfectionist/sort-interfaces': [
      'error',
      {
        ignoreCase: false,
        order: 'asc',
        type: 'alphabetical',
      },
    ],
    /**
     * 自动排序 export 中的具名成员。
     */
    'perfectionist/sort-named-exports': [
      'error',
      {
        ignoreCase: false,
        order: 'asc',
        type: 'alphabetical',
      },
    ],

    /**
     * 自动排序 import 中的具名成员。
     */
    'perfectionist/sort-named-imports': [
      'error',
      {
        ignoreCase: false,
        order: 'asc',
        type: 'alphabetical',
      },
    ],

    /**
     * 自动排序 object type 属性。
     */
    'perfectionist/sort-object-types': [
      'error',
      {
        ignoreCase: false,
        order: 'asc',
        type: 'alphabetical',
      },
    ],

    /**
     * 自动排序对象属性。
     *
     * 主要用于：
     * - 国际化文案
     * - 配置对象
     * - 普通 Object
     */
    'perfectionist/sort-objects': [
      'error',
      {
        ignoreCase: false,
        order: 'asc',
        type: 'alphabetical',
      },
    ],

    'style/brace-style': ['error', '1tbs'],

    'ts/ban-ts-comment': 'off',

    'unused-imports/no-unused-imports': 'error',

    'unused-imports/no-unused-vars': ['warn', {
      args: 'after-used',
      argsIgnorePattern: '^_',
      vars: 'all',
      varsIgnorePattern: '^_',
    }],
  },
}, {
  files: ['**/*.md', '**/*.md/*.{js,cjs,mjs,jsx,ts,tsx,vue}'],
  rules: {
    'no-console': 'off',
    'node/handle-callback-err': 'off',
    'object-curly-newline': 'off',
    'perfectionist/sort-enums': 'off',
    'perfectionist/sort-interfaces': 'off',
    'perfectionist/sort-named-exports': 'off',
    'perfectionist/sort-named-imports': 'off',
    'perfectionist/sort-object-types': 'off',
    'perfectionist/sort-objects': 'off',
    'style/brace-style': 'off',
    'ts/ban-ts-comment': 'off',
    'unused-imports/no-unused-imports': 'off',
    'unused-imports/no-unused-vars': 'off',
  },
})
