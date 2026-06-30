/**
 * 按旧 PPZ 的本地时间展示规则格式化 SQL 执行结果中的 Date。
 *
 * @param value 数据库驱动返回的 Date 值。
 * @returns 面向 SQL 结果表展示的本地时间字符串。
 */
export function formatDateCellValue(value: Date): string {
	return [
		padDatePart(value.getFullYear(), 4),
		'-',
		padDatePart(value.getMonth() + 1, 2),
		'-',
		padDatePart(value.getDate(), 2),
		' ',
		padDatePart(value.getHours(), 2),
		':',
		padDatePart(value.getMinutes(), 2),
		':',
		padDatePart(value.getSeconds(), 2),
		'.',
		padDatePart(value.getMilliseconds(), 3),
	].join('');
}

/**
 * 将日期时间数字补齐到固定宽度。
 *
 * @param value 日期时间数字片段。
 * @param width 目标宽度。
 * @returns 补零后的数字片段。
 */
function padDatePart(value: number, width: number): string {
	return String(value).padStart(width, '0');
}
