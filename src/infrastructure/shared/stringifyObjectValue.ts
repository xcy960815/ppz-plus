/**
 * 将对象值转换为可导出的字符串。
 *
 * @param {object} value 原始对象值。
 * @returns {string} 可写入 SQL 字面量或执行结果单元格的字符串。
 */
export function stringifyObjectValue(value: object): string {
	try {
		const serializedValue = JSON.stringify(value);
		return typeof serializedValue === 'string' ? serializedValue : String(value);
	} catch {
		return String(value);
	}
}
