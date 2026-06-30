import type {
	SqlExecutionCellValue,
	SqlExecutionField,
	SqlExecutionResult,
	SqlExecutionResultMetadataEntry,
	SqlExecutionResultSet,
} from '../../domain/query/SqlExecutionResult';

/**
 * 渲染统一 SQL 执行结果，供不同数据库 SQL 终端复用。
 */
export class SqlExecutionResultRenderer {
	/**
	 * 渲染 SQL 执行结果。
	 *
	 * @param {SqlExecutionResult} result SQL 执行结果。
	 * @returns {string} 结果区域 HTML。
	 */
	public render(result: SqlExecutionResult): string {
		if (!result.success) {
			return `<div class="result-view">
				<div class="error-view">
					<p>${this.escapeHtml(result.errorMessage ?? '未知 SQL 执行错误。')}</p>
				</div>
			</div>`;
		}

		const resultSets = this.resolveResultSets(result);
		const firstResultSet = resultSets[0];
		const resultCountText =
			resultSets.length === 1 && firstResultSet?.isQuery
				? `<span>, 共 ${firstResultSet.rows.length} 条结果</span>`
				: '';
		const body =
			resultSets.length > 1
				? this.renderMultipleResultSets(resultSets)
				: this.renderResultSet(firstResultSet);

		return `<div class="result-view">
			<p>
				<span>已执行, 耗时 ${result.durationMs} ms</span>
				${resultCountText}
			</p>
			${body}
		</div>`;
	}

	/**
	 * 解析结果中可渲染的结果集列表。
	 *
	 * @param {SqlExecutionResult} result SQL 执行结果。
	 * @returns {readonly SqlExecutionResultSet[]} 结果集列表。
	 */
	private resolveResultSets(
		result: SqlExecutionResult
	): readonly SqlExecutionResultSet[] {
		if (result.resultSets.length > 0) {
			return result.resultSets;
		}

		return [
			{
				isQuery: result.isQuery,
				fields: result.fields,
				rows: result.rows,
				affectedRows: result.affectedRows,
				metadata: [],
			},
		];
	}

	/**
	 * 渲染多个 SQL 结果集。
	 *
	 * @param {readonly SqlExecutionResultSet[]} resultSets SQL 结果集列表。
	 * @returns {string} 多结果 HTML。
	 */
	private renderMultipleResultSets(
		resultSets: readonly SqlExecutionResultSet[]
	): string {
		return resultSets
			.map((resultSet, index) => {
				const countText = resultSet.isQuery
					? `<span>共 ${resultSet.rows.length} 条结果</span>`
					: '';
				return `<details>
					<summary>
						<span>No.${index + 1}</span>
						${countText}
					</summary>
					${this.renderResultSet(resultSet)}
				</details>`;
			})
			.join('');
	}

	/**
	 * 渲染单个 SQL 结果集。
	 *
	 * @param {SqlExecutionResultSet | undefined} resultSet SQL 结果集。
	 * @returns {string} 单结果 HTML。
	 */
	private renderResultSet(resultSet: SqlExecutionResultSet | undefined): string {
		if (!resultSet) {
			return '<div class="empty-result">语句已执行。</div>';
		}

		if (resultSet.isQuery) {
			return this.renderDataTable(resultSet.fields, resultSet.rows);
		}

		return this.renderKeyValueTable(resultSet.metadata);
	}

	/**
	 * 渲染查询结果表格。
	 *
	 * @param {readonly SqlExecutionField[]} fields 查询字段。
	 * @param {readonly Record<string, SqlExecutionCellValue>[]} rows 查询记录。
	 * @returns {string} 表格 HTML。
	 */
	private renderDataTable(
		fields: readonly SqlExecutionField[],
		rows: readonly Record<string, SqlExecutionCellValue>[]
	): string {
		if (fields.length === 0) {
			return '<div class="empty-result">未返回字段。</div>';
		}

		const headers = fields
			.map((field) => `<th>${this.escapeHtml(field.name)}</th>`)
			.join('');
		const rowMarkup =
			rows.length === 0
				? `<tr><td colspan="${fields.length}" class="empty-cell">未返回记录。</td></tr>`
				: rows
						.map(
							(row) =>
								`<tr>${fields
									.map((field) => this.renderCell(row[field.name] ?? null))
									.join('')}</tr>`
						)
						.join('');

		return `<div class="table-wrapper">
			<table class="ppz">
				<thead><tr>${headers}</tr></thead>
				<tbody>${rowMarkup}</tbody>
			</table>
		</div>`;
	}

	/**
	 * 渲染非查询语句的 key/value 摘要表。
	 *
	 * @param {readonly SqlExecutionResultMetadataEntry[]} metadata 非查询执行摘要。
	 * @returns {string} key/value 表格 HTML。
	 */
	private renderKeyValueTable(
		metadata: readonly SqlExecutionResultMetadataEntry[]
	): string {
		if (metadata.length === 0) {
			return '<div class="empty-result">语句已执行。</div>';
		}

		const rows = metadata
			.map(
				(entry) => `<tr>
					<td tabindex="-1">${this.escapeHtml(entry.key)}</td>
					${this.renderCell(entry.value)}
				</tr>`
			)
			.join('');

		return `<table class="ppz kv-table">
			<thead>
				<tr>
					<th>KEY</th>
					<th>VALUE</th>
				</tr>
			</thead>
			<tbody>${rows}</tbody>
		</table>`;
	}

	/**
	 * 渲染单个 SQL 结果单元格。
	 *
	 * @param {SqlExecutionCellValue} value 待渲染的单元格值。
	 * @returns {string} HTML 表格单元格标记。
	 */
	private renderCell(value: SqlExecutionCellValue): string {
		if (value === null) {
			return '<td tabindex="-1"><span class="null-cell">NULL</span></td>';
		}

		return `<td tabindex="-1">${this.escapeHtml(String(value))}</td>`;
	}

	/**
	 * 转义用户可控文本以便安全渲染 HTML。
	 *
	 * @param {string} value 待转义的文本值。
	 * @returns {string} 转义后的 HTML 字符串。
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
