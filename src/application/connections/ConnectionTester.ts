import type { ConnectionConfig } from "../../domain/connections/ConnectionConfig";

/**
 * 测试连接配置是否可访问目标服务。
 */
export interface ConnectionTester {
  /**
   * 验证连接配置。
   *
   * @param {ConnectionConfig} config 需要测试的连接配置。
   */
  test(config: ConnectionConfig): Promise<void>;
}
