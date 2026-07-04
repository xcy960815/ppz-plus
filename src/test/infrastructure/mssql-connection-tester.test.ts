import * as assert from "assert";

import type { ConnectionConfig } from "../../domain/connections/ConnectionConfig";
import { MssqlConnectionAdapter } from "../../infrastructure/mssql/MssqlConnectionAdapter";
import { MssqlConnectionTester } from "../../infrastructure/mssql/MssqlConnectionTester";
import type {
  MssqlDriverOptions,
  MssqlRuntimeConnectionPool,
  MssqlRuntimeConnectionPoolConstructor,
  MssqlRuntimeModule,
  MssqlRuntimeRequest,
} from "../../infrastructure/mssql/MssqlRuntimeTypes";

/**
 * 描述 fake 连接池的可配置行为。
 */
interface FakePoolBehavior {
  readonly connectError?: Error;
  readonly queryError?: Error;
  readonly closeError?: Error;
}

/**
 * 记录 fake 连接池执行过程中的观测结果。
 */
interface FakePoolState {
  readonly calls: string[];
  readonly driverOptions: MssqlDriverOptions[];
  querySql?: string;
}

suite("Infrastructure — MSSQL 连接测试器", () => {
  test("成功路径按 connect、query、close 顺序执行", async () => {
    const state = createFakePoolState();
    const tester = makeTester(state);

    await tester.test(makeMssqlConfig());

    assert.deepStrictEqual(state.calls, ["connect", "request", "query", "close"]);
    assert.strictEqual(state.querySql, "SELECT 1 AS ok");
    assert.deepStrictEqual(state.driverOptions, [
      {
        server: "127.0.0.1",
        port: 1433,
        user: "sa",
        password: "secret",
        database: "master",
        options: {
          encrypt: true,
          trustServerCertificate: false,
        },
      },
    ]);
  });

  test("非 MSSQL 连接直接拒绝且不加载运行时", async () => {
    const state = createFakePoolState();
    const loader = new FakeRuntimeLoader(state);
    const tester = new MssqlConnectionTester(new MssqlConnectionAdapter(), loader as never);
    const mysqlConnection: ConnectionConfig = {
      id: "mysql",
      name: "MySQL",
      engine: "mysql",
      mode: "parameters",
      host: "127.0.0.1",
      port: 3306,
      username: "root",
    };

    await assert.rejects(() => tester.test(mysqlConnection), /暂不支持测试当前数据库连接。/);
    assert.deepStrictEqual(state.calls, []);
  });

  test("connect 失败时仍关闭连接池且抛出原始错误", async () => {
    const state = createFakePoolState();
    const connectError = new Error("login failed");
    const closeError = new Error("close failed");
    const tester = makeTester(state, { connectError, closeError });

    await assert.rejects(() => tester.test(makeMssqlConfig()), connectError);
    assert.deepStrictEqual(state.calls, ["connect", "close"]);
  });

  test("query 失败时仍关闭连接池且抛出原始错误", async () => {
    const state = createFakePoolState();
    const queryError = new Error("query failed");
    const closeError = new Error("close failed");
    const tester = makeTester(state, { queryError, closeError });

    await assert.rejects(() => tester.test(makeMssqlConfig()), queryError);
    assert.deepStrictEqual(state.calls, ["connect", "request", "query", "close"]);
  });

  test("仅 close 失败时不覆盖成功测试结果", async () => {
    const state = createFakePoolState();
    const tester = makeTester(state, { closeError: new Error("close failed") });

    await tester.test(makeMssqlConfig());

    assert.deepStrictEqual(state.calls, ["connect", "request", "query", "close"]);
  });
});

/**
 * 创建带 fake 运行时的 MSSQL 连接测试器。
 *
 * @param {FakePoolState} state fake 连接池状态。
 * @param {FakePoolBehavior} behavior fake 连接池行为。
 * @returns {MssqlConnectionTester} 注入 fake runtime 的连接测试器。
 */
function makeTester(state: FakePoolState, behavior: FakePoolBehavior = {}): MssqlConnectionTester {
  return new MssqlConnectionTester(
    new MssqlConnectionAdapter(),
    new FakeRuntimeLoader(state, behavior) as never,
  );
}

/**
 * 创建 fake 连接池状态。
 *
 * @returns {FakePoolState} 初始 fake 状态。
 */
function createFakePoolState(): FakePoolState {
  return {
    calls: [],
    driverOptions: [],
  };
}

/**
 * 构建 MSSQL 参数连接配置。
 *
 * @returns {ConnectionConfig} MSSQL 参数连接配置。
 */
function makeMssqlConfig(): ConnectionConfig {
  return {
    id: "mssql",
    name: "MSSQL",
    engine: "mssql",
    mode: "parameters",
    host: "127.0.0.1",
    port: 1433,
    username: "sa",
    password: "secret",
    database: "master",
    encrypt: true,
    trustServerCertificate: false,
  };
}

/**
 * 提供可注入的 fake MSSQL 运行时加载器。
 */
class FakeRuntimeLoader {
  /**
   * 创建 fake 运行时加载器。
   *
   * @param state fake 连接池状态。
   * @param behavior fake 连接池行为。
   */
  public constructor(
    private readonly state: FakePoolState,
    private readonly behavior: FakePoolBehavior = {},
  ) {}

  /**
   * 返回 fake MSSQL 运行时模块。
   *
   * @returns {Promise<MssqlRuntimeModule>} fake MSSQL 运行时模块。
   */
  public async loadMssqlModule(): Promise<MssqlRuntimeModule> {
    const state = this.state;
    const behavior = this.behavior;

    return {
      ConnectionPool: class FakeConnectionPool implements MssqlRuntimeConnectionPool {
        /**
         * 创建 fake 连接池。
         *
         * @param {MssqlDriverOptions} driverOptions 驱动连接选项。
         */
        public constructor(driverOptions: MssqlDriverOptions) {
          state.driverOptions.push(driverOptions);
        }

        /**
         * 模拟连接建立。
         *
         * @returns {Promise<MssqlRuntimeConnectionPool>} 当前连接池。
         */
        public async connect(): Promise<MssqlRuntimeConnectionPool> {
          state.calls.push("connect");

          if (behavior.connectError) {
            throw behavior.connectError;
          }

          return this;
        }

        /**
         * 创建 fake 请求对象。
         *
         * @returns {MssqlRuntimeRequest} fake 请求对象。
         */
        public request(): MssqlRuntimeRequest {
          state.calls.push("request");

          return {
            async query(sql: string): Promise<unknown> {
              state.calls.push("query");
              state.querySql = sql;

              if (behavior.queryError) {
                throw behavior.queryError;
              }

              return { recordset: [{ ok: 1 }] };
            },
          };
        }

        /**
         * 模拟关闭连接池。
         */
        public async close(): Promise<void> {
          state.calls.push("close");

          if (behavior.closeError) {
            throw behavior.closeError;
          }
        }
      } satisfies MssqlRuntimeConnectionPoolConstructor,
    };
  }
}
