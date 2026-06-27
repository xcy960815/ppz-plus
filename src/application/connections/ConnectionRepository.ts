import type { ConnectionConfig } from '../../domain/connections/ConnectionConfig';

/**
 * 持久化并读取已保存连接配置。
 */
export interface ConnectionRepository {
	/**
	 * 列出所有已保存的连接配置。
	 *
	 * @returns 按展示顺序排列的已保存连接。
	 */
	list(): Promise<readonly ConnectionConfig[]>;

	/**
	 * 根据标识查找已保存连接。
	 *
	 * @param id 连接标识。
	 * @returns 存在时返回匹配的连接。
	 */
	find(id: string): Promise<ConnectionConfig | undefined>;

	/**
	 * 保存连接配置，并替换具有相同标识的已有记录。
	 *
	 * @param config 需要持久化的连接配置。
	 */
	save(config: ConnectionConfig): Promise<void>;

	/**
	 * 删除已保存连接配置。
	 *
	 * @param id 需要删除的连接标识。
	 */
	delete(id: string): Promise<void>;
}
