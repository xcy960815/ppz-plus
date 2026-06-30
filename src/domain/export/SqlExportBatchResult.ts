import type { SqlExportKind } from "./SqlExportDocument";

/**
 * 描述批量 SQL 导出中的单表目标。
 */
export interface SqlExportBatchTableTarget {
  /**
   * 保存表所在的 schema 名称。
   */
  readonly schemaName: string;

  /**
   * 保存需要导出的表名。
   */
  readonly tableName: string;
}

/**
 * 描述批量 SQL 导出中的单表成功结果。
 */
export interface SqlExportBatchSuccessItem extends SqlExportBatchTableTarget {
  /**
   * 保存生成后的 SQL 文件路径。
   */
  readonly filePath: string;

  /**
   * 保存该表导出开始时间。
   */
  readonly startedAt: string;

  /**
   * 保存该表导出结束时间。
   */
  readonly endedAt: string;

  /**
   * 保存该表导出耗时毫秒数。
   */
  readonly durationMs: number;
}

/**
 * 描述批量 SQL 导出中的单表失败结果。
 */
export interface SqlExportBatchFailureItem extends SqlExportBatchTableTarget {
  /**
   * 保存失败时原计划写入的 SQL 文件路径。
   */
  readonly filePath?: string;

  /**
   * 保存失败错误信息。
   */
  readonly errorMessage: string;

  /**
   * 保存该表导出开始时间。
   */
  readonly startedAt: string;

  /**
   * 保存该表导出结束时间。
   */
  readonly endedAt: string;

  /**
   * 保存该表导出耗时毫秒数。
   */
  readonly durationMs: number;
}

/**
 * 描述一次批量 SQL 导出的汇总结果。
 */
export interface SqlExportBatchResult {
  /**
   * 保存本次批量导出的 SQL 内容类型。
   */
  readonly kind: SqlExportKind;

  /**
   * 保存批量导出的目标目录。
   */
  readonly targetDirectory: string;

  /**
   * 保存本次请求导出的表总数。
   */
  readonly totalCount: number;

  /**
   * 保存成功导出的表数量。
   */
  readonly successCount: number;

  /**
   * 保存导出失败的表数量。
   */
  readonly failureCount: number;

  /**
   * 保存逐表成功结果。
   */
  readonly successes: readonly SqlExportBatchSuccessItem[];

  /**
   * 保存逐表失败结果。
   */
  readonly failures: readonly SqlExportBatchFailureItem[];
}
