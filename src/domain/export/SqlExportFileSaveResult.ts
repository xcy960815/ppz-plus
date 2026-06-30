/**
 * 描述 SQL 导出文件保存成功后的结果。
 */
export interface SqlExportFileSaveSuccessResult {
  readonly success: true;
  readonly filePath: string;
}

/**
 * 描述 SQL 导出文件保存失败后的结果。
 */
export interface SqlExportFileSaveFailureResult {
  readonly success: false;
  readonly filePath?: string;
  readonly errorMessage: string;
}

/**
 * 描述 SQL 导出文件保存的归一化结果。
 */
export type SqlExportFileSaveResult =
  SqlExportFileSaveSuccessResult | SqlExportFileSaveFailureResult;
