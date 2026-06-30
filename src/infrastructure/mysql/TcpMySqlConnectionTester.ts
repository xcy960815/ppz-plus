import * as net from "node:net";

import type { ConnectionTester } from "../../application/connections/ConnectionTester";
import type { ConnectionConfig } from "../../domain/connections/ConnectionConfig";
import { MySqlConnectionAdapter } from "./MySqlConnectionAdapter";

/**
 * 通过打开 TCP socket 测试配置端点的 MySQL 连接可达性。
 */
export class TcpMySqlConnectionTester implements ConnectionTester {
  /**
   * 定义连接测试使用的 socket 超时时间。
   */
  private static readonly timeoutInMilliseconds = 5000;

  /**
   * 创建 MySQL TCP 连接测试器。
   *
   * @param mySqlConnectionAdapter 用于解析 MySQL 端点的适配器。
   */
  public constructor(private readonly mySqlConnectionAdapter: MySqlConnectionAdapter) {}

  /**
   * 测试配置的 MySQL 端点是否可通过 TCP 访问。
   *
   * @param {ConnectionConfig} config 待验证的连接配置。
   */
  public async test(config: ConnectionConfig): Promise<void> {
    if (!this.mySqlConnectionAdapter.supports(config)) {
      throw new Error("当前 MVP 仅支持 MySQL 连接。");
    }

    /**
     * 解析 TCP socket 探测使用的端点。
     */
    const endpoint = this.mySqlConnectionAdapter.resolveEndpoint(config);

    await new Promise<void>((resolve, reject) => {
      /**
       * 创建可达性探测使用的 socket。
       */
      const socket = new net.Socket();

      /**
       * 在完成或拒绝探测前关闭 socket。
       */
      const finalize = (callback: () => void): void => {
        socket.removeAllListeners();
        socket.destroy();
        callback();
      };

      socket.setTimeout(TcpMySqlConnectionTester.timeoutInMilliseconds);
      socket.once("connect", () => finalize(resolve));
      socket.once("timeout", () =>
        finalize(() =>
          reject(new Error(`Timed out while connecting to ${endpoint.host}:${endpoint.port}.`)),
        ),
      );
      socket.once("error", (error) =>
        finalize(() =>
          reject(new Error(`Could not reach ${endpoint.host}:${endpoint.port}: ${error.message}`)),
        ),
      );
      socket.connect(endpoint.port, endpoint.host);
    });
  }
}
