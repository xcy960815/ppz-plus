import * as vscode from "vscode";

import type {
  SqlExportTaskProgress,
  SqlExportTaskProgressReporter,
} from "../../domain/export/SqlExportTaskProgress";

/**
 * 将 SQL 导出任务进度转成 VS Code 进度通知。
 *
 * @param progress VS Code 进度通知句柄。
 * @returns 应用层可调用的 SQL 导出进度回调。
 */
export function createVsCodeSqlExportTaskProgressReporter(
  progress: vscode.Progress<{
    message?: string;
    increment?: number;
  }>,
): SqlExportTaskProgressReporter {
  let reportedPercentage = 0;

  return (taskProgress: SqlExportTaskProgress) => {
    const nextPercentage = taskProgress.percentage;
    const increment =
      typeof nextPercentage === "number"
        ? Math.max(0, nextPercentage - reportedPercentage)
        : undefined;

    if (typeof nextPercentage === "number") {
      reportedPercentage = Math.max(reportedPercentage, nextPercentage);
    }

    progress.report({
      message: taskProgress.message,
      ...(typeof increment === "number" ? { increment } : {}),
    });
  };
}
