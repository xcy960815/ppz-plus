import type { ImportColumnMapping } from "../../domain/import/ImportColumnMapping";
import type { MySqlTableInsertValue } from "../mysql/MySqlTableDataProvider";
import type { MySqlTableImportRow } from "../mysql/MySqlTableImportProvider";

/**
 * 表示已确认会写入目标字段的导入映射。
 */
interface NormalizedImportColumnMapping {
  readonly sourceName: string;
  readonly targetName: string;
}

/**
 * 将源文件字段按映射转换为目标表字段。
 */
export class ImportColumnMapper {
  /**
   * 根据源字段和目标字段生成默认映射。
   *
   * @param {readonly string[]} sourceFields 源文件字段列表。
   * @param {readonly string[]} targetFields 目标表字段列表。
   * @returns {readonly ImportColumnMapping[]} 默认字段映射。
   */
  public createDefaultMappings(
    sourceFields: readonly string[],
    targetFields: readonly string[],
  ): readonly ImportColumnMapping[] {
    const targetFieldSet = new Set(targetFields);
    return sourceFields.map((sourceName) => ({
      sourceName,
      targetName: targetFieldSet.has(sourceName) ? sourceName : null,
    }));
  }

  /**
   * 校验并归一化字段映射。
   *
   * @param {readonly string[]} sourceFields 源文件字段列表。
   * @param {readonly string[]} targetFields 目标表字段列表。
   * @param {readonly ImportColumnMapping[]} mappings 用户提供的字段映射。
   * @returns {readonly NormalizedImportColumnMapping[]} 可用于行转换的有效字段映射。
   */
  public normalizeMappings(
    sourceFields: readonly string[],
    targetFields: readonly string[],
    mappings?: readonly ImportColumnMapping[],
  ): readonly NormalizedImportColumnMapping[] {
    const sourceFieldSet = new Set(sourceFields);
    const targetFieldSet = new Set(targetFields);
    const effectiveMappings = mappings ?? this.createDefaultMappings(sourceFields, targetFields);
    const usedTargets = new Set<string>();
    const normalizedMappings: NormalizedImportColumnMapping[] = [];

    for (const mapping of effectiveMappings) {
      if (!sourceFieldSet.has(mapping.sourceName)) {
        throw new Error(`导入映射引用了未知源字段“${mapping.sourceName}”。`);
      }

      if (mapping.targetName === null) {
        continue;
      }

      if (!targetFieldSet.has(mapping.targetName)) {
        throw new Error(`导入映射引用了未知目标字段“${mapping.targetName}”。`);
      }

      if (usedTargets.has(mapping.targetName)) {
        throw new Error(`导入映射将多个源字段指向了“${mapping.targetName}”。`);
      }

      usedTargets.add(mapping.targetName);
      normalizedMappings.push({
        sourceName: mapping.sourceName,
        targetName: mapping.targetName,
      });
    }

    if (normalizedMappings.length === 0) {
      throw new Error("至少需要映射一个导入字段。");
    }

    return normalizedMappings;
  }

  /**
	 * 将源记录按映射转换为目标表写入行。
	 *
	 * @param {readonly TSourceRow[]} rows 源文件记录。
	 * @param {readonly string[]} sourceFields 源文件字段列表。
	 * @param {readonly string[]} targetFields 目标表字段列表。
	 * @param {readonly ImportColumnMapping[] | undefined} mappings 用户提供的字段映射。
	 * @param {(
			row: TSourceRow,
			sourceName: string
		)} readValue 从源记录读取字段值的函数。
	 * @returns {readonly MySqlTableImportRow[]} 目标表写入行。
	 */
  public mapRows<TSourceRow>(
    rows: readonly TSourceRow[],
    sourceFields: readonly string[],
    targetFields: readonly string[],
    mappings: readonly ImportColumnMapping[] | undefined,
    readValue: (row: TSourceRow, sourceName: string) => MySqlTableInsertValue,
  ): readonly MySqlTableImportRow[] {
    const normalizedMappings = this.normalizeMappings(sourceFields, targetFields, mappings);

    return rows.map((row) =>
      Object.fromEntries(
        normalizedMappings.map((mapping) => [
          mapping.targetName,
          readValue(row, mapping.sourceName),
        ]),
      ),
    ) as MySqlTableImportRow[];
  }

  /**
   * 按映射生成导入预览表头。
   *
   * @param {readonly string[]} sourceFields 源文件字段列表。
   * @param {readonly string[]} targetFields 目标表字段列表。
   * @param {readonly ImportColumnMapping[]} mappings 用户提供的字段映射。
   * @returns {readonly string[]} 目标表预览字段列表。
   */
  public mapHeaders(
    sourceFields: readonly string[],
    targetFields: readonly string[],
    mappings?: readonly ImportColumnMapping[],
  ): readonly string[] {
    return this.normalizeMappings(sourceFields, targetFields, mappings).map(
      (mapping) => mapping.targetName,
    );
  }
}
