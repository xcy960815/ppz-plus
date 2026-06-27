import type * as vscode from 'vscode';

import type { ConnectionRepository } from '../../application/connections/ConnectionRepository';
import type { ConnectionConfig } from '../../domain/connections/ConnectionConfig';

/**
 * 将连接配置保存到 VS Code 全局状态中。
 */
export class GlobalStateConnectionRepository
	implements ConnectionRepository
{
	/**
	 * 定义保存连接记录使用的全局状态键。
	 */
	private static readonly storageKey = 'ppz-plus.connections';

	/**
	 * 创建基于全局状态的连接仓储。
	 *
	 * @param globalState VS Code 全局状态存储。
	 */
	public constructor(private readonly globalState: vscode.Memento) {}

	/**
	 * 列出所有已保存的连接配置。
	 *
	 * @returns 已保存的连接配置。
	 */
	public async list(): Promise<readonly ConnectionConfig[]> {
		return this.readConnections();
	}

	/**
	 * 根据标识查找已保存连接。
	 *
	 * @param id 连接标识。
	 * @returns 存在时返回匹配的已保存连接。
	 */
	public async find(id: string): Promise<ConnectionConfig | undefined> {
		const connections = this.readConnections();
		return connections.find((connection) => connection.id === id);
	}

	/**
	 * 保存连接配置，并替换具有相同标识的已有连接。
	 *
	 * @param config 需要持久化的连接配置。
	 */
	public async save(config: ConnectionConfig): Promise<void> {
		const connections = this.readConnections();
		const existingIndex = connections.findIndex(
			(connection) => connection.id === config.id
		);

		/**
		 * 构建 upsert 操作后的下一份连接列表。
		 */
		const nextConnections =
			existingIndex === -1
				? [...connections, config]
				: connections.map((connection, index) =>
						index === existingIndex ? config : connection
					);

		await this.globalState.update(
			GlobalStateConnectionRepository.storageKey,
			nextConnections
		);
	}

	/**
	 * 删除已保存连接配置。
	 *
	 * @param id 需要删除的连接标识。
	 */
	public async delete(id: string): Promise<void> {
		const connections = this.readConnections().filter(
			(connection) => connection.id !== id
		);
		await this.globalState.update(
			GlobalStateConnectionRepository.storageKey,
			connections
		);
	}

	/**
	 * 从 VS Code 全局状态读取已保存连接列表。
	 *
	 * @returns 已保存连接列表。
	 */
	private readConnections(): ConnectionConfig[] {
		return this.globalState.get<ConnectionConfig[]>(
			GlobalStateConnectionRepository.storageKey,
			[]
		);
	}
}
