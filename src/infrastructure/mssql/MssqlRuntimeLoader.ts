import type { MssqlRuntimeModule } from "./MssqlRuntimeTypes";

/**
 * 动态加载 MSSQL 运行时依赖，避免表现层和领域层直接依赖驱动。
 */
export class MssqlRuntimeLoader {
  /**
   * 按需加载 mssql 运行时模块。
   *
   * @returns {Promise<MssqlRuntimeModule>} 动态导入的 mssql 模块。
   */
  public async loadMssqlModule(): Promise<MssqlRuntimeModule> {
    try {
      /**
       * 使用间接动态导入，使编译期不依赖 mssql 的类型声明。
       */
      const dynamicImport = new Function("modulePath", "return import(modulePath);") as (
        modulePath: string,
      ) => Promise<unknown>;
      const importedModule = await dynamicImport("mssql");
      return this.normalizeRuntimeModule(importedModule);
    } catch (error) {
      throw new Error(
        [
          'MSSQL runtime support requires the "mssql" package to be installed.',
          error instanceof Error ? error.message : String(error),
        ].join(" "),
      );
    }
  }

  /**
   * 归一化 CommonJS / ESM 动态导入返回结构。
   *
   * @param {unknown} importedModule 动态导入得到的模块对象。
   * @returns {MssqlRuntimeModule} 可供基础设施使用的 mssql 运行时模块。
   */
  private normalizeRuntimeModule(importedModule: unknown): MssqlRuntimeModule {
    const candidate = this.readModuleCandidate(importedModule);

    if (!candidate || typeof candidate.ConnectionPool !== "function") {
      throw new Error("mssql package does not expose ConnectionPool.");
    }

    return candidate as MssqlRuntimeModule;
  }

  /**
   * 从动态导入结果中读取可能的运行时模块对象。
   *
   * @param {unknown} importedModule 动态导入得到的模块对象。
   * @returns {{ readonly ConnectionPool?: unknown } | undefined} 候选模块对象。
   */
  private readModuleCandidate(
    importedModule: unknown,
  ): { readonly ConnectionPool?: unknown } | undefined {
    if (!importedModule || typeof importedModule !== "object") {
      return undefined;
    }

    const moduleRecord = importedModule as {
      readonly ConnectionPool?: unknown;
      readonly default?: unknown;
    };

    if (moduleRecord.ConnectionPool) {
      return moduleRecord;
    }

    return moduleRecord.default && typeof moduleRecord.default === "object"
      ? (moduleRecord.default as { readonly ConnectionPool?: unknown })
      : undefined;
  }
}
