/**
 * 表示成功生成的 SQL 文件导入预览。
 */
export interface SqlFileImportPreviewSuccessResult {
	readonly success: true;
	readonly totalLines: number;
	readonly previewText: string;
}

/**
 * 表示生成失败的 SQL 文件导入预览。
 */
export interface SqlFileImportPreviewFailureResult {
	readonly success: false;
	readonly errorMessage: string;
}

/**
 * 描述 SQL 文件导入预览结果。
 */
export type SqlFileImportPreviewResult =
	| SqlFileImportPreviewSuccessResult
	| SqlFileImportPreviewFailureResult;
