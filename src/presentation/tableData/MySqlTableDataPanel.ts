import * as vscode from 'vscode';

import type {
	MySqlTableColumnMetadata,
	MySqlTableQueryOptions,
	MySqlTableSortDirection,
	MySqlTableRowPage,
} from '../../application/mysql/MySqlTableDataProvider';
import type { ListMySqlTableColumnsUseCase } from '../../application/useCases/ListMySqlTableColumnsUseCase';
import type { ListMySqlTableRowPageUseCase } from '../../application/useCases/ListMySqlTableRowPageUseCase';
import { OpenMySqlSqlTerminalCommand } from '../commands/OpenMySqlSqlTerminalCommand';
import type { MySqlTableTreeNode } from '../explorer/MySqlConnectionsTreeNode';
import type { MySqlTableDataWebviewMessage } from './MySqlTableDataWebviewMessage';

/**
 * 保存单个 MySQL 表数据面板的可变状态。
 */
interface MySqlTablePanelState {
	readonly panel: vscode.WebviewPanel;
	readonly tableNode: MySqlTableTreeNode;
	pageIndex: number;
	filterKeyword: string;
	sortColumnName?: string;
	sortDirection: MySqlTableSortDirection;
	hiddenColumnNames: Set<string>;
	currentSql?: string;
}

/**
 * 管理只读 MySQL 表数据面板。
 */
export class MySqlTableDataPanel {
	/**
	 * 保存首版只读表数据 MVP 使用的分页大小。
	 */
	private static readonly pageSize = 50;

	/**
	 * 按完整表键保存已打开的表数据面板。
	 */
	private readonly panelStatesByKey = new Map<string, MySqlTablePanelState>();

	/**
	 * 创建表数据面板管理器。
	 *
	 * @param listMySqlTableColumnsUseCase 用于加载表字段的用例。
	 * @param listMySqlTableRowPageUseCase 用于加载分页表数据的用例。
	 */
	public constructor(
		private readonly listMySqlTableColumnsUseCase: ListMySqlTableColumnsUseCase,
		private readonly listMySqlTableRowPageUseCase: ListMySqlTableRowPageUseCase
	) {}

	/**
	 * 打开或显示选中表的只读数据页。
	 *
	 * @param tableNode 当前选中的表 Tree 节点。
	 */
	public async open(tableNode: MySqlTableTreeNode): Promise<void> {
		const panelKey = this.createPanelKey(tableNode);
		const existingState = this.panelStatesByKey.get(panelKey);

		if (existingState) {
			existingState.panel.reveal(vscode.ViewColumn.Active);
			await this.renderTableData(existingState);
			return;
		}

		const panel = vscode.window.createWebviewPanel(
			'ppzPlus.mysqlTableData',
			`${tableNode.tableName} Data`,
			vscode.ViewColumn.Active,
			{
				enableScripts: true,
				retainContextWhenHidden: true,
			}
		);

		const state: MySqlTablePanelState = {
			panel,
			tableNode,
			pageIndex: 0,
			filterKeyword: '',
			sortDirection: 'asc',
			hiddenColumnNames: new Set<string>(),
		};

		this.panelStatesByKey.set(panelKey, state);
		panel.onDidDispose(() => {
			this.panelStatesByKey.delete(panelKey);
		});
		panel.webview.onDidReceiveMessage(
			async (message: MySqlTableDataWebviewMessage) => {
				await this.handleWebviewMessage(state, message);
			}
		);

		panel.webview.html = this.renderLoadingHtml(tableNode);
		await this.renderTableData(state);
	}

	/**
	 * 处理分页和刷新的 Webview 动作。
	 *
	 * @param state 正在更新的面板状态。
	 * @param message Webview 发出的消息。
	 */
	private async handleWebviewMessage(
		state: MySqlTablePanelState,
		message: MySqlTableDataWebviewMessage
	): Promise<void> {
		switch (message.type) {
			case 'previousPage':
				state.pageIndex = Math.max(0, state.pageIndex - 1);
				await this.renderTableData(state);
				return;
			case 'nextPage':
				state.pageIndex += 1;
				await this.renderTableData(state);
				return;
			case 'refresh':
				await this.renderTableData(state);
				return;
			case 'applyQueryOptions':
				state.filterKeyword = message.filterKeyword;
				state.sortColumnName =
					message.sortColumnName.length > 0
						? message.sortColumnName
						: undefined;
				state.sortDirection =
					message.sortDirection === 'desc' ? 'desc' : 'asc';
				state.pageIndex = 0;
				await this.renderTableData(state);
				return;
			case 'clearQueryOptions':
				state.filterKeyword = '';
				state.sortColumnName = undefined;
				state.sortDirection = 'asc';
				state.pageIndex = 0;
				await this.renderTableData(state);
				return;
			case 'setVisibleColumns':
				state.hiddenColumnNames = new Set(message.hiddenColumnNames);
				await this.renderTableData(state);
				return;
			case 'openSqlTerminal':
				await vscode.commands.executeCommand(
					OpenMySqlSqlTerminalCommand.id,
					state.tableNode,
					state.currentSql
				);
				return;
		}
	}

	/**
	 * 加载表字段和行数据，并渲染当前面板状态。
	 *
	 * @param state 正在渲染的面板状态。
	 */
	private async renderTableData(state: MySqlTablePanelState): Promise<void> {
		state.panel.title = `${state.tableNode.tableName} Data`;
		state.panel.webview.html = this.renderLoadingHtml(state.tableNode);

		try {
			const [columns, rowPage] = await Promise.all([
				this.listMySqlTableColumnsUseCase.execute(
					state.tableNode.connection,
					state.tableNode.schemaName,
					state.tableNode.tableName
				),
				this.listMySqlTableRowPageUseCase.execute(
					state.tableNode.connection,
					state.tableNode.schemaName,
					state.tableNode.tableName,
					state.pageIndex,
					MySqlTableDataPanel.pageSize,
					this.createQueryOptions(state)
				),
			]);
			state.currentSql = rowPage.sql;

			state.panel.webview.html = this.renderTableHtml(
				state,
				columns,
				rowPage
			);
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			state.panel.webview.html = this.renderErrorHtml(state.tableNode, message);
			await vscode.window.showErrorMessage(message);
		}
	}

	/**
	 * 将当前面板状态转换为表数据查询选项。
	 *
	 * @param state 当前面板状态。
	 * @returns 排序和过滤查询选项。
	 */
	private createQueryOptions(
		state: MySqlTablePanelState
	): MySqlTableQueryOptions {
		const filterKeyword = state.filterKeyword.trim();
		return {
			filter:
				filterKeyword.length > 0
					? {
							keyword: filterKeyword,
						}
					: undefined,
			sort: state.sortColumnName
				? {
						columnName: state.sortColumnName,
						direction: state.sortDirection,
					}
				: undefined,
		};
	}

	/**
	 * 为完整表名创建稳定的面板键。
	 *
	 * @param tableNode 当前选中的表 Tree 节点。
	 * @returns 唯一的面板键。
	 */
	private createPanelKey(tableNode: MySqlTableTreeNode): string {
		return `${tableNode.connection.id}:${tableNode.schemaName}:${tableNode.tableName}`;
	}

	/**
	 * 在表数据加载期间渲染临时加载视图。
	 *
	 * @param tableNode 当前选中的表 Tree 节点。
	 * @returns 加载状态的 HTML 文档。
	 */
	private renderLoadingHtml(tableNode: MySqlTableTreeNode): string {
		return `<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="UTF-8" />
	<meta name="viewport" content="width=device-width, initial-scale=1.0" />
	<title>${this.escapeHtml(tableNode.tableName)} Data</title>
	<style>
		body {
			font-family: var(--vscode-font-family);
			background: var(--vscode-editor-background);
			color: var(--vscode-editor-foreground);
			padding: 24px;
		}
	</style>
</head>
<body>
	<h2>Loading ${this.escapeHtml(tableNode.schemaName)}.${this.escapeHtml(tableNode.tableName)}...</h2>
</body>
</html>`;
	}

	/**
	 * 为当前表面板渲染错误视图。
	 *
	 * @param tableNode 当前选中的表 Tree 节点。
	 * @param message 需要展示的错误消息。
	 * @returns 错误状态的 HTML 文档。
	 */
	private renderErrorHtml(
		tableNode: MySqlTableTreeNode,
		message: string
	): string {
		return `<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="UTF-8" />
	<meta name="viewport" content="width=device-width, initial-scale=1.0" />
	<title>${this.escapeHtml(tableNode.tableName)} Data</title>
	<style>
		body {
			font-family: var(--vscode-font-family);
			background: var(--vscode-editor-background);
			color: var(--vscode-editor-foreground);
			padding: 24px;
		}
		.error {
			color: var(--vscode-errorForeground);
		}
		button {
			margin-top: 16px;
			padding: 6px 12px;
		}
	</style>
</head>
<body>
	<h2>${this.escapeHtml(tableNode.schemaName)}.${this.escapeHtml(tableNode.tableName)}</h2>
	<p class="error">${this.escapeHtml(message)}</p>
	<button onclick="acquireVsCodeApi().postMessage({ type: 'refresh' })">Retry</button>
</body>
</html>`;
	}

	/**
	 * 渲染完整的只读表数据 HTML 文档。
	 *
	 * @param state 当前面板状态。
	 * @param columns 当前选中表的字段元数据。
	 * @param rowPage 当前选中表的分页行数据。
	 * @returns 渲染到 Webview 内的 HTML 文档。
	 */
	private renderTableHtml(
		state: MySqlTablePanelState,
		columns: readonly MySqlTableColumnMetadata[],
		rowPage: MySqlTableRowPage
	): string {
		const tableNode = state.tableNode;
		const dataColumns = columns.filter(
			(column) => !state.hiddenColumnNames.has(column.name)
		);
		const visibleColumns =
			dataColumns.length > 0
				? dataColumns
				: [
						{
							name: '__empty__',
							dataType: 'unknown',
							nullable: true,
							isPrimaryKey: false,
							extra: '',
						},
					];
		const columnHeaders = visibleColumns
			.map((column) => {
				const tags =
					column.name === '__empty__'
						? 'No column metadata'
						: [
								column.dataType,
								column.nullable ? 'NULL' : 'NOT NULL',
								column.isPrimaryKey ? 'PK' : undefined,
								column.extra.length > 0 ? column.extra : undefined,
							]
								.filter((tag): tag is string => tag !== undefined)
								.join(' · ');

				return `<th>
					<div class="column-name">${this.escapeHtml(
						column.name === '__empty__' ? 'Unavailable' : column.name
					)}</div>
					<div class="column-meta">${this.escapeHtml(tags)}</div>
				</th>`;
			})
			.join('');

		const rowsMarkup =
			rowPage.rows.length === 0
				? `<tr><td colspan="${visibleColumns.length}" class="empty-cell">No rows found for this page.</td></tr>`
				: rowPage.rows
						.map(
							(row) =>
								`<tr>${visibleColumns
									.map((column) =>
										column.name === '__empty__'
											? this.renderCell(null)
											: this.renderCell(row[column.name] ?? null)
									)
									.join('')}</tr>`
						)
						.join('');
		const pageNumber = rowPage.pageIndex + 1;
		const sortOptions = [
			`<option value=""${state.sortColumnName ? '' : ' selected'}>Default</option>`,
			...columns.map((column) => {
				const selected =
					state.sortColumnName === column.name ? ' selected' : '';
				return `<option value="${this.escapeHtml(column.name)}"${selected}>${this.escapeHtml(column.name)}</option>`;
			}),
		].join('');
		const columnVisibilityControls = columns
			.map((column) => {
				const checked = state.hiddenColumnNames.has(column.name)
					? ''
					: ' checked';
				return `<label class="column-toggle">
					<input type="checkbox" data-column-name="${this.escapeHtml(column.name)}"${checked} />
					<span>${this.escapeHtml(column.name)}</span>
				</label>`;
			})
			.join('');
		const ascSelected = state.sortDirection === 'asc' ? ' selected' : '';
		const descSelected = state.sortDirection === 'desc' ? ' selected' : '';

		return `<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="UTF-8" />
	<meta name="viewport" content="width=device-width, initial-scale=1.0" />
	<title>${this.escapeHtml(tableNode.tableName)} Data</title>
	<style>
		:root {
			color-scheme: light dark;
		}
		body {
			margin: 0;
			font-family: var(--vscode-font-family);
			background: var(--vscode-editor-background);
			color: var(--vscode-editor-foreground);
		}
		.page {
			padding: 20px 24px 28px;
		}
		.header {
			display: flex;
			justify-content: space-between;
			gap: 16px;
			align-items: flex-start;
			margin-bottom: 16px;
		}
		h1 {
			margin: 0 0 4px;
			font-size: 20px;
		}
		.subtitle {
			color: var(--vscode-descriptionForeground);
		}
		.actions {
			display: flex;
			gap: 8px;
			flex-wrap: wrap;
			align-items: center;
		}
		button {
			border: 1px solid var(--vscode-button-border, transparent);
			background: var(--vscode-button-background);
			color: var(--vscode-button-foreground);
			padding: 6px 12px;
			cursor: pointer;
		}
		button.secondary {
			background: var(--vscode-button-secondaryBackground);
			color: var(--vscode-button-secondaryForeground);
		}
		button:disabled {
			opacity: 0.5;
			cursor: default;
		}
		.summary {
			display: flex;
			flex-wrap: wrap;
			gap: 12px;
			margin-bottom: 16px;
			color: var(--vscode-descriptionForeground);
		}
		.summary strong {
			color: var(--vscode-editor-foreground);
		}
		.query-controls {
			display: grid;
			grid-template-columns: minmax(180px, 1fr) minmax(160px, 220px) 120px auto auto;
			gap: 10px;
			align-items: end;
			margin-bottom: 16px;
		}
		label {
			display: grid;
			gap: 4px;
			font-weight: 600;
		}
		input,
		select {
			box-sizing: border-box;
			width: 100%;
			min-height: 30px;
			border: 1px solid var(--vscode-input-border, transparent);
			background: var(--vscode-input-background);
			color: var(--vscode-input-foreground);
			padding: 4px 8px;
		}
		.column-controls {
			margin-bottom: 16px;
			border: 1px solid var(--vscode-panel-border);
			padding: 10px 12px;
		}
		.column-controls summary {
			cursor: pointer;
			font-weight: 600;
		}
		.column-grid {
			display: grid;
			grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
			gap: 8px 12px;
			margin: 12px 0;
		}
		.column-toggle {
			display: flex;
			align-items: center;
			gap: 6px;
			font-weight: 400;
			min-width: 0;
		}
		.column-toggle input {
			width: auto;
			min-height: auto;
		}
		.column-toggle span {
			overflow: hidden;
			text-overflow: ellipsis;
			white-space: nowrap;
		}
		.column-actions {
			display: flex;
			flex-wrap: wrap;
			gap: 8px;
		}
		.table-wrapper {
			border: 1px solid var(--vscode-panel-border);
			overflow: auto;
		}
		table {
			width: 100%;
			border-collapse: collapse;
			min-width: 720px;
		}
		th,
		td {
			border-bottom: 1px solid var(--vscode-panel-border);
			padding: 10px 12px;
			text-align: left;
			vertical-align: top;
		}
		th {
			position: sticky;
			top: 0;
			background: var(--vscode-editorGroupHeader-tabsBackground, var(--vscode-editor-background));
			z-index: 1;
		}
		.column-name {
			font-weight: 600;
		}
		.column-meta,
		.page-note {
			color: var(--vscode-descriptionForeground);
			font-size: 12px;
			margin-top: 4px;
		}
		td code {
			font-family: var(--vscode-editor-font-family, var(--vscode-font-family));
			white-space: pre-wrap;
			word-break: break-word;
		}
		.null-cell {
			color: var(--vscode-descriptionForeground);
			font-style: italic;
		}
		.empty-cell {
			text-align: center;
			color: var(--vscode-descriptionForeground);
			padding: 24px;
		}
		details.current-sql {
			margin-top: 16px;
			border: 1px solid var(--vscode-panel-border);
			padding: 10px 12px;
		}
		details.current-sql summary {
			cursor: pointer;
			font-weight: 600;
		}
		pre {
			overflow: auto;
			margin: 10px 0 0;
			white-space: pre-wrap;
		}
		@media (max-width: 900px) {
			.query-controls {
				grid-template-columns: 1fr;
			}
		}
	</style>
</head>
<body>
	<div class="page">
		<div class="header">
			<div>
				<h1>${this.escapeHtml(tableNode.schemaName)}.${this.escapeHtml(tableNode.tableName)}</h1>
				<div class="subtitle">Connection: ${this.escapeHtml(tableNode.connection.name)}</div>
			</div>
			<div class="actions">
				<button class="secondary" onclick="postAction('refresh')">Refresh</button>
				<button class="secondary" onclick="postAction('openSqlTerminal')">SQL Terminal</button>
				<button class="secondary" onclick="postAction('previousPage')" ${rowPage.pageIndex === 0 ? 'disabled' : ''}>Previous</button>
				<button onclick="postAction('nextPage')" ${rowPage.hasNextPage ? '' : 'disabled'}>Next</button>
			</div>
		</div>
		<div class="summary">
			<span><strong>${columns.length}</strong> columns</span>
			<span><strong>${rowPage.rows.length}</strong> rows in current page</span>
			<span><strong>Page ${pageNumber}</strong></span>
			<span><strong>${rowPage.pageSize}</strong> rows per page</span>
		</div>
		<div class="query-controls">
			<label>
				Search
				<input id="filterKeyword" value="${this.escapeHtml(state.filterKeyword)}" />
			</label>
			<label>
				Sort
				<select id="sortColumnName">${sortOptions}</select>
			</label>
			<label>
				Direction
				<select id="sortDirection">
					<option value="asc"${ascSelected}>Asc</option>
					<option value="desc"${descSelected}>Desc</option>
				</select>
			</label>
			<button onclick="applyQueryOptions()">Apply</button>
			<button class="secondary" onclick="postAction('clearQueryOptions')">Clear</button>
		</div>
		<details class="column-controls">
			<summary>Columns (${dataColumns.length}/${columns.length})</summary>
			<div class="column-grid">
				${columnVisibilityControls}
			</div>
			<div class="column-actions">
				<button class="secondary" onclick="setAllColumns(true)">All</button>
				<button class="secondary" onclick="setAllColumns(false)">None</button>
				<button onclick="applyColumnVisibility()">Apply</button>
			</div>
		</details>
		<div class="table-wrapper">
			<table>
				<thead>
					<tr>${columnHeaders}</tr>
				</thead>
				<tbody>
					${rowsMarkup}
				</tbody>
			</table>
		</div>
		<details class="current-sql">
			<summary>Current SQL</summary>
			<pre><code>${this.escapeHtml(rowPage.sql)}</code></pre>
		</details>
		<div class="page-note">Read-only preview. Editing and field visibility are not connected yet.</div>
	</div>
	<script>
		const vscode = acquireVsCodeApi();
		function postAction(type) {
			vscode.postMessage({ type });
		}
		function applyQueryOptions() {
			vscode.postMessage({
				type: 'applyQueryOptions',
				filterKeyword: document.getElementById('filterKeyword').value,
				sortColumnName: document.getElementById('sortColumnName').value,
				sortDirection: document.getElementById('sortDirection').value
			});
		}
		function setAllColumns(checked) {
			for (const checkbox of document.querySelectorAll('[data-column-name]')) {
				checkbox.checked = checked;
			}
		}
		function applyColumnVisibility() {
			const hiddenColumnNames = [];
			for (const checkbox of document.querySelectorAll('[data-column-name]')) {
				if (!checkbox.checked) {
					hiddenColumnNames.push(checkbox.dataset.columnName);
				}
			}
			vscode.postMessage({
				type: 'setVisibleColumns',
				hiddenColumnNames
			});
		}
	</script>
</body>
</html>`;
	}

	/**
	 * 渲染单个表格单元格。
	 *
	 * @param value 待渲染的单元格值。
	 * @returns HTML 表格单元格标记。
	 */
	private renderCell(value: string | number | boolean | null): string {
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
