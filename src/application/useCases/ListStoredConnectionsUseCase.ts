import type { ConnectionRepository } from '../connections/ConnectionRepository';
import type { ConnectionConfig } from '../../domain/connections/ConnectionConfig';

/**
 * 列出已保存的连接配置。
 */
export class ListStoredConnectionsUseCase {
	/**
	 * 创建连接列表用例。
	 *
	 * @param connectionRepository 用于读取已保存连接的仓储。
	 */
	public constructor(
		private readonly connectionRepository: ConnectionRepository
	) {}

	/**
	 * 返回全部已保存连接配置。
	 *
	 * @returns {Promise<readonly ConnectionConfig[]>} 已保存的连接记录。
	 */
	public async execute(): Promise<readonly ConnectionConfig[]> {
		return this.connectionRepository.list();
	}
}
