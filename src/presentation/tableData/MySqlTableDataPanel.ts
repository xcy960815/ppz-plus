import * as vscode from 'vscode';

import type {
	MySqlTableColumnMetadata,
	MySqlTableRowPage,
} from '../../application/mysql/MySqlTableDataProvider';
import type { ListMySqlTableColumnsUseCase } from '../../application/useCases/ListMySqlTableColumnsUseCase';
import type { ListMySqlTableRowPageUseCase } from '../../application/useCases/ListMySqlTableRowPageUseCase';
import type { MySqlTableTreeNode } from '../explorer/MySqlConnectionsTreeNode';
import type { MySqlTableDataWebviewMessage } from './MySqlTableDataWebviewMessage';

/**
 * 保存单个 MySQL 表数据面板的可变状态。
 */
interface MySqlTablePanelState {
	readonly panel: vscode.WebviewPanel;
	readonly tableNode: MySqlTableTreeNode;
	pageIndex: number;
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
					MySqlTableDataPanel.pageSize
				),
			]);

			state.panel.webview.html = this.renderTableHtml(
				state.tableNode,
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
	 * @param tableNode 当前选中的表 Tree 节点。
	 * @param columns 当前选中表的字段元数据。
	 * @param rowPage 当前选中表的分页行数据。
	 * @returns 渲染到 Webview 内的 HTML 文档。
	 */
	private renderTableHtml(
		tableNode: MySqlTableTreeNode,
		columns: readonly MySqlTableColumnMetadata[],
		rowPage: MySqlTableRowPage
	): string {
		const visibleColumns =
			columns.length > 0
				? columns
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
		<div class="page-note">Read-only preview. Editing, filtering, sorting, and SQL view are not connected yet.</div>
	</div>
	<script>
		const vscode = acquireVsCodeApi();
		function postAction(type) {
			vscode.postMessage({ type });
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
