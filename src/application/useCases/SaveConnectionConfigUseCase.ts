import type { ConnectionRepository } from '../connections/ConnectionRepository';
import type { ConnectionConfig } from '../../domain/connections/ConnectionConfig';

/**
 * 保存连接配置。
 */
export class SaveConnectionConfigUseCase {
	/**
	 * 创建保存连接用例。
	 *
	 * @param connectionRepository 用于持久化已保存连接的仓储。
	 */
	public constructor(
		private readonly connectionRepository: ConnectionRepository
	) {}

	/**
	 * 持久化连接配置。
	 *
	 * @param config 需要保存的连接配置。
	 */
	public async execute(config: ConnectionConfig): Promise<void> {
		await this.connectionRepository.save(config);
	}
}
