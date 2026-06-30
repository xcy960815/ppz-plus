import type { DatabaseCapabilityDeclaration } from "../../domain/capabilities/DatabaseCapabilityDeclaration";
import type { DatabaseEngine } from "../../domain/database/DatabaseEngine";

/**
 * 提供数据库能力声明的只读访问。
 */
export interface DatabaseCapabilityCatalog {
  /**
   * 根据引擎标识查找能力声明。
   *
   * @param {DatabaseEngine} engine 数据库引擎标识。
   * @returns {DatabaseCapabilityDeclaration | undefined} 存在时返回匹配的能力声明。
   */
  find(engine: DatabaseEngine): DatabaseCapabilityDeclaration | undefined;

  /**
   * 列出能力目录中可用的全部能力声明。
   *
   * @returns {readonly DatabaseCapabilityDeclaration[]} 不可变的能力声明列表。
   */
  list(): readonly DatabaseCapabilityDeclaration[];
}
