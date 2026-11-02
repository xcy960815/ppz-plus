import path from "node:path";
import { fileURLToPath } from "node:url";
import typescriptEslint from "typescript-eslint";
import eslintConfigPrettier from "eslint-config-prettier";

const tsconfigRootDir = path.dirname(fileURLToPath(import.meta.url));

export default [
  {
    ignores: ["**/*.mjs", "**/*.cjs", "docs/**/*"],
  },
  {
    files: ["**/*.ts"],
    plugins: {
      "@typescript-eslint": typescriptEslint.plugin,
    },

    languageOptions: {
      parser: typescriptEslint.parser,
      ecmaVersion: 2022,
      sourceType: "module",
      parserOptions: {
        projectService: true,
        tsconfigRootDir,
      },
    },

    rules: {
      "@typescript-eslint/naming-convention": [
        "warn",
        {
          selector: "import",
          format: ["camelCase", "PascalCase"],
        },
      ],
      "@typescript-eslint/no-explicit-any": [
        "error",
        {
          fixToUnknown: true,
          ignoreRestArgs: false,
        },
      ],
      "@typescript-eslint/no-unsafe-argument": "warn",
      "@typescript-eslint/no-unsafe-assignment": "warn",
      "@typescript-eslint/no-unsafe-call": "warn",
      "@typescript-eslint/no-unsafe-member-access": "warn",
      "@typescript-eslint/no-unsafe-return": "warn",
      "@typescript-eslint/use-unknown-in-catch-callback-variable": "error",

      curly: "warn",
      eqeqeq: "warn",
      "no-throw-literal": "warn",
      semi: "warn",

      // 禁止在循环体或 forEach 回调内注册测试：同一条语句会生成多个测试项，
      // VS Code 测试框架会因无法区分而报告 Duplicate tests 警告。
      "no-restricted-syntax": [
        "error",
        {
          selector:
            ":matches(ForStatement, ForInStatement, ForOfStatement, WhileStatement, DoWhileStatement) CallExpression[callee.name=/^(test|it|describe|suite)$/]",
          message:
            "不得在循环体内调用 test/it/describe/suite 注册测试，请在循环外为每个用例写成显式测试。",
        },
        {
          selector:
            "CallExpression[callee.property.name='forEach'] CallExpression[callee.name=/^(test|it|describe|suite)$/]",
          message:
            "不得在 forEach 回调内调用 test/it/describe/suite 注册测试，请在回调外为每个用例写成显式测试。",
        },
      ],
    },
  },
  eslintConfigPrettier,
];
