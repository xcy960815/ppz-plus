import type { ConnectionRepository } from '../connections/ConnectionRepository';

/**
 * 删除已保存连接配置。
 */
export class DeleteStoredConnectionUseCase {
	/**
	 * 创建删除连接用例。
	 *
	 * @param connectionRepository 用于删除已保存连接的仓储。
	 */
	public constructor(
		private readonly connectionRepository: ConnectionRepository
	) {}

	/**
	 * 根据标识删除连接。
	 *
	 * @param id 需要删除的连接标识。
	 */
	public async execute(id: string): Promise<void> {
		await this.connectionRepository.delete(id);
	}
}
