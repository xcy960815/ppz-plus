/**
 * 表示 CSV 单行记录。
 */
export type CsvDocumentRow = Readonly<Record<string, string>>;

/**
 * 表示解析后的 CSV 文档。
 */
export interface CsvDocument {
	readonly headers: readonly string[];
	readonly rows: readonly CsvDocumentRow[];
}
