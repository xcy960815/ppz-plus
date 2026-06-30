/**
 * 表示导入预览中的单元格值。
 */
export type ImportPreviewCellValue = string | number | boolean | null;

/**
 * 表示成功生成的导入预览。
 */
export interface ImportPreviewSuccessResult {
  readonly success: true;
  readonly totalRows: number;
  readonly headers: readonly string[];
  readonly rows: readonly (readonly ImportPreviewCellValue[])[];
}

/**
 * 表示生成失败的导入预览。
 */
export interface ImportPreviewFailureResult {
  readonly success: false;
  readonly errorMessage: string;
}

/**
 * 描述导入预览结果。
 */
export type ImportPreviewResult = ImportPreviewSuccessResult | ImportPreviewFailureResult;
