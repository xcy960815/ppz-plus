import * as assert from "assert";

import type {
  ConnectionConfig,
  MssqlConnectionConfig,
  MssqlParameterConnectionConfig,
} from "../../domain/connections/ConnectionConfig";
import { validateMssqlUrl } from "../../domain/connections/ConnectionUrlValidator";
import { MssqlConnectionAdapter } from "../../infrastructure/mssql/MssqlConnectionAdapter";

suite("Infrastructure — MSSQL 连接适配器", () => {
  test("supports 仅接受 MSSQL 连接配置", () => {
    const adapter = new MssqlConnectionAdapter();
    const mssqlConfig = makeMssqlParameterConfig();
    const mysqlConfig: ConnectionConfig = {
      id: "mysql",
      name: "MySQL",
      engine: "mysql",
      mode: "parameters",
      host: "127.0.0.1",
      port: 3306,
      username: "root",
    };

    assert.strictEqual(adapter.supports(mssqlConfig), true);
    assert.strictEqual(adapter.supports(mysqlConfig), false);
  });

  test("参数模式映射到 mssql/tedious 连接选项", () => {
    const adapter = new MssqlConnectionAdapter();

    const options = adapter.resolveDriverOptions({
      ...makeMssqlParameterConfig(),
      password: "secret",
      database: "master",
      encrypt: true,
      trustServerCertificate: false,
    });

    assert.deepStrictEqual(options, {
      server: "127.0.0.1",
      port: 1433,
      user: "sa",
      password: "secret",
      database: "master",
      options: {
        encrypt: true,
        trustServerCertificate: false,
      },
    });
  });

  test("URL 模式解析认证、database 与安全参数", () => {
    const adapter = new MssqlConnectionAdapter();
    const config: MssqlConnectionConfig = {
      id: "mssql-url",
      name: "MSSQL URL",
      engine: "mssql",
      mode: "url",
      url: "mssql://sa:p%40ss@localhost:11433/app%20db?encrypt=false&trustServerCertificate=true",
    };

    assert.deepStrictEqual(adapter.resolveEndpoint(config), {
      host: "localhost",
      port: 11433,
    });
    assert.deepStrictEqual(adapter.resolveDriverOptions(config), {
      server: "localhost",
      port: 11433,
      user: "sa",
      password: "p@ss",
      database: "app db",
      options: {
        encrypt: false,
        trustServerCertificate: true,
      },
    });
  });

  test("URL 模式缺省端口和安全参数使用明确默认值", () => {
    const adapter = new MssqlConnectionAdapter();
    const config: MssqlConnectionConfig = {
      id: "mssql-default-url",
      name: "MSSQL 默认 URL",
      engine: "mssql",
      mode: "url",
      url: "mssql://sa:secret@localhost/master",
    };

    assert.deepStrictEqual(adapter.resolveDriverOptions(config), {
      server: "localhost",
      port: 1433,
      user: "sa",
      password: "secret",
      database: "master",
      options: {
        encrypt: true,
        trustServerCertificate: false,
      },
    });
  });

  test("URL 校验只接受 mssql 协议", () => {
    assert.strictEqual(validateMssqlUrl("mssql://sa:secret@localhost:1433/master"), undefined);
    assert.strictEqual(
      validateMssqlUrl("mysql://root@localhost:3306/mysql"),
      "URL 必须以 mssql:// 开头。",
    );
  });

  test("URL 安全参数只接受 true 或 false", () => {
    const adapter = new MssqlConnectionAdapter();
    const config: MssqlConnectionConfig = {
      id: "mssql-bad-url",
      name: "MSSQL 错误 URL",
      engine: "mssql",
      mode: "url",
      url: "mssql://sa:secret@localhost/master?encrypt=yes",
    };

    assert.throws(
      () => adapter.resolveDriverOptions(config),
      /MSSQL URL 参数 encrypt 仅支持 true 或 false。/,
    );
  });
});

/**
 * 构建基础 MSSQL 参数连接配置。
 *
 * @returns {MssqlConnectionConfig} MSSQL 参数连接配置。
 */
function makeMssqlParameterConfig(): MssqlParameterConnectionConfig {
  return {
    id: "mssql",
    name: "MSSQL",
    engine: "mssql",
    mode: "parameters",
    host: "127.0.0.1",
    port: 1433,
    username: "sa",
    encrypt: true,
    trustServerCertificate: false,
  };
}
