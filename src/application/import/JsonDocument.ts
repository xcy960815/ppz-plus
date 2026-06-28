/**
 * 表示 JSON 导入支持的单元格值。
 */
export type JsonDocumentValue = string | number | boolean | null;

/**
 * 表示 JSON 单行记录。
 */
export type JsonDocumentRow = Readonly<Record<string, JsonDocumentValue>>;

/**
 * 表示解析后的 JSON 导入文档。
 */
export interface JsonDocument {
	readonly headers: readonly string[];
	readonly rows: readonly JsonDocumentRow[];
}
