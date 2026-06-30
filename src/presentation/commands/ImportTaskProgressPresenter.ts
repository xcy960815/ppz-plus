import * as vscode from "vscode";

import type {
  ImportTaskProgress,
  ImportTaskProgressReporter,
} from "../../domain/import/ImportTaskProgress";

/**
 * 将导入任务进度转成 VS Code 进度通知。
 *
 * @param progress VS Code 进度通知句柄。
 * @returns 应用层可调用的导入进度回调。
 */
export function createVsCodeImportTaskProgressReporter(
  progress: vscode.Progress<{
    message?: string;
    increment?: number;
  }>,
): ImportTaskProgressReporter {
  let reportedPercentage = 0;

  return (taskProgress: ImportTaskProgress) => {
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
