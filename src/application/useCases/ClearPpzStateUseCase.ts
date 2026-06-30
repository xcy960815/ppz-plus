import type { ConnectionRepository } from "../connections/ConnectionRepository";
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
   */
  public constructor(
    private readonly connectionRepository: ConnectionRepository,
    private readonly sqlExportTaskLogRepository: SqlExportTaskLogRepository,
  ) {}

  /**
   * 清空连接配置和 SQL 导出日志。
   */
  public async execute(): Promise<void> {
    await Promise.all([this.connectionRepository.clear(), this.sqlExportTaskLogRepository.clear()]);
  }
}
