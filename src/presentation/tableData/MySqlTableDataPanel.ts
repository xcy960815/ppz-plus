import * as vscode from 'vscode';

import type {
	ConnectionConfig,
	MysqlConnectionConfig,
} from '../../domain/connections/ConnectionConfig';
import type {
	MySqlTableCellValue,
	MySqlTableColumnMetadata,
	MySqlTableInsertValues,
	MySqlTableQueryOptions,
	MySqlTableRowIdentityValues,
	MySqlTableSortDirection,
	MySqlTableUpdateValues,
	MySqlTableRowPage,
} from '../../application/mysql/MySqlTableDataProvider';
import type { DeleteMySqlTableRowUseCase } from '../../application/useCases/DeleteMySqlTableRowUseCase';
import type { InsertMySqlTableRowUseCase } from '../../application/useCases/InsertMySqlTableRowUseCase';
import type { ListStoredConnectionsUseCase } from '../../application/useCases/ListStoredConnectionsUseCase';
import type { ListMySqlTableColumnsUseCase } from '../../application/useCases/ListMySqlTableColumnsUseCase';
import type { ListMySqlTableRowPageUseCase } from '../../application/useCases/ListMySqlTableRowPageUseCase';
import type { UpdateMySqlTableRowUseCase } from '../../application/useCases/UpdateMySqlTableRowUseCase';
import type { ExtensionActivationParticipant } from '../bootstrap/ExtensionActivationParticipant';
import { showUserErrorMessage } from '../commands/UserErrorPresenter';
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
	pageSize: number;
	filterKeyword: string;
	sortColumnName?: string;
	sortDirection: MySqlTableSortDirection;
	hiddenColumnNames: Set<string>;
	currentSql?: string;
	latestColumns: readonly MySqlTableColumnMetadata[];
	latestRows: readonly Record<string, MySqlTableCellValue>[];
}

/**
 * 保存表数据页可由 VS Code 恢复的轻量状态。
 */
interface MySqlTablePanelSerializedState {
	readonly connectionId: string;
	readonly schemaName: string;
	readonly tableName: string;
	readonly pageIndex: number;
	readonly pageSize: number;
	readonly filterKeyword: string;
	readonly sortColumnName?: string;
	readonly sortDirection: MySqlTableSortDirection;
	readonly hiddenColumnNames: readonly string[];
}

/**
 * 管理 MySQL 表数据面板。
 */
export class MySqlTableDataPanel
	implements ExtensionActivationParticipant, vscode.WebviewPanelSerializer
{
	/**
	 * 保存表数据页 Webview 的 VS Code viewType。
	 */
	private static readonly viewType = 'ppzPlus.mysqlTableData';

	/**
	 * 保存表数据页使用的分页大小。
	 */
	private static readonly defaultPageSize = 30;

	/**
	 * 按完整表键保存已打开的表数据面板。
	 */
	private readonly panelStatesByKey = new Map<string, MySqlTablePanelState>();

	/**
	 * 创建表数据面板管理器。
	 *
	 * @param listStoredConnectionsUseCase 用于恢复 Webview 时按连接 ID 读取连接配置。
	 * @param listMySqlTableColumnsUseCase 用于加载表字段的用例。
	 * @param listMySqlTableRowPageUseCase 用于加载分页表数据的用例。
	 * @param insertMySqlTableRowUseCase 用于新增单条表记录的用例。
	 * @param updateMySqlTableRowUseCase 用于更新单条表记录的用例。
	 * @param deleteMySqlTableRowUseCase 用于删除单条表记录的用例。
	 */
	public constructor(
		private readonly listStoredConnectionsUseCase: ListStoredConnectionsUseCase,
		private readonly listMySqlTableColumnsUseCase: ListMySqlTableColumnsUseCase,
		private readonly listMySqlTableRowPageUseCase: ListMySqlTableRowPageUseCase,
		private readonly insertMySqlTableRowUseCase: InsertMySqlTableRowUseCase,
		private readonly updateMySqlTableRowUseCase: UpdateMySqlTableRowUseCase,
		private readonly deleteMySqlTableRowUseCase: DeleteMySqlTableRowUseCase
	) {}

	/**
	 * 注册表数据页 Webview 恢复器。
	 *
	 * @param context VS Code 扩展生命周期上下文。
	 */
	public activate(context: vscode.ExtensionContext): void {
		context.subscriptions.push(
			vscode.window.registerWebviewPanelSerializer(
				MySqlTableDataPanel.viewType,
				this
			)
		);
	}

	/**
	 * 从 VS Code 保存的 Webview 状态恢复表数据页。
	 *
	 * @param panel VS Code 恢复出来的 Webview 面板。
	 * @param serializedState Webview 前端保存的轻量状态。
	 */
	public async deserializeWebviewPanel(
		panel: vscode.WebviewPanel,
		serializedState: unknown
	): Promise<void> {
		panel.webview.options = {
			enableScripts: true,
		};
		const restoredState = this.parseSerializedState(serializedState);

		if (!restoredState) {
			panel.webview.html = this.renderRestoreErrorHtml(
				'MySQL table data state is invalid.'
			);
			return;
		}

		const connection = await this.findRestoredConnection(
			restoredState.connectionId
		);

		if (!connection) {
			panel.webview.html = this.renderRestoreErrorHtml(
				'The MySQL connection for this table data view was not found.'
			);
			return;
		}

		const tableNode: MySqlTableTreeNode = {
			kind: 'table',
			connection,
			schemaName: restoredState.schemaName,
			tableName: restoredState.tableName,
		};
		const state: MySqlTablePanelState = {
			panel,
			tableNode,
			pageIndex: restoredState.pageIndex,
			pageSize: restoredState.pageSize,
			filterKeyword: restoredState.filterKeyword,
			sortColumnName: restoredState.sortColumnName,
			sortDirection: restoredState.sortDirection,
			hiddenColumnNames: new Set(restoredState.hiddenColumnNames),
			latestColumns: [],
			latestRows: [],
		};

		this.panelStatesByKey.set(this.createPanelKey(tableNode), state);
		this.registerPanelHandlers(state);
		panel.webview.html = this.renderLoadingHtml(tableNode);
		await this.renderTableData(state);
	}

	/**
	 * 打开或显示选中表的数据页。
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
			MySqlTableDataPanel.viewType,
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
			pageSize: MySqlTableDataPanel.defaultPageSize,
			filterKeyword: '',
			sortDirection: 'asc',
			hiddenColumnNames: new Set<string>(),
			latestColumns: [],
			latestRows: [],
		};

		this.panelStatesByKey.set(panelKey, state);
		this.registerPanelHandlers(state);

		panel.webview.html = this.renderLoadingHtml(tableNode);
		await this.renderTableData(state);
	}

	/**
	 * 为表数据页注册生命周期和消息处理。
	 *
	 * @param state 当前表数据面板状态。
	 */
	private registerPanelHandlers(state: MySqlTablePanelState): void {
		state.panel.onDidDispose(() => {
			this.panelStatesByKey.delete(this.createPanelKey(state.tableNode));
		});
		state.panel.webview.onDidReceiveMessage(
			async (message: MySqlTableDataWebviewMessage) => {
				await this.handleWebviewMessage(state, message);
			}
		);
	}

	/**
	 * 解析 VS Code 保存的表数据页 Webview 状态。
	 *
	 * @param value 原始恢复状态。
	 * @returns 可用于恢复表数据页的轻量状态；无效时为空。
	 */
	private parseSerializedState(
		value: unknown
	): MySqlTablePanelSerializedState | undefined {
		if (!value || typeof value !== 'object' || Array.isArray(value)) {
			return undefined;
		}

		const connectionId = Reflect.get(value, 'connectionId');
		const schemaName = Reflect.get(value, 'schemaName');
		const tableName = Reflect.get(value, 'tableName');

		if (
			typeof connectionId !== 'string' ||
			typeof schemaName !== 'string' ||
			typeof tableName !== 'string' ||
			connectionId.trim().length === 0 ||
			schemaName.trim().length === 0 ||
			tableName.trim().length === 0
		) {
			return undefined;
		}

		const pageIndex = Reflect.get(value, 'pageIndex');
		const pageSize = Reflect.get(value, 'pageSize');
		const filterKeyword = Reflect.get(value, 'filterKeyword');
		const sortColumnName = Reflect.get(value, 'sortColumnName');
		const sortDirection = Reflect.get(value, 'sortDirection');
		const hiddenColumnNames = Reflect.get(value, 'hiddenColumnNames');

		return {
			connectionId,
			schemaName,
			tableName,
			pageIndex:
				typeof pageIndex === 'number' && Number.isFinite(pageIndex)
					? Math.max(0, Math.floor(pageIndex))
					: 0,
			pageSize:
				typeof pageSize === 'number' && Number.isFinite(pageSize)
					? Math.max(1, Math.floor(pageSize))
					: MySqlTableDataPanel.defaultPageSize,
			filterKeyword: typeof filterKeyword === 'string' ? filterKeyword : '',
			sortColumnName:
				typeof sortColumnName === 'string' && sortColumnName.length > 0
					? sortColumnName
					: undefined,
			sortDirection: sortDirection === 'desc' ? 'desc' : 'asc',
			hiddenColumnNames: Array.isArray(hiddenColumnNames)
				? hiddenColumnNames.filter(
						(columnName): columnName is string =>
							typeof columnName === 'string'
					)
				: [],
		};
	}

	/**
	 * 按连接 ID 查找可恢复的 MySQL 连接配置。
	 *
	 * @param connectionId 需要恢复的连接标识。
	 * @returns 匹配的 MySQL 连接配置；不存在时为空。
	 */
	private async findRestoredConnection(
		connectionId: string
	): Promise<MysqlConnectionConfig | undefined> {
		const connections = await this.listStoredConnectionsUseCase.execute();
		const connection = connections.find((item) => item.id === connectionId);

		if (!connection || !this.isMySqlConnection(connection)) {
			return undefined;
		}

		return connection;
	}

	/**
	 * 判断连接配置是否为 MySQL 连接。
	 *
	 * @param connection 待检查的连接配置。
	 * @returns 是否为 MySQL 连接。
	 */
	private isMySqlConnection(
		connection: ConnectionConfig
	): connection is MysqlConnectionConfig {
		return connection.engine === 'mysql';
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
			case 'goToPage':
				state.pageSize = Math.max(1, Math.floor(message.pageSize));
				state.pageIndex = Math.max(0, Math.floor(message.pageIndex));
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
			case 'insertRow':
				await this.insertRow(state);
				return;
			case 'copyRow':
				await this.copyRow(state, message.rowIndex);
				return;
			case 'editRow':
				await this.editRow(state, message.rowIndex);
				return;
			case 'deleteRow':
				await this.deleteRow(state, message.rowIndex);
				return;
			case 'saveEditedRows':
				await this.saveEditedRows(state, message.edits);
				return;
		}
	}

	/**
	 * 收集字段值并新增一条表记录。
	 *
	 * @param state 当前表数据面板状态。
	 */
	private async insertRow(
		state: MySqlTablePanelState,
		sourceRow?: Record<string, MySqlTableCellValue>
	): Promise<void> {
		try {
			const columns = await this.listMySqlTableColumnsUseCase.execute(
				state.tableNode.connection,
				state.tableNode.schemaName,
				state.tableNode.tableName
			);
			const values = await this.promptInsertValues(columns, sourceRow);

			if (values === undefined) {
				return;
			}

			const shouldSave = await this.confirmPendingChange(
				`Save new row to ${state.tableNode.schemaName}.${state.tableNode.tableName}?`
			);

			if (!shouldSave) {
				return;
			}

			const result = await this.insertMySqlTableRowUseCase.execute(
				state.tableNode.connection,
				state.tableNode.schemaName,
				state.tableNode.tableName,
				values
			);

			state.pageIndex = 0;
			await vscode.window.showInformationMessage(
				`Inserted ${result.affectedRows} row into ${state.tableNode.schemaName}.${state.tableNode.tableName}.`
			);
			await this.renderTableData(state);
		} catch (error) {
			await showUserErrorMessage({
				operation: 'Insert MySQL table row',
				error,
			});
		}
	}

	/**
	 * 以当前聚焦行作为默认值新增一条表记录。
	 *
	 * @param state 当前表数据面板状态。
	 * @param rowIndex 当前页行索引。
	 */
	private async copyRow(
		state: MySqlTablePanelState,
		rowIndex: number
	): Promise<void> {
		const row = state.latestRows[rowIndex];

		if (!row) {
			await vscode.window.showWarningMessage(
				'Selected row is no longer available.'
			);
			return;
		}

		await this.insertRow(state, row);
	}

	/**
	 * 通过 VS Code 输入框收集单条新增记录的字段值。
	 *
	 * @param columns 当前表字段元数据。
	 * @param sourceRow 作为新增默认值的来源行。
	 * @returns 用户提交的字段值；取消时返回 undefined。
	 */
	private async promptInsertValues(
		columns: readonly MySqlTableColumnMetadata[],
		sourceRow?: Record<string, MySqlTableCellValue>
	): Promise<MySqlTableInsertValues | undefined> {
		const values: Record<string, string | number | boolean | null> = {};
		const writableColumns = columns.filter(
			(column) => !column.extra.toLowerCase().includes('auto_increment')
		);

		for (const column of writableColumns) {
			const sourceValue = sourceRow?.[column.name] ?? null;
			const value = await vscode.window.showInputBox({
				title: `Insert value for ${column.name}`,
				value: sourceValue === null ? '' : String(sourceValue),
				prompt: `${column.dataType}${column.nullable ? ', nullable' : ''}. Leave empty to use DEFAULT; type NULL to insert NULL.`,
				ignoreFocusOut: true,
			});

			if (value === undefined) {
				return undefined;
			}

			if (value.length === 0) {
				continue;
			}

			values[column.name] = value.toUpperCase() === 'NULL' ? null : value;
		}

		return values;
	}

	/**
	 * 编辑当前页中的一条表记录。
	 *
	 * @param state 当前表数据面板状态。
	 * @param rowIndex 当前页行索引。
	 */
	private async editRow(
		state: MySqlTablePanelState,
		rowIndex: number
	): Promise<void> {
		try {
			const row = state.latestRows[rowIndex];
			const primaryKeyColumns = state.latestColumns.filter(
				(column) => column.isPrimaryKey
			);

			if (!row) {
				await vscode.window.showWarningMessage(
					'Selected row is no longer available.'
				);
				return;
			}

			if (primaryKeyColumns.length === 0) {
				await vscode.window.showWarningMessage(
					'Editing rows currently requires a primary key.'
				);
				return;
			}

			const identityValues = this.createIdentityValues(primaryKeyColumns, row);
			const values = await this.promptUpdateValues(state.latestColumns, row);

			if (values === undefined) {
				return;
			}

			if (Object.keys(values).length === 0) {
				await vscode.window.showInformationMessage('No row changes to apply.');
				return;
			}

			const shouldSave = await this.confirmPendingChange(
				`Save row changes to ${state.tableNode.schemaName}.${state.tableNode.tableName}?`
			);

			if (!shouldSave) {
				return;
			}

			const result = await this.updateMySqlTableRowUseCase.execute(
				state.tableNode.connection,
				state.tableNode.schemaName,
				state.tableNode.tableName,
				identityValues,
				values
			);

			await vscode.window.showInformationMessage(
				`Updated ${result.affectedRows} row in ${state.tableNode.schemaName}.${state.tableNode.tableName}.`
			);
			await this.renderTableData(state);
		} catch (error) {
			await showUserErrorMessage({
				operation: 'Edit MySQL table row',
				error,
			});
		}
	}

	/**
	 * 保存 Webview 表格中的内联编辑。
	 *
	 * @param state 当前表数据面板状态。
	 * @param edits 前端收集的逐行字段修改。
	 */
	private async saveEditedRows(
		state: MySqlTablePanelState,
		edits: readonly {
			readonly rowIndex: number;
			readonly values: Record<string, string | number | boolean | null>;
		}[]
	): Promise<void> {
		try {
			const primaryKeyColumns = state.latestColumns.filter(
				(column) => column.isPrimaryKey
			);

			if (primaryKeyColumns.length === 0) {
				await vscode.window.showWarningMessage(
					'Editing rows currently requires a primary key.'
				);
				return;
			}

			const normalizedEdits = edits
				.map((edit) => {
					const row = state.latestRows[edit.rowIndex];
					if (!row) {
						return undefined;
					}

					const values = this.normalizeInlineEditValues(
						state.latestColumns,
						edit.values
					);
					if (Object.keys(values).length === 0) {
						return undefined;
					}

					return {
						row,
						values,
					};
				})
				.filter(
					(
						edit
					): edit is {
						readonly row: Record<string, MySqlTableCellValue>;
						readonly values: MySqlTableUpdateValues;
					} => edit !== undefined
				);

			if (normalizedEdits.length === 0) {
				await vscode.window.showInformationMessage('No row changes to apply.');
				return;
			}

			const shouldSave = await this.confirmPendingChange(
				`Save ${normalizedEdits.length} row change(s) to ${state.tableNode.schemaName}.${state.tableNode.tableName}?`
			);

			if (!shouldSave) {
				return;
			}

			let affectedRows = 0;
			for (const edit of normalizedEdits) {
				const result = await this.updateMySqlTableRowUseCase.execute(
					state.tableNode.connection,
					state.tableNode.schemaName,
					state.tableNode.tableName,
					this.createIdentityValues(primaryKeyColumns, edit.row),
					edit.values
				);
				affectedRows += result.affectedRows;
			}

			await vscode.window.showInformationMessage(
				`Updated ${affectedRows} row(s) in ${state.tableNode.schemaName}.${state.tableNode.tableName}.`
			);
			await this.renderTableData(state);
		} catch (error) {
			await showUserErrorMessage({
				operation: 'Save MySQL table row edits',
				error,
			});
		}
	}

	/**
	 * 归一化 Webview 内联编辑提交的字段值。
	 *
	 * @param columns 当前表字段元数据。
	 * @param values Webview 提交的原始字段值。
	 * @returns 可传入更新用例的字段值。
	 */
	private normalizeInlineEditValues(
		columns: readonly MySqlTableColumnMetadata[],
		values: Record<string, string | number | boolean | null>
	): MySqlTableUpdateValues {
		const editableColumnNames = new Set(
			columns
				.filter(
					(column) =>
						!column.isPrimaryKey &&
						!column.extra.toLowerCase().includes('auto_increment')
				)
				.map((column) => column.name)
		);
		const normalizedValues: Record<string, MySqlTableCellValue> = {};

		for (const [columnName, value] of Object.entries(values)) {
			if (editableColumnNames.has(columnName)) {
				normalizedValues[columnName] = value;
			}
		}

		return normalizedValues;
	}

	/**
	 * 根据主键字段从当前行创建原行定位值。
	 *
	 * @param primaryKeyColumns 主键字段列表。
	 * @param row 当前页中的原始行。
	 * @returns 原行定位值。
	 */
	private createIdentityValues(
		primaryKeyColumns: readonly MySqlTableColumnMetadata[],
		row: Record<string, MySqlTableCellValue>
	): MySqlTableRowIdentityValues {
		return Object.fromEntries(
			primaryKeyColumns.map((column) => [column.name, row[column.name] ?? null])
		);
	}

	/**
	 * 删除当前页中的一条表记录。
	 *
	 * @param state 当前表数据面板状态。
	 * @param rowIndex 当前页行索引。
	 */
	private async deleteRow(
		state: MySqlTablePanelState,
		rowIndex: number
	): Promise<void> {
		try {
			const row = state.latestRows[rowIndex];
			const primaryKeyColumns = state.latestColumns.filter(
				(column) => column.isPrimaryKey
			);

			if (!row) {
				await vscode.window.showWarningMessage(
					'Selected row is no longer available.'
				);
				return;
			}

			if (primaryKeyColumns.length === 0) {
				await vscode.window.showWarningMessage(
					'Deleting rows currently requires a primary key.'
				);
				return;
			}

			const confirmation = await vscode.window.showWarningMessage(
				`Delete one row from ${state.tableNode.schemaName}.${state.tableNode.tableName}?`,
				{
					modal: true,
				},
				'Delete'
			);

			if (confirmation !== 'Delete') {
				return;
			}

			const result = await this.deleteMySqlTableRowUseCase.execute(
				state.tableNode.connection,
				state.tableNode.schemaName,
				state.tableNode.tableName,
				this.createIdentityValues(primaryKeyColumns, row)
			);

			await vscode.window.showInformationMessage(
				`Deleted ${result.affectedRows} row from ${state.tableNode.schemaName}.${state.tableNode.tableName}.`
			);
			await this.renderTableData(state);
		} catch (error) {
			await showUserErrorMessage({
				operation: 'Delete MySQL table row',
				error,
			});
		}
	}

	/**
	 * 通过 VS Code 输入框收集单条记录更新值。
	 *
	 * @param columns 当前表字段元数据。
	 * @param row 当前页中的原始行。
	 * @returns 用户提交的更新值；取消时返回 undefined。
	 */
	private async promptUpdateValues(
		columns: readonly MySqlTableColumnMetadata[],
		row: Record<string, MySqlTableCellValue>
	): Promise<MySqlTableUpdateValues | undefined> {
		const values: Record<string, MySqlTableCellValue> = {};
		const editableColumns = columns.filter(
			(column) =>
				!column.isPrimaryKey &&
				!column.extra.toLowerCase().includes('auto_increment')
		);

		for (const column of editableColumns) {
			const currentValue = row[column.name] ?? null;
			const value = await vscode.window.showInputBox({
				title: `Edit value for ${column.name}`,
				value: currentValue === null ? '' : String(currentValue),
				prompt: `${column.dataType}${column.nullable ? ', nullable' : ''}. Leave empty to keep current value; type NULL to set NULL.`,
				ignoreFocusOut: true,
			});

			if (value === undefined) {
				return undefined;
			}

			if (value.length === 0) {
				continue;
			}

			const nextValue = value.toUpperCase() === 'NULL' ? null : value;

			if (nextValue !== currentValue) {
				values[column.name] = nextValue;
			}
		}

		return values;
	}

	/**
	 * 确认是否保存当前尚未写入数据库的修改。
	 *
	 * @param message 确认弹窗消息。
	 * @returns 用户选择保存时返回 true。
	 */
	private async confirmPendingChange(message: string): Promise<boolean> {
		const confirmation = await vscode.window.showWarningMessage(
			message,
			{
				modal: true,
			},
			'Save',
			'Discard'
		);

		return confirmation === 'Save';
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
					state.pageSize,
					this.createQueryOptions(state)
				),
			]);
			state.currentSql = rowPage.sql;
			state.latestColumns = columns;
			state.latestRows = rowPage.rows;

			state.panel.webview.html = this.renderTableHtml(
				state,
				columns,
				rowPage
			);
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			state.panel.webview.html = this.renderErrorHtml(state.tableNode, message);
			await showUserErrorMessage({
				operation: 'Load MySQL table data',
				error,
			});
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
	 * 从当前面板状态创建可保存到 Webview 的轻量状态。
	 *
	 * @param state 当前表数据面板状态。
	 * @returns 可由 VS Code 恢复的表数据页状态。
	 */
	private createSerializedState(
		state: MySqlTablePanelState
	): MySqlTablePanelSerializedState {
		return {
			connectionId: state.tableNode.connection.id,
			schemaName: state.tableNode.schemaName,
			tableName: state.tableNode.tableName,
			pageIndex: state.pageIndex,
			pageSize: state.pageSize,
			filterKeyword: state.filterKeyword,
			sortColumnName: state.sortColumnName,
			sortDirection: state.sortDirection,
			hiddenColumnNames: Array.from(state.hiddenColumnNames),
		};
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
	 * 渲染 Webview 状态无法恢复时的错误页。
	 *
	 * @param message 需要展示的恢复错误。
	 * @returns 错误状态的 HTML 文档。
	 */
	private renderRestoreErrorHtml(message: string): string {
		return `<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="UTF-8" />
	<meta name="viewport" content="width=device-width, initial-scale=1.0" />
	<title>MySQL Table Data</title>
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
	</style>
</head>
<body>
	<h2>MySQL Table Data</h2>
	<p class="error">${this.escapeHtml(message)}</p>
</body>
</html>`;
	}

	/**
	 * 渲染完整的表数据 HTML 文档。
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
		const hasPrimaryKey = columns.some((column) => column.isPrimaryKey);
		const dataColumns = columns.filter(
			(column) => !state.hiddenColumnNames.has(column.name)
		);
		const columnHeaders =
			dataColumns.length === 0
				? '<th class="empty-header">No fields</th>'
				: dataColumns
						.map((column) => {
							const sortDirection =
								state.sortColumnName === column.name
									? state.sortDirection
									: undefined;
							const title = [
								column.dataType,
								column.isPrimaryKey ? 'PK' : undefined,
							]
								.filter((item): item is string => item !== undefined)
								.join(' / ');
							return `<th>
				<div class="sort-field" data-sort-column="${this.escapeHtml(column.name)}" title="${this.escapeHtml(title)}">
					<span>${this.escapeHtml(column.name)}</span>
					<span class="sort-icons">
						<span class="sort-icon up${sortDirection === 'desc' ? ' selected' : ''}"></span>
						<span class="sort-icon down${sortDirection === 'asc' ? ' selected' : ''}"></span>
					</span>
				</div>
			</th>`;
						})
						.join('');

		const rowsMarkup =
			rowPage.rows.length === 0
				? `<tr><td colspan="${Math.max(dataColumns.length, 1)}" class="empty-cell">No data</td></tr>`
				: rowPage.rows
						.map(
							(row, rowIndex) =>
								`<tr data-row-index="${rowIndex}">${
									dataColumns.length === 0
										? '<td class="empty-cell">No visible fields</td>'
										: dataColumns
												.map((column) =>
													this.renderCell(
														rowIndex,
														column,
														row[column.name] ?? null,
														hasPrimaryKey
													)
												)
												.join('')
								}</tr>`
						)
						.join('');
		const pageNumber = rowPage.pageIndex + 1;
		const pageCount = Math.max(
			1,
			Math.ceil(rowPage.totalRowCount / rowPage.pageSize)
		);
		const sortOptions = [
			`<option value=""${state.sortColumnName ? '' : ' selected'}>默认</option>`,
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
		const serializedState = this.serializeScriptValue(
			this.createSerializedState(state)
		);

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
			--padding-h: .88em;
			--color0: 0, 0, 0;
			--color1: 255, 255, 255;
			margin: 0;
			padding: 0;
			font-family: var(--vscode-font-family);
			font-size: var(--vscode-font-size);
			background: var(--vscode-editor-background);
			color: var(--vscode-editor-foreground);
		}
		header nav {
			box-sizing: border-box;
			height: 1.76rem;
			padding: .38em var(--padding-h);
			color: var(--vscode-descriptionForeground);
			overflow: hidden;
			text-overflow: ellipsis;
			white-space: nowrap;
		}
		header nav span {
			font-size: .9em;
		}
		header nav .split {
			padding: 0 .45em;
			opacity: .72;
		}
		header nav .active {
			color: var(--vscode-editor-foreground);
		}
		.operations {
			box-sizing: border-box;
			display: flex;
			justify-content: space-between;
			align-items: center;
			min-height: 2rem;
			padding: 0 var(--padding-h);
			background: var(--vscode-button-background);
			color: var(--vscode-button-foreground);
		}
		.btns,
		.pagination,
		.dialog-actions {
			display: flex;
			align-items: center;
		}
		.btns {
			gap: .04rem;
		}
		.pagination {
			gap: .36rem;
			font-size: .86em;
		}
		button {
			font: inherit;
			cursor: pointer;
		}
		.operations button {
			box-sizing: border-box;
			width: 2.05rem;
			height: 2rem;
			border: 0;
			border-radius: 0;
			background: transparent;
			color: inherit;
			padding: 0;
			line-height: 2rem;
			text-align: center;
		}
		.operations button:hover:not(:disabled),
		.operations button:focus-visible {
			background: rgba(255, 255, 255, .16);
			outline: none;
		}
		.operations button:disabled {
			opacity: .38;
			cursor: default;
		}
		.pagination .txt {
			font-size: .8em;
			margin: 0 .2em;
		}
		.pagination button {
			padding: 0 .28em;
		}
		.pagination button.big {
			font-size: 1.12em;
		}
		.pagination .page-input {
			box-sizing: border-box;
			width: 2.2em;
			height: 1.3em;
			border: 0;
			border-radius: 4px;
			background: rgba(var(--color1), .1);
			color: inherit;
			padding: 0 .16em;
			text-align: center;
		}
		.pagination .page-size {
			margin: 0 .3em;
		}
		.table-wrapper {
			height: calc(100vh - 3.76rem);
			overflow: auto;
		}
		table.pne {
			min-width: 100%;
			border-collapse: collapse;
			border-spacing: 0;
		}
		.pne th,
		.pne td {
			box-sizing: border-box;
			max-width: 16em;
			height: 2em;
			padding: 0 .5em;
			border: 0;
			line-height: 2em;
			text-align: left;
			white-space: nowrap;
			overflow: hidden;
			text-overflow: ellipsis;
		}
		.pne thead th {
			position: sticky;
			top: 0;
			background: rgba(var(--color0), .68);
			color: var(--vscode-editor-foreground);
			z-index: 1;
		}
		.pne tr > *:first-child {
			padding-left: 1em;
		}
		.pne tbody tr:nth-child(even) {
			background: rgba(var(--color1), .06);
		}
		.pne tbody tr:hover {
			background: rgba(var(--color1), .1);
		}
		.pne tr.highlight {
			background: rgba(var(--color1), .1) !important;
		}
		.pne th.highlight,
		.pne td.highlight {
			background: rgba(var(--color1), .1);
		}
		.sort-field {
			display: flex;
			align-items: center;
			cursor: pointer;
		}
		.sort-field span:first-child {
			overflow: hidden;
			text-overflow: ellipsis;
			white-space: nowrap;
		}
		.sort-icons {
			display: inline-flex;
			flex-direction: column;
			margin-left: .5em;
			cursor: pointer;
		}
		.sort-icon {
			display: block;
			width: 0;
			height: 0;
			opacity: .5;
			border-left: .28em solid transparent;
			border-right: .28em solid transparent;
		}
		.sort-icon.selected {
			opacity: 1;
		}
		.sort-icon.up {
			border-bottom: .42em solid currentColor;
			transform: translate(0, .16em);
		}
		.sort-icon.down {
			border-top: .42em solid currentColor;
			transform: translate(0, -.16em);
		}
		.pne td {
			cursor: cell;
			outline: none;
		}
		.pne td:hover {
			background: rgba(var(--color1), .1);
		}
		.pne td:focus {
			white-space: initial;
		}
		.empty-cell {
			text-align: center;
			color: var(--vscode-descriptionForeground);
		}
		.empty-header {
			color: var(--vscode-descriptionForeground);
		}
		.dialog-mask {
			display: none;
			position: fixed;
			inset: 0;
			z-index: 10;
			align-items: center;
			justify-content: center;
			background: rgba(0, 0, 0, .36);
		}
		body[data-dialog="search"] #searchDialog,
		body[data-dialog="fields"] #fieldsDialog,
		body[data-dialog="sql"] #sqlDialog {
			display: flex;
		}
		.dialog {
			box-sizing: border-box;
			width: min(34rem, calc(100vw - 2rem));
			max-height: calc(100vh - 2rem);
			overflow: auto;
			border: 1px solid var(--vscode-panel-border);
			background: var(--vscode-editor-background);
			color: var(--vscode-editor-foreground);
			box-shadow: 0 .5rem 1.5rem rgba(0, 0, 0, .28);
		}
		.dialog-title {
			padding: .62rem .85rem;
			border-bottom: 1px solid var(--vscode-panel-border);
			font-weight: 600;
		}
		.dialog-body {
			padding: .85rem;
		}
		.dialog-body label {
			display: block;
			margin-bottom: .62rem;
		}
		.dialog-body input,
		.dialog-body select {
			box-sizing: border-box;
			width: 100%;
			min-height: 1.9rem;
			margin-top: .28rem;
			border: 1px solid var(--vscode-input-border, transparent);
			background: var(--vscode-input-background);
			color: var(--vscode-input-foreground);
			padding: .28rem .45rem;
		}
		.column-grid {
			display: grid;
			grid-template-columns: repeat(auto-fill, minmax(9rem, 1fr));
			gap: .42rem .75rem;
			margin-bottom: .75rem;
		}
		.column-toggle {
			display: flex;
			align-items: center;
			gap: .38rem;
			min-width: 0;
		}
		.column-toggle input {
			width: auto;
			min-height: auto;
			margin: 0;
		}
		.column-toggle span {
			overflow: hidden;
			text-overflow: ellipsis;
			white-space: nowrap;
		}
		.dialog-actions {
			justify-content: flex-end;
			gap: .45rem;
			padding: .72rem .85rem;
			border-top: 1px solid var(--vscode-panel-border);
		}
		.dialog-actions button {
			min-width: 4.8rem;
			border: 1px solid var(--vscode-button-border, transparent);
			background: var(--vscode-button-background);
			color: var(--vscode-button-foreground);
			padding: .32rem .75rem;
		}
		.dialog-actions button.secondary {
			background: var(--vscode-button-secondaryBackground);
			color: var(--vscode-button-secondaryForeground);
		}
		pre.sql-view {
			max-height: 18rem;
			margin: 0;
			overflow: auto;
			white-space: pre-wrap;
			font-family: var(--vscode-editor-font-family, var(--vscode-font-family));
			font-size: .9em;
		}
		@media (max-width: 900px) {
			.operations {
				align-items: stretch;
				flex-direction: column;
				padding: 0;
			}
			.btns,
			.pagination {
				padding: 0 var(--padding-h);
			}
		}
	</style>
</head>
<body>
	<header>
		<nav title="${this.escapeHtml(tableNode.connection.name)} / ${this.escapeHtml(tableNode.schemaName)} / ${this.escapeHtml(tableNode.tableName)}">
			<span>${this.escapeHtml(tableNode.connection.name)}</span>
			<span class="split">›</span>
			<span>${this.escapeHtml(tableNode.schemaName)}</span>
			<span class="split">›</span>
			<span class="active">${this.escapeHtml(tableNode.tableName)}</span>
		</nav>
		<div class="operations">
			<div class="btns">
				<button type="button" title="刷新" onclick="postAction('refresh')">&#8635;</button>
				<button type="button" title="搜索" onclick="showDialog('search')">&#8981;</button>
				<button type="button" title="字段" onclick="showDialog('fields')">&#9638;</button>
				<button type="button" title="新增" onclick="postAction('insertRow')">+</button>
				<button type="button" title="复制" id="copyButton" onclick="copyFocusedRow()" disabled>C</button>
				<button type="button" title="保存" id="saveButton" onclick="saveEditedRows()" disabled>S</button>
				<button type="button" title="撤销" id="undoButton" onclick="undoEditedRows()" disabled>U</button>
				<button type="button" title="删除" id="deleteButton" onclick="deleteFocusedRow()" disabled>-</button>
				<button type="button" title="SQL" onclick="showDialog('sql')">SQL</button>
				<button type="button" title="终端" onclick="postAction('openSqlTerminal')">&gt;</button>
			</div>
			<div class="pagination">
				<button type="button" title="刷新" onclick="applyPagination()">&#8635;</button>
				<span class="txt">每页</span>
				<input id="pageSizeInput" class="page-input page-size" value="${rowPage.pageSize}" inputmode="numeric" />
				<span class="txt">条记录，共 </span>
				<span>${rowPage.totalRowCount}</span>
				<span class="txt"> 条、</span>
				<span>${pageCount}</span><span class="txt"> 页</span>
				<button type="button" class="big" title="第一页" onclick="goToPage(1)" ${pageNumber <= 1 ? 'disabled' : ''}>&lt;&lt;</button>
				<button type="button" class="big" title="上一页" onclick="goToPage(${Math.max(1, pageNumber - 1)})" ${pageNumber <= 1 ? 'disabled' : ''}>&lt;</button>
				<input id="pageIndexInput" class="page-input" value="${pageNumber}" inputmode="numeric" />
				<button type="button" class="big" title="下一页" onclick="goToPage(${Math.min(pageCount, pageNumber + 1)})" ${pageNumber >= pageCount ? 'disabled' : ''}>&gt;</button>
				<button type="button" class="big" title="最后一页" onclick="goToPage(${pageCount})" ${pageNumber >= pageCount ? 'disabled' : ''}>&gt;&gt;</button>
			</div>
		</div>
	</header>
	<div class="table-wrapper">
		<table class="pne">
			<thead>
				<tr>${columnHeaders}</tr>
			</thead>
			<tbody>
				${rowsMarkup}
			</tbody>
		</table>
	</div>
	<div class="dialog-mask" id="searchDialog" role="dialog" aria-modal="true">
		<div class="dialog">
			<div class="dialog-title">搜索数据</div>
			<div class="dialog-body">
				<label>
					关键字
					<input id="filterKeyword" value="${this.escapeHtml(state.filterKeyword)}" />
				</label>
				<label>
					排序字段
					<select id="sortColumnName">${sortOptions}</select>
				</label>
				<label>
					排序方向
					<select id="sortDirection">
						<option value="asc"${ascSelected}>ASC</option>
						<option value="desc"${descSelected}>DESC</option>
					</select>
				</label>
			</div>
			<div class="dialog-actions">
				<button type="button" class="secondary" onclick="clearQueryOptions()">清空</button>
				<button type="button" class="secondary" onclick="closeDialog()">关闭</button>
				<button type="button" onclick="applyQueryOptions()">搜索</button>
			</div>
		</div>
	</div>
	<div class="dialog-mask" id="fieldsDialog" role="dialog" aria-modal="true">
		<div class="dialog">
			<div class="dialog-title">字段选择</div>
			<div class="dialog-body">
				<div class="column-grid">
					${columnVisibilityControls}
				</div>
			</div>
			<div class="dialog-actions">
				<button type="button" class="secondary" onclick="setAllColumns(true)">全选</button>
				<button type="button" class="secondary" onclick="invertColumns()">反选</button>
				<button type="button" class="secondary" onclick="setAllColumns(false)">全不选</button>
				<button type="button" class="secondary" onclick="closeDialog()">关闭</button>
				<button type="button" onclick="applyColumnVisibility()">确定</button>
			</div>
		</div>
	</div>
	<div class="dialog-mask" id="sqlDialog" role="dialog" aria-modal="true">
		<div class="dialog">
			<div class="dialog-title">查看 SQL</div>
			<div class="dialog-body">
				<pre class="sql-view"><code>${this.escapeHtml(rowPage.sql)}</code></pre>
			</div>
			<div class="dialog-actions">
				<button type="button" class="secondary" onclick="closeDialog()">关闭</button>
				<button type="button" onclick="postAction('openSqlTerminal')">终端</button>
			</div>
		</div>
	</div>
	<script>
		const vscode = acquireVsCodeApi();
		const initialState = ${serializedState};
		const hasPrimaryKey = ${hasPrimaryKey ? 'true' : 'false'};
		const totalRowCount = ${rowPage.totalRowCount};
		let focusedRowIndex = undefined;
		const editing = {};
		vscode.setState(initialState);
		function persistState(nextState) {
			vscode.setState({
				...initialState,
				...nextState
			});
		}
		function postAction(type) {
			if ((type === 'refresh' || type === 'deleteRow') && hasPendingEdits()) {
				warnPendingEdits();
				return;
			}
			vscode.postMessage({ type });
		}
		function hasPendingEdits() {
			return Object.keys(editing).length > 0;
		}
		function warnPendingEdits() {
			window.alert('请先保存或撤销修改');
		}
		function getPageCount(pageSize) {
			return Math.max(1, Math.ceil(totalRowCount / pageSize));
		}
		function normalizePageSize() {
			const input = document.getElementById('pageSizeInput');
			const parsedSize = Number.parseInt(input.value, 10);
			if (!Number.isFinite(parsedSize) || parsedSize <= 0) {
				input.value = String(initialState.pageSize);
				return initialState.pageSize;
			}
			return parsedSize;
		}
		function normalizePageIndex(pageSize) {
			const input = document.getElementById('pageIndexInput');
			const parsedIndex = Number.parseInt(input.value, 10);
			const pageCount = getPageCount(pageSize);
			if (!Number.isFinite(parsedIndex) || parsedIndex <= 0) {
				input.value = '1';
				return 1;
			}
			if (parsedIndex >= pageCount) {
				input.value = String(pageCount);
				return pageCount;
			}
			return parsedIndex;
		}
		function applyPagination() {
			if (hasPendingEdits()) {
				warnPendingEdits();
				return;
			}
			const pageSize = normalizePageSize();
			requestPage(normalizePageIndex(pageSize), pageSize);
		}
		function goToPage(pageNumber) {
			if (hasPendingEdits()) {
				warnPendingEdits();
				return;
			}
			const pageSize = normalizePageSize();
			const pageCount = getPageCount(pageSize);
			const normalizedPageNumber = Math.min(Math.max(1, pageNumber), pageCount);
			requestPage(normalizedPageNumber, pageSize);
		}
		function requestPage(pageNumber, pageSize) {
			const nextPageIndex = Math.max(0, pageNumber - 1);
			document.getElementById('pageIndexInput').value = String(pageNumber);
			persistState({
				pageIndex: nextPageIndex,
				pageSize
			});
			vscode.postMessage({
				type: 'goToPage',
				pageIndex: nextPageIndex,
				pageSize
			});
		}
		function sortByColumn(columnName) {
			let sortColumnName = columnName;
			let sortDirection = 'asc';
			if (initialState.sortColumnName === columnName) {
				if (initialState.sortDirection === 'asc') {
					sortDirection = 'desc';
				} else {
					sortColumnName = '';
					sortDirection = 'asc';
				}
			}
			persistState({
				sortColumnName,
				sortDirection,
				pageIndex: 0
			});
			vscode.postMessage({
				type: 'applyQueryOptions',
				filterKeyword: initialState.filterKeyword,
				sortColumnName,
				sortDirection
			});
		}
		function showDialog(dialogName) {
			document.body.dataset.dialog = dialogName;
		}
		function closeDialog() {
			document.body.removeAttribute('data-dialog');
		}
		function editRow(rowIndex) {
			vscode.postMessage({
				type: 'editRow',
				rowIndex
			});
		}
		function deleteRow(rowIndex) {
			if (hasPendingEdits()) {
				warnPendingEdits();
				return;
			}
			vscode.postMessage({
				type: 'deleteRow',
				rowIndex
			});
		}
		function setFocusedCell(cell) {
			const row = cell.closest('tr[data-row-index]');
			if (!row) {
				return;
			}
			focusedRowIndex = Number.parseInt(row.dataset.rowIndex, 10);
			for (const item of document.querySelectorAll('.pne .highlight')) {
				item.classList.remove('highlight');
			}
			row.classList.add('highlight');
			const cellIndex = Array.from(row.children).indexOf(cell);
			for (const headerCell of document.querySelectorAll('.pne thead th')) {
				headerCell.classList.toggle(
					'highlight',
					Array.from(headerCell.parentElement.children).indexOf(headerCell) === cellIndex
				);
			}
			cell.classList.add('highlight');
			updateToolbarState();
		}
		function updateToolbarState() {
			const hasFocus = focusedRowIndex !== undefined && Number.isFinite(focusedRowIndex);
			const hasEditing = Object.keys(editing).length > 0;
			document.getElementById('copyButton').disabled = !hasFocus;
			document.getElementById('deleteButton').disabled = !hasPrimaryKey || !hasFocus;
			document.getElementById('saveButton').disabled = !hasPrimaryKey || !hasEditing;
			document.getElementById('undoButton').disabled = !hasPrimaryKey || !hasEditing;
		}
		function recordCellEdit(cell) {
			const row = cell.closest('tr[data-row-index]');
			if (!row) {
				return;
			}
			const rowIndex = row.dataset.rowIndex;
			const columnName = cell.dataset.columnName;
			const originalValue = cell.dataset.originalValue;
			const nextValue = cell.innerText;
			if (!editing[rowIndex]) {
				editing[rowIndex] = {};
			}
			if (nextValue === originalValue) {
				delete editing[rowIndex][columnName];
				if (Object.keys(editing[rowIndex]).length === 0) {
					delete editing[rowIndex];
				}
			} else {
				editing[rowIndex][columnName] =
					nextValue.toUpperCase() === 'NULL' ? null : nextValue;
			}
			updateToolbarState();
		}
		function saveEditedRows() {
			const edits = Object.entries(editing).map(([rowIndex, values]) => ({
				rowIndex: Number.parseInt(rowIndex, 10),
				values
			}));
			vscode.postMessage({
				type: 'saveEditedRows',
				edits
			});
		}
		function undoEditedRows() {
			if (!window.confirm('撤销全部？\\n您可以使用 ctrl-z(windows) 或 cmd-z(macos) 来撤销一小步')) {
				return;
			}
			for (const cell of document.querySelectorAll('[data-original-value]')) {
				cell.innerText = cell.dataset.originalValue;
			}
			for (const rowIndex of Object.keys(editing)) {
				delete editing[rowIndex];
			}
			updateToolbarState();
		}
		function deleteFocusedRow() {
			if (focusedRowIndex !== undefined) {
				deleteRow(focusedRowIndex);
			}
		}
		function copyFocusedRow() {
			if (focusedRowIndex !== undefined) {
				vscode.postMessage({
					type: 'copyRow',
					rowIndex: focusedRowIndex
				});
			}
		}
		function applyQueryOptions() {
			const filterKeyword = document.getElementById('filterKeyword').value;
			const sortColumnName = document.getElementById('sortColumnName').value;
			const sortDirection = document.getElementById('sortDirection').value;
			persistState({
				filterKeyword,
				sortColumnName,
				sortDirection,
				pageIndex: 0
			});
			vscode.postMessage({
				type: 'applyQueryOptions',
				filterKeyword,
				sortColumnName,
				sortDirection
			});
		}
		function clearQueryOptions() {
			persistState({
				filterKeyword: '',
				sortColumnName: '',
				sortDirection: 'asc',
				pageIndex: 0
			});
			vscode.postMessage({
				type: 'clearQueryOptions'
			});
		}
		function setAllColumns(checked) {
			for (const checkbox of document.querySelectorAll('#fieldsDialog [data-column-name]')) {
				checkbox.checked = checked;
			}
		}
		function invertColumns() {
			for (const checkbox of document.querySelectorAll('#fieldsDialog [data-column-name]')) {
				checkbox.checked = !checkbox.checked;
			}
		}
		function applyColumnVisibility() {
			const hiddenColumnNames = [];
			for (const checkbox of document.querySelectorAll('#fieldsDialog [data-column-name]')) {
				if (!checkbox.checked) {
					hiddenColumnNames.push(checkbox.dataset.columnName);
				}
			}
			persistState({ hiddenColumnNames });
			vscode.postMessage({
				type: 'setVisibleColumns',
				hiddenColumnNames
			});
		}
		document.addEventListener('keydown', (event) => {
			if (event.key === 'Escape') {
				closeDialog();
			}
		});
		for (const header of document.querySelectorAll('[data-sort-column]')) {
			header.addEventListener('click', () => sortByColumn(header.dataset.sortColumn));
		}
		for (const cell of document.querySelectorAll('.pne tbody td[data-column-name]')) {
			cell.addEventListener('click', () => setFocusedCell(cell));
			cell.addEventListener('input', () => recordCellEdit(cell));
		}
		updateToolbarState();
	</script>
</body>
</html>`;
	}

	/**
	 * 按旧 PPZ 表格结构渲染单个表格单元格。
	 *
	 * @param rowIndex 当前页行索引。
	 * @param column 当前单元格所属字段元数据。
	 * @param value 待渲染的单元格值。
	 * @param canEditRow 当前表是否允许通过主键编辑行。
	 * @returns HTML 表格单元格标记。
	 */
	private renderCell(
		rowIndex: number,
		column: MySqlTableColumnMetadata,
		value: string | number | boolean | null,
		canEditRow: boolean
	): string {
		const displayValue = value === null ? '' : String(value);
		const editable =
			canEditRow &&
			!column.isPrimaryKey &&
			!column.extra.toLowerCase().includes('auto_increment');

		return `<td
			data-row-index="${rowIndex}"
			data-column-name="${this.escapeHtml(column.name)}"
			data-original-value="${this.escapeHtml(displayValue)}"
			title="${this.escapeHtml(`${column.name}: ${column.dataType}`)}"
			${editable ? 'contenteditable="true"' : ''}
		>${this.escapeHtml(displayValue)}</td>`;
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

	/**
	 * 将数据安全序列化为可嵌入 script 的 JSON。
	 *
	 * @param value 需要嵌入 Webview 脚本的数据。
	 * @returns 经过转义的 JSON 字符串。
	 */
	private serializeScriptValue(value: unknown): string {
		return JSON.stringify(value)
			.replaceAll('<', '\\u003c')
			.replaceAll('>', '\\u003e')
			.replaceAll('&', '\\u0026')
			.replaceAll('\u2028', '\\u2028')
			.replaceAll('\u2029', '\\u2029');
	}
}
