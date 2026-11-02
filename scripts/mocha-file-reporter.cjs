"use strict";

/**
 * 写入文件的 Mocha reporter（在 VS Code 扩展宿主进程内运行）。
 *
 * 背景：CI 下 mocha 的 JSON reporter 会把完整结果作为单个超大 console 对象
 * 输出，被扩展宿主的远程控制台以 "Output omitted for a large object" 截断，
 * 导致 CI 日志拿不到失败详情。本 reporter 通过 fs 直接把结果写入文件，
 * 绕过控制台管道。
 *
 * 输出路径由环境变量 MOCHA_JSON_OUTPUT_FILE 指定，默认 /tmp/mocha-report.json。
 */

const fs = require("node:fs");

/**
 * reporter 工厂，接收 mocha runner 并订阅 pass / fail / end 事件。
 *
 * @param {import("mocha").Runner} runner mocha 事件源。
 */
module.exports = function fileReporter(runner) {
  /**
   * 收集通过用例。
   */
  const passes = [];

  /**
   * 收集失败用例。
   */
  const failures = [];

  /**
   * 记录起始时间，用于统计总时长。
   */
  const startedAt = Date.now();

  runner.on("pass", (test) => {
    passes.push({
      fullTitle: test.fullTitle(),
      title: test.title,
      duration: test.duration,
    });
  });

  runner.on("fail", (test, err) => {
    failures.push({
      fullTitle: test.fullTitle(),
      title: test.title,
      err: {
        message: err instanceof Error ? err.message : String(err),
        stack: err instanceof Error ? err.stack : undefined,
      },
    });
  });

  runner.once("end", () => {
    const payload = {
      stats: {
        passes: passes.length,
        failures: failures.length,
        tests: passes.length + failures.length,
        durationMs: Date.now() - startedAt,
      },
      passes,
      failures,
    };

    const target = process.env.MOCHA_JSON_OUTPUT_FILE || "/tmp/mocha-report.json";
    try {
      fs.writeFileSync(target, JSON.stringify(payload, null, 2));
    } catch (error) {
      process.stderr.write(
        `mocha-file-reporter 写入 ${target} 失败: ${error instanceof Error ? error.message : String(error)}\n`,
      );
    }
  });
};
