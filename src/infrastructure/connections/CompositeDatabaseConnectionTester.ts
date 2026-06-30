import type { ConnectionTester } from "../../application/connections/ConnectionTester";
import type { ConnectionConfig } from "../../domain/connections/ConnectionConfig";

/**
 * 根据连接引擎委派给对应的连接测试实现。
 */
export class CompositeDatabaseConnectionTester implements ConnectionTester {
  /**
   * 创建复合连接测试器。
   *
   * @param testersByEngine 按数据库引擎索引的测试器集合。
   */
  public constructor(private readonly testersByEngine: ReadonlyMap<string, ConnectionTester>) {}

  /**
   * 使用当前连接引擎对应的测试器执行连接测试。
   *
   * @param {ConnectionConfig} config 待验证的连接配置。
   */
  public async test(config: ConnectionConfig): Promise<void> {
    const tester = this.testersByEngine.get(config.engine);

    if (!tester) {
      throw new Error("暂不支持测试当前数据库连接。");
    }

    await tester.test(config);
  }
}
