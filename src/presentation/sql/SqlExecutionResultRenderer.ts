import type {
	SqlExecutionCellValue,
	SqlExecutionResult,
} from '../../domain/query/SqlExecutionResult';

/**
 * 渲染统一 SQL 执行结果，供不同数据库 SQL 终端复用。
 */
export class SqlExecutionResultRenderer {
	/**
	 * 渲染 SQL 执行结果。
	 *
	 * @param result SQL 执行结果。
	 * @returns 结果区域 HTML。
	 */
	public render(result: SqlExecutionResult): string {
		const status = result.success ? '成功' : '失败';
		const affectedRows =
			result.affectedRows === null ? '-' : String(result.affectedRows);
		const resultHeader = `<div class="result-header">
			<span><strong>${status}</strong></span>
			<span><strong>${result.isQuery ? '查询' : '语句'}</strong></span>
			<span>耗时 <strong>${result.durationMs}</strong> ms</span>
			<span>受影响行数 <strong>${affectedRows}</strong></span>
			<span>结果 <strong>${result.rows.length}</strong> 条</span>
		</div>`;

		if (!result.success) {
			return `${resultHeader}<pre class="error">${this.escapeHtml(
				result.errorMessage ?? '未知 SQL 执行错误。'
			)}</pre>`;
		}

		if (!result.isQuery) {
			return `${resultHeader}<div class="empty-result">语句已执行。</div>`;
		}

		return `${resultHeader}${this.renderResultTable(result)}`;
	}

	/**
	 * 渲染查询结果表格。
	 *
	 * @param result SQL 查询结果。
	 * @returns 表格 HTML。
	 */
	private renderResultTable(result: SqlExecutionResult): string {
		const fields = result.fields;

		if (fields.length === 0) {
			return '<div class="empty-result">未返回字段。</div>';
		}

		const headers = fields
			.map((field) => `<th>${this.escapeHtml(field.name)}</th>`)
			.join('');
		const rows =
			result.rows.length === 0
				? `<tr><td colspan="${fields.length}" class="empty-cell">未返回记录。</td></tr>`
				: result.rows
						.map(
							(row) =>
								`<tr>${fields
									.map((field) => this.renderCell(row[field.name] ?? null))
									.join('')}</tr>`
						)
						.join('');

		return `<div class="table-wrapper">
			<table>
				<thead><tr>${headers}</tr></thead>
				<tbody>${rows}</tbody>
			</table>
		</div>`;
	}

	/**
	 * 渲染单个 SQL 结果单元格。
	 *
	 * @param value 待渲染的单元格值。
	 * @returns HTML 表格单元格标记。
	 */
	private renderCell(value: SqlExecutionCellValue): string {
		if (value === null) {
			return '<td><span class="null-cell">NULL</span></td>';
		}

		return `<td><code>${this.escapeHtml(String(value))}</code></td>`;
	}

	/**
	 * 转义用户可控文本以便安全渲染 HTML。
	 *
	 * @param value 待转义的文本值。
	 * @returns 转义后的 HTML 字符串。
	 */
	private escapeHtml(value: string): string {
		return value
			.replaceAll('&', '&amp;')
			.replaceAll('<', '&lt;')
			.replaceAll('>', '&gt;')
			.replaceAll('"', '&quot;')
			.replaceAll("'", '&#39;');
	}
}
