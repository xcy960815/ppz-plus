/**
 * 描述导入任务执行过程中的一次进度更新。
 */
export interface ImportTaskProgress {
  /**
   * 已完成的导入行数；无法按行统计时为空。
   */
  readonly completedRows?: number;

  /**
   * 本次导入预计处理的总行数；无法按行统计时为空。
   */
  readonly totalRows?: number;

  /**
   * 当前阶段的用户可见说明。
   */
  readonly message: string;

  /**
   * 当前完成百分比，取值范围为 0 到 100。
   */
  readonly percentage?: number;
}

/**
 * 接收导入任务进度更新的回调。
 */
export type ImportTaskProgressReporter = (progress: ImportTaskProgress) => void;
