import type { Sqlite3RuntimeModule } from "./Sqlite3RuntimeTypes";

/**
 * 动态加载可选 SQLite3 运行时依赖，避免建立静态 TypeScript 依赖边。
 */
export class Sqlite3RuntimeLoader {
  /**
   * 按需加载 @vscode/sqlite3 运行时模块。
   *
   * @returns {Promise<Sqlite3RuntimeModule>} 动态导入的 @vscode/sqlite3 模块。
   */
  public async loadSqlite3Module(): Promise<Sqlite3RuntimeModule> {
    try {
      /**
       * 使用间接动态导入，使仓库编译假设与依赖安装时机解耦。
       */
      const dynamicImport = new Function("modulePath", "return import(modulePath);") as (
        modulePath: string,
      ) => Promise<unknown>;
      const loadedModule = (await dynamicImport("@vscode/sqlite3")) as Record<string, unknown>;
      const runtimeModule =
        (loadedModule.default as Sqlite3RuntimeModule | undefined) ??
        (loadedModule as unknown as Sqlite3RuntimeModule);

      return runtimeModule.verbose ? runtimeModule.verbose() : runtimeModule;
    } catch (error) {
      throw new Error(
        [
          'SQLite3 runtime support requires the "@vscode/sqlite3" package to be installed.',
          error instanceof Error ? error.message : String(error),
        ].join(" "),
      );
    }
  }
}
