import globals from 'globals'
import pluginJs from '@eslint/js'
import tseslint from 'typescript-eslint'
import pluginReact from 'eslint-plugin-react'
import pluginImport from 'eslint-plugin-import'

/** @type {import('eslint').Linter.Config[]} */
export default [
  {
    files: ['**/*.{js,mjs,cjs,ts,jsx,tsx}'],
    rules: {
      'import/order': [
        'error',
        {
          groups: ['builtin', ['sibling', 'parent'], 'index', 'object'],
        },
      ],
      'import/no-unresolved': 'off',
      'no-unused-vars': 'off',
    },
  },
  { languageOptions: { globals: { ...globals.browser, ...globals.node } } },
  pluginImport.flatConfigs.recommended,
  pluginJs.configs.recommended,
  ...tseslint.configs.stylistic,
  pluginReact.configs.flat.recommended,
]
