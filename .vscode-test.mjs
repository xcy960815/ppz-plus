import { defineConfig } from "@vscode/test-cli";

/**
 * 测试运行配置。
 *
 * CI 环境下改用 JSON reporter 并放宽单测超时：
 * JSON 输出便于失败时用脚本提取失败用例（无 ANSI 颜色码干扰），
 * 宽松超时避免冷启动 runner 上的误报。
 */
export default defineConfig({
  files: "out/test/**/*.test.js",
  ...(process.env.CI
    ? {
        mocha: {
          reporter: "json",
          timeout: 20000,
        },
      }
    : {}),
});
