import type { ConnectionTester } from "../../application/connections/ConnectionTester";
import type { ConnectionConfig } from "../../domain/connections/ConnectionConfig";
import { MssqlConnectionAdapter } from "./MssqlConnectionAdapter";
import { MssqlRuntimeLoader } from "./MssqlRuntimeLoader";
import type { MssqlRuntimeConnectionPool } from "./MssqlRuntimeTypes";

/**
 * 通过 mssql 驱动真实建立 SQL Server 连接并执行探测查询。
 */
export class MssqlConnectionTester implements ConnectionTester {
  /**
   * 创建 MSSQL 连接测试器。
   *
   * @param mssqlConnectionAdapter 用于归一化 MSSQL 连接选项的适配器。
   * @param mssqlRuntimeLoader 用于延迟解析 mssql 运行时的加载器。
   */
  public constructor(
    private readonly mssqlConnectionAdapter: MssqlConnectionAdapter,
    private readonly mssqlRuntimeLoader: MssqlRuntimeLoader,
  ) {}

  /**
   * 测试 MSSQL 连接是否可用。
   *
   * @param {ConnectionConfig} config 待验证的连接配置。
   */
  public async test(config: ConnectionConfig): Promise<void> {
    if (!this.mssqlConnectionAdapter.supports(config)) {
      throw new Error("暂不支持测试当前数据库连接。");
    }

    const mssql = await this.mssqlRuntimeLoader.loadMssqlModule();
    const pool = new mssql.ConnectionPool(this.mssqlConnectionAdapter.resolveDriverOptions(config));

    try {
      await pool.connect();
      await pool.request().query("SELECT 1 AS ok");
    } finally {
      await this.closePool(pool);
    }
  }

  /**
   * 关闭连接池，关闭失败不覆盖主要连接测试结果。
   *
   * @param {MssqlRuntimeConnectionPool} pool 需要关闭的连接池。
   */
  private async closePool(pool: MssqlRuntimeConnectionPool): Promise<void> {
    try {
      await pool.close();
    } catch {
      /**
       * 连接测试结果优先，关闭失败不覆盖主要错误。
       */
    }
  }
}
