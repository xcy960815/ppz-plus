/**
 * 描述单个源字段到目标表字段的导入映射。
 */
export interface ImportColumnMapping {
	readonly sourceName: string;
	readonly targetName: string | null;
}

/**
 * 表示成功准备好的导入映射配置上下文。
 */
export interface ImportMappingPreparationSuccessResult {
	readonly success: true;
	readonly sourceFields: readonly string[];
	readonly targetFields: readonly string[];
	readonly defaultMappings: readonly ImportColumnMapping[];
}

/**
 * 表示准备导入映射配置失败。
 */
export interface ImportMappingPreparationFailureResult {
	readonly success: false;
	readonly errorMessage: string;
}

/**
 * 描述导入映射配置准备结果。
 */
export type ImportMappingPreparationResult =
	| ImportMappingPreparationSuccessResult
	| ImportMappingPreparationFailureResult;
