import type { ConnectionRepository } from "../connections/ConnectionRepository";
import type { ConnectionSyncStore } from "../connections/ConnectionSyncStore";
import type { SqlExportTaskLogRepository } from "../export/SqlExportTaskLogRepository";

/**
 * 清空 PPZ Plus 保存在 VS Code 全局状态中的用户数据。
 */
export class ClearPpzStateUseCase {
  /**
   * 创建清空 PPZ Plus 状态用例。
   *
   * @param connectionRepository 用于清空已保存连接的仓储。
   * @param sqlExportTaskLogRepository 用于清空 SQL 导出日志的仓储。
   * @param connectionSyncStore 用于清空 VS Code 账号同步中的连接载荷。
   */
  public constructor(
    private readonly connectionRepository: ConnectionRepository,
    private readonly sqlExportTaskLogRepository: SqlExportTaskLogRepository,
    private readonly connectionSyncStore: ConnectionSyncStore,
  ) {}

  /**
   * 清空连接配置、SQL 导出日志以及账号同步中的连接载荷。
   */
  public async execute(): Promise<void> {
    await Promise.all([
      this.connectionRepository.clear(),
      this.sqlExportTaskLogRepository.clear(),
      this.connectionSyncStore.clear(),
    ]);
  }
}
