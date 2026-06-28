/**
 * 描述 SQL 导出任务执行过程中的一次进度更新。
 */
export interface SqlExportTaskProgress {
	/**
	 * 已完成的导出对象数量；无法统计时为空。
	 */
	readonly completedItems?: number;

	/**
	 * 本次导出预计处理的对象总数；无法统计时为空。
	 */
	readonly totalItems?: number;

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
 * 接收 SQL 导出任务进度更新的回调。
 */
export type SqlExportTaskProgressReporter = (
	progress: SqlExportTaskProgress
) => void;
