import type {
	ImportColumnMapping,
} from '../../domain/import/ImportColumnMapping';
import type {
	MySqlTableInsertValue,
} from '../mysql/MySqlTableDataProvider';
import type { MySqlTableImportRow } from '../mysql/MySqlTableImportProvider';

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
	 * @param sourceFields 源文件字段列表。
	 * @param targetFields 目标表字段列表。
	 * @returns 默认字段映射。
	 */
	public createDefaultMappings(
		sourceFields: readonly string[],
		targetFields: readonly string[]
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
	 * @param sourceFields 源文件字段列表。
	 * @param targetFields 目标表字段列表。
	 * @param mappings 用户提供的字段映射。
	 * @returns 可用于行转换的有效字段映射。
	 */
	public normalizeMappings(
		sourceFields: readonly string[],
		targetFields: readonly string[],
		mappings?: readonly ImportColumnMapping[]
	): readonly NormalizedImportColumnMapping[] {
		const sourceFieldSet = new Set(sourceFields);
		const targetFieldSet = new Set(targetFields);
		const effectiveMappings =
			mappings ?? this.createDefaultMappings(sourceFields, targetFields);
		const usedTargets = new Set<string>();
		const normalizedMappings: NormalizedImportColumnMapping[] = [];

		for (const mapping of effectiveMappings) {
			if (!sourceFieldSet.has(mapping.sourceName)) {
				throw new Error(
					`Import mapping references unknown source field "${mapping.sourceName}".`
				);
			}

			if (mapping.targetName === null) {
				continue;
			}

			if (!targetFieldSet.has(mapping.targetName)) {
				throw new Error(
					`Import mapping references unknown target field "${mapping.targetName}".`
				);
			}

			if (usedTargets.has(mapping.targetName)) {
				throw new Error(
					`Import mapping assigns multiple source fields to "${mapping.targetName}".`
				);
			}

			usedTargets.add(mapping.targetName);
			normalizedMappings.push({
				sourceName: mapping.sourceName,
				targetName: mapping.targetName,
			});
		}

		if (normalizedMappings.length === 0) {
			throw new Error('At least one import column must be mapped.');
		}

		return normalizedMappings;
	}

	/**
	 * 将源记录按映射转换为目标表写入行。
	 *
	 * @param rows 源文件记录。
	 * @param sourceFields 源文件字段列表。
	 * @param targetFields 目标表字段列表。
	 * @param mappings 用户提供的字段映射。
	 * @param readValue 从源记录读取字段值的函数。
	 * @returns 目标表写入行。
	 */
	public mapRows<TSourceRow>(
		rows: readonly TSourceRow[],
		sourceFields: readonly string[],
		targetFields: readonly string[],
		mappings: readonly ImportColumnMapping[] | undefined,
		readValue: (
			row: TSourceRow,
			sourceName: string
		) => MySqlTableInsertValue
	): readonly MySqlTableImportRow[] {
		const normalizedMappings = this.normalizeMappings(
			sourceFields,
			targetFields,
			mappings
		);

		return rows.map((row) =>
			Object.fromEntries(
				normalizedMappings.map((mapping) => [
					mapping.targetName,
					readValue(row, mapping.sourceName),
				])
			)
		) as MySqlTableImportRow[];
	}

	/**
	 * 按映射生成导入预览表头。
	 *
	 * @param sourceFields 源文件字段列表。
	 * @param targetFields 目标表字段列表。
	 * @param mappings 用户提供的字段映射。
	 * @returns 目标表预览字段列表。
	 */
	public mapHeaders(
		sourceFields: readonly string[],
		targetFields: readonly string[],
		mappings?: readonly ImportColumnMapping[]
	): readonly string[] {
		return this.normalizeMappings(sourceFields, targetFields, mappings).map(
			(mapping) => mapping.targetName
		);
	}
}
