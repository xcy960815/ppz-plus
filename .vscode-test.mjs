import path from "node:path";
import { defineConfig } from "@vscode/test-cli";

/**
 * 测试运行配置。
 *
 * CI 环境下：
 * - 单测超时放宽到 20s，避免冷启动 runner 误报；
 * - 改用写入文件的 mocha reporter（scripts/mocha-file-reporter.cjs），
 *   把完整结果写入 /tmp/mocha-report.json，供失败步骤解析失败用例。
 *   原因：JSON 走控制台时会被扩展宿主以 "Output omitted for a large
 *   object" 截断，导致 CI 拿不到失败详情。
 */
const reportFile = "/tmp/mocha-report.json";

export default defineConfig({
  files: "out/test/**/*.test.js",
  ...(process.env.CI
    ? {
        mocha: {
          timeout: 20000,
          reporter: path.resolve("scripts/mocha-file-reporter.cjs"),
        },
        env: {
          MOCHA_JSON_OUTPUT_FILE: reportFile,
        },
      }
    : {}),
});
