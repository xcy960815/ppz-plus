/**
 * 描述 SQL 文件导入执行后的归一化结果。
 */
export interface SqlFileImportResult {
  readonly success: boolean;
  readonly durationMs: number;
  readonly errorMessage?: string;
}
