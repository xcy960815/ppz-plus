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
	 * @param {string} content JSON 原始文本。
	 * @returns {JsonDocument} 解析后的 JSON 导入文档。
	 */
	public parse(content: string): JsonDocument {
		if (content.trim().length === 0) {
			throw new Error('JSON 文件为空。');
		}

		const parsedJson = this.parseJson(content);
		if (!Array.isArray(parsedJson)) {
			throw new Error('JSON 导入文件必须是对象数组。');
		}

		if (parsedJson.length === 0) {
			throw new Error('JSON 文件不包含数据行。');
		}

		const headers: string[] = [];
		const seenHeaders = new Set<string>();
		const rows = parsedJson.map((value, index) =>
			this.normalizeRow(value, index + 1, headers, seenHeaders)
		);

		if (headers.length === 0) {
			throw new Error('JSON 数据行至少需要包含一个字段。');
		}

		return {
			headers,
			rows,
		};
	}

	/**
	 * 解析 JSON 文本并统一错误提示。
	 *
	 * @param {string} content JSON 原始文本。
	 * @returns {unknown} JSON.parse 返回的未知结构。
	 */
	private parseJson(content: string): unknown {
		try {
			return JSON.parse(content) as unknown;
		} catch (error) {
			throw new Error(
				`JSON 文件格式无效：${error instanceof Error ? error.message : String(error)}`
			);
		}
	}

	/**
	 * 将单个 JSON 数组元素归一化为导入行。
	 *
	 * @param {unknown} value JSON 数组中的单个元素。
	 * @param {number} rowNumber 从 1 开始的 JSON 行号。
	 * @param {string[]} headers 当前累计的字段列表。
	 * @param {Set<string>} seenHeaders 当前已出现的字段名集合。
	 * @returns {JsonDocumentRow} 可导入的 JSON 行。
	 */
	private normalizeRow(
		value: unknown,
		rowNumber: number,
		headers: string[],
		seenHeaders: Set<string>
	): JsonDocumentRow {
		if (!value || typeof value !== 'object' || Array.isArray(value)) {
			throw new Error(`JSON 第 ${rowNumber} 行必须是对象。`);
		}

		return Object.fromEntries(
			Object.entries(value).map(([key, cellValue]) => {
				if (key.trim().length === 0) {
					throw new Error(`JSON 第 ${rowNumber} 行包含空字段名。`);
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
	 * @param {unknown} value 原始 JSON 字段值。
	 * @param {number} rowNumber 从 1 开始的 JSON 行号。
	 * @param {string} key 当前字段名。
	 * @returns {JsonDocumentValue} 可写入 MySQL 的 JSON 字段值。
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
			`JSON 第 ${rowNumber} 行字段“${key}”包含不支持的嵌套值。`
		);
	}
}
