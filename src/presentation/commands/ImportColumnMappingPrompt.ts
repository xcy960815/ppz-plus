import * as vscode from 'vscode';

import type { CreateImportErrorReportUseCase } from '../../application/useCases/CreateImportErrorReportUseCase';
import type {
	ImportColumnMapping,
	ImportMappingPreparationResult,
	ImportMappingPreparationSuccessResult,
} from '../../domain/import/ImportColumnMapping';
import { showImportErrorReport } from './ImportErrorReportPresenter';

/**
 * 提示用户确认或配置导入字段映射。
 *
 * @param createImportErrorReportUseCase 用于创建错误报告文档的用例。
 * @param formatName 导入文件格式名称。
 * @param fileName 导入文件名。
 * @param targetName 导入目标表名称。
 * @param preparation 字段映射配置准备结果。
 * @returns 用户确认后的字段映射；取消时返回空。
 */
export async function promptImportColumnMapping(
	createImportErrorReportUseCase: CreateImportErrorReportUseCase,
	formatName: string,
	fileName: string,
	targetName: string,
	preparation: ImportMappingPreparationResult
): Promise<readonly ImportColumnMapping[] | undefined> {
	if (!preparation.success) {
		await showImportErrorReport(createImportErrorReportUseCase, {
			formatName,
			fileName,
			targetName,
			stage: 'mapping',
			errorMessage: preparation.errorMessage,
		});
		return undefined;
	}

	const shouldConfigure = await shouldConfigureMapping(
		formatName,
		fileName,
		preparation
	);
	if (shouldConfigure === undefined) {
		await vscode.window.showInformationMessage(`${formatName} import canceled.`);
		return undefined;
	}

	if (!shouldConfigure) {
		return preparation.defaultMappings;
	}

	return promptManualMappings(
		createImportErrorReportUseCase,
		formatName,
		fileName,
		targetName,
		preparation
	);
}

/**
 * 判断用户是否需要手动配置字段映射。
 *
 * @param formatName 导入文件格式名称。
 * @param fileName 导入文件名。
 * @param preparation 成功准备好的映射上下文。
 * @returns 是否进入手动配置；取消时返回空。
 */
async function shouldConfigureMapping(
	formatName: string,
	fileName: string,
	preparation: ImportMappingPreparationSuccessResult
): Promise<boolean | undefined> {
	const hasUnmappedSources = preparation.defaultMappings.some(
		(mapping) => mapping.targetName === null
	);

	if (hasUnmappedSources) {
		await vscode.window.showInformationMessage(
			`${formatName} file "${fileName}" has source fields without exact target matches. Configure column mapping before import.`
		);
		return true;
	}

	const action = await vscode.window.showInformationMessage(
		`Use default ${formatName} column mapping for "${fileName}"?`,
		{
			modal: true,
			detail: formatMappingDetail(preparation.defaultMappings),
		},
		'Use Defaults',
		'Configure'
	);

	if (action === 'Use Defaults') {
		return false;
	}

	if (action === 'Configure') {
		return true;
	}

	return undefined;
}

/**
 * 逐个源字段提示用户选择目标字段。
 *
 * @param createImportErrorReportUseCase 用于创建错误报告文档的用例。
 * @param formatName 导入文件格式名称。
 * @param fileName 导入文件名。
 * @param targetName 导入目标表名称。
 * @param preparation 成功准备好的映射上下文。
 * @returns 手动配置后的字段映射；取消时返回空。
 */
async function promptManualMappings(
	createImportErrorReportUseCase: CreateImportErrorReportUseCase,
	formatName: string,
	fileName: string,
	targetName: string,
	preparation: ImportMappingPreparationSuccessResult
): Promise<readonly ImportColumnMapping[] | undefined> {
	const mappings: ImportColumnMapping[] = [];
	const usedTargetFields = new Set<string>();

	for (const sourceName of preparation.sourceFields) {
		const defaultTarget = preparation.defaultMappings.find(
			(mapping) => mapping.sourceName === sourceName
		)?.targetName;
		const selected = await vscode.window.showQuickPick(
			createMappingItems(
				preparation.targetFields,
				usedTargetFields,
				defaultTarget
			),
			{
				title: `Map ${formatName} Field`,
				placeHolder: `Choose target column for "${sourceName}"`,
			}
		);

		if (!selected) {
			await vscode.window.showInformationMessage(
				`${formatName} import canceled.`
			);
			return undefined;
		}

		if (selected.targetName !== null) {
			usedTargetFields.add(selected.targetName);
		}

		mappings.push({
			sourceName,
			targetName: selected.targetName,
		});
	}

	if (mappings.every((mapping) => mapping.targetName === null)) {
		await showImportErrorReport(createImportErrorReportUseCase, {
			formatName,
			fileName,
			targetName,
			stage: 'mapping',
			errorMessage: 'At least one import column must be mapped.',
			mappings,
		});
		return undefined;
	}

	return mappings;
}

/**
 * 创建单个源字段可选择的目标字段列表。
 *
 * @param targetFields 目标表字段列表。
 * @param usedTargetFields 已被映射的目标字段。
 * @param defaultTarget 当前源字段的默认目标字段。
 * @returns QuickPick 可展示的选项。
 */
function createMappingItems(
	targetFields: readonly string[],
	usedTargetFields: ReadonlySet<string>,
	defaultTarget: string | null | undefined
): Array<vscode.QuickPickItem & { readonly targetName: string | null }> {
	const availableTargets = targetFields.filter(
		(targetField) =>
			!usedTargetFields.has(targetField) || targetField === defaultTarget
	);
	const targetItems = availableTargets.map((targetField) => ({
		label: targetField,
		description: targetField === defaultTarget ? 'default match' : undefined,
		targetName: targetField,
	}));

	return [
		...targetItems,
		{
			label: 'Skip this field',
			description: 'Do not import this source field',
			targetName: null,
		},
	];
}

/**
 * 格式化默认字段映射详情。
 *
 * @param mappings 默认字段映射。
 * @returns 可展示的字段映射文本。
 */
function formatMappingDetail(
	mappings: readonly ImportColumnMapping[]
): string {
	return mappings
		.map(
			(mapping) =>
				`${mapping.sourceName} -> ${mapping.targetName ?? '(skip)'}`
		)
		.join('\n');
}
