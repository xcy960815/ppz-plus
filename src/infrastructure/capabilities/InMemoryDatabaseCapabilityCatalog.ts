import type { DatabaseCapabilityCatalog } from "../../application/capabilities/DatabaseCapabilityCatalog";
import type { DatabaseCapabilityDeclaration } from "../../domain/capabilities/DatabaseCapabilityDeclaration";
import type { DatabaseEngine } from "../../domain/database/DatabaseEngine";

/**
 * 在内存中保存能力声明，用于启动阶段组装。
 */
export class InMemoryDatabaseCapabilityCatalog implements DatabaseCapabilityCatalog {
  /**
   * 创建内存能力目录。
   *
   * @param declarations 应用可用的能力声明。
   */
  public constructor(private readonly declarations: readonly DatabaseCapabilityDeclaration[]) {}

  /**
   * 根据数据库引擎查找能力声明。
   *
   * @param {DatabaseEngine} engine 数据库引擎标识。
   * @returns {DatabaseCapabilityDeclaration | undefined} 存在时返回匹配的能力声明。
   */
  public find(engine: DatabaseEngine): DatabaseCapabilityDeclaration | undefined {
    return this.declarations.find((declaration) => declaration.engine === engine);
  }

  /**
   * 返回内存中保存的全部能力声明。
   *
   * @returns {readonly DatabaseCapabilityDeclaration[]} 不可变的能力声明列表。
   */
  public list(): readonly DatabaseCapabilityDeclaration[] {
    return this.declarations;
  }
}
