import type {
	JsonDocument,
	JsonDocumentRow,
	JsonDocumentValue,
} from './JsonDocument';

/**
 * 解析 JSON 对象数组导入文档。
 */
export class JsonDocumentParser {
	/**
	 * 将 JSON 文本解析为字段列表和记录。
	 *
	 * @param content JSON 原始文本。
	 * @returns 解析后的 JSON 导入文档。
	 */
	public parse(content: string): JsonDocument {
		if (content.trim().length === 0) {
			throw new Error('JSON file is empty.');
		}

		const parsedJson = this.parseJson(content);
		if (!Array.isArray(parsedJson)) {
			throw new Error('JSON import file must contain an array of objects.');
		}

		if (parsedJson.length === 0) {
			throw new Error('JSON file does not contain data rows.');
		}

		const headers: string[] = [];
		const seenHeaders = new Set<string>();
		const rows = parsedJson.map((value, index) =>
			this.normalizeRow(value, index + 1, headers, seenHeaders)
		);

		if (headers.length === 0) {
			throw new Error('JSON rows must contain at least one field.');
		}

		return {
			headers,
			rows,
		};
	}

	/**
	 * 解析 JSON 文本并统一错误提示。
	 *
	 * @param content JSON 原始文本。
	 * @returns JSON.parse 返回的未知结构。
	 */
	private parseJson(content: string): unknown {
		try {
			return JSON.parse(content) as unknown;
		} catch (error) {
			throw new Error(
				`Invalid JSON file: ${error instanceof Error ? error.message : String(error)}`
			);
		}
	}

	/**
	 * 将单个 JSON 数组元素归一化为导入行。
	 *
	 * @param value JSON 数组中的单个元素。
	 * @param rowNumber 从 1 开始的 JSON 行号。
	 * @param headers 当前累计的字段列表。
	 * @param seenHeaders 当前已出现的字段名集合。
	 * @returns 可导入的 JSON 行。
	 */
	private normalizeRow(
		value: unknown,
		rowNumber: number,
		headers: string[],
		seenHeaders: Set<string>
	): JsonDocumentRow {
		if (!value || typeof value !== 'object' || Array.isArray(value)) {
			throw new Error(`JSON row ${rowNumber} must be an object.`);
		}

		return Object.fromEntries(
			Object.entries(value).map(([key, cellValue]) => {
				if (key.trim().length === 0) {
					throw new Error(`JSON row ${rowNumber} contains an empty field name.`);
				}

				if (!seenHeaders.has(key)) {
					seenHeaders.add(key);
					headers.push(key);
				}

				return [key, this.normalizeCellValue(cellValue, rowNumber, key)];
			})
		);
	}

	/**
	 * 校验并归一化 JSON 单元格值。
	 *
	 * @param value 原始 JSON 字段值。
	 * @param rowNumber 从 1 开始的 JSON 行号。
	 * @param key 当前字段名。
	 * @returns 可写入 MySQL 的 JSON 字段值。
	 */
	private normalizeCellValue(
		value: unknown,
		rowNumber: number,
		key: string
	): JsonDocumentValue {
		if (
			value === null ||
			typeof value === 'string' ||
			typeof value === 'number' ||
			typeof value === 'boolean'
		) {
			return value;
		}

		throw new Error(
			`JSON row ${rowNumber} field "${key}" contains an unsupported nested value.`
		);
	}
}
