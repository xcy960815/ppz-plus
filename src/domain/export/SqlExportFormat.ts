/**
 * 表示 SQL 导出文档的输出格式标识。
 */
export type SqlExportFormatId = 'sql';

/**
 * 描述一个可扩展的 SQL 导出输出格式。
 */
export interface SqlExportFormat {
	/**
	 * 保存导出格式的稳定标识。
	 */
	readonly id: SqlExportFormatId;

	/**
	 * 保存面向用户展示的格式名称。
	 */
	readonly label: string;

	/**
	 * 保存该格式对应的文件扩展名，不包含点号。
	 */
	readonly fileExtension: string;

	/**
	 * 保存 VS Code 文件选择器中展示的过滤器名称。
	 */
	readonly dialogFilterLabel: string;
}

/**
 * 保存当前 MySQL MVP 默认支持的 SQL 导出格式。
 */
export const SQL_EXPORT_FORMAT: SqlExportFormat = {
	id: 'sql',
	label: 'SQL',
	fileExtension: 'sql',
	dialogFilterLabel: 'SQL files',
};

/**
 * 保存当前可用的 SQL 导出格式列表。
 */
export const SQL_EXPORT_FORMATS: readonly SqlExportFormat[] = [
	SQL_EXPORT_FORMAT,
];

/**
 * 按格式标识读取导出格式描述。
 *
 * @param formatId 需要读取的导出格式标识。
 * @returns 对应的导出格式描述。
 */
export function getSqlExportFormat(formatId: SqlExportFormatId): SqlExportFormat {
	const format = SQL_EXPORT_FORMATS.find((item) => item.id === formatId);

	if (!format) {
		throw new Error(`Unsupported SQL export format: ${formatId}.`);
	}

	return format;
}
