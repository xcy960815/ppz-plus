import * as path from "node:path";

import type {
  ConnectionConfig,
  Sqlite3ConnectionConfig,
} from "../../domain/connections/ConnectionConfig";

/**
 * 为基础设施服务归一化 SQLite3 连接细节。
 */
export class Sqlite3ConnectionAdapter {
  /**
   * 检查连接配置是否属于 SQLite3 引擎。
   *
   * @param {ConnectionConfig} config 正在检查的连接配置。
   * @returns {config is Sqlite3ConnectionConfig} 该配置是否为 SQLite3 连接。
   */
  public supports(config: ConnectionConfig): config is Sqlite3ConnectionConfig {
    return config.engine === "sqlite3";
  }

  /**
   * 解析 SQLite3 配置对应的本地数据库文件路径。
   *
   * @param {Sqlite3ConnectionConfig} config SQLite3 连接配置。
   * @returns {string} 绝对数据库文件路径。
   */
  public resolveDatabasePath(config: Sqlite3ConnectionConfig): string {
    if (config.dbPath.trim().length === 0) {
      throw new Error("SQLite3 数据库文件路径不能为空。");
    }

    return path.resolve(config.dbPath);
  }
}
